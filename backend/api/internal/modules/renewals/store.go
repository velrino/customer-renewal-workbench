package renewals

import (
	"context"
	"errors"
	"math"
	"sync"
	"time"

	"cloud.google.com/go/firestore"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type Store struct {
	Project, Database string
	mu                sync.Mutex
	client            *firestore.Client
}

func (s *Store) document(ctx context.Context) (*firestore.DocumentRef, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.client == nil {
		if s.Project == "" || s.Database == "" {
			return nil, errors.New("Firestore is not configured")
		}
		client, err := firestore.NewClientWithDatabase(context.Background(), s.Project, s.Database)
		if err != nil {
			return nil, err
		}
		s.client = client
	}
	return s.client.Doc("workbenches/shared"), nil
}

// CheckDocument probes the emulator, which does not expose the Admin metadata API.
func (s *Store) CheckDocument(ctx context.Context) error {
	ref, err := s.document(ctx)
	if err != nil {
		return err
	}
	_, err = ref.Get(ctx)
	if status.Code(err) == codes.NotFound {
		return nil
	}
	return err
}

func decodeBoard(snap *firestore.DocumentSnapshot, err error) (Board, error) {
	board := Board{Changes: map[string]Account{}}
	if status.Code(err) == codes.NotFound {
		return board, nil
	}
	if err != nil {
		return Board{}, err
	}
	if err := snap.DataTo(&board); err != nil {
		return Board{}, err
	}
	if board.Changes == nil {
		return Board{}, errors.New("invalid workbench document")
	}
	return board, nil
}

func (s *Store) Read(ctx context.Context) (Board, error) {
	ref, err := s.document(ctx)
	if err != nil {
		return Board{}, err
	}
	return decodeBoard(ref.Get(ctx))
}

func (s *Store) Update(ctx context.Context, reset bool, update func(*Board) error) error {
	ref, err := s.document(ctx)
	if err != nil {
		return err
	}
	return s.client.RunTransaction(ctx, func(ctx context.Context, tx *firestore.Transaction) error {
		snap, err := tx.Get(ref)
		var board Board
		if reset && err == nil {
			// Reset only needs the revision watermark and cooldown. It can repair malformed account data.
			var header struct {
				Version     *int64    `firestore:"version"`
				LastResetAt time.Time `firestore:"lastResetAt"`
			}
			if err := snap.DataTo(&header); err != nil {
				return err
			}
			if header.Version == nil || *header.Version < 0 || *header.Version == math.MaxInt64 {
				return errors.New("invalid workbench revision")
			}
			board = Board{Version: *header.Version, LastResetAt: header.LastResetAt}
		} else {
			board, err = decodeBoard(snap, err)
		}
		if err != nil {
			return err
		}
		if err := update(&board); err != nil {
			return err
		}
		if reset {
			return tx.Set(ref, map[string]any{"changes": board.Changes, "version": board.Version, "lastResetAt": board.LastResetAt}, firestore.Merge(firestore.FieldPath{"changes"}, firestore.FieldPath{"version"}, firestore.FieldPath{"lastResetAt"}))
		}
		// Commands advance one account. Merge its known fields so newer writers can retain extra metadata.
		for id, account := range board.Changes {
			if account.Revision != board.Version {
				continue
			}
			fields := map[string]any{"id": id, "revision": account.Revision}
			if account.IssueResolved {
				fields["issueResolved"] = true
			}
			if account.Information != "" {
				fields["information"] = account.Information
			}
			if plan := account.Plan; plan != nil {
				fields["plan"] = map[string]any{"status": plan.Status, "action": plan.Action, "owner": plan.Owner, "followUp": plan.FollowUp, "evidence": plan.Evidence, "savedAt": plan.SavedAt}
			}
			return tx.Set(ref, map[string]any{"version": board.Version, "changes": map[string]any{id: fields}}, firestore.MergeAll)
		}
		return errors.New("command did not advance an account revision")
	})
}
