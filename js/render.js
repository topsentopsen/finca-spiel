/* Zeichnen: Kacheln, Objekte, Figuren, Licht, HUD. Alles per Code, keine fremden Grafiken. */
(function (g) {
  'use strict';
  var Dorf = g.Dorf = g.Dorf || {};
  var W = 320, H = 176, K = 16;

  var P = {
    kontur: '#2b2135', gras: '#a8de8c', gras2: '#88c56f', weg: '#efd8a6', weg2: '#d6b781',
    pflaster: '#f3dfbb', pflaster2: '#d8bc8e', boden: '#eac497', boden2: '#cfa070',
    fliese1: '#f8f3e8', fliese2: '#cfe8ef', wasser: '#78d0ee', wasser2: '#c4f0fa', wasser3: '#54afd6',
    rand: '#f6ecd8', rand2: '#e2d3b6', mauerTop: '#ebd2a8', mauerFront: '#c99c6c', mauerFuge: '#d7b88a',
    dach: '#ec9a74', dach2: '#d97f5c', putz: '#fcf3e4', putz2: '#e9dcc6', fenster: '#6fa7d6',
    holz: '#bd7b4e', holz2: '#965a35', tuch: '#ffffff', herd: '#c6ccd6', herd2: '#8e96a3',
    erde: '#b07a57', erde2: '#8f5f40', spross: '#6cbf55', blatt: '#9cc070', blatt2: '#79a254', blatt3: '#c4dc94', stamm: '#8a5a3b',
    stein: '#ddd5c8', stein2: '#b8ad9e', schatten: 'rgba(43,33,53,0.22)', box: '#fff8ec'
  };

  function erstelle(canvas, ui) {
    var ctx = canvas.getContext('2d');
    if ('imageSmoothingEnabled' in ctx) ctx.imageSmoothingEnabled = false;
    return { canvas: canvas, ctx: ctx, ui: ui ? ui.getContext('2d') : null, uiCanvas: ui || null, uiSkala: 1 };
  }

  function hash(x, y) { var h = (x * 374761393 + y * 668265263) >>> 0; h = ((h ^ (h >>> 13)) * 1274126177) >>> 0; return h ^ (h >>> 16); }
  function r(c, x, y, w, h, col) { c.fillStyle = col; c.fillRect(x, y, w, h); }
  function box(c, x, y, w, h, col) { r(c, x, y, w, h, P.kontur); r(c, x + 1, y + 1, w - 2, h - 2, col); }
  function kreis(c, cx, cy, rad, col) {
    c.fillStyle = col;
    for (var dy = -rad; dy <= rad; dy++) { var w = Math.floor(Math.sqrt(rad * rad - dy * dy) + 0.3); c.fillRect(cx - w, cy + dy, 2 * w + 1, 1); }
  }
  function ellipse(c, cx, cy, rx, ry, col) {
    c.fillStyle = col;
    for (var dy = -ry; dy <= ry; dy++) { var w = Math.floor(rx * Math.sqrt(1 - (dy * dy) / (ry * ry))); c.fillRect(cx - w, cy + dy, 2 * w + 1, 1); }
  }

  // ---------- Kacheln ----------
  function istWand(t) { var T = Dorf.Karte.T; return t === T.MAUER || t === T.WAND; }
  function zeichneKachel(c, karte, x, y, sx, sy, zeit) {
    var T = Dorf.Karte.T, t = karte.tile(x, y), hs = hash(x, y);
    switch (t) {
      case T.GRAS: case T.OLIVE:
        r(c, sx, sy, K, K, P.gras);
        if (hs % 3 === 0) { r(c, sx + (hs % 11) + 2, sy + ((hs >> 4) % 10) + 3, 1, 2, P.gras2); r(c, sx + (hs % 11) + 4, sy + ((hs >> 4) % 10) + 2, 1, 3, P.gras2); }
        if (hs % 5 === 1) r(c, sx + ((hs >> 7) % 12) + 2, sy + ((hs >> 9) % 12) + 2, 2, 1, P.gras2);
        break;
      case T.WEG:
        r(c, sx, sy, K, K, P.weg);
        r(c, sx + (hs % 12) + 2, sy + ((hs >> 5) % 12) + 2, 2, 1, P.weg2);
        r(c, sx + ((hs >> 3) % 12) + 1, sy + ((hs >> 8) % 12) + 2, 1, 1, P.weg2);
        break;
      case T.PFLASTER: case T.BRUNNEN: case T.TAFEL:
        r(c, sx, sy, K, K, P.pflaster);
        r(c, sx, sy + 7, K, 1, P.pflaster2); r(c, sx, sy + 15, K, 1, P.pflaster2);
        r(c, sx + (y % 2 ? 4 : 12), sy, 1, 7, P.pflaster2); r(c, sx + (y % 2 ? 12 : 4), sy + 8, 1, 7, P.pflaster2);
        if (t === T.TAFEL) zeichneTafel(c, karte, x, y, sx, sy);
        break;
      case T.BODEN:
        r(c, sx, sy, K, K, P.boden);
        for (var i = 3; i < K; i += 4) r(c, sx, sy + i, K, 1, P.boden2);
        r(c, sx + (y % 2 ? 5 : 11), sy, 1, K, P.boden2);
        break;
      case T.FLIESE: case T.HERD:
        for (var fy = 0; fy < 2; fy++) for (var fx = 0; fx < 2; fx++) r(c, sx + fx * 8, sy + fy * 8, 8, 8, (fx + fy) % 2 ? P.fliese2 : P.fliese1);
        if (t === T.HERD) {
          box(c, sx, sy + 1, K, 14, P.herd);
          r(c, sx + 1, sy + 11, 14, 3, P.herd2);
          kreis(c, sx + 5, sy + 6, 2, P.kontur); kreis(c, sx + 11, sy + 6, 2, P.kontur);
          if (x === 6) { r(c, sx + 3, sy - 3, 10, 4, P.kontur); r(c, sx + 4, sy - 2, 8, 2, '#ef8f6b'); }
        }
        break;
      case T.WASSER:
        r(c, sx, sy, K, K, P.wasser);
        if (karte.tile(x, y - 1) !== T.WASSER) r(c, sx, sy, K, 3, P.wasser3);
        var wx = Math.floor((zeit * 6 + x * 5 + y * 3) % 16);
        r(c, sx + wx, sy + 6 + (x + y) % 3 * 3, 4, 1, P.wasser2);
        r(c, sx + ((wx + 9) % 14), sy + 12, 3, 1, P.wasser2);
        break;
      case T.RAND:
        r(c, sx, sy, K, K, P.rand);
        r(c, sx + 7, sy, 1, K, P.rand2); r(c, sx, sy + 7, K, 1, P.rand2);
        if (karte.tile(x, y + 1) === T.WASSER) r(c, sx, sy + 15, K, 1, P.kontur);
        if (karte.tile(x, y - 1) === T.WASSER) r(c, sx, sy, K, 1, P.kontur);
        if (karte.tile(x + 1, y) === T.WASSER) r(c, sx + 15, sy, 1, K, P.kontur);
        if (karte.tile(x - 1, y) === T.WASSER) r(c, sx, sy, 1, K, P.kontur);
        break;
      case T.BEET:
        r(c, sx, sy, K, K, P.erde);
        for (var by = 2; by < K; by += 5) { r(c, sx, sy + by + 2, K, 1, P.erde2); r(c, sx + 2 + (by % 4), sy + by, 2, 2, P.spross); r(c, sx + 9 + (by % 3), sy + by, 2, 2, P.spross); }
        break;
      case T.TOR:
        r(c, sx, sy, K, K, P.weg);
        box(c, sx, sy, K, K, P.holz);
        for (var tx = 3; tx < K; tx += 4) r(c, sx + tx, sy + 1, 1, 14, P.holz2);
        break;
      case T.MAUER: case T.WAND:
        zeichneWand(c, karte, x, y, sx, sy, t);
        break;
    }
  }
  function zeichneWand(c, karte, x, y, sx, sy, t) {
    var T = Dorf.Karte.T, mauer = t === T.MAUER;
    var top = mauer ? P.mauerTop : P.dach, fuge = mauer ? P.mauerFuge : P.dach2;
    var front = !istWand(karte.tile(x, y + 1)) && y + 1 < karte.h;
    var topH = front ? 10 : K;
    r(c, sx, sy, K, topH, top);
    if (mauer) { r(c, sx, sy + 4, K, 1, fuge); r(c, sx + (y % 2 ? 6 : 12), sy, 1, 4, fuge); r(c, sx + (y % 2 ? 2 : 9), sy + 5, 1, Math.min(5, topH - 5), fuge); }
    else { for (var i = 2; i < topH; i += 4) r(c, sx, sy + i, K, 1, fuge); }
    if (front) {
      r(c, sx, sy + 10, K, 6, mauer ? P.mauerFront : P.putz);
      r(c, sx, sy + 10, K, 1, P.kontur);
      r(c, sx, sy + 15, K, 1, mauer ? P.kontur : P.putz2);
      if (!mauer && hash(x, y) % 3 === 0) { r(c, sx + 5, sy + 11, 6, 4, P.kontur); r(c, sx + 6, sy + 12, 4, 2, P.fenster); }
    }
    if (!istWand(karte.tile(x - 1, y))) r(c, sx, sy, 1, K, P.kontur);
    if (!istWand(karte.tile(x + 1, y))) r(c, sx + 15, sy, 1, K, P.kontur);
    if (!istWand(karte.tile(x, y - 1)) && y > 0) r(c, sx, sy, K, 1, P.kontur);
  }
  function zeichneTafel(c, karte, x, y, sx, sy) {
    var T = Dorf.Karte.T, links = karte.tile(x - 1, y) !== T.TAFEL, rechts = karte.tile(x + 1, y) !== T.TAFEL;
    r(c, sx, sy + 3, K, 9, P.kontur);
    r(c, sx + (links ? 1 : 0), sy + 4, K - (links ? 1 : 0) - (rechts ? 1 : 0), 6, P.tuch);
    r(c, sx + (links ? 1 : 0), sy + 10, K - (links ? 1 : 0) - (rechts ? 1 : 0), 1, P.holz);
    if (links) r(c, sx + 1, sy + 12, 2, 3, P.kontur);
    if (rechts) r(c, sx + 13, sy + 12, 2, 3, P.kontur);
    kreis(c, sx + 8, sy + 7, 2, P.kontur); kreis(c, sx + 8, sy + 7, 1, '#ffd36e');
  }

  // ---------- Objekte ----------
  function zeichneBaum(c, sx, sy) {
    // sx, sy = linke obere Ecke der Kachel
    var cx = sx + 8, by = sy + 14;
    ellipse(c, cx, by, 7, 2, P.schatten);
    r(c, cx - 3, by - 9, 6, 10, P.kontur); r(c, cx - 2, by - 9, 4, 9, P.stamm);
    kreis(c, cx - 4, by - 16, 7, P.kontur); kreis(c, cx + 4, by - 15, 7, P.kontur); kreis(c, cx, by - 21, 7, P.kontur);
    kreis(c, cx - 4, by - 16, 6, P.blatt2); kreis(c, cx + 4, by - 15, 6, P.blatt2); kreis(c, cx, by - 21, 6, P.blatt);
    kreis(c, cx - 3, by - 17, 4, P.blatt); kreis(c, cx - 2, by - 23, 2, P.blatt3);
    r(c, cx + 3, by - 18, 2, 2, '#5b6e3a'); r(c, cx - 5, by - 13, 2, 2, '#5b6e3a'); r(c, cx + 1, by - 25, 2, 2, '#5b6e3a');
  }
  function zeichneBrunnen(c, sx, sy, zeit) {
    // 2x2 Kacheln ab sx, sy
    ellipse(c, sx + 16, sy + 28, 15, 3, P.schatten);
    box(c, sx + 2, sy + 6, 28, 22, P.stein);
    r(c, sx + 3, sy + 20, 26, 7, P.stein2);
    r(c, sx + 3, sy + 20, 26, 1, P.kontur);
    for (var i = 6; i < 28; i += 6) r(c, sx + 2 + i, sy + 21, 1, 6, P.kontur);
    box(c, sx + 6, sy + 9, 20, 10, P.wasser);
    r(c, sx + 9 + Math.floor((zeit * 4) % 10), sy + 12, 4, 1, P.wasser2);
    // Pfosten und Balken mit Eimer
    r(c, sx + 4, sy - 6, 4, 16, P.kontur); r(c, sx + 5, sy - 5, 2, 14, P.holz);
    r(c, sx + 24, sy - 6, 4, 16, P.kontur); r(c, sx + 25, sy - 5, 2, 14, P.holz);
    box(c, sx + 2, sy - 9, 28, 5, P.holz);
    r(c, sx + 16, sy - 4, 1, 7, P.kontur);
    box(c, sx + 13, sy + 2, 7, 6, '#9aa4b1');
  }

  // ---------- Figuren ----------
  var BIEL = { kind: false, haut: '#d9a074', haar: '#3b2a22', haarGlanz: '#6b4c3b', bart: '#4a3226', hemd: '#fbf8f0', hemd2: '#dcd6c8', hose: '#d9c08f', schuhe: '#efe0b8', sohle: '#b08a5a' };

  function zeichnePerson(c, px, py, a, dir, frame) {
    var kind = a.kind, kopf = kind ? 8 : 10, koerper = kind ? 5 : 8, bein = kind ? 3 : 4, schuh = 2;
    var Hh = kopf + koerper + bein + schuh, ox = Math.round(px) - 8, oy = Math.round(py) - Hh + 1;
    var flip = dir === 'links', seite = dir === 'links' || dir === 'rechts';
    function q(x, y, w, h, col) { c.fillStyle = col; c.fillRect(ox + (flip ? 16 - x - w : x), oy + y, w, h); }
    var schritt = (frame === 1) ? 1 : (frame === 3 ? -1 : 0);
    var bob = (frame === 1 || frame === 3) ? 1 : 0;
    ellipse(c, Math.round(px), Math.round(py) + 1, 6, 2, P.schatten);

    var kY = bob, rY = kopf + bob, bY = kopf + koerper, sY = bY + bein;
    // Beine und Schuhe
    q(4, bY, 8, bein + schuh, P.kontur);
    if (seite) {
      q(5 + schritt, bY, 4, bein, a.hose); q(7 - schritt, bY, 4, bein, a.hose);
      q(4 + schritt * 2, sY, 5, schuh, P.kontur); q(5 + schritt * 2, sY, 4, 1, a.schuhe);
      q(7 - schritt * 2, sY, 5, schuh, P.kontur); q(8 - schritt * 2, sY, 4, 1, a.schuhe);
    } else {
      var lo = schritt > 0 ? -1 : 0, ro = schritt < 0 ? -1 : 0;
      q(5, bY, 3, bein + lo, a.hose); q(8, bY, 3, bein + ro, a.hose);
      q(4, sY + lo, 4, schuh, P.kontur); q(5, sY + lo, 3, 1, a.schuhe);
      q(8, sY + ro, 4, schuh, P.kontur); q(8, sY + ro, 3, 1, a.schuhe);
      if (a.sohle) { q(5, sY + lo + 1, 2, 1, a.sohle); q(9, sY + ro + 1, 2, 1, a.sohle); }
    }
    // Koerper / Hemd
    q(2, rY, 12, koerper, P.kontur);
    q(3, rY, 10, koerper - 1, a.hemd);
    q(3, rY + koerper - 2, 10, 1, a.hemd2);
    if (seite) {
      var arm = schritt;
      q(6 + arm, rY + 1, 4, koerper - 2, P.kontur); q(7 + arm, rY + 1, 2, koerper - 4, a.hemd2); q(7 + arm, rY + koerper - 3, 2, 2, a.haut);
    } else {
      q(3, rY + 1, 1, koerper - 4, a.hemd2); q(12, rY + 1, 1, koerper - 4, a.hemd2);
      q(3, rY + koerper - 3, 2, 2, a.haut); q(11, rY + koerper - 3, 2, 2, a.haut);
      if (dir === 'unten') { q(7, rY, 2, kind ? 1 : 2, a.haut); }
    }
    // Kopf
    q(3, kY, 10, kopf + 1, P.kontur);
    q(4, kY + 1, 8, kopf - 1, a.haut);
    var hg = a.haarGlanz || a.hemd2;
    if (dir === 'oben') {
      q(4, kY + 1, 8, kopf - 2, a.haar); q(6, kY + 1, 2, 1, hg);
      if (a.bart) { q(4, kY + kopf - 3, 1, 2, a.bart); q(11, kY + kopf - 3, 1, 2, a.bart); }
    } else if (seite) {
      q(4, kY + 1, 8, 3, a.haar); q(4, kY + 4, 4, kind ? 3 : 4, a.haar); q(6, kY + 1, 2, 1, hg);
      var auge = kind ? 4 : 5;
      q(10, kY + auge, 1, 1, P.kontur);
      if (a.bart) { q(7, kY + 7, 5, 3, a.bart); q(8, kY + 7, 1, 1, a.haut); q(11, kY + 8, 1, 1, '#a8584a'); }
      q(12, kY + auge + 1, 1, 2, a.haut);
      if (kind) { q(3, kY + 3, 2, 3, a.haar); }
    } else {
      q(4, kY + 1, 8, 3, a.haar); q(4, kY + 4, 1, 2, a.haar); q(11, kY + 4, 1, 2, a.haar); q(6, kY + 1, 2, 1, hg);
      var ay = kind ? 4 : 5;
      q(6, kY + ay, 1, 1, P.kontur); q(9, kY + ay, 1, 1, P.kontur);
      if (a.bart) { q(4, kY + 7, 8, 3, a.bart); q(5, kY + 6, 1, 1, a.bart); q(10, kY + 6, 1, 1, a.bart); q(7, kY + 8, 2, 1, '#a8584a'); q(6, kY + 7, 1, 1, '#6b4c3b'); }
      else { q(7, kY + ay + 2, 2, 1, '#c96d5e'); q(5, kY + ay + 1, 1, 1, '#f5a3a3'); q(10, kY + ay + 1, 1, 1, '#f5a3a3'); }
      if (kind) { q(2, kY + 3, 2, 3, P.kontur); q(2, kY + 4, 1, 1, a.haar); q(12, kY + 3, 2, 3, P.kontur); q(13, kY + 4, 1, 1, a.haar); }
    }
    return { oben: oy, hoehe: Hh };
  }

  function zeichneBlase(c, cx, topY, symbol) {
    var by = topY - 9;
    kreis(c, cx, by, 6, P.kontur); kreis(c, cx, by, 5, P.box);
    r(c, cx - 2, by + 6, 2, 2, P.kontur); r(c, cx - 4, by + 8, 1, 1, P.kontur);
    if (symbol === 'teller') { kreis(c, cx, by, 3, P.kontur); kreis(c, cx, by, 2, '#ffffff'); r(c, cx - 1, by - 1, 2, 2, '#ffb36b'); }
    else if (symbol === 'ball') { kreis(c, cx, by, 3, P.kontur); kreis(c, cx, by, 2, '#ff6b6b'); r(c, cx - 2, by, 5, 1, '#ffffff'); }
    else if (symbol === 'herz') { r(c, cx - 3, by - 2, 2, 2, '#ff6f91'); r(c, cx + 1, by - 2, 2, 2, '#ff6f91'); r(c, cx - 3, by - 1, 6, 2, '#ff6f91'); r(c, cx - 2, by + 1, 4, 1, '#ff6f91'); r(c, cx - 1, by + 2, 2, 1, '#ff6f91'); }
  }

  // ---------- Text (scharf auf eigener UI-Ebene) ----------
  function text(R, s, x, y, o) {
    o = o || {};
    var c = R.ui || R.ctx;
    c.font = (o.fett ? 'bold ' : '') + (o.groesse || 7) + 'px "Trebuchet MS", Verdana, sans-serif';
    c.textAlign = o.align || 'left'; c.textBaseline = 'top';
    if (o.schatten) { c.fillStyle = o.schatten; c.fillText(s, x + 0.5, y + 0.5); }
    c.fillStyle = o.farbe || P.kontur; c.fillText(s, x, y);
  }

  // ---------- Hauptzeichnen ----------
  function zeichne(R, st) {
    var c = R.ctx, karte = st.karte, kam = st.kamera, zeit = st.zeit;
    var cx = Math.round(kam.x), cy = Math.round(kam.y);
    if (R.ui) { R.ui.setTransform(1, 0, 0, 1, 0, 0); R.ui.clearRect(0, 0, R.uiCanvas.width, R.uiCanvas.height); R.ui.setTransform(R.uiSkala, 0, 0, R.uiSkala, 0, 0); }
    r(c, 0, 0, W, H, P.kontur);

    var x0 = Math.floor(cx / K), y0 = Math.floor(cy / K), x1 = Math.min(karte.w - 1, x0 + Math.ceil(W / K) + 1), y1 = Math.min(karte.h - 1, y0 + Math.ceil(H / K) + 1);
    for (var y = Math.max(0, y0); y <= y1; y++) for (var x = Math.max(0, x0); x <= x1; x++) zeichneKachel(c, karte, x, y, x * K - cx, y * K - cy, zeit);
    for (var i = 0; i < karte.blumen.length; i++) {
      var b = karte.blumen[i], bx = b.x - cx, by = b.y - cy;
      if (bx < -4 || by < -4 || bx > W + 4 || by > H + 4) continue;
      r(c, bx - 1, by, 3, 1, b.farbe); r(c, bx, by - 1, 1, 3, b.farbe); r(c, bx, by, 1, 1, '#ffcf40');
    }

    // Objekte und Figuren nach Fuss-y sortiert
    var liste = [];
    karte.baeume.forEach(function (t) { var sx = t.x * K - cx, sy = t.y * K - cy; if (sx > -24 && sx < W + 24 && sy > -32 && sy < H + 32) liste.push({ y: t.y * K + 14, f: function () { zeichneBaum(c, sx, sy); } }); });
    liste.push({ y: (karte.brunnen.y + 1) * K + 12, f: function () { zeichneBrunnen(c, karte.brunnen.x * K - cx, karte.brunnen.y * K - cy, zeit); } });
    st.gaeste.forEach(function (gs) {
      liste.push({ y: gs.y, f: function () {
        var info = zeichnePerson(c, gs.x - cx, gs.y - cy, gs.aussehen, gs.dir, gs.frame);
        var sym = Dorf.Gaeste.symbol(gs);
        if (sym) zeichneBlase(c, Math.round(gs.x - cx) + 4, info.oben, sym);
      } });
    });
    var sp = st.spieler;
    liste.push({ y: sp.y + 0.1, f: function () { zeichnePerson(c, sp.x - cx, sp.y - cy, BIEL, sp.dir, sp.frame); } });
    liste.sort(function (a, b) { return a.y - b.y; });
    liste.forEach(function (e) { e.f(); });

    // Debug: Pfade
    if (st.debug) {
      st.gaeste.forEach(function (gs) {
        for (var k = gs.pfadIndex; k < gs.pfad.length; k++) { var n = gs.pfad[k]; r(c, n.x * K + 7 - cx, n.y * K + 7 - cy, 3, 3, gs.aussehen.farbe); }
        if (gs.zielTile) { c.strokeStyle = gs.aussehen.farbe; c.lineWidth = 1; c.strokeRect(gs.zielTile.x * K - cx + 0.5, gs.zielTile.y * K - cy + 0.5, 15, 15); }
      });
    }

    // Tageslicht
    var tn = Dorf.Uhr.toenung(st.uhr);
    if (tn.a > 0.001) { c.fillStyle = 'rgba(' + tn.r + ',' + tn.g + ',' + tn.b + ',' + tn.a.toFixed(3) + ')'; c.fillRect(0, 0, W, H); }

    // HUD oben
    c.fillStyle = 'rgba(43,33,53,0.78)'; c.fillRect(0, 0, W, 11);
    text(R, 'Tag ' + st.uhr.tag + '   ' + Dorf.Uhr.text(st.uhr) + '   ' + Dorf.Uhr.phase(st.uhr), 4, 2, { farbe: '#fff4dc', fett: true });
    text(R, 'Finca · E sprechen · F1 Debug', W - 4, 2, { farbe: '#cdbfe0', align: 'right' });

    // Sprechblase (Dialogbox unten)
    if (st.blase && !st.abend) {
      box(c, 6, 140, W - 12, 32, P.box);
      box(c, 10, 134, 44, 10, '#ffd9a8');
      text(R, st.blase.sprecher, 32, 135, { align: 'center', fett: true });
      text(R, st.blase.text, 14, 150, { groesse: 8 });
    }

    if (st.debug) zeichneDebug(R, st);

    // Abendszene
    if (st.abend) {
      c.fillStyle = 'rgba(28,22,60,0.62)'; c.fillRect(0, 0, W, H);
      for (var s = 0; s < 24; s++) { var hs = hash(s, 7); r(c, hs % W, 14 + (hs >> 9) % 60, 1, 1, '#fff6c8'); }
      kreis(c, 270, 34, 9, '#fff3c4'); kreis(c, 274, 31, 8, 'rgba(28,22,60,0.9)');
      box(c, 50, 64, 220, 56, P.box);
      text(R, 'Bona nit! Tag geschafft', W / 2, 72, { align: 'center', fett: true, groesse: 12 });
      text(R, '(Gute Nacht!) Tag ' + st.uhr.tag + ' auf der Finca ist vorbei.', W / 2, 90, { align: 'center' });
      text(R, 'Enter oder Leertaste: nächster Tag', W / 2, 104, { align: 'center', farbe: '#7a5a9a' });
    }
  }

  function zeichneDebug(R, st) {
    var c = R.ctx;
    c.fillStyle = 'rgba(20,16,30,0.72)'; c.fillRect(2, 14, 150, 62);
    var t = Dorf.Gaeste.tileVon(st.spieler), z = 16;
    text(R, 'FPS ' + Math.round(st.fps || 0) + '  Seed ' + st.rng.seed, 5, z, { farbe: '#b6f5c8' }); z += 9;
    text(R, 'Biel Kachel ' + t.x + ',' + t.y, 5, z, { farbe: '#b6f5c8' }); z += 9;
    st.gaeste.forEach(function (gs) {
      var b = gs.beduerfnisse;
      text(R, gs.name + ': Satt ' + b.satt.toFixed(0) + '  Spielen ' + b.spielen.toFixed(0), 5, z, { farbe: '#ffe7b0' }); z += 8;
      text(R, '  ' + gs.zustand + ' → ' + (gs.ziel || '-') + '  Pfad ' + Math.max(0, gs.pfad.length - gs.pfadIndex), 5, z, { farbe: '#d8d0ec' }); z += 9;
    });
  }

  Dorf.Render = { W: W, H: H, P: P, BIEL: BIEL, erstelle: erstelle, zeichne: zeichne, zeichnePerson: zeichnePerson };
})(globalThis);
