package firestore

import (
	"testing"

	admin "cloud.google.com/go/firestore/apiv1/admin"
)

func TestDatabaseClientRetriesAfterPanic(t *testing.T) {
	var probe Probe
	func() {
		defer func() {
			if recover() == nil {
				t.Fatal("expected a constructor panic")
			}
		}()
		probe.databaseClient(func() (*admin.FirestoreAdminClient, error) {
			panic("initialization failed")
		})
	}()
	if !probe.mu.TryLock() {
		t.Fatal("constructor panic left the client locked")
	}
	probe.mu.Unlock()
	want := &admin.FirestoreAdminClient{}
	got, err := probe.databaseClient(func() (*admin.FirestoreAdminClient, error) {
		return want, nil
	})
	if err != nil || got != want {
		t.Fatalf("retry returned %p, %v", got, err)
	}
}
