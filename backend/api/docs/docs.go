package docs

import (
	_ "embed"
	"encoding/json"
	"net/http"
	"strings"
	"sync"
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

// ReviewerSpec adds local authentication to the embedded public contract.
func ReviewerSpec(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write(localSpec())
}

var localSpec = sync.OnceValue(func() []byte {
	type object = map[string]any
	var contract object
	if err := json.Unmarshal(spec, &contract); err != nil {
		panic(err)
	}
	paths := contract["paths"].(object)
	secured := []object{{"reviewerSession": []string{}}}
	for path, item := range paths {
		if !strings.HasPrefix(path, "/workbench/") {
			continue
		}
		for _, v := range item.(object) {
			op, ok := v.(object)
			if !ok {
				continue
			} // A path may also define shared parameters.
			responses, ok := op["responses"].(object)
			if !ok {
				continue
			}
			op["security"] = secured
			responses["401"] = object{"description": "Sign in with the local reviewer account."}
		}
	}
	contract["components"].(object)["securitySchemes"] = object{"reviewerSession": object{"type": "http", "scheme": "bearer", "description": "Use the token from POST /reviewer/login. Sessions expire after one hour."}}
	var sessionPaths object
	if err := json.Unmarshal(reviewerPaths, &sessionPaths); err != nil {
		panic(err)
	}
	for path, op := range sessionPaths {
		paths[path] = op
	}
	result, err := json.Marshal(contract)
	if err != nil {
		panic(err)
	}
	return result
})

//go:embed reviewer-paths.json
var reviewerPaths []byte
