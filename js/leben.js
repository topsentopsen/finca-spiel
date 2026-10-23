/* Leben im Hintergrund (ab v0.10): ein paar Schmetterlinge an den Blumen und kleine Voegel, die im Gras
   picken und auffliegen, wenn Biel zu nah kommt. Eigener kleiner Zufall, damit der Spiel-Seed gleich bleibt.
   Nur am Tag; in der Daemmerung ziehen sich alle zurueck. Bei "weniger Bewegung" fliegt nur ein
   Schmetterling ganz langsam und die Voegel bleiben sitzen. */
(function (g) {
  'use strict';
  var Dorf = g.Dorf = g.Dorf || {};
  var FALTER = 3, VOEGEL = 3, MAX = FALTER + VOEGEL;
  var FARBEN = ['#ffb3c7', '#ffe9a0', '#b8e8ff', '#d8c2ff'];
  var SCHEU = 34;          // so nah darf Biel kommen, dann fliegt ein Vogel auf

  function zufall(seed) {
    var s = (seed >>> 0) || 1;
    return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }

  function erstelle(karte, seed) {
    var z = zufall((seed || 1) ^ 0x5a17), K = karte.kachel || 16, T = Dorf.Karte.T;
    // Blumenziele: Kuebel im Hof, das Beet und ein paar Blumen auf der Wiese
    var ziele = [];
    (karte.kuebel || []).forEach(function (p) { if (p.y > 10 && p.y < 26) ziele.push({ x: p.x * K + 8, y: p.y * K + 4 }); });
    (karte.garten || []).forEach(function (p) { if (!p.baum) ziele.push({ x: p.x * K + 8, y: p.y * K + 4 }); });
    (karte.blumen || []).forEach(function (b) { if (b.x > 10 * K && b.x < 30 * K && b.y > 18 * K && b.y < 28 * K) ziele.push({ x: b.x, y: b.y }); });
    // Plaetze fuer Voegel: freies Gras und Pflaster rund um den Hof
    var plaetze = [];
    for (var y = 11; y < 29; y++) for (var x = 3; x < 29; x++) {
      var t = karte.tile(x, y);
      if ((t === T.GRAS || t === T.PFLASTER) && !karte.blockiert(x, y)) plaetze.push({ x: x * K + 8, y: y * K + 10 });
    }
    var L = { ziele: ziele, plaetze: plaetze, falter: [], voegel: [], z: z, sichtbar: 1, zirp: 4 + z() * 6 };
    for (var i = 0; i < FALTER && ziele.length; i++) {
      var a = ziele[Math.floor(z() * ziele.length)];
      L.falter.push({ x: a.x, y: a.y, hoehe: 10, ziel: a, warte: z() * 2, phase: z() * 6.28, farbe: FARBEN[i % FARBEN.length] });
    }
    for (i = 0; i < VOEGEL && plaetze.length; i++) {
      var p = plaetze[Math.floor(z() * plaetze.length)];
      L.voegel.push({ x: p.x, y: p.y, hoehe: 0, zustand: 'sitzt', pick: z() * 2, hop: 0, blick: z() < 0.5 ? -1 : 1, zx: p.x, zy: p.y, t: 0 });
    }
    return L;
  }

  // Wie sehr gerade Tag ist (1) oder nicht (0): ab 19:30 ziehen sich alle zurueck
  function tageslicht(minute) {
    if (minute < 7 * 60) return 0;
    if (minute > 20 * 60) return 0;
    if (minute > 19.5 * 60) return (20 * 60 - minute) / 30;
    return 1;
  }

  function update(L, welt, dt) {
    if (!L) return [];
    var toene = [], z = L.z, ruhig = !!welt.ruhig, sp = welt.spieler;
    var ziel = welt.abend ? 0 : tageslicht(welt.minute || 0);
    L.sichtbar += Math.max(-dt, Math.min(dt, ziel - L.sichtbar));
    var tempo = ruhig ? 6 : 14;
    L.falter.forEach(function (f, i) {
      f.aus = ruhig && i > 0;
      f.phase += dt * (ruhig ? 3 : 9);
      if (f.warte > 0) { f.warte -= dt; f.hoehe += (3 - f.hoehe) * Math.min(1, dt * 2); return; }
      var dx = f.ziel.x - f.x, dy = f.ziel.y - f.y, d = Math.sqrt(dx * dx + dy * dy);
      if (d < 2) { f.warte = 1.5 + z() * 3; f.ziel = L.ziele[Math.floor(z() * L.ziele.length)]; return; }
      var v = Math.min(d, tempo * dt);
      f.x += dx / d * v; f.y += dy / d * v;
      f.hoehe += (12 - f.hoehe) * Math.min(1, dt * 1.5);
    });
    L.voegel.forEach(function (v) {
      v.t += dt;
      if (v.zustand === 'fliegt') {
        var dx = v.zx - v.x, dy = v.zy - v.y, d = Math.sqrt(dx * dx + dy * dy);
        if (d < 2) { v.zustand = 'sitzt'; v.hoehe = 0; v.pick = 1; return; }
        var s = Math.min(d, 70 * dt);
        v.x += dx / d * s; v.y += dy / d * s; v.blick = dx < 0 ? -1 : 1;
        v.hoehe = Math.min(22, d * 0.4 + 4);
        return;
      }
      // sitzt: picken, ab und zu ein kleiner Hopser
      v.pick -= dt;
      if (v.pick <= 0) { v.pick = 0.8 + z() * 2.4; v.pickt = 0.25; if (!ruhig && z() < 0.35) { v.hop = 0.25; v.x += v.blick * 3; } if (z() < 0.3) v.blick = -v.blick; }
      if (v.pickt > 0) v.pickt -= dt;
      if (v.hop > 0) v.hop -= dt;
      if (sp && L.sichtbar > 0.5) {
        var bx = sp.x - v.x, by = sp.y - v.y;
        if (bx * bx + by * by < SCHEU * SCHEU) {
          // wegfliegen zu einem Platz weit weg von Biel (bei weniger Bewegung nur ein paar Hopser zur Seite)
          var best = null, bd = -1;
          for (var k = 0; k < 6; k++) {
            var p = L.plaetze[Math.floor(z() * L.plaetze.length)], q = (p.x - sp.x) * (p.x - sp.x) + (p.y - sp.y) * (p.y - sp.y);
            var nah = (p.x - v.x) * (p.x - v.x) + (p.y - v.y) * (p.y - v.y);
            if (q > bd && nah < 140 * 140) { bd = q; best = p; }
          }
          if (ruhig) { v.x -= (bx > 0 ? 1 : -1) * 10; v.blick = bx > 0 ? -1 : 1; v.pick = 1.5; }
          else if (best) { v.zustand = 'fliegt'; v.zx = best.x; v.zy = best.y; toene.push('flattern'); }
        }
      }
    });
    // ganz leises Zwitschern am Tag, selten
    L.zirp -= dt;
    if (L.zirp <= 0) { L.zirp = 9 + z() * 12; if (L.sichtbar > 0.9) toene.push('vogel'); }
    return toene;
  }

  function anzahl(L) { return L ? L.falter.filter(function (f) { return !f.aus; }).length + L.voegel.length : 0; }

  Dorf.Leben = { FALTER: FALTER, VOEGEL: VOEGEL, MAX: MAX, SCHEU: SCHEU, erstelle: erstelle, update: update, tageslicht: tageslicht, anzahl: anzahl };
})(globalThis);
