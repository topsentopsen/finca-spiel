/* Zeichnen: Kacheln, Objekte, Figuren, Licht, HUD. Alles per Code, keine fremden Grafiken. */
(function (g) {
  'use strict';
  var Dorf = g.Dorf = g.Dorf || {};
  var BASE_W = 320, BASE_H = 176, PORT_H = 400;   // ab v0.18: Mobil-Hochformat 320×400, Desktop 320×176
  var W = BASE_W, H = BASE_H, K = 16;
  var screenW = BASE_W, screenH = BASE_H, hochkant = false;
  // ab v0.10: Zoom am Handy (ZM > 1 heisst: die Welt ist groesser, HUD bleibt gleich) und ruhige Bewegung
  var ZM = 1, RUHIG = false;
  function setzeBildschirm(mobilHoch) {
    hochkant = !!mobilHoch;
    screenW = BASE_W;
    screenH = hochkant ? PORT_H : BASE_H;
    W = screenW; H = screenH;
    Dorf.Render.W = screenW; Dorf.Render.H = screenH; Dorf.Render.hochkant = hochkant;
    return { w: screenW, h: screenH, hochkant: hochkant };
  }
  // ab v0.7: runde Systemschrift, wenn das Geraet eine hat (keine fremden Schriften)
  var SCHRIFT = 'ui-rounded, "SF Pro Rounded", "Arial Rounded MT Bold", "Trebuchet MS", system-ui, sans-serif';

  // v0.7: neue Palette nach dem Design Review. Boden ruhiger und dunkler, Figuren am kraeftigsten,
  // Konturen in der Farbe des Gegenstands (Laub gruen, Holz braun, Stein grau-lila), nur Figuren mit Tinte.
  var P = {
    kontur: '#4a3560', konturTief: '#3a2a4e', konturGruen: '#3f6b4a', konturHolz: '#7a4a3a', konturStein: '#8a7c9c', konturDach: '#9a4a4a',
    gras: '#a8d68f', gras2: '#8cc27a', gras3: '#c4e6a4', weg: '#dcb98e', weg2: '#c79f74',
    pflaster: '#e8d3ae', pflaster2: '#d6bb90', boden: '#eab48c', boden2: '#d39470',
    fliese1: '#f7efe2', fliese2: '#8fcbe3', wasser: '#7fd3ec', wasser2: '#e8fbff', wasser3: '#4fb0d6',
    // ab v0.19: Meer (etwas tiefer als der Pool) und warmer Strand
    meer: '#5eb8d9', meer2: '#a8e4f5', meer3: '#3a8fb0', meerTief: '#4aa3c8',
    strand: '#f3e2b8', strand2: '#e8c98a', strand3: '#fff6de',
    rand: '#f4e6d0', rand2: '#d9c2a0', mauerTop: '#f1d6ac', mauerFront: '#d9a878', mauerFuge: '#c39066',
    dach: '#f08a6a', dach2: '#d2694f', putz: '#fff3e2', putz2: '#ecd6b8', fenster: '#9fd4f0', fensterNacht: '#ffd77a', fensterKern: '#fff1c2',
    holz: '#c98b5e', holz2: '#a56c48', tuch: '#fffdf8', herd: '#dfe3ef', herd2: '#9aa3bb',
    erde: '#b98463', erde2: '#9c6a50', spross: '#6cc75a', blatt: '#84c27a', blatt2: '#5f9e64', blatt3: '#b6e39a', stamm: '#9a6a4a',
    olive1: '#c9d9b0', olive2: '#9fb98a', olive3: '#7c9a72',
    zitrone1: '#f3e86a', zitrone2: '#d9c83a', zitrone3: '#b8c85a', zitroneBlatt: '#7eb86a',
    stein: '#ece4f0', stein2: '#cfc2da', schatten: 'rgba(74,52,120,0.26)', box: '#fff8ee',
    couch: '#b9a3f5', couch2: '#9580dc', kissen: '#ffc0d4', teppich: '#f7a9bf', teppich2: '#ffdbe6',
    topf: '#ef9470', topf2: '#cf6e52', bett: '#b3dcf5', decke: '#ffc0d4', backe: '#ff9fb0', augeHell: '#ffffff',
    // Oberflaeche
    uiFlaeche: '#fff8ee', uiFlaeche2: '#fbe9d4', uiTinte: '#4a3560', uiTinteWeich: '#8a74a8',
    herzVoll: '#ff5f8a', herzLicht: '#ffc2d3', herzLeer: '#f3e3ec', herzGold: '#ffd75e', hinweis: '#ffd75e',
    akzentErnten: '#7ed492', akzentSprechen: '#5ec8b8', akzentKochen: '#ff8f8f',
    laterne: '#ffd77a', glutWarm: '#ffb84d', herdGlut: '#ff8a4d', mond: '#fff1c2'
  };

  function erstelle(canvas, ui, doc) {
    var ctx = canvas.getContext('2d');
    if ('imageSmoothingEnabled' in ctx) ctx.imageSmoothingEnabled = false;
    doc = doc || canvas.ownerDocument || null;
    // ab v0.6: Leinwand fuer den vorgezeichneten Hintergrund (ohne document, etwa in den Tests, wird Kachel fuer Kachel gezeichnet)
    var neueLeinwand = (doc && typeof doc.createElement === 'function') ? function (w, h) {
      try { var cv = doc.createElement('canvas'); if (!cv || !cv.getContext) return null; cv.width = w; cv.height = h; return cv; } catch (e) { return null; }
    } : null;
    return { canvas: canvas, ctx: ctx, ui: ui ? ui.getContext('2d') : null, uiCanvas: ui || null, uiSkala: 1, neueLeinwand: neueLeinwand, hg: null, obenBreite: 33 };
  }

  // ---------- Vorgezeichneter Hintergrund (ab v0.6) ----------
  // Alle Kacheln, die sich nie aendern, und die Blumen werden einmal auf eine Leinwand in Kartengroesse gemalt.
  // Pro Frame wird davon nur der sichtbare Ausschnitt kopiert. Wasser (Wellen) und Tafel (Teller) kommen frisch obendrauf.
  function istLebendig(t) { var T = Dorf.Karte.T; return t === T.WASSER || t === T.MEER || t === T.TAFEL; }
  function zeichneBlumen(c, karte, cx, cy, ganz) {
    for (var i = 0; i < karte.blumen.length; i++) {
      var b = karte.blumen[i], bx = b.x - cx, by = b.y - cy;
      if (!ganz && (bx < -4 || by < -4 || bx > W + 4 || by > H + 4)) continue;
      r(c, bx - 1, by - 1, 3, 3, b.farbe); r(c, bx - 2, by, 5, 1, b.farbe); r(c, bx, by - 2, 1, 5, b.farbe); r(c, bx, by, 1, 1, '#ffcf40');
    }
  }
  function hintergrund(R, karte) {
    if (R.ohneCache || !R.neueLeinwand) return null;
    if (R.hg && R.hg.karte === karte) return R.hg;
    if (R.hg && R.hg.fehlgeschlagen === karte) return null;
    var cv = R.neueLeinwand(karte.w * K, karte.h * K), hc = cv ? cv.getContext('2d') : null;
    if (!hc) { R.hg = { fehlgeschlagen: karte }; return null; }
    var lebendig = [];
    for (var y = 0; y < karte.h; y++) for (var x = 0; x < karte.w; x++) {
      zeichneKachel(hc, karte, x, y, x * K, y * K, 0, null);
      if (istLebendig(karte.tile(x, y))) lebendig.push({ x: x, y: y });
    }
    zeichneBlumen(hc, karte, 0, 0, true);
    R.hg = { karte: karte, canvas: cv, lebendig: lebendig };
    return R.hg;
  }

  function hash(x, y) { var h = (x * 374761393 + y * 668265263) >>> 0; h = ((h ^ (h >>> 13)) * 1274126177) >>> 0; return h ^ (h >>> 16); }
  function r(c, x, y, w, h, col) { c.fillStyle = col; c.fillRect(x, y, w, h); }
  // Rechteck mit abgerundeten Ecken (1 Pixel)
  function rr(c, x, y, w, h, col) { c.fillStyle = col; c.fillRect(x + 1, y, w - 2, h); c.fillRect(x, y + 1, w, h - 2); }
  function box(c, x, y, w, h, col) { rr(c, x, y, w, h, P.kontur); rr(c, x + 1, y + 1, w - 2, h - 2, col); }
  // Weiche Box: 2 Pixel Rundung, dicke Kontur
  function pille(c, x, y, w, h, col) {
    c.fillStyle = P.kontur; c.fillRect(x + 2, y, w - 4, h); c.fillRect(x + 1, y + 1, w - 2, h - 2); c.fillRect(x, y + 2, w, h - 4);
    c.fillStyle = col; c.fillRect(x + 2, y + 1, w - 4, h - 2); c.fillRect(x + 1, y + 2, w - 2, h - 4);
  }
  function kreis(c, cx, cy, rad, col) {
    c.fillStyle = col;
    for (var dy = -rad; dy <= rad; dy++) { var w = Math.floor(Math.sqrt(rad * rad - dy * dy) + 0.3); c.fillRect(cx - w, cy + dy, 2 * w + 1, 1); }
  }
  function ellipse(c, cx, cy, rx, ry, col) {
    c.fillStyle = col;
    for (var dy = -ry; dy <= ry; dy++) { var w = Math.floor(rx * Math.sqrt(1 - (dy * dy) / (ry * ry))); c.fillRect(cx - w, cy + dy, 2 * w + 1, 1); }
  }
  function herz(c, x, y, col) { r(c, x, y, 2, 2, col); r(c, x + 3, y, 2, 2, col); r(c, x, y + 1, 5, 2, col); r(c, x + 1, y + 3, 3, 1, col); r(c, x + 2, y + 4, 1, 1, col); }

  // ---------- Pixelbilder aus Zeilen (ab v0.8) ----------
  // k = Tinte, andere Buchstaben aus der Farbtabelle, Punkt = frei. Mitte bei (cx, cy).
  function muster(c, cx, cy, zeilen, farben) {
    var h = zeilen.length, w = zeilen[0].length, x0 = cx - Math.floor(w / 2), y0 = cy - Math.floor(h / 2);
    for (var y = 0; y < h; y++) {
      var z = zeilen[y], start = -1, farbe = null;
      for (var x = 0; x <= w; x++) {
        var ch = x < w ? z.charAt(x) : '.', col = ch === '.' || ch === ' ' ? null : (ch === 'k' ? P.kontur : farben[ch]);
        if (col !== farbe) { if (farbe) { c.fillStyle = farbe; c.fillRect(x0 + start, y0 + y, x - start, 1); } farbe = col; start = x; }
      }
    }
  }
  var BILD = {
    herz: [['.kk...kk.', 'kawk.kaak', 'kwaakaaak', 'kaaaaaaak', '.kaaaaak.', '..kaaak..', '...kak...', '....k....'], { a: '#ff5f8a', w: '#ffc2d3' }],
    lachen: [['..kkkkk..', '.kyyyyyk.', 'kyykykyyk', 'kyykykyyk', 'kyyyyyyyk', 'kykyyykyk', 'kyykkkyyk', '.kyyyyyk.', '..kkkkk..'], { y: '#ffd36e' }],
    frage: [['.kkkkk.', 'kpppppk', 'kpkkkpk', 'kkk.kpk', '...kppk', '..kppk.', '..kpk..', '..kkk..', '..kpk..', '..kkk..'], { p: '#9580dc' }],
    haus: [['....k....', '...krk...', '..krrrk..', '.krrrrrk.', 'krrrrrrrk', '.kwwwwwk.', '.kfwwddk.', '.kwwwddk.', '.kkkkkkk.'], { r: '#f08a6a', w: '#fff3e2', f: '#9fd4f0', d: '#c98b5e' }],
    esel: [['.kk...kk.', '.kpk.kpk.', '.kgkkkgk.', '.kgggggk.', 'kggkgkggk', 'kgggggggk', '.kbbbbbk.', '.kbkbkbk.', '..kkkkk..'], { g: '#c9c3d6', b: '#efeaf5', p: '#f4c6d6' }],
    gecko: [['......kkkk.', 'k....kggkgk', 'kgkkkgggggk', '.kgggggggk.', '..kgkkkgk..', '..kk...kk..'], { g: '#9fe3b0' }],
    huhn: [['..krk....', '.krrrk...', '.kwwwk...', 'kwkwwwk..', 'okwwwwwkk', '.kwwwwwwk', '.kwwwwwwk', '..kwwwwk.', '...o..o..'], { r: '#ff5a5a', w: '#fffaf0', o: '#ffa04d' }],
    korb: [['..kkkkkkk..', '.k.......k.', 'kkkkkkkkkkk', 'khhhhhhhhhk', 'khdhdhdhdhk', '.khhhhhhhk.', '.kdhdhdhdk.', '..kkkkkkk..'], { h: '#d9a878', d: '#a56c48' }],
    welle: [['..kk...kk..', '.kbbk.kbbk.', 'kbwbbkbwbbk', 'kbbbbbbbbbk', 'kbbbbbbbbbk', '.kkkkkkkkk.'], { b: '#7fd3ec', w: '#e8fbff' }],
    tasse: [['..w.w....', '...w.w...', 'kkkkkkk..', 'kcccccckk', 'kccccck.k', 'kccccckkk', '.kccck...', 'kkkkkkkk.'], { c: '#ff9a8a', w: '#ffffff' }],
    stern: [['....k....', '...kyk...', 'kkkyyykkk', 'kyyyyyyyk', '.kyyyyyk.', '..kyyyk..', '.kyykyyk.', '.kyk.kyk.', '.kk...kk.'], { y: '#ffd35e' }],
    sanduhr: [['kkkkkkk', '.kyyyk.', '..kyk..', '...k...', '..kwk..', '.kwywk.', 'kkkkkkk'], { y: '#ffd36e', w: '#fff8ee' }],
    schnecke: [['......kkk..', 'k.k..ksssk.', '.k..kskksk.', '.kg.kskssk.', '.kggksssk..', '.kggggggggk', '..kkkkkkkk.'], { s: '#e0a070', g: '#c9e3a4' }],
    zzz: [['kkkk.....', '..k......', '.k.......', 'kkkk.kkk.', '......k..', '.....kkk.'], {}],
    mond: [['..kkk..', '.kyyk..', 'kyyk...', 'kyyk...', 'kyyyk.k', '.kyyyyk', '..kkkk.'], { y: '#fff1c2' }],
    blume: [['..kkk..', '.kpppk.', 'kppyppk', 'kpyyypk', 'kppyppk', '.kpkpk.', '...g...', '..gg...'], { p: '#ffb3d1', y: '#ffd35e', g: '#5fbf6a' }],
    note: [['....kkkk.', '....kaaak', '....k.kak', '....k..kk', '....k....', '.kkkk....', 'kaaaak...', 'kaaaak...', '.kkkk....'], { a: '#ffb037' }],
    // ab v0.11: Sticker Gitarre, Vogel, Schmetterling
    gitarre: [['.......kk', '......kk.', '.....kk..', '..kkkk...', '.kggggk..', 'kggkkggk.', 'kggkkggk.', '.kggggk..', '..kkkk...'], { g: '#e0a060' }],
    vogel: [['...kkk...', '..kbbbk..', '.kbkbbbk.', 'ookbbbbbk', '..kbbwwbk', '..kbbbbk.', '...kkkk..', '....k.k..'], { b: '#8fb8e8', o: '#ffb037', w: '#d6e8ff' }],
    falter: [['k.......k', 'kpk...kpk', 'kppkkkppk', 'kpppkpppk', '.kppkppk.', '.kppkppk.', 'kpppkpppk', '.kkk.kkk.'], { p: '#ffb3d1' }]
  };
  var EI = [['..kkk..', '.kwcck.', 'kwcccck', 'kccccck', 'kccccdk', '.kcddk.', '..kkk..'], { c: '#fff1d6', w: '#ffffff', d: '#ecd2a8' }];
  function zeichneEi(c, x, y) { muster(c, x, y, EI[0], EI[1]); }

  // ---------- Kacheln ----------
  function istWand(t) { var T = Dorf.Karte.T; return t === T.MAUER || t === T.WAND; }
  function istMoebel(t) { var T = Dorf.Karte.T; return t === T.COUCH || t === T.KUEBEL || t === T.PFLANZE || t === T.ECKBANK || t === T.ANRICHTE || t === T.BETT || t === T.SESSEL || t === T.TISCH; }
  // Boden unter Moebeln: Kueche Fliesen, sonst Holz
  function bodenUnter(karte, x, y) { var T = Dorf.Karte.T, k = karte.raeume.kueche; if (karte.tile(x, y) === T.KUEBEL) return y >= 26 ? T.GRAS : T.PFLASTER; return (x >= k.x0 && x <= k.x1 && y >= k.y0 && y <= k.y1) ? T.FLIESE : T.BODEN; }

  // Holzzaun: Gras darunter, Pfosten an den Ecken, zwei Latten in Laufrichtung
  function zeichneZaun(c, karte, x, y, sx, sy, hs) {
    var T = Dorf.Karte.T;
    r(c, sx, sy, K, K, P.gras);
    if (hs % 3 === 0) r(c, sx + (hs % 11) + 2, sy + ((hs >> 4) % 10) + 3, 1, 2, P.gras2);
    var li = karte.tile(x - 1, y) === T.ZAUN, re = karte.tile(x + 1, y) === T.ZAUN, ob = karte.tile(x, y - 1) === T.ZAUN, un = karte.tile(x, y + 1) === T.ZAUN;
    var holz = '#d9b08c', hell = '#f0d2b4', dunkel = '#a9805f';
    if (li || re) { r(c, li ? sx : sx + 6, sy + 6, li && re ? K : 10, 2, holz); r(c, li ? sx : sx + 6, sy + 10, li && re ? K : 10, 2, holz); r(c, li ? sx : sx + 6, sy + 6, li && re ? K : 10, 1, hell); }
    if (ob || un) { r(c, sx + 6, ob ? sy : sy + 6, 2, ob && un ? K : 10, holz); r(c, sx + 9, ob ? sy : sy + 6, 2, ob && un ? K : 10, holz); r(c, sx + 6, ob ? sy : sy + 6, 1, ob && un ? K : 10, hell); }
    if (!(li && re && !ob && !un && x % 2) && !(ob && un && !li && !re && y % 2)) { rr(c, sx + 5, sy + 3, 6, 11, dunkel); r(c, sx + 6, sy + 3, 4, 2, hell); }
  }

  // Eselin Bruna: lavendelgrau, grosse Ohren, weicher Bauch
  function zeichneEsel(c, e, sx, sy, zeit) {
    var x = Math.round(sx), y = Math.round(sy), links = e.dir === 'links', f = e.frame, s = links ? -1 : 1;
    var fell = '#c9c3d6', bauch = '#efeaf5', maehne = '#7d6f8e', dunkel = '#9c93ad', K2 = P.kontur;
    var hopp = e.freude > 0 ? -Math.round(Math.abs(Math.sin(e.freude * 9)) * 2) : 0;
    y += hopp;
    ellipse(c, x, y + 1, 11, 2.5, 'rgba(75,58,90,0.18)');
    // Beine
    var b = [f === 1 ? 1 : 0, f === 3 ? 1 : 0];
    r(c, x - 7, y - 6, 2, 6 - b[0], dunkel); r(c, x - 3, y - 6, 2, 6 - b[1], fell); r(c, x + 2, y - 6, 2, 6 - b[1], dunkel); r(c, x + 6, y - 6, 2, 6 - b[0], fell);
    r(c, x - 7, y - 1 - b[0], 2, 1, K2); r(c, x - 3, y - 1 - b[1], 2, 1, K2); r(c, x + 2, y - 1 - b[1], 2, 1, K2); r(c, x + 6, y - 1 - b[0], 2, 1, K2);
    // Koerper
    rr(c, x - 9, y - 14, 18, 9, fell); r(c, x - 6, y - 7, 12, 2, bauch);
    // Schwanz
    var sw = Math.round(Math.sin(zeit * 3) * 1);
    r(c, x - s * 9 - (links ? 0 : 1), y - 13 + sw, 1, 5, maehne); r(c, x - s * 9 - (links ? 0 : 1) - (links ? -1 : 1) * 0, y - 8 + sw, 2, 2, maehne);
    // Kopf: beim Fressen tiefer
    var frisst = !e.ziel && e.freude <= 0 && e.frisst > 2.6 ? 5 : 0;
    var kx = x + s * 9, ky = y - 18 + frisst;
    rr(c, kx - 4, ky, 8, 8, fell); rr(c, kx - 3 + s * 2, ky + 4, 6, 5, bauch);
    r(c, kx - 1 + s * 4, ky + 6, 1, 1, K2);
    // Ohren (wackeln beim Streicheln)
    var wack = e.freude > 0 ? Math.round(Math.sin(e.freude * 14)) : 0;
    r(c, kx - 3, ky - 6 + wack, 2, 7, fell); r(c, kx + 1, ky - 6 - wack, 2, 7, fell);
    r(c, kx - 3, ky - 5 + wack, 1, 4, '#f4c6d6'); r(c, kx + 1, ky - 5 - wack, 1, 4, '#f4c6d6');
    r(c, kx - 3, ky - 6 + wack, 2, 1, maehne); r(c, kx + 1, ky - 6 - wack, 2, 1, maehne);
    // Maehne
    for (var m = 0; m < 4; m++) r(c, kx - s * (2 + m * 2) - (links ? 1 : 0), ky + 1 + m, 2, 2, maehne);
    // Auge und Baeckchen
    var blinz = Math.floor(zeit * 1.3) % 6 === 0 && (zeit * 1.3) % 1 < 0.15;
    if (e.freude > 0) r(c, kx + s * 1 - 1, ky + 3, 3, 1, K2); else r(c, kx + s * 1, ky + 2, 1, blinz ? 1 : 2, K2);
    r(c, kx + s * 2 - (links ? 1 : 0), ky + 5, 2, 1, '#ffb3c8');
    // Karotte im Maul, wird beim Mampfen kuerzer
    if (e.mampft > 0) {
      var MA = (Dorf.Tiere && Dorf.Tiere.MAMPFEN) || 2.5, len = Math.max(1, Math.ceil(e.mampft / MA * 5)), kau = Math.floor(zeit * 8) % 2;
      var mx = links ? kx - 5 - len : kx + 5;
      r(c, mx - 1, ky + 5 + kau, len + 2, 3, K2); r(c, mx, ky + 6 + kau, len, 1, '#ffa04d');
      r(c, links ? mx - 2 : mx + len + 1, ky + 4 + kau, 2, 1, '#5fbf6a');
      if (kau) r(c, kx + s * 3, ky + 9, 1, 1, '#ffa04d');
    }
  }

  // Kleiner Gecko: minzgruen, sitzt flach an der Wand
  function zeichneGecko(c, g, sx, sy, zeit) {
    var x = Math.round(sx), y = Math.round(sy), s = g.dir === 'links' ? -1 : 1, f = g.frame % 2;
    var haut = '#9fe3b0', rand = '#4f9a6a', fleck = '#e8fbd9';
    function teil(px, py, w, h, col) { r(c, s > 0 ? x + px : x - px - w, y + py, w, h, col); }
    // Umriss zuerst, dann die Haut: so sieht man ihn auch auf heller Wand
    teil(-5, -2, 10, 5, rand); teil(4, -3, 5, 5, rand); teil(-10, -1, 6, 3, rand);
    teil(-3, -4 - f, 2, 3, rand); teil(2, -4 + f, 2, 3, rand); teil(-3, 2 + f, 2, 3, rand); teil(2, 2 - f, 2, 3, rand);
    teil(-4, -1, 8, 3, haut); teil(5, -2, 3, 3, haut); teil(-9, 0, 5, 1, haut);
    teil(-1, 0, 1, 1, fleck); teil(1, -1, 1, 1, fleck); teil(-3, 0, 1, 1, fleck);
    teil(6, -2, 1, 1, P.kontur);
    if (Math.sin(zeit * 4) > 0.8) teil(-11, 1, 2, 1, haut);
    if (g.freude > 0) herz(c, x - 2, y - 10 - Math.round((1.6 - g.freude) * 3), '#ff9fbf');
  }

  // ab v0.8: Huhn, weiss oder braun, pickt nach Koernern
  function zeichneHuhn(c, h, sx, sy, zeit) {
    var x = Math.round(sx), y = Math.round(sy), s = h.dir === 'links' ? -1 : 1, braun = h.feder === 'braun';
    var feder = braun ? '#e0a874' : '#fffaf0', dunkel = braun ? '#b9804e' : '#e2d8c6';
    if (h.freude > 0) y -= Math.round(Math.abs(Math.sin(h.freude * 9)) * 2);
    ellipse(c, Math.round(sx), Math.round(sy) + 1, 5, 1, 'rgba(75,58,90,0.18)');
    var bein = h.frame % 2;
    r(c, x - 2, y - 3, 1, 3 - bein, '#ff9a3d'); r(c, x + 1, y - 3, 1, 3 - (1 - bein), '#ff9a3d');
    // Schwanz hinten, Koerper, Fluegel
    r(c, x - s * 6 - (s > 0 ? 1 : 0), y - 12, 3, 5, P.kontur); r(c, x - s * 6 - (s > 0 ? 0 : -1), y - 11, 1, 3, dunkel);
    ellipse(c, x, y - 6, 5, 4, P.kontur); ellipse(c, x, y - 6, 4, 3, feder);
    r(c, x - s * 2 - 1, y - 7, 3, 2, dunkel);
    var pick = h.pickt > 0 && Math.floor(zeit * 5) % 2 === 0 ? 4 : 0;
    var kx = x + s * 4, ky = y - 11 + pick;
    kreis(c, kx, ky, 3, P.kontur); kreis(c, kx, ky, 2, feder);
    r(c, kx - 1, ky - 4, 3, 2, '#ff5a5a'); r(c, kx, ky - 5, 1, 1, '#ff5a5a');
    r(c, s > 0 ? kx + 3 : kx - 4, ky, 2, 1, '#ffa04d');
    r(c, kx + s, ky - 1, 1, 1, P.kontur);
    r(c, kx + (s > 0 ? 1 : -2), ky + 2, 2, 1, '#ff7a7a');
  }

  // ab v0.20: kleines Pastell-Ruderboot (dicke Kontur)
  // ab v0.21: Boot etwas groesser
  function zeichneBoot(c, b, sx, sy, zeit, besetzt) {
    var bob = Math.round(Math.sin((b.phase || 0) * 2.4 + zeit) * (besetzt ? 1.2 : 0.8));
    var x = Math.round(sx), y = Math.round(sy) + bob;
    var links = b.dir === 'links';
    c.save();
    if (links) { c.translate(x, y); c.scale(-1, 1); x = 0; y = 0; }
    ellipse(c, x, y + 4, 14, 4, 'rgba(74,52,120,0.18)');
    // Rumpf (breiter/hoeher)
    rr(c, x - 14, y - 5, 28, 10, P.kontur);
    rr(c, x - 13, y - 4, 26, 8, '#f0b27a');
    r(c, x - 11, y - 1, 22, 3, '#e09a5c');
    // Bordkante hell
    r(c, x - 12, y - 4, 24, 2, '#ffe0b8');
    // Bug-Spitze leicht gerundet (Pixel)
    r(c, x + 12, y - 2, 2, 4, '#f0b27a');
    // Mast + Wimpel
    r(c, x + 1, y - 18, 2, 14, P.kontur); r(c, x + 2, y - 17, 1, 12, '#d9c2a0');
    r(c, x + 3, y - 17, 7, 4, P.kontur); r(c, x + 3, y - 16, 6, 2, '#ff9fb0');
    // Sitzbank
    r(c, x - 6, y - 2, 10, 2, '#c98b5e');
    c.restore();
    return bob;
  }
  // ab v0.21: aufblasbarer Flamingo (Pastell, klarere Form, Shine)
  function zeichneFlamingo(c, f, sx, sy, zeit, besetzt) {
    var bob = Math.round(Math.sin((f.phase || 0) * 2.2 + zeit) * 1.5);
    var x = Math.round(sx), y = Math.round(sy) + bob;
    var rosa = '#ff9fb8', rosa2 = '#ffc4d8', rosa3 = '#ff7fa6', hell = '#ffe6ef';
    ellipse(c, x, y + 5, 13, 4, 'rgba(74,52,120,0.16)');
    // Aufblas-Ring (dicker, mit Innenloch)
    kreis(c, x, y, 12, P.kontur);
    kreis(c, x, y, 11, rosa);
    kreis(c, x, y, 8, rosa2);
    kreis(c, x, y, 5, hell);
    kreis(c, x, y, 3, '#fffafc');
    // Glanzstreifen (aufblasbar)
    r(c, x - 7, y - 6, 3, 1, '#ffffff');
    r(c, x - 8, y - 4, 2, 1, '#ffffff');
    // Ventil hinten links (kleiner Nupsi)
    r(c, x - 12, y - 1, 2, 2, P.kontur); r(c, x - 11, y, 1, 1, rosa3);
    // Fluegel-Buckel
    rr(c, x - 9, y - 3, 6, 4, P.kontur); rr(c, x - 8, y - 2, 4, 2, rosa3);
    // S-Hals (gestuft)
    r(c, x + 7, y - 6, 3, 5, P.kontur); r(c, x + 8, y - 5, 1, 3, rosa);
    r(c, x + 6, y - 11, 4, 5, P.kontur); r(c, x + 7, y - 10, 2, 3, rosa2);
    // Kopf
    rr(c, x + 5, y - 15, 7, 5, P.kontur); rr(c, x + 6, y - 14, 5, 3, rosa3);
    // Auge mit Huebchen
    r(c, x + 8, y - 13, 2, 2, '#ffffff'); r(c, x + 9, y - 12, 1, 1, P.kontur);
    // Schnabel (geknickt, pastell-gelb)
    r(c, x + 12, y - 13, 3, 2, P.kontur); r(c, x + 12, y - 12, 2, 1, '#ffd27a');
    r(c, x + 14, y - 12, 2, 2, P.kontur); r(c, x + 14, y - 11, 1, 1, '#ffb070');
    if (besetzt) {
      if (Math.floor(zeit * 3) % 2 === 0) { r(c, x - 2, y - 6, 1, 1, '#fff8ee'); r(c, x + 3, y - 4, 1, 1, '#fff8ee'); }
    }
    return bob;
  }

  // ab v0.19: kleiner Pixel-Fisch (Pastell, dicke Kontur)
  function zeichneFisch(c, f, sx, sy, zeit) {
    var bob = Math.round(Math.sin((f.phase || 0) + zeit) * 1.2);
    var x = Math.round(sx), y = Math.round(sy) + bob, links = f.dir < 0;
    var farbe = f.farbe || '#7ec8e3';
    c.save();
    if (links) { c.translate(x, y); c.scale(-1, 1); x = 0; y = 0; }
    // Koerper
    rr(c, x - 5, y - 3, 9, 6, P.kontur);
    rr(c, x - 4, y - 2, 7, 4, farbe);
    r(c, x - 3, y - 1, 2, 1, '#ffffff');
    // Schwanz
    r(c, x + 4, y - 3, 1, 1, P.kontur); r(c, x + 5, y - 2, 1, 3, P.kontur); r(c, x + 4, y + 1, 1, 1, P.kontur);
    r(c, x + 4, y - 2, 1, 3, farbe);
    // Auge
    r(c, x - 2, y - 1, 1, 1, P.kontur);
    // Flosse wackelt
    var flop = Math.sin((f.phase || 0) * 3) > 0 ? -1 : 1;
    r(c, x, y - 4 + flop, 2, 1, P.kontur); r(c, x, y - 3 + flop, 2, 1, farbe);
    c.restore();
    if (f.blub > 0) {
      var a = Math.min(1, f.blub * 1.4), bx = Math.round(sx + (links ? -4 : 4)), by = Math.round(sy - 6 - (0.9 - f.blub) * 10);
      kreis(c, bx, by, 2, 'rgba(255,255,255,' + (0.7 * a).toFixed(2) + ')');
      kreis(c, bx + 3, by - 3, 1, 'rgba(232,251,255,' + (0.8 * a).toFixed(2) + ')');
      if (f.blub > 0.35) herz(c, Math.round(sx), Math.round(sy - 12 - (0.9 - f.blub) * 6), '#ff7fa0');
    }
  }

  function zeichneEiBoden(c, e, sx, sy, zeit) {
    var auf = e.neu > 0 ? Math.round(Math.sin((0.6 - e.neu) / 0.6 * Math.PI) * 4) : 0;
    ellipse(c, Math.round(sx), Math.round(sy) + 1, 3, 1, 'rgba(75,58,90,0.18)');
    zeichneEi(c, Math.round(sx), Math.round(sy) - 3 - auf);
    glitzer(c, Math.round(sx) + 3, Math.round(sy) - 7, zeit, (e.id || 0) * 0.7);
  }
  // kleiner Huehnerstall aus Holz mit rotem Dach und Leiter
  function zeichneStall(c, sx, sy) {
    ellipse(c, sx + 16, sy + 15, 14, 2, P.schatten);
    rr(c, sx + 2, sy + 1, 28, 14, P.konturHolz); rr(c, sx + 3, sy + 2, 26, 12, P.holz);
    for (var i = 0; i < 4; i++) r(c, sx + 4, sy + 4 + i * 3, 24, 1, P.holz2);
    for (var d = 0; d < 7; d++) { r(c, sx + 1 + d * 2 - 1, sy + 1 - d, 34 - d * 4 + 2, 1, P.konturDach); r(c, sx + 2 + d * 2, sy + 1 - d, 32 - d * 4 - 2, 1, d % 2 ? P.dach : P.dach2); }
    rr(c, sx + 12, sy + 6, 8, 9, P.konturTief); r(c, sx + 13, sy + 7, 6, 8, '#5a4370');
    for (var l = 0; l < 3; l++) r(c, sx + 13, sy + 15 - l, 6, 1, l % 2 ? P.holz2 : P.holz);
    rr(c, sx + 5, sy + 5, 5, 4, P.konturHolz); r(c, sx + 6, sy + 6, 3, 2, P.fenster);
  }
  // Huepfer einer Figur: Herz bekommen (3 px) oder gerade angefangen zu sprechen (2 px)
  function huepfer(st, name, herzHop) {
    var h = 0;
    if (RUHIG) return 0;
    if (herzHop > 0) h = Math.max(h, Math.sin((1 - herzHop / 0.25) * Math.PI) * 3);
    var b = st.blase;
    if (b && b.sprecher === name && !st.menue && (b.t || 0) < 0.3) h = Math.max(h, Math.sin((b.t || 0) / 0.3 * Math.PI) * 2);
    return Math.round(h);
  }
  function sprecherPos(st, name) {
    if (name === 'Biel') return { x: st.spieler.x, y: st.spieler.y, a: BIEL, off: 0 };
    for (var i = 0; i < st.gaeste.length; i++) {
      var g = st.gaeste[i];
      if (g.name === name) return { x: g.x, y: g.y, a: g.aussehen, off: Dorf.Gaeste.sitzt(g) ? 14 : 0 };
    }
    return null;
  }
  // Bilderblase: weisse Blase mit Rand und Spitze, 1 bis 3 Bilder, ploppt auf (0.6, 1.05, 1 in 220 ms)
  function zeichneSprechblase(c, st, cx, cy) {
    var b = st.blase, wer = sprecherPos(st, b.sprecher);
    if (!wer) return null;
    var bilder = (b.bilder && b.bilder.length ? b.bilder : ['lachen']).slice(0, 3);
    var m = masse(wer.a);
    var kx = Math.round(wer.x - cx), ky = Math.round(wer.y - wer.off - cy - m.hoehe - 2);
    var bw = bilder.length * 13 + 7, bh = 17;
    // oben links liegen die Gesichter, oben rechts Hilfe und Knoepfe: dort darf die Blase nicht hin
    var hudRechts = (60 + st.gaeste.length * 36 - 14) / ZM;
    function oben(x) { return x < hudRechts ? 30 / ZM : 12 / ZM; }
    var bx = Math.max(2, Math.min(W - bw - 2, Math.round(kx - bw / 2))), by = ky - bh - 5, seite = 0;
    if (by < oben(bx)) {
      // kein Platz ueber dem Kopf: neben den Kopf, auf die Seite mit mehr Platz
      seite = kx + 9 + bw <= W - 2 ? 1 : -1;
      bx = seite > 0 ? kx + 9 : kx - 9 - bw;
      bx = Math.max(2, Math.min(W - bw - 2, bx));
      by = Math.max(oben(bx), ky - 2);
    }
    by = Math.min(H - bh - Math.round(26 / ZM), by);
    var kopfY = ky + Math.round(m.kopf / 2) + 2;
    var t = b.t || 0, sk;
    if (t < 0.15) sk = 0.6 + (1.05 - 0.6) * (t / 0.15);
    else if (t < 0.22) sk = 1.05 - 0.05 * ((t - 0.15) / 0.07);
    else sk = 1;
    var alpha = b.rest != null && b.rest < 0.25 ? Math.max(0, b.rest / 0.25) : 1;
    var mx = bx + bw / 2, my = by + bh / 2;
    c.save(); c.globalAlpha = alpha;
    c.translate(mx, my); c.scale(sk, sk); c.translate(-mx, -my);
    rr(c, bx - 1, by - 1, bw + 2, bh + 2, P.kontur); rr(c, bx, by, bw, bh, '#fffdf8');
    var sx = Math.max(bx + 4, Math.min(bx + bw - 6, kx - 1));
    if (seite === 0) { r(c, sx - 1, by + bh, 5, 1, '#fffdf8'); r(c, sx, by + bh + 1, 3, 1, '#fffdf8'); r(c, sx + 1, by + bh + 2, 1, 1, '#fffdf8');
      r(c, sx - 2, by + bh, 1, 1, P.kontur); r(c, sx + 4, by + bh, 1, 1, P.kontur); r(c, sx - 1, by + bh + 1, 1, 1, P.kontur); r(c, sx + 3, by + bh + 1, 1, 1, P.kontur); r(c, sx, by + bh + 2, 1, 1, P.kontur); r(c, sx + 2, by + bh + 2, 1, 1, P.kontur); r(c, sx + 1, by + bh + 3, 1, 1, P.kontur); }
    else { var tx = seite > 0 ? bx - 1 : bx + bw, d = seite > 0 ? -1 : 1, ty = Math.max(by + 3, Math.min(by + bh - 7, kopfY - 2));
      r(c, tx, ty, 1, 4, '#fffdf8'); r(c, tx + d, ty + 1, 1, 2, '#fffdf8'); r(c, tx + d, ty, 1, 1, P.kontur); r(c, tx + d, ty + 3, 1, 1, P.kontur); r(c, tx + 2 * d, ty + 1, 1, 2, P.kontur); }
    bilder.forEach(function (bi, i) { zeichneSymbol(c, bi, bx + 10 + i * 13, by + bh / 2); });
    c.restore();
    return { x: bx, y: by, w: bw, h: bh, bilder: bilder, sprecher: b.sprecher, skala: sk, seite: seite };
  }
  // aufsteigende Herzchen
  function zeichneHerzchen(c, st, cx, cy) {
    (st.herzchen || []).forEach(function (h) {
      if (h.t < 0) return;
      if (h.klein) {
        if (h.t > 0.9) return;
        c.globalAlpha = h.t < 0.6 ? 1 : Math.max(0, 1 - (h.t - 0.6) / 0.3);
        herz(c, Math.round(h.x - cx) - 2 + Math.round(Math.sin(h.t * 7) * 3), Math.round(h.y - cy - h.t / 0.9 * 18), h.farbe || '#ff7fa0');
        c.globalAlpha = 1; return;
      }
      var a = Math.max(0, 1 - h.t / 1.4), dx = Math.round(Math.sin(h.t * 6) * 2);
      c.globalAlpha = a;
      if (h.bild) zeichneZutat(c, h.bild, Math.round(h.x - cx), Math.round(h.y - cy - h.t * 12));
      else herz(c, Math.round(h.x - cx) - 2 + dx, Math.round(h.y - cy - h.t * 14), h.farbe || '#ff7fa0');
      c.globalAlpha = 1;
    });
  }

  // ---------- Garten (ab v0.5) ----------
  // kleines Bild einer Zutat, Mitte bei (x, y)
  function zeichneZutat(c, art, x, y, blass) {
    if (blass) c.globalAlpha = (c.globalAlpha || 1) * 0.4;
    if (art === 'tomate') { kreis(c, x, y, 3, P.kontur); kreis(c, x, y, 2, '#ff6f61'); r(c, x - 1, y - 1, 1, 1, '#ffc2b8'); r(c, x - 1, y - 3, 3, 1, '#5fbf6a'); }
    else if (art === 'karotte') { r(c, x - 2, y - 2, 5, 3, P.kontur); r(c, x - 1, y + 1, 3, 2, P.kontur); r(c, x, y + 3, 1, 1, P.kontur); r(c, x - 1, y - 1, 3, 2, '#ffa04d'); r(c, x, y + 1, 1, 2, '#ffa04d'); r(c, x - 2, y - 4, 1, 2, '#5fbf6a'); r(c, x, y - 5, 1, 3, '#5fbf6a'); r(c, x + 2, y - 4, 1, 2, '#5fbf6a'); }
    else if (art === 'ei') zeichneEi(c, x, y);
    else if (art === 'orange') { kreis(c, x, y, 3, P.kontur); kreis(c, x, y, 2, '#ffb037'); r(c, x - 1, y - 1, 1, 1, '#ffe0a0'); r(c, x, y - 4, 2, 1, '#5fbf6a'); }
    else if (art === 'zitrone') { kreis(c, x, y, 3, P.konturGruen); kreis(c, x, y, 2, P.zitrone1); r(c, x - 1, y - 1, 1, 1, '#fff6a8'); r(c, x, y - 4, 2, 1, P.zitroneBlatt); }
    else { rr(c, x - 2, y - 3, 5, 6, P.kontur); rr(c, x - 1, y - 2, 3, 4, '#9a7cc4'); r(c, x - 1, y - 2, 1, 1, '#e0d2f5'); r(c, x + 1, y - 4, 2, 1, '#5fbf6a'); }
    if (blass) c.globalAlpha = 1;
  }
  // ab v0.8: Korb unten links. Die Zutaten liegen sichtbar darin (bis 4 je Sorte, dann ein kleines Plus), keine Ziffern
  var KORB = { x: 3, y: H - 4, spalte: 9 };
  function korbSpalte(i) { return { x: KORB.x + 7 + i * KORB.spalte, y: KORB.y - 9 }; }
  function korbZiel(art) {
    var Z = (Dorf.Garten && Dorf.Garten.ZUTATEN) || ['tomate', 'karotte', 'orange', 'zitrone', 'olive', 'ei'], i = Math.max(0, Z.indexOf(art));
    return korbSpalte(i);
  }
  function imFlug(liste, schluessel, wert) { var n = 0; (liste || []).forEach(function (f) { if (f[schluessel] === wert) n++; }); return n; }
  function zeichneVorrat(R, st) {
    var c = R.ctx, v = st.vorrat;
    if (!v || !Dorf.Garten) return null;
    var Z = Dorf.Garten.ZUTATEN || Dorf.Garten.REIHE, bx = KORB.x, by = KORB.y, w = 8 + Z.length * KORB.spalte, info = {}, plus = {};
    // Henkel und Rueckwand
    c.fillStyle = P.konturHolz; c.fillRect(bx + 6, by - 24, w - 12, 2); c.fillRect(bx + 5, by - 23, 2, 10); c.fillRect(bx + w - 7, by - 23, 2, 10);
    r(c, bx + 7, by - 23, w - 14, 1, '#e8c49a');
    pille(c, bx, by - 14, w, 5, '#b98463');
    Z.forEach(function (a, i) {
      var n = Math.max(0, (v[a] || 0) - imFlug(st.flieger, 'art', a)), sp = korbSpalte(i), puls = (st.korbPuls && st.korbPuls[a]) || 0;
      var hop = puls > 0 ? Math.round(Math.sin((0.45 - puls) / 0.45 * Math.PI) * 3) : 0, zeig = Math.min(4, n);
      info[a] = zeig; plus[a] = n > 4;
      if (puls > 0) { c.globalAlpha = Math.min(1, puls * 3); kreis(c, sp.x, sp.y - 4 - hop, 5, '#fff3a8'); c.globalAlpha = 1; }
      for (var k = 0; k < zeig; k++) zeichneZutat(c, a, sp.x + (k % 2 ? 1 : 0), sp.y - k * 4 - hop);
      if (n > 4) { var px = sp.x, py = sp.y - 19 - hop; r(c, px - 2, py - 1, 5, 3, P.kontur); r(c, px - 1, py - 2, 3, 5, P.kontur); r(c, px - 1, py, 3, 1, '#ffffff'); r(c, px, py - 1, 1, 3, '#ffffff'); }
    });
    // Vorderseite geflochten, verdeckt die untere Haelfte der Zutaten
    pille(c, bx, by - 10, w, 11, P.holz);
    for (var x = bx + 3; x < bx + w - 3; x += 4) { r(c, x, by - 8, 2, 1, P.holz2); r(c, x + 2, by - 5, 2, 1, P.holz2); r(c, x, by - 2, 2, 1, P.holz2); }
    r(c, bx + 2, by - 9, w - 4, 1, '#e8c49a');
    return { gezeigt: info, plus: plus, x: bx, y: by - 24, w: w, h: 25 };
  }
  function glitzer(c, x, y, zeit, phase) {
    if (RUHIG) return;
    var t = (zeit * 0.8 + phase) % 3;
    if (t > 0.5) return;
    var a = t < 0.25 ? t * 4 : (0.5 - t) * 4;
    c.globalAlpha = a; r(c, x, y - 1, 1, 3, '#ffffff'); r(c, x - 1, y, 3, 1, '#ffffff'); c.globalAlpha = 1;
  }
  // Pflanze im Beet: reif mit Fruechten, sonst kleine gruene Knospe die langsam waechst
  function zeichnePflanze(c, p, sx, sy, zeit) {
    var x = sx + 8, y = sy + 13, w = p.reif ? 1 : p.wachs, ph = (p.x * 7 + p.y * 3) % 10 / 3;
    ellipse(c, x, y + 1, 5, 1, 'rgba(75,58,90,0.18)');
    if (p.art === 'tomate') {
      var hoch = 6 + Math.round(w * 4);
      r(c, x, y - hoch - 2, 1, hoch + 2, '#b3805b');
      rr(c, x - 4, y - hoch + 1, 4, 3, '#5fbf6a'); rr(c, x + 1, y - hoch - 1, 4, 3, '#4fae5c'); rr(c, x - 3, y - 4, 7, 4, '#6ccc72');
      if (p.reif) { zeichneZutat(c, 'tomate', x - 3, y - hoch + 4); zeichneZutat(c, 'tomate', x + 3, y - hoch + 2); glitzer(c, x + 4, y - hoch, zeit, ph); }
      else if (w > 0.4) { kreis(c, x - 3, y - hoch + 4, 1, '#a8e07a'); kreis(c, x + 3, y - hoch + 2, 1, '#a8e07a'); }
    } else {
      var lb = 2 + Math.round(w * 3);
      r(c, x - 3, y - lb - 1, 1, lb, '#5fbf6a'); r(c, x - 1, y - lb - 3, 2, lb + 2, '#6ccc72'); r(c, x + 2, y - lb - 1, 1, lb, '#5fbf6a');
      if (p.reif) { r(c, x - 2, y - 2, 5, 3, P.kontur); r(c, x - 1, y - 1, 3, 2, '#ffa04d'); glitzer(c, x + 4, y - 5, zeit, ph); }
    }
  }
  // Fruechte am Baum (Orangen, Zitronen oder Oliven)
  function zeichneBaumFruechte(c, p, sx, sy, zeit) {
    var cx = sx + 8, by = sy + 14, ph = (p.x * 5 + p.y) % 10 / 3;
    if (!p.reif) return;
    var pos = [[-5, -14], [4, -18], [0, -24]];
    pos.forEach(function (q) { zeichneZutat(c, p.art, cx + q[0], by + q[1]); });
    glitzer(c, cx + 7, by - 22, zeit, ph);
  }

  // Pflanze wackelt kurz nach dem Ernten (oder wenn sie noch waechst)
  function wackeln(p) { return p.wackel > 0 ? Math.round(Math.sin(p.wackel * 40) * Math.min(2, p.wackel * 6)) : 0; }

  // ---------- Bilder statt Worte (ab v0.6) ----------
  // kleines Symbol, Mitte bei (x, y): Sprechblase, Topf, Sonne, Spross oder eine Zutat
  function zeichneSymbol(c, art, x, y) {
    if (art === 'reden') { rr(c, x - 5, y - 4, 11, 8, P.kontur); rr(c, x - 4, y - 3, 9, 6, '#ffffff'); r(c, x - 3, y + 4, 2, 2, P.kontur); r(c, x - 2, y - 1, 1, 1, P.kontur); r(c, x, y - 1, 1, 1, P.kontur); r(c, x + 2, y - 1, 1, 1, P.kontur); }
    else if (art === 'topf') { rr(c, x - 5, y - 2, 11, 7, P.kontur); rr(c, x - 4, y - 1, 9, 5, '#ff9a8a'); r(c, x - 6, y - 1, 13, 2, P.kontur); r(c, x - 4, y, 9, 1, '#ffd0c4'); r(c, x - 2, y - 5, 1, 2, '#ffffff'); r(c, x + 1, y - 6, 1, 3, '#ffffff'); }
    else if (art === 'sonne') { kreis(c, x, y, 4, P.kontur); kreis(c, x, y, 3, '#ffd36e'); r(c, x - 1, y - 7, 2, 2, '#ffb340'); r(c, x - 1, y + 6, 2, 2, '#ffb340'); r(c, x - 7, y - 1, 2, 2, '#ffb340'); r(c, x + 6, y - 1, 2, 2, '#ffb340'); r(c, x - 5, y - 5, 2, 2, '#ffb340'); r(c, x + 4, y - 5, 2, 2, '#ffb340'); r(c, x - 5, y + 4, 2, 2, '#ffb340'); r(c, x + 4, y + 4, 2, 2, '#ffb340'); }
    else if (art === 'spross') { r(c, x, y - 2, 1, 6, '#4fae5c'); rr(c, x - 4, y - 4, 4, 3, '#6ccc72'); rr(c, x + 1, y - 5, 4, 3, '#5fbf6a'); r(c, x - 3, y + 3, 7, 2, '#b3805b'); }
    else if (art === 'teller') zeichneTeller(c, 'paamboli', x, y);
    else if (art && art.indexOf('gericht:') === 0) zeichneTeller(c, art.slice(8), x, y);
    else if (BILD[art]) muster(c, x, y, BILD[art][0], BILD[art][1]);
    else if (art === 'ball') { kreis(c, x, y, 4, P.kontur); kreis(c, x, y, 3, '#ff8a8a'); r(c, x - 3, y, 7, 1, '#ffffff'); r(c, x - 1, y - 2, 1, 1, '#ffffff'); }
    else if (art === 'kissen') { pille(c, x - 5, y - 3, 11, 7, P.kissen); r(c, x - 2, y - 1, 2, 1, '#ffe0ea'); }
    else zeichneZutat(c, art, x, y);
  }
  var SYMBOLE_EXTRA = ['reden', 'topf', 'sonne', 'spross', 'teller', 'ball', 'kissen', 'tomate', 'karotte', 'orange', 'zitrone', 'olive', 'ei'];
  function kenntSymbol(art) { return !!art && (SYMBOLE_EXTRA.indexOf(art) >= 0 || !!BILD[art] || (art.indexOf('gericht:') === 0 && !!(Dorf.Gerichte && Dorf.Gerichte.hole(art.slice(8))))); }
  // dicker Zeigepfeil nach unten, Spitze bei (x, y): verstehen auch Kinder, die noch nicht lesen
  function zeichneHand(c, x, y) {
    r(c, x - 3, y - 15, 7, 9, P.kontur); r(c, x - 7, y - 7, 15, 2, P.kontur);
    for (var i = 0; i < 6; i++) r(c, x - 6 + i, y - 6 + i, 13 - i * 2, 1, P.kontur);
    r(c, x - 2, y - 14, 5, 8, '#ff7fa0'); r(c, x - 5, y - 6, 11, 1, '#ff7fa0');
    for (var k = 0; k < 4; k++) r(c, x - 4 + k, y - 5 + k, 9 - k * 2, 1, '#ff7fa0');
    r(c, x - 1, y - 13, 1, 5, '#ffc6d8');
  }
  // Ring am Boden unter dem Ziel (Fuesse, Pflanze, Esel, Herd), wird vor den Figuren gemalt
  function zeichneHinweisRing(c, st, cx, cy) {
    var h = st.hinweis;
    if (!h || !h.ziel || !(h.alpha > 0) || h.ziel.bildschirm) return;
    var z = h.ziel, wx = z.x, wy = z.y, t = h.t, ring = RUHIG ? 6 : 5 + Math.round((Math.sin(t * 5) + 1) * 1.5);
    var fx = wx, fy = wy + 3;
    if (z.gast) { fx = z.gast.x; fy = z.gast.y - (Dorf.Gaeste.sitzt(z.gast) ? 12 : 0) + 1; }
    else if (z.pflanze && Dorf.Garten.punkt) { var gp = Dorf.Garten.punkt(z.pflanze); fx = gp.x; fy = gp.y + 2; }
    else if (z.art === 'fuettern' && st.tiere && st.tiere.esel) { fx = st.tiere.esel.x; fy = st.tiere.esel.y + 1; }
    else if (z.art === 'kochen') fy = wy + 14;
    else if (z.ei) { fx = z.ei.x; fy = z.ei.y + 1; }
    var rx = Math.round(fx - cx), ry = Math.round(fy - cy);
    c.globalAlpha = h.alpha;
    ellipse(c, rx, ry, ring + 2, 3, P.kontur); ellipse(c, rx, ry, ring + 1, 2, '#fff3a8');
    c.globalAlpha = 1;
  }
  // ab v0.10: y0 44 statt 38, damit die Plakette nicht an den Herzen oben klebt
  var RAND = { r: 11, x0: 22, y0: 44, hz: 0.9 };
  // Der Hinweis: huepfende Hand, Ring am Ziel und ein Bild, was dort passiert
  function zeichneHinweis(c, st, cx, cy, R) {
    var h = st.hinweis;
    if (R) R.letzterRand = null;
    if (!h || !h.ziel || !(h.alpha > 0)) return;
    var z = h.ziel, wx = z.x, wy = z.y;
    if (z.art === 'weiter') return;   // am Abend pulsiert stattdessen die Sonne (siehe Abendszene)
    if (z.gast) { wx = z.gast.x; wy = z.gast.y - (Dorf.Gaeste.sitzt(z.gast) ? 14 : 0) - 28; }
    if (z.art === 'fuettern' && st.tiere && st.tiere.esel) { wx = st.tiere.esel.x; wy = st.tiere.esel.y - 30; }
    var sx = Math.round(z.bildschirm ? wx : (wx - cx) * ZM), sy = Math.round(z.bildschirm ? wy : (wy - cy) * ZM), t = h.t;
    c.globalAlpha = h.alpha;
    var drinnen = sx >= 12 && sx <= W - 12 && sy >= 26 && sy <= H - 6;
    if (!drinnen) {
      // ab v0.9: Plakette am Bildrand mit Bild und spitzem Zeiger in die Richtung, wippt sanft.
      // Sie weicht dem Korb unten links und dem Aktionsknopf unten rechts (Touch) aus.
      var kx = Math.max(RAND.x0, Math.min(W - RAND.x0, sx)), ky = Math.max(RAND.y0, Math.min(H - RAND.x0, sy));
      if (kx < 62 && ky > H - 34) { if (sy > H) kx = 74; else ky = H - 34; }
      if (R && R.touch && kx > W - 40 && ky > H - 40) { if (sy > H) kx = W - 52; else ky = H - 42; }
      var dx = sx - kx, dy = sy - ky, d = Math.hypot(dx, dy) || 1;
      if (!RUHIG) ky += Math.round(Math.sin(t * Math.PI * 2 * RAND.hz) * 2);
      for (var j = 0; j < 3; j++) {
        var pd = RAND.r + 1 + j * 3, pr = 3 - j, px = Math.round(kx + dx / d * pd), py = Math.round(ky + dy / d * pd);
        kreis(c, px, py, pr + 1, P.kontur); kreis(c, px, py, pr, '#ff9fb8');
      }
      kreis(c, kx, ky, RAND.r + 1, P.kontur); kreis(c, kx, ky, RAND.r, '#fff4dc'); kreis(c, kx, ky, RAND.r - 2, '#ffe9f0');
      zeichneSymbol(c, z.bild || 'reden', kx, ky);
      if (R) R.letzterRand = { x: kx, y: ky, bild: z.bild || 'reden' };
      c.globalAlpha = 1; return;
    }
    var hop = RUHIG ? 0 : Math.round(Math.abs(Math.sin(t * 4.5)) * 4);
    zeichneHand(c, sx, sy - 2 - hop);
    if (z.bild) {
      var bx = sx + 13, by = sy - 16 - hop;
      kreis(c, bx, by, 8, P.kontur); kreis(c, bx, by, 7, '#ffffff');
      zeichneSymbol(c, z.bild, bx, by);
    }
    c.globalAlpha = 1;
  }
  // Gedankenblase ueber Biel: was fehlt (Zutaten), was noch waechst (Spross), was als Naechstes kommt (Topf)
  function zeichneDenken(c, st, cx, cy) {
    var d = st.denk; if (!d || !d.bilder.length) return;
    var sp = st.spieler, n = d.bilder.length, w = 8 + n * 11, x = Math.round(sp.x - cx), y = Math.round(sp.y - cy) - 44;
    var auf = Math.min(1, d.t * 5), weg = Math.min(1, d.rest * 2);
    c.globalAlpha = Math.min(auf, weg);
    var bx = Math.max(2, Math.min(W - w - 2, x + 2)), seitlich = y - 9 < 42 / ZM && bx < 78 / ZM;
    if (seitlich) { bx = Math.max(Math.round(78 / ZM), x + 14); y += 14; }   // nicht unter Ziel und Korb oben links, dann neben den Kopf
    if (seitlich) { kreis(c, x + 9, y + 8, 2, P.kontur); kreis(c, x + 9, y + 8, 1, P.box); kreis(c, x + 14, y + 3, 3, P.kontur); kreis(c, x + 14, y + 3, 2, P.box); }
    else { kreis(c, x + 3, y + 18, 2, P.kontur); kreis(c, x + 3, y + 18, 1, P.box); kreis(c, x + 6, y + 13, 3, P.kontur); kreis(c, x + 6, y + 13, 2, P.box); }
    pille(c, bx, y - 9, w, 16, P.box);
    d.bilder.forEach(function (b, i) {
      var hop = RUHIG ? 0 : Math.round(Math.abs(Math.sin(d.t * 4 + i)) * 1);
      zeichneSymbol(c, b, bx + 9 + i * 11, y - 1 - hop);
    });
    c.globalAlpha = 1;
  }
  // Ernte im Flug: Frucht hopst im Bogen zu Biel
  function sanft(p) { return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; }
  // ab v0.8: die Ernte fliegt in hohem Bogen in den Korb unten links
  function zeichneFlieger(c, st, cx, cy) {
    (st.flieger || []).forEach(function (f) {
      if (f.t < 0) return;
      var p = Math.min(1, f.t / f.dauer), e = sanft(p), z0 = korbZiel(f.art), z = { x: z0.x / ZM, y: z0.y / ZM };
      var x0 = f.x - cx, y0 = f.y - cy, x = x0 + (z.x - x0) * e, y = y0 + (z.y - 8 - y0) * e - Math.sin(p * Math.PI) * 22;
      zeichneZutat(c, f.art, Math.round(x), Math.round(y));
    });
  }
  // ab v0.8: Herz fliegt auf einer Kurve zum Bild des Gastes oben
  function chipPos(st, id) { var i = 0; st.gaeste.forEach(function (g, k) { if (g.id === id) i = k; }); return { x: 60 + i * 36, y: 11 }; }
  function zeichneHerzFlug(c, st, cx, cy) {
    (st.herzFlug || []).forEach(function (h) {
      if (h.t < 0) return;
      var p = Math.min(1, h.t / h.dauer), e = sanft(p), z0 = chipPos(st, h.id), z = { x: z0.x / ZM, y: z0.y / ZM };
      var x0 = h.x - cx, y0 = h.y - cy, kx = (x0 + z.x) / 2, ky = Math.min(y0, z.y) - 30;
      var x = (1 - e) * (1 - e) * x0 + 2 * (1 - e) * e * kx + e * e * z.x, y = (1 - e) * (1 - e) * y0 + 2 * (1 - e) * e * ky + e * e * (z.y + 12);
      muster(c, Math.round(x), Math.round(y), BILD.herz[0], BILD.herz[1]);
    });
  }

  // kleine Herzen fuer die Gaeste (HUD und Abendszene)
  function herzReihe(c, gs, x, y) {
    var n = Dorf.Glueck ? Dorf.Glueck.herzen(gs) : 0;
    for (var i = 0; i < 5; i++) herz(c, x + i * 6, y, i < n ? '#ff7fa0' : '#e9dcef');
  }

  function zeichneKachel(c, karte, x, y, sx, sy, zeit, st) {
    var T = Dorf.Karte.T, t = karte.tile(x, y), hs = hash(x, y);
    if (istMoebel(t)) t = bodenUnter(karte, x, y);
    switch (t) {
      case T.WIESE:
        // saftige Eselwiese mit kleinen Kleeblueten
        r(c, sx, sy, K, K, '#c3eeaa');
        r(c, sx + (hs % 11) + 2, sy + ((hs >> 4) % 10) + 3, 1, 3, '#94cf7f'); r(c, sx + ((hs >> 6) % 11) + 3, sy + ((hs >> 2) % 9) + 4, 1, 2, '#94cf7f');
        if (hs % 4 === 0) { r(c, sx + ((hs >> 7) % 10) + 3, sy + ((hs >> 9) % 10) + 3, 2, 2, '#fff4fb'); r(c, sx + ((hs >> 7) % 10) + 3, sy + ((hs >> 9) % 10) + 3, 1, 1, '#ffc6dc'); }
        break;
      case T.ZAUN:
        zeichneZaun(c, karte, x, y, sx, sy, hs);
        break;
      case T.GRAS: case T.OLIVE: case T.ORANGE: case T.STALL: case T.INSTRUMENT:
        r(c, sx, sy, K, K, P.gras);
        if (hs % 3 === 0) { r(c, sx + (hs % 11) + 2, sy + ((hs >> 4) % 10) + 3, 1, 2, P.gras2); r(c, sx + (hs % 11) + 4, sy + ((hs >> 4) % 10) + 2, 1, 3, P.gras2); }
        if (hs % 5 === 1) r(c, sx + ((hs >> 7) % 12) + 2, sy + ((hs >> 9) % 12) + 2, 2, 1, P.gras3);
        break;
      case T.WEG:
        r(c, sx, sy, K, K, P.weg);
        rr(c, sx + (hs % 11) + 2, sy + ((hs >> 5) % 11) + 2, 3, 2, P.weg2);
        r(c, sx + ((hs >> 3) % 12) + 1, sy + ((hs >> 8) % 12) + 2, 1, 1, P.weg2);
        break;
      case T.PFLASTER: case T.BRUNNEN: case T.TAFEL:
        // ab v0.7: ruhiger Sandstein, nur hier und da ein Stein (vorher war alles voller Fugen)
        r(c, sx, sy, K, K, P.pflaster);
        var hp = ((x * 73856093) ^ (y * 19349663)) >>> 0, v = hp % 100;
        if (v >= 55) { var ax = 2 + (hp >>> 8) % 8, ay = 2 + (hp >>> 12) % 9; rr(c, sx + ax, sy + ay, 5, 3, P.pflaster2); r(c, sx + ax + 1, sy + ay, 3, 1, P.rand); }
        if (v >= 85) { var bx2 = 1 + (hp >>> 16) % 11, by2 = 1 + (hp >>> 20) % 11; rr(c, sx + bx2, sy + by2, 4, 3, P.pflaster2); r(c, sx + bx2 + 1, sy + by2, 2, 1, P.rand); }
        if (t === T.TAFEL) zeichneTafel(c, karte, x, y, sx, sy, st);
        break;
      case T.BODEN: case T.TEPPICH:
        r(c, sx, sy, K, K, P.boden);
        for (var i = 3; i < K; i += 4) r(c, sx, sy + i, K, 1, P.boden2);
        r(c, sx + (y % 2 ? 5 : 11), sy, 1, K, P.boden2);
        if (t === T.TEPPICH) zeichneTeppich(c, karte, x, y, sx, sy);
        break;
      case T.FLIESE: case T.HERD:
        for (var fy = 0; fy < 2; fy++) for (var fx = 0; fx < 2; fx++) r(c, sx + fx * 8, sy + fy * 8, 8, 8, (fx + fy) % 2 ? P.fliese2 : P.fliese1);
        if (t === T.HERD) {
          box(c, sx, sy + 1, K, 14, P.herd);
          r(c, sx + 1, sy + 11, 14, 3, P.herd2);
          kreis(c, sx + 5, sy + 6, 2, P.kontur); kreis(c, sx + 11, sy + 6, 2, P.kontur);
          if (x === 5) { pille(c, sx + 2, sy - 3, 12, 6, '#ffa27f'); r(c, sx + 13, sy - 1, 3, 2, P.kontur); }
        }
        break;
      case T.WASSER:
        r(c, sx, sy, K, K, P.wasser);
        if (karte.tile(x, y - 1) !== T.WASSER) r(c, sx, sy, K, 3, P.wasser3);
        var wx = Math.floor((zeit * 6 + x * 5 + y * 3) % 16);
        rr(c, sx + wx, sy + 6 + (x + y) % 3 * 3, 5, 2, P.wasser2);
        r(c, sx + ((wx + 9) % 14), sy + 12, 3, 1, P.wasser2);
        break;
      case T.RAND:
        r(c, sx, sy, K, K, P.rand);
        r(c, sx + 7, sy, 1, K, P.rand2); r(c, sx, sy + 7, K, 1, P.rand2);
        if (karte.tile(x, y + 1) === T.WASSER) r(c, sx, sy + 14, K, 2, P.kontur);
        if (karte.tile(x, y - 1) === T.WASSER) r(c, sx, sy, K, 2, P.kontur);
        if (karte.tile(x + 1, y) === T.WASSER) r(c, sx + 14, sy, 2, K, P.kontur);
        if (karte.tile(x - 1, y) === T.WASSER) r(c, sx, sy, 2, K, P.kontur);
        break;
      case T.BEET:
        r(c, sx, sy, K, K, P.erde);
        for (var by = 2; by < K; by += 5) { r(c, sx, sy + by + 2, K, 1, P.erde2); rr(c, sx + 2 + (by % 4), sy + by - 1, 3, 3, P.spross); rr(c, sx + 9 + (by % 3), sy + by - 1, 3, 3, P.spross); }
        // ab v0.7: Holzrahmen ums Beet, damit es wie ein Ort fuer Pflanzen aussieht
        if (karte.tile(x, y - 1) !== T.BEET) r(c, sx, sy, K, 1, P.konturHolz);
        if (karte.tile(x, y + 1) !== T.BEET) { r(c, sx, sy + 14, K, 1, P.holz); r(c, sx, sy + 15, K, 1, P.konturHolz); }
        if (karte.tile(x - 1, y) !== T.BEET) r(c, sx, sy, 1, K, P.konturHolz);
        if (karte.tile(x + 1, y) !== T.BEET) r(c, sx + 15, sy, 1, K, P.konturHolz);
        break;
      case T.STRAND:
        r(c, sx, sy, K, K, P.strand);
        rr(c, sx + (hs % 10) + 2, sy + ((hs >> 4) % 9) + 3, 3, 2, P.strand2);
        if (hs % 5 === 0) { r(c, sx + ((hs >> 7) % 11) + 2, sy + ((hs >> 9) % 10) + 4, 2, 1, P.strand3); }
        // Schaumkante zum Meer
        if (karte.tile(x, y + 1) === T.MEER) {
          r(c, sx, sy + 13, K, 1, P.meer2);
          r(c, sx + ((Math.floor(zeit * 4) + x * 3) % 12), sy + 14, 4, 1, '#ffffff');
        }
        // leichte Kante zur Mauer/Tor
        if (karte.tile(x, y - 1) === T.MAUER || karte.tile(x, y - 1) === T.TOR) r(c, sx, sy, K, 1, P.konturHolz);
        break;
      case T.MEER:
        r(c, sx, sy, K, K, (y + x) % 5 === 0 ? P.meerTief : P.meer);
        if (karte.tile(x, y - 1) !== T.MEER) {
          r(c, sx, sy, K, 2, P.meer3);
          r(c, sx + ((Math.floor(zeit * 5) + x * 2) % 14), sy + 1, 5, 1, P.meer2);
        }
        var mx = Math.floor((zeit * 5 + x * 7 + y * 2) % 16);
        rr(c, sx + mx, sy + 5 + (x + y) % 4 * 2, 6, 2, P.meer2);
        r(c, sx + ((mx + 8) % 14), sy + 11, 4, 1, P.meer2);
        break;
      case T.TOR:
        r(c, sx, sy, K, K, P.weg);
        box(c, sx, sy, K, K, P.holz);
        for (var tx = 3; tx < K; tx += 4) r(c, sx + tx, sy + 2, 1, 12, P.holz2);
        break;
      case T.MAUER: case T.WAND:
        zeichneWand(c, karte, x, y, sx, sy, t);
        break;
    }
  }
  // ab v0.9: Bougainvillea haengt ueber die Dachkante auf die Hauswand
  function zeichneBougainvillea(c, sx, sy, hs) {
    var B = ['#e0509a', '#ff7fc0', '#c93f8a'];
    r(c, sx + 1, sy + 8, 14, 2, '#4f9a5a'); r(c, sx + 5, sy + 10, 1, 3, '#4f9a5a'); r(c, sx + 11, sy + 10, 1, 4, '#4f9a5a');
    [[2, 7], [6, 6], [10, 7], [13, 6], [4, 10], [9, 11], [11, 13], [5, 13]].forEach(function (q, i) {
      if (i > 5 && (hs >> i) % 2) return;
      r(c, sx + q[0], sy + q[1], 3, 2, B[i % 3]); r(c, sx + q[0], sy + q[1], 1, 1, '#ffd1e8');
    });
    r(c, sx + 8, sy + 9, 2, 1, '#6cc070');
  }
  function zeichneWand(c, karte, x, y, sx, sy, t) {
    var T = Dorf.Karte.T, mauer = t === T.MAUER;
    var top = mauer ? P.mauerTop : P.dach, fuge = mauer ? P.mauerFuge : P.dach2;
    var front = !istWand(karte.tile(x, y + 1)) && y + 1 < karte.h;
    var topH = front ? 10 : K;
    r(c, sx, sy, K, topH, top);
    if (mauer) { r(c, sx, sy + 4, K, 1, fuge); r(c, sx + (y % 2 ? 6 : 12), sy, 1, 4, fuge); r(c, sx + (y % 2 ? 2 : 9), sy + 5, 1, Math.min(5, topH - 5), fuge); }
    else { for (var i = 3; i < topH; i += 4) for (var j = (i % 8 === 3 ? 0 : 4); j < K; j += 8) rr(c, sx + j, sy + i - 2, 7, 3, fuge); }
    if (front) {
      r(c, sx, sy + 10, K, 6, mauer ? P.mauerFront : P.putz);
      r(c, sx, sy + 10, K, 2, P.kontur);
      r(c, sx, sy + 15, K, 1, mauer ? P.kontur : P.putz2);
      if (!mauer && hash(x, y) % 3 === 0) {
        // ab v0.9: gruene Fensterlaeden links und rechts
        r(c, sx + 1, sy + 11, 3, 5, P.kontur); r(c, sx + 12, sy + 11, 3, 5, P.kontur);
        r(c, sx + 2, sy + 12, 1, 3, '#7cc7b4'); r(c, sx + 13, sy + 12, 1, 3, '#7cc7b4');
        rr(c, sx + 4, sy + 11, 8, 5, P.kontur); r(c, sx + 5, sy + 12, 6, 3, P.fenster); r(c, sx + 5, sy + 12, 2, 1, '#ffffff');
      } else if (!mauer && hash(x, y) % 3 === 1) zeichneBougainvillea(c, sx, sy, hash(x, y));
    }
    if (!istWand(karte.tile(x - 1, y))) r(c, sx, sy, 2, K, P.kontur);
    if (!istWand(karte.tile(x + 1, y))) r(c, sx + 14, sy, 2, K, P.kontur);
    if (!istWand(karte.tile(x, y - 1)) && y > 0) r(c, sx, sy, K, 2, P.kontur);
  }
  // Portionsplaetze auf der Tafel (relativ zur ersten Tafelkachel)
  var TELLER = [[5, 7], [21, 7], [37, 7], [11, 7], [27, 7], [43, 7]];
  function zeichneTafel(c, karte, x, y, sx, sy, st) {
    var T = Dorf.Karte.T, links = karte.tile(x - 1, y) !== T.TAFEL, rechts = karte.tile(x + 1, y) !== T.TAFEL;
    r(c, sx, sy + 2, K, 11, P.kontur);
    r(c, sx + (links ? 2 : 0), sy + 4, K - (links ? 2 : 0) - (rechts ? 2 : 0), 6, P.tuch);
    r(c, sx + (links ? 2 : 0), sy + 10, K - (links ? 2 : 0) - (rechts ? 2 : 0), 1, P.holz);
    if (links) { r(c, sx, sy + 2, 1, 1, P.pflaster2); r(c, sx + 2, sy + 13, 2, 3, P.kontur); }
    if (rechts) { r(c, sx + 15, sy + 2, 1, 1, P.pflaster2); r(c, sx + 12, sy + 13, 2, 3, P.kontur); }
    // Tischlaeufer in Rosa
    r(c, sx + (links ? 2 : 0), sy + 6, K - (links ? 2 : 0) - (rechts ? 2 : 0), 2, '#ffd9e4');
    if (rechts) { kreis(c, sx + 8, sy + 7, 3, P.kontur); kreis(c, sx + 8, sy + 7, 2, '#ffd36e'); r(c, sx + 7, sy + 5, 2, 1, '#ff9a8a'); }
    var teller = st && st.teller ? st.teller : [], ersteX = 5;
    for (var i = 0; i < teller.length && i < TELLER.length; i++) {
      var tx = TELLER[i][0] - (x - ersteX) * K;
      if (tx < 3 || tx > 13) continue;
      zeichneTeller(c, teller[i], sx + tx, sy + TELLER[i][1]);
    }
  }
  // Teller mit Gericht, Mitte cx,cy (klein, etwa 7x7)
  function zeichneTeller(c, id, cx, cy) {
    kreis(c, cx, cy, 3, P.kontur); kreis(c, cx, cy, 2, '#ffffff');
    zeichneEssen(c, id, cx, cy);
  }
  // grosser Teller (Karten, Buch, Abend): runder Rand in echter Groesse, nur das Essen wird vergroessert
  function grosserTeller(c, id, cx, cy, s) {
    var rad = Math.round(s * 3.4);
    ellipse(c, cx, cy + rad - 1, rad, Math.max(1, Math.round(s * 0.7)), 'rgba(75,58,90,0.18)');
    kreis(c, cx, cy, rad + 1, P.kontur); kreis(c, cx, cy, rad, '#ffffff'); kreis(c, cx, cy, Math.round(rad * 0.72), '#f4ede6');
    c.save(); c.translate(cx, cy); c.scale(s, s); zeichneEssen(c, id, 0, 0); c.restore();
  }
  function zeichneEssen(c, id, cx, cy) {
    if (id === 'ensaimada') {
      kreis(c, cx, cy - 1, 2, '#e8a865'); r(c, cx - 1, cy - 2, 2, 2, '#f8c98a'); r(c, cx, cy - 1, 1, 1, '#c98450');
      r(c, cx - 2, cy - 2, 1, 1, '#ffffff'); r(c, cx + 1, cy - 3, 1, 1, '#ffffff'); r(c, cx + 1, cy, 1, 1, '#ffffff');
    } else if (id === 'tumbet') {
      rr(c, cx - 2, cy - 2, 5, 3, '#ff9a6b'); r(c, cx - 1, cy - 2, 1, 1, '#b48ae0'); r(c, cx + 1, cy - 1, 1, 1, '#8fd46b'); r(c, cx, cy - 2, 1, 1, '#ffd36e');
    } else {
      rr(c, cx - 2, cy - 2, 4, 3, '#f3c27a'); r(c, cx - 1, cy - 2, 2, 1, '#ff7a6b'); r(c, cx + 1, cy - 1, 1, 1, '#9fd86b');
    }
  }
  function zeichneTeppich(c, karte, x, y, sx, sy) {
    var T = Dorf.Karte.T;
    var l = karte.tile(x - 1, y) !== T.TEPPICH, rt = karte.tile(x + 1, y) !== T.TEPPICH, o = karte.tile(x, y - 1) !== T.TEPPICH, u = karte.tile(x, y + 1) !== T.TEPPICH;
    var x0 = sx + (l ? 2 : 0), y0 = sy + (o ? 2 : 0), x1 = sx + K - (rt ? 2 : 0), y1 = sy + K - (u ? 2 : 0);
    r(c, x0, y0, x1 - x0, y1 - y0, P.teppich);
    if (l) r(c, x0, y0, 1, y1 - y0, P.kontur);
    if (rt) r(c, x1 - 1, y0, 1, y1 - y0, P.kontur);
    if (o) r(c, x0, y0, x1 - x0, 1, P.kontur);
    if (u) r(c, x0, y1 - 1, x1 - x0, 1, P.kontur);
    if (l) r(c, x0 + 2, y0 + (o ? 2 : 0), 1, y1 - y0 - (o ? 2 : 0) - (u ? 2 : 0), P.teppich2);
    if (rt) r(c, x1 - 3, y0 + (o ? 2 : 0), 1, y1 - y0 - (o ? 2 : 0) - (u ? 2 : 0), P.teppich2);
    if (o) r(c, x0 + (l ? 2 : 0), y0 + 2, x1 - x0 - (l ? 2 : 0) - (rt ? 2 : 0), 1, P.teppich2);
    if (u) r(c, x0 + (l ? 2 : 0), y1 - 3, x1 - x0 - (l ? 2 : 0) - (rt ? 2 : 0), 1, P.teppich2);
    if ((x + y) % 2 === 0) herz(c, sx + 6, sy + 6, P.teppich2);
  }

  // ---------- Moebel (werden wie Figuren nach Fusslinie sortiert) ----------
  function zeichneMoebel(c, karte, x, y, sx, sy) {
    var T = Dorf.Karte.T, t = karte.tile(x, y), links, rechts;
    ellipse(c, sx + 8, sy + 14, 7, 2, P.schatten);
    switch (t) {
      case T.COUCH:
        links = karte.tile(x - 1, y) !== T.COUCH; rechts = karte.tile(x + 1, y) !== T.COUCH;
        r(c, sx, sy - 2, K, 16, P.kontur);
        r(c, sx + (links ? 2 : 0), sy, K - (links ? 2 : 0) - (rechts ? 2 : 0), 6, P.couch2);
        r(c, sx + (links ? 2 : 0), sy + 6, K - (links ? 2 : 0) - (rechts ? 2 : 0), 6, P.couch);
        r(c, sx + (links ? 2 : 0), sy + 6, K - (links ? 2 : 0) - (rechts ? 2 : 0), 1, P.kontur);
        if (links) { pille(c, sx - 1, sy + 2, 6, 12, P.couch2); r(c, sx, sy - 2, 1, 1, P.boden); }
        if (rechts) { pille(c, sx + 11, sy + 2, 6, 12, P.couch2); r(c, sx + 15, sy - 2, 1, 1, P.boden); }
        if (!links && !rechts) pille(c, sx + 4, sy + 1, 8, 6, P.kissen);
        else if (links) { pille(c, sx + 5, sy + 1, 8, 6, '#fff1a8'); }
        else pille(c, sx + 3, sy + 1, 8, 6, '#bdf0dd');
        break;
      case T.SESSEL:
        pille(c, sx + 1, sy - 1, 14, 15, P.couch2);
        r(c, sx + 4, sy + 6, 8, 6, P.couch); r(c, sx + 4, sy + 6, 8, 1, P.kontur);
        pille(c, sx + 5, sy + 1, 6, 5, P.kissen);
        break;
      case T.KUEBEL:
        // ab v0.9: Terrakotta-Kuebel mit Bougainvillea oder Geranien
        pille(c, sx + 3, sy + 7, 10, 8, '#e0855a'); r(c, sx + 4, sy + 9, 8, 1, '#f3a77c'); r(c, sx + 4, sy + 12, 8, 1, '#c0673f');
        kreis(c, sx + 8, sy + 2, 6, P.kontur); kreis(c, sx + 4, sy + 5, 4, P.kontur); kreis(c, sx + 12, sy + 5, 4, P.kontur);
        kreis(c, sx + 8, sy + 2, 5, '#6cc070'); kreis(c, sx + 4, sy + 5, 3, '#5aa860'); kreis(c, sx + 12, sy + 5, 3, '#5aa860');
        var bf = hash(x, y) % 2 ? ['#e0509a', '#ff7fc0'] : ['#ff8a5c', '#ffc36b'];
        [[5, 0], [9, -2], [12, 3], [7, 3], [2, 4], [10, 6], [4, 7]].forEach(function (q, i) { r(c, sx + q[0], sy + q[1], 2, 2, bf[i % 2]); });
        r(c, sx + 9, sy - 1, 1, 1, '#ffffff'); r(c, sx + 5, sy, 1, 1, '#ffe0f0');
        break;
      case T.PFLANZE:
        pille(c, sx + 4, sy + 8, 8, 7, P.topf); r(c, sx + 5, sy + 12, 6, 1, P.topf2);
        kreis(c, sx + 8, sy + 2, 6, P.kontur); kreis(c, sx + 4, sy + 5, 4, P.kontur); kreis(c, sx + 12, sy + 5, 4, P.kontur);
        kreis(c, sx + 8, sy + 2, 5, P.blatt2); kreis(c, sx + 4, sy + 5, 3, P.blatt); kreis(c, sx + 12, sy + 5, 3, P.blatt);
        kreis(c, sx + 7, sy, 2, P.blatt3); r(c, sx + 10, sy + 1, 1, 1, '#ffb3c7');
        break;
      case T.ECKBANK:
        pille(c, sx + 1, sy + 1, 14, 13, P.holz);
        pille(c, sx + 3, sy + 3, 10, 8, '#bdf0dd'); r(c, sx + 5, sy + 5, 2, 2, '#ffffff');
        break;
      case T.TISCH:
        kreis(c, sx + 8, sy + 6, 7, P.kontur); kreis(c, sx + 8, sy + 6, 6, P.holz); kreis(c, sx + 8, sy + 5, 5, '#f0b88a');
        r(c, sx + 7, sy + 11, 2, 4, P.kontur);
        kreis(c, sx + 8, sy + 5, 2, P.kontur); r(c, sx + 7, sy + 4, 1, 1, '#ff9a8a'); r(c, sx + 9, sy + 5, 1, 1, '#ffd36e');
        break;
      case T.ANRICHTE:
        box(c, sx, sy, K, 15, P.holz);
        r(c, sx + 1, sy + 1, 14, 5, '#f4efe6'); r(c, sx + 1, sy + 6, 14, 1, P.kontur);
        r(c, sx + 7, sy + 8, 2, 2, P.kontur);
        if (x === 3) { kreis(c, sx + 8, sy + 3, 3, P.kontur); kreis(c, sx + 8, sy + 3, 2, '#ffd36e'); r(c, sx + 9, sy + 2, 2, 2, '#ff9a8a'); }
        else if (x === 7) { rr(c, sx + 3, sy + 1, 10, 4, P.kontur); r(c, sx + 4, sy + 2, 8, 2, P.wasser); }
        else { rr(c, sx + 5, sy - 2, 6, 7, P.kontur); r(c, sx + 6, sy - 1, 4, 5, '#c6ecf7'); r(c, sx + 6, sy + 1, 4, 3, '#ffd36e'); }
        break;
      case T.BETT:
        var oben = karte.tile(x, y - 1) !== T.BETT, unten = karte.tile(x, y + 1) !== T.BETT;
        links = karte.tile(x - 1, y) !== T.BETT; rechts = karte.tile(x + 1, y) !== T.BETT;
        r(c, sx, sy - (oben ? 3 : 0), K, K + (oben ? 3 : 0) - (unten ? 1 : 0), P.kontur);
        var bx0 = sx + (links ? 2 : 0), bw = K - (links ? 2 : 0) - (rechts ? 2 : 0);
        if (oben) { r(c, bx0, sy - 1, bw, 6, P.holz); pille(c, sx + (links ? 3 : 1), sy + 1, 12, 7, '#ffffff'); r(c, bx0, sy + 8, bw, 8, P.decke); }
        else { r(c, bx0, sy, bw, unten ? 13 : K, P.decke); }
        if (!oben) { herz(c, sx + 5, sy + 3, '#ff9fb8'); }
        if (unten) r(c, bx0, sy + 11, bw, 2, '#ffb7cb');
        break;
    }
  }

  // ---------- Objekte ----------
  function zeichneOrangenbaum(c, sx, sy) {
    var cx = sx + 8, by = sy + 14;
    ellipse(c, cx, by, 7, 3, P.schatten);
    rr(c, cx - 2, by - 8, 5, 9, P.konturHolz); r(c, cx - 1, by - 8, 3, 8, P.stamm);
    kreis(c, cx, by - 17, 9, P.konturGruen); kreis(c, cx, by - 17, 8, P.blatt2); kreis(c, cx - 2, by - 19, 5, P.blatt); kreis(c, cx - 3, by - 21, 2, P.blatt3);
  }
  // ab v0.14: Zitronenbaum – helleres gelbgruenes Laub
  function zeichneZitronenbaum(c, sx, sy) {
    var cx = sx + 8, by = sy + 14;
    ellipse(c, cx, by, 7, 3, P.schatten);
    rr(c, cx - 2, by - 8, 5, 9, P.konturHolz); r(c, cx - 1, by - 8, 3, 8, P.stamm);
    kreis(c, cx, by - 17, 9, P.konturGruen); kreis(c, cx, by - 17, 8, P.zitroneBlatt); kreis(c, cx - 2, by - 19, 5, P.blatt3); kreis(c, cx - 3, by - 21, 2, '#d4f0a8');
  }
  function zeichneBaum(c, sx, sy) {
    var cx = sx + 8, by = sy + 14;
    ellipse(c, cx, by, 8, 3, P.schatten);
    // Olivenbaum (ab v0.7 silbergruen, damit er sich vom Orangenbaum unterscheidet)
    rr(c, cx - 3, by - 9, 6, 10, P.konturHolz); r(c, cx - 2, by - 9, 4, 9, P.stamm); r(c, cx - 2, by - 9, 1, 9, '#b98463');
    kreis(c, cx - 5, by - 15, 7, P.konturGruen); kreis(c, cx + 5, by - 15, 7, P.konturGruen); kreis(c, cx, by - 21, 8, P.konturGruen);
    kreis(c, cx - 5, by - 15, 6, P.olive3); kreis(c, cx + 5, by - 15, 6, P.olive3); kreis(c, cx, by - 21, 7, P.olive2);
    kreis(c, cx - 3, by - 17, 4, P.olive2); kreis(c, cx - 2, by - 24, 3, P.olive1);
    r(c, cx - 4, by - 20, 3, 2, P.olive1); r(c, cx + 2, by - 25, 3, 2, P.olive1);
  }
  function zeichneBrunnen(c, sx, sy, zeit) {
    ellipse(c, sx + 16, sy + 28, 15, 3, P.schatten);
    pille(c, sx + 2, sy + 6, 28, 22, P.stein);
    r(c, sx + 3, sy + 20, 26, 6, P.stein2);
    r(c, sx + 3, sy + 20, 26, 1, P.konturStein);
    for (var i = 6; i < 28; i += 6) r(c, sx + 2 + i, sy + 21, 1, 5, P.konturStein);
    pille(c, sx + 6, sy + 9, 20, 10, P.wasser);
    r(c, sx + 9 + Math.floor((zeit * 4) % 10), sy + 12, 4, 1, P.wasser2);
    r(c, sx + 4, sy - 6, 4, 16, P.konturStein); r(c, sx + 5, sy - 5, 2, 14, P.holz);
    r(c, sx + 24, sy - 6, 4, 16, P.konturStein); r(c, sx + 25, sy - 5, 2, 14, P.holz);
    pille(c, sx + 1, sy - 10, 30, 6, P.dach);
    r(c, sx + 16, sy - 4, 1, 7, P.konturStein);
    box(c, sx + 13, sy + 2, 7, 6, '#b8c4e0');
  }

  // ---------- Figuren (ab v0.8 neu gezeichnet nach dem Design Review) ----------
  // Jede Figur hat eine eigene Silhouette: Biel mit breiter Hutkrempe und rotem Halstuch, Mia klein mit zwei
  // Zoepfen, Jonas gross mit eckigen Schultern, Brille und Tolle, Padrina mit Dutt, Stock und weitem Rock.
  // Umriss in Tinte nur aussen (unten dunkler), Linien innen in der dunkleren Farbe der Flaeche.
  var BIEL = { form: 'biel', kind: false, haut: '#e8b08a', haar: '#3e2c26', haarGlanz: '#6e5246', bart: '#4a342a', hemd: '#f7f3ea', hemd2: '#d9d2c4', hose: '#5b6fa8', schuhe: '#c98b5e', sohle: '#7a4a3a',
    hut: '#ffd35e', hut2: '#d9a83a', hutBand: '#ff6f6f', halstuch: '#ff5a5a' };
  // hw/hh Kopf, bw/bh Oberkoerper, rock (nur Padrina), bein mit Schuhen, atem Sekunden pro Atemzug
  var FORM = {
    biel: { hw: 14, hh: 12, bw: 10, bh: 6, rock: 0, bein: 4, atem: 1.6, phase: 0 },
    mia: { hw: 13, hh: 11, bw: 8, bh: 5, rock: 0, bein: 3, atem: 1.2, phase: 0.4 },
    jonas: { hw: 13, hh: 12, bw: 12, bh: 8, rock: 0, bein: 5, atem: 1.6, phase: 0.9, eckig: true },
    padrina: { hw: 13, hh: 12, bw: 10, bh: 4, rock: 4, bein: 2, atem: 2.2, phase: 1.3 }
  };
  function formVon(a) { return FORM[a.form] || (a.kind ? FORM.mia : FORM.biel); }
  function masse(a) { var F = formVon(a); return { hoehe: F.hh + F.bh + F.rock + F.bein, kopf: F.hh }; }

  // o: { zeit, hop } (beide freiwillig). Fuss in der Mitte bei (px, py).
  function zeichnePerson(c, px, py, a, dir, frame, o) {
    o = o || {};
    var F = formVon(a), name = a.form || (a.kind ? 'mia' : 'biel'), zeit = o.zeit || 0;
    var Hh = F.hh + F.bh + F.rock + F.bein, hop = Math.round(o.hop || 0);
    var ox = Math.round(px) - 8, oy = Math.round(py) - Hh + 1 - hop;
    var flip = dir === 'links', seite = dir === 'links' || dir === 'rechts', hinten = dir === 'oben';
    function q(x, y, w, h, col) { if (w <= 0 || h <= 0) return; c.fillStyle = col; c.fillRect(ox + (flip ? 16 - x - w : x), oy + y, w, h); }
    function rund(x, y, w, h, col, eckig) {
      if (eckig || w < 4 || h < 4) { q(x, y, w, h, col); return; }
      if (w >= 12 && h >= 8) { q(x + 2, y, w - 4, h, col); q(x + 1, y + 1, w - 2, h - 2, col); q(x, y + 2, w, h - 4, col); return; }
      q(x + 1, y, w - 2, h, col); q(x, y + 1, w, h - 2, col);
    }
    var schritt = (frame === 1) ? 1 : (frame === 3 ? -1 : 0), laeuft = schritt !== 0;
    // ruhig stehen: alle paar Sekunden atmet die Figur (Kopf und Oberkoerper 1 Pixel tiefer)
    var atem = (!laeuft && !o.ruhig && ((zeit + F.phase) % F.atem) < F.atem * 0.4) ? 1 : 0;
    var bob = laeuft ? 1 : 0, yK = atem + bob;
    var hx = Math.floor((16 - F.hw) / 2), lehnt = (name === 'padrina' && seite) ? 1 : 0;
    var tY = yK + F.hh, rY = tY + F.bh, bY = F.hh + F.bh + F.rock, tx = 8 - F.bw / 2 + lehnt;
    if (hop <= 0) ellipse(c, Math.round(px), Math.round(py) + 1, 6, 2, P.schatten);
    else ellipse(c, Math.round(px), Math.round(py) + 1, 5, 1, P.schatten);

    // Teile: erst alle Umrisse, dann alle Flaechen, damit innen keine Tintenlinien entstehen
    var teile = [];
    function teil(x, y, w, h, col, k, eckig) { teile.push({ x: x, y: y, w: w, h: h, col: col, k: k || P.kontur, eckig: eckig }); }
    var tief = P.konturTief, sw = F.bein > 3 ? 2 : 1;
    if (F.bein > 0) {
      var lx = seite ? 6 + schritt : (F.bw >= 12 ? 4 : 5), rx = seite ? 8 - schritt : (F.bw >= 12 ? 9 : 8);
      var lh = F.bein - (!seite && schritt > 0 ? 1 : 0), rh = F.bein - (!seite && schritt < 0 ? 1 : 0);
      teil(lx, bY, 3, lh, a.hose, tief, true); teil(rx, bY, 3, rh, a.hose, tief, true);
    }
    // Padrinas Stock (vor ihr in der Seitenansicht, sonst rechts neben ihr)
    if (a.stock) teil(seite ? 14 : 14, tY + 2, 1, Hh - tY - 2 + atem, '#b07a52', P.konturHolz, true);
    if (F.rock) { teil(tx - 1, rY, F.bw + 2, F.rock - 1, a.rock || a.hemd2, P.kontur, false); teil(tx - 2, rY + F.rock - 2, F.bw + 4, 2, a.rock || a.hemd2, tief, true); }
    teil(tx, tY, F.bw, F.bh, a.hemd, P.kontur, F.eckig);
    if (seite) teil(7 + lehnt + (laeuft ? schritt : 0), tY + 1, 2, Math.max(3, F.bh - 1), a.hemd);
    else { var ah = Math.max(3, F.bh - (F.eckig ? 1 : 2)), ay = tY + (F.eckig ? 0 : 1); teil(tx - 2, ay, 2, ah, a.hemd, P.kontur, F.eckig); teil(tx + F.bw, ay, 2, ah, a.hemd, P.kontur, F.eckig); }
    if (a.zoepfe) {
      var zy = yK + Math.round(F.hh * 0.45) - 1;
      if (!seite || hinten) { teil(hx - 2, zy, 3, 4, a.haar); teil(hx + F.hw - 1, zy, 3, 4, a.haar); }
      else teil(hx - 2, zy, 3, 4, a.haar);
    }
    if (a.dutt) teil(5 + lehnt, yK - 3, 6, 4, a.haar);
    if (name === 'jonas') teil(hx + (seite ? 6 : 5), yK - 2, 5, 3, a.haar);
    teil(hx + lehnt, yK, F.hw, F.hh, a.haut);
    teile.forEach(function (t) { rund(t.x - 1, t.y - 1, t.w + 2, t.h + 2, t.k, t.eckig); });
    teile.forEach(function (t) { rund(t.x, t.y, t.w, t.h, t.col, t.eckig); });

    // Schuhe und Schatten an Hose und Hemd (dunklere Flaechenfarbe statt Tinte)
    if (F.bein > 0) teile.slice(0, 2).forEach(function (t) { q(t.x, t.y + t.h - sw, t.w, sw, a.schuhe); if (sw > 1) q(t.x, t.y + t.h - 1, t.w, 1, a.sohle || P.konturHolz); });
    q(tx, tY + F.bh - 1, F.bw, 1, a.hemd2);
    if (!seite) { q(tx - 2, tY + (F.eckig ? 0 : 1) + Math.max(3, F.bh - (F.eckig ? 1 : 2)) - 1, 2, 1, a.haut); q(tx + F.bw, tY + (F.eckig ? 0 : 1) + Math.max(3, F.bh - (F.eckig ? 1 : 2)) - 1, 2, 1, a.haut); }
    else q(7 + lehnt + (laeuft ? schritt : 0), tY + Math.max(3, F.bh - 1), 2, 1, a.haut);
    if (F.rock) { q(tx - 1, rY + F.rock - 3, F.bw + 2, 1, a.hemd2); }
    if (a.halstuch && !hinten) q(seite ? 9 : 7, tY, 2, 2, a.halstuch);
    if (name === 'jonas' && !hinten && !seite) { q(7, tY + 1, 2, F.bh - 2, a.hemd2); }

    // Kopf: Haare, Augen tief im Gesicht (55 Prozent), Baeckchen
    var X = hx + lehnt, W2 = F.hw, hg = a.haarGlanz || a.hemd2, ey = yK + Math.round(F.hh * 0.55);
    var takt = 2.5 + F.phase * 1.7, blinz = ((zeit + F.phase * 3) % takt) < 0.12;
    if (hinten) {
      q(X + 1, yK + 1, W2 - 2, F.hh - 3, a.haar); q(X, yK + 2, W2, F.hh - 5, a.haar); q(X + 3, yK + 2, 3, 1, hg);
    } else if (seite) {
      q(X + 2, yK, W2 - 4, 1, a.haar); q(X + 1, yK + 1, W2 - 2, 3, a.haar); q(X, yK + 3, 6, ey - yK - 1 + (name === 'padrina' || name === 'mia' ? 2 : 0), a.haar);
      q(X + 6, yK + 1, 3, 1, hg);
      var ex = X + W2 - 5;
      if (blinz) q(ex, ey + 1, 2, 1, P.kontur); else { q(ex, ey, 2, 2, P.kontur); q(ex, ey, 1, 1, P.augeHell); }
      if (a.brille) { q(ex - 1, ey - 1, 4, 1, a.brille); q(X + 6, ey - 1, ex - X - 6, 1, a.brille); }
      q(ex - 1, ey + 2, 2, 1, P.backe);
      if (a.bart) { q(X + 6, ey + 3, W2 - 7, F.hh - (ey - yK) - 3, a.bart); q(ex, ey + 3, 2, 1, '#c0605a'); }
      else q(ex + 1, ey + 3, 2, 1, '#d0706a');
    } else {
      q(X + 2, yK, W2 - 4, 1, a.haar); q(X + 1, yK + 1, W2 - 2, 3, a.haar);
      var lang = (name === 'padrina' || name === 'mia') ? 3 : 1;
      q(X, yK + 3, 1, ey - yK - 2 + lang, a.haar); q(X + W2 - 1, yK + 3, 1, ey - yK - 2 + lang, a.haar);
      q(X + 2, yK + 4, 3, 1, a.haar); q(X + W2 - 5, yK + 4, 2, 1, a.haar);
      q(X + 3, yK + 2, 2, 1, hg);
      var e1 = X + 3, e2 = X + W2 - 5;
      if (blinz) { q(e1, ey + 1, 2, 1, P.kontur); q(e2, ey + 1, 2, 1, P.kontur); }
      else { q(e1, ey, 2, 2, P.kontur); q(e2, ey, 2, 2, P.kontur); q(e1, ey, 1, 1, P.augeHell); q(e2, ey, 1, 1, P.augeHell); }
      if (a.brille) { q(e1 - 1, ey - 1, e2 - e1 + 4, 1, a.brille); q(e1 - 1, ey, 1, 2, a.brille); q(e2 + 2, ey, 1, 2, a.brille); }
      q(X + 1, ey + 2, 2, 1, P.backe); q(X + W2 - 3, ey + 2, 2, 1, P.backe);
      if (a.bart) { q(X + 3, ey + 3, W2 - 6, F.hh - (ey - yK) - 3, a.bart); q(X + 1, ey + 2, 2, 1, P.backe); q(7 + (W2 % 2 ? 0 : 0), ey + 3, 2, 1, '#c0605a'); }
      else q(X + Math.floor(W2 / 2) - 1, ey + 3, 2, 1, '#d0706a');
    }
    if (a.zoepfe) { var zb = yK + Math.round(F.hh * 0.45); q(hx - 2, zb, 1, 1, '#ffd35e'); if (!seite) q(hx + F.hw + 1, zb, 1, 1, '#ffd35e'); }
    if (a.dutt) { q(6 + lehnt, yK - 3, 3, 1, hg); q(5 + lehnt, yK, 6, 1, '#ff9fb8'); }
    if (name === 'jonas') q(hx + (seite ? 7 : 6), yK - 2, 2, 1, hg);
    if (a.hut) {
      // Strohhut: Krone, rotes Band und eine breite Krempe ueber die ganze Figur (16 Pixel)
      var kr = seite ? 1 : 0;
      rund(3 + kr, yK - 4, 10, 6, P.kontur); rund(4 + kr, yK - 3, 8, 4, a.hut); q(5 + kr, yK - 3, 2, 1, '#fff0b0');
      q(4 + kr, yK, 8, 1, a.hutBand);
      rund(-1, yK + 1, 18, 4, P.kontur); q(0, yK + 2, 16, 1, a.hut); q(1, yK + 3, 14, 1, a.hut2);
    }
    var oben = oy + (a.hut ? yK - 4 : (a.dutt ? yK - 4 : (name === 'jonas' ? yK - 3 : yK - 1)));
    return { oben: oben, hoehe: Hh, mundX: ox + 8, mundY: oy + ey + 3 };
  }

  // ab v0.9: Gedankenwolke (lila Rand, wippt langsam um 2 Pixel), kleine Kringel fuehren zum Kopf
  var WOLKE = { fuell: '#f4efff', rand: '#9580dc', takt: 1.8, alle: 20, dauer: 5 };
  function zeichneWolke(c, x, y) {
    var teile = [[-6, 1, 4], [-2, -2, 5], [3, -2, 5], [7, 1, 4], [0, 2, 5]];
    teile.forEach(function (t) { kreis(c, x + t[0], y + t[1], t[2] + 1, WOLKE.rand); });
    teile.forEach(function (t) { kreis(c, x + t[0], y + t[1], t[2], WOLKE.fuell); });
  }
  function zeichneBlase(c, cx, topY, symbol, zeit, alpha) {
    var by = topY - 13 + Math.round(Math.sin((zeit || 0) * Math.PI * 2 / WOLKE.takt) * 2);
    c.globalAlpha = alpha === undefined ? 1 : alpha;
    kreis(c, cx - 4, topY - 2, 2, WOLKE.rand); r(c, cx - 4, topY - 2, 1, 1, WOLKE.fuell);
    kreis(c, cx - 2, by + 8, 2, WOLKE.rand); kreis(c, cx - 2, by + 8, 1, WOLKE.fuell);
    zeichneWolke(c, cx, by);
    if (symbol === 'teller') { kreis(c, cx, by, 3, P.kontur); kreis(c, cx, by, 2, '#ffffff'); r(c, cx - 1, by - 1, 2, 2, '#ffb36b'); }
    else if (symbol === 'ball') { kreis(c, cx, by, 3, P.kontur); kreis(c, cx, by, 2, '#ff8a8a'); r(c, cx - 2, by, 5, 1, '#ffffff'); }
    else if (symbol === 'herz') herz(c, cx - 2, by - 2, '#ff7fa0');
    else if (symbol === 'kissen') { pille(c, cx - 4, by - 3, 9, 6, P.kissen); }
    else if (symbol === 'zzz') { r(c, cx - 3, by - 3, 3, 1, '#8f7fd9'); r(c, cx - 2, by - 2, 1, 1, '#8f7fd9'); r(c, cx - 3, by - 1, 3, 1, '#8f7fd9'); r(c, cx + 1, by, 3, 1, '#8f7fd9'); r(c, cx + 2, by + 1, 1, 1, '#8f7fd9'); r(c, cx + 1, by + 2, 3, 1, '#8f7fd9'); }
    c.globalAlpha = 1;
  }
  // Wann zeigt ein Gast seine Wolke? Alle 20 Sekunden fuer 5 Sekunden (versetzt), und immer, wenn der Hinweis auf ihn zeigt
  function wolkeAlpha(st, gs, i) {
    var h = st.hinweis;
    if (h && h.ziel && h.ziel.gast === gs && h.alpha > 0) return 1;
    var ph = ((st.zeit || 0) + i * 6.7) % WOLKE.alle;
    return ph < WOLKE.dauer ? Math.min(1, ph * 3, (WOLKE.dauer - ph) * 3) : 0;
  }
  // Gaehnen: Mund auf, Hand davor ist zu klein, also nur ein runder Mund und zwei Traenchen-Pixel
  function zeichneGaehnen(c, mx, my, g) {
    var h = 1 + Math.round(g * 2);
    rr(c, mx - 2, my - 1, 4, h + 2, P.kontur); r(c, mx - 1, my, 2, h, '#c0506a');
    if (g > 0.6) { r(c, mx - 5, my - 4, 1, 1, '#bfe6ff'); r(c, mx + 4, my - 4, 1, 1, '#bfe6ff'); }
  }

  // Zielmarkierung beim Klicken: huepfendes Herz mit Ring
  function zeichneMarker(c, m, cx, cy) {
    var sx = m.x * K - cx, sy = m.y * K - cy;
    if (m.nein) { var a = 3; r(c, sx + 8 - a, sy + 8 - a, 2, 2, '#b9a9c9'); r(c, sx + 8 + a - 2, sy + 8 - a, 2, 2, '#b9a9c9'); r(c, sx + 7, sy + 7, 2, 2, '#b9a9c9'); r(c, sx + 8 - a, sy + 8 + a - 2, 2, 2, '#b9a9c9'); r(c, sx + 8 + a - 2, sy + 8 + a - 2, 2, 2, '#b9a9c9'); return; }
    var ring = 4 + Math.round((Math.sin(m.t * 6) + 1) * 1.5);
    ellipse(c, sx + 8, sy + 12, ring + 1, 3, P.kontur); ellipse(c, sx + 8, sy + 12, ring, 2, '#ffc6d8');
    var hop = Math.round(Math.abs(Math.sin(m.t * 5)) * 3);
    var hx = sx + 5, hy = sy + 1 - hop;
    r(c, hx - 1, hy, 9, 6, P.kontur); r(c, hx, hy - 1, 3, 1, P.kontur); r(c, hx + 4, hy - 1, 3, 1, P.kontur); r(c, hx + 1, hy + 6, 5, 1, P.kontur); r(c, hx + 2, hy + 7, 3, 1, P.kontur);
    herz(c, hx + 1, hy, '#ff7fa0'); r(c, hx + 1, hy, 1, 1, '#ffffff');
  }

  function zeichneKochen(c, karte, st, cx, cy) {
    if (!st.kochen) return;
    var sx = 5 * K - cx, sy = 2 * K - cy, z = st.zeit;
    for (var i = 0; i < 3; i++) {
      var ph = (z * 0.8 + i / 3) % 1;
      kreis(c, sx + 6 + i * 3 + Math.round(Math.sin(z * 3 + i) * 2), sy - 4 - Math.round(ph * 12), 2 - Math.round(ph), 'rgba(255,255,255,' + (0.9 - ph * 0.7).toFixed(2) + ')');
    }
    var anteil = 1 - st.kochen.rest / st.kochen.dauer;
    pille(c, sx - 4, sy - 22, 24, 6, '#ffffff');
    r(c, sx - 2, sy - 20, Math.round(20 * anteil), 2, '#ff9fb8');
    zeichneTeller(c, st.kochen.gericht, sx + 26, sy - 19);
  }

  // Zeilen umbrechen (gemessen auf der UI-Ebene)
  function umbruch(R, s, breite, groesse) {
    var c = R.ui || R.ctx;
    c.font = (groesse || 7) + 'px ' + SCHRIFT;
    var woerter = String(s).split(' '), zeilen = [], z = '';
    woerter.forEach(function (w) {
      var probe = z ? z + ' ' + w : w;
      if (z && c.measureText(probe).width > breite) { zeilen.push(z); z = w; } else z = probe;
    });
    if (z) zeilen.push(z);
    return zeilen;
  }

  // ab v0.9: Farben der Teller-Untergruende, gestrichelte Umrisse fuer Fehlendes
  var PLATTE = { paamboli: '#ffe1c9', ensaimada: '#fff0c2', tumbet: '#ffd6cf' };
  var FEHLT = '#9c7b93';
  function gestrichelt(c, x, y, rad, col) {
    var n = Math.max(12, Math.round(rad * 4));
    for (var a = 0; a < n; a++) if (a % 4 < 2) { var w = a / n * Math.PI * 2; r(c, Math.round(x + Math.cos(w) * rad), Math.round(y + Math.sin(w) * rad), 1, 1, col || FEHLT); }
  }
  // Fehlende Zutat: gestrichelter Umriss mit ganz blasser Fuellung
  function zutatFehlt(c, x, y) { kreis(c, x, y, 4, '#efe3ec'); gestrichelt(c, x, y, 5); }
  // Ei im eigenen goldenen Fach, damit es auf der hellen Karte gut zu sehen ist
  function eiFach(c, x, y, da) {
    rr(c, x - 6, y - 6, 13, 13, '#9a6428'); rr(c, x - 5, y - 5, 11, 11, da ? '#ffcf6b' : '#f2dca8');
    kreis(c, x, y, 4, da ? '#e0892e' : '#d9c08e');   // dunkles Nest, damit das helle Ei heraussticht
    if (!da) c.globalAlpha = (c.globalAlpha || 1) * 0.6;
    zeichneEi(c, x, y);
    c.globalAlpha = 1;
    if (da) { r(c, x + 4, y - 5, 1, 1, '#ffffff'); r(c, x + 3, y - 4, 3, 1, '#ffffff'); r(c, x + 4, y - 3, 1, 1, '#ffffff'); }
  }
  // kleines Buch (Rezepte und Sticker), Mitte (x, y)
  function buchBild(c, x, y) {
    rr(c, x - 9, y - 6, 18, 13, P.kontur); r(c, x - 8, y - 5, 7, 11, '#fff4dc'); r(c, x + 1, y - 5, 7, 11, '#fff4dc'); r(c, x - 1, y - 5, 2, 11, '#d08aa8');
    herz(c, x - 7, y - 3, '#ff7fa0'); r(c, x + 3, y - 2, 3, 1, '#ffc23d'); r(c, x + 4, y - 3, 1, 3, '#ffc23d');
  }
  function liebhaber(st, id) { var g = null; (st.gaeste || []).forEach(function (gs) { if (gs.liebling === id && !g) g = gs; }); return g; }

  // Kochmenue (ab v0.9 Bildkarten): Teller auf farbigem Grund, wer es am liebsten mag, Zutaten als Bilder
  function zeichneMenue(R, st) {
    var c = R.ctx, M = Dorf.Spiel.MENUE, karten = Dorf.Spiel.menueKarten(), wahl = st.menue.wahl, z = st.menue.t || 0;
    var wk = st.menue.wackel, WK = (Dorf.Spiel && Dorf.Spiel.WACKEL) || 0.5, MB = Dorf.Spiel.MENUE_BUCH, info = { karten: [] };
    c.fillStyle = 'rgba(75,58,90,0.35)'; c.fillRect(0, 0, W, H);
    pille(c, M.x, M.y, M.w, M.h, P.box);
    pille(c, M.x + 70, M.y - 6, 100, 13, '#ffd1e0');
    zeichneSymbol(c, 'topf', M.x + 82, M.y);
    text(R, 'Was kochst du?', W / 2 + 6, M.y - 3, { align: 'center', fett: true, groesse: 8 });
    if (MB) { pille(c, MB.x, MB.y, MB.w, MB.h, '#e6f7f3'); buchBild(c, MB.x + MB.w / 2, MB.y + MB.h / 2); }
    karten.forEach(function (k, i) {
      var G = Dorf.Gerichte.hole(k.id), aktiv = i === wahl, hop = aktiv && !RUHIG ? Math.round(Math.abs(Math.sin(z * 4)) * 2) : 0;
      var dx = 0;
      if (wk && wk.id === k.id && wk.t < WK) dx = Math.round(Math.sin(wk.t * 40) * 4 * (1 - wk.t / WK));
      var x = k.x + dx, y = k.y - hop, mx = x + k.w / 2;
      pille(c, x, y, k.w, k.h, aktiv ? '#ffe3ec' : '#fff4dc');
      if (aktiv) r(c, x + 2, y + k.h - 4, k.w - 4, 2, '#ff9fb8');
      kreis(c, x + 7, y + 7, 4, P.kontur); kreis(c, x + 7, y + 7, 3, aktiv ? '#ff9fb8' : '#e2d6f5');
      ziffern(c, String(i + 1), x + 7, y + 5, { align: 'center', farbe: aktiv ? '#ffffff' : P.kontur });
      var pr = Dorf.Garten && st.vorrat ? Dorf.Garten.pruefe(st.vorrat, G) : { ok: true, frisch: false, fehlt: {} };
      // grosser Teller auf farbigem Grund, blass, wenn etwas fehlt
      kreis(c, mx, y + 20, 14, P.kontur); kreis(c, mx, y + 20, 13, PLATTE[k.id] || '#fff0c2');
      if (!pr.ok) c.globalAlpha = 0.5;
      grosserTeller(c, k.id, mx, y + 20, 3);
      c.globalAlpha = 1;
      if (pr.ok && (pr.frisch || !G.immer)) haken(c, mx + 14, y + 29);
      // wer es am liebsten isst: kleines Gesicht mit Herz oben rechts
      var fan = liebhaber(st, k.id);
      if (fan) { zeichneGesicht(c, fan, x + k.w - 11, y + 11, 0, 0, { skala: 0.7, ohneHerzen: true, zeit: st.zeit }); herz(c, x + k.w - 7, y + 17, '#ff7fa0'); }
      text(R, G.name, mx, y + 36, { align: 'center', fett: true, groesse: 7 });
      // Zutaten als Bilder: jede Einheit einzeln, fehlende gestrichelt; das Ei im goldenen Fach
      var teile = [], fehlt = [];
      Object.keys(G.zutaten || {}).forEach(function (art) {
        var hat = (st.vorrat && st.vorrat[art]) || 0;
        for (var j = 0; j < G.zutaten[art]; j++) { var da = G.immer ? true : hat > j; if (G.immer && hat <= j) da = 'blass'; teile.push({ art: art, da: da }); if (!da) fehlt.push(art); }
      });
      var ei = !!(G.bonus && G.bonus.ei), breite = teile.length * 11 + (ei ? 19 : 0), zx = Math.round(mx - breite / 2 + 5), zy = y + 54;
      teile.forEach(function (tz) {
        if (tz.da === true) zeichneZutat(c, tz.art, zx, zy, false);
        else if (tz.da === 'blass') zeichneZutat(c, tz.art, zx, zy, true);
        else zutatFehlt(c, zx, zy);
        zx += 11;
      });
      if (ei) {
        var plus = pr.bonus ? '#4f9a6a' : '#b49ab0';
        r(c, zx - 3, zy, 5, 1, plus); r(c, zx - 1, zy - 2, 1, 5, plus);
        eiFach(c, zx + 9, zy, !!pr.bonus);
      }
      info.karten.push({ id: k.id, ok: !!pr.ok, frisch: !!pr.frisch, bonus: !!pr.bonus, ei: ei, fehlt: fehlt, fan: fan ? fan.name : null, dx: dx });
    });
    text(R, 'Tippen oder 1, 2, 3 · Pfeile und E · B: Buch · Esc: zurück', W / 2, M.y + M.h - 8, { align: 'center', groesse: 6, farbe: '#7a5a9a' });
    R.letzteMenue = info;
  }

  // gruener Haken im Kreis, Mitte (x, y)
  function haken(c, x, y) {
    kreis(c, x, y, 5, P.kontur); kreis(c, x, y, 4, '#6ccc8a');
    r(c, x - 3, y, 2, 2, '#ffffff'); r(c, x - 1, y + 1, 2, 2, '#ffffff'); r(c, x + 1, y - 1, 1, 2, '#ffffff'); r(c, x + 2, y - 2, 1, 2, '#ffffff');
  }
  // dickes X, Mitte (x, y)
  function kreuz(c, x, y, col) {
    for (var i = -3; i <= 3; i++) { r(c, x + i - 1, y + i - 1, 3, 3, col); r(c, x - i - 1, y + i - 1, 3, 3, col); }
  }
  // Dreieck wie beim Abspielen: weiterspielen
  function weiterDreieck(c, x, y, col) {
    kreis(c, x, y, 8, P.kontur); kreis(c, x, y, 7, P.uiFlaeche);
    for (var i = 0; i < 7; i++) { var hh = 13 - 2 * i; r(c, x - 3 + i, y - (hh - 1) / 2, 1, hh, P.kontur); }
    for (var j = 0; j < 5; j++) { var h2 = 9 - 2 * j; r(c, x - 2 + j, y - (h2 - 1) / 2, 1, h2, col); }
  }
  // Kreispfeil (Neu anfangen), Mitte (x, y)
  function kreispfeil(c, x, y, col) {
    kreis(c, x, y, 7, P.kontur); kreis(c, x, y, 6, col); kreis(c, x, y, 4, P.kontur); kreis(c, x, y, 3, P.box);
    r(c, x + 1, y - 8, 7, 7, P.box);
    r(c, x + 1, y - 9, 1, 7, P.kontur); r(c, x + 2, y - 8, 1, 5, P.kontur);
    r(c, x - 1, y - 7, 2, 3, col);
    r(c, x + 3, y - 4, 5, 1, P.kontur); r(c, x + 4, y - 5, 3, 1, P.kontur); r(c, x + 5, y - 6, 1, 1, P.kontur);
    r(c, x + 4, y - 3, 3, 3, P.kontur); r(c, x + 5, y - 3, 1, 2, col);
  }
  // Rueckfrage "Neu anfangen?" (ab v0.6): Bild links Nein (X), rechts Ja (Kreispfeil)
  function zeichneFrage(R, st) {
    var c = R.ctx, F = Dorf.Spiel.FRAGE, f = st.frage, t = f.t || 0;
    c.fillStyle = 'rgba(75,58,90,0.55)'; c.fillRect(0, 0, W, H);
    pille(c, F.x, F.y, F.w, F.h, P.box);
    kreispfeil(c, W / 2, F.y + 16, '#ff9fb8');
    text(R, 'Neu anfangen?', W / 2, F.y + 27, { align: 'center', fett: true, groesse: 10 });
    text(R, 'Alles beginnt wieder bei Tag 1.', W / 2, F.y + 40, { align: 'center', groesse: 6, farbe: '#7a5a9a' });
    [F.nein, F.ja].forEach(function (k, i) {
      var aktiv = f.wahl === i, hop = aktiv && !RUHIG ? Math.round(Math.abs(Math.sin(t * 4)) * 2) : 0, y = k.y - hop;
      pille(c, k.x - 1, y - 1, k.w + 2, k.h + 2, aktiv ? P.kontur : '#d8cce6');
      pille(c, k.x, y, k.w, k.h, i === 0 ? '#d4f3dc' : '#ffd1e0');
      // ab v0.7: Nein heisst weiterspielen, darum ein gruenes Spielen Dreieck statt eines Kreuzes
      if (i === 0) weiterDreieck(c, k.x + k.w / 2, y + 17, P.akzentErnten || '#7ed492'); else kreispfeil(c, k.x + k.w / 2, y + 17, '#ff7fa0');
      text(R, i === 0 ? 'Nein' : 'Ja, neu', k.x + k.w / 2, y + 31, { align: 'center', fett: true, groesse: 8 });
      if (aktiv) r(c, k.x + 6, y + k.h - 4, k.w - 12, 2, i === 0 ? '#6ccc8a' : '#ff9fb8');
    });
  }

  // ---------- Text (scharf auf eigener UI-Ebene) ----------
  function text(R, s, x, y, o) {
    o = o || {};
    var c = R.ui || R.ctx;
    c.font = (o.fett ? 'bold ' : '') + (o.groesse || 7) + 'px ' + SCHRIFT;
    c.textAlign = o.align || 'left'; c.textBaseline = 'top';
    if (o.schatten) { c.fillStyle = o.schatten; c.fillText(s, x + 0.5, y + 0.5); }
    // ab v0.7: heller Rand um Schrift direkt auf dem Spielbild
    if (o.rand && c.strokeText) { c.lineJoin = 'round'; c.lineWidth = o.randBreite || 1.6; c.strokeStyle = o.rand; c.strokeText(s, x, y); }
    c.fillStyle = o.farbe || P.kontur; c.fillText(s, x, y);
  }

  // ---------- Licht und Laternen (ab v0.7) ----------
  var LATERNEN = [[17, 10], [11, 15], [28, 15], [11, 20], [28, 20]];
  function lichtQuellen(R, karte) {
    if (R.lichtFuer === karte && R.lichtQuellen) return R.lichtQuellen;
    var T = Dorf.Karte.T, fenster = [], laternen = [];
    for (var y = 0; y < karte.h; y++) for (var x = 0; x < karte.w; x++) {
      var t = karte.tile(x, y);
      if (t !== T.WAND) continue;
      var front = !istWand(karte.tile(x, y + 1));
      if (front && hash(x, y) % 3 === 0) fenster.push({ x: x * K + 8, y: y * K + 13 });
    }
    LATERNEN.forEach(function (p) {
      var t = karte.tile(p[0], p[1]);
      if (t === T.GRAS || t === T.WIESE || t === T.PFLASTER || t === T.WEG) laternen.push({ x: p[0] * K + 8, y: p[1] * K + 14 });
    });
    R.lichtFuer = karte; R.lichtQuellen = { fenster: fenster, laternen: laternen };
    return R.lichtQuellen;
  }
  function zeichneLaterne(c, sx, sy, an) {
    // Pfosten aus Holz mit kleinem Glaskasten, Fuss bei (sx, sy)
    ellipse(c, sx, sy + 1, 4, 1, P.schatten);
    r(c, sx - 1, sy - 15, 3, 16, P.konturHolz); r(c, sx, sy - 14, 1, 14, P.holz);
    rr(c, sx - 3, sy - 22, 7, 8, P.konturHolz); r(c, sx - 2, sy - 21, 5, 6, an ? P.laterne : '#efe6da');
    if (an) r(c, sx - 1, sy - 20, 2, 2, P.fensterKern);
    r(c, sx - 3, sy - 23, 7, 1, P.konturHolz);
  }
  function glanz(c, x, y, rad, col, a) {
    // stufige Lichtkreise (kein weicher Verlauf, passt zum Pixelbild)
    c.globalAlpha = a * 0.09; kreis(c, x, y, rad, col);
    c.globalAlpha = a * 0.11; kreis(c, x, y, Math.round(rad * 0.66), col);
    c.globalAlpha = a * 0.15; kreis(c, x, y, Math.round(rad * 0.33), col);
    c.globalAlpha = 1;
  }
  function zeichneLicht(R, st, cx, cy) {
    var c = R.ctx, L = Dorf.Uhr.licht(st.uhr, zeitFuerUhr(st));
    R.letztesLicht = L;
    if (L.r + L.g + L.b < 765) {
      var vorher = c.globalCompositeOperation;
      c.globalCompositeOperation = 'multiply';
      if (c.globalCompositeOperation === 'multiply') { c.fillStyle = 'rgb(' + L.r + ',' + L.g + ',' + L.b + ')'; c.fillRect(0, 0, W, H); }
      else {
        // altes Geraet ohne Multiplizieren: wie bis v0.6 eine durchsichtige Farbschicht
        var tn = Dorf.Uhr.toenung(st.uhr);
        if (tn.a > 0.001) { c.fillStyle = 'rgba(' + tn.r + ',' + tn.g + ',' + tn.b + ',' + Math.max(tn.a, L.daemmerung * 0.45).toFixed(3) + ')'; c.fillRect(0, 0, W, H); }
      }
      c.globalCompositeOperation = vorher || 'source-over';
    }
    var an = st.abend ? Dorf.Spiel.LAMPEN : (st.lampenAn || 0), q = lichtQuellen(R, st.karte), glut = st.abend ? 1 : L.glut;
    R.letzteLampen = an;
    if (glut <= 0.02 || an <= 0) { st.bielLaterne = false; return; }
    function sicht(x, y, rad) { return x > -rad && x < W + rad && y > -rad && y < H + rad; }
    var feuer = [];
    // erst die Fenster, dann die Laternen
    q.fenster.forEach(function (f) {
      var sx = f.x - cx, sy = f.y - cy;
      if (!sicht(sx, sy, 20)) return;
      c.globalAlpha = Math.min(1, glut * 1.2); r(c, sx - 3, sy - 1, 6, 3, P.fensterNacht); r(c, sx - 3, sy - 1, 2, 1, P.fensterKern); c.globalAlpha = 1;
      feuer.push([sx, sy, 20, '#ffc46b']);
    });
    q.laternen.forEach(function (l, i) {
      if (i + 2 > an) return;
      var sx = l.x - cx, sy = l.y - cy;
      if (!sicht(sx, sy - 18, 26)) return;
      r(c, sx - 2, sy - 21, 5, 6, P.laterne); r(c, sx - 1, sy - 20, 2, 2, P.fensterKern);
      feuer.push([sx, sy - 18, 26, P.glutWarm]);
    });
    var hx = 5 * K + 8 - cx, hy = 2 * K + 8 - cy;
    if (sicht(hx, hy, 24)) feuer.push([hx, hy, 24, P.herdGlut]);
    // Biel nimmt ab dem spaeten Abend eine kleine Laterne mit
    st.bielLaterne = glut > 0.6;
    if (st.bielLaterne && st.spieler) {
      var bx = Math.round(st.spieler.x - cx) + 7, by = Math.round(st.spieler.y - cy) - 8;
      rr(c, bx - 2, by - 2, 5, 6, P.konturHolz); r(c, bx - 1, by - 1, 3, 4, P.laterne); r(c, bx, by - 4, 1, 2, P.konturHolz);
      feuer.push([bx, by + 1, 30, P.laterne]);
    }
    var vorher2 = c.globalCompositeOperation;
    c.globalCompositeOperation = 'lighter';
    feuer.forEach(function (f) { glanz(c, f[0], f[1], f[2], f[3], glut); });
    c.globalCompositeOperation = vorher2 || 'source-over';
  }
  // Steinkreis um den Brunnen
  function zeichneBrunnenRing(c, karte, cx, cy) {
    var mx = karte.brunnen.x * K + 16 - cx, my = karte.brunnen.y * K + 18 - cy;
    for (var i = 0; i < 14; i++) {
      var w = i / 14 * Math.PI * 2, x = Math.round(mx + Math.cos(w) * 24), y = Math.round(my + Math.sin(w) * 17);
      rr(c, x - 2, y - 1, 5, 3, P.stein2); r(c, x - 1, y - 1, 3, 1, P.stein);
    }
  }

  // ---------- HUD (ab v0.7: Tagesbogen, Gesichter mit Herzen, Korb; ohne Text fuer die Kinder) ----------
  function himmel(L) {
    var tag = [159, 212, 240], gold = [255, 179, 107], nacht = [74, 74, 154];
    var s = L.sonne, n = L.mond, f;
    var rosa = [255, 198, 220];
    function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
    // am Nachmittag ueber Rosa zu Gold, damit es nicht grau wird
    if (s < 0.75) f = tag; else { var t = Math.min(1, (s - 0.75) / 0.25); f = t < 0.5 ? mix(tag, rosa, t * 2) : mix(rosa, gold, t * 2 - 1); }
    f = [f[0] + (nacht[0] - f[0]) * n, f[1] + (nacht[1] - f[1]) * n, f[2] + (nacht[2] - f[2]) * n];
    return 'rgb(' + Math.round(f[0]) + ',' + Math.round(f[1]) + ',' + Math.round(f[2]) + ')';
  }
  // ab v0.11: Uhr und Licht laufen mit den eingestellten Minuten des Bildes
  function zeitFuerUhr(st) { return Dorf.Spiel && Dorf.Spiel.uhrZeit ? Dorf.Spiel.uhrZeit(st) : st.spielzeit; }
  function zeichneTagesbogen(c, st, L) {
    var x = 2, y = 2, w = 42, h = 22;
    pille(c, x, y, w, h, P.uiFlaeche);
    c.save(); c.beginPath(); c.rect(x + 2, y + 2, w - 4, h - 4); c.clip();
    r(c, x + 2, y + 2, w - 4, h - 4, himmel(L));
    if (L.mond > 0) for (var s = 0; s < 6; s++) { var hs = hash(s, 11); c.globalAlpha = L.mond; r(c, x + 4 + hs % 34, y + 3 + (hs >> 6) % 9, 1, 1, '#fff6c8'); c.globalAlpha = 1; }
    var mx = x + w / 2, my = y + h - 3;
    if (L.sonne < 1) {
      var ws = Math.PI * (1 - L.sonne), sx = Math.round(mx + Math.cos(ws) * 15), sy = Math.round(my - Math.sin(ws) * 13);
      kreis(c, sx, sy, 4, '#ffb84d'); kreis(c, sx, sy, 3, '#ffe27a'); r(c, sx - 1, sy - 2, 2, 1, '#fff6c8');
    }
    if (L.mond > 0) {
      var wm = Math.PI * (1 - 0.45 * L.mond), mxx = Math.round(mx + Math.cos(wm) * 15), myy = Math.round(my - Math.sin(wm) * 13);
      kreis(c, mxx, myy, 3, P.mond); kreis(c, mxx + 2, myy - 1, 2, himmel(L));
    }
    // Huegel unten
    ellipse(c, x + 10, y + h - 1, 12, 4, P.gras2); ellipse(c, x + 30, y + h, 14, 4, P.gras);
    c.restore();
    // ab v0.11: zwei Minuten vor Schluss geht oben rechts im Himmel langsam ein kleiner Mond auf (kein Blinken)
    if (st.bald !== null && st.bald !== undefined && !st.abend) {
      var a = Math.min(1, st.bald / 2);
      c.globalAlpha = a;
      var bx = x + w - 9, by = y + 8;
      c.save(); c.beginPath(); c.rect(x + 2, y + 2, w - 4, h - 4); c.clip();
      kreis(c, bx, by, 4, P.mond); kreis(c, bx + 2, by - 1, 3, himmel(L));
      c.restore();
      c.globalAlpha = 1;
    }
  }
  var CHIP = { Mia: '#ffdbe6', Jonas: '#d4f2ee', Padrina: '#e6defb' };
  function zeichneGesicht(c, gs, cx, cy, n, hop, o) {
    o = o || {};
    var voll = n >= 5, sk = o.skala || 1;
    c.save();
    if (sk !== 1) { c.translate(cx, cy - hop); c.scale(sk, sk); c.translate(-cx, -(cy - hop)); }
    if (o.spricht) kreis(c, cx, cy - hop, 12, gs.aussehen.farbe || P.herzVoll);
    if (voll) kreis(c, cx, cy - hop, 11, P.herzGold);
    kreis(c, cx, cy - hop, 10, P.kontur); kreis(c, cx, cy - hop, 9, CHIP[gs.name] || P.uiFlaeche2);
    c.save(); c.beginPath(); c.rect(cx - 9, cy - hop - 9, 19, 19); c.clip();
    var m = masse(gs.aussehen);
    zeichnePerson(c, cx, cy - hop + m.hoehe - 1 - Math.round(m.kopf / 2) + 2, gs.aussehen, 'unten', 0, { ruhig: true, zeit: o.zeit });
    c.restore();
    c.restore();
    if (o.ohneHerzen) return;
    for (var i = 0; i < 5; i++) {
      var hx = cx - 14 + i * 6, hy = cy + 12;
      if (i < n) { r(c, hx - 1, hy, 7, 4, voll ? '#c98a1a' : '#b8325c'); r(c, hx, hy + 3, 5, 2, voll ? '#c98a1a' : '#b8325c'); herz(c, hx, hy, voll ? P.herzGold : P.herzVoll); r(c, hx, hy, 1, 1, P.herzLicht); }
      else herz(c, hx, hy, P.herzLeer);
    }
  }
  function zeichneHud(R, st) {
    var c = R.ctx, L = R.letztesLicht || Dorf.Uhr.licht(st.uhr, zeitFuerUhr(st)), info = { tag: st.uhr.tag, gaeste: [], teller: (st.teller || []).length };
    zeichneTagesbogen(c, st, L);
    var spricht = st.blase && !st.menue && st.blase.sprecher;
    st.gaeste.forEach(function (g, i) {
      var n = Dorf.Glueck ? Dorf.Glueck.herzen(g) : 0, fliegt = imFlug(st.herzFlug, 'id', g.id), zeige = Math.max(0, n - fliegt);
      var redet = spricht === g.name, hop = redet && !RUHIG ? Math.round(Math.abs(Math.sin(st.zeit * 5)) * 2) : 0;
      var puls = (st.chipPuls && st.chipPuls[g.id]) || 0, sk = redet ? 1.15 : 1;
      if (puls > 0) sk = Math.max(sk, 1 + 0.2 * Math.sin((1 - puls / 0.35) * Math.PI));
      zeichneGesicht(c, g, 60 + i * 36, 11, zeige, hop, { skala: sk, spricht: redet, zeit: st.zeit });
      info.gaeste.push({ name: g.name, herzen: n, gezeigt: zeige, skala: sk, spricht: redet });
    });
    var tl = st.teller || [];
    if (tl.length > 0) {
      // Teller auf der Tafel: bis zu drei uebereinander, ohne Zahl
      var tx = 60 + st.gaeste.length * 36 - 4, nt = Math.min(3, tl.length);
      pille(c, tx - 6, 4, 18 + nt * 4, 14, P.uiFlaeche);
      for (var ti = 0; ti < nt; ti++) zeichneTeller(c, tl[ti], tx + 2 + ti * 4, 11 - ti);
    }
    if (st.tagesziel && st.tagesziel.erreicht && !RUHIG) for (var k = 0; k < 3; k++) { var ph = (st.zeit * 1.5 + k / 3) % 1; c.globalAlpha = 1 - ph; r(c, 50 + k * 36, 2 + Math.round(ph * 4), 1, 3, '#fff6c8'); r(c, 49 + k * 36, 3 + Math.round(ph * 4), 3, 1, '#fff6c8'); c.globalAlpha = 1; }
    info.korb = zeichneVorrat(R, st);
    R.letzteHud = info;
  }
  function zeichneTipps(c, st) {
    (st.tipps || []).forEach(function (tp) {
      var d = (Dorf.Spiel && Dorf.Spiel.TIPP_DAUER) || 0.3, f = Math.min(1, tp.t / d), rad = 3 + f * 7;
      c.globalAlpha = 0.7 * (1 - f); c.strokeStyle = P.uiFlaeche; c.lineWidth = 1.5;
      c.beginPath(); c.arc(tp.x, tp.y, rad, 0, Math.PI * 2); c.stroke(); c.globalAlpha = 1;
    });
  }
  // Iris: am Tagesende schliesst sich ein Kreis um Biel
  function zeichneIris(c, st, cx, cy, f) {
    var mx = Math.round(st.spieler.x - cx), my = Math.round(st.spieler.y - cy) - 10, rad = Math.max(0, 210 * (1 - f * f));
    c.fillStyle = P.konturTief; c.beginPath(); c.rect(0, 0, W, H); c.arc(mx, my, rad, 0, Math.PI * 2, true); c.fill('evenodd');
  }

  // ---------- Sticker, Bilderbuch und Abendszene (ab v0.9) ----------
  // runder Sticker mit weissem Rand, Mitte (x, y); fehlt er, nur ein gestrichelter Kreis mit ganz blassem Bild
  function zeichneSticker(c, s, x, y, rad, da, skala) {
    if (!s) return;
    var k = skala || 2;
    if (da) {
      kreis(c, x, y + 1, rad + 1, 'rgba(75,58,90,0.25)');
      kreis(c, x, y, rad + 1, P.kontur); kreis(c, x, y, rad, '#ffffff'); kreis(c, x, y, rad - 2, s.farbe);
      c.save(); c.translate(x, y); c.scale(k, k); zeichneSymbol(c, s.bild, 0, 0); c.restore();
      r(c, x - Math.round(rad * 0.5), y - Math.round(rad * 0.6), 2, 1, 'rgba(255,255,255,0.8)');
    } else {
      kreis(c, x, y, rad, '#f8eff4'); gestrichelt(c, x, y, rad);
      c.globalAlpha = 0.16; c.save(); c.translate(x, y); c.scale(2, 2); zeichneSymbol(c, s.bild, 0, 0); c.restore(); c.globalAlpha = 1;
    }
  }
  function stickerVon(id) { return Dorf.Sticker ? Dorf.Sticker.hole(id) : null; }
  function kleinesDreieck(c, x, y, d, col) { for (var i = 0; i < 4; i++) r(c, x + (d > 0 ? i : -i), y - 3 + i, 1, 7 - 2 * i, col); }

  // Bilderbuch: links und rechts eine Seite, Reiter oben (Topf = Rezepte, Stern = Sticker), X zum Zumachen
  function zeichneBuch(R, st) {
    var c = R.ctx, B = Dorf.Spiel.BUCH, b = st.buch, seite = b.seite, ALB = Dorf.Spiel.ALBUM_SEITE;
    var HEU = Dorf.Spiel.HEUTE_SEITE, N = Dorf.Spiel.buchSeiten ? Dorf.Spiel.buchSeiten(st) : Dorf.Spiel.BUCH_SEITEN;
    var info = { seite: seite, album: seite === ALB, sticker: [], rezept: null, heute: null, reiter: 0 };
    c.fillStyle = 'rgba(58,44,80,0.5)'; c.fillRect(0, 0, W, H);
    var sx = b.stups > 0 ? Math.round(Math.sin(b.stups * 40) * 2 * (b.richtung || 1)) : 0;
    B.reiter.forEach(function (rt) {
      if (rt.abend && !st.abend) return;
      info.reiter++;
      var an = rt.seite === ALB || rt.seite === HEU ? seite === rt.seite : seite < ALB;
      pille(c, rt.x + sx, rt.y - (an ? 2 : 0), rt.w, rt.h + 4, an ? '#ffe3ec' : '#e6dcef');
      if (rt.seite === ALB) muster(c, rt.x + sx + rt.w / 2, rt.y + 6 - (an ? 2 : 0), BILD.stern[0], BILD.stern[1]);
      else if (rt.seite === HEU) muster(c, rt.x + sx + rt.w / 2, rt.y + 6 - (an ? 2 : 0), BILD.mond[0], BILD.mond[1]);
      else zeichneSymbol(c, 'topf', rt.x + sx + rt.w / 2, rt.y + 7 - (an ? 2 : 0));
    });
    var x0 = B.x + sx, mx = x0 + B.w / 2, ph = B.h - 6, pw = B.w / 2 - 4;
    rr(c, x0 - 2, B.y - 2, B.w + 4, B.h + 4, P.kontur); rr(c, x0 - 1, B.y - 1, B.w + 2, B.h + 2, '#c8789a');
    rr(c, x0 + 3, B.y + 3, pw, ph, '#fff8ec'); rr(c, mx + 1, B.y + 3, pw, ph, '#fff8ec');
    r(c, mx - 1, B.y + 2, 2, B.h - 4, '#b0607e'); r(c, mx - 3, B.y + 3, 2, ph, '#f1e4d4'); r(c, mx + 1, B.y + 3, 2, ph, '#f1e4d4');
    if (seite === HEU) {
      info.heute = zeichneHeute(R, st, x0, mx);
    } else if (seite === ALB) {
      // Album: 16 runde Sticker (ab v0.11, 4 mal 4), die fehlenden gestrichelt; der neueste leuchtet
      var liste = Dorf.Sticker ? Dorf.Sticker.LISTE : [], album = st.album || {}, neu = st.neuerSticker, beste = 0;
      if (!neu) liste.forEach(function (s) { if (album[s.id] > beste) { beste = album[s.id]; neu = s.id; } });
      var sp = [x0 + 36, x0 + 98, x0 + 170, x0 + 232], zl = [B.y + 22, B.y + 51, B.y + 80, B.y + 109];
      liste.forEach(function (s, i) {
        var x = sp[i % 4], y = zl[Math.floor(i / 4)], da = !!album[s.id];
        if (y === undefined) return;
        if (da && s.id === neu) { c.globalAlpha = RUHIG ? 0.55 : 0.45 + 0.25 * Math.sin(st.zeit * Math.PI * 2); kreis(c, x, y, 15, '#fff3a8'); c.globalAlpha = 1; }
        zeichneSticker(c, s, x, y, 12, da);
        info.sticker.push({ id: s.id, da: da, neu: da && s.id === neu });
      });
      // ab v0.10: wie viele schon da sind, in Pixelziffern
      var hat = Dorf.Sticker && Dorf.Sticker.anzahl ? Dorf.Sticker.anzahl(album) : 0;
      muster(c, x0 + 56, B.y + B.h - 8, BILD.stern[0], BILD.stern[1]);
      ziffern(c, hat + '/' + liste.length, x0 + 64, B.y + B.h - 10, { farbe: P.kontur });
      info.anzahl = hat;
    } else {
      var G = Dorf.Gerichte.hole(Dorf.Gerichte.REIHE[seite]) || Dorf.Gerichte.hole('paamboli'), id = G.id, lx = x0 + 68, rx = mx + 66;
      info.rezept = id;
      // links: grosser Teller auf farbigem Grund, darunter wer es am liebsten isst
      text(R, G.name, lx, B.y + 8, { align: 'center', fett: true, groesse: 8 });
      kreis(c, lx, B.y + 58, 31, P.kontur); kreis(c, lx, B.y + 58, 30, PLATTE[id] || '#fff0c2');
      grosserTeller(c, id, lx, B.y + 58, 6);
      var fan = liebhaber(st, id);
      if (fan) {
        zeichneGesicht(c, fan, lx - 12, B.y + 114, 0, 0, { ohneHerzen: true, zeit: st.zeit });
        c.save(); c.translate(lx + 8, B.y + 110); c.scale(2, 2); herz(c, 0, 0, '#ff7fa0'); c.restore();
      }
      // rechts: Zutaten, Pfeil nach unten, so viele Teller gibt es; darunter das Ei als Extra
      var teile = [];
      Object.keys(G.zutaten || {}).forEach(function (art) { for (var j = 0; j < G.zutaten[art]; j++) teile.push(art); });
      var zx = rx - (teile.length - 1) * 11;
      teile.forEach(function (art, j) {
        c.save(); c.translate(zx + j * 22, B.y + 24); c.scale(2, 2); zeichneZutat(c, art, 0, 0, false); c.restore();
        if (j < teile.length - 1) { r(c, zx + j * 22 + 9, B.y + 24, 5, 1, P.kontur); r(c, zx + j * 22 + 11, B.y + 22, 1, 5, P.kontur); }
      });
      r(c, rx - 1, B.y + 40, 3, 9, '#d08aa8'); for (var a = 0; a < 4; a++) r(c, rx - 4 + a, B.y + 49 + a, 9 - 2 * a, 1, '#d08aa8');
      var n = G.portionen || 2, tx = rx - (n - 1) * 8;
      for (var t = 0; t < n; t++) { grosserTeller(c, id, tx + t * 16, B.y + 66, 2); }
      if (G.bonus && G.bonus.ei) {
        var ey = B.y + 104;
        c.save(); c.translate(rx - 30, ey); c.scale(2, 2); eiFach(c, 0, 0, true); c.restore();
        for (var k = 0; k < 10; k++) r(c, rx - 14 + k, ey, 1, 1, P.kontur);
        kleinesDreieck(c, rx - 3, ey, 1, P.kontur);
        r(c, rx + 6, ey, 5, 1, '#4f9a6a'); r(c, rx + 8, ey - 2, 1, 5, '#4f9a6a');
        grosserTeller(c, id, rx + 24, ey, 2);
      } else if (G.immer) {
        // geht immer: Brot aus der Speisekammer, frische Zutaten geben einen Teller mehr
        var fy = B.y + 104;
        glitzer(c, rx - 30, fy - 6, st.zeit, 0);
        c.save(); c.translate(rx - 30, fy); c.scale(2, 2); zeichneZutat(c, 'tomate', 0, 0, false); c.restore();
        kleinesDreieck(c, rx - 3, fy, 1, P.kontur);
        r(c, rx + 6, fy, 5, 1, '#4f9a6a'); r(c, rx + 8, fy - 2, 1, 5, '#4f9a6a');
        grosserTeller(c, id, rx + 24, fy, 2);
      }
    }
    // Seitenpunkte und kleine Blaetter-Pfeile unten in den Ecken
    for (var p = 0; p < N; p++) { rr(c, mx - (N - 1) * 5 + p * 10 + (p >= ALB ? 4 : 0) + (p >= HEU ? 4 : 0) - (N > ALB + 1 ? 4 : 0) - 2, B.y + B.h - 10, 5, 5, p === seite ? '#ff7fa0' : '#e2d6f5'); }
    if (seite > 0) kleinesDreieck(c, x0 + 14, B.y + B.h - 10, -1, '#d08aa8');
    if (seite < N - 1) kleinesDreieck(c, x0 + B.w - 14, B.y + B.h - 10, 1, '#d08aa8');
    // Umblaettern: eine Seite klappt ueber den Ruecken
    if (b.blatt > 0) {
      var f = 1 - b.blatt / 0.25, breite = Math.round(pw * Math.abs(1 - 2 * f)), rechts = (f < 0.5) === (b.richtung > 0);
      var bx = rechts ? mx + 1 : mx - 1 - breite;
      if (breite > 1) { rr(c, bx, B.y + 3, breite, ph, '#f6ead8'); r(c, rechts ? bx + breite - 1 : bx, B.y + 3, 1, ph, '#e0cdb6'); }
    }
    var Z = B.zu; pille(c, Z.x, Z.y, Z.w, Z.h, '#ffd1e0'); kreuz(c, Z.x + Z.w / 2, Z.y + Z.h / 2, '#b8325c');
    return info;
  }

  // ab v0.12: Abendbuch, Seite "Heute". Links der Sticker von heute ganz gross, rechts als Bilder, was heute geklappt hat.
  // Ruhig und ohne Wertung: kein Zaehler, keine Sterne, nichts blinkt. Der Text wird vorgelesen (wenn die Eltern es erlauben).
  function zeichneHeute(R, st, x0, mx) {
    var c = R.ctx, B = Dorf.Spiel.BUCH, S = Dorf.Sticker, lx = x0 + 68, rx = mx + 66;
    var ids = S && S.heuteSticker ? S.heuteSticker(st) : [], taten = S && S.heuteTaten ? S.heuteTaten(st.heute) : [];
    var info = { sticker: ids.slice(), taten: taten.map(function (t) { return t.tat; }), mond: !ids.length };
    text(R, 'Heute', lx, B.y + 8, { align: 'center', fett: true, groesse: 8 });
    if (ids.length === 1) {
      var s1 = stickerVon(ids[0]);
      c.globalAlpha = 0.5; kreis(c, lx, B.y + 60, 36, '#fff3a8'); c.globalAlpha = 1;
      zeichneSticker(c, s1, lx, B.y + 60, 30, true, 4);
      text(R, s1.name || '', lx, B.y + 100, { align: 'center', fett: true, groesse: 8 });
    } else if (ids.length > 1) {
      ids.forEach(function (id, i) {
        var s2 = stickerVon(id), x = lx + (i ? 28 : -28);
        zeichneSticker(c, s2, x, B.y + 58, 24, true, 3);
        text(R, s2.name || '', x, B.y + 92, { align: 'center', fett: true, groesse: 6 });
      });
    } else {
      // Album schon voll: ein grosser Mond zum Gute Nacht sagen
      c.globalAlpha = 0.25; kreis(c, lx, B.y + 60, 30, '#fff3c4'); c.globalAlpha = 1;
      kreis(c, lx, B.y + 60, 21, P.kontur); kreis(c, lx, B.y + 60, 20, '#fff3c4'); kreis(c, lx - 6, B.y + 54, 4, '#f1e2a8'); kreis(c, lx + 7, B.y + 66, 3, '#f1e2a8');
      text(R, 'Gute Nacht', lx, B.y + 100, { align: 'center', fett: true, groesse: 8 });
    }
    // rechts: bis zu 6 Bilder in zwei Reihen
    if (taten.length) {
      var sp = taten.length <= 3 ? taten.length : 3;
      taten.forEach(function (t, i) {
        var reihe = Math.floor(i / 3), inReihe = Math.min(3, taten.length - reihe * 3);
        var x = rx + (i % 3 - (inReihe - 1) / 2) * 34, y = B.y + 40 + reihe * 40;
        kreis(c, x, y, 15, '#ffe9f0'); kreis(c, x, y, 14, '#fff8ec'); kreis(c, x, y, 13, '#ffeef4');
        c.save(); c.translate(x, y); c.scale(2, 2); zeichneSymbol(c, t.bild, 0, 0); c.restore();
      });
      info.spalten = sp;
    } else {
      c.save(); c.translate(rx, B.y + 56); c.scale(3, 3); zeichneSymbol(c, 'sonne', 0, 0); c.restore();
      text(R, 'Ein ruhiger Tag', rx, B.y + 90, { align: 'center', groesse: 7 });
    }
    return info;
  }

  // Abend "Bona nit": Nachthimmel, Lichterkette, die Gaeste an der langen Tafel zaehlen ihre Herzen hoch,
  // Bruna schlaeft, danach ploppt der Sticker auf und fliegt zum Buch-Knopf. Die Sonne unten startet den naechsten Tag.
  function zeichneAbendSzene(R, st, seit) {
    var c = R.ctx, A = (Dorf.Spiel && Dorf.Spiel.ABEND) || { herzStart: 1.5, herzTakt: 0.26, versatz: 0.2, sticker: 3.3 }, zeit = st.zeit;
    var info = { herzen: [], sticker: null, bereit: false, sterne: 20 };
    var band = ['#2b2150', '#33285c', '#3c3068', '#463874'];
    for (var i = 0; i < 4; i++) r(c, 0, i * 24, W, 24, band[i]);
    r(c, 0, 96, W, H - 96, '#5a4a7e'); r(c, 0, 96, W, 1, '#6d5c92');
    for (var p = 0; p < 14; p++) { var hp = hash(p, 5); rr(c, hp % W, 112 + (hp >> 8) % 60, 6, 3, '#655489'); }
    // Sterne, langsam funkelnd (unter 2 Hz)
    for (var s = 0; s < 20; s++) {
      var hs = hash(s, 7), stx = 50 + hs % (W - 60), sty = 4 + (hs >> 9) % 80, f = 0.3 + (hs % 4) * 0.3;
      var hell = Math.sin(zeit * Math.PI * 2 * f + s) > 0.35;
      r(c, stx, sty, 1, 1, '#fff6c8');
      if (hell) { r(c, stx - 1, sty, 3, 1, 'rgba(255,246,200,0.7)'); r(c, stx, sty - 1, 1, 3, 'rgba(255,246,200,0.7)'); }
    }
    // Mond
    c.globalAlpha = 0.18; kreis(c, 278, 56, 16, '#fff3c4'); c.globalAlpha = 1;
    kreis(c, 278, 56, 10, P.kontur); kreis(c, 278, 56, 9, '#fff3c4'); kreis(c, 275, 53, 2, '#f1e2a8'); kreis(c, 282, 59, 2, '#f1e2a8'); r(c, 280, 51, 2, 2, '#f1e2a8');
    // Hauswand links mit Fenster, Gecko schlaeft an der Wand
    r(c, 0, 30, 44, 90, '#3a2e58'); r(c, 0, 26, 48, 6, '#4b3b6c'); r(c, 0, 32, 44, 1, '#2a2040');
    rr(c, 10, 52, 16, 14, P.kontur); r(c, 11, 53, 14, 12, '#ffd98a'); r(c, 17, 53, 2, 12, P.kontur); r(c, 11, 58, 14, 1, P.kontur);
    r(c, 7, 52, 3, 14, '#4f8f82'); r(c, 26, 52, 3, 14, '#4f8f82');
    zeichneBougainvillea(c, 22, 22, 3); zeichneBougainvillea(c, 4, 22, 6);
    muster(c, 30, 86, BILD.gecko[0], BILD.gecko[1]);
    // Lichterkette als Bogen von der Hauswand zum Pfosten rechts
    r(c, 305, 22, 2, 94, '#2a2040');
    var lx0 = 44, lx1 = 306;
    for (var x = lx0; x <= lx1; x += 2) { var u = (x - (lx0 + lx1) / 2) / ((lx1 - lx0) / 2); r(c, x, Math.round(22 + 8 * (1 - u * u)), 2, 1, '#2a2040'); }
    var lampen = ['#ffd36e', '#ff9fbf', '#9fe0ff', '#c6f59a'];
    for (var lk = 0, lxx = lx0 + 12; lxx < lx1 - 4; lxx += 22, lk++) {
      var uu = (lxx - (lx0 + lx1) / 2) / ((lx1 - lx0) / 2), ly = Math.round(22 + 8 * (1 - uu * uu)) + 3;
      c.globalAlpha = 0.25; kreis(c, lxx, ly, 5, lampen[lk % 4]); c.globalAlpha = 1;
      kreis(c, lxx, ly, 2, lampen[lk % 4]); r(c, lxx, ly - 3, 1, 1, '#2a2040');
    }
    // Gaeste hinter der langen Tafel, darueber zaehlen ihre Herzen hoch
    var PL = [100, 160, 220], geschafft = st.tagesziel && st.tagesziel.erreicht;
    st.gaeste.forEach(function (gs, gi) {
      var gx = PL[gi % 3] + (gi >= 3 ? 12 : 0), n = Dorf.Glueck ? Dorf.Glueck.herzen(gs) : 0;
      var k = Dorf.Spiel && Dorf.Spiel.abendHerzen ? Dorf.Spiel.abendHerzen(st, gi, seit) : n;
      var zuletzt = k > 0 ? A.herzStart + gi * A.versatz + (k - 1) * A.herzTakt : -9, frisch = k > 0 && seit - zuletzt < 0.22;
      var hop = frisch ? 2 : 0;
      var m = masse(gs.aussehen), fuss = 104;
      zeichnePerson(c, gx, fuss - hop, gs.aussehen, 'unten', 0, { zeit: zeit, ruhig: true });
      var kopf = fuss - m.hoehe - 10, voll = k >= 5;
      for (var h = 0; h < 5; h++) {
        var hx = gx - 14 + h * 6, hy = kopf - (frisch && h === k - 1 ? 2 : 0);
        if (h < k) { r(c, hx - 1, hy, 7, 4, voll ? '#c98a1a' : '#b8325c'); r(c, hx, hy + 3, 5, 2, voll ? '#c98a1a' : '#b8325c'); herz(c, hx, hy, voll ? P.herzGold : P.herzVoll); r(c, hx, hy, 1, 1, P.herzLicht); }
        else herz(c, hx, hy, P.herzLeer);
      }
      info.herzen.push({ name: gs.name, gezeigt: k, ziel: n });
    });
    // Tafel mit Tischtuch, Tellern und zwei Kerzen
    rr(c, 58, 95, 204, 13, P.kontur); r(c, 59, 96, 202, 8, '#fff4dc'); r(c, 59, 104, 202, 2, '#e8d6b8');
    for (var tz = 64; tz < 258; tz += 12) r(c, tz, 96, 6, 8, '#ffe6ee');
    r(c, 66, 108, 3, 12, P.kontur); r(c, 251, 108, 3, 12, P.kontur);
    st.gaeste.forEach(function (gs, gi) { grosserTeller(c, gs.liebling || 'paamboli', PL[gi % 3] + (gi >= 3 ? 12 : 0), 100, 1.2); });
    [130, 190].forEach(function (kx, ki) {
      r(c, kx, 88, 3, 8, P.kontur); r(c, kx + 1, 89, 1, 7, '#fff8ee');
      c.globalAlpha = 0.22; kreis(c, kx + 1, 85, 5, '#ffe9a0'); c.globalAlpha = 1;
      var fl = Math.sin(zeit * 3 + ki) > 0 ? 0 : 1;
      r(c, kx, 84 + fl, 3, 3, '#ffb340'); r(c, kx + 1, 83 + fl, 1, 3, '#fff3a8');
    });
    // Biel steht links, Bruna liegt rechts und schlaeft
    zeichnePerson(c, 46, 130, BIEL, 'unten', 0, { zeit: zeit, ruhig: true });
    c.save(); c.beginPath(); c.rect(0, 0, W, 136); c.clip();
    zeichneEsel(c, { dir: 'links', frame: 0, freude: 0 }, 282, 141, zeit);
    c.restore();
    var zb = Math.round(Math.sin(zeit * Math.PI * 2 / 1.8) * 2);
    muster(c, 270, 108 + zb, BILD.zzz[0].map(function (z) { return z.replace(/k/g, 'z'); }), { z: '#cfc4ff' });
    // geschafft: ein paar Herzen steigen auf (hoechstens zehn)
    if (geschafft) for (var hz = 0; hz < 10; hz++) {
      var hh = hash(hz, 3), hy2 = 150 - ((seit * 12 + (hh % 140)) % 150);
      c.globalAlpha = Math.min(1, hy2 / 40); herz(c, 60 + (hh >> 5) % 200 + Math.round(Math.sin(seit * 2 + hz) * 3), Math.round(hy2), ['#ff9fbf', '#ffc6dc', '#fff0a8'][hz % 3]); c.globalAlpha = 1;
    }
    // Sticker: ploppt auf, glitzert und fliegt dann zum Buch-Knopf oben rechts
    var sk = stickerVon(st.neuerSticker);
    if (sk && seit >= A.sticker) {
      var dt = seit - A.sticker, flugAb = A.sticker + 1, flugDauer = 0.7;
      var bw = R.knopfBreite || 9, zielX = W - (R.obenBreite || 33) + 2 + bw / 2, zielY = 8;
      if (seit < flugAb + flugDauer) {
        var gr = dt < 0.35 ? 1 + 0.25 * Math.sin(dt / 0.35 * Math.PI) : 1, px = 160, py = 46;
        if (seit >= flugAb) { var fl = sanft((seit - flugAb) / flugDauer); px = 160 + (zielX - 160) * fl; py = 46 + (zielY - 46) * fl; gr = 1 - 0.7 * fl; }
        if (dt < 1) for (var g8 = 0; g8 < 8; g8++) {
          var w8 = g8 * Math.PI / 4 + dt, d8 = 18 + dt * 10; c.globalAlpha = 1 - dt;
          r(c, Math.round(160 + Math.cos(w8) * d8), Math.round(46 + Math.sin(w8) * d8), 2, 2, g8 % 2 ? '#fff3a8' : '#ffffff'); c.globalAlpha = 1;
        }
        c.save(); c.translate(Math.round(px), Math.round(py)); c.scale(gr, gr); zeichneSticker(c, sk, 0, 0, 15, true); c.restore();
        info.sticker = { id: sk.id, phase: seit >= flugAb ? 'flug' : 'da', x: Math.round(px), y: Math.round(py) };
      } else info.sticker = { id: sk.id, phase: 'album' };
    }
    text(R, 'Bona nit!', W / 2, 4, { align: 'center', fett: true, groesse: 12, farbe: '#fff3c4', rand: 'rgba(43,33,80,0.9)', randBreite: 2 });
    // Sonne unten: ohne Lesen sehen, dass ein neuer Morgen wartet; pulsiert erst, wenn es weitergehen darf
    var bereit = seit >= ((Dorf.Spiel && Dorf.Spiel.ABEND_SPERRE) || 0) || st.abendZeit === undefined;
    info.bereit = bereit;
    c.globalAlpha = bereit ? 1 : 0.4;
    var winkt = bereit && st.hinweis && st.hinweis.ziel && st.hinweis.ziel.art === 'weiter' ? (st.hinweis.alpha || 0) : 0;
    if (winkt > 0) { c.globalAlpha = winkt * 0.8; kreis(c, W / 2, 150, 13 + Math.round(Math.abs(Math.sin(seit * 3)) * 4), '#ffd36e'); c.globalAlpha = 1; }
    kreis(c, W / 2, 150, 11 + (bereit ? Math.round((Math.sin(seit * 4) + 1)) : 0), P.kontur);
    kreis(c, W / 2, 150, 10 + (bereit ? Math.round((Math.sin(seit * 4) + 1)) : 0), '#fff4dc');
    zeichneSymbol(c, 'sonne', W / 2, 150);
    c.globalAlpha = 1;
    return info;
  }

  // ---------- Hauptzeichnen ----------
  // ---------- ab v0.10: Pixelziffern, Instrumente, Noten, Leben, Bildauswahl, Elternbereich ----------
  // Ziffern 3x5 als Pixel (passen zum Spielbild, keine Schrift noetig)
  var ZIFFER = {
    '0': '111101101101111', '1': '010110010010111', '2': '111001111100111', '3': '111001011001111', '4': '101101111001001',
    '5': '111100111001111', '6': '111100111101111', '7': '111001010010010', '8': '111101111101111', '9': '111101111001111',
    '/': '001001010100100', ':': '000010000010000', '-': '000000111000000'
  };
  function ziffernBreite(s, k) { return String(s).length * 4 * (k || 1) - (k || 1); }
  function ziffern(c, s, x, y, o) {
    o = o || {}; s = String(s);
    var k = o.skala || 1, w = ziffernBreite(s, k), farbe = o.farbe || P.kontur;
    if (o.align === 'center') x -= Math.floor(w / 2); else if (o.align === 'right') x -= w;
    for (var pass = o.rand ? 0 : 1; pass < 2; pass++) {
      for (var i = 0; i < s.length; i++) {
        var m = ZIFFER[s.charAt(i)]; if (!m) continue;
        for (var j = 0; j < 15; j++) if (m.charAt(j) === '1') {
          var px = x + i * 4 * k + (j % 3) * k, py = y + Math.floor(j / 3) * k;
          if (pass === 0) r(c, px - k, py - k, 3 * k, 3 * k, o.rand); else r(c, px, py, k, k, farbe);
        }
      }
    }
    return w;
  }
  // grosses Bild (ganzzahlig vergroessert), Mitte (x, y)
  function grossesBild(c, art, x, y, k) {
    var b = BILD[art]; if (!b) return;
    c.save(); c.translate(x, y); c.scale(k, k); muster(c, 0, 0, b[0], b[1]); c.restore();
  }
  function wackelX(i) { return i && i.wackel > 0 && !RUHIG ? Math.round(Math.sin(i.wackel * 36) * Math.min(2, i.wackel * 6)) : 0; }
  // Instrumente auf der Wiese: Gitarre am Staender, Kastagnetten auf einer Decke, Trommel
  function zeichneInstrument(c, ins, sx, sy) {
    var x = sx + wackelX(ins), y = sy, w = ins.wackel > 0 ? ins.wackel : 0, kp = P.kontur;
    ellipse(c, sx + 8, sy + 14, 7, 2, 'rgba(75,58,90,0.18)');
    if (ins.art === 'gitarre') {
      r(c, x + 3, y + 12, 10, 2, P.konturHolz);   // Staender
      kreis(c, x + 8, y + 9, 5, kp); kreis(c, x + 8, y + 9, 4, '#e0995a');
      kreis(c, x + 8, y + 3, 4, kp); kreis(c, x + 8, y + 3, 3, '#e0995a');
      r(c, x + 5, y + 1, 1, 2, '#f6c48e');
      kreis(c, x + 8, y + 6, 1, '#7a4a3a');
      r(c, x + 7, y - 9, 3, 10, kp); r(c, x + 8, y - 8, 1, 9, '#a56c48');
      r(c, x + 6, y - 12, 5, 4, kp); r(c, x + 7, y - 11, 3, 2, '#7a4a3a');
      r(c, x + 6, y + 11, 5, 1, kp);
      if (w > 0) for (var k = 0; k < 3; k++) r(c, x + 7 + k, y - 6, 1, 15, 'rgba(255,248,238,0.6)');
    } else if (ins.art === 'kastagnetten') {
      pille(c, sx + 1, sy + 8, 14, 6, '#ffd1e0'); r(c, sx + 3, sy + 10, 10, 1, '#ff9fb8');
      var hb = w > 0 ? Math.round(Math.sin(w * 30) * 2) : 0;
      kreis(c, x + 5, y + 8 - Math.abs(hb), 3, kp); kreis(c, x + 5, y + 8 - Math.abs(hb), 2, '#a0523a'); r(c, x + 4, y + 7 - Math.abs(hb), 1, 1, '#e08a6a');
      kreis(c, x + 11, y + 9, 3, kp); kreis(c, x + 11, y + 9, 2, '#a0523a'); r(c, x + 10, y + 8, 1, 1, '#e08a6a');
      r(c, x + 7, y + 7 - Math.abs(hb), 2, 1, '#ff6f91'); r(c, x + 8, y + 8, 1, 1, '#ff6f91');
    } else {
      var dr = w > 0.3 && !RUHIG ? 1 : 0;
      rr(c, x + 1, y + 4 + dr, 14, 10 - dr, kp); rr(c, x + 2, y + 5 + dr, 12, 8 - dr, '#ff8f8f');
      for (var z = 0; z < 3; z++) { r(c, x + 3 + z * 4, y + 8, 2, 1, '#fff4dc'); r(c, x + 4 + z * 4, y + 9, 2, 1, '#fff4dc'); }
      ellipse(c, x + 8, y + 5 + dr, 7, 2, kp); ellipse(c, x + 8, y + 5 + dr, 6, 1, '#fff8ee');
      r(c, x + 12, y - 1, 1, 5, '#b98463'); kreis(c, x + 12, y - 2, 1, '#fff4dc');
    }
  }
  // Noten steigen vom Instrument auf
  function zeichneNoten(c, st, cx, cy) {
    (st.noten || []).forEach(function (n) {
      var d = n.dauer || 1.2, f = Math.min(1, n.t / d), x = Math.round(n.x - cx + (RUHIG ? 0 : Math.sin(n.t * 3 + n.phase) * 2)), y = Math.round(n.y - cy - f * (RUHIG ? 10 : 18));
      c.globalAlpha = f < 0.7 ? 1 : (1 - f) / 0.3;
      r(c, x - 1, y + 1, 4, 3, P.kontur); r(c, x + 2, y - 5, 1, 7, P.kontur); r(c, x + 2, y - 5, 3, 1, P.kontur);
      r(c, x, y + 2, 2, 1, n.farbe || '#ff7fa0');
      c.globalAlpha = 1;
    });
  }
  // Schmetterling: zwei Fluegelpaare, die langsam auf und zu gehen; kleiner Schatten am Boden
  function zeichneFalter(c, f, sx, sy, a) {
    c.globalAlpha = a * 0.5; r(c, Math.round(sx) - 1, Math.round(sy) + 1, 3, 1, 'rgba(75,58,90,0.35)');
    c.globalAlpha = a;
    var x = Math.round(sx), y = Math.round(sy - f.hoehe), auf = Math.sin(f.phase) > 0 || f.warte > 0 && Math.sin(f.phase * 0.3) > 0.6;
    if (auf) { r(c, x - 3, y - 2, 3, 3, f.farbe); r(c, x + 1, y - 2, 3, 3, f.farbe); r(c, x - 2, y + 1, 2, 2, f.farbe); r(c, x + 1, y + 1, 2, 2, f.farbe); r(c, x - 3, y - 2, 1, 1, P.kontur); r(c, x + 3, y - 2, 1, 1, P.kontur); }
    else { r(c, x - 1, y - 3, 1, 4, f.farbe); r(c, x + 1, y - 3, 1, 4, f.farbe); }
    r(c, x, y - 2, 1, 4, P.kontur);
    c.globalAlpha = 1;
  }
  // kleiner Vogel: pickt, hopst, fliegt mit Fluegelschlag
  function zeichneVogel(c, v, sx, sy, a, zeit) {
    c.globalAlpha = a;
    var x = Math.round(sx), y = Math.round(sy - v.hoehe - (v.hop > 0 ? 1 : 0)), b = v.blick || 1;
    ellipse(c, Math.round(sx), Math.round(sy) + 1, v.hoehe > 0 ? 2 : 3, 1, 'rgba(75,58,90,0.22)');
    var pick = v.pickt > 0 && v.zustand !== 'fliegt' ? 1 : 0;
    r(c, x - 3, y - 4, 6, 4, P.kontur); r(c, x - 2, y - 3, 4, 2, '#a7795a'); r(c, x - 1, y - 2, 3, 1, '#ecd8b8');
    r(c, x - b * 4, y - 4, 2, 1, P.kontur);   // Schwanz
    var hx = x + b * 3 - (b > 0 ? 1 : 0), hy = y - 5 + pick * 2;
    r(c, hx - 1, hy - 1, 3, 3, P.kontur); r(c, hx, hy, 1, 1, '#a7795a');
    r(c, hx + b * 2, hy + 1, 1, 1, '#e0ad3e');
    if (v.zustand === 'fliegt') { var o = Math.sin(zeit * 12) > 0 ? -3 : 1; r(c, x - 1, y - 4 + o, 2, 3, '#8c6248'); }
    if (v.zustand !== 'fliegt') { r(c, x - 1, y, 1, 1, '#e0ad3e'); r(c, x + 1, y, 1, 1, '#e0ad3e'); }
    c.globalAlpha = 1;
  }
  function lebenListe(liste, c, st, cx, cy) {
    var L = st.leben; if (!L || !(L.sichtbar > 0.02)) return 0;
    var n = 0;
    L.falter.forEach(function (f) {
      if (f.aus) return;
      var sx = f.x - cx, sy = f.y - cy; if (sx < -8 || sx > W + 8 || sy < -24 || sy > H + 8) return;
      n++; liste.push({ y: f.y + 6, f: function () { zeichneFalter(c, f, sx, sy, L.sichtbar); } });
    });
    L.voegel.forEach(function (v) {
      var sx = v.x - cx, sy = v.y - cy; if (sx < -8 || sx > W + 8 || sy < -30 || sy > H + 8) return;
      n++; liste.push({ y: v.y + (v.hoehe > 0 ? 40 : 0), f: function () { zeichneVogel(c, v, sx, sy, L.sichtbar, st.zeit); } });
    });
    return n;
  }

  // Bildauswahl beim Start: drei grosse Bilder. Schlafenszeit: alle Bilder schlafen, nichts zu tippen.
  function zeichneWahl(R, st) {
    var c = R.ctx, w = st.wahl, S = Dorf.Spiel, karten = S.wahlKarten(), info = { karten: [], gesperrt: !!w.gesperrt };
    var info0 = w.info || [];
    var wache = 0; info0.forEach(function (u) { if (u && !u.fertig) wache++; });
    // ab v0.18: Nacht-Optik nur wenn wirklich alle schlafen (sonst Geschwister mit Minuten tippbar)
    var nacht = !!w.gesperrt && wache === 0;
    var streifen = nacht ? 44 : Math.max(44, Math.round(H / 4));
    if (nacht) { var band = ['#2b2150', '#33285c', '#3c3068', '#463874']; for (var i = 0; i < 4; i++) r(c, 0, i * streifen, W, streifen + 2, band[i]); }
    else { r(c, 0, 0, W, H, '#fff1e6'); var rasenY = hochkant ? Math.round(H * 0.72) : 132; r(c, 0, rasenY, W, H - rasenY, '#c4e6a4'); r(c, 0, rasenY, W, 2, '#a8d68f'); }
    if (nacht) {
      for (var s = 0; s < 18; s++) { var hs = hash(s, 13); r(c, hs % W, 3 + (hs >> 9) % 34, 1, 1, '#fff6c8'); }
      grossesBild(c, 'mond', W - 26, 18, 2);
      text(R, 'Schlafenszeit', W / 2, 12, { align: 'center', fett: true, groesse: 10, farbe: '#fff6c8' });
      text(R, 'Minuten sind alle · morgen wieder', W / 2, 25, { align: 'center', groesse: 6, farbe: '#d8cce6' });
    } else if (w.gesperrt && wache > 0) {
      r(c, 0, 0, W, 36, '#3c3068');
      text(R, 'Schlafenszeit', W / 2, 8, { align: 'center', fett: true, groesse: 9, farbe: '#fff6c8' });
      text(R, 'Andere Bilder dürfen noch', W / 2, 22, { align: 'center', groesse: 6, farbe: '#d8cce6' });
    } else {
      zeichneSymbol(c, 'sonne', W / 2 - 52, 18);
      text(R, 'Wer spielt?', W / 2 + 6, 13, { align: 'center', fett: true, groesse: 10 });
    }
    var info2 = w.info || [];
    var gesicht = hochkant ? 28 : 36, skala = hochkant ? 3 : 4, kr = hochkant ? 22 : 27;
    karten.forEach(function (k, i) {
      var pr = Dorf.Profile.hole(k.id), u = null;
      info2.forEach(function (q) { if (q.id === k.id) u = q; });
      // ab v0.18: schlaeft pro Bild, nicht global — Geschwister mit Minuten bleiben tippbar
      var schlaeft = !!(u && u.fertig), aktiv = !schlaeft && w.wahl === i;
      var dx = w.stups && w.stups.id === k.id && w.stups.t > 0 && !RUHIG ? Math.round(Math.sin(w.stups.t * 40) * 3) : 0;
      var hop = aktiv && !RUHIG ? Math.round(Math.abs(Math.sin((w.t || 0) * 3)) * 2) : 0;
      var x = k.x + dx, y = k.y - hop;
      pille(c, x - 1, y - 1, k.w + 2, k.h + 2, aktiv ? P.kontur : (schlaeft ? '#5a4a7e' : '#d8cce6'));
      pille(c, x, y, k.w, k.h, schlaeft ? (nacht ? '#4b3d72' : '#e6dcef') : pr.farbe);
      kreis(c, x + k.w / 2, y + gesicht, kr, schlaeft ? (nacht ? '#3c3068' : '#d8cce6') : '#fffdf8');
      if (schlaeft) c.globalAlpha = nacht ? 0.75 : 0.55;
      grossesBild(c, k.id, x + k.w / 2, y + gesicht, skala);
      c.globalAlpha = 1;
      if (schlaeft) { muster(c, x + k.w - 14, y + 10, BILD.zzz[0], { }); grossesBild(c, 'mond', x + 13, y + 10, 1); }
      var tag = u ? u.tag : 0, stk = u ? u.sticker : 0, ty = y + k.h - (hochkant ? 18 : 22), farbe = (nacht || schlaeft) ? '#fff6c8' : P.kontur;
      zeichneSymbol(c, 'sonne', x + 16, ty + 2); ziffern(c, tag > 0 ? tag : '-', x + 26, ty, { farbe: farbe });
      muster(c, x + (hochkant ? k.w - 48 : 54), ty + 2, BILD.stern[0], BILD.stern[1]); ziffern(c, stk, x + (hochkant ? k.w - 40 : 62), ty, { farbe: farbe });
      if (aktiv) r(c, x + 8, y + k.h - 6, k.w - 16, 2, pr.rand || P.kontur);
      info.karten.push({ id: k.id, x: x, y: y, w: k.w, h: k.h, schlaeft: schlaeft, aktiv: aktiv, tag: tag, sticker: stk });
    });
    if (nacht) {
      text(R, 'Zahnrad 3 Sek. · mehr Minuten oder warten', W / 2, H - 14, { align: 'center', groesse: 6, farbe: '#d8cce6' });
    } else if (w.gesperrt && wache > 0) {
      text(R, 'Tippe ein waches Bild · Zahnrad für Eltern', W / 2, H - 14, { align: 'center', groesse: 6, farbe: '#d8cce6' });
    } else {
      text(R, 'Tippe auf dein Bild', W / 2, H - 14, { align: 'center', groesse: 7, farbe: '#5c7a4a' });
    }
    R.letzteWahl = info;
    return info;
  }

  // Elternbereich: Minuten heute je Bild, weniger Bewegung, anderes Bild, neu anfangen
  function knopfFlaeche(c, k, farbe, an) {
    pille(c, k.x - 1, k.y - 1, k.w + 2, k.h + 2, an ? P.kontur : '#d8cce6');
    pille(c, k.x, k.y, k.w, k.h, farbe);
  }
  function zeichenMinus(c, k, an, aus) {
    knopfFlaeche(c, k, aus ? '#eee8f2' : '#e6defb', an);
    r(c, k.x + k.w / 2 - 4, k.y + k.h / 2 - 1, 8, 2, aus ? '#bfb2cc' : P.kontur);
  }
  function zeichenPlus(c, k, an, aus) {
    knopfFlaeche(c, k, aus ? '#eee8f2' : '#e6defb', an);
    var f = aus ? '#bfb2cc' : P.kontur;
    r(c, k.x + k.w / 2 - 4, k.y + k.h / 2 - 1, 8, 2, f); r(c, k.x + k.w / 2 - 1, k.y + k.h / 2 - 4, 2, 8, f);
  }
  function zeichneEltern(R, st) {
    var c = R.ctx, E = Dorf.Spiel.ELTERN, e = st.eltern, info = { zeilen: [], ruhig: !!st.ruhig };
    var Pr = Dorf.Profile, maxG = Pr && Pr.maxGrenze ? Pr.maxGrenze() : 15, minG = Pr && Pr.MIN_GRENZE ? Pr.MIN_GRENZE : 5;
    c.fillStyle = 'rgba(58,44,80,0.6)'; c.fillRect(0, 0, W, H);
    pille(c, E.x - 1, E.y - 1, E.w + 2, E.h + 2, P.kontur); pille(c, E.x, E.y, E.w, E.h, P.box);
    text(R, 'Für Eltern', E.x + 12, E.y + 6, { fett: true, groesse: 8 });
    knopfFlaeche(c, E.zu, '#e6dcef', e.wahl === 'zu'); kreuz(c, E.zu.x + E.zu.w / 2, E.zu.y + E.zu.h / 2, P.kontur);
    text(R, 'Minuten · Grenze (' + minG + '–' + maxG + ') · Woche', E.x + 12, E.y + 17, { groesse: 5, farbe: '#7a5a9a' });
    (e.info || []).forEach(function (u, i) {
      var B = E.bilder[i]; if (!B) return;
      var x = B.x, y = B.y, g = u.grenze || maxG, min = Math.min(g, Math.floor((u.sek || 0) / 60));
      pille(c, x, y, B.w, B.h, u.farbe || '#fff4dc');
      grossesBild(c, u.id, x + 10, y + 10, 1);
      ziffern(c, min, x + 21, y + 4, { skala: 2, farbe: P.kontur });
      text(R, 'Min.', x + 23 + ziffernBreite(min, 2), y + 8, { groesse: 6 });
      var status = u.fertig ? 'schläft' : (u.id === st.profil && st.profilGeladen ? 'spielt' : '');
      if (status) text(R, status, x + B.w - 4, y + 16, { groesse: 5, farbe: '#7a5a9a', align: 'right' });
      // Grenze einstellen: minus, Zahl, plus
      var stups = e.stups && e.stups.id === u.id;
      zeichenMinus(c, B.minus, e.wahl === 'minus_' + u.id, g <= minG);
      zeichenPlus(c, B.plus, e.wahl === 'plus_' + u.id, g >= maxG);
      var gb = ziffernBreite(g, 2);
      ziffern(c, g, x + B.w / 2 - gb / 2 - 4 + (stups ? 1 : 0), B.minus.y + 3, { skala: 2, farbe: P.kontur });
      text(R, 'max', x + B.w / 2 + gb / 2 - 2, B.minus.y + 8, { groesse: 5, farbe: '#7a5a9a' });
      // Woche: 7 Balken, 10 Pixel hoch sind 15 Minuten, heute ist rechts und dunkler
      // ab v0.12: endete ein Tag vor der Grenze, ist sein Balken sanft gruen (nur ein Hinweis fuer die Eltern, keine Belohnung)
      var woche = u.woche || [], gruen = u.gruen || [], bx0 = x + 6, boden = y + B.h - 3, farben = [];
      r(c, bx0 - 1, boden, 7 * 9 + 1, 1, '#c9bcd8');
      for (var t = 0; t < 7; t++) {
        var sek = woche[t] || 0, hh = sek > 0 ? Math.max(1, Math.round(Math.min(900, sek) / 90)) : 0;
        var fb = gruen[t] ? (t === 6 ? '#5fae78' : '#9fd4ac') : (t === 6 ? P.kontur : '#a48cc4');
        if (hh) r(c, bx0 + t * 9, boden - hh, 6, hh, fb);
        else r(c, bx0 + t * 9 + 2, boden - 1, 2, 1, '#d8cce6');
        farben.push(hh ? (gruen[t] ? 'gruen' : 'lila') : 'leer');
      }
      info.zeilen.push({ id: u.id, minuten: min, fertig: !!u.fertig, grenze: g, woche: woche.slice(), farben: farben });
    });
    // ab v0.12: vier kleine Schalter nebeneinander: Weniger Bewegung, Namen vorlesen, Saetze vorlesen, Langsam sprechen
    var art = st.vorleseArt || { namen: true, saetze: true, langsam: false }, stimme = st.vorlesenDa !== false;
    info.schalter = {};
    [['ruhig', 'Weniger', !!st.ruhig, true], ['namen', 'Namen', art.namen !== false, stimme],
      ['saetze', 'Sätze', art.saetze !== false, stimme], ['langsam', 'Langsam', !!art.langsam, stimme]].forEach(function (d) {
      var K = E[d[0]], an = d[2], geht = d[3];
      knopfFlaeche(c, K, geht ? '#fff4dc' : '#f3eef6', e.wahl === d[0]);
      text(R, d[1], K.x + 3, K.y + 7, { fett: true, groesse: 5, farbe: geht ? P.kontur : '#a898b8' });
      var sx = K.x + K.w - 20, sy = K.y + 5;
      pille(c, sx, sy, 16, 9, an ? (geht ? '#7ed492' : '#c4e6cc') : '#d8cce6');
      var kx = an ? sx + 11 : sx + 4; kreis(c, kx, sy + 4, 3.5, P.kontur); kreis(c, kx, sy + 4, 2.5, '#ffffff');
      info.schalter[d[0]] = an;
    });
    info.stimme = stimme;
    // ab v0.15: Schlaflied A/B/C — Bildsprache Pastell/GBA, ohne Lesen verständlich
    var wahlLied = st.schlafliedWahl || 'C';
    info.schlaflied = wahlLied;
    function zeichneLiedKnopf(K, id, farbe, iconFn, label) {
      var an = wahlLied === id, fokus = e.wahl === ('lied' + id);
      knopfFlaeche(c, K, an ? farbe : '#f7f0e8', fokus || an);
      if (an) { pille(c, K.x - 1, K.y - 1, K.w + 2, K.h + 2, '#7ed492'); knopfFlaeche(c, K, farbe, fokus); }
      iconFn(K.x + 14, K.y + 12);
      text(R, label, K.x + 28, K.y + 9, { fett: true, groesse: 6, farbe: P.kontur });
    }
    // A = klassische Spieluhr + kleiner Gitarren-Hinweis
    function iconSpieluhr(cx, cy) {
      kreis(c, cx, cy, 8, '#e8c89a'); kreis(c, cx, cy, 7, '#fff4dc'); kreis(c, cx, cy, 1.5, P.kontur);
      // Zeiger
      r(c, cx - 0.5, cy - 5, 1, 5, P.kontur); r(c, cx - 0.5, cy - 0.5, 4, 1, P.kontur);
      // kleine Gitarre rechts
      kreis(c, cx + 7, cy + 4, 2.5, '#c4a06a'); r(c, cx + 8, cy - 4, 1.5, 6, '#d4b07a');
    }
    // B = Sterne / Celesta-Glitzer
    function iconSterne(cx, cy) {
      function stern(x, y, s, f) {
        r(c, x - s, y - 0.5, s * 2, 1, f); r(c, x - 0.5, y - s, 1, s * 2, f);
        r(c, x - s * 0.6, y - s * 0.6, 1, 1, f); r(c, x + s * 0.4, y - s * 0.6, 1, 1, f);
      }
      stern(cx - 2, cy - 1, 5, '#ffe27a'); stern(cx + 6, cy + 3, 3, '#ffd1e0'); stern(cx + 2, cy + 6, 2, '#c9e4ff');
    }
    // C = Floete + Sonne Mallorca
    function iconFloete(cx, cy) {
      // Sonne
      kreis(c, cx - 2, cy - 2, 5, '#ffd36e'); kreis(c, cx - 2, cy - 2, 3.5, '#ffe9a8');
      // Floete schraeg
      r(c, cx + 1, cy + 2, 10, 2.5, '#d4e8f8'); r(c, cx + 1, cy + 2, 10, 1, '#a8c8e0');
      kreis(c, cx + 3, cy + 3, 0.8, P.kontur); kreis(c, cx + 6, cy + 3, 0.8, P.kontur); kreis(c, cx + 9, cy + 3, 0.8, P.kontur);
    }
    if (E.liedA) {
      text(R, 'Bona nit', E.x + 12, E.liedA.y - 7, { groesse: 5, farbe: '#7a5a9a' });
      zeichneLiedKnopf(E.liedA, 'A', '#fff0d8', iconSpieluhr, 'Spieluhr');
      zeichneLiedKnopf(E.liedB, 'B', '#e8e4ff', iconSterne, 'Sterne');
      zeichneLiedKnopf(E.liedC, 'C', '#dff6f0', iconFloete, 'Flöte');
    }
    var Wk = E.wechseln, Nk = E.neu, Sk = E.sichern;
    knopfFlaeche(c, Wk, '#e6defb', e.wahl === 'wechseln');
    grossesBild(c, 'esel', Wk.x + 8, Wk.y + Wk.h / 2, 1);
    text(R, 'Anderes Bild', Wk.x + 18, Wk.y + 6, { fett: true, groesse: 5 });
    knopfFlaeche(c, Nk, '#ffd1e0', e.wahl === 'neu');
    kreispfeil(c, Nk.x + 9, Nk.y + Nk.h / 2 + 1, '#ff7fa0');
    text(R, 'Neu anfangen', Nk.x + 18, Nk.y + 6, { fett: true, groesse: 5 });
    knopfFlaeche(c, Sk, '#d4f2ee', e.wahl === 'sichern');
    r(c, Sk.x + 4, Sk.y + 7, 10, 7, P.kontur); r(c, Sk.x + 5, Sk.y + 8, 8, 5, '#ffe27a'); r(c, Sk.x + 9, Sk.y + 2, 1, 7, P.kontur); r(c, Sk.x + 7, Sk.y + 6, 5, 1, P.kontur);
    text(R, 'Sichern', Sk.x + 18, Sk.y + 6, { fett: true, groesse: 5 });
    if (st.speicherHinweis) {
      text(R, 'Speichern klappt gerade nicht (privates Fenster?)', W / 2, E.y + E.h - 8, { align: 'center', groesse: 5, farbe: '#c06080' });
    } else {
      text(R, 'Grün = Tag vor Grenze · Zahnrad 3 Sek. halten', W / 2, E.y + E.h - 8, { align: 'center', groesse: 5, farbe: '#7a5a9a' });
    }
    R.letzteEltern = info;
    return info;
  }

  function zeichne(R, st) {
    // ab v0.10: mit Zoom malt die Welt auf ein kleineres Bild (wird groesser angezeigt), HUD und Fenster auf eine eigene Ebene
    var haupt = R.ctx, mitHud = !!(R.hud && st.zoom && st.zoom !== 1);
    ZM = mitHud ? st.zoom : 1; RUHIG = !!st.ruhig;
    var WW = Math.round(screenW / ZM), WH = Math.round(screenH / ZM);
    W = WW; H = WH;
    try { zeichneAlles(R, st, mitHud, WW, WH); }
    finally { W = screenW; H = screenH; R.ctx = haupt; }
  }
  function zeichneAlles(R, st, mitHud, WW, WH) {
    var c = R.ctx, karte = st.karte, kam = st.kamera, zeit = st.zeit, T = Dorf.Karte.T;
    var cx = Math.round(kam.x), cy = Math.round(kam.y);
    function inWelt(f) { W = WW; H = WH; try { f(); } finally { W = screenW; H = screenH; } }
    if (R.ui) { R.ui.setTransform(1, 0, 0, 1, 0, 0); R.ui.clearRect(0, 0, R.uiCanvas.width, R.uiCanvas.height); R.ui.setTransform(R.uiSkala, 0, 0, R.uiSkala, 0, 0); }
    if (R.hud) { R.hud.setTransform(1, 0, 0, 1, 0, 0); R.hud.clearRect(0, 0, screenW, screenH); }
    r(c, 0, 0, W, H, P.kontur);
    if (st.wahl && !st.eltern) {
      // Bildauswahl deckt alles ab: die Welt muss nicht gemalt werden
      W = screenW; H = screenH; if (mitHud) R.ctx = R.hud;
      zeichneWahl(R, st); zeichneTipps(R.ctx, st);
      R.letzteHud = null; R.letzteEltern = null;
      return;
    }

    var x0 = Math.floor(cx / K), y0 = Math.floor(cy / K), x1 = Math.min(karte.w - 1, x0 + Math.ceil(W / K) + 1), y1 = Math.min(karte.h - 1, y0 + Math.ceil(H / K) + 1);
    var liste = [], hg = hintergrund(R, karte);
    if (hg) {
      c.drawImage(hg.canvas, -cx, -cy);
      hg.lebendig.forEach(function (k) {
        var sx = k.x * K - cx, sy = k.y * K - cy;
        if (sx <= -K || sy <= -K || sx >= W || sy >= H) return;
        c.save(); c.beginPath(); c.rect(sx, sy, K, K); c.clip();
        zeichneKachel(c, karte, k.x, k.y, sx, sy, zeit, st);
        c.restore();
      });
    }
    for (var y = Math.max(0, y0); y <= y1; y++) for (var x = Math.max(0, x0); x <= x1; x++) {
      if (!hg) zeichneKachel(c, karte, x, y, x * K - cx, y * K - cy, zeit, st);
      if (istMoebel(karte.tile(x, y))) (function (mx, my) { liste.push({ y: my * K + 14, f: function () { zeichneMoebel(c, karte, mx, my, mx * K - cx, my * K - cy); } }); })(x, y);
    }
    if (!hg) zeichneBlumen(c, karte, cx, cy, false);
    zeichneBrunnenRing(c, karte, cx, cy);
    if (st.marker) zeichneMarker(c, st.marker, cx, cy);
    zeichneHinweisRing(c, st, cx, cy);
    // ab v0.7: Ring unter Biel, damit die Kinder sofort sehen, wer sie selbst sind
    var spr = st.spieler, rx = Math.round(spr.x - cx), ry = Math.round(spr.y - cy) + 1;
    ellipse(c, rx, ry, 8, 3, P.herzGold); ellipse(c, rx, ry, 7, 2, 'rgba(255,248,238,0.75)');
    lichtQuellen(R, karte).laternen.forEach(function (l, i) {
      var sx = l.x - cx, sy = l.y - cy;
      if (sx > -10 && sx < W + 10 && sy > -4 && sy < H + 26) liste.push({ y: l.y, f: function () { zeichneLaterne(c, sx, sy, false); } });
    });

    // Objekte und Figuren nach Fuss-y sortiert
    karte.baeume.forEach(function (t) { var sx = t.x * K - cx, sy = t.y * K - cy; if (sx > -24 && sx < W + 24 && sy > -32 && sy < H + 32) liste.push({ y: t.y * K + 14, f: function () { if (t.art === 'orange') zeichneOrangenbaum(c, sx, sy); else if (t.art === 'zitrone') zeichneZitronenbaum(c, sx, sy); else zeichneBaum(c, sx, sy); var fr = st.garten && Dorf.Garten.an(st.garten, t.x, t.y); if (fr) zeichneBaumFruechte(c, fr, sx + wackeln(fr), sy, zeit); } }); });
    (st.garten ? st.garten.liste : []).forEach(function (p) {
      if (p.baum) return;
      var sx = p.x * K - cx, sy = p.y * K - cy;
      if (sx > -20 && sx < W + 20 && sy > -24 && sy < H + 24) liste.push({ y: p.y * K + 10, f: function () { zeichnePflanze(c, p, sx + wackeln(p), sy, zeit); } });
    });
    (karte.instrumente || []).forEach(function (ins) {
      var sx = ins.x * K - cx, sy = ins.y * K - cy;
      if (sx > -20 && sx < W + 20 && sy > -24 && sy < H + 24) liste.push({ y: ins.y * K + 12, f: function () { zeichneInstrument(c, ins, sx, sy); } });
    });
    R.letztesLeben = lebenListe(liste, c, st, cx, cy);
    liste.push({ y: (karte.brunnen.y + 1) * K + 12, f: function () { zeichneBrunnen(c, karte.brunnen.x * K - cx, karte.brunnen.y * K - cy, zeit); } });
    var redner = st.blase && !st.abend && !st.menue ? st.blase.sprecher : null;
    R.letzteWolken = [];
    st.gaeste.forEach(function (gs, gi) {
      var sitzt = Dorf.Gaeste.sitzt(gs), off = sitzt ? 14 : 0;
      liste.push({ y: gs.y - (sitzt ? 12 : 0), f: function () {
        var info = zeichnePerson(c, gs.x - cx, gs.y - off - cy, gs.aussehen, gs.dir, gs.frame, { zeit: zeit, hop: huepfer(st, gs.name, gs.hop) });
        var gae = Dorf.Spiel && Dorf.Spiel.gaehnen ? Dorf.Spiel.gaehnen(st, gi) : 0;
        if (gae > 0.15 && gs.dir === 'unten') zeichneGaehnen(c, Math.round(info.mundX), Math.round(info.mundY), gae);
        var sym = Dorf.Gaeste.symbol(gs), wa = sym && redner !== gs.name ? wolkeAlpha(st, gs, gi) : 0;
        if (wa > 0) { zeichneBlase(c, Math.round(gs.x - cx) + 5, info.oben, sym, zeit, wa); R.letzteWolken.push({ name: gs.name, symbol: sym, alpha: wa }); }
      } });
    });
    if (karte.stall) { var stx = karte.stall.x * K - cx, sty = karte.stall.y * K - cy; if (stx > -40 && stx < W + 8 && sty > -24 && sty < H + 24) liste.push({ y: karte.stall.y * K + 14, f: function () { zeichneStall(c, stx, sty); } }); }
    (st.tiere && st.tiere.eier ? st.tiere.eier : []).forEach(function (e) {
      var ex = e.x - cx, ey = e.y - cy;
      if (ex > -10 && ex < W + 10 && ey > -10 && ey < H + 10) liste.push({ y: e.y - 0.5, f: function () { zeichneEiBoden(c, e, ex, ey, zeit); } });
    });
    (st.tiere ? st.tiere.liste : []).forEach(function (t) {
      var sx = t.x - cx, sy = t.y - cy;
      if (sx < -24 || sx > W + 24 || sy < -32 || sy > H + 32) return;
      if (t.art === 'esel') liste.push({ y: t.y, f: function () { zeichneEsel(c, t, sx, sy, zeit); } });
      else if (t.art === 'huhn') liste.push({ y: t.y, f: function () { zeichneHuhn(c, t, sx, sy, zeit); } });
      else liste.push({ y: t.y - 30, f: function () { zeichneGecko(c, t, sx, sy, zeit); } });   // Wand: vor allem dahinter
    });
    // ab v0.19: Fische im Meer (unter der Wasserlinie sortiert)
    (st.tiere && st.tiere.fische ? st.tiere.fische : []).forEach(function (fisch) {
      var sx = fisch.x - cx, sy = fisch.y - cy;
      if (sx < -16 || sx > W + 16 || sy < -16 || sy > H + 16) return;
      liste.push({ y: fisch.y - 0.2, f: function () { zeichneFisch(c, fisch, sx, sy, zeit); } });
    });
    // ab v0.20: Boot und Flamingo
    var wass = st.wasser, bootBesetzt = !!(wass && wass.boot && wass.boot.besetzt), flamBesetzt = !!(wass && wass.flamingo && wass.flamingo.besetzt);
    if (wass && wass.boot) {
      (function (b) {
        var sx = b.x - cx, sy = b.y - cy;
        if (sx > -28 && sx < W + 28 && sy > -24 && sy < H + 24) liste.push({ y: b.y + 0.05, f: function () {
          var bob = zeichneBoot(c, b, sx, sy, zeit, bootBesetzt);
          if (bootBesetzt) zeichnePerson(c, st.spieler.x - cx, st.spieler.y - cy - 4 + bob, BIEL, st.spieler.dir, st.spieler.frame, { zeit: zeit, ruhig: true });
        } });
      })(wass.boot);
    }
    if (wass && wass.flamingo) {
      (function (fl) {
        var sx = fl.x - cx, sy = fl.y - cy;
        if (sx > -24 && sx < W + 24 && sy > -28 && sy < H + 24) liste.push({ y: fl.y + 0.08, f: function () {
          var bob = zeichneFlamingo(c, fl, sx, sy, zeit, flamBesetzt);
          if (flamBesetzt) zeichnePerson(c, st.spieler.x - cx, st.spieler.y - cy - 2, BIEL, 'unten', 0, { zeit: zeit, ruhig: true, hop: bob });
        } });
      })(wass.flamingo);
    }
    var sp = st.spieler;
    if (!bootBesetzt && !flamBesetzt) {
      liste.push({ y: sp.y + 0.1, f: function () { zeichnePerson(c, sp.x - cx, sp.y - cy, BIEL, sp.dir, sp.frame, { zeit: zeit, hop: huepfer(st, 'Biel', 0) }); } });
    }
    liste.sort(function (a, b) { return a.y - b.y; });
    liste.forEach(function (e) { e.f(); });
    zeichneKochen(c, karte, st, cx, cy);
    zeichneHerzchen(c, st, cx, cy);
    zeichneNoten(c, st, cx, cy);

    // Debug: Pfade
    if (st.debug) {
      st.gaeste.forEach(function (gs) {
        for (var k = gs.pfadIndex; k < gs.pfad.length; k++) { var n = gs.pfad[k]; r(c, n.x * K + 7 - cx, n.y * K + 7 - cy, 3, 3, gs.aussehen.farbe); }
        if (gs.zielTile) { c.strokeStyle = gs.aussehen.farbe; c.lineWidth = 1; c.strokeRect(gs.zielTile.x * K - cx + 0.5, gs.zielTile.y * K - cy + 0.5, 15, 15); }
      });
      for (var k2 = sp.pfadIndex; k2 < sp.pfad.length; k2++) { var n2 = sp.pfad[k2]; r(c, n2.x * K + 7 - cx, n2.y * K + 7 - cy, 2, 2, '#ffffff'); }
    }

    // Tageslicht (ab v0.7: multipliziert, dazu leuchtende Fenster, Laternen, Herd und Biels Laterne)
    zeichneLicht(R, st, cx, cy);

    // ab hier Bildschirm (Desktop 320×176, Mobil-Hochformat 320×400)
    W = screenW; H = screenH;
    var cw = c;
    if (mitHud) { R.ctx = R.hud; c = R.hud; }

    // klein fuer die Eltern: Version und Tasten, rechts oben neben den Knoepfen
    var hilfe = R.touch ? (Dorf.VERSION || '') : (Dorf.VERSION || '') + ' · E: Aktion · K: kochen · M: Ton';
    if (!st.abend && !st.buch) text(R, hilfe, W - (R.obenBreite || (R.touch ? 52 : 28)), 3, { farbe: P.uiTinteWeich, rand: 'rgba(255,248,238,0.85)', align: 'right', groesse: 6 });

    // ab v0.8: Sprechblase mit Bildern ueber dem Kopf (kein Name, kein Text fuer die Kinder)
    R.letzteBlase = null;
    if (st.blase && !st.abend && !st.menue && !st.frage && !st.buch && !st.eltern) inWelt(function () { R.letzteBlase = zeichneSprechblase(cw, st, cx, cy); });

    if (!st.abend && !st.menue && !st.frage && !st.buch && !st.eltern && !st.debug && Dorf.Glueck) zeichneHud(R, st);
    if (!st.abend && !st.frage) inWelt(function () { zeichneFlieger(cw, st, cx, cy); zeichneHerzFlug(cw, st, cx, cy); });
    if (!st.abend && !st.menue && !st.frage && !st.buch && !st.eltern) inWelt(function () { zeichneDenken(cw, st, cx, cy); });
    if (st.menue && !st.abend) zeichneMenue(R, st);
    if (st.debug) zeichneDebug(R, st);

    // Abendszene (ab v0.7 schliesst sich vorher ein Kreis um Biel, ab v0.9 ein Bild statt Text)
    var irisDauer = (Dorf.Spiel && Dorf.Spiel.ABEND && Dorf.Spiel.ABEND.iris) || 1.2, irisSeit = st.abendZeit === undefined ? 99 : st.zeit - st.abendZeit;
    R.letzteAbend = null;
    if (st.abend && irisSeit < irisDauer) inWelt(function () { zeichneIris(cw, st, cx, cy, irisSeit / irisDauer); });
    if (st.abend && irisSeit >= irisDauer) R.letzteAbend = zeichneAbendSzene(R, st, st.abendZeit === undefined ? 99 : irisSeit);
    R.letztesBuch = null;
    if (st.buch) R.letztesBuch = zeichneBuch(R, st);
    if (st.frage) zeichneFrage(R, st);
    R.letzteWahl = null; R.letzteEltern = null;
    if (st.wahl && !st.eltern) zeichneWahl(R, st);   // Texte der Auswahl sonst ueber dem Elternfeld
    if (st.eltern) zeichneEltern(R, st);
    if (!st.buch && !st.eltern && !st.wahl) zeichneHinweis(c, st, cx, cy, R);
    zeichneTipps(c, st);
  }

  function zeichneDebug(R, st) {
    var c = R.ctx;
    c.fillStyle = 'rgba(40,30,55,0.78)'; c.fillRect(2, 14, 170, 62);
    var t = Dorf.Gaeste.tileVon(st.spieler), z = 16;
    text(R, 'FPS ' + Math.round(st.fps || 0) + '  Seed ' + st.rng.seed + '  ' + (Dorf.VERSION || ''), 5, z, { farbe: '#b6f5c8' }); z += 9;
    text(R, 'Biel Kachel ' + t.x + ',' + t.y + '  Tafel ' + (st.teller || []).join(','), 5, z, { farbe: '#b6f5c8' }); z += 9;
    st.gaeste.forEach(function (gs) {
      var b = gs.beduerfnisse;
      text(R, gs.name + ': Satt ' + b.satt.toFixed(0) + '  Spielen ' + b.spielen.toFixed(0) + '  Ruhe ' + (b.ruhe !== undefined ? b.ruhe.toFixed(0) : '-'), 5, z, { farbe: '#ffe7b0' }); z += 8;
      text(R, '  ' + gs.zustand + ' → ' + (gs.ziel || '-') + '  Pfad ' + Math.max(0, gs.pfad.length - gs.pfadIndex) + '  Glück ' + (gs.glueck || 0), 5, z, { farbe: '#d8d0ec' }); z += 9;
    });
  }

  Dorf.Render = { W: W, H: H, BASE_W: BASE_W, BASE_H: BASE_H, PORT_H: PORT_H, hochkant: false, setzeBildschirm: setzeBildschirm, P: P, BIEL: BIEL, erstelle: erstelle, zeichne: zeichne, zeichnePerson: zeichnePerson, zeichneTeller: zeichneTeller, umbruch: umbruch, hintergrund: hintergrund, zeichneSymbol: zeichneSymbol, kenntSymbol: kenntSymbol, masse: masse, BILD: BILD, KORB: KORB, chipPos: chipPos, RAND: RAND, ZIFFER: ZIFFER, ziffern: ziffern, zeichneWahl: zeichneWahl, zeichneEltern: zeichneEltern };
})(globalThis);
