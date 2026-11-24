package renewals

import (
	"net/http"
	"strings"
	"time"
	"unicode/utf8"
)

// The fixed portfolio matches the six sample accounts in the dashboard.
var renewalDays = map[string]int{"ember": 7, "beacon": 14, "cove": 21, "drift": 30, "atlas": 45, "field": 60}

type Plan struct {
	Status   string `firestore:"status"`
	Action   string `firestore:"action"`
	Owner    string `firestore:"owner"`
	FollowUp string `firestore:"followUp"`
	Evidence string `firestore:"evidence"`
	SavedAt  string `firestore:"savedAt"`
}
type Account struct {
	ID            string `firestore:"id"`
	Revision      int64  `firestore:"revision"`
	IssueResolved bool   `firestore:"issueResolved,omitempty"`
	Plan          *Plan  `firestore:"plan,omitempty"`
	Information   string `firestore:"information,omitempty"`
}
type Board struct {
	Version int64              `firestore:"version"`
	Changes map[string]Account `firestore:"changes"`
}
type Command struct {
	Type     string `json:"type"`
	Action   string `json:"action"`
	Owner    string `json:"owner"`
	FollowUp string `json:"followUp"`
	Question string `json:"question"`
}

type failure struct {
	code   int
	reason string
}

func (f failure) Error() string { return f.reason }

var changed = failure{http.StatusConflict, "changed"}

func (b *Board) apply(id string, revision int64, cmd Command, now time.Time) error {
	days, known := renewalDays[id]
	if !known {
		return failure{404, "unknownAccount"}
	}
	work := b.Changes[id]
	if revision != work.Revision {
		return changed
	}
	switch cmd.Type {
	case "plan":
		owner := strings.TrimSpace(cmd.Owner)
		if owner == "" || utf8.RuneCountInString(owner) > 80 {
			return failure{422, "ownerRequired"}
		}
		switch cmd.Action {
		case "resolveIssue", "budget", "reconnect", "adoption", "checkIn":
		default:
			return failure{422, "invalidAction"}
		}
		date, err := time.Parse(time.DateOnly, cmd.FollowUp)
		if err != nil || date.Format(time.DateOnly) != cmd.FollowUp || cmd.FollowUp < now.Format(time.DateOnly) || cmd.FollowUp > now.AddDate(0, 0, days).Format(time.DateOnly) {
			return failure{422, "invalidDate"}
		}
		if work.Plan == nil || work.Plan.Status != "active" {
			used := 0
			for _, a := range b.Changes {
				if a.Plan != nil && a.Plan.Status == "active" {
					used++
				}
			}
			if used >= 2 {
				return failure{409, "full"}
			}
		}
		evidence := id
		if id == "cove" && work.IssueResolved {
			evidence = "coveResolved"
		}
		work.Plan = &Plan{Status: "active", Action: cmd.Action, Owner: owner, FollowUp: cmd.FollowUp, Evidence: evidence, SavedAt: now.UTC().Format(time.RFC3339Nano)}
	case "information":
		question := strings.TrimSpace(cmd.Question)
		if question == "" || utf8.RuneCountInString(question) > 400 {
			return failure{422, "questionRequired"}
		}
		work.Information = question
	case "resolve":
		if id != "cove" || work.IssueResolved {
			return changed
		}
		work.IssueResolved = true
	case "complete":
		if work.Plan == nil || work.Plan.Status != "active" {
			return changed
		}
		work.Plan.Status = "completed"
	default:
		return failure{422, "invalidCommand"}
	}
	b.Version++
	work.ID = id
	work.Revision = b.Version
	b.Changes[id] = work
	return nil
}

func (b *Board) reset() error {
	b.Version++
	// Revisions survive reset so an old form cannot resurrect a cleared plan.
	b.Changes = make(map[string]Account, len(renewalDays))
	for id := range renewalDays {
		b.Changes[id] = Account{ID: id, Revision: b.Version}
	}
	return nil
}
