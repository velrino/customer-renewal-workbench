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
	p.mu.Lock()
	if p.client == nil {
		client, err := admin.NewFirestoreAdminClient(ctx)
		if err != nil {
			p.mu.Unlock()
			return err
		}
		p.client = client
	}
	client := p.client
	p.mu.Unlock()
	name := fmt.Sprintf("projects/%s/databases/%s", p.Project, p.Database)
	_, err := client.GetDatabase(ctx, &adminpb.GetDatabaseRequest{Name: name})
	return err
}
