package app

import (
	"context"
	"net/http"
	"renewal-api/docs"
	healthcheck "renewal-api/internal/modules/health-check"
)

func Routes(env string, check func(context.Context) error) http.Handler {
	mux := http.NewServeMux()
	mux.Handle("GET /{$}", healthcheck.New(env, check))
	mux.HandleFunc("GET /docs", docs.Reference)
	mux.HandleFunc("GET /openapi.json", docs.Spec)
	return mux
}
