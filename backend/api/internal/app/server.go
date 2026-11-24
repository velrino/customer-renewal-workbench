package app

import (
	"context"
	"net/http"
	"time"

	"renewal-api/docs"
	healthcheck "renewal-api/internal/modules/health-check"
)

func Routes(env string, check func(context.Context) (time.Duration, error)) *http.ServeMux {
	mux := http.NewServeMux()
	mux.Handle("GET /{$}", healthcheck.New(env, check))
	mux.HandleFunc("GET /docs", docs.Reference)
	mux.HandleFunc("GET /openapi.json", docs.Spec)
	return mux
}
