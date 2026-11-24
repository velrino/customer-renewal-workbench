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
	w.Header().Set("Content-Security-Policy", "default-src 'self'; script-src 'self' https://cdn.jsdelivr.net/npm/@scalar/api-reference@1.83.0/dist/browser/standalone.js 'sha256-lrCm45Q3RxDRDd8xJVm8wGWCl/gVz/jJsu23fd0eob0='; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; object-src 'none'")
	w.Header().Set("Referrer-Policy", "no-referrer")
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_, _ = w.Write(reference)
}
