package healthcheck

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"sync"
	"time"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	probe "renewal-api/internal/shared/firestore"
	"renewal-api/internal/shared/utils"
)

type Handler struct {
	check      func(context.Context) error
	appEnv     string
	startedAt  time.Time
	now        func() time.Time
	cacheMu    sync.Mutex
	cached     *checkSnapshot
	refreshing chan struct{}
}

func New(appEnv string, check func(context.Context) error) *Handler {
	return &Handler{check: check, appEnv: appEnv, startedAt: time.Now().UTC(), now: time.Now}
}

type AuthorResponse struct {
	Name      string `json:"name"`
	GitHub    string `json:"github"`
	LinkedIn  string `json:"linkedin"`
	Instagram string `json:"instagram"`
	Website   string `json:"website"`
}

type ServiceCheckResponse struct {
	Status       string `json:"status"`
	ResponseTime int64  `json:"response_time"`
	Message      string `json:"message,omitempty"`
}

type HealthCheckResponse struct {
	Name       string                          `json:"name"`
	Status     string                          `json:"status"`
	AppEnv     string                          `json:"app_env"`
	Author     AuthorResponse                  `json:"author"`
	Runtime    HealthCheckRuntimeResponse      `json:"runtime"`
	Checks     map[string]ServiceCheckResponse `json:"checks,omitempty"`
	Cache      CacheResponse                   `json:"cache"`
	ResultTime ResultTimeResponse              `json:"result_time"`
}

type CacheResponse struct {
	Hit              bool   `json:"hit"`
	CreatedAt        string `json:"created_at"`
	ExpiresAt        string `json:"expires_at"`
	SecondsRemaining int64  `json:"seconds_remaining"`
}

type ResultTimeResponse struct {
	Total   int64 `json:"total"`
	Average int64 `json:"average"`
}

type HealthCheckRuntimeResponse struct {
	LastDeploy string                    `json:"last_deploy"`
	Uptime     utils.TimeBetweenDatesDTO `json:"uptime"`
}

func (handler *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	started := time.Now()
	w.Header().Set("Cache-Control", "no-store")
	snapshot, hit, err := handler.snapshot(r.Context())
	if err != nil {
		http.Error(w, "Health check request canceled.", http.StatusRequestTimeout)
		return
	}
	now := handler.now()
	seconds := max(0, int64((snapshot.expiresAt.Sub(now)+time.Second-1)/time.Second))
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(snapshot.code)
	_ = json.NewEncoder(w).Encode(HealthCheckResponse{
		Name:       "Customer Renewal Workbench API",
		Status:     snapshot.status,
		AppEnv:     handler.appEnv,
		Author:     AuthorResponse{Name: "velrino", GitHub: "https://github.com/velrino/", LinkedIn: "https://www.linkedin.com/in/velrino/", Instagram: "https://www.instagram.com/velrino", Website: "https://velrino.vercel.app/"},
		Runtime:    HealthCheckRuntimeResponse{LastDeploy: handler.startedAt.Format(time.RFC3339Nano), Uptime: utils.CalculateTimeBetweenDates(handler.startedAt, now.UTC())},
		Checks:     snapshot.checks,
		Cache:      CacheResponse{Hit: hit, CreatedAt: snapshot.createdAt.UTC().Format(time.RFC3339Nano), ExpiresAt: snapshot.expiresAt.UTC().Format(time.RFC3339Nano), SecondsRemaining: seconds},
		ResultTime: ResultTimeResponse{Total: time.Since(started).Milliseconds(), Average: snapshot.average},
	})
}

func (handler *Handler) runChecks() *checkSnapshot {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	start := time.Now()
	err := handler.check(ctx)
	elapsed := time.Since(start).Milliseconds()
	result := ServiceCheckResponse{Status: "up", ResponseTime: elapsed}
	overall, code, ttl := "ok", http.StatusOK, time.Minute
	if err != nil {
		slog.Warn("Firestore health check failed", "error", err)
		overall, code, ttl = "degraded", http.StatusServiceUnavailable, 5*time.Second
		result.Status = "down"
		switch {
		case errors.Is(err, context.DeadlineExceeded) || status.Code(err) == codes.DeadlineExceeded:
			result.Message = "TIMEOUT_EXCEEDED"
		case errors.Is(err, probe.ErrNotConfigured):
			result.Message = "CHECK_NOT_CONFIGURED"
		default:
			result.Message = "UNAVAILABLE"
		}
	}
	created := handler.now()
	return &checkSnapshot{checks: map[string]ServiceCheckResponse{"firestore": result}, status: overall, code: code, average: elapsed, createdAt: created, expiresAt: created.Add(ttl)}
}
