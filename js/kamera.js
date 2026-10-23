/* Kamera: folgt einer Position weich (lerp) und bleibt in den Kartengrenzen. */
(function (g) {
  'use strict';
  var Dorf = g.Dorf = g.Dorf || {};

  function erstelle(viewW, viewH, weltW, weltH) {
    return { x: 0, y: 0, viewW: viewW, viewH: viewH, weltW: weltW, weltH: weltH, weich: 6 };
  }
  function clamp(v, min, max) { return v < min ? min : (v > max ? max : v); }
  function ziel(k, px, py) {
    var tx = px - k.viewW / 2, ty = py - k.viewH / 2;
    tx = k.weltW <= k.viewW ? (k.weltW - k.viewW) / 2 : clamp(tx, 0, k.weltW - k.viewW);
    ty = k.weltH <= k.viewH ? (k.weltH - k.viewH) / 2 : clamp(ty, 0, k.weltH - k.viewH);
    return { x: tx, y: ty };
  }
  function sofort(k, px, py) { var z = ziel(k, px, py); k.x = z.x; k.y = z.y; }
  function update(k, px, py, dt) {
    var z = ziel(k, px, py), a = 1 - Math.exp(-k.weich * dt);
    k.x += (z.x - k.x) * a; k.y += (z.y - k.y) * a;
    if (Math.abs(z.x - k.x) < 0.05) k.x = z.x;
    if (Math.abs(z.y - k.y) < 0.05) k.y = z.y;
  }

  Dorf.Kamera = { erstelle: erstelle, ziel: ziel, sofort: sofort, update: update };
})(globalThis);
