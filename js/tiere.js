/* Tiere zum Streicheln (ab v0.4): Eselin Bruna auf ihrer Wiese und ein kleiner Gecko an der Hauswand.
   Eigener Zufall, damit die Gaeste genauso entscheiden wie vorher. */
(function (g) {
  'use strict';
  var Dorf = g.Dorf = g.Dorf || {};
  var K = 16;
  var REICHWEITE = 46;            // so nah muss Biel sein (Pixel), der Zaun ist dazwischen
  var FREUDE = 1.6;               // Sekunden Freude nach dem Streicheln

  function erstelle(karte, seed) {
    var rng = Dorf.RNG.erstelle(((seed >>> 0) ^ 0x51ED) >>> 0), w = karte.wiese, gk = karte.gecko;
    var esel = { art: 'esel', name: 'Bruna', x: (w.x0 + 2) * K + 8, y: (w.y0 + 1) * K + 12, dir: 'links', frame: 0, animT: 0,
      ziel: null, warte: 2, frisst: 0, freude: 0, gestreichelt: 0 };
    var gecko = { art: 'gecko', name: 'Gecko', x: gk.x0 + 10, y: gk.y, dir: 'rechts', frame: 0, animT: 0,
      ziel: null, warte: 3, freude: 0, gestreichelt: 0 };
    return { liste: [esel, gecko], esel: esel, gecko: gecko, rng: rng };
  }

  function wiesenPunkt(karte, tx, ty) {
    var w = karte.wiese;
    return { x: Math.max(w.x0, Math.min(w.x1, tx)) * K + 8, y: Math.max(w.y0, Math.min(w.y1, ty)) * K + 12 };
  }

  function geheZu(tier, dt, tempo) {
    var dx = tier.ziel.x - tier.x, dy = tier.ziel.y - tier.y, d = Math.hypot(dx, dy), s = tempo * dt;
    if (Math.abs(dx) > 0.5) tier.dir = dx < 0 ? 'links' : 'rechts';
    tier.animT += dt; tier.frame = Math.floor(tier.animT * 6) % 4;
    if (d <= s) { tier.x = tier.ziel.x; tier.y = tier.ziel.y; tier.ziel = null; tier.frame = 0; return true; }
    tier.x += dx / d * s; tier.y += dy / d * s;
    return false;
  }

  function update(tiere, karte, dt) {
    var rng = tiere.rng;
    tiere.liste.forEach(function (t) {
      if (t.freude > 0) { t.freude = Math.max(0, t.freude - dt); t.frame = 0; return; }
      if (t.ziel) { geheZu(t, dt, t.art === 'esel' ? (t.lockt ? 20 : 12) : 36); if (!t.ziel) { t.lockt = false; t.warte = t.art === 'esel' ? 2 + rng.next() * 4 : 3 + rng.next() * 6; } return; }
      t.warte -= dt;
      if (t.art === 'esel') t.frisst = (t.frisst + dt) % 4;   // ab und zu den Kopf zum Gras
      if (t.warte > 0) return;
      if (t.art === 'esel') { var w = karte.wiese; t.ziel = wiesenPunkt(karte, rng.int(w.x0, w.x1), rng.int(w.y0, w.y1)); }
      else { var gk = karte.gecko; t.ziel = { x: rng.int(gk.x0, gk.x1), y: gk.y }; }
    });
  }

  // Tier unter einem Weltpunkt (Klick oder Tippen), grosszuegig fuer kleine Finger
  function an(tiere, wx, wy) {
    var treffer = null;
    tiere.liste.forEach(function (t) {
      var b = t.art === 'esel' ? { l: 12, r: 12, o: 22, u: 4 } : { l: 8, r: 8, o: 8, u: 6 };
      if (wx >= t.x - b.l && wx <= t.x + b.r && wy >= t.y - b.o && wy <= t.y + b.u) treffer = t;
    });
    return treffer;
  }
  function nah(tier, sp) { return Math.hypot(tier.x - sp.x, (tier.y - 6) - (sp.y - 6)) <= REICHWEITE; }
  function naechstes(tiere, sp) {
    var best = null, bd = Infinity;
    tiere.liste.forEach(function (t) { var d = Math.hypot(t.x - sp.x, t.y - sp.y); if (nah(t, sp) && d < bd) { bd = d; best = t; } });
    return best;
  }
  // Biel ruft: die Eselin kommt neugierig an den Zaun, der Gecko bleibt still sitzen
  function locke(tiere, karte, tier, wx, wy) {
    if (tier.art === 'esel') { tier.ziel = wiesenPunkt(karte, Math.floor(wx / K), Math.floor(wy / K)); tier.lockt = true; tier.freude = 0; }
    else { tier.ziel = null; tier.warte = 8; }
  }
  function streichle(tier, sp) {
    tier.freude = FREUDE; tier.ziel = null; tier.gestreichelt++; tier.lockt = false;
    if (sp) tier.dir = sp.x < tier.x ? 'links' : 'rechts';
    tier.warte = 2;
  }

  var SPRUECHE = {
    esel: ['Bruna wackelt mit den Ohren. So süß!', 'Bruna mag es, hinter den Ohren gekrault zu werden.', 'Ase heißt Esel auf Mallorquinisch. Bruna ist ein liebes Ase.', 'Bruna stupst dich mit der weichen Nase an.'],
    gecko: ['Der Gecko blinzelt dich an. Hola, petit!', 'Dragó heißt Gecko auf Mallorquinisch.', 'Der Gecko hat ganz klebrige Füßchen.']
  };
  function spruch(tier) { var l = SPRUECHE[tier.art]; return l[(tier.gestreichelt - 1 + l.length) % l.length]; }

  Dorf.Tiere = { REICHWEITE: REICHWEITE, FREUDE: FREUDE, erstelle: erstelle, update: update, an: an, nah: nah, naechstes: naechstes, locke: locke, streichle: streichle, spruch: spruch, SPRUECHE: SPRUECHE };
})(globalThis);
