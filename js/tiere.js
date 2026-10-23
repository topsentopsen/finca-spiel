/* Tiere zum Streicheln (ab v0.4): Eselin Bruna auf ihrer Wiese und ein kleiner Gecko an der Hauswand.
   Ab v0.8 zwei Huehner vor ihrem Stall, die ab und zu ein Ei ins Gras legen.
   Eigener Zufall, damit die Gaeste genauso entscheiden wie vorher (die Huehner haben noch einmal einen eigenen). */
(function (g) {
  'use strict';
  var Dorf = g.Dorf = g.Dorf || {};
  var K = 16;
  var REICHWEITE = 46;            // so nah muss Biel sein (Pixel), der Zaun ist dazwischen
  var FREUDE = 1.6;               // Sekunden Freude nach dem Streicheln
  var HUHN_NAH = 30;              // Huehner laufen frei, da muss Biel naeher heran
  var EI_NAH = 22;                // so nah muss Biel fuer ein Ei sein
  var EIER_MAX = 3;               // hoechstens so viele Eier liegen gleichzeitig im Gras
  var LEGEN = [35, 65];           // Sekunden zwischen zwei Eiern pro Huhn (echte Spielzeit)

  function erstelle(karte, seed) {
    var rng = Dorf.RNG.erstelle(((seed >>> 0) ^ 0x51ED) >>> 0), w = karte.wiese, gk = karte.gecko;
    var esel = { art: 'esel', name: 'Bruna', x: (w.x0 + 2) * K + 8, y: (w.y0 + 1) * K + 12, dir: 'links', frame: 0, animT: 0,
      ziel: null, warte: 2, frisst: 0, freude: 0, gestreichelt: 0 };
    var gecko = { art: 'gecko', name: 'Gecko', x: gk.x0 + 10, y: gk.y, dir: 'rechts', frame: 0, animT: 0,
      ziel: null, warte: 3, freude: 0, gestreichelt: 0 };
    var t = { liste: [esel, gecko], esel: esel, gecko: gecko, rng: rng, eier: [], eiNr: 0, neuesEi: 0 };
    // ab v0.8: Huehner mit eigenem Zufall, Esel und Gecko bleiben dadurch genau wie vorher
    var hz = karte.huehner;
    if (hz) {
      t.huhnRng = Dorf.RNG.erstelle(((seed >>> 0) ^ 0xC0C0) >>> 0);
      t.huehner = [
        { art: 'huhn', name: 'Huhn', feder: 'weiss', x: (hz.x0 + 1) * K + 8, y: (hz.y0 + 1) * K + 10, dir: 'rechts', frame: 0, animT: 0, ziel: null, warte: 1.5, freude: 0, gestreichelt: 0, pickt: 0, lege: 30 },
        { art: 'huhn', name: 'Huhn', feder: 'braun', x: (hz.x1 - 1) * K + 4, y: (hz.y0 + 2) * K + 10, dir: 'links', frame: 0, animT: 0, ziel: null, warte: 2.5, freude: 0, gestreichelt: 0, pickt: 0, lege: 48 }
      ];
      t.huehner.forEach(function (h) { t.liste.push(h); });
      morgenEier(t, karte);
    }
    return t;
  }
  // Am Morgen liegen schon zwei Eier vor dem Stall
  function morgenEier(tiere, karte) {
    var hz = karte.huehner; if (!hz) return;
    tiere.eier = [{ id: ++tiere.eiNr, x: (hz.x0 + 2) * K + 6, y: (hz.y0 + 1) * K + 12 }, { id: ++tiere.eiNr, x: (hz.x0 + 4) * K + 10, y: (hz.y0 + 2) * K + 13 }];
  }
  function neuerTag(tiere, karte) { if (tiere && tiere.huehner) { morgenEier(tiere, karte); tiere.huehner.forEach(function (h, i) { h.lege = 30 + i * 18; }); } }
  function huhnPunkt(karte, rng) {
    var hz = karte.huehner;
    return { x: hz.x0 * K + 4 + Math.floor(rng.next() * ((hz.x1 - hz.x0 + 1) * K - 8)), y: hz.y0 * K + 8 + Math.floor(rng.next() * ((hz.y1 - hz.y0 + 1) * K - 10)) };
  }
  // Huhn: trippelt zu einem Punkt, pickt ein wenig, legt manchmal ein Ei
  function updateHuhn(tiere, karte, h, dt) {
    var rng = tiere.huhnRng;
    h.lege -= dt;
    if (h.lege <= 0) {
      h.lege = LEGEN[0] + rng.next() * (LEGEN[1] - LEGEN[0]);
      if (tiere.eier.length < EIER_MAX) { tiere.eier.push({ id: ++tiere.eiNr, x: Math.round(h.x + (h.dir === 'links' ? 5 : -5)), y: Math.round(h.y + 1), neu: 0.6 }); tiere.neuesEi++; }
    }
    if (h.freude > 0) { h.freude = Math.max(0, h.freude - dt); h.frame = 0; return; }
    if (h.ziel) { geheZu(h, dt, 14); if (!h.ziel) h.warte = 1 + rng.next() * 3; return; }
    h.warte -= dt;
    h.pickt = (h.pickt + dt) % 1.2;
    if (h.warte <= 0) h.ziel = huhnPunkt(karte, rng);
  }

  // Ei im Gras in Biels Naehe (fuer Taste E und den Aktionsknopf)
  function naechstesEi(tiere, sp, max) {
    var best = null, bd = max || EI_NAH;
    (tiere.eier || []).forEach(function (e) { var d = Math.hypot(e.x - sp.x, e.y - sp.y); if (d <= bd) { bd = d; best = e; } });
    return best;
  }
  function eiAn(tiere, wx, wy, rad) {
    var best = null, bd = rad || 6;
    (tiere.eier || []).forEach(function (e) { var d = Math.hypot(e.x - wx, (e.y - 3) - wy); if (d <= bd) { bd = d; best = e; } });
    return best;
  }
  function nimmEi(tiere, ei) { var i = tiere.eier.indexOf(ei); if (i < 0) return false; tiere.eier.splice(i, 1); return true; }

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
    (tiere.eier || []).forEach(function (e) { if (e.neu > 0) e.neu = Math.max(0, e.neu - dt); });
    tiere.liste.forEach(function (t) {
      if (t.art === 'huhn') { updateHuhn(tiere, karte, t, dt); return; }
      if (t.mampft > 0) { t.mampft = Math.max(0, t.mampft - dt); t.freude = Math.max(0, t.freude - dt); t.frame = 0; return; }
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
      var b = t.art === 'esel' ? { l: 12, r: 12, o: 22, u: 4 } : (t.art === 'huhn' ? { l: 7, r: 7, o: 12, u: 3 } : { l: 8, r: 8, o: 8, u: 6 });
      if (wx >= t.x - b.l && wx <= t.x + b.r && wy >= t.y - b.o && wy <= t.y + b.u) treffer = t;
    });
    return treffer;
  }
  function nah(tier, sp) { return Math.hypot(tier.x - sp.x, (tier.y - 6) - (sp.y - 6)) <= (tier.art === 'huhn' ? HUHN_NAH : REICHWEITE); }
  function naechstes(tiere, sp) {
    var best = null, bd = Infinity;
    tiere.liste.forEach(function (t) { var d = Math.hypot(t.x - sp.x, t.y - sp.y); if (nah(t, sp) && d < bd) { bd = d; best = t; } });
    return best;
  }
  // Biel ruft: die Eselin kommt neugierig an den Zaun, der Gecko bleibt still sitzen
  function locke(tiere, karte, tier, wx, wy) {
    if (tier.art === 'esel') { tier.ziel = wiesenPunkt(karte, Math.floor(wx / K), Math.floor(wy / K)); tier.lockt = true; tier.freude = 0; }
    else { tier.ziel = null; tier.warte = tier.art === 'huhn' ? 4 : 8; }
  }
  function streichle(tier, sp) {
    tier.freude = FREUDE; tier.ziel = null; tier.gestreichelt++; tier.lockt = false;
    if (sp) tier.dir = sp.x < tier.x ? 'links' : 'rechts';
    tier.warte = 2;
  }
  // ab v0.5: Karotte fuer Bruna. Sie mampft ein paar Sekunden und freut sich doppelt
  var MAMPFEN = 2.5;
  function fuettere(tier, sp) {
    streichle(tier, sp);
    tier.gestreichelt--;
    tier.freude = FREUDE * 1.5; tier.mampft = MAMPFEN; tier.warte = MAMPFEN + 0.5;
    tier.gefuettert = (tier.gefuettert || 0) + 1;
  }
  var FUETTER_SPRUECHE = ['Bruna mampft die Karotte. Knusper knusper, iii aah!', 'Bruna liebt Karotten! Auf Mallorquinisch: pastanaga.', 'Bruna schmatzt ganz zufrieden und wackelt mit dem Schwanz.'];
  function fuetterSpruch(tier) { return FUETTER_SPRUECHE[((tier.gefuettert || 1) - 1) % FUETTER_SPRUECHE.length]; }

  var SPRUECHE = {
    esel: ['Bruna wackelt mit den Ohren. So süß!', 'Bruna mag es, hinter den Ohren gekrault zu werden.', 'Ase heißt Esel auf Mallorquinisch. Bruna ist ein liebes Ase.', 'Bruna stupst dich mit der weichen Nase an.'],
    gecko: ['Der Gecko blinzelt dich an. Hola, petit!', 'Dragó heißt Gecko auf Mallorquinisch.', 'Der Gecko hat ganz klebrige Füßchen.'],
    huhn: ['Das Huhn gackert fröhlich. Gock, gock!', 'Gallina heißt Huhn auf Mallorquinisch.', 'Die Hühner legen Eier ins Gras. Schau mal, ob eins da liegt!']
  };
  // Bilder fuer die Sprechblase (ab v0.8)
  var BILDER = { esel: ['esel', 'herz'], gecko: ['gecko', 'herz'], huhn: ['huhn', 'herz'] };
  function spruch(tier) { var l = SPRUECHE[tier.art]; return l[(tier.gestreichelt - 1 + l.length) % l.length]; }

  Dorf.Tiere = { REICHWEITE: REICHWEITE, FREUDE: FREUDE, HUHN_NAH: HUHN_NAH, EI_NAH: EI_NAH, EIER_MAX: EIER_MAX, LEGEN: LEGEN, BILDER: BILDER,
    neuerTag: neuerTag, naechstesEi: naechstesEi, eiAn: eiAn, nimmEi: nimmEi, erstelle: erstelle, update: update, an: an, nah: nah, naechstes: naechstes, locke: locke, streichle: streichle, fuettere: fuettere, fuetterSpruch: fuetterSpruch, MAMPFEN: MAMPFEN, spruch: spruch, SPRUECHE: SPRUECHE };
})(globalThis);
