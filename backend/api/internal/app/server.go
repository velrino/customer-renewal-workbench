package app

import (
	"context"
	"net/http"
	"time"

	"renewal-api/docs"
	healthcheck "renewal-api/internal/modules/health-check"
	"renewal-api/internal/shared/ratelimit"
)

func Routes(env string, check func(context.Context) (time.Duration, error), trustedHops int) *http.ServeMux {
	mux := http.NewServeMux()
	read := ratelimit.PerMinute{PerPeer: 120, PerInstance: 480, TrustedHops: trustedHops}
	mux.Handle("GET /{$}", read.Wrap(healthcheck.New(env, check)))
	mux.Handle("GET /docs", read.Wrap(http.HandlerFunc(docs.Reference)))
	mux.Handle("GET /openapi.json", read.Wrap(http.HandlerFunc(docs.Spec)))
	return mux
}
