package renewals

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/url"
	"strconv"
	"time"
)

// Keep the fixed demo portfolio in renewal order so account edits never move a
// renewal between pages.
var portfolio = [...]struct {
	id, name    string
	value, days int
}{
	{"ember", "Ember", 55000, 7},
	{"beacon", "Beacon", 18000, 14},
	{"cove", "Cove", 80000, 21},
	{"drift", "Drift", 40000, 30},
	{"atlas", "Atlas", 100000, 45},
	{"field", "Field", 25000, 60},
}

func daysUntilRenewal(id string) (int, bool) {
	for _, account := range portfolio {
		if account.id == id {
			return account.days, true
		}
	}
	return 0, false
}

type renewalItem struct {
	Account
	Name  string `json:"name"`
	Value int    `json:"value"`
	Days  int    `json:"days"`
}

type renewalPage struct {
	Items      []renewalItem `json:"items"`
	Page       int           `json:"page"`
	PageSize   int           `json:"pageSize"`
	Total      int           `json:"total"`
	TotalPages int           `json:"totalPages"`
}

func pageParameter(query url.Values, key string, fallback, maximum int) (int, bool) {
	values, present := query[key]
	if !present {
		return fallback, true
	}
	if len(values) != 1 {
		return 0, false
	}
	n, err := strconv.ParseUint(values[0], 10, 31)
	return int(n), err == nil && n >= 1 && n <= uint64(maximum)
}

func listHandler(read readBoard) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		query, err := url.ParseQuery(r.URL.RawQuery)
		page, validPage := pageParameter(query, "page", 1, (1<<31)-1)
		size, validSize := pageParameter(query, "pageSize", 3, 100)
		if err != nil || !validPage || !validSize {
			respondError(w, failure{400, "invalidRequest"})
			return
		}
		result := renewalPage{
			Items:      []renewalItem{},
			Page:       page,
			PageSize:   size,
			Total:      len(portfolio),
			TotalPages: (len(portfolio) + size - 1) / size,
		}
		if page <= result.TotalPages {
			ctx, cancel := context.WithTimeout(r.Context(), 7*time.Second)
			defer cancel()
			board, err := read(ctx)
			if err != nil {
				slog.Warn("Shared workbench read failed", "error", err)
				respondError(w, failure{503, "storage"})
				return
			}
			start := (page - 1) * size
			for _, account := range portfolio[start:min(start+size, len(portfolio))] {
				work := board.Changes[account.id]
				work.ID = account.id
				result.Items = append(result.Items, renewalItem{Account: work, Name: account.name, Value: account.value, Days: account.days})
			}
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(result)
	}
}
