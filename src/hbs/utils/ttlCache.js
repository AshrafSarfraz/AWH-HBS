// src/hbs/utils/ttlCache.js
//
// Chhota in-memory TTL cache. Har entry apni expiry ke saath rehti hai aur
// background sweep purani entries hata deta hai — is liye purane code wali
// memory leak nahi hoti.
//
// NOTE: yeh per-process cache hai. Agar aap aage chal kar 2+ instances
// (PM2 cluster / multiple dynos) chalayen to isay Redis se replace karna.

class TTLCache {
  /**
   * @param {object} opts
   * @param {number} opts.ttl        default time-to-live (ms)
   * @param {number} opts.maxSize    itni entries ke baad sabse purani nikal di jayegi
   * @param {number} opts.sweepEvery kitni der baad cleanup chale (ms)
   */
  constructor({ ttl = 60_000, maxSize = 10_000, sweepEvery = 60_000 } = {}) {
    this.ttl = ttl;
    this.maxSize = maxSize;
    this.map = new Map();

    this.timer = setInterval(() => this.sweep(), sweepEvery);
    // Cleanup timer server ko zinda na rakhe
    if (this.timer.unref) this.timer.unref();
  }

  get(key) {
    const hit = this.map.get(key);
    if (!hit) return undefined;
    if (Date.now() > hit.exp) {
      this.map.delete(key);
      return undefined;
    }
    // LRU-ish: access hone par end par shift kar do
    this.map.delete(key);
    this.map.set(key, hit);
    return hit.val;
  }

  has(key) {
    return this.get(key) !== undefined;
  }

  set(key, val, ttl = this.ttl) {
    if (this.map.size >= this.maxSize) {
      // sabse purani entry nikal do
      const oldest = this.map.keys().next().value;
      if (oldest !== undefined) this.map.delete(oldest);
    }
    this.map.set(key, { val, exp: Date.now() + ttl });
    return val;
  }

  delete(key) {
    return this.map.delete(key);
  }

  /** prefix se shuru hone wali sab keys hata do (e.g. ek user ke sab entries) */
  deletePrefix(prefix) {
    for (const key of this.map.keys()) {
      if (key.startsWith(prefix)) this.map.delete(key);
    }
  }

  clear() {
    this.map.clear();
  }

  sweep() {
    const now = Date.now();
    for (const [key, hit] of this.map.entries()) {
      if (now > hit.exp) this.map.delete(key);
    }
  }

  get size() {
    return this.map.size;
  }
}

module.exports = { TTLCache };
