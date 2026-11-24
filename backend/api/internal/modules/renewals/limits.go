package renewals

import (
	"net"
	"net/http"
	"strconv"
	"sync"
	"time"
)

const resetCooldown = time.Minute

type retryAfter time.Duration

func (retryAfter) Error() string { return "rateLimited" }

func (delay retryAfter) respond(w http.ResponseWriter) {
	seconds := (time.Duration(delay) + time.Second - 1) / time.Second
	w.Header().Set("Retry-After", strconv.FormatInt(int64(seconds), 10))
	w.Header().Set("Access-Control-Expose-Headers", "Retry-After")
	respondError(w, failure{http.StatusTooManyRequests, delay.Error()})
}

// The instance ceiling also bounds the number of peer counters per window.
type writeLimit struct {
	perPeer, perInstance int
	mu                   sync.Mutex
	until                time.Time
	total                int
	peers                map[string]int
}

func (l *writeLimit) check(remote string, now time.Time) retryAfter {
	peer, _, err := net.SplitHostPort(remote)
	if err != nil {
		peer = remote
	}
	l.mu.Lock()
	defer l.mu.Unlock()
	if !now.Before(l.until) {
		l.until = now.Truncate(time.Minute).Add(time.Minute)
		l.peers = make(map[string]int)
		l.total = 0
	}
	if l.total >= l.perInstance || l.peers[peer] >= l.perPeer {
		return retryAfter(l.until.Sub(now))
	}
	l.total++
	l.peers[peer]++
	return 0
}
