package healthcheck

import (
	"context"
	"time"
)

// A published snapshot is immutable. Cache only dependency results; assemble runtime
// and request timing separately so a cache hit never freezes process uptime.
type checkSnapshot struct {
	checks    map[string]ServiceCheckResponse
	status    string
	code      int
	average   int64
	createdAt time.Time
	expiresAt time.Time
}

func (handler *Handler) snapshot(ctx context.Context) (*checkSnapshot, bool, error) {
	refreshed := false
	for {
		if err := ctx.Err(); err != nil {
			return nil, false, err
		}
		handler.cacheMu.Lock()
		if snapshot := handler.cached; snapshot != nil && handler.now().Before(snapshot.expiresAt) {
			handler.cacheMu.Unlock()
			return snapshot, !refreshed, nil
		}
		done := handler.refreshing
		if done == nil {
			done = make(chan struct{})
			handler.refreshing = done
			refreshed = true
			go handler.refresh(done)
		}
		handler.cacheMu.Unlock()
		select {
		case <-ctx.Done():
			return nil, false, ctx.Err()
		case <-done:
		}
	}
}

func (handler *Handler) refresh(done chan struct{}) {
	snapshot := handler.runChecks()
	handler.cacheMu.Lock()
	handler.cached = snapshot
	handler.refreshing = nil
	close(done)
	handler.cacheMu.Unlock()
}
