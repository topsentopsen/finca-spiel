/* Spielzustand, Spielschleife und Start im Browser. */
(function (g) {
  'use strict';
  var Dorf = g.Dorf = g.Dorf || {};
  var STANDARD_SEED = 20261023;

  function erstelle(opts) {
    opts = opts || {};
    var seed = (opts.seed !== undefined ? opts.seed : STANDARD_SEED) >>> 0;
    var rng = Dorf.RNG.erstelle(seed);
    var karte = Dorf.Karte.erstelle(rng);
    var st = {
      rng: rng, karte: karte, zeit: 0, fps: 0, debug: false, abend: false, blase: null,
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

  function schritt(st, dt) {
    var e = st.eingabe;
    st.zeit += dt;
    if (e.neu('debug')) st.debug = !st.debug;
    if (st.abend) {
      if (e.neu('weiter')) {
        st.abend = false;
        Dorf.Uhr.neuerTag(st.uhr);
        st.gaeste.forEach(function (gs) { gs.beduerfnisse.satt = 60; });
        sage(st, 'Biel', 'Bon dia! (Guten Morgen!) Tag ' + st.uhr.tag + ' beginnt.', 4);
      }
      return;
    }
    var stunden = Dorf.Uhr.update(st.uhr, dt);
    st.gaeste.forEach(function (gs) { Dorf.Gaeste.update(gs, st, dt, stunden); });
    Dorf.Spieler.update(st.spieler, e, st.karte, dt);
    Dorf.Kamera.update(st.kamera, st.spieler.x, st.spieler.y - 12, dt);

    if (e.neu('sprechen')) {
      var naechster = null, best = 28;
      st.gaeste.forEach(function (gs) { var d = Math.hypot(gs.x - st.spieler.x, gs.y - st.spieler.y); if (d < best) { best = d; naechster = gs; } });
      if (naechster) sage(st, naechster.name, Dorf.Gaeste.spruch(naechster, st.rng), 3.5);
    }
    if (st.blase) { st.blase.rest -= dt; if (st.blase.rest <= 0) st.blase = null; }
    if (Dorf.Uhr.vorbei(st.uhr)) { st.abend = true; st.blase = null; }
  }

  function starte(doc, win, opts) {
    opts = opts || {};
    var canvas = doc.getElementById('spiel'), ui = doc.getElementById('ui');
    var seed = opts.seed;
    if (seed === undefined && win.location && win.location.search) {
      var m = /[?&]seed=(\d+)/.exec(win.location.search); if (m) seed = parseInt(m[1], 10);
    }
    var st = erstelle({ seed: seed, eingabe: Dorf.Eingabe.erstelle(win) });
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
      schritt(st, dt);
      Dorf.Render.zeichne(R, st);
      st.eingabe.ende();
      win.requestAnimationFrame(frame);
    }
    win.requestAnimationFrame(frame);
    return { st: st, R: R };
  }

  Dorf.Spiel = { STANDARD_SEED: STANDARD_SEED, erstelle: erstelle, schritt: schritt, sage: sage, starte: starte };

  if (typeof g.document !== 'undefined' && typeof g.window !== 'undefined' && g.document.getElementById) {
    g.window.addEventListener('load', function () { Dorf.Spiel.laufend = starte(g.document, g.window); });
  }
})(globalThis);
