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

func TestTrustedIngressIdentity(t *testing.T) {
	for _, tc := range []struct {
		hops            int
		forwarded, want string
	}{
		{0, "192.0.2.2", "127.0.0.1"}, {1, "192.0.2.2, 198.51.100.8", "198.51.100.8"},
		{1, "192.0.2.3, 198.51.100.8", "198.51.100.8"}, {1, "198.51.100.9", "198.51.100.9"},
		{2, "198.51.100.8, 203.0.113.1", "198.51.100.8"}, {2, "203.0.113.1", "127.0.0.1"},
		{1, "invalid", "127.0.0.1"}, {1, "2001:db8::abc", "2001:db8::/64"},
	} {
		req := httptest.NewRequest("GET", "/", nil)
		req.RemoteAddr = "127.0.0.1:42"
		req.Header.Set("X-Forwarded-For", tc.forwarded)
		if got := peerAddress(req, tc.hops); got != tc.want {
			t.Errorf("got %q, want %q", got, tc.want)
		}
	}
}
