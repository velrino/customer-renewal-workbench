package renewals

import (
	"net/http"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"
)

type Plan struct {
	Status   string `firestore:"status" json:"status"`
	Action   string `firestore:"action" json:"action"`
	Owner    string `firestore:"owner" json:"owner"`
	FollowUp string `firestore:"followUp" json:"followUp"`
	Evidence string `firestore:"evidence" json:"evidence"`
	SavedAt  string `firestore:"savedAt" json:"savedAt"`
}
type Account struct {
	ID            string `firestore:"id" json:"id"`
	Revision      int64  `firestore:"revision" json:"revision"`
	IssueResolved bool   `firestore:"issueResolved,omitempty" json:"issueResolved,omitempty"`
	Plan          *Plan  `firestore:"plan,omitempty" json:"plan,omitempty"`
	Information   string `firestore:"information,omitempty" json:"information,omitempty"`
}
type Board struct {
	LastResetAt time.Time          `firestore:"lastResetAt,omitempty"`
	Version     int64              `firestore:"version"`
	Changes     map[string]Account `firestore:"changes"`
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

const weeklyCapacity = 2

func validateText(raw string, limit int, missing, tooLong string) error {
	checked := raw
	if missing == "questionRequired" {
		checked = strings.ReplaceAll(strings.ReplaceAll(checked, "\r\n", ""), "\n", "")
	}
	if strings.ContainsFunc(checked, func(r rune) bool {
		return unicode.IsControl(r) || (unicode.In(r, unicode.Cf) && r != '\u200d' && r != '\u200c')
	}) {
		return failure{422, "invalidText"}
	}
	value := strings.TrimSpace(raw)
	if value == "" {
		return failure{422, missing}
	}
	if utf8.RuneCountInString(value) > limit {
		return failure{422, tooLong}
	}
	return nil
}

func (b *Board) apply(id string, revision int64, cmd Command, now time.Time) error {
	days, known := daysUntilRenewal(id)
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
		if err := validateText(cmd.Owner, 80, "ownerRequired", "ownerTooLong"); err != nil {
			return err
		}
		switch cmd.Action {
		case "resolveIssue", "budget", "reconnect", "adoption", "checkIn":
		default:
			return failure{422, "invalidAction"}
		}
		year, month, day := now.Date()
		renewal := time.Date(year, month, day+days, 0, 0, 0, 0, time.UTC).Format(time.DateOnly)
		date, err := time.Parse(time.DateOnly, cmd.FollowUp)
		if err != nil || date.Format(time.DateOnly) != cmd.FollowUp || cmd.FollowUp < now.Format(time.DateOnly) || cmd.FollowUp > renewal {
			return failure{422, "invalidDate"}
		}
		if work.Plan == nil || work.Plan.Status != "active" {
			used := 0
			for _, a := range b.Changes {
				if a.Plan != nil && a.Plan.Status == "active" {
					used++
				}
			}
			if used >= weeklyCapacity {
				return failure{409, "full"}
			}
			evidence := id
			if id == "cove" && work.IssueResolved {
				evidence = "coveResolved"
			}
			work.Plan = &Plan{Status: "active", Evidence: evidence, SavedAt: now.UTC().Format(time.RFC3339Nano)}
		}
		work.Plan.Action = cmd.Action
		work.Plan.Owner = owner
		work.Plan.FollowUp = cmd.FollowUp
	case "information":
		question := strings.TrimSpace(cmd.Question)
		if err := validateText(cmd.Question, 400, "questionRequired", "questionTooLong"); err != nil {
			return err
		}
		work.Information = question
	case "resolve":
		if id != "cove" {
			return failure{422, "notApplicable"}
		}
		if work.IssueResolved {
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

const resetCooldown = time.Minute

type resetCooldownRemaining time.Duration

func (resetCooldownRemaining) Error() string { return "reset is on cooldown" }

func (b *Board) reset(now time.Time) error {
	if remaining := b.LastResetAt.Add(resetCooldown).Sub(now); remaining > 0 {
		return resetCooldownRemaining(remaining)
	}
	b.LastResetAt = now
	b.Version++
	// Revisions survive reset so an old form cannot resurrect a cleared plan.
	b.Changes = make(map[string]Account, len(portfolio))
	for _, account := range portfolio {
		b.Changes[account.id] = Account{ID: account.id, Revision: b.Version}
	}
	return nil
}
