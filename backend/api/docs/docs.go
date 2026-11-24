package docs

import (
	_ "embed"
	"net/http"
)

//go:embed openapi.json
var spec []byte

//go:embed scalar.html
var reference []byte

func Spec(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write(spec)
}

func Reference(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_, _ = w.Write(reference)
}
