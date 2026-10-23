/* Finca-Karte als Kachelraster (40 x 30 Kacheln a 16 px). */
(function (g) {
  'use strict';
  var Dorf = g.Dorf = g.Dorf || {};

  var T = {
    GRAS: 0, WEG: 1, PFLASTER: 2, MAUER: 3, WAND: 4, BODEN: 5, FLIESE: 6,
    WASSER: 7, RAND: 8, BRUNNEN: 9, OLIVE: 10, TAFEL: 11, HERD: 12, TOR: 13, BEET: 14,
    // ab v0.2: Einrichtung
    TEPPICH: 15, COUCH: 16, PFLANZE: 17, ECKBANK: 18, ANRICHTE: 19, BETT: 20, SESSEL: 21, TISCH: 22,
    // ab v0.4: kleine Eselwiese mit Holzzaun
    ZAUN: 23, WIESE: 24
  };
  var BLOCK = {};
  [T.MAUER, T.WAND, T.WASSER, T.BRUNNEN, T.OLIVE, T.TAFEL, T.HERD, T.TOR,
    T.COUCH, T.PFLANZE, T.ECKBANK, T.ANRICHTE, T.BETT, T.SESSEL, T.TISCH, T.ZAUN, T.WIESE].forEach(function (t) { BLOCK[t] = true; });

  var KACHEL = 16, BREITE = 40, HOEHE = 30;

  // Raeume (Innenflaeche ohne Waende). v0.1: Kueche 6x7, Wohnbereich 5x7, Gaestehaus 6x6.
  var RAEUME = {
    kueche: { x0: 3, y0: 2, x1: 9, y1: 9, name: 'Küche' },
    wohnen: { x0: 11, y0: 2, x1: 15, y1: 9, name: 'Wohnbereich' },
    gaestehaus: { x0: 30, y0: 17, x1: 35, y1: 23, name: 'Gästehaus' }
  };

  function erstelle(rng) {
    var w = BREITE, h = HOEHE;
    var tiles = new Uint8Array(w * h);
    function set(x, y, t) { if (x >= 0 && y >= 0 && x < w && y < h) tiles[y * w + x] = t; }
    function rect(x0, y0, x1, y1, t) { for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) set(x, y, t); }
    function ring(x0, y0, x1, y1, t) {
      for (var x = x0; x <= x1; x++) { set(x, y0, t); set(x, y1, t); }
      for (var y = y0; y <= y1; y++) { set(x0, y, t); set(x1, y, t); }
    }

    rect(0, 0, w - 1, h - 1, T.GRAS);

    // Innenhof (Clastra) mit Brunnen
    rect(12, 12, 27, 20, T.PFLASTER);
    rect(19, 15, 20, 16, T.BRUNNEN);

    // Haupthaus (v0.2 groesser): Kueche links, Wohnbereich rechts
    ring(2, 1, 16, 10, T.WAND);
    rect(3, 2, 9, 9, T.FLIESE);
    rect(11, 2, 15, 9, T.BODEN);
    for (var y = 2; y <= 9; y++) set(10, y, T.WAND);
    set(10, 6, T.BODEN);            // Tuer Kueche <-> Wohnbereich
    // Kueche: Anrichte, Herdzeile, Pflanze, Eckbank mit Tisch
    set(3, 2, T.ANRICHTE); rect(4, 2, 6, 2, T.HERD); rect(7, 2, 8, 2, T.ANRICHTE); set(9, 2, T.PFLANZE);
    set(3, 7, T.ECKBANK); set(3, 8, T.ECKBANK); set(4, 8, T.ECKBANK); set(4, 7, T.TISCH);
    set(7, 10, T.FLIESE);            // Kuechentuer zur Arkade
    // Wohnbereich: Couch an der Wand, Teppich, Sessel, Pflanzen in den Ecken
    rect(12, 2, 14, 2, T.COUCH);
    rect(12, 4, 14, 5, T.TEPPICH);
    set(15, 4, T.SESSEL);
    set(11, 2, T.PFLANZE); set(15, 9, T.PFLANZE);
    set(13, 10, T.BODEN);            // Haustuer zum Innenhof
    set(13, 11, T.PFLASTER);

    // Arkade mit langer Tafel
    rect(3, 11, 11, 13, T.PFLASTER);
    rect(5, 12, 8, 12, T.TAFEL);

    // Pool mit Rand, Weg vom Innenhof
    rect(24, 2, 35, 9, T.RAND);
    rect(25, 3, 34, 8, T.WASSER);
    rect(25, 10, 26, 11, T.WEG);

    // Nebengebaeude (Gaestehaus, v0.2 groesser) mit Bett, Teppich, Pflanze
    ring(29, 16, 36, 24, T.WAND);
    rect(30, 17, 35, 23, T.BODEN);
    set(34, 17, T.BETT); set(35, 17, T.BETT); set(34, 18, T.BETT); set(35, 18, T.BETT);
    rect(31, 20, 33, 21, T.TEPPICH);
    set(30, 17, T.PFLANZE); set(35, 23, T.SESSEL);
    set(29, 19, T.BODEN);
    set(28, 19, T.PFLASTER);

    // Eselwiese (v0.4) zwischen Pool und Gaestehaus: Zaun ringsum, innen weiches Gras
    var WIESE = { x0: 31, y0: 11, x1: 36, y1: 13 };
    ring(WIESE.x0 - 1, WIESE.y0 - 1, WIESE.x1 + 1, WIESE.y1 + 1, T.ZAUN);
    rect(WIESE.x0, WIESE.y0, WIESE.x1, WIESE.y1, T.WIESE);

    // Kraeuter- und Gemuesebeet
    rect(3, 16, 8, 19, T.BEET);

    // Wege im Garten bis zum Tor
    rect(19, 21, 20, 28, T.WEG);
    rect(4, 24, 28, 24, T.WEG);

    // Mauer drumherum mit Tor
    ring(0, 0, w - 1, h - 1, T.MAUER);
    set(19, h - 1, T.TOR); set(20, h - 1, T.TOR);

    // Olivenbaeume (fest platziert)
    var oliven = [[3, 22], [7, 26], [10, 21], [13, 27], [4, 27], [15, 22], [23, 22], [24, 27],
      [27, 26], [31, 27], [35, 26], [37, 21], [37, 4], [37, 8], [2, 14], [10, 16], [22, 2], [18, 3]];
    var baeume = [];
    oliven.forEach(function (p) { set(p[0], p[1], T.OLIVE); baeume.push({ x: p[0], y: p[1] }); });

    // Blumen als Deko (Seed-Zufall, nur auf Gras)
    var blumen = [];
    var farben = ['#ffb3c7', '#ffe9a0', '#d8c2ff', '#ffffff', '#b8e8ff'];
    for (var i = 0; i < 80; i++) {
      var bx = rng.int(1, w - 2), by = rng.int(1, h - 2);
      if (tiles[by * w + bx] === T.GRAS) blumen.push({ x: bx * KACHEL + rng.int(2, 13), y: by * KACHEL + rng.int(2, 13), farbe: rng.pick(farben) });
    }

    var karte = {
      w: w, h: h, kachel: KACHEL, tiles: tiles, baeume: baeume, blumen: blumen, raeume: RAEUME,
      brunnen: { x: 19, y: 15 }, wiese: WIESE,
      // Gecko sitzt an der Hauswand rechts der Haustuer (Pixelbereich auf der Wandfront)
      gecko: { x0: 14 * KACHEL + 3, x1: 16 * KACHEL + 12, y: 10 * KACHEL + 12 },
      tile: function (x, y) { if (x < 0 || y < 0 || x >= w || y >= h) return T.MAUER; return tiles[y * w + x]; },
      blockiert: function (x, y) { return !!BLOCK[karte.tile(x, y)]; }
    };

    function zieleNeben(typ, nur, filter) {
      var out = [];
      for (var yy = 0; yy < h; yy++) for (var xx = 0; xx < w; xx++) {
        if (karte.blockiert(xx, yy)) continue;
        if (nur && tiles[yy * w + xx] !== nur) continue;
        if (filter && !filter(xx, yy)) continue;
        if (karte.tile(xx + 1, yy) === typ || karte.tile(xx - 1, yy) === typ || karte.tile(xx, yy + 1) === typ || karte.tile(xx, yy - 1) === typ) out.push({ x: xx, y: yy });
      }
      return out;
    }
    karte.orte = {
      tafel: zieleNeben(T.TAFEL),
      pool: zieleNeben(T.WASSER, T.RAND),
      // Platz direkt vor der Couch (Gast setzt sich drauf)
      couch: zieleNeben(T.COUCH, null, function (xx, yy) { return karte.tile(xx, yy - 1) === T.COUCH; }),
      // Platz vor dem Herd (Biel kocht)
      herd: zieleNeben(T.HERD, null, function (xx, yy) { return karte.tile(xx, yy - 1) === T.HERD; }),
      bummeln: (function () { var o = []; for (var yy = 12; yy <= 20; yy++) for (var xx = 12; xx <= 27; xx++) if (!karte.blockiert(xx, yy)) o.push({ x: xx, y: yy }); return o; })()
    };
    karte.start = { biel: { x: 19, y: 18 }, mia: { x: 16, y: 17 }, jonas: { x: 23, y: 17 } };
    // Begehbare Bodenflaeche eines Raums (inklusive Teppich, ohne Moebel)
    karte.flaeche = function (id) {
      var r = RAEUME[id], n = 0;
      for (var yy = r.y0; yy <= r.y1; yy++) for (var xx = r.x0; xx <= r.x1; xx++) if (!karte.blockiert(xx, yy)) n++;
      return n;
    };
    karte.groesse = function (id) { var r = RAEUME[id]; return (r.x1 - r.x0 + 1) * (r.y1 - r.y0 + 1); };
    return karte;
  }

  Dorf.Karte = { T: T, KACHEL: KACHEL, BREITE: BREITE, HOEHE: HOEHE, RAEUME: RAEUME, erstelle: erstelle };
})(globalThis);
