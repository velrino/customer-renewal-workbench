// Package ratelimit applies per-instance HTTP quotas before a handler runs.
package ratelimit

import (
	"encoding/json"
	"net"
	"net/http"
	"net/netip"
	"strconv"
	"strings"
	"time"

	limiter "github.com/ninepeach/go-ratelimit"
	"github.com/ninepeach/go-ratelimit/memory"
)

// PerMinute sets both the refill rate and the initial burst capacity.
type PerMinute struct {
	PerPeer     int
	PerInstance int
	TrustedHops int
}

// Wrap creates independent buckets for this group of routes. Build it once at
// registration. Invalid policy settings are programming errors.
func (p PerMinute) Wrap(next http.Handler) http.Handler {
	peer, err := limiter.NewPolicy("peer", int64(p.PerPeer), time.Minute, int64(p.PerPeer))
	if err != nil {
		panic(err)
	}
	instance, err := limiter.NewPolicy("instance", int64(p.PerInstance), time.Minute, int64(p.PerInstance))
	if err != nil {
		panic(err)
	}
	// An initial burst plus a minute of refills bounds the number of peers
	// with unrefilled tokens. One more bucket tracks the whole instance.
	buckets, err := memory.New(2*p.PerInstance + 1)
	if err != nil {
		panic(err)
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		host := peerAddress(r, p.TrustedHops)
		result, err := buckets.Allow(r.Context(), peer.Rule(host), instance.Rule("all"))
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusServiceUnavailable)
			_ = json.NewEncoder(w).Encode(map[string]string{"reason": "rateLimitUnavailable"})
			return
		}
		if !result.Allowed {
			WriteRetryAfter(w, result.RetryAfter)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// WriteRetryAfter returns the same response for middleware and domain cooldowns.
func WriteRetryAfter(w http.ResponseWriter, delay time.Duration) {
	seconds := max(1, (delay+time.Second-1)/time.Second)
	w.Header().Set("Retry-After", strconv.FormatInt(int64(seconds), 10))
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusTooManyRequests)
	_ = json.NewEncoder(w).Encode(map[string]string{"reason": "rateLimited"})
}

func peerAddress(r *http.Request, trustedHops int) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		host = r.RemoteAddr
	}
	if trustedHops > 0 {
		hops := strings.Split(strings.Join(r.Header.Values("X-Forwarded-For"), ","), ",")
		if index := len(hops) - trustedHops; index >= 0 {
			if addr, err := netip.ParseAddr(strings.TrimSpace(hops[index])); err == nil && addr.Zone() == "" {
				host = addr.String()
			}
		}
	}
	if addr, err := netip.ParseAddr(host); err == nil {
		addr = addr.Unmap()
		if addr.Is6() {
			return netip.PrefixFrom(addr, 64).Masked().String()
		}
		return addr.String()
	}
	return host
}
