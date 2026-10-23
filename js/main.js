/* Spielzustand, Spielschleife und Start im Browser. */
(function (g) {
  'use strict';
  var Dorf = g.Dorf = g.Dorf || {};
  var STANDARD_SEED = 20261023;
  var VERSION = 'v0.5';
  var KOCHDAUER = 5, PORTIONEN = 3, TAFEL_MAX = 6;   // Werte fuer Pa amb oli, die anderen Gerichte stehen in gerichte.js
  Dorf.VERSION = VERSION;

  function erstelle(opts) {
    opts = opts || {};
    var seed = (opts.seed !== undefined ? opts.seed : STANDARD_SEED) >>> 0;
    var rng = Dorf.RNG.erstelle(seed);
    var karte = Dorf.Karte.erstelle(rng);
    var st = {
      rng: rng, karte: karte, zeit: 0, fps: 0, debug: false, abend: false, blase: null,
      marker: null, kochen: null, teller: [], menue: null, toene: [], schrittWeg: 0,
      herzchen: [], tagesziel: { erreicht: false, neu: false },
      eingabe: opts.eingabe || Dorf.Eingabe.erstelle(null),
      spieler: Dorf.Spieler.erstelle(karte.start.biel),
      uhr: Dorf.Uhr.erstelle(),
      kamera: Dorf.Kamera.erstelle(Dorf.Render ? Dorf.Render.W : 320, Dorf.Render ? Dorf.Render.H : 176, karte.w * karte.kachel, karte.h * karte.kachel)
    };
    st.gaeste = Dorf.Gaeste.REIHE.map(function (id) { return Dorf.Gaeste.erstelle(id, karte); });
    st.garten = Dorf.Garten.erstelle(karte);
    st.vorrat = Dorf.Garten.leererVorrat();
    st.tiere = Dorf.Tiere.erstelle(karte, seed);
    Dorf.Kamera.sofort(st.kamera, st.spieler.x, st.spieler.y - 12);
    sage(st, 'Biel', 'Bon dia! (Guten Morgen!) Willkommen auf der Finca.', 5);
    return st;
  }

  function sage(st, sprecher, text, dauer) { st.blase = { sprecher: sprecher, text: text, rest: dauer || 3.5 }; }
  // Geraeusch fuer den Browser vormerken (Spiellogik bleibt ohne WebAudio testbar)
  function klang(st, name) { st.toene.push(name); if (st.toene.length > 32) st.toene.shift(); }

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
    if (st.menue) { schliesseMenue(st); return 'zurueck'; }
    var karte = st.karte, K = karte.kachel, T = Dorf.Karte.T;
    var tx = Math.floor(wx / K), ty = Math.floor(wy / K), sp = st.spieler, ziel = null, aktion = null;
    var gast = gastAn(st, wx, wy), tier = gast ? null : Dorf.Tiere.an(st.tiere, wx, wy);
    if (tier) {
      if (Dorf.Tiere.nah(tier, sp)) { streichle(st, tier); return 'tier'; }
      ziel = tierPlatz(st, tier);
      aktion = { art: 'streicheln', tier: tier, versuche: 0 };
      if (ziel) Dorf.Tiere.locke(st.tiere, karte, tier, ziel.x * K + 8, ziel.y * K + 12);
    } else if (gast) {
      var gt = Dorf.Gaeste.tileVon(gast);
      if (istNah(sp, gast, 26)) { rede(st, gast); return 'gast'; }
      ziel = besterNachbar(st, gt.x, gt.y, [[0, 1], [1, 0], [-1, 0], [0, -1]].map(function (d) { return { x: gt.x + d[0], y: gt.y + d[1] }; }));
      aktion = { art: 'sprechen', gast: gast, versuche: 0 };
    } else if (Dorf.Garten.an(st.garten, tx, ty)) {
      var pf = Dorf.Garten.an(st.garten, tx, ty);
      if (Dorf.Garten.nah(pf, sp)) { ernte(st, pf); return 'ernten'; }
      ziel = karte.blockiert(tx, ty) ? besterNachbar(st, tx, ty) : { x: tx, y: ty };
      aktion = { art: 'ernten', pflanze: pf };
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
    klang(st, 'glocke');
    if (Dorf.Glueck) Dorf.Glueck.gib(st, gast, 'reden');
  }

  // Freie Kachel neben einem Tier, die Biel erreichen kann (beim Esel ausserhalb vom Zaun)
  function tierPlatz(st, tier) {
    var K = st.karte.kachel, tx = Math.floor(tier.x / K), ty = Math.floor(tier.y / K), k = [];
    for (var dy = -3; dy <= 3; dy++) for (var dx = -3; dx <= 3; dx++) k.push({ x: tx + dx, y: ty + dy, d: Math.abs(dx) + Math.abs(dy) });
    k.sort(function (a, b) { return a.d - b.d; });
    var karte = st.karte, von = Dorf.Spieler.tile(st.spieler);
    for (var i = 0; i < k.length; i++) {
      if (karte.blockiert(k[i].x, k[i].y)) continue;
      if (k[i].x === von.x && k[i].y === von.y) return k[i];
      if (Dorf.Pfad.suche(karte, von.x, von.y, k[i].x, k[i].y)) return k[i];
    }
    return null;
  }
  // Streicheln: Herz, leiser Laut, Biel erzaehlt etwas. Gaeste in der Naehe freuen sich mit.
  function streichle(st, tier) {
    var sp = st.spieler, dx = tier.x - sp.x, dy = tier.y - sp.y;
    if (Math.abs(dx) > Math.abs(dy)) sp.dir = dx < 0 ? 'links' : 'rechts'; else sp.dir = dy < 0 ? 'oben' : 'unten';
    if (tier.art === 'esel' && st.vorrat && st.vorrat.karotte > 0) return fuettere(st, tier);
    Dorf.Tiere.streichle(tier, sp);
    st.herzchen.push({ x: tier.x, y: tier.y - (tier.art === 'esel' ? 22 : 8), t: 0, farbe: '#ff7fa0' });
    klang(st, tier.art === 'esel' ? 'esel' : 'gecko');
    sage(st, 'Biel', Dorf.Tiere.spruch(tier), 3.5);
    if (Dorf.Glueck) st.gaeste.forEach(function (gs) { if (Math.hypot(gs.x - tier.x, gs.y - tier.y) < 72) Dorf.Glueck.gib(st, gs, 'tier'); });
    return true;
  }

  // Bruna bekommt eine Karotte aus dem Korb: sie mampft, zwei Herzen steigen auf, Gaeste in der Naehe freuen sich sehr
  function fuettere(st, tier) {
    st.vorrat.karotte--;
    Dorf.Tiere.fuettere(tier, st.spieler);
    st.herzchen.push({ x: tier.x - 5, y: tier.y - 22, t: 0, farbe: '#ff7fa0' });
    st.herzchen.push({ x: tier.x + 6, y: tier.y - 26, t: -0.25, farbe: '#ffb3d1' });
    klang(st, 'mampf');
    sage(st, 'Biel', Dorf.Tiere.fuetterSpruch(tier), 3.5);
    if (Dorf.Glueck) st.gaeste.forEach(function (gs) { if (Math.hypot(gs.x - tier.x, gs.y - tier.y) < 112) Dorf.Glueck.gib(st, gs, 'fuettern'); });
    return true;
  }

  // Ernten: die Frucht hopst in Biels Korb. Ist sie noch nicht reif, sagt Biel freundlich Bescheid.
  function ernte(st, p) {
    var sp = st.spieler, A = Dorf.Garten.ARTEN[p.art], q = Dorf.Garten.punkt(p), dx = q.x - sp.x, dy = q.y - sp.y;
    if (Math.abs(dx) > Math.abs(dy)) sp.dir = dx < 0 ? 'links' : 'rechts'; else if (Math.abs(dy) > 2) sp.dir = dy < 0 ? 'oben' : 'unten';
    if (!p.reif) {
      sage(st, 'Biel', (p.baum ? 'Am Baum' : 'Im Beet') + ' wächst gerade noch alles nach. Bald ist es wieder reif!', 3);
      return 0;
    }
    if ((st.vorrat[p.art] || 0) >= Dorf.Garten.VORRAT_MAX) { sage(st, 'Biel', 'Mein Korb ist voll mit ' + A.mehrzahl + '. Erst mal kochen!', 3); return 0; }
    var n = Dorf.Garten.ernte(st.garten, st.vorrat, p);
    st.herzchen.push({ x: q.x, y: q.y - 14, t: 0, bild: p.art });
    klang(st, 'ernte');
    sage(st, 'Biel', (n === 1 ? 'Eine ' + A.name : n + ' ' + A.mehrzahl) + '! (' + A.wort + ')' + (p.art === 'karotte' ? ' Die mag Bruna.' : ''), 2.5);
    return n;
  }

  function amHerd(st) {
    var t = Dorf.Spieler.tile(st.spieler);
    return st.karte.orte.herd.some(function (h) { return h.x === t.x && h.y === t.y; });
  }
  // Kochen in zwei Schritten: erst das Menue mit den Gerichten, dann das gewaehlte Gericht.
  function oeffneMenue(st) {
    if (st.kochen) { sage(st, 'Biel', 'Gleich fertig, es brutzelt schon.', 2.5); return false; }
    if (st.teller.length >= TAFEL_MAX) { sage(st, 'Biel', 'Die Tafel ist schon voll gedeckt.', 3); return false; }
    st.spieler.dir = 'oben';
    Dorf.Spieler.stoppe(st.spieler);
    st.menue = { wahl: st.letzteWahl || 0, t: 0 };
    klang(st, 'menue');
    return true;
  }
  function schliesseMenue(st) { st.menue = null; }
  function kochen(st, id) {
    var G = Dorf.Gerichte.hole(id || 'paamboli');
    st.menue = null;
    if (!G) return false;
    if (st.kochen) { sage(st, 'Biel', 'Gleich fertig, es brutzelt schon.', 2.5); return false; }
    if (st.teller.length >= TAFEL_MAX) { sage(st, 'Biel', 'Die Tafel ist schon voll gedeckt.', 3); return false; }
    st.spieler.dir = 'oben';
    st.letzteWahl = Dorf.Gerichte.REIHE.indexOf(G.id);
    var z = Dorf.Garten.pruefe(st.vorrat, G);
    if (!z.ok) {
      sage(st, 'Biel', 'Für ' + G.name + ' hole ich noch ' + Dorf.Garten.fehltText(z.fehlt) + ' aus dem Garten.', 4);
      klang(st, 'menue');
      return false;
    }
    if (z.frisch) Dorf.Garten.verbrauche(st.vorrat, G);
    st.kochen = { rest: G.dauer, dauer: G.dauer, gericht: G.id, frisch: z.frisch && !!G.immer };
    sage(st, 'Biel', 'Ich mache ' + G.name + ' (' + G.info + ')' + (st.kochen.frisch ? ' mit frischer Tomate und Olive!' : '.'), 3.5);
    klang(st, 'kochen');
    return true;
  }
  // Kochknopf oder Taste K: am Herd das Menue oeffnen, sonst zum Herd laufen
  function zumHerd(st) {
    if (st.abend) return 'nein';
    if (st.menue) { kochen(st, Dorf.Gerichte.REIHE[st.menue.wahl]); return 'gekocht'; }
    if (amHerd(st)) { oeffneMenue(st); return 'menue'; }
    var ziel = besterNachbar(st, 5, 2, st.karte.orte.herd);
    if (!ziel || !Dorf.Spieler.geheZu(st.spieler, st.karte, ziel.x, ziel.y, { art: 'kochen' })) return 'nein';
    st.marker = { x: ziel.x, y: ziel.y, t: 0 };
    return 'laufen';
  }

  // Lage der Gerichtekarten im Menue (interne Bildpixel), gemeinsam fuer Zeichnen und Tippen
  var MENUE = { x: 40, y: 30, w: 240, h: 100, kx: 48, ky: 50, kw: 72, kh: 70, abstand: 6 };
  function menueKarten() {
    return Dorf.Gerichte.REIHE.map(function (id, i) { return { id: id, x: MENUE.kx + i * (MENUE.kw + MENUE.abstand), y: MENUE.ky, w: MENUE.kw, h: MENUE.kh }; });
  }
  // Klick in Bildschirmkoordinaten (0..320, 0..176): Menue bedienen oder in die Welt umrechnen
  function klickBild(st, bx, by) {
    if (st.menue && !st.abend) {
      var karten = menueKarten();
      for (var i = 0; i < karten.length; i++) {
        var k = karten[i];
        if (bx >= k.x && bx < k.x + k.w && by >= k.y && by < k.y + k.h) { kochen(st, k.id); return 'gekocht'; }
      }
      schliesseMenue(st); return 'zurueck';
    }
    return klick(st, bx + Math.round(st.kamera.x), by + Math.round(st.kamera.y));
  }

  function menueSchritt(st, e) {
    var m = st.menue, n = Dorf.Gerichte.REIHE.length, alt = m.wahl;
    if (e.neu('links') || e.neu('hoch')) m.wahl = (m.wahl + n - 1) % n;
    if (e.neu('rechts') || e.neu('runter')) m.wahl = (m.wahl + 1) % n;
    if (m.wahl !== alt) klang(st, 'menue');
    if (e.neu('wahl1')) return kochen(st, Dorf.Gerichte.REIHE[0]);
    if (e.neu('wahl2')) return kochen(st, Dorf.Gerichte.REIHE[1]);
    if (e.neu('wahl3')) return kochen(st, Dorf.Gerichte.REIHE[2]);
    if (e.neu('sprechen') || e.neu('weiter') || e.neu('kochen')) return kochen(st, Dorf.Gerichte.REIHE[m.wahl]);
    if (e.neu('abbruch')) schliesseMenue(st);
  }

  function ankunft(st, a) {
    if (!a) return;
    if (a.art === 'kochen' && amHerd(st)) oeffneMenue(st);
    else if (a.art === 'ernten') { if (Dorf.Garten.nah(a.pflanze, st.spieler)) ernte(st, a.pflanze); }
    else if (a.art === 'streicheln') {
      var t = a.tier;
      if (Dorf.Tiere.nah(t, st.spieler)) { if (t.ziel && t.lockt) { st.wartetAuf = { tier: t, rest: 3 }; return; } streichle(st, t); }
      else if (t.ziel && t.lockt) { st.wartetAuf = { tier: t, rest: 3 }; return; }
      else if (a.versuche < 2) {
        var zt = tierPlatz(st, t);
        if (zt && Dorf.Spieler.geheZu(st.spieler, st.karte, zt.x, zt.y, { art: 'streicheln', tier: t, versuche: a.versuche + 1 })) { st.marker = { x: zt.x, y: zt.y, t: 0 }; return; }
      }
    }
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
        if (Dorf.Glueck) Dorf.Glueck.neuerTag(st);
        Dorf.Garten.neuerTag(st.garten);
        st.herzchen.length = 0;
        sage(st, 'Biel', 'Bon dia! (Guten Morgen!) Tag ' + st.uhr.tag + ' beginnt.', 4);
      }
      return;
    }
    var stunden = Dorf.Uhr.update(st.uhr, dt);
    st.gaeste.forEach(function (gs) { Dorf.Gaeste.update(gs, st, dt, stunden); });
    Dorf.Tiere.update(st.tiere, st.karte, dt);
    Dorf.Garten.update(st.garten, stunden);
    for (var hz = st.herzchen.length - 1; hz >= 0; hz--) { st.herzchen[hz].t += dt; if (st.herzchen[hz].t > 1.4) st.herzchen.splice(hz, 1); }
    // Biel wartet kurz am Zaun, bis Bruna angetrottet ist
    if (st.wartetAuf) {
      var wt = st.wartetAuf.tier; st.wartetAuf.rest -= dt;
      if (st.spieler.ziel) st.wartetAuf = null;
      else if (!wt.ziel || st.wartetAuf.rest <= 0) { st.wartetAuf = null; if (Dorf.Tiere.nah(wt, st.spieler)) streichle(st, wt); else { wt.lockt = false; sage(st, 'Biel', wt.name + ' ist gerade lieber am anderen Ende der Wiese.', 3); } }
    }
    var menueOffen = !!st.menue;
    if (menueOffen) { st.menue.t += dt; menueSchritt(st, e); }
    var hatteZiel = !!st.spieler.ziel, vx = st.spieler.x, vy = st.spieler.y;
    var angekommen = menueOffen ? null : Dorf.Spieler.update(st.spieler, e, st.karte, dt);
    if (menueOffen) { st.spieler.laeuft = false; st.spieler.frame = 0; }
    // sehr leise Schritte
    st.schrittWeg += Math.hypot(st.spieler.x - vx, st.spieler.y - vy);
    if (st.schrittWeg >= 14) { st.schrittWeg = 0; klang(st, 'schritt'); }
    if (hatteZiel && !st.spieler.ziel && !angekommen) st.marker = null;   // per Taste abgebrochen
    if (angekommen) ankunft(st, angekommen);
    if (st.marker) { st.marker.t += dt; if (st.marker.nein && st.marker.t > 0.6) st.marker = null; }
    Dorf.Kamera.update(st.kamera, st.spieler.x, st.spieler.y - 12, dt);

    if (!menueOffen && e.neu('kochen')) zumHerd(st);
    if (!menueOffen && e.neu('sprechen')) {
      var naechster = null, best = 28;
      st.gaeste.forEach(function (gs) { var d = Math.hypot(gs.x - st.spieler.x, gs.y - (Dorf.Gaeste.sitzt(gs) ? 14 : 0) - st.spieler.y); if (d < best) { best = d; naechster = gs; } });
      var nahTier = naechster ? null : Dorf.Tiere.naechstes(st.tiere, st.spieler);
      var nahPflanze = (naechster || nahTier) ? null : Dorf.Garten.naechste(st.garten, st.spieler);
      if (naechster) rede(st, naechster);
      else if (nahTier) streichle(st, nahTier);
      else if (nahPflanze) ernte(st, nahPflanze);
      else if (amHerd(st)) oeffneMenue(st);
    }
    if (st.kochen) {
      st.kochen.rest -= dt;
      if (st.kochen.rest <= 0) {
        var G = Dorf.Gerichte.hole(st.kochen.gericht), anzahl = G.portionen + (st.kochen.frisch ? 1 : 0);
        st.kochen = null;
        for (var p = 0; p < anzahl && st.teller.length < TAFEL_MAX; p++) st.teller.push(G.id);
        sage(st, 'Biel', G.name + ' ist fertig und steht auf der Tafel!', 3.5);
        klang(st, 'fertig');
      }
    }
    if (st.tagesziel.neu) {
      st.tagesziel.neu = false;
      sage(st, 'Biel', 'Juhu! Alle Gäste sind glücklich. Tagesziel geschafft!', 4.5);
      klang(st, 'feier');
    }
    if (st.blase) { st.blase.rest -= dt; if (st.blase.rest <= 0) st.blase = null; }
    if (Dorf.Uhr.vorbei(st.uhr)) {
      st.abend = true; st.abendZeit = st.zeit; st.blase = null; st.kochen = null; st.menue = null; Dorf.Spieler.stoppe(st.spieler); st.marker = null; st.wartetAuf = null;
      klang(st, st.tagesziel.erreicht ? 'feier' : 'nacht');
    }
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
    // Entwicklerhilfe: ?uhr=20 stellt die Uhrzeit, ?abend=1 zeigt die Abendszene, ?herzen=1 macht alle gluecklich
    var mu = win.location && /[?&]uhr=(\d+)/.exec(win.location.search || '');
    if (mu) st.uhr.minute = Math.max(Dorf.Uhr.START, Math.min(Dorf.Uhr.ENDE - 1, parseInt(mu[1], 10) * 60));
    if (win.location && /[?&]herzen=1/.test(win.location.search || '')) st.gaeste.forEach(function (gs) { gs.glueck = Dorf.Glueck.MAX - 5; });
    if (win.location && /[?&]abend=1/.test(win.location.search || '')) st.uhr.minute = Dorf.Uhr.ENDE;
    // ?korb=1 legt von allem drei Stueck in den Korb (zum Ausprobieren)
    if (win.location && /[?&]korb=1/.test(win.location.search || '')) Dorf.Garten.REIHE.forEach(function (a) { st.vorrat[a] = 3; });
    // Entwicklerhilfe: ?menue=1 oeffnet gleich das Kochmenue (fuer Screenshots)
    if (win.location && /[?&]menue=1/.test(win.location.search || '')) oeffneMenue(st);
    var R = Dorf.Render.erstelle(canvas, ui);
    var rahmen = doc.getElementById('rahmen');
    var ton = st.ton = Dorf.Ton ? Dorf.Ton.erstelle(win) : null;

    // Ton-Knopf (Lautsprecher), Vollbild-Knopf und grosse Knoepfe fuer Handy und Tablet
    var tonKnopf = doc.getElementById('ton-knopf'), vollKnopf = doc.getElementById('vollbild-knopf');
    function zeigeTon() {
      if (!tonKnopf || !ton) return;
      tonKnopf.className = ton.stumm ? 'knopf aus' : 'knopf';
      tonKnopf.setAttribute('aria-label', ton.stumm ? 'Ton einschalten' : 'Ton ausschalten');
      tonKnopf.setAttribute('aria-pressed', ton.stumm ? 'true' : 'false');
    }
    if (ton) ton.beiAenderung = zeigeTon;
    zeigeTon();
    function knopf(el, f) {
      if (!el || !el.addEventListener) return;
      // click statt pointerdown: nur so erlauben alle Browser Vollbild und Ton
      el.addEventListener('click', function (ev) { if (ev.preventDefault) ev.preventDefault(); f(ev); if (el.blur) el.blur(); });
    }
    knopf(tonKnopf, function () { if (ton) { ton.entsperre(); ton.umschalten(); } });
    var root = doc.documentElement;
    var vollGeht = !!(root && (root.requestFullscreen || root.webkitRequestFullscreen));
    if (vollKnopf) {
      if (!vollGeht) vollKnopf.style.display = 'none';
      knopf(vollKnopf, function () {
        try {
          if (doc.fullscreenElement || doc.webkitFullscreenElement) (doc.exitFullscreen || doc.webkitExitFullscreen).call(doc);
          else (root.requestFullscreen || root.webkitRequestFullscreen).call(root);
        } catch (e) { /* nicht erlaubt, egal */ }
      });
    }
    knopf(doc.getElementById('knopf-sprechen'), function () { st.eingabe.tippe(st.abend ? 'weiter' : 'sprechen'); });
    knopf(doc.getElementById('knopf-kochen'), function () { st.eingabe.tippe('kochen'); });
    var touchAn = !!((win.matchMedia && win.matchMedia('(pointer: coarse)').matches) || (win.navigator && win.navigator.maxTouchPoints > 0) || /[?&]touch=1/.test((win.location && win.location.search) || ''));
    function zeigeTouch() { R.touch = touchAn; if (rahmen && rahmen.classList) rahmen.classList.toggle('touch', touchAn); }
    zeigeTouch();
    if (doc.addEventListener) doc.addEventListener('visibilitychange', function () { if (ton) ton.pausiere(doc.hidden); });

    function groesse() {
      var roh = Math.min((win.innerWidth || 320) / Dorf.Render.W, (win.innerHeight || 176) / Dorf.Render.H);
      // ab 2x ganzzahlig und pixelscharf, auf kleinen Handys darf es krumm sein
      var s = roh >= 2 ? Math.floor(roh) : Math.max(0.5, Math.floor(roh * 100) / 100);
      var dpr = win.devicePixelRatio || 1;
      var cw = Dorf.Render.W * s + 'px', ch = Dorf.Render.H * s + 'px';
      canvas.style.width = cw; canvas.style.height = ch;
      if (rahmen && rahmen.style && rahmen.style.setProperty) rahmen.style.setProperty('--s', String(s));
      if (ui) { ui.width = Math.round(Dorf.Render.W * s * dpr); ui.height = Math.round(Dorf.Render.H * s * dpr); ui.style.width = cw; ui.style.height = ch; R.uiSkala = s * dpr; }
    }
    win.addEventListener('resize', groesse);
    groesse();

    var last = null;
    function frame(t) {
      if (last === null) last = t;
      var dt = Math.min(0.05, Math.max(0, (t - last) / 1000)); last = t;
      if (dt > 0) st.fps = st.fps ? st.fps * 0.9 + 0.1 / dt : 1 / dt;
      if (st.eingabe.touch && !touchAn) { touchAn = true; zeigeTouch(); }
      if (ton && st.eingabe.neu('stumm')) { ton.entsperre(); ton.umschalten(); }
      st.eingabe.klicks().forEach(function (k) { klickBild(st, k.x, k.y); });
      schritt(st, dt);
      if (ton) {
        st.toene.forEach(function (n) { ton.spiele(n); });
        var sp = st.spieler, kb = st.karte.brunnen, pool = st.karte.orte.pool[0];
        var dB = Math.hypot(sp.x - (kb.x * 16 + 16), sp.y - (kb.y * 16 + 16));
        var dP = pool ? Math.hypot(sp.x - pool.x * 16, sp.y - pool.y * 16) : 999;
        ton.umgebung(Math.max(0, 1 - Math.min(dB, dP * 1.4) / 110));
        ton.tageszeit(st.uhr.minute / 60, st.abend);
      }
      st.toene.length = 0;
      Dorf.Render.zeichne(R, st);
      st.eingabe.ende();
      win.requestAnimationFrame(frame);
    }
    win.requestAnimationFrame(frame);
    return { st: st, R: R };
  }

  Dorf.Spiel = { STANDARD_SEED: STANDARD_SEED, VERSION: VERSION, KOCHDAUER: KOCHDAUER, PORTIONEN: PORTIONEN, erstelle: erstelle, schritt: schritt, sage: sage, klick: klick, klickBild: klickBild, kochen: kochen, streichle: streichle, tierPlatz: tierPlatz, oeffneMenue: oeffneMenue, zumHerd: zumHerd, menueKarten: menueKarten, MENUE: MENUE, TAFEL_MAX: TAFEL_MAX, starte: starte };

  if (typeof g.document !== 'undefined' && typeof g.window !== 'undefined' && g.document.getElementById) {
    g.window.addEventListener('load', function () { Dorf.Spiel.laufend = starte(g.document, g.window); });
  }
})(globalThis);
