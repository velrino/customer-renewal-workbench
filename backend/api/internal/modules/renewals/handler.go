package renewals

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"mime"
	"net/http"
	"slices"
	"time"

	"renewal-api/internal/shared/ratelimit"
)

type readBoard func(context.Context) (Board, error)

type updateBoard func(context.Context, bool, func(*Board) error) error

func Register(mux *http.ServeMux, read readBoard, update updateBoard, trustedHops int, origins []string) {
	commands := "/workbench/accounts/{account}/commands"
	reset := "/workbench/reset"
	listQuota := ratelimit.PerMinute{PerPeer: 60, PerInstance: 240, TrustedHops: trustedHops}
	commandQuota := ratelimit.PerMinute{PerPeer: 30, PerInstance: 120, TrustedHops: trustedHops}
	resetQuota := ratelimit.PerMinute{PerPeer: 3, PerInstance: 12, TrustedHops: trustedHops}
	mux.Handle("GET /workbench/accounts", publicResponse(listQuota.Wrap(listHandler(read))))
	mux.Handle("POST "+commands, browserWrite(origins, commandQuota.Wrap(writeHandler(update, false))))
	mux.Handle("POST "+reset, browserWrite(origins, resetQuota.Wrap(writeHandler(update, true))))
	for _, path := range []string{commands, reset} {
		mux.Handle("OPTIONS "+path, browserWrite(origins, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Access-Control-Max-Age", "600")
			w.Header().Set("Access-Control-Allow-Methods", "POST")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
			w.WriteHeader(http.StatusNoContent)
		})))
	}
}

func browserWrite(origins []string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Add("Vary", "Origin")
		w.Header().Set("Access-Control-Expose-Headers", "Retry-After")
		if values := r.Header.Values("Origin"); len(values) > 0 {
			if len(values) != 1 || !slices.Contains(origins, values[0]) || values[0] == "" || values[0] == "null" {
				respondError(w, failure{http.StatusForbidden, "invalidOrigin"})
				return
			}
			w.Header().Set("Access-Control-Allow-Origin", values[0])
		}
		next.ServeHTTP(w, r)
	})
}

func publicResponse(next http.Handler) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("Access-Control-Expose-Headers", "Retry-After")
		next.ServeHTTP(w, r)
	}
}

func writeHandler(update updateBoard, reset bool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		mutate := func(b *Board) error { return b.reset(time.Now().UTC()) }
		if reset {
			if _, err := io.Copy(io.Discard, http.MaxBytesReader(w, r.Body, 0)); err != nil {
				respondError(w, failure{400, "invalidRequest"})
				return
			}
		} else {
			media, _, _ := mime.ParseMediaType(r.Header.Get("Content-Type"))
			if media != "application/json" {
				respondError(w, failure{415, "invalidRequest"})
				return
			}
			dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8192))
			dec.DisallowUnknownFields()
			decode := func(input any) bool { return dec.Decode(input) == nil && dec.Decode(new(any)) == io.EOF }
			var body struct {
				Revision *int64          `json:"revision"`
				TimeZone string          `json:"timeZone"`
				Command  json.RawMessage `json:"command"`
			}
			if !decode(&body) || body.Revision == nil || *body.Revision < 0 || body.TimeZone == "" || body.TimeZone == "Local" {
				respondError(w, failure{400, "invalidRequest"})
				return
			}
			var cmd Command
			if err := json.Unmarshal(body.Command, &cmd); err != nil || !validCommandFields(body.Command, cmd.Type) {
				respondError(w, failure{400, "invalidRequest"})
				return
			}
			loc, err := time.LoadLocation(body.TimeZone)
			if err != nil {
				respondError(w, failure{400, "invalidRequest"})
				return
			}
			now := time.Now().In(loc)
			id := r.PathValue("account")
			if _, ok := daysUntilRenewal(id); !ok {
				respondError(w, failure{404, "unknownAccount"})
				return
			}
			mutate = func(b *Board) error { return b.apply(id, *body.Revision, cmd, now) }
		}
		ctx, cancel := context.WithTimeout(r.Context(), 7*time.Second)
		defer cancel()
		if err := update(ctx, reset, mutate); err != nil {
			var delay resetCooldownRemaining
			if errors.As(err, &delay) {
				ratelimit.WriteRetryAfter(w, time.Duration(delay))
				return
			}
			var f failure
			if !errors.As(err, &f) {
				slog.Warn("Shared workbench transaction failed", "error", err)
				f = failure{503, "storage"}
			}
			respondError(w, f)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}
func respondError(w http.ResponseWriter, f failure) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(f.code)
	_ = json.NewEncoder(w).Encode(map[string]string{"reason": f.reason})
}

func validCommandFields(raw json.RawMessage, kind string) bool {
	var fields map[string]json.RawMessage
	if json.Unmarshal(raw, &fields) != nil || fields["type"] == nil {
		return false
	}
	for key, value := range fields {
		if string(value) == "null" {
			return false
		}
		if key == "type" {
			continue
		}
		if kind == "plan" && (key == "action" || key == "owner" || key == "followUp") {
			continue
		}
		if kind == "information" && key == "question" {
			continue
		}
		return false
	}
	return true
}
