package renewals

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestMalformedWriteNeverReachesStore(t *testing.T) {
	mux := http.NewServeMux()
	Register(mux, nil, func(context.Context, bool, func(*Board) error) error {
		t.Fatal("unexpected write")
		return nil
	}, 0, nil)
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
	Register(mux, nil, func(_ context.Context, _ bool, mutate func(*Board) error) error { return mutate(&board) }, 0, nil)
	out := httptest.NewRecorder()
	mux.ServeHTTP(out, httptest.NewRequest(http.MethodPost, "/workbench/reset", nil))
	if out.Code != http.StatusNoContent || board.Version != 8 || board.Changes["drift"].Information != "" || len(board.Changes) != 6 {
		t.Fatalf("reset returned %d, board = %+v", out.Code, board)
	}
}

func TestResetQuotaDoesNotBlockCommandsOrPreflight(t *testing.T) {
	mux := http.NewServeMux()
	calls := 0
	Register(mux, nil, func(context.Context, bool, func(*Board) error) error { calls++; return nil }, 0, nil)
	reset := "/workbench/reset"
	for i := range 4 {
		out := httptest.NewRecorder()
		mux.ServeHTTP(out, httptest.NewRequest("POST", reset, nil))
		if i < 3 && out.Code != 204 {
			t.Fatalf("reset %d: %d", i, out.Code)
		}
		if i == 3 && (out.Code != 429 || out.Header().Get("Access-Control-Allow-Origin") != "" || out.Header().Get("Access-Control-Expose-Headers") != "Retry-After") {
			t.Fatalf("throttled reset: %d %v", out.Code, out.Header())
		}
	}
	preflight := httptest.NewRecorder()
	mux.ServeHTTP(preflight, httptest.NewRequest("OPTIONS", reset, nil))
	command := httptest.NewRequest("POST", "/workbench/accounts/cove/commands", strings.NewReader(`{"revision":0,"timeZone":"UTC","command":{"type":"resolve"}}`))
	command.Header.Set("Content-Type", "application/json")
	out := httptest.NewRecorder()
	mux.ServeHTTP(out, command)
	if preflight.Code != 204 || out.Code != 204 || calls != 4 {
		t.Fatalf("preflight=%d command=%d store calls=%d", preflight.Code, out.Code, calls)
	}
}

func TestResetCooldownAcrossHandlers(t *testing.T) {
	board := Board{Changes: make(map[string]Account)}
	for _, want := range []int{204, 429} {
		mux := http.NewServeMux()
		Register(mux, nil, func(_ context.Context, _ bool, mutate func(*Board) error) error { return mutate(&board) }, 0, nil)
		out := httptest.NewRecorder()
		mux.ServeHTTP(out, httptest.NewRequest("POST", "/workbench/reset", nil))
		if out.Code != want || board.Version != 1 || (want == 429 && !strings.Contains(out.Body.String(), "rateLimited")) {
			t.Fatalf("reset: status %d, version %d, body %s", out.Code, board.Version, out.Body)
		}
	}
}

func TestWriteOrigins(t *testing.T) {
	const dashboard = "https://dashboard.example"
	for _, tc := range []struct {
		method, origin string
		code, calls    int
	}{
		{"POST", "", 204, 1}, {"POST", dashboard, 204, 1}, {"POST", "https://other.example", 403, 0}, {"OPTIONS", dashboard, 204, 0}, {"OPTIONS", "null", 403, 0},
	} {
		calls := 0
		mux := http.NewServeMux()
		Register(mux, nil, func(context.Context, bool, func(*Board) error) error { calls++; return nil }, 0, []string{dashboard})
		req := httptest.NewRequest(tc.method, "/workbench/reset", nil)
		if tc.origin != "" {
			req.Header.Set("Origin", tc.origin)
		}
		w := httptest.NewRecorder()
		mux.ServeHTTP(w, req)
		if w.Code != tc.code || calls != tc.calls || w.Header().Get("Vary") != "Origin" {
			t.Fatal(tc, w.Code, calls)
		}
		if tc.origin == dashboard && w.Header().Get("Access-Control-Allow-Origin") != dashboard {
			t.Fatal(w.Header())
		}
	}
}

func TestCommandRejectsFieldsFromOtherVariants(t *testing.T) {
	for _, cmd := range []string{`{"type":"resolve","owner":""}`, `{"type":"information","question":"Demo","action":"checkIn"}`, `{"type":"plan","owner":null}`} {
		mux := http.NewServeMux()
		Register(mux, nil, func(context.Context, bool, func(*Board) error) error { t.Fatal("unexpected write"); return nil }, 0, nil)
		body := `{"timeZone":"UTC","revision":0,"command":` + cmd + `}`
		req := httptest.NewRequest("POST", "/workbench/accounts/cove/commands", strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		response := httptest.NewRecorder()
		mux.ServeHTTP(response, req)
		if response.Code != 400 {
			t.Fatal(cmd, response.Code)
		}
	}
}
