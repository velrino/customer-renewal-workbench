package app

import (
	"context"
	"encoding/json"
	"errors"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"testing/synctest"
	"time"

	health "renewal-api/internal/modules/health-check"
)

func TestHealth(t *testing.T) {
	for _, tc := range []struct {
		name string
		err  error
		code int
		ttl  time.Duration
	}{
		{"healthy", nil, 200, time.Minute}, {"degraded", errors.New("private diagnostic"), 503, 5 * time.Second},
	} {
		t.Run(tc.name, func(t *testing.T) {
			var calls atomic.Int32
			results := make(chan *httptest.ResponseRecorder, 4)
			synctest.Test(t, func(t *testing.T) {
				release := make(chan struct{})
				handler := Routes("test", func(ctx context.Context) (time.Duration, error) {
					calls.Add(1)
					if _, ok := ctx.Deadline(); !ok {
						t.Error("missing probe deadline")
					}
					<-release
					return 10 * time.Millisecond, tc.err
				}, 0)
				for range 4 {
					go func() {
						w := httptest.NewRecorder()
						handler.ServeHTTP(w, httptest.NewRequest("GET", "/", nil))
						results <- w
					}()
				}
				synctest.Wait()
				activeCalls := calls.Load()
				close(release)
				if activeCalls != 1 {
					t.Fatalf("expected one in-flight probe for four pending requests, got %d", activeCalls)
				}
			})
			misses := 0
			for range 4 {
				w := <-results
				if w.Header().Get("Access-Control-Allow-Origin") != "*" {
					t.Fatal("browser cannot read health response")
				}
				if w.Code != tc.code || w.Header().Get("Cache-Control") != "no-store" {
					t.Fatal(w.Result())
				}
				var response health.HealthCheckResponse
				if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
					t.Fatal(err)
				}
				c := response.Cache
				created, err := time.Parse(time.RFC3339Nano, c.CreatedAt)
				if err != nil {
					t.Fatal(err)
				}
				expires, err := time.Parse(time.RFC3339Nano, c.ExpiresAt)
				if err != nil {
					t.Fatal(err)
				}
				if expires.Sub(created) != tc.ttl {
					t.Fatal(c)
				}
				if !c.Hit {
					misses++
				}
				check := response.Checks["firestore"]
				if (tc.err == nil && check.Status != "up") || (tc.err != nil && check.Message != "UNAVAILABLE") {
					t.Fatal(check)
				}
			}
			if calls.Load() != 1 || misses != 1 {
				t.Fatal("expected one shared refresh", calls.Load(), misses)
			}
		})
	}
}

func TestDocsAndRoutes(t *testing.T) {
	h := Routes("test", nil, 0)
	for _, tc := range []struct {
		method, path string
		code         int
	}{{"GET", "/missing", 404}, {"POST", "/", 405}, {"GET", "/docs", 200}, {"GET", "/openapi.json", 200}} {
		w := httptest.NewRecorder()
		h.ServeHTTP(w, httptest.NewRequest(tc.method, tc.path, nil))
		if w.Code != tc.code {
			t.Fatal(tc.path, w.Code)
		}
		switch tc.path {
		case "/docs":
			if !strings.Contains(w.Body.String(), "/openapi.json") {
				t.Fatal("missing spec link")
			}
		case "/openapi.json":
			var spec struct {
				Paths map[string]map[string]struct{ Responses map[string]json.RawMessage }
			}
			if err := json.Unmarshal(w.Body.Bytes(), &spec); err != nil {
				t.Fatal(err)
			}
			responses := spec.Paths["/"]["get"].Responses
			if responses["200"] == nil || responses["503"] == nil {
				t.Fatal("incomplete health contract")
			}
		}
	}
}
