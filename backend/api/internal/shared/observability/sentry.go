// Package observability reports HTTP panics and background probe failures.
package observability

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/getsentry/sentry-go"
	"google.golang.org/grpc/status"
	"renewal-api/internal/shared/firestore"
)

type Reporter struct {
	hub *sentry.Hub
}

func New(dsn, environment, release string) Reporter {
	var client *sentry.Client
	if dsn != "" {
		// Cloud Run may suspend CPU after the response. Bound delivery time
		// and send while the failing request is still active.
		transport := sentry.NewHTTPSyncTransport()
		transport.Timeout = time.Second
		var err error
		client, err = sentry.NewClient(sentry.ClientOptions{
			Dsn: dsn, Environment: environment, Release: release,
			Transport: transport, AttachStacktrace: true,
			BeforeSend: func(event *sentry.Event, _ *sentry.EventHint) *sentry.Event {
				event.Request = nil
				event.User = sentry.User{}
				return event
			},
		})
		if err != nil {
			slog.Warn("Sentry initialization failed; check SENTRY_DSN")
		}
	}
	return Reporter{hub: sentry.NewHub(client, sentry.NewScope())}
}

func (r Reporter) HTTP(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		hub := r.hub.Clone()
		defer func() {
			if value := recover(); value != nil {
				if value == http.ErrAbortHandler {
					panic(value)
				}
				hub.Recover(errors.New("HTTP handler panicked"))
				http.Error(w, http.StatusText(http.StatusInternalServerError), http.StatusInternalServerError)
			}
		}()
		next.ServeHTTP(w, req.WithContext(sentry.SetHubOnContext(req.Context(), hub)))
	})
}

// FirestoreCheck runs at refresh time, including in the health worker goroutine.
// Cached 503 responses share the original failure report.
func (r Reporter) FirestoreCheck(check func(context.Context) error) func(context.Context) error {
	return func(ctx context.Context) (err error) {
		defer func() {
			if value := recover(); value != nil {
				err = errors.New("Firestore health check panicked")
				r.hub.Recover(err)
			}
		}()
		err = check(ctx)
		if err != nil && !errors.Is(err, context.Canceled) && !errors.Is(err, firestore.ErrNotConfigured) {
			hub := r.hub.Clone()
			hub.Scope().SetTag("grpc.code", status.Code(err).String())
			hub.CaptureException(errors.New("Firestore metadata lookup failed"))
		}
		return err
	}
}
