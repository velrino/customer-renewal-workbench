package reviewer

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestProfileIsolation(t *testing.T) {
	env := map[string]string{"GOOGLE_CLOUD_PROJECT": "hosted"}
	get := func(k string) string { return env[k] }
	if enabled, err := Enabled(get); err != nil || enabled {
		t.Fatal("default profile changed")
	}
	env["WORKBENCH_LOCAL_AUTH"] = "1"
	env["FIRESTORE_EMULATOR_HOST"] = firestoreHost
	env["FIREBASE_AUTH_EMULATOR_HOST"] = authHost
	if _, err := Enabled(get); err == nil {
		t.Fatal("accepted hosted project")
	}
	env["GOOGLE_CLOUD_PROJECT"] = Project
	if enabled, err := Enabled(get); err != nil || !enabled {
		t.Fatal("rejected isolated profile")
	}
	for _, key := range []string{"FIRESTORE_EMULATOR_HOST", "FIREBASE_AUTH_EMULATOR_HOST", "WORKBENCH_LOCAL_AUTH", "K_SERVICE"} {
		prev := env[key]
		env[key] = ""
		if key == "K_SERVICE" {
			env[key] = "hosted"
		}
		if _, err := Enabled(get); err == nil {
			t.Errorf("accepted unsafe %s", key)
		}
		env[key] = prev
	}
}

type transport func(*http.Request) (*http.Response, error)

func (f transport) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

func TestRenewalSession(t *testing.T) {
	sessions := New()
	identity := "different-reviewer"
	sessions.client.Transport = transport(func(r *http.Request) (*http.Response, error) {
		if r.URL.Host != authHost || r.URL.Scheme != "http" {
			t.Fatal("unexpected authentication destination")
		}
		return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(`{"localId":"` + identity + `"}`))}, nil
	})
	called := 0
	h := sessions.Routes(http.NotFoundHandler(), http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { called++; w.WriteHeader(204) }))
	send := func(method, path, token, body, origin string) *httptest.ResponseRecorder {
		r := httptest.NewRequest(method, "http://"+APIHost+path, strings.NewReader(body))
		if token != "" {
			r.Header.Set("Authorization", "Bearer "+token)
		}
		if origin != "" {
			r.Header.Set("Origin", origin)
		}
		r.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		return w
	}
	operations := []struct{ method, path string }{{"GET", "/workbench/accounts"}, {"POST", "/workbench/accounts/ember/commands"}, {"POST", "/workbench/reset"}}
	for _, op := range operations {
		if w := send(op.method, op.path, "", "", ""); w.Code != 401 {
			t.Fatalf("anonymous %s: %d", op.path, w.Code)
		}
	}
	body := `{"email":"reviewer@example.test","password":"test-only"}`
	if w := send("POST", "/reviewer/login", "", body, WebOrigin); w.Code != 401 {
		t.Fatal("accepted other identity")
	}
	identity = reviewerID
	if w := send("POST", "/reviewer/login", "", body, "https://example.invalid"); w.Code != 403 {
		t.Fatal("accepted other origin")
	}
	w := send("POST", "/reviewer/login", "", body, WebOrigin)
	var login struct{ Token string }
	if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &login) != nil || login.Token == "" {
		t.Fatal("missing session")
	}
	for _, op := range operations {
		if w := send(op.method, op.path, login.Token, "", WebOrigin); w.Code != 204 {
			t.Fatalf("signed-in %s: %d", op.path, w.Code)
		}
	}
	if w := send("POST", "/reviewer/logout", login.Token, "", WebOrigin); w.Code != 204 {
		t.Fatal("logout failed")
	}
	if w := send("GET", "/workbench/accounts", login.Token, "", WebOrigin); w.Code != 401 {
		t.Fatal("revoked session accepted")
	}
	sessions.expires["expired"] = time.Now().Add(-time.Second)
	if w := send("GET", "/workbench/accounts", "expired", "", WebOrigin); w.Code != 401 {
		t.Fatal("expired session accepted")
	}
	if called != len(operations) {
		t.Fatalf("unexpected number of private handler calls: %d", called)
	}
}
