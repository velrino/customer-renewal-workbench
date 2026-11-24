package observability_test

import (
	"bytes"
	"compress/gzip"
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"renewal-api/internal/app"
	health "renewal-api/internal/modules/health-check"
	"renewal-api/internal/shared/observability"
)

func TestErrorDelivery(t *testing.T) {
	const deliveryDelay = 50 * time.Millisecond
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
		time.Sleep(deliveryDelay)
		events <- string(raw)
		w.WriteHeader(http.StatusOK)
	}))
	defer ingest.Close()
	dsn := strings.Replace(ingest.URL, "http://", "http://test@", 1) + "/1"
	reporter := observability.New(dsn, "test", "test-revision")
	check := reporter.FirestoreCheck(func(context.Context) error { return errors.New("private-diagnostic") })
	routes := reporter.HTTP(app.Routes("test", check, 0, false))
	var lookupTime int64
	for i := range 2 {
		w := httptest.NewRecorder()
		routes.ServeHTTP(w, httptest.NewRequest("GET", "/", nil))
		if w.Code != 503 {
			t.Fatal(w.Code)
		}
		var response health.HealthCheckResponse
		if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
			t.Fatal(err)
		}
		elapsed := response.Checks["firestore"].ResponseTime
		if i == 0 {
			lookupTime = elapsed
			if response.ResultTime.Total-elapsed < deliveryDelay.Milliseconds()-1 {
				t.Fatalf("delivery time counted as Firestore time: %+v", response.ResultTime)
			}
		}
		if elapsed != lookupTime || response.ResultTime.Average != lookupTime {
			t.Fatalf("inconsistent cached lookup duration: %+v", response)
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

	_, err := reporter.FirestoreCheck(func(context.Context) error { panic("private-background") })(context.Background())
	if err == nil {
		t.Fatal("expected a failed probe")
	}
	assertEvent("Firestore health check panicked")
}

func TestPanicLogWithoutDSN(t *testing.T) {
	var output bytes.Buffer
	previous := slog.Default()
	slog.SetDefault(slog.New(slog.NewJSONHandler(&output, nil)))
	t.Cleanup(func() { slog.SetDefault(previous) })
	handler := observability.New("", "test", "").HTTP(http.HandlerFunc(func(http.ResponseWriter, *http.Request) { panic("private-panic") }))
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, httptest.NewRequest("GET", "/private-path?private-query", nil))
	if response.Code != 500 || !strings.Contains(output.String(), "TestPanicLogWithoutDSN") || strings.Contains(output.String(), "private-") {
		t.Fatalf("unexpected panic diagnostic: status %d", response.Code)
	}
}
