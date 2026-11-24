package ratelimit

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"testing/synctest"
	"time"
)

func TestPeerAndInstanceBucketsRefillIndependently(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		handler := PerMinute{PerPeer: 2, PerInstance: 3}.Wrap(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusNoContent)
		}))
		check := func(remote string, want int, retry string) {
			t.Helper()
			req := httptest.NewRequest("POST", "/", nil)
			req.RemoteAddr = remote
			out := httptest.NewRecorder()
			handler.ServeHTTP(out, req)
			if out.Code != want || out.Header().Get("Retry-After") != retry {
				t.Fatalf("peer %s: status %d headers %v", remote, out.Code, out.Header())
			}
		}
		check("192.0.2.1:1001", 204, "")
		check("192.0.2.1:1002", 204, "")
		check("192.0.2.1:1003", 429, "30")
		// The rejected request left the last instance token available.
		check("192.0.2.2:1001", 204, "")
		check("192.0.2.3:1001", 429, "20")
		time.Sleep(19500 * time.Millisecond)
		check("192.0.2.3:1001", 429, "1")
		time.Sleep(500 * time.Millisecond)
		check("192.0.2.3:1001", 204, "")
	})
}
