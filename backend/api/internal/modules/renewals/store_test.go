package renewals

import (
	"cloud.google.com/go/firestore"
	"context"
	"errors"
	"fmt"
	"os"
	"testing"
	"time"
)

func TestFirestoreTransactions(t *testing.T) {
	if os.Getenv("FIRESTORE_EMULATOR_HOST") == "" {
		t.Skip("requires the Firestore emulator")
	}
	ctx, cancel := context.WithTimeout(t.Context(), 45*time.Second)
	defer cancel()
	store := Store{Project: fmt.Sprintf("demo-rw-%d", time.Now().UnixNano()), Database: "(default)"}
	ref, err := store.document(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer store.client.Close()
	board, err := store.Read(ctx)
	if err != nil || len(board.Changes) != 0 {
		t.Fatal(board, err)
	}
	now := time.Now().UTC()
	plan := Command{Type: "plan", Action: "checkIn", Owner: "Fictional reviewer", FollowUp: now.Format(time.DateOnly)}
	save := func(id string, cmd Command, rev int64) error {
		return store.Update(ctx, false, func(b *Board) error { return b.apply(id, rev, cmd, now) })
	}
	if err := save("ember", plan, 0); err != nil {
		t.Fatal(err)
	}
	start := make(chan struct{})
	results := make(chan error, 2)
	for _, id := range []string{"beacon", "cove"} {
		go func() { <-start; results <- save(id, plan, 0) }()
	}
	close(start)
	var accepted, full int
	for range 2 {
		err := <-results
		switch {
		case err == nil:
			accepted++
		case errors.Is(err, failure{409, "full"}):
			full++
		default:
			t.Fatal(err)
		}
	}
	board, err = store.Read(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if accepted != 1 || full != 1 || len(board.Changes) != 2 || board.Version != 2 {
		t.Fatal(accepted, full, board)
	}
	for _, a := range board.Changes {
		if a.Plan == nil || a.Plan.Status != "active" || a.Plan.Owner != plan.Owner {
			t.Fatal(a)
		}
	}
	if err := save("drift", Command{Type: "information", Question: "Fictional question?"}, 0); err != nil {
		t.Fatal(err)
	}
	board, err = store.Read(ctx)
	if err != nil || board.Changes["drift"].Information != "Fictional question?" {
		t.Fatal(board, err)
	}
	if _, err := ref.Update(ctx, []firestore.Update{{Path: "changes.ember.plan.futureField", Value: "preserve"}}); err != nil {
		t.Fatal(err)
	}
	if err := save("ember", plan, board.Changes["ember"].Revision); err != nil {
		t.Fatal(err)
	}
	snap, err := ref.Get(ctx)
	if err != nil {
		t.Fatal(err)
	}
	value, err := snap.DataAt("changes.ember.plan.futureField")
	if err != nil || value != "preserve" {
		t.Fatal(value, err)
	}
	board, err = store.Read(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := ref.Set(ctx, map[string]any{"version": board.Version, "changes": "malformed", "futureField": "keep"}); err != nil {
		t.Fatal(err)
	}
	if err := store.Update(ctx, true, func(b *Board) error { return b.reset(now) }); err != nil {
		t.Fatal(err)
	}
	restored, err := store.Read(ctx)
	if err != nil || restored.LastResetAt.IsZero() || restored.Version != board.Version+1 || len(restored.Changes) != len(portfolio) {
		t.Fatal(restored, err)
	}
	if err := save("ember", plan, board.Changes["ember"].Revision); !errors.Is(err, changed) {
		t.Fatal(err)
	}
	snap, err = ref.Get(ctx)
	if err != nil || snap.Data()["futureField"] != "keep" {
		t.Fatal(err)
	}
}
