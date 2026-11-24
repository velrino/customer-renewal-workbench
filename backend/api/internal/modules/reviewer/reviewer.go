// Package reviewer implements the workstation-only email/password profile.
package reviewer

import (
	"bytes"
	"crypto/rand"
	"encoding/json"
	"errors"
	"io"
	"mime"
	"net/http"
	"slices"
	"strings"
	"sync"
	"time"

	"renewal-api/internal/shared/ratelimit"
)

const (
	Project       = "demo-renewal-reviewer"
	APIHost       = "127.0.0.1:8181"
	WebOrigin     = "http://127.0.0.1:3100"
	authHost      = "127.0.0.1:9199"
	firestoreHost = "127.0.0.1:8185"
	reviewerID    = "workbench-reviewer"
	lifetime      = time.Hour
)

// Enabled rejects incomplete configuration before the application can open a listener.
func Enabled(get func(string) string) (bool, error) {
	flag := get("WORKBENCH_LOCAL_AUTH")
	if flag == "" && get("GOOGLE_CLOUD_PROJECT") != Project {
		return false, nil
	}
	if flag != "1" || get("GOOGLE_CLOUD_PROJECT") != Project || get("FIREBASE_AUTH_EMULATOR_HOST") != authHost || get("FIRESTORE_EMULATOR_HOST") != firestoreHost || get("K_SERVICE") != "" {
		return false, errors.New("local reviewer requires its isolated demo project and both loopback emulators")
	}
	return true, nil
}

type Sessions struct {
	mu      sync.Mutex
	expires map[string]time.Time
	client  *http.Client
}

func New() *Sessions {
	return &Sessions{
		expires: make(map[string]time.Time),
		client: &http.Client{
			Timeout:       4 * time.Second,
			Transport:     &http.Transport{}, // Credentials only travel to the fixed emulator, bypassing system proxies.
			CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse },
		},
	}
}

func deny(w http.ResponseWriter, status int, reason string) {
	w.Header().Set("Content-Type", "application/json")
	if status == 401 {
		w.Header().Set("WWW-Authenticate", "Bearer")
	}
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]string{"reason": reason})
}

type credentials struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (s *Sessions) login(w http.ResponseWriter, r *http.Request) {
	media, _, _ := mime.ParseMediaType(r.Header.Get("Content-Type"))
	if media != "application/json" {
		deny(w, 415, "invalidRequest")
		return
	}
	var input credentials
	d := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8192))
	d.DisallowUnknownFields()
	if d.Decode(&input) != nil || d.Decode(new(any)) != io.EOF || input.Email == "" || input.Password == "" {
		deny(w, 400, "invalidRequest")
		return
	}
	body, _ := json.Marshal(input)
	req, err := http.NewRequestWithContext(r.Context(), "POST", "http://"+authHost+"/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=local-reviewer", bytes.NewReader(body))
	if err != nil {
		deny(w, 503, "authUnavailable")
		return
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := s.client.Do(req)
	if err != nil {
		deny(w, 503, "authUnavailable")
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode == 400 {
		deny(w, 401, "invalidCredentials")
		return
	}
	var identity struct {
		LocalID string `json:"localId"`
	}
	if resp.StatusCode != 200 || json.NewDecoder(io.LimitReader(resp.Body, 65536)).Decode(&identity) != nil {
		deny(w, 503, "authUnavailable")
		return
	}
	if identity.LocalID != reviewerID {
		deny(w, 401, "invalidCredentials")
		return
	}

	now := time.Now()
	token := rand.Text()
	s.mu.Lock()
	for k, until := range s.expires {
		if !until.After(now) {
			delete(s.expires, k)
		}
	}
	if len(s.expires) >= 128 {
		s.mu.Unlock()
		deny(w, 429, "sessionLimit")
		return
	}
	s.expires[token] = now.Add(lifetime)
	s.mu.Unlock()
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"token": token, "expiresIn": int(lifetime.Seconds())})
}

func (s *Sessions) require(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token, found := strings.CutPrefix(r.Header.Get("Authorization"), "Bearer ")
		s.mu.Lock()
		until := s.expires[token]
		s.mu.Unlock()
		if !found || !until.After(time.Now()) {
			deny(w, 401, "signInRequired")
			return
		}
		next.ServeHTTP(w, r)
	})
}

// Routes wraps every renewal endpoint, independently of its HTTP method.
func (s *Sessions) Routes(public, renewals http.Handler) http.Handler {
	mux := http.NewServeMux()
	mux.Handle("/", public)
	mux.Handle("/workbench/", s.require(renewals))
	quota := ratelimit.PerMinute{PerPeer: 10, PerInstance: 20}
	mux.Handle("POST /reviewer/login", quota.Wrap(http.HandlerFunc(s.login)))
	mux.Handle("POST /reviewer/logout", s.require(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		s.mu.Lock()
		delete(s.expires, strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer "))
		s.mu.Unlock()
		w.WriteHeader(http.StatusNoContent)
	})))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Add("Vary", "Origin")
		if r.Host != APIHost {
			deny(w, 403, "invalidOrigin")
			return
		}
		if origins := r.Header.Values("Origin"); len(origins) > 0 {
			if len(origins) != 1 || !slices.Contains([]string{WebOrigin, "http://" + APIHost}, origins[0]) {
				deny(w, 403, "invalidOrigin")
				return
			}
			w.Header().Set("Access-Control-Allow-Origin", origins[0])
		}
		if r.Method == http.MethodOptions {
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST")
			w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
			w.Header().Set("Access-Control-Max-Age", "600")
			w.WriteHeader(http.StatusNoContent)
			return
		}
		mux.ServeHTTP(w, r)
	})
}
