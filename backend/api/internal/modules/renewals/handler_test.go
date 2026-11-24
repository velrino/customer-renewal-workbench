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
		{"/workbench/reset", "text/plain", `{"version":0}`, 415},
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
