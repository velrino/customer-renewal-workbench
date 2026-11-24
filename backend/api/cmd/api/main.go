package main

import (
	"log"
	"net/http"
	"os"
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
	probe := &firestore.Probe{Project: os.Getenv("GOOGLE_CLOUD_PROJECT"), Database: setting("FIRESTORE_DATABASE", "(default)")}
	environment := setting("APP_ENV", "local")
	reporter := observability.New(os.Getenv("SENTRY_DSN"), environment, setting("SENTRY_RELEASE", os.Getenv("K_REVISION")))
	store := &renewals.Store{Project: probe.Project, Database: probe.Database}
	check := probe.Check
	if os.Getenv("FIRESTORE_EMULATOR_HOST") != "" {
		check = store.CheckDocument
	}
	routes := app.Routes(environment, reporter.FirestoreCheck(check))
	renewals.Register(routes, store.Update)
	server := http.Server{Addr: ":" + setting("PORT", "8080"), Handler: reporter.HTTP(routes), ReadHeaderTimeout: 5 * time.Second, WriteTimeout: 10 * time.Second, IdleTimeout: time.Minute}
	log.Fatal(server.ListenAndServe())
}
