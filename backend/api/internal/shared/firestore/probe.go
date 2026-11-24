package firestore

import (
	"context"
	"errors"
	"fmt"
	"sync"

	admin "cloud.google.com/go/firestore/apiv1/admin"
	"cloud.google.com/go/firestore/apiv1/admin/adminpb"
)

var ErrNotConfigured = errors.New("Firestore project or database is not configured")

// Probe checks database metadata with the runtime identity. The database's
// document access mode does not affect this administrative read.
type Probe struct {
	Project, Database string
	mu                sync.Mutex
	client            *admin.FirestoreAdminClient
}

func (p *Probe) Check(ctx context.Context) error {
	if p.Project == "" || p.Database == "" {
		return ErrNotConfigured
	}
	client, err := p.databaseClient(func() (*admin.FirestoreAdminClient, error) {
		return admin.NewFirestoreAdminClient(ctx)
	})
	if err != nil {
		return err
	}
	name := fmt.Sprintf("projects/%s/databases/%s", p.Project, p.Database)
	_, err = client.GetDatabase(ctx, &adminpb.GetDatabaseRequest{Name: name})
	return err
}

func (p *Probe) databaseClient(open func() (*admin.FirestoreAdminClient, error)) (*admin.FirestoreAdminClient, error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.client != nil {
		return p.client, nil
	}
	client, err := open()
	if err != nil {
		return nil, err
	}
	p.client = client
	return client, nil
}
