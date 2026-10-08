import type { Clock } from "../clock.js";

export interface SlidingWindowOptions {
  readonly maxHits: number;
  readonly windowMs: number;
  /** The most keys tracked at once: the memory used has this bound. */
  readonly maxKeys: number;
}

interface Entry {
  /** Accepted hits still inside the window, oldest first. */
  readonly hits: number[];
  lastSeen: number;
}

/**
 * A sliding-window counter per key, in memory, for a single instance (several instances would
 * each count on their own: a shared store would be needed).
 *
 * Only accepted hits are recorded, so a refused flood does not extend a block. The map is kept in
 * order of last sighting (a key seen again moves to the end), which gives both cheap pruning of
 * expired keys from the front and the eviction order. A limited key is never evicted while it is
 * limited: a flood of other keys cannot clear its counter. When the cap is reached and every
 * tracked key is limited, a new key is allowed and not tracked (the limiter fails open for it, and
 * its size stays bounded): refusing it would let the attackers who fill the table lock out everybody.
 */
export class SlidingWindowLimiter {
  private readonly entries = new Map<string, Entry>();
  // While the table is full of limited keys, nothing can change before the oldest hit leaves the
  // window (a limited key records no hit), so the scan is skipped until then: a flood of new
  // addresses costs O(1) per request instead of O(maxKeys).
  private saturatedUntil = 0;

  constructor(
    private readonly options: SlidingWindowOptions,
    private readonly clock: Clock,
  ) {}

  get size(): number {
    return this.entries.size;
  }

  /** Records a request of `key`. True when it is allowed, false when the key is limited. */
  hit(key: string): boolean {
    const now = this.clock.now().getTime();
    this.pruneExpired(now);
    const existing = this.entries.get(key);
    if (existing === undefined && !this.makeRoom(now)) {
      return true;
    }
    const entry = existing ?? { hits: [], lastSeen: now };
    this.dropExpiredHits(entry, now);
    this.touch(key, entry, now);
    if (this.isLimited(entry)) {
      return false;
    }
    entry.hits.push(now);
    return true;
  }

  private isLimited(entry: Entry): boolean {
    return entry.hits.length >= this.options.maxHits;
  }

  private dropExpiredHits(entry: Entry, now: number): void {
    const windowStart = now - this.options.windowMs;
    while (entry.hits.length > 0 && (entry.hits[0] ?? Infinity) <= windowStart) {
      entry.hits.shift();
    }
  }

  // Delete then set: a Map iterates in insertion order, so the key goes to the end.
  private touch(key: string, entry: Entry, now: number): void {
    this.entries.delete(key);
    entry.lastSeen = now;
    this.entries.set(key, entry);
  }

  // Keys are in order of last sighting: the expired ones are all at the front.
  private pruneExpired(now: number): void {
    const windowStart = now - this.options.windowMs;
    for (const [key, entry] of this.entries) {
      if (entry.lastSeen > windowStart) {
        return;
      }
      this.entries.delete(key);
    }
  }

  // False when the table is full of limited keys.
  private makeRoom(now: number): boolean {
    if (this.entries.size < this.options.maxKeys) {
      return true;
    }
    if (now < this.saturatedUntil) {
      return false;
    }
    let oldestHit = Infinity;
    for (const [key, entry] of this.entries) {
      this.dropExpiredHits(entry, now);
      if (!this.isLimited(entry)) {
        this.entries.delete(key);
        return true;
      }
      oldestHit = Math.min(oldestHit, entry.hits[0] ?? Infinity);
    }
    this.saturatedUntil = oldestHit + this.options.windowMs;
    return false;
  }
}
