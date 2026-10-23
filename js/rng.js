/* Seed-Zufall (mulberry32). Alles Zufaellige im Spiel laeuft hierueber. */
(function (g) {
  'use strict';
  var Dorf = g.Dorf = g.Dorf || {};

  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function erstelle(seed) {
    var next = mulberry32(seed);
    return {
      seed: seed >>> 0,
      next: next,
      int: function (min, max) { return min + Math.floor(next() * (max - min + 1)); },
      pick: function (arr) { return arr[Math.floor(next() * arr.length)]; }
    };
  }

  Dorf.RNG = { mulberry32: mulberry32, erstelle: erstelle };
})(globalThis);
