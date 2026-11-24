package observability_test

import (
	"compress/gzip"
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"renewal-api/internal/app"
	"renewal-api/internal/shared/observability"
)

func TestErrorDelivery(t *testing.T) {
	events := make(chan string, 8)
	ingest := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body io.Reader = r.Body
		if r.Header.Get("Content-Encoding") == "gzip" {
			reader, err := gzip.NewReader(body)
			if err != nil {
				t.Error(err)
				return
			}
			defer reader.Close()
			body = reader
		}
		raw, err := io.ReadAll(body)
		if err != nil {
			t.Error(err)
			return
		}
		events <- string(raw)
		w.WriteHeader(http.StatusOK)
	}))
	defer ingest.Close()
	dsn := strings.Replace(ingest.URL, "http://", "http://test@", 1) + "/1"
	reporter := observability.New(dsn, "test", "test-revision")
	check := reporter.FirestoreCheck(func(context.Context) error { return errors.New("private-diagnostic") })
	routes := reporter.HTTP(app.Routes("test", check))
	for range 2 {
		w := httptest.NewRecorder()
		routes.ServeHTTP(w, httptest.NewRequest("GET", "/", nil))
		if w.Code != 503 {
			t.Fatal(w.Code)
		}
	}
	assertEvent := func(message string) {
		t.Helper()
		select {
		case event := <-events:
			for _, want := range []string{message, "test-revision", "stacktrace"} {
				if !strings.Contains(event, want) {
					t.Errorf("missing %q", want)
				}
			}
			if strings.Contains(event, "private-") {
				t.Error("private diagnostic or request data included")
			}
		default:
			t.Fatal("missing event")
		}
	}
	assertEvent("Firestore metadata lookup failed")
	if len(events) != 0 {
		t.Fatal("cached failure emitted another event")
	}

	w := httptest.NewRecorder()
	req := httptest.NewRequest("POST", "/?value=private-query", strings.NewReader("private-body"))
	req.Header.Set("Authorization", "Bearer private-token")
	reporter.HTTP(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		panic("private-panic")
	})).ServeHTTP(w, req)
	if w.Code != 500 {
		t.Fatal(w.Code)
	}
	assertEvent("HTTP handler panicked")

	err := reporter.FirestoreCheck(func(context.Context) error { panic("private-background") })(context.Background())
	if err == nil {
		t.Fatal("expected a failed probe")
	}
	assertEvent("Firestore health check panicked")
}
