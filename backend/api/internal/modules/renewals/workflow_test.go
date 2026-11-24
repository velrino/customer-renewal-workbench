package renewals

import (
	"errors"
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
	if err := board.reset(); err != nil {
		t.Fatal(err)
	}
	for id := range renewalDays {
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
