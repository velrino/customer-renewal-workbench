package main

import (
	"context"
	"errors"
	"log"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"
	_ "time/tzdata"

	"renewal-api/internal/app"
	"renewal-api/internal/modules/renewals"
	"renewal-api/internal/shared/firestore"
	"renewal-api/internal/shared/observability"
)

func setting(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func main() {
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stderr, &slog.HandlerOptions{ReplaceAttr: func(groups []string, a slog.Attr) slog.Attr {
		if len(groups) == 0 && a.Key == slog.LevelKey {
			return slog.String("severity", a.Value.String())
		}
		return a
	}})))
	hops, err := strconv.Atoi(setting("TRUSTED_PROXY_HOPS", "0"))
	if err != nil || hops < 0 {
		log.Fatal("invalid TRUSTED_PROXY_HOPS")
	}
	origins := strings.Split(setting("WORKBENCH_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000,http://localhost:8080,http://127.0.0.1:8080"), ",")
	for i := range origins {
		origins[i] = strings.TrimSpace(origins[i])
	}
	probe := &firestore.Probe{Project: os.Getenv("GOOGLE_CLOUD_PROJECT"), Database: setting("FIRESTORE_DATABASE", "(default)")}
	environment := setting("APP_ENV", "local")
	reporter := observability.New(os.Getenv("SENTRY_DSN"), environment, setting("SENTRY_RELEASE", os.Getenv("K_REVISION")))
	store := &renewals.Store{Project: probe.Project, Database: probe.Database}
	if store.Project == "" {
		slog.Warn("Set GOOGLE_CLOUD_PROJECT to enable Shared API")
	}
	check := probe.Check
	if os.Getenv("FIRESTORE_EMULATOR_HOST") != "" {
		check = store.CheckDocument
	}
	routes := app.Routes(environment, reporter.FirestoreCheck(check), hops)
	renewals.Register(routes, store.Read, store.Update, hops, origins)
	server := http.Server{
		Addr:              ":" + setting("PORT", "8080"),
		Handler:           reporter.HTTP(routes),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       5 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       time.Minute,
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	done := make(chan error, 1)
	go func() { done <- server.ListenAndServe() }()
	select {
	case err := <-done:
		if !errors.Is(err, http.ErrServerClosed) {
			log.Fatal(err)
		}
	case <-ctx.Done():
		drain, cancel := context.WithTimeout(context.Background(), 9*time.Second)
		defer cancel()
		if err := server.Shutdown(drain); err != nil {
			log.Fatal(err)
		}
		if err := <-done; !errors.Is(err, http.ErrServerClosed) {
			log.Fatal(err)
		}
	}
}
