package main

import (
	"log"
	"net/http"
	"os"
	"time"

	"renewal-api/internal/app"
	"renewal-api/internal/shared/firestore"
)

func setting(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func main() {
	probe := &firestore.Probe{Project: os.Getenv("GOOGLE_CLOUD_PROJECT"), Database: setting("FIRESTORE_DATABASE", "default")}
	server := http.Server{Addr: ":" + setting("PORT", "8080"), Handler: app.Routes(setting("APP_ENV", "local"), probe.Check), ReadHeaderTimeout: 5 * time.Second, WriteTimeout: 10 * time.Second, IdleTimeout: time.Minute}
	log.Fatal(server.ListenAndServe())
}
