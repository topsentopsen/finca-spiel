/* Gastgeber Biel: Steuerung, Kollision, Blickrichtung, Laufanimation. */
(function (g) {
  'use strict';
  var Dorf = g.Dorf = g.Dorf || {};
  var K = 16, TEMPO = 64;

  // Position = Fussmitte in Pixeln.
  function erstelle(tile) {
    return { name: 'Biel', x: tile.x * K + 8, y: tile.y * K + 12, dir: 'unten', animT: 0, frame: 0, laeuft: false };
  }
  // Fussbox: x-5..x+4, y-4..y+2
  function kollidiert(karte, x, y) {
    var l = Math.floor((x - 5) / K), r = Math.floor((x + 4) / K), o = Math.floor((y - 4) / K), u = Math.floor((y + 2) / K);
    return karte.blockiert(l, o) || karte.blockiert(r, o) || karte.blockiert(l, u) || karte.blockiert(r, u);
  }
  function update(s, eingabe, karte, dt) {
    var dx = 0, dy = 0;
    if (eingabe.halt('links')) dx -= 1;
    if (eingabe.halt('rechts')) dx += 1;
    if (eingabe.halt('hoch')) dy -= 1;
    if (eingabe.halt('runter')) dy += 1;
    if (dx && dy) { dx *= Math.SQRT1_2; dy *= Math.SQRT1_2; }
    s.laeuft = !!(dx || dy);
    if (s.laeuft) {
      if (Math.abs(dx) > Math.abs(dy)) s.dir = dx < 0 ? 'links' : 'rechts';
      else if (dy) s.dir = dy < 0 ? 'oben' : 'unten';
      var nx = s.x + dx * TEMPO * dt; if (!kollidiert(karte, nx, s.y)) s.x = nx;
      var ny = s.y + dy * TEMPO * dt; if (!kollidiert(karte, s.x, ny)) s.y = ny;
      s.animT += dt; s.frame = Math.floor(s.animT * 8) % 4;
    } else { s.animT = 0; s.frame = 0; }
  }

  Dorf.Spieler = { TEMPO: TEMPO, erstelle: erstelle, kollidiert: kollidiert, update: update };
})(globalThis);
