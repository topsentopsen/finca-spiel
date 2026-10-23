/* Zeichnen: Kacheln, Objekte, Figuren, Licht, HUD. Alles per Code, keine fremden Grafiken. */
(function (g) {
  'use strict';
  var Dorf = g.Dorf = g.Dorf || {};
  var W = 320, H = 176, K = 16;
  // ab v0.7: runde Systemschrift, wenn das Geraet eine hat (keine fremden Schriften)
  var SCHRIFT = 'ui-rounded, "SF Pro Rounded", "Arial Rounded MT Bold", "Trebuchet MS", system-ui, sans-serif';

  // v0.7: neue Palette nach dem Design Review. Boden ruhiger und dunkler, Figuren am kraeftigsten,
  // Konturen in der Farbe des Gegenstands (Laub gruen, Holz braun, Stein grau-lila), nur Figuren mit Tinte.
  var P = {
    kontur: '#4a3560', konturTief: '#3a2a4e', konturGruen: '#3f6b4a', konturHolz: '#7a4a3a', konturStein: '#8a7c9c', konturDach: '#9a4a4a',
    gras: '#a8d68f', gras2: '#8cc27a', gras3: '#c4e6a4', weg: '#dcb98e', weg2: '#c79f74',
    pflaster: '#e8d3ae', pflaster2: '#d6bb90', boden: '#eab48c', boden2: '#d39470',
    fliese1: '#f7efe2', fliese2: '#8fcbe3', wasser: '#7fd3ec', wasser2: '#e8fbff', wasser3: '#4fb0d6',
    rand: '#f4e6d0', rand2: '#d9c2a0', mauerTop: '#f1d6ac', mauerFront: '#d9a878', mauerFuge: '#c39066',
    dach: '#f08a6a', dach2: '#d2694f', putz: '#fff3e2', putz2: '#ecd6b8', fenster: '#9fd4f0', fensterNacht: '#ffd77a', fensterKern: '#fff1c2',
    holz: '#c98b5e', holz2: '#a56c48', tuch: '#fffdf8', herd: '#dfe3ef', herd2: '#9aa3bb',
    erde: '#b98463', erde2: '#9c6a50', spross: '#6cc75a', blatt: '#84c27a', blatt2: '#5f9e64', blatt3: '#b6e39a', stamm: '#9a6a4a',
    olive1: '#c9d9b0', olive2: '#9fb98a', olive3: '#7c9a72',
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
  function istLebendig(t) { var T = Dorf.Karte.T; return t === T.WASSER || t === T.TAFEL; }
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

  // ---------- Kacheln ----------
  function istWand(t) { var T = Dorf.Karte.T; return t === T.MAUER || t === T.WAND; }
  function istMoebel(t) { var T = Dorf.Karte.T; return t === T.COUCH || t === T.PFLANZE || t === T.ECKBANK || t === T.ANRICHTE || t === T.BETT || t === T.SESSEL || t === T.TISCH; }
  // Boden unter Moebeln: Kueche Fliesen, sonst Holz
  function bodenUnter(karte, x, y) { var T = Dorf.Karte.T, k = karte.raeume.kueche; return (x >= k.x0 && x <= k.x1 && y >= k.y0 && y <= k.y1) ? T.FLIESE : T.BODEN; }

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

  // aufsteigende Herzchen
  function zeichneHerzchen(c, st, cx, cy) {
    (st.herzchen || []).forEach(function (h) {
      var a = Math.max(0, 1 - h.t / 1.4), dx = Math.round(Math.sin(h.t * 6) * 2);
      c.globalAlpha = a;
      if (h.t < 0) { c.globalAlpha = 1; return; }
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
    else if (art === 'orange') { kreis(c, x, y, 3, P.kontur); kreis(c, x, y, 2, '#ffb037'); r(c, x - 1, y - 1, 1, 1, '#ffe0a0'); r(c, x, y - 4, 2, 1, '#5fbf6a'); }
    else { rr(c, x - 2, y - 3, 5, 6, P.kontur); rr(c, x - 1, y - 2, 3, 4, '#9a7cc4'); r(c, x - 1, y - 2, 1, 1, '#e0d2f5'); r(c, x + 1, y - 4, 2, 1, '#5fbf6a'); }
    if (blass) c.globalAlpha = 1;
  }
  // Korb mit den geernteten Zutaten (unter den Herzen)
  function zeichneVorrat(R, st, y) {
    var c = R.ctx, v = st.vorrat;
    if (!v || !Dorf.Garten) return;
    pille(c, 2, y, 72, 12, 'rgba(255,248,236,0.92)');
    Dorf.Garten.REIHE.forEach(function (a, i) {
      var x = 9 + i * 17, n = v[a] || 0, puls = (st.korbPuls && st.korbPuls[a]) || 0;
      // gerade geerntet: das Fach hopst und leuchtet kurz
      var hop = puls > 0 ? Math.round(Math.sin((0.45 - puls) / 0.45 * Math.PI) * 3) : 0;
      if (puls > 0) { c.globalAlpha = Math.min(1, puls * 3); kreis(c, x, y + 6, 5, '#fff3a8'); c.globalAlpha = 1; }
      zeichneZutat(c, a, x, y + 6 - hop, n === 0);
      text(R, String(n), x + 4, y + 2 - hop, { groesse: 6, fett: true, farbe: n ? P.kontur : '#b9a8cc' });
    });
  }
  function glitzer(c, x, y, zeit, phase) {
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
  // Fruechte am Baum (Orangen oder Oliven)
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
    else zeichneZutat(c, art, x, y);
  }
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
    var z = h.ziel, wx = z.x, wy = z.y, t = h.t, ring = 5 + Math.round((Math.sin(t * 5) + 1) * 1.5);
    var fx = wx, fy = wy + 3;
    if (z.gast) { fx = z.gast.x; fy = z.gast.y - (Dorf.Gaeste.sitzt(z.gast) ? 12 : 0) + 1; }
    else if (z.pflanze && Dorf.Garten.punkt) { var gp = Dorf.Garten.punkt(z.pflanze); fx = gp.x; fy = gp.y + 2; }
    else if (z.art === 'fuettern' && st.tiere && st.tiere.esel) { fx = st.tiere.esel.x; fy = st.tiere.esel.y + 1; }
    else if (z.art === 'kochen') fy = wy + 14;
    var rx = Math.round(fx - cx), ry = Math.round(fy - cy);
    c.globalAlpha = h.alpha;
    ellipse(c, rx, ry, ring + 2, 3, P.kontur); ellipse(c, rx, ry, ring + 1, 2, '#fff3a8');
    c.globalAlpha = 1;
  }
  // Der Hinweis: huepfende Hand, Ring am Ziel und ein Bild, was dort passiert
  function zeichneHinweis(c, st, cx, cy) {
    var h = st.hinweis;
    if (!h || !h.ziel || !(h.alpha > 0)) return;
    var z = h.ziel, wx = z.x, wy = z.y;
    if (z.art === 'weiter') return;   // am Abend pulsiert stattdessen die Sonne (siehe Abendszene)
    if (z.gast) { wx = z.gast.x; wy = z.gast.y - (Dorf.Gaeste.sitzt(z.gast) ? 14 : 0) - 28; }
    if (z.art === 'fuettern' && st.tiere && st.tiere.esel) { wx = st.tiere.esel.x; wy = st.tiere.esel.y - 30; }
    var sx = Math.round(z.bildschirm ? wx : wx - cx), sy = Math.round(z.bildschirm ? wy : wy - cy), t = h.t;
    c.globalAlpha = h.alpha;
    var drinnen = sx >= 12 && sx <= W - 12 && sy >= 26 && sy <= H - 6;
    if (!drinnen) {
      // Ziel ausserhalb vom Bild: runder Wegweiser am Rand mit Pfeil in die Richtung
      var kx = Math.max(14, Math.min(W - 14, sx)), ky = Math.max(30, Math.min(H - 14, sy)), dx = sx - kx, dy = sy - ky, d = Math.hypot(dx, dy) || 1;
      var px = Math.round(kx + dx / d * 11), py = Math.round(ky + dy / d * 11), puls = Math.round((Math.sin(t * 5) + 1) * 1);
      kreis(c, px, py, 3, P.kontur); kreis(c, px, py, 2, '#ff9fb8');
      kreis(c, kx, ky, 9 + puls, P.kontur); kreis(c, kx, ky, 8 + puls, '#fff4dc');
      zeichneSymbol(c, z.bild || 'reden', kx, ky);
      c.globalAlpha = 1; return;
    }
    var hop = Math.round(Math.abs(Math.sin(t * 4.5)) * 4);
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
    var bx = Math.max(2, Math.min(W - w - 2, x + 2)), seitlich = y - 9 < 42 && bx < 78;
    if (seitlich) { bx = Math.max(78, x + 14); y += 14; }   // nicht unter Ziel und Korb oben links, dann neben den Kopf
    if (seitlich) { kreis(c, x + 9, y + 8, 2, P.kontur); kreis(c, x + 9, y + 8, 1, P.box); kreis(c, x + 14, y + 3, 3, P.kontur); kreis(c, x + 14, y + 3, 2, P.box); }
    else { kreis(c, x + 3, y + 18, 2, P.kontur); kreis(c, x + 3, y + 18, 1, P.box); kreis(c, x + 6, y + 13, 3, P.kontur); kreis(c, x + 6, y + 13, 2, P.box); }
    pille(c, bx, y - 9, w, 16, P.box);
    d.bilder.forEach(function (b, i) {
      var hop = Math.round(Math.abs(Math.sin(d.t * 4 + i)) * 1);
      zeichneSymbol(c, b, bx + 9 + i * 11, y - 1 - hop);
    });
    c.globalAlpha = 1;
  }
  // Ernte im Flug: Frucht hopst im Bogen zu Biel
  function zeichneFlieger(c, st, cx, cy) {
    (st.flieger || []).forEach(function (f) {
      if (f.t < 0) return;
      var p = Math.min(1, f.t / f.dauer), e = p * p * (3 - 2 * p), sp = st.spieler;
      var x = f.x + (sp.x - f.x) * e, y = f.y + (sp.y - 16 - f.y) * e - Math.sin(p * Math.PI) * 18;
      zeichneZutat(c, f.art, Math.round(x - cx), Math.round(y - cy));
    });
  }

  // kleine Herzen fuer die Gaeste (HUD und Abendszene)
  function herzReihe(c, gs, x, y) {
    var n = Dorf.Glueck ? Dorf.Glueck.herzen(gs) : 0;
    for (var i = 0; i < 5; i++) herz(c, x + i * 6, y, i < n ? '#ff7fa0' : '#e9dcef');
  }
  function zeichneGlueck(R, st) {
    var c = R.ctx, gs = st.gaeste, h = 11 + gs.length * 8;
    var ok = st.tagesziel && st.tagesziel.erreicht;
    pille(c, 2, 13, 72, h, ok ? '#fff0f6' : 'rgba(255,248,236,0.92)');
    text(R, ok ? 'Alle glücklich! ♥' : 'Ziel: alle glücklich', 6, 15, { farbe: ok ? '#d0507e' : '#7a5a9a', fett: true, groesse: 6 });
    gs.forEach(function (g, i) {
      var y = 24 + i * 8;
      text(R, g.name, 6, y - 1, { groesse: 6 });
      herzReihe(c, g, 40, y);
    });
    zeichneVorrat(R, st, 13 + h + 2);
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
      case T.GRAS: case T.OLIVE: case T.ORANGE:
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
      if (!mauer && hash(x, y) % 3 === 0) { rr(c, sx + 4, sy + 11, 8, 5, P.kontur); r(c, sx + 5, sy + 12, 6, 3, P.fenster); r(c, sx + 5, sy + 12, 2, 1, '#ffffff'); }
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

  // ---------- Figuren (v0.2: grosser Kopf, grosse Augen, runde Formen) ----------
  // ab v0.7: Biel mit Strohhut und blauer Hose, damit die Kinder ihn sofort finden
  var BIEL = { kind: false, haut: '#e8b08a', haar: '#3e2c26', haarGlanz: '#6e5246', bart: '#4a342a', hemd: '#f7f3ea', hemd2: '#d9d2c4', hose: '#5b6fa8', schuhe: '#c98b5e', sohle: '#7a4a3a',
    hut: '#ffd35e', hut2: '#d9a83a', hutBand: '#ff6f6f' };

  function zeichnePerson(c, px, py, a, dir, frame) {
    var kind = a.kind, kopf = kind ? 10 : 11, koerper = kind ? 4 : 6, bein = kind ? 2 : 3, schuh = 2;
    var Hh = kopf + koerper + bein + schuh, ox = Math.round(px) - 8, oy = Math.round(py) - Hh + 1;
    var flip = dir === 'links', seite = dir === 'links' || dir === 'rechts';
    function q(x, y, w, h, col) { c.fillStyle = col; c.fillRect(ox + (flip ? 16 - x - w : x), oy + y, w, h); }
    function qr(x, y, w, h, col) { q(x + 1, y, w - 2, h, col); q(x, y + 1, w, h - 2, col); }
    var schritt = (frame === 1) ? 1 : (frame === 3 ? -1 : 0);
    var bob = (frame === 1 || frame === 3) ? 1 : 0;
    ellipse(c, Math.round(px), Math.round(py) + 1, 6, 2, P.schatten);

    var kY = bob, rY = kopf + bob, bY = kopf + koerper, sY = bY + bein;
    // Beine und Schuhe
    q(4, bY, 8, bein + schuh, P.kontur);
    if (seite) {
      q(5 + schritt, bY, 3, bein, a.hose); q(8 - schritt, bY, 3, bein, a.hose);
      qr(4 + schritt * 2, sY - 1, 5, schuh + 1, P.kontur); q(5 + schritt * 2, sY, 3, 1, a.schuhe);
      qr(7 - schritt * 2, sY - 1, 5, schuh + 1, P.kontur); q(8 - schritt * 2, sY, 3, 1, a.schuhe);
    } else {
      var lo = schritt > 0 ? -1 : 0, ro = schritt < 0 ? -1 : 0;
      q(5, bY, 3, bein + lo, a.hose); q(8, bY, 3, bein + ro, a.hose);
      qr(4, sY + lo - 1, 4, schuh + 1, P.kontur); q(5, sY + lo, 2, 1, a.schuhe);
      qr(8, sY + ro - 1, 4, schuh + 1, P.kontur); q(9, sY + ro, 2, 1, a.schuhe);
    }
    // Koerper (rundlich)
    qr(3, rY - 1, 10, koerper + 2, P.kontur);
    q(4, rY, 8, koerper, a.hemd);
    q(4, rY + koerper - 1, 8, 1, a.hemd2);
    if (seite) {
      q(7 + schritt, rY + 1, 3, koerper - 1, P.kontur); q(8 + schritt, rY + 1, 1, koerper - 2, a.hemd2); q(8 + schritt, rY + koerper - 1, 1, 1, a.haut);
    } else {
      qr(1, rY, 3, koerper, P.kontur); qr(12, rY, 3, koerper, P.kontur);
      q(2, rY + 1, 1, koerper - 3, a.hemd); q(13, rY + 1, 1, koerper - 3, a.hemd);
      q(2, rY + koerper - 2, 1, 1, a.haut); q(13, rY + koerper - 2, 1, 1, a.haut);
      if (dir === 'unten' && !kind) q(7, rY, 2, 2, a.haut);
    }
    // Kopf: gross und rund
    q(3, kY, 10, kopf + 1, P.kontur); q(2, kY + 1, 12, kopf - 1, P.kontur);
    q(4, kY + 1, 8, kopf - 1, a.haut); q(3, kY + 2, 10, kopf - 3, a.haut);
    var hg = a.haarGlanz || a.hemd2;
    if (a.zoepfe && dir !== 'oben') {
      qr(0, kY + 3, 3, 5, P.kontur); q(1, kY + 4, 1, 3, a.haar);
      qr(13, kY + 3, 3, 5, P.kontur); q(14, kY + 4, 1, 3, a.haar);
    }
    if (a.dutt) {
      // runder Dutt (ab v0.6): oben schmaler, damit er wie eine Kugel aussieht und nicht wie eine Kapuze
      q(6, kY - 6, 4, 1, P.kontur); q(5, kY - 5, 6, 4, P.kontur); q(6, kY - 1, 4, 1, P.kontur);
      q(6, kY - 5, 4, 4, a.haar); q(6, kY - 5, 2, 1, hg); q(6, kY - 4, 1, 1, hg);
      q(6, kY - 1, 4, 1, '#ff9fb8');   // rosa Haarband trennt Dutt und Kopf
      if (dir !== 'oben' && !seite) { q(2, kY + 5, 1, 2, a.haar); q(13, kY + 5, 1, 2, a.haar); }
    }
    if (dir === 'oben') {
      q(4, kY + 1, 8, kopf - 1, a.haar); q(3, kY + 2, 10, kopf - 3, a.haar); q(6, kY + 2, 3, 1, hg);
      if (a.zoepfe) { qr(0, kY + 3, 3, 5, P.kontur); q(1, kY + 4, 1, 3, a.haar); qr(13, kY + 3, 3, 5, P.kontur); q(14, kY + 4, 1, 3, a.haar); }
      if (a.bart) { q(3, kY + kopf - 3, 1, 2, a.bart); q(12, kY + kopf - 3, 1, 2, a.bart); }
    } else if (seite) {
      q(4, kY + 1, 8, 3, a.haar); q(3, kY + 2, 10, 2, a.haar); q(3, kY + 4, 4, 4, a.haar); q(10, kY + 4, 2, 1, a.haar); q(7, kY + 1, 2, 1, hg);
      var ay = kY + 5;
      q(9, ay, 2, 3, P.kontur); q(9, ay, 1, 1, P.augeHell);
      if (a.brille) { q(8, ay - 1, 4, 1, a.brille); q(11, ay, 1, 3, a.brille); q(8, ay + 3, 4, 1, a.brille); q(5, ay - 1, 3, 1, a.brille); }
      q(12, kY + 7, 2, 2, a.haut); q(13, kY + 6, 1, 1, P.kontur);
      if (a.bart) { q(7, kY + 8, 6, 3, a.bart); q(3, kY + 8, 4, 1, a.bart); q(11, kY + 9, 1, 1, '#c0605a'); }
      else { q(9, kY + 8, 2, 1, P.backe); q(12, kY + 9, 1, 1, '#d0706a'); }
    } else {
      // Pony und Haar
      q(4, kY + 1, 8, 3, a.haar); q(3, kY + 2, 10, 2, a.haar); q(3, kY + 4, 1, 3, a.haar); q(12, kY + 4, 1, 3, a.haar);
      q(5, kY + 4, 2, 1, a.haar); q(9, kY + 4, 1, 1, a.haar);
      q(6, kY + 2, 2, 1, hg);
      var ey = kY + 5;
      // Grosse Augen mit Lichtpunkt
      q(5, ey, 2, 3, P.kontur); q(9, ey, 2, 3, P.kontur);
      q(5, ey, 1, 1, P.augeHell); q(9, ey, 1, 1, P.augeHell);
      if (a.brille) { q(4, ey - 1, 4, 1, a.brille); q(8, ey - 1, 4, 1, a.brille); q(7, ey, 2, 1, a.brille); q(4, ey + 3, 4, 1, a.brille); q(8, ey + 3, 4, 1, a.brille); }
      if (a.bart) {
        q(4, kY + 8, 8, 3, a.bart); q(3, kY + 6, 1, 3, a.bart); q(12, kY + 6, 1, 3, a.bart);
        q(7, kY + 9, 2, 1, '#c0605a'); q(4, kY + 8, 1, 1, a.haut); q(11, kY + 8, 1, 1, a.haut);
      } else {
        q(3, kY + 8, 2, 1, P.backe); q(11, kY + 8, 2, 1, P.backe);
        q(7, kY + 8, 2, 1, '#d0706a');
      }
    }
    if (a.hut) {
      // Strohhut: Krone und breite Krempe, rotes Band
      q(4, kY - 3, 8, 5, P.kontur); q(5, kY - 2, 6, 3, a.hut); q(5, kY - 2, 2, 1, '#fff0b0');
      q(5, kY + 1, 6, 1, a.hutBand);
      q(0, kY + 2, 16, 3, P.kontur); q(1, kY + 2, 14, 1, a.hut); q(2, kY + 3, 12, 1, a.hut2);
    }
    return { oben: a.hut ? oy - 3 : oy, hoehe: Hh };
  }

  function zeichneBlase(c, cx, topY, symbol, zeit) {
    var by = topY - 9 + Math.round(Math.sin((zeit || 0) * 3) * 1);
    kreis(c, cx, by, 7, P.kontur); kreis(c, cx, by, 6, P.box);
    r(c, cx - 2, by + 7, 2, 2, P.kontur); r(c, cx - 4, by + 9, 1, 1, P.kontur);
    if (symbol === 'teller') { kreis(c, cx, by, 3, P.kontur); kreis(c, cx, by, 2, '#ffffff'); r(c, cx - 1, by - 1, 2, 2, '#ffb36b'); }
    else if (symbol === 'ball') { kreis(c, cx, by, 3, P.kontur); kreis(c, cx, by, 2, '#ff8a8a'); r(c, cx - 2, by, 5, 1, '#ffffff'); }
    else if (symbol === 'herz') herz(c, cx - 2, by - 2, '#ff7fa0');
    else if (symbol === 'kissen') { pille(c, cx - 4, by - 3, 9, 6, P.kissen); }
    else if (symbol === 'zzz') { r(c, cx - 3, by - 3, 3, 1, '#8f7fd9'); r(c, cx - 2, by - 2, 1, 1, '#8f7fd9'); r(c, cx - 3, by - 1, 3, 1, '#8f7fd9'); r(c, cx + 1, by, 3, 1, '#8f7fd9'); r(c, cx + 2, by + 1, 1, 1, '#8f7fd9'); r(c, cx + 1, by + 2, 3, 1, '#8f7fd9'); }
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

  // Kochmenue: drei Karten mit Gericht, Name und Wirkung
  function zeichneMenue(R, st) {
    var c = R.ctx, M = Dorf.Spiel.MENUE, karten = Dorf.Spiel.menueKarten(), wahl = st.menue.wahl, z = st.menue.t || 0;
    c.fillStyle = 'rgba(75,58,90,0.35)'; c.fillRect(0, 0, W, H);
    pille(c, M.x, M.y, M.w, M.h, P.box);
    pille(c, M.x + 70, M.y - 6, 100, 13, '#ffd1e0');
    text(R, 'Was kochst du?', W / 2, M.y - 3, { align: 'center', fett: true, groesse: 8 });
    karten.forEach(function (k, i) {
      var G = Dorf.Gerichte.hole(k.id), aktiv = i === wahl, hop = aktiv ? Math.round(Math.abs(Math.sin(z * 4)) * 2) : 0;
      pille(c, k.x, k.y - hop, k.w, k.h, aktiv ? '#ffe3ec' : '#fff4dc');
      if (aktiv) { r(c, k.x + 2, k.y - hop + k.h - 4, k.w - 4, 2, '#ff9fb8'); herz(c, k.x + k.w - 10, k.y - hop + 4, '#ff7fa0'); }
      kreis(c, k.x + 7, k.y - hop + 7, 4, P.kontur); kreis(c, k.x + 7, k.y - hop + 7, 3, aktiv ? '#ff9fb8' : '#e2d6f5');
      text(R, String(i + 1), k.x + 7, k.y - hop + 4, { align: 'center', fett: true, groesse: 6, farbe: aktiv ? '#ffffff' : P.kontur });
      // grosser Teller (blass, wenn Zutaten fehlen, mit gruenem Haken, wenn alles im Korb ist)
      var pr = Dorf.Garten && st.vorrat ? Dorf.Garten.pruefe(st.vorrat, G) : { ok: true, frisch: false };
      if (!pr.ok) c.globalAlpha = 0.5;
      c.save(); c.translate(k.x + k.w / 2, k.y - hop + 19); c.scale(3, 3);
      zeichneTeller(c, k.id, 0, 0);
      c.restore();
      c.globalAlpha = 1;
      if (pr.ok && (pr.frisch || !G.immer)) haken(c, k.x + k.w / 2 + 13, k.y - hop + 25);
      text(R, G.name, k.x + k.w / 2, k.y - hop + 33, { align: 'center', fett: true, groesse: 7 });
      umbruch(R, G.wirkung, k.w - 8, 6).slice(0, 2).forEach(function (zeile, j) {
        text(R, zeile, k.x + k.w / 2, k.y - hop + 42 + j * 7, { align: 'center', groesse: 6, farbe: '#7a5a9a' });
      });
      // Zutaten aus dem Garten: gruen wenn genug im Korb, sonst blass mit Hinweis
      if (Dorf.Garten && st.vorrat) {
        var zp = Dorf.Garten.pruefe(st.vorrat, G), za = Object.keys(G.zutaten || {}), zy = k.y - hop + 61;
        var zx = k.x + 6;
        za.forEach(function (art) {
          var fehlt = !!zp.fehlt[art];
          zeichneZutat(c, art, zx + 2, zy, fehlt);
          text(R, String(G.zutaten[art]), zx + 6, zy - 3, { groesse: 6, fett: true, farbe: fehlt ? '#c9a3c0' : '#4f9a6a' });
          zx += 14;
        });
        var hinweis = G.immer ? (zp.frisch ? '+1 frisch' : 'geht immer') : (zp.ok ? 'alles da' : 'ernten');
        text(R, hinweis, k.x + k.w - 5, zy - 3, { align: 'right', groesse: 6, fett: true, farbe: (zp.ok && (zp.frisch || !G.immer)) ? '#4f9a6a' : '#b07aa8' });
      }
    });
    text(R, 'Tippen oder 1, 2, 3 · Pfeile und E · Esc: zurück', W / 2, M.y + M.h - 8, { align: 'center', groesse: 6, farbe: '#7a5a9a' });
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
      var aktiv = f.wahl === i, hop = aktiv ? Math.round(Math.abs(Math.sin(t * 4)) * 2) : 0, y = k.y - hop;
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
    var c = R.ctx, L = Dorf.Uhr.licht(st.uhr, st.spielzeit);
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
  }
  function zeichneGesicht(c, gs, cx, cy, n, hop) {
    var voll = n >= 5;
    if (voll) kreis(c, cx, cy - hop, 11, P.herzGold);
    kreis(c, cx, cy - hop, 10, P.kontur); kreis(c, cx, cy - hop, 9, P.uiFlaeche2);
    c.save(); c.beginPath(); c.rect(cx - 9, cy - hop - 9, 19, 19); c.clip();
    var Hh = gs.aussehen.kind ? 18 : 22;
    zeichnePerson(c, cx, cy - hop + Hh - 6, gs.aussehen, 'unten', 0);
    c.restore();
    for (var i = 0; i < 5; i++) {
      var hx = cx - 14 + i * 6, hy = cy + 12;
      if (i < n) { r(c, hx - 1, hy, 7, 4, voll ? '#c98a1a' : '#b8325c'); r(c, hx, hy + 3, 5, 2, voll ? '#c98a1a' : '#b8325c'); herz(c, hx, hy, voll ? P.herzGold : P.herzVoll); r(c, hx, hy, 1, 1, P.herzLicht); }
      else herz(c, hx, hy, P.herzLeer);
    }
  }
  function zeichneHud(R, st) {
    var c = R.ctx, L = R.letztesLicht || Dorf.Uhr.licht(st.uhr, st.spielzeit), info = { tag: st.uhr.tag, gaeste: [], teller: (st.teller || []).length };
    zeichneTagesbogen(c, st, L);
    var spricht = st.blase && st.blase.sprecher;
    st.gaeste.forEach(function (g, i) {
      var n = Dorf.Glueck ? Dorf.Glueck.herzen(g) : 0, hop = spricht === g.name ? Math.round(Math.abs(Math.sin(st.zeit * 8)) * 2) : 0;
      zeichneGesicht(c, g, 60 + i * 36, 11, n, hop);
      info.gaeste.push({ name: g.name, herzen: n });
    });
    var tl = st.teller || [];
    if (tl.length > 0) {
      var tx = 60 + st.gaeste.length * 36 - 4;
      pille(c, tx - 6, 4, 30, 14, P.uiFlaeche);
      zeichneTeller(c, tl[0], tx + 2, 11);
      text(R, '×' + tl.length, tx + 10, 7, { fett: true, groesse: 7 });
    }
    if (st.tagesziel && st.tagesziel.erreicht) for (var k = 0; k < 3; k++) { var ph = (st.zeit * 1.5 + k / 3) % 1; c.globalAlpha = 1 - ph; r(c, 50 + k * 36, 2 + Math.round(ph * 4), 1, 3, '#fff6c8'); r(c, 49 + k * 36, 3 + Math.round(ph * 4), 3, 1, '#fff6c8'); c.globalAlpha = 1; }
    zeichneVorrat(R, st, 27);
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

  // ---------- Hauptzeichnen ----------
  function zeichne(R, st) {
    var c = R.ctx, karte = st.karte, kam = st.kamera, zeit = st.zeit, T = Dorf.Karte.T;
    var cx = Math.round(kam.x), cy = Math.round(kam.y);
    if (R.ui) { R.ui.setTransform(1, 0, 0, 1, 0, 0); R.ui.clearRect(0, 0, R.uiCanvas.width, R.uiCanvas.height); R.ui.setTransform(R.uiSkala, 0, 0, R.uiSkala, 0, 0); }
    r(c, 0, 0, W, H, P.kontur);

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
    karte.baeume.forEach(function (t) { var sx = t.x * K - cx, sy = t.y * K - cy; if (sx > -24 && sx < W + 24 && sy > -32 && sy < H + 32) liste.push({ y: t.y * K + 14, f: function () { if (t.art === 'orange') zeichneOrangenbaum(c, sx, sy); else zeichneBaum(c, sx, sy); var fr = st.garten && Dorf.Garten.an(st.garten, t.x, t.y); if (fr) zeichneBaumFruechte(c, fr, sx + wackeln(fr), sy, zeit); } }); });
    (st.garten ? st.garten.liste : []).forEach(function (p) {
      if (p.baum) return;
      var sx = p.x * K - cx, sy = p.y * K - cy;
      if (sx > -20 && sx < W + 20 && sy > -24 && sy < H + 24) liste.push({ y: p.y * K + 10, f: function () { zeichnePflanze(c, p, sx + wackeln(p), sy, zeit); } });
    });
    liste.push({ y: (karte.brunnen.y + 1) * K + 12, f: function () { zeichneBrunnen(c, karte.brunnen.x * K - cx, karte.brunnen.y * K - cy, zeit); } });
    st.gaeste.forEach(function (gs) {
      var sitzt = Dorf.Gaeste.sitzt(gs), off = sitzt ? 14 : 0;
      liste.push({ y: gs.y - (sitzt ? 12 : 0), f: function () {
        var info = zeichnePerson(c, gs.x - cx, gs.y - off - cy, gs.aussehen, gs.dir, gs.frame);
        var sym = Dorf.Gaeste.symbol(gs);
        if (sym) zeichneBlase(c, Math.round(gs.x - cx) + 5, info.oben, sym, zeit);
      } });
    });
    (st.tiere ? st.tiere.liste : []).forEach(function (t) {
      var sx = t.x - cx, sy = t.y - cy;
      if (sx < -24 || sx > W + 24 || sy < -32 || sy > H + 32) return;
      if (t.art === 'esel') liste.push({ y: t.y, f: function () { zeichneEsel(c, t, sx, sy, zeit); } });
      else liste.push({ y: t.y - 30, f: function () { zeichneGecko(c, t, sx, sy, zeit); } });   // Wand: vor allem dahinter
    });
    var sp = st.spieler;
    liste.push({ y: sp.y + 0.1, f: function () { zeichnePerson(c, sp.x - cx, sp.y - cy, BIEL, sp.dir, sp.frame); } });
    liste.sort(function (a, b) { return a.y - b.y; });
    liste.forEach(function (e) { e.f(); });
    zeichneKochen(c, karte, st, cx, cy);
    zeichneHerzchen(c, st, cx, cy);
    zeichneFlieger(c, st, cx, cy);

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

    // klein fuer die Eltern: Version und Tasten, rechts oben neben den Knoepfen
    var hilfe = R.touch ? (Dorf.VERSION || '') : (Dorf.VERSION || '') + ' · E: sprechen · K: kochen · M: Ton';
    if (!st.abend) text(R, hilfe, W - (R.obenBreite || (R.touch ? 52 : 28)), 3, { farbe: P.uiTinteWeich, rand: 'rgba(255,248,238,0.85)', align: 'right', groesse: 6 });

    // Sprechblase (Dialogbox unten)
    if (st.blase && !st.abend && !st.menue) {
      var bf = { Biel: '#ffe0b8', Mia: '#ffd1e0', Jonas: '#c9f2e2', Padrina: '#e6dcff' }[st.blase.sprecher] || '#ffe0b8';
      pille(c, 6, 140, W - 12, 32, P.box);
      pille(c, 10, 133, 46, 11, bf);
      text(R, st.blase.sprecher, 33, 135, { align: 'center', fett: true });
      text(R, st.blase.text, 14, 150, { groesse: 8 });
    }

    if (!st.abend && !st.menue && !st.frage && !st.debug && Dorf.Glueck) zeichneHud(R, st);
    if (!st.abend && !st.menue && !st.frage) zeichneDenken(c, st, cx, cy);
    if (st.menue && !st.abend) zeichneMenue(R, st);
    if (st.debug) zeichneDebug(R, st);

    // Abendszene (ab v0.7 schliesst sich vorher ein Kreis um Biel)
    var irisDauer = 1.2, irisSeit = st.abendZeit === undefined ? 99 : st.zeit - st.abendZeit;
    if (st.abend && irisSeit < irisDauer) zeichneIris(c, st, cx, cy, irisSeit / irisDauer);
    if (st.abend && irisSeit >= irisDauer) {
      c.fillStyle = 'rgba(58,44,96,0.6)'; c.fillRect(0, 0, W, H);
      for (var s = 0; s < 24; s++) { var hs = hash(s, 7); r(c, hs % W, 14 + (hs >> 9) % 60, 1, 1, '#fff6c8'); }
      kreis(c, 270, 34, 9, '#fff3c4'); kreis(c, 274, 31, 8, 'rgba(58,44,96,0.95)');
      var geschafft = st.tagesziel && st.tagesziel.erreicht, seit = st.zeit - (st.abendZeit || 0);
      if (geschafft) for (var hz = 0; hz < 10; hz++) {
        var hh = hash(hz, 3), hy = 150 - ((seit * 12 + (hh % 140)) % 150);
        c.globalAlpha = Math.min(1, hy / 40); herz(c, 20 + (hh >> 5) % 280 + Math.round(Math.sin(seit * 2 + hz) * 3), Math.round(hy), ['#ff9fbf', '#ffc6dc', '#fff0a8'][hz % 3]); c.globalAlpha = 1;
      }
      pille(c, 44, 46, 232, 84, P.box);
      text(R, 'Bona nit! Tag geschafft', W / 2, 52, { align: 'center', fett: true, groesse: 12 });
      text(R, '(Gute Nacht!) Tag ' + st.uhr.tag + ' auf der Finca ist vorbei.', W / 2, 68, { align: 'center' });
      text(R, geschafft ? 'Juhu! Alle Gäste sind glücklich ♥' : 'Schöner Tag! Morgen sammeln wir weiter Herzen.', W / 2, 79, { align: 'center', fett: geschafft, farbe: geschafft ? '#d0507e' : P.kontur });
      st.gaeste.forEach(function (g, i) {
        var gx = W / 2 - st.gaeste.length * 40 + i * 80 + 6;
        text(R, g.name, gx + 16, 90, { align: 'center', groesse: 7 });
        herzReihe(c, g, gx + 1, 99);
      });
      text(R, 'Enter, Leertaste oder Tippen: nächster Tag', W / 2, 112, { align: 'center', farbe: '#7a5a9a' });
      // ohne Lesen: die Sonne unten zeigt, dass ein neuer Morgen wartet
      var bereit = seit >= ((Dorf.Spiel && Dorf.Spiel.ABEND_SPERRE) || 0) || st.abendZeit === undefined;
      c.globalAlpha = bereit ? 1 : 0.4;
      var winkt = bereit && st.hinweis && st.hinweis.ziel && st.hinweis.ziel.art === 'weiter' ? (st.hinweis.alpha || 0) : 0;
      if (winkt > 0) { c.globalAlpha = winkt * 0.8; kreis(c, W / 2, 147, 13 + Math.round(Math.abs(Math.sin(seit * 3)) * 4), '#ffd36e'); c.globalAlpha = 1; }
      kreis(c, W / 2, 147, 10 + (bereit ? Math.round((Math.sin(seit * 4) + 1)) : 0), '#fff4dc');
      zeichneSymbol(c, 'sonne', W / 2, 147);
      c.globalAlpha = 1;
    }
    if (st.frage) zeichneFrage(R, st);
    zeichneHinweis(c, st, cx, cy);
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

  Dorf.Render = { W: W, H: H, P: P, BIEL: BIEL, erstelle: erstelle, zeichne: zeichne, zeichnePerson: zeichnePerson, zeichneTeller: zeichneTeller, umbruch: umbruch, hintergrund: hintergrund, zeichneSymbol: zeichneSymbol };
})(globalThis);
