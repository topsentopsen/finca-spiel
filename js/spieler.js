/* Gastgeber Biel: Steuerung (Tasten oder Klick), Kollision, Blickrichtung, Laufanimation. */
(function (g) {
  'use strict';
  var Dorf = g.Dorf = g.Dorf || {};
  var K = 16, TEMPO = 64;

  // Position = Fussmitte in Pixeln.
  function erstelle(tile) {
    return { name: 'Biel', x: tile.x * K + 8, y: tile.y * K + 12, dir: 'unten', animT: 0, frame: 0, laeuft: false,
      pfad: [], pfadIndex: 0, ziel: null, aktion: null };
  }
  // Fussbox: x-5..x+4, y-4..y+2
  function kollidiert(karte, x, y) {
    var l = Math.floor((x - 5) / K), r = Math.floor((x + 4) / K), o = Math.floor((y - 4) / K), u = Math.floor((y + 2) / K);
    return karte.blockiert(l, o) || karte.blockiert(r, o) || karte.blockiert(l, u) || karte.blockiert(r, u);
  }
  function tile(s) { return { x: Math.floor(s.x / K), y: Math.floor(s.y / K) }; }

  // Klickziel setzen: Biel laeuft per A* zur Kachel. aktion wird bei Ankunft ausgefuehrt.
  function geheZu(s, karte, zx, zy, aktion) {
    var t = tile(s);
    var p = Dorf.Pfad.suche(karte, t.x, t.y, zx, zy);
    if (!p) return false;
    s.pfad = p; s.pfadIndex = 0; s.ziel = { x: zx, y: zy }; s.aktion = aktion || null;
    return true;
  }
  function stoppe(s) { s.pfad = []; s.pfadIndex = 0; s.ziel = null; s.aktion = null; }

  // Gibt die Aktion zurueck, wenn Biel gerade angekommen ist.
  function update(s, eingabe, karte, dt) {
    var dx = 0, dy = 0;
    if (eingabe.halt('links')) dx -= 1;
    if (eingabe.halt('rechts')) dx += 1;
    if (eingabe.halt('hoch')) dy -= 1;
    if (eingabe.halt('runter')) dy += 1;
    if ((dx || dy) && s.ziel) stoppe(s);       // Tasten haben Vorrang vor dem Klickziel
    if (dx && dy) { dx *= Math.SQRT1_2; dy *= Math.SQRT1_2; }
    var angekommen = null;
    if (dx || dy) {
      s.laeuft = true;
      if (Math.abs(dx) > Math.abs(dy)) s.dir = dx < 0 ? 'links' : 'rechts';
      else if (dy) s.dir = dy < 0 ? 'oben' : 'unten';
      var nx = s.x + dx * TEMPO * dt; if (!kollidiert(karte, nx, s.y)) s.x = nx;
      var ny = s.y + dy * TEMPO * dt; if (!kollidiert(karte, s.x, ny)) s.y = ny;
    } else if (s.ziel) {
      s.laeuft = true;
      var rest = TEMPO * dt;
      while (rest > 0 && s.pfadIndex < s.pfad.length) {
        var n = s.pfad[s.pfadIndex], zx = n.x * K + 8, zy = n.y * K + 12;
        var ex = zx - s.x, ey = zy - s.y, dist = Math.sqrt(ex * ex + ey * ey);
        if (dist > 0.01) { if (Math.abs(ex) > Math.abs(ey)) s.dir = ex < 0 ? 'links' : 'rechts'; else s.dir = ey < 0 ? 'oben' : 'unten'; }
        if (dist <= rest) { s.x = zx; s.y = zy; s.pfadIndex++; rest -= dist; }
        else { s.x += ex / dist * rest; s.y += ey / dist * rest; rest = 0; }
      }
      if (s.pfadIndex >= s.pfad.length) { angekommen = s.aktion || { art: 'nichts' }; stoppe(s); s.laeuft = false; }
    } else s.laeuft = false;
    if (s.laeuft) { s.animT += dt; s.frame = Math.floor(s.animT * 8) % 4; } else { s.animT = 0; s.frame = 0; }
    return angekommen;
  }

  Dorf.Spieler = { TEMPO: TEMPO, erstelle: erstelle, kollidiert: kollidiert, tile: tile, geheZu: geheZu, stoppe: stoppe, update: update };
})(globalThis);
