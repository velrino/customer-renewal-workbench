package renewals

import (
	"context"
	"errors"
	"sync"

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
		client, err := firestore.NewClientWithDatabase(ctx, s.Project, s.Database)
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

func (s *Store) Update(ctx context.Context, update func(*Board) error) error {
	ref, err := s.document(ctx)
	if err != nil {
		return err
	}
	return s.client.RunTransaction(ctx, func(ctx context.Context, tx *firestore.Transaction) error {
		snap, err := tx.Get(ref)
		board, err := decodeBoard(snap, err)
		if err != nil {
			return err
		}
		if err := update(&board); err != nil {
			return err
		}
		return tx.Set(ref, board)
	})
}
