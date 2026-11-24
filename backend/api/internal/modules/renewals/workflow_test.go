package renewals

import (
	"encoding/json"
	"errors"
	"os"
	"testing"
	"time"
)

func TestSharedPortfolio(t *testing.T) {
	board := Board{Changes: make(map[string]Account)}
	now := time.Date(2026, 11, 24, 23, 0, 0, 0, time.FixedZone("local", -3*60*60))
	plan := Command{Type: "plan", Action: "checkIn", Owner: " Demo ", FollowUp: "2026-11-24"}
	apply := func(id string, cmd Command, want error) {
		t.Helper()
		before := board.Version
		err := board.apply(id, board.Changes[id].Revision, cmd, now)
		if !errors.Is(err, want) {
			t.Fatalf("%s %s: got %v, want %v", id, cmd.Type, err, want)
		}
		if err != nil && before != board.Version {
			t.Fatal("rejected command changed board version")
		}
	}
	apply("drift", Command{Type: "information", Question: "Missing usage?"}, nil)
	apply("ember", plan, nil)
	apply("cove", plan, nil)
	apply("cove", Command{Type: "resolve"}, nil)
	if board.Changes["cove"].Plan.Evidence != "cove" {
		t.Fatal("resolution replaced original evidence")
	}
	apply("ember", plan, nil)
	apply("beacon", plan, failure{409, "full"})
	apply("ember", Command{Type: "complete"}, nil)
	apply("beacon", plan, nil)
	if err := board.reset(now); err != nil {
		t.Fatal(err)
	}
	for _, account := range portfolio {
		id := account.id
		a := board.Changes[id]
		if a != (Account{ID: id, Revision: board.Version}) {
			t.Fatalf("unexpected reset state for %s: %+v", id, a)
		}
	}
	if err := board.apply("field", 0, plan, now); !errors.Is(err, changed) {
		t.Fatalf("old draft after reset: %v", err)
	}
}

func TestPlanValidation(t *testing.T) {
	now := time.Date(2026, 11, 24, 23, 59, 0, 0, time.FixedZone("local", -3*60*60))
	for _, tc := range []struct{ owner, date, action, reason string }{
		{" ", "2026-11-24", "budget", "ownerRequired"},
		{"Demo", "2026-11-23", "budget", "invalidDate"},
		{"Demo", "2026-12-02", "budget", "invalidDate"},
		{"Demo", "2026-11-31", "budget", "invalidDate"},
		{"Demo", "2026-11-24", "invalid", "invalidAction"},
		{"Demo", "2026-12-01", "budget", ""},
	} {
		board := Board{Changes: make(map[string]Account)}
		err := board.apply("ember", 0, Command{Type: "plan", Owner: tc.owner, FollowUp: tc.date, Action: tc.action}, now)
		if tc.reason == "" && err != nil || tc.reason != "" && !errors.Is(err, failure{422, tc.reason}) {
			t.Errorf("%+v: %v", tc, err)
		}
	}
}

func TestPlanEditsPreserveOriginalEvidence(t *testing.T) {
	now := time.Date(2026, 11, 24, 12, 0, 0, 0, time.UTC)
	board := Board{Changes: make(map[string]Account)}
	plan := Command{Type: "plan", Owner: "First owner", Action: "resolveIssue", FollowUp: "2026-11-25"}
	apply := func(cmd Command) {
		t.Helper()
		if err := board.apply("cove", board.Version, cmd, now); err != nil {
			t.Fatal(err)
		}
	}
	apply(plan)
	saved := board.Changes["cove"].Plan.SavedAt
	apply(Command{Type: "resolve"})
	now = now.Add(time.Hour)
	plan.Owner = "New owner"
	apply(plan)
	edited := board.Changes["cove"].Plan
	if edited.Evidence != "cove" || edited.SavedAt != saved || edited.Owner != plan.Owner {
		t.Fatalf("edited plan: %+v", edited)
	}
	apply(Command{Type: "complete"})
	apply(plan)
	fresh := board.Changes["cove"].Plan
	if fresh.Evidence != "coveResolved" || fresh.SavedAt == saved {
		t.Fatalf("new plan: %+v", fresh)
	}
}

func TestResetCooldownExpiry(t *testing.T) {
	now := time.Date(2026, 11, 24, 12, 0, 0, 0, time.UTC)
	board := Board{}
	for _, at := range []time.Time{now, now.Add(time.Minute)} {
		if err := board.reset(at); err != nil {
			t.Fatal(err)
		}
		beforeExpiry := at.Add(time.Minute - time.Second)
		if err := board.reset(beforeExpiry); err != resetCooldownRemaining(time.Second) {
			t.Fatalf("reset cooldown: %v", err)
		}
	}
}

func TestCommandConformance(t *testing.T) {
	data, err := os.ReadFile("testdata/conformance.json")
	if err != nil {
		t.Fatal(err)
	}
	var cases []struct {
		Name, Account, Reason string
		Command               Command
		Occupied              []string
	}
	if err := json.Unmarshal(data, &cases); err != nil {
		t.Fatal(err)
	}
	zone, err := time.LoadLocation("America/Santiago")
	if err != nil {
		t.Fatal(err)
	}
	now := time.Date(2026, 8, 30, 0, 30, 0, 0, zone)
	for _, tc := range cases {
		t.Run(tc.Name, func(t *testing.T) {
			board := Board{Changes: map[string]Account{}}
			for _, id := range tc.Occupied {
				board.Changes[id] = Account{Plan: &Plan{Status: "active"}}
			}
			err := board.apply(tc.Account, 0, tc.Command, now)
			if tc.Reason == "" && err != nil || tc.Reason != "" && (err == nil || err.Error() != tc.Reason) {
				t.Fatalf("got %v, want %q", err, tc.Reason)
			}
		})
	}
}
