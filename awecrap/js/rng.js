/* AWECRAP — rng.js
 * Seedable PRNG (mulberry32) per §13.1: "Do not use bare Math.random() for dice."
 * A duel created with the same seed replays identically — handy for debugging/balance.
 */
window.SO = window.SO || {};

SO.makeRNG = function (seed) {
  let a = (seed >>> 0) || 1;

  function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function die() {
    return 1 + Math.floor(next() * 6);
  }

  return {
    // raw float in [0,1)
    next,
    // integer in [min, max] inclusive
    int(min, max) {
      return min + Math.floor(next() * (max - min + 1));
    },
    // single d6
    die,
    // two d6
    roll() {
      const d1 = die();
      const d2 = die();
      return { d1, d2, total: d1 + d2 };
    },
    // pick a random element
    pick(arr) {
      return arr[Math.floor(next() * arr.length)];
    },
    // internal state, for save/restore (the closure's counter). Preserve the
    // exact value — the counter legitimately visits 0, so no `|| 1` guard here
    // (that guard is only for a fresh 0 *seed* in makeRNG above).
    getState() { return a >>> 0; },
    setState(s) { a = s >>> 0; },
  };
};

// A non-deterministic seed for normal play (still routed through the seedable RNG).
SO.randomSeed = function () {
  return (Math.floor(Math.random() * 0xffffffff) ^ Date.now()) >>> 0;
};
