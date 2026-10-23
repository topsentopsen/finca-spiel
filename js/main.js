/* Spielzustand, Spielschleife und Start im Browser. */
(function (g) {
  'use strict';
  var Dorf = g.Dorf = g.Dorf || {};
  var STANDARD_SEED = 20261023;
  var VERSION = 'v0.2';
  var KOCHDAUER = 5, PORTIONEN = 3, TAFEL_MAX = 6;
  Dorf.VERSION = VERSION;

  function erstelle(opts) {
    opts = opts || {};
    var seed = (opts.seed !== undefined ? opts.seed : STANDARD_SEED) >>> 0;
    var rng = Dorf.RNG.erstelle(seed);
    var karte = Dorf.Karte.erstelle(rng);
    var st = {
      rng: rng, karte: karte, zeit: 0, fps: 0, debug: false, abend: false, blase: null,
      marker: null, kochen: null, essen: 0,
      eingabe: opts.eingabe || Dorf.Eingabe.erstelle(null),
      spieler: Dorf.Spieler.erstelle(karte.start.biel),
      uhr: Dorf.Uhr.erstelle(),
      kamera: Dorf.Kamera.erstelle(Dorf.Render ? Dorf.Render.W : 320, Dorf.Render ? Dorf.Render.H : 176, karte.w * karte.kachel, karte.h * karte.kachel)
    };
    st.gaeste = [Dorf.Gaeste.erstelle('mia', karte), Dorf.Gaeste.erstelle('jonas', karte)];
    Dorf.Kamera.sofort(st.kamera, st.spieler.x, st.spieler.y - 12);
    sage(st, 'Biel', 'Bon dia! (Guten Morgen!) Willkommen auf der Finca.', 5);
    return st;
  }

  function sage(st, sprecher, text, dauer) { st.blase = { sprecher: sprecher, text: text, rest: dauer || 3.5 }; }

  function istNah(a, b, max) { return Math.hypot(a.x - b.x, a.y - b.y) < max; }

  // Freie Nachbarkachel, die fuer Biel am schnellsten erreichbar ist (fuer Gaeste, Moebel, Herd).
  function besterNachbar(st, tx, ty, kandidaten) {
    var karte = st.karte, von = Dorf.Spieler.tile(st.spieler), best = null, bestLen = Infinity;
    kandidaten = kandidaten || [[0, 1], [1, 0], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]].map(function (d) { return { x: tx + d[0], y: ty + d[1] }; });
    kandidaten.forEach(function (k) {
      if (karte.blockiert(k.x, k.y)) return;
      var p = Dorf.Pfad.suche(karte, von.x, von.y, k.x, k.y);
      if (p && p.length < bestLen) { bestLen = p.length; best = k; }
    });
    return best;
  }

  function gastAn(st, wx, wy) {
    var treffer = null, best = Infinity;
    st.gaeste.forEach(function (gs) {
      var gy = gs.y - (Dorf.Gaeste.sitzt(gs) ? 14 : 0);
      if (wx >= gs.x - 8 && wx <= gs.x + 8 && wy >= gy - 26 && wy <= gy + 3) {
        var d = Math.abs(wy - (gy - 10)); if (d < best) { best = d; treffer = gs; }
      }
    });
    return treffer;
  }

  // Klick oder Tippen auf die Welt (Weltkoordinaten in Pixeln).
  function klick(st, wx, wy) {
    if (st.abend) { st.naechsterTag = true; return 'tag'; }
    var karte = st.karte, K = karte.kachel, T = Dorf.Karte.T;
    var tx = Math.floor(wx / K), ty = Math.floor(wy / K), sp = st.spieler, ziel = null, aktion = null;
    var gast = gastAn(st, wx, wy);
    if (gast) {
      var gt = Dorf.Gaeste.tileVon(gast);
      if (istNah(sp, gast, 26)) { rede(st, gast); return 'gast'; }
      ziel = besterNachbar(st, gt.x, gt.y, [[0, 1], [1, 0], [-1, 0], [0, -1]].map(function (d) { return { x: gt.x + d[0], y: gt.y + d[1] }; }));
      aktion = { art: 'sprechen', gast: gast, versuche: 0 };
    } else if (karte.tile(tx, ty) === T.HERD) {
      ziel = besterNachbar(st, tx, ty, karte.orte.herd);
      aktion = { art: 'kochen' };
    } else if (karte.blockiert(tx, ty)) {
      ziel = besterNachbar(st, tx, ty);
    } else ziel = { x: tx, y: ty };
    if (!ziel || !Dorf.Spieler.geheZu(sp, karte, ziel.x, ziel.y, aktion)) { st.marker = { x: tx, y: ty, t: 0, nein: true }; return 'nein'; }
    st.marker = { x: ziel.x, y: ziel.y, t: 0 };
    return aktion ? aktion.art : 'laufen';
  }

  function rede(st, gast) {
    var sp = st.spieler, dx = gast.x - sp.x, dy = gast.y - sp.y;
    if (Math.abs(dx) > Math.abs(dy)) sp.dir = dx < 0 ? 'links' : 'rechts'; else sp.dir = dy < 0 ? 'oben' : 'unten';
    sage(st, gast.name, Dorf.Gaeste.spruch(gast, st.rng), 3.5);
  }

  function amHerd(st) {
    var t = Dorf.Spieler.tile(st.spieler);
    return st.karte.orte.herd.some(function (h) { return h.x === t.x && h.y === t.y; });
  }
  function kochen(st) {
    if (st.kochen) { sage(st, 'Biel', 'Gleich fertig, es brutzelt schon.', 2.5); return false; }
    if (st.essen >= TAFEL_MAX) { sage(st, 'Biel', 'Die Tafel ist schon voll gedeckt.', 3); return false; }
    st.spieler.dir = 'oben';
    st.kochen = { rest: KOCHDAUER, dauer: KOCHDAUER };
    sage(st, 'Biel', 'Ich mache Pa amb oli (Brot mit Tomate und Öl).', 3.5);
    return true;
  }

  function ankunft(st, a) {
    if (!a) return;
    if (a.art === 'kochen' && amHerd(st)) kochen(st);
    else if (a.art === 'sprechen') {
      var gs = a.gast;
      if (istNah(st.spieler, gs, 30)) rede(st, gs);
      else if (a.versuche < 3) {
        var gt = Dorf.Gaeste.tileVon(gs);
        var z = besterNachbar(st, gt.x, gt.y, [[0, 1], [1, 0], [-1, 0], [0, -1]].map(function (d) { return { x: gt.x + d[0], y: gt.y + d[1] }; }));
        if (z && Dorf.Spieler.geheZu(st.spieler, st.karte, z.x, z.y, { art: 'sprechen', gast: gs, versuche: a.versuche + 1 })) { st.marker = { x: z.x, y: z.y, t: 0 }; return; }
      }
    }
    st.marker = null;
  }

  function schritt(st, dt) {
    var e = st.eingabe;
    st.zeit += dt;
    if (e.neu('debug')) st.debug = !st.debug;
    if (st.abend) {
      if (e.neu('weiter') || st.naechsterTag) {
        st.abend = false; st.naechsterTag = false;
        Dorf.Uhr.neuerTag(st.uhr);
        st.gaeste.forEach(function (gs) { gs.beduerfnisse.satt = 60; if (gs.beduerfnisse.ruhe !== undefined) gs.beduerfnisse.ruhe = 80; });
        sage(st, 'Biel', 'Bon dia! (Guten Morgen!) Tag ' + st.uhr.tag + ' beginnt.', 4);
      }
      return;
    }
    var stunden = Dorf.Uhr.update(st.uhr, dt);
    st.gaeste.forEach(function (gs) { Dorf.Gaeste.update(gs, st, dt, stunden); });
    var hatteZiel = !!st.spieler.ziel;
    var angekommen = Dorf.Spieler.update(st.spieler, e, st.karte, dt);
    if (hatteZiel && !st.spieler.ziel && !angekommen) st.marker = null;   // per Taste abgebrochen
    if (angekommen) ankunft(st, angekommen);
    if (st.marker) { st.marker.t += dt; if (st.marker.nein && st.marker.t > 0.6) st.marker = null; }
    Dorf.Kamera.update(st.kamera, st.spieler.x, st.spieler.y - 12, dt);

    if (e.neu('sprechen')) {
      var naechster = null, best = 28;
      st.gaeste.forEach(function (gs) { var d = Math.hypot(gs.x - st.spieler.x, gs.y - (Dorf.Gaeste.sitzt(gs) ? 14 : 0) - st.spieler.y); if (d < best) { best = d; naechster = gs; } });
      if (naechster) rede(st, naechster);
      else if (amHerd(st)) kochen(st);
    }
    if (st.kochen) {
      st.kochen.rest -= dt;
      if (st.kochen.rest <= 0) {
        st.kochen = null;
        st.essen = Math.min(TAFEL_MAX, st.essen + PORTIONEN);
        sage(st, 'Biel', 'Pa amb oli ist fertig und steht auf der Tafel!', 3.5);
      }
    }
    if (st.blase) { st.blase.rest -= dt; if (st.blase.rest <= 0) st.blase = null; }
    if (Dorf.Uhr.vorbei(st.uhr)) { st.abend = true; st.blase = null; st.kochen = null; Dorf.Spieler.stoppe(st.spieler); st.marker = null; }
  }

  function starte(doc, win, opts) {
    opts = opts || {};
    var canvas = doc.getElementById('spiel'), ui = doc.getElementById('ui');
    var seed = opts.seed;
    if (seed === undefined && win.location && win.location.search) {
      var m = /[?&]seed=(\d+)/.exec(win.location.search); if (m) seed = parseInt(m[1], 10);
    }
    // Entwicklerhilfe: ?start=x,y setzt Biel auf eine Kachel (fuer Screenshots)
    var startPos = null, ms = win.location && win.location.search ? /[?&]start=(\d+),(\d+)/.exec(win.location.search) : null;
    if (ms) startPos = { x: parseInt(ms[1], 10), y: parseInt(ms[2], 10) };
    var debugAn = !!(win.location && win.location.search && /[?&]debug=1/.test(win.location.search));
    var st = erstelle({ seed: seed, eingabe: Dorf.Eingabe.erstelle(win, canvas, Dorf.Render.W, Dorf.Render.H) });
    if (startPos && !st.karte.blockiert(startPos.x, startPos.y)) {
      st.spieler.x = startPos.x * 16 + 8; st.spieler.y = startPos.y * 16 + 12;
      Dorf.Kamera.sofort(st.kamera, st.spieler.x, st.spieler.y - 12);
    }
    if (debugAn) st.debug = true;
    var R = Dorf.Render.erstelle(canvas, ui);

    function groesse() {
      var s = Math.max(1, Math.floor(Math.min((win.innerWidth || 320) / Dorf.Render.W, (win.innerHeight || 176) / Dorf.Render.H)));
      var dpr = win.devicePixelRatio || 1;
      var cw = Dorf.Render.W * s + 'px', ch = Dorf.Render.H * s + 'px';
      canvas.style.width = cw; canvas.style.height = ch;
      if (ui) { ui.width = Math.round(Dorf.Render.W * s * dpr); ui.height = Math.round(Dorf.Render.H * s * dpr); ui.style.width = cw; ui.style.height = ch; R.uiSkala = s * dpr; }
    }
    win.addEventListener('resize', groesse);
    groesse();

    var last = null;
    function frame(t) {
      if (last === null) last = t;
      var dt = Math.min(0.05, Math.max(0, (t - last) / 1000)); last = t;
      if (dt > 0) st.fps = st.fps ? st.fps * 0.9 + 0.1 / dt : 1 / dt;
      st.eingabe.klicks().forEach(function (k) { klick(st, k.x + Math.round(st.kamera.x), k.y + Math.round(st.kamera.y)); });
      schritt(st, dt);
      Dorf.Render.zeichne(R, st);
      st.eingabe.ende();
      win.requestAnimationFrame(frame);
    }
    win.requestAnimationFrame(frame);
    return { st: st, R: R };
  }

  Dorf.Spiel = { STANDARD_SEED: STANDARD_SEED, VERSION: VERSION, KOCHDAUER: KOCHDAUER, PORTIONEN: PORTIONEN, erstelle: erstelle, schritt: schritt, sage: sage, klick: klick, kochen: kochen, starte: starte };

  if (typeof g.document !== 'undefined' && typeof g.window !== 'undefined' && g.document.getElementById) {
    g.window.addEventListener('load', function () { Dorf.Spiel.laufend = starte(g.document, g.window); });
  }
})(globalThis);
