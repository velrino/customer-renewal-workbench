package renewals

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"slices"
	"testing"
	"testing/synctest"
)

func TestListRenewals(t *testing.T) {
	mux := http.NewServeMux()
	reads := 0
	Register(mux, func(context.Context) (Board, error) {
		reads++
		return Board{Changes: map[string]Account{"cove": {Revision: 8, IssueResolved: true, Plan: &Plan{Owner: "CS"}}}}, nil
	}, nil, 0, nil)
	list := func(query string) renewalPage {
		t.Helper()
		w := httptest.NewRecorder()
		mux.ServeHTTP(w, httptest.NewRequest("GET", "/workbench/accounts"+query, nil))
		var p renewalPage
		if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &p) != nil || p.Total != 6 || p.Items == nil {
			t.Fatalf("%s: %d %s", query, w.Code, w.Body)
		}
		return p
	}
	first := list("")
	if first.Page != 1 || first.PageSize != 3 || first.TotalPages != 2 || len(first.Items) != 3 {
		t.Fatal(first)
	}
	untouched, edited := first.Items[0], first.Items[2]
	if untouched.ID != "ember" || untouched.Revision != 0 || untouched.Days != 7 || untouched.Value != 55000 {
		t.Fatalf("unexpected seed renewal: %+v", untouched)
	}
	if edited.ID != "cove" || edited.Plan == nil || edited.Plan.Owner != "CS" || edited.Revision != 8 || !edited.IssueResolved {
		t.Fatalf("missing shared changes: %+v", edited)
	}
	var ids []string
	for _, q := range []string{"?page=1&pageSize=4", "?page=2&pageSize=4"} {
		for _, item := range list(q).Items {
			ids = append(ids, item.ID)
		}
	}
	if !slices.Equal(ids, []string{"ember", "beacon", "cove", "drift", "atlas", "field"}) {
		t.Fatal(ids)
	}
	if p := list("?page=2147483647&pageSize=100"); len(p.Items) != 0 || p.TotalPages != 1 {
		t.Fatal(p)
	}
	for _, q := range []string{"page=0", "page=-1", "page=abc", "page=1&page=2", "pageSize=", "pageSize=101", "pageSize=2.5", "page=2147483648"} {
		w := httptest.NewRecorder()
		mux.ServeHTTP(w, httptest.NewRequest("GET", "/workbench/accounts?"+q, nil))
		if w.Code != 400 {
			t.Fatalf("%s: %d", q, w.Code)
		}
	}
	if reads != 3 {
		t.Fatalf("got %d reads", reads)
	}
}

func TestListQuotaPrecedesStorageAndIsIndependentOfReset(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		mux := http.NewServeMux()
		reads := 0
		Register(mux, func(context.Context) (Board, error) {
			reads++
			return Board{}, nil
		}, func(context.Context, bool, func(*Board) error) error { return nil }, 0, nil)
		for i := 0; i <= 60; i++ {
			w := httptest.NewRecorder()
			mux.ServeHTTP(w, httptest.NewRequest("GET", "/workbench/accounts", nil))
			if i < 60 && w.Code != 200 || i == 60 && (w.Code != 429 || w.Header().Get("Retry-After") != "1") {
				t.Fatalf("request %d: %d %v", i+1, w.Code, w.Header())
			}
		}
		w := httptest.NewRecorder()
		mux.ServeHTTP(w, httptest.NewRequest("POST", "/workbench/reset", nil))
		if reads != 60 || w.Code != 204 {
			t.Fatalf("%d reads; reset %d", reads, w.Code)
		}
	})
}

func TestListUnavailableBoard(t *testing.T) {
	mux := http.NewServeMux()
	Register(mux, func(context.Context) (Board, error) {
		return Board{}, errors.New("read unavailable")
	}, nil, 0, nil)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest("GET", "/workbench/accounts", nil))
	if w.Code != http.StatusServiceUnavailable || w.Body.String() != "{\"reason\":\"storage\"}\n" {
		t.Fatalf("unexpected storage error: %d %s", w.Code, w.Body)
	}
}
