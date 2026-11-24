package renewals

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestMalformedWriteNeverReachesStore(t *testing.T) {
	mux := http.NewServeMux()
	Register(mux, func(context.Context, func(*Board) error) error {
		t.Fatal("unexpected write")
		return nil
	})
	for _, tc := range []struct {
		path, media, body string
		status            int
	}{
		{"/workbench/reset", "application/json", "{}", 400},
		{"/workbench/reset", "application/json", `{"version":0} {}`, 400},
		{"/workbench/reset", "text/plain", `{"version":0}`, 400},
		{"/workbench/accounts/drift/commands", "application/json", `{"timeZone":"UTC","command":{"type":"resolve"}}`, 400},
		{"/workbench/accounts/drift/commands", "application/json", `{"revision":0,"timeZone":"invalid","command":{"type":"resolve"}}`, 400},
		{"/workbench/accounts/unknown/commands", "application/json", `{"revision":0,"timeZone":"UTC","command":{"type":"resolve"}}`, 404},
	} {
		req := httptest.NewRequest("POST", tc.path, strings.NewReader(tc.body))
		req.Header.Set("Content-Type", tc.media)
		out := httptest.NewRecorder()
		mux.ServeHTTP(out, req)
		if out.Code != tc.status {
			t.Errorf("%s %s: got %d, want %d", tc.path, tc.body, out.Code, tc.status)
		}
	}
}

func TestResetWithoutBodyUsesCurrentBoard(t *testing.T) {
	board := Board{Version: 7, Changes: map[string]Account{"drift": {Information: "Pending question", Revision: 7}}}
	mux := http.NewServeMux()
	Register(mux, func(_ context.Context, mutate func(*Board) error) error { return mutate(&board) })
	out := httptest.NewRecorder()
	mux.ServeHTTP(out, httptest.NewRequest(http.MethodPost, "/workbench/reset", nil))
	if out.Code != http.StatusNoContent || board.Version != 8 || board.Changes["drift"].Information != "" || len(board.Changes) != 6 {
		t.Fatalf("reset returned %d, board = %+v", out.Code, board)
	}
}

func TestWriteLimitBeforeStorage(t *testing.T) {
	calls := 0
	handler := writeHandler(func(context.Context, func(*Board) error) error {
		calls++
		return nil
	}, true, &writeLimit{perPeer: 1, perInstance: 2, until: time.Now().Add(time.Minute), peers: make(map[string]int)})
	for _, tc := range []struct {
		remote string
		status int
	}{
		{"192.0.2.1:1001", 204},
		{"192.0.2.1:1002", 429},
		{"192.0.2.2:1001", 204},
		{"192.0.2.3:1001", 429},
	} {
		req := httptest.NewRequest("POST", "/workbench/reset", nil)
		req.RemoteAddr = tc.remote
		out := httptest.NewRecorder()
		handler(out, req)
		if out.Code != tc.status || (out.Code == 429 && out.Header().Get("Retry-After") == "") {
			t.Fatalf("peer %s: %d, headers %v", tc.remote, out.Code, out.Header())
		}
	}
	if calls != 2 {
		t.Fatalf("store received %d writes, want 2", calls)
	}
}

func TestResetCooldownAcrossHandlers(t *testing.T) {
	board := Board{Changes: make(map[string]Account)}
	for _, want := range []int{204, 429} {
		mux := http.NewServeMux()
		Register(mux, func(_ context.Context, mutate func(*Board) error) error { return mutate(&board) })
		out := httptest.NewRecorder()
		mux.ServeHTTP(out, httptest.NewRequest("POST", "/workbench/reset", nil))
		if out.Code != want || board.Version != 1 || (want == 429 && !strings.Contains(out.Body.String(), "rateLimited")) {
			t.Fatalf("reset: status %d, version %d, body %s", out.Code, board.Version, out.Body)
		}
	}
}
