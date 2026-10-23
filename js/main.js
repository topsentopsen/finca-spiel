/* Spielzustand, Spielschleife und Start im Browser. */
(function (g) {
  'use strict';
  var Dorf = g.Dorf = g.Dorf || {};
  var STANDARD_SEED = 20261023;
  var VERSION = 'v0.9';
  var KOCHDAUER = 5, PORTIONEN = 3, TAFEL_MAX = 6;   // Werte fuer Pa amb oli, die anderen Gerichte stehen in gerichte.js
  var LAMPEN = 6;             // ab v0.7: Fenster plus fuenf Laternen gehen am Abend nacheinander an
  var TIPP_DAUER = 0.3;       // so lange ist der kleine Kreis nach jedem Tippen zu sehen
  var ABEND_SPERRE = 4;       // Sekunden nach Abendbeginn, in denen Tippen noch nicht zum naechsten Tag springt (ab v0.9: erst Herzen und Sticker zeigen)
  // ab v0.9: Ablauf der Abendszene "Bona nit" in Sekunden ab Abendbeginn. Jeder Gast zaehlt seine Herzen hoch (0,26 s pro Herz),
  // die Gaeste leicht versetzt. Danach ploppt der neue Sticker auf, dann erscheint die Sonne fuer den neuen Morgen.
  var ABEND = { iris: 1.2, herzStart: 1.5, herzTakt: 0.26, versatz: 0.2, sticker: 3.3 };
  var SPEICHER_TAKT = 5;      // alle 5 Sekunden wird der Spielstand gesichert
  var FLUG_KORB = 0.6;        // ab v0.8: so lange fliegt eine Frucht oder ein Ei in den Korb unten links
  var AKTION_PULS = 3;        // der grosse Knopf pulsiert nur bei den ersten drei Malen
  var AKTION_NAME = { reden: 'Reden', streicheln: 'Streicheln', fuettern: 'Füttern', ernten: 'Ernten', sammeln: 'Ei aufheben', kochen: 'Kochen', weiter: 'Neuer Tag' };
  var WACKEL = 0.5, MENUE_ZU = 0.9;   // ab v0.9: Karte mit fehlenden Zutaten wackelt, danach geht das Menue zu
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
      // ab v0.6: Rueckfrage "Neu anfangen", fliegende Ernte, Gedankenblase von Biel, Hinweise ohne Lesen
      spielzeit: 0, seed: seed, frage: null, flieger: [], denk: null, wunsch: null, korbPuls: {}, gelernt: {},
      // ab v0.8: Herzen fliegen zum Bild des Gastes oben, Bild huepft kurz, Sprechblasen zaehlen mit (fuers Vorlesen)
      herzFlug: [], chipPuls: {}, blasenNr: 0, aktionGenutzt: 0,
      // ab v0.9: Bilderbuch (Rezepte und Sticker), Album, Tageslog fuer den Sticker am Abend
      buch: null, buchSeite: 0, album: {}, albumNeu: false, heute: {}, neuerSticker: null, abendZaehler: 0,
      hinweis: Dorf.Hinweise ? Dorf.Hinweise.erstelle() : null,
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
    sage(st, 'Biel', 'Bon dia! (Guten Morgen!) Willkommen auf der Finca.', 5, ['sonne', 'lachen']);
    return st;
  }

  // Sprechblase (ab v0.8 nur mit Bildern, ohne Namensschild). text bleibt fuer das Vorlesen und die Tests.
  function sage(st, sprecher, text, dauer, bilder) {
    st.blasenNr = (st.blasenNr || 0) + 1;
    st.blase = { sprecher: sprecher, text: text, rest: dauer || 3.5, dauer: dauer || 3.5, t: 0, nr: st.blasenNr, bilder: (bilder && bilder.length ? bilder : ['lachen']).slice(0, 3) };
  }
  // Geraeusch fuer den Browser vormerken (Spiellogik bleibt ohne WebAudio testbar)
  function klang(st, name) { st.toene.push(name); if (st.toene.length > 32) st.toene.shift(); }

  function lerne(st, art) { if (Dorf.Hinweise) Dorf.Hinweise.lerne(st, art); }
  function merke(st, tat) { if (Dorf.Sticker) Dorf.Sticker.merke(st, tat); }
  // Gedankenblase ueber Biel mit kleinen Bildern (fuer Kinder, die noch nicht lesen)
  function denke(st, bilder, dauer) { st.denk = { bilder: bilder.slice(0, 4), rest: dauer || 3, t: 0 }; klang(st, 'hmm'); }

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

  // ab v0.6: Kinderfinger treffen nicht immer genau. Ging der Tipp knapp daneben, zaehlt das naechste Ziel im Umkreis.
  var HERD_MITTE = { x: 5 * 16 + 8, y: 2 * 16 + 8 };
  function naechstesZiel(st, wx, wy, rad) {
    var best = null, bd = rad;
    function pruef(d, z) { if (d < bd) { bd = d; best = z; } }
    st.gaeste.forEach(function (gs) { var gy = gs.y - (Dorf.Gaeste.sitzt(gs) ? 14 : 0) - 10; pruef(Math.hypot(wx - gs.x, wy - gy) - 4, { gast: gs }); });
    st.tiere.liste.forEach(function (t) { var e = t.art === 'esel', h = t.art === 'huhn'; pruef(Math.hypot(wx - t.x, wy - (t.y - (e ? 10 : (h ? 5 : 2)))) - (e ? 8 : (h ? 3 : 2)), { tier: t }); });
    (st.tiere.eier || []).forEach(function (ei) { pruef(Math.hypot(wx - ei.x, wy - (ei.y - 3)) - 1, { ei: ei }); });
    st.garten.liste.forEach(function (p) { var q = Dorf.Garten.punkt(p); pruef(Math.hypot(wx - q.x, wy - (q.y - (p.baum ? 14 : 6))) - (p.baum ? 6 : 3), { pflanze: p }); });
    pruef(Math.hypot(wx - HERD_MITTE.x, wy - HERD_MITTE.y) - 12, { herd: true });
    return best;
  }

  // Klick oder Tippen auf die Welt (Weltkoordinaten in Pixeln).
  function klick(st, wx, wy) {
    if (!isFinite(wx) || !isFinite(wy)) return 'nein';
    if (st.frage) { st.frage = null; return 'nein'; }
    if (st.buch) { schliesseBuch(st); return 'zurueck'; }
    if (st.abend) {
      // gerade erst Abend: Dauertippen soll den schoenen Abend nicht sofort wegklicken
      if (st.abendZeit !== undefined && st.zeit - st.abendZeit < ABEND_SPERRE) return 'warte';
      st.naechsterTag = true; return 'tag';
    }
    if (st.menue) { schliesseMenue(st); return 'zurueck'; }
    var karte = st.karte, K = karte.kachel, T = Dorf.Karte.T;
    var tx = Math.floor(wx / K), ty = Math.floor(wy / K), sp = st.spieler, ziel = null, aktion = null;
    var gast = gastAn(st, wx, wy), ei = gast ? null : Dorf.Tiere.eiAn(st.tiere, wx, wy, 6);
    var tier = (gast || ei) ? null : Dorf.Tiere.an(st.tiere, wx, wy);
    var pf = (gast || tier || ei) ? null : Dorf.Garten.an(st.garten, tx, ty);
    var herd = !gast && !tier && !pf && !ei && karte.tile(tx, ty) === T.HERD;
    if (!gast && !tier && !pf && !herd && !ei) {
      var f = naechstesZiel(st, wx, wy, st.eingabe.touch ? 14 : 8);
      if (f) { gast = f.gast || null; tier = f.tier || null; pf = f.pflanze || null; herd = !!f.herd; ei = f.ei || null; }
    }
    if (ei) {
      if (Math.hypot(ei.x - sp.x, ei.y - sp.y) <= Dorf.Tiere.EI_NAH) { sammle(st, ei); return 'sammeln'; }
      tx = Math.floor(ei.x / K); ty = Math.floor(ei.y / K);
      ziel = karte.blockiert(tx, ty) ? besterNachbar(st, tx, ty) : { x: tx, y: ty };
      aktion = { art: 'sammeln', ei: ei };
    } else if (tier) {
      if (Dorf.Tiere.nah(tier, sp)) { streichle(st, tier); return 'tier'; }
      ziel = tierPlatz(st, tier);
      aktion = { art: 'streicheln', tier: tier, versuche: 0 };
      if (ziel) Dorf.Tiere.locke(st.tiere, karte, tier, ziel.x * K + 8, ziel.y * K + 12);
    } else if (gast) {
      var gt = Dorf.Gaeste.tileVon(gast);
      if (istNah(sp, gast, 26)) { rede(st, gast); return 'gast'; }
      ziel = besterNachbar(st, gt.x, gt.y, [[0, 1], [1, 0], [-1, 0], [0, -1]].map(function (d) { return { x: gt.x + d[0], y: gt.y + d[1] }; }));
      aktion = { art: 'sprechen', gast: gast, versuche: 0 };
    } else if (pf) {
      if (Dorf.Garten.nah(pf, sp)) { ernte(st, pf); return 'ernten'; }
      tx = pf.x; ty = pf.y;
      ziel = karte.blockiert(tx, ty) ? besterNachbar(st, tx, ty) : { x: tx, y: ty };
      aktion = { art: 'ernten', pflanze: pf };
    } else if (herd) {
      tx = 5; ty = 2;
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
    var info = Dorf.Gaeste.spruchInfo(gast, st.rng);
    sage(st, gast.name, info.text, 3.5, info.bilder);
    klang(st, 'glocke'); lerne(st, 'reden');
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
    merke(st, tier.art === 'esel' ? 'esel' : (tier.art === 'huhn' ? 'huhn' : 'gecko'));
    st.herzchen.push({ x: tier.x, y: tier.y - (tier.art === 'esel' ? 22 : (tier.art === 'huhn' ? 14 : 8)), t: 0, farbe: '#ff7fa0' });
    klang(st, tier.art === 'esel' ? 'esel' : (tier.art === 'huhn' ? 'gack' : 'gecko'));
    sage(st, 'Biel', Dorf.Tiere.spruch(tier), 3.5, Dorf.Tiere.BILDER[tier.art] || ['herz']);
    if (Dorf.Glueck) st.gaeste.forEach(function (gs) { if (Math.hypot(gs.x - tier.x, gs.y - tier.y) < 72) Dorf.Glueck.gib(st, gs, 'tier'); });
    return true;
  }

  // Bruna bekommt eine Karotte aus dem Korb: sie mampft, zwei Herzen steigen auf, Gaeste in der Naehe freuen sich sehr
  function fuettere(st, tier) {
    st.vorrat.karotte--; lerne(st, 'fuettern'); merke(st, 'esel');
    Dorf.Tiere.fuettere(tier, st.spieler);
    st.herzchen.push({ x: tier.x - 5, y: tier.y - 22, t: 0, farbe: '#ff7fa0' });
    st.herzchen.push({ x: tier.x + 6, y: tier.y - 26, t: -0.25, farbe: '#ffb3d1' });
    klang(st, 'mampf');
    sage(st, 'Biel', Dorf.Tiere.fuetterSpruch(tier), 3.5, ['esel', 'karotte', 'lachen']);
    if (Dorf.Glueck) st.gaeste.forEach(function (gs) { if (Math.hypot(gs.x - tier.x, gs.y - tier.y) < 112) Dorf.Glueck.gib(st, gs, 'fuettern'); });
    return true;
  }

  // Ernten: die Frucht hopst in Biels Korb. Ist sie noch nicht reif, sagt Biel freundlich Bescheid.
  function ernte(st, p) {
    var sp = st.spieler, A = Dorf.Garten.ARTEN[p.art], q = Dorf.Garten.punkt(p), dx = q.x - sp.x, dy = q.y - sp.y;
    if (Math.abs(dx) > Math.abs(dy)) sp.dir = dx < 0 ? 'links' : 'rechts'; else if (Math.abs(dy) > 2) sp.dir = dy < 0 ? 'oben' : 'unten';
    if (!p.reif) {
      sage(st, 'Biel', (p.baum ? 'Am Baum' : 'Im Beet') + ' wächst gerade noch alles nach. Bald ist es wieder reif!', 3, ['spross', 'sonne']);
      denke(st, ['spross'], 2.5); p.wackel = 0.4;
      return 0;
    }
    if ((st.vorrat[p.art] || 0) >= Dorf.Garten.VORRAT_MAX) { sage(st, 'Biel', 'Mein Korb ist voll mit ' + A.mehrzahl + '. Erst mal kochen!', 3, ['korb', p.art, 'topf']); denke(st, [p.art, 'topf'], 3); return 0; }
    var n = Dorf.Garten.ernte(st.garten, st.vorrat, p);
    // Die Frucht fliegt im Bogen in Biels Korb, die Pflanze wackelt
    for (var f = 0; f < n; f++) st.flieger.push({ art: p.art, x: q.x + (f ? 4 : 0), y: q.y - (p.baum ? 22 : 8), t: -0.12 * f, dauer: FLUG_KORB });
    p.wackel = 0.5;
    klang(st, 'ernte'); lerne(st, 'ernten'); merke(st, 'ernte');
    if (st.wunsch === p.art) st.wunsch = null;
    sage(st, 'Biel', (n === 1 ? 'Eine ' + A.name : n + ' ' + A.mehrzahl) + '! (' + A.wort + ')' + (p.art === 'karotte' ? ' Die mag Bruna.' : ''), 2.5, [p.art, 'korb']);
    return n;
  }

  // ab v0.8: Ei aus dem Gras aufheben, es fliegt in den Korb
  function sammle(st, ei) {
    var sp = st.spieler, dx = ei.x - sp.x, dy = ei.y - sp.y;
    if (Math.abs(dx) > Math.abs(dy)) sp.dir = dx < 0 ? 'links' : 'rechts'; else if (Math.abs(dy) > 2) sp.dir = dy < 0 ? 'oben' : 'unten';
    if ((st.vorrat.ei || 0) >= Dorf.Garten.VORRAT_MAX) { sage(st, 'Biel', 'Mein Korb ist voll mit Eiern. Erst mal kochen!', 3, ['korb', 'ei', 'topf']); return 0; }
    if (!Dorf.Tiere.nimmEi(st.tiere, ei)) return 0;
    st.vorrat.ei = (st.vorrat.ei || 0) + 1;
    st.flieger.push({ art: 'ei', x: ei.x, y: ei.y - 4, t: 0, dauer: FLUG_KORB });
    klang(st, 'ernte'); lerne(st, 'sammeln'); merke(st, 'ei');
    sage(st, 'Biel', 'Ein Ei! (ou) Das kommt in den Korb.', 2.5, ['ei', 'korb']);
    return 1;
  }

  function amHerd(st) {
    var t = Dorf.Spieler.tile(st.spieler);
    return st.karte.orte.herd.some(function (h) { return h.x === t.x && h.y === t.y; });
  }
  // Kochen in zwei Schritten: erst das Menue mit den Gerichten, dann das gewaehlte Gericht.
  function oeffneMenue(st) {
    if (st.kochen) { sage(st, 'Biel', 'Gleich fertig, es brutzelt schon.', 2.5, ['topf', 'sanduhr']); return false; }
    if (st.teller.length >= TAFEL_MAX) { sage(st, 'Biel', 'Die Tafel ist schon voll gedeckt.', 3, ['teller', 'teller', 'teller']); return false; }
    st.spieler.dir = 'oben';
    Dorf.Spieler.stoppe(st.spieler);
    st.menue = { wahl: st.letzteWahl || 0, t: 0 };
    klang(st, 'menue');
    return true;
  }
  function schliesseMenue(st) { st.menue = null; }
  function kochen(st, id) {
    var G = Dorf.Gerichte.hole(id || 'paamboli'), warOffen = st.menue;
    st.menue = null;
    if (!G) return false;
    if (st.kochen) { sage(st, 'Biel', 'Gleich fertig, es brutzelt schon.', 2.5, ['topf', 'sanduhr']); return false; }
    if (st.teller.length >= TAFEL_MAX) { sage(st, 'Biel', 'Die Tafel ist schon voll gedeckt.', 3, ['teller', 'teller', 'teller']); return false; }
    st.spieler.dir = 'oben';
    st.letzteWahl = Dorf.Gerichte.REIHE.indexOf(G.id);
    var z = Dorf.Garten.pruefe(st.vorrat, G);
    if (!z.ok) {
      // Bilder statt Text: Biel denkt an die fehlenden Zutaten, danach zeigt die Hand gleich zur Pflanze
      var bilder = []; Object.keys(z.fehlt).forEach(function (a) { for (var i = 0; i < Math.min(2, z.fehlt[a]); i++) bilder.push(a); });
      sage(st, 'Biel', 'Für ' + G.name + ' hole ich noch ' + Dorf.Garten.fehltText(z.fehlt) + ' aus dem Garten.', 4, bilder.concat(['frage']).slice(0, 3));
      denke(st, bilder, 4);
      st.wunsch = Object.keys(z.fehlt)[0] || null;
      // ab v0.9: war das Menue offen, bleibt es kurz da, die Karte wackelt (die fehlenden Zutaten sind gestrichelt), dann geht es zu
      if (warOffen) { st.menue = warOffen; warOffen.wahl = st.letzteWahl; warOffen.wackel = { id: G.id, t: 0 }; warOffen.zu = MENUE_ZU; }
      klang(st, 'bloop');
      return false;
    }
    // ab v0.8: ein Ei ist nie Pflicht. Liegt eins im Korb, kommt es mit hinein und es gibt einen Teller mehr.
    var mitEi = !!z.bonus;
    if (z.frisch || mitEi) Dorf.Garten.verbrauche(st.vorrat, G, mitEi);
    st.kochen = { rest: G.dauer, dauer: G.dauer, gericht: G.id, frisch: z.frisch && !!G.immer, ei: mitEi };
    sage(st, 'Biel', 'Ich mache ' + G.name + ' (' + G.info + ')' + (st.kochen.frisch ? ' mit frischer Tomate und Olive!' : (mitEi ? ' mit einem frischen Ei!' : '.')), 3.5,
      ['gericht:' + G.id, 'topf'].concat(mitEi ? ['ei'] : []));
    klang(st, 'kochen'); lerne(st, 'kochen'); merke(st, 'koch_' + G.id);
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
  // Rueckfrage "Neu anfangen?": zwei grosse Bildknoepfe, Nein (X) ist vorausgewaehlt
  var FRAGE = { x: 60, y: 26, w: 200, h: 110, nein: { x: 78, y: 78, w: 76, h: 48 }, ja: { x: 166, y: 78, w: 76, h: 48 } };
  function frageAuf(st) { if (st.frage) return; st.frage = { wahl: 0, t: 0 }; st.menue = null; st.buch = null; Dorf.Spieler.stoppe(st.spieler); st.marker = null; klang(st, 'menue'); }
  function drin(k, x, y) { return x >= k.x && x < k.x + k.w && y >= k.y && y < k.y + k.h; }

  // ---------- Bilderbuch (ab v0.9) ----------
  // Seiten 0 bis 2: ein Rezept pro Gericht (Zutaten + Zutaten = Gericht, wer es liebt, Ei als Extra). Seite 3: das Sticker Album.
  // Bedienen ohne Lesen: linke Haelfte tippen = zurueck blaettern, rechte Haelfte = weiter, X oder daneben = zu. Zwei Reiter oben: Topf und Stern.
  var BUCH = { x: 26, y: 26, w: 268, h: 140, zu: { x: 276, y: 18, w: 24, h: 22 },
    reiter: [{ x: 46, y: 14, w: 34, h: 16, seite: 0 }, { x: 84, y: 14, w: 34, h: 16, seite: 3 }] };
  var BUCH_SEITEN = 4, ALBUM_SEITE = 3;
  // Buchknopf im Kochmenue (oben rechts am Rand der Tafel)
  var MENUE_BUCH = { x: 252, y: 20, w: 30, h: 22 };
  function oeffneBuch(st, seite) {
    if (st.frage) return false;
    if (seite === undefined) seite = st.albumNeu ? ALBUM_SEITE : (st.buchSeite || 0);
    seite = Math.max(0, Math.min(BUCH_SEITEN - 1, seite | 0));
    st.buch = { seite: seite, t: 0, blatt: 0, richtung: 0, stups: 0 };
    if (seite === ALBUM_SEITE) st.albumNeu = false;
    Dorf.Spieler.stoppe(st.spieler); st.marker = null;
    klang(st, 'blaettern');
    return true;
  }
  function schliesseBuch(st) { if (st.buch) st.buchSeite = st.buch.seite; st.buch = null; }
  function blaettere(st, d) {
    var b = st.buch, neu = b.seite + d;
    if (neu < 0 || neu >= BUCH_SEITEN) { b.stups = 0.3; b.richtung = d; klang(st, 'menue'); return false; }   // Ende: Buch stupst nur kurz
    b.seite = neu; b.blatt = 0.25; b.richtung = d;
    if (neu === ALBUM_SEITE) st.albumNeu = false;
    klang(st, 'blaettern');
    return true;
  }
  function buchKlick(st, bx, by, zeiger) {
    var b = st.buch;
    if (zeiger && b.t < 0.2) return 'warte';
    if (drin(BUCH.zu, bx, by)) { schliesseBuch(st); return 'zurueck'; }
    for (var i = 0; i < BUCH.reiter.length; i++) {
      var rt = BUCH.reiter[i];
      if (drin(rt, bx, by)) { if (b.seite !== rt.seite) { b.richtung = rt.seite > b.seite ? 1 : -1; b.seite = rt.seite; b.blatt = 0.25; if (rt.seite === ALBUM_SEITE) st.albumNeu = false; klang(st, 'blaettern'); } return 'seite'; }
    }
    if (!drin(BUCH, bx, by)) { schliesseBuch(st); return 'zurueck'; }
    blaettere(st, bx < BUCH.x + BUCH.w / 2 ? -1 : 1);
    return 'blaettern';
  }
  function buchSchritt(st, e, dt) {
    var b = st.buch;
    b.t += dt; if (b.blatt > 0) b.blatt = Math.max(0, b.blatt - dt); if (b.stups > 0) b.stups = Math.max(0, b.stups - dt);
    if (e.neu('links') || e.neu('hoch')) blaettere(st, -1);
    else if (e.neu('rechts') || e.neu('runter')) blaettere(st, 1);
    if (e.neu('abbruch') || e.neu('buch') || (b.t > 0.2 && (e.neu('weiter') || e.neu('sprechen')))) schliesseBuch(st);
  }
  function klickBild(st, bx, by, zeiger) {
    if (!isFinite(bx) || !isFinite(by)) return 'nein';
    st.tipps = (st.tipps || []).slice(-3); st.tipps.push({ x: bx, y: by, t: 0 });
    if (st.frage) {
      if (zeiger && st.frage.t < 0.3) return 'warte';
      if (drin(FRAGE.ja, bx, by)) { neuAnfangen(st); return 'neu'; }
      st.frage = null; return 'nein';
    }
    if (st.buch) return buchKlick(st, bx, by, zeiger);
    if (st.menue && !st.abend) {
      if (zeiger && st.menue.t < 0.25) return 'warte';     // der Finger vom Tipp auf den Herd zaehlt nicht als Wahl
      if (drin(MENUE_BUCH, bx, by)) { oeffneBuch(st, st.menue.wahl); return 'buch'; }
      var karten = menueKarten();
      for (var i = 0; i < karten.length; i++) {
        var k = karten[i];
        if (bx >= k.x && bx < k.x + k.w && by >= k.y && by < k.y + k.h) { kochen(st, k.id); return 'gekocht'; }
      }
      schliesseMenue(st); return 'zurueck';
    }
    return klick(st, bx + Math.round(st.kamera.x), by + Math.round(st.kamera.y));
  }

  function frageSchritt(st, e) {
    var f = st.frage;
    if (e.neu('links') || e.neu('rechts') || e.neu('hoch') || e.neu('runter')) { f.wahl = f.wahl ? 0 : 1; klang(st, 'menue'); }
    if (e.neu('abbruch')) { st.frage = null; return; }
    if (f.t > 0.2 && (e.neu('weiter') || e.neu('sprechen'))) { if (f.wahl === 1) neuAnfangen(st); else st.frage = null; }
  }
  // Alles auf Anfang: neuer erster Tag mit demselben Garten. Ton und Debug bleiben, wie sie sind.
  function neuAnfangen(st) {
    // die Spielzeit des Tages bleibt: Neu anfangen verlaengert den Tag nicht ueber 15 Minuten
    // ab v0.9: das Sticker Album gehoert dem Kind und bleibt auch beim Neuanfang
    var behalte = { eingabe: st.eingabe, ton: st.ton, debug: st.debug, speicher: st.speicher, fps: st.fps, spielzeit: st.spielzeit, album: st.album, albumNeu: st.albumNeu, vorlesen: st.vorlesen };
    var neu = erstelle({ seed: st.seed, eingabe: st.eingabe });
    Object.keys(st).forEach(function (k) { if (!(k in neu)) delete st[k]; });
    Object.keys(neu).forEach(function (k) { st[k] = neu[k]; });
    Object.keys(behalte).forEach(function (k) { if (behalte[k] !== undefined) st[k] = behalte[k]; });
    if (Dorf.Speicher && st.speicher) Dorf.Speicher.loesche(st.speicher);
    st.speichernJetzt = true;
    st.herzchen.push({ x: st.spieler.x, y: st.spieler.y - 26, t: 0, farbe: '#ff7fa0' });
    klang(st, 'neu');
    return true;
  }

  function menueSchritt(st, e, dt) {
    var m = st.menue, n = Dorf.Gerichte.REIHE.length, alt = m.wahl;
    // ab v0.9: nach dem Wackeln (Zutaten fehlen) geht das Menue von selbst zu, die Hand zeigt dann zur Pflanze
    if (m.wackel) { m.wackel.t += dt || 0; if (m.wackel.t >= WACKEL) m.wackel = null; }
    if (m.zu !== undefined) { m.zu -= dt || 0; if (m.zu <= 0) { schliesseMenue(st); return; } }
    if (e.neu('buch')) { oeffneBuch(st, m.wahl); return; }
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
    else if (a.art === 'sammeln') { if (st.tiere.eier.indexOf(a.ei) >= 0 && Math.hypot(a.ei.x - st.spieler.x, a.ei.y - st.spieler.y) <= Dorf.Tiere.EI_NAH + 6) sammle(st, a.ei); }
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

  // ab v0.8: Was macht der eine grosse Knopf (und Taste E) gerade? Gleiche Reihenfolge wie vorher bei E:
  // Gast in der Naehe, dann Tier (beim Huhn zuerst das Ei), dann reife Pflanze, dann Ei, dann Herd. null = es gibt gerade nichts zu tun.
  function kontext(st) {
    if (st.frage || st.buch) return null;
    if (st.abend) return { art: 'weiter' };
    if (st.menue) return { art: 'kochen' };
    var sp = st.spieler, naechster = null, best = 28;
    st.gaeste.forEach(function (gs) { var d = Math.hypot(gs.x - sp.x, gs.y - (Dorf.Gaeste.sitzt(gs) ? 14 : 0) - sp.y); if (d < best) { best = d; naechster = gs; } });
    if (naechster) return { art: 'reden', ziel: naechster };
    var tier = Dorf.Tiere.naechstes(st.tiere, sp), eiNah = Dorf.Tiere.naechstesEi(st.tiere, sp);
    // ein Ei direkt vor den Fuessen ist wichtiger als das Huhn daneben
    if (tier && tier.art === 'huhn' && eiNah) return { art: 'sammeln', ziel: eiNah };
    if (tier) return { art: (tier.art === 'esel' && st.vorrat.karotte > 0) ? 'fuettern' : 'streicheln', ziel: tier };
    var pf = Dorf.Garten.naechste(st.garten, sp);
    if (pf) return { art: 'ernten', ziel: pf };
    if (eiNah) return { art: 'sammeln', ziel: eiNah };
    if (amHerd(st)) return { art: 'kochen' };
    return null;
  }
  function tueKontext(st, k) {
    if (!k) return false;
    if (k.art === 'reden') rede(st, k.ziel);
    else if (k.art === 'streicheln' || k.art === 'fuettern') streichle(st, k.ziel);
    else if (k.art === 'ernten') ernte(st, k.ziel);
    else if (k.art === 'sammeln') sammle(st, k.ziel);
    else if (k.art === 'kochen') oeffneMenue(st);
    else return false;
    return true;
  }

  // echt (ab v0.7): wirklich vergangene Sekunden, hoechstens 1 (laenger versteckter Tab zaehlt als Pause)
  function schritt(st, dt, echt) {
    var e = st.eingabe;
    if (!(dt >= 0)) dt = 0;
    if (dt > 0.25) dt = 0.25;
    if (!(echt >= 0)) echt = dt;
    if (echt > 1) echt = 1;
    st.zeit += dt;
    // Tipp-Kreise (ab v0.7) altern auch in Menue, Rueckfrage und Abend
    if (st.tipps && st.tipps.length) { st.tipps.forEach(function (tp) { tp.t += dt; }); st.tipps = st.tipps.filter(function (tp) { return tp.t < TIPP_DAUER; }); }
    // harte 15 Minuten Grenze: zaehlt auch, waehrend Menue oder Rueckfrage offen sind
    if (!st.abend) st.spielzeit = (st.spielzeit || 0) + echt;
    if (e.neu('debug')) st.debug = !st.debug;
    if (Dorf.Hinweise) Dorf.Hinweise.update(st, dt, e.aktiv ? e.aktiv() : false);
    if (st.frage) { st.frage.t += dt; frageSchritt(st, e); return; }
    // ab v0.9: Bilderbuch auf und zu (Taste B), es geht auch am Abend
    var buchJetzt = !!st.buch;
    if (buchJetzt) buchSchritt(st, e, dt);
    else if (e.neu('buch') && !st.menue) oeffneBuch(st);
    if (st.abend) {
      var seit = st.abendZeit === undefined ? 99 : st.zeit - st.abendZeit;
      var gesperrt = st.abendZeit !== undefined && seit < ABEND_SPERRE;
      // Herzen zaehlen hoch: bei jedem neuen Herz ein leises Pling, dann der Sticker
      var gezaehlt = 0; st.gaeste.forEach(function (gs, i) { gezaehlt += abendHerzen(st, i, seit); });
      if (gezaehlt > (st.abendZaehler || 0)) { st.abendZaehler = gezaehlt; klang(st, 'zaehl'); }
      if (st.neuerSticker && seit >= ABEND.sticker && !st.stickerGezeigt) { st.stickerGezeigt = true; klang(st, 'sticker'); }
      if (st.blase) { st.blase.t = (st.blase.t || 0) + dt; st.blase.rest -= dt; if (st.blase.rest <= 0) st.blase = null; }
      if (buchJetzt || st.buch) { st.naechsterTag = false; return; }
      if ((e.neu('weiter') && !gesperrt) || st.naechsterTag) {
        st.abend = false; st.naechsterTag = false; st.spielzeit = 0;
        Dorf.Uhr.neuerTag(st.uhr);
        st.gaeste.forEach(function (gs) { gs.beduerfnisse.satt = 60; if (gs.beduerfnisse.ruhe !== undefined) gs.beduerfnisse.ruhe = 80; });
        if (Dorf.Glueck) Dorf.Glueck.neuerTag(st);
        Dorf.Garten.neuerTag(st.garten);
        Dorf.Tiere.neuerTag(st.tiere, st.karte);
        st.herzchen.length = 0; st.flieger.length = 0; st.herzFlug.length = 0; st.denk = null; st.wunsch = null; st.teller.length = Math.min(st.teller.length, TAFEL_MAX);
        lerne(st, 'weiter'); st.speichernJetzt = true;
        if (Dorf.Sticker) Dorf.Sticker.neuerTag(st);
        st.abendZaehler = 0; st.stickerGezeigt = false; st.blase = null;
        sage(st, 'Biel', 'Bon dia! (Guten Morgen!) Tag ' + st.uhr.tag + ' beginnt.', 4, ['sonne', 'lachen']);
      }
      return;
    }
    var stunden = Dorf.Uhr.update(st.uhr, dt, Dorf.Uhr.mindestMinuten(st.uhr, st.spielzeit, echt));
    st.gaeste.forEach(function (gs) { Dorf.Gaeste.update(gs, st, dt, stunden); });
    Dorf.Tiere.update(st.tiere, st.karte, dt);
    if (st.tiere.neuesEi) { st.tiere.neuesEi = 0; klang(st, 'gack'); }
    Dorf.Garten.update(st.garten, stunden);
    for (var hz = st.herzchen.length - 1; hz >= 0; hz--) { st.herzchen[hz].t += dt; if (st.herzchen[hz].t > 1.4) st.herzchen.splice(hz, 1); }
    if (st.herzchen.length > 40) st.herzchen.splice(0, st.herzchen.length - 40);
    // Ernte im Flug: kommt die Frucht im Korb an, hopst das Korbfach kurz
    for (var fl = st.flieger.length - 1; fl >= 0; fl--) {
      var fg = st.flieger[fl]; fg.t += dt;
      if (fg.t >= fg.dauer) { st.flieger.splice(fl, 1); st.korbPuls[fg.art] = 0.45; klang(st, 'plopp'); }
    }
    Object.keys(st.korbPuls).forEach(function (a) { st.korbPuls[a] -= dt; if (st.korbPuls[a] <= 0) delete st.korbPuls[a]; });
    // ab v0.8: Herz im Flug zum Gastbild oben. Kommt es an, huepft das Bild und zeigt das neue Herz
    for (var hf = st.herzFlug.length - 1; hf >= 0; hf--) {
      var h = st.herzFlug[hf]; h.t += dt;
      if (h.t >= h.dauer) { st.herzFlug.splice(hf, 1); st.chipPuls[h.id] = 0.35; klang(st, 'plopp'); }
    }
    Object.keys(st.chipPuls).forEach(function (a) { st.chipPuls[a] -= dt; if (st.chipPuls[a] <= 0) delete st.chipPuls[a]; });
    st.gaeste.forEach(function (gs) { if (gs.hop > 0) gs.hop = Math.max(0, gs.hop - dt); });
    st.garten.liste.forEach(function (p) { if (p.wackel > 0) p.wackel = Math.max(0, p.wackel - dt); });
    if (st.denk) { st.denk.t += dt; st.denk.rest -= dt; if (st.denk.rest <= 0) st.denk = null; }
    // Biel wartet kurz am Zaun, bis Bruna angetrottet ist
    if (st.wartetAuf) {
      var wt = st.wartetAuf.tier; st.wartetAuf.rest -= dt;
      if (st.spieler.ziel) st.wartetAuf = null;
      else if (!wt.ziel || st.wartetAuf.rest <= 0) { st.wartetAuf = null; if (Dorf.Tiere.nah(wt, st.spieler)) streichle(st, wt); else { wt.lockt = false; sage(st, 'Biel', wt.name + ' ist gerade lieber am anderen Ende der Wiese.', 3, ['esel', 'frage']); } }
    }
    var menueOffen = !!st.menue || buchJetzt || !!st.buch;
    if (!menueOffen) gaehnTon(st);
    if (st.menue && !buchJetzt && !st.buch) { st.menue.t += dt; menueSchritt(st, e, dt); }
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
    // Taste E und der grosse Knopf: dieselbe passende Aktion
    if (!menueOffen && e.neu('sprechen')) tueKontext(st, kontext(st));
    if (st.kochen) {
      st.kochen.rest -= dt;
      if (st.kochen.rest <= 0) {
        var G = Dorf.Gerichte.hole(st.kochen.gericht), anzahl = G.portionen + (st.kochen.frisch ? 1 : 0) + (st.kochen.ei ? 1 : 0);
        st.kochen = null;
        for (var p = 0; p < anzahl && st.teller.length < TAFEL_MAX; p++) st.teller.push(G.id);
        sage(st, 'Biel', G.name + ' ist fertig und steht auf der Tafel!', 3.5, ['gericht:' + G.id, 'herz']);
        klang(st, 'fertig');
      }
    }
    if (st.tagesziel.neu) {
      st.tagesziel.neu = false;
      sage(st, 'Biel', 'Juhu! Alle Gäste sind glücklich. Tagesziel geschafft!', 4.5, ['herz', 'herz', 'stern']);
      klang(st, 'feier');
    }
    if (st.blase) { st.blase.t = (st.blase.t || 0) + dt; st.blase.rest -= dt; if (st.blase.rest <= 0) st.blase = null; }
    // ab v0.7: am Abend gehen die Lichter eins nach dem anderen an, jedes mit einem leisen Pling
    var lz = Math.ceil(Dorf.Uhr.licht(st.uhr, st.spielzeit).lampen * LAMPEN - 1e-6);
    if (lz > (st.lampenAn || 0)) klang(st, 'licht');
    st.lampenAn = lz;
    if (Dorf.Uhr.vorbei(st.uhr)) {
      st.abend = true; st.abendZeit = st.zeit; st.blase = null; st.kochen = null; st.menue = null; st.buch = null; Dorf.Spieler.stoppe(st.spieler); st.marker = null; st.wartetAuf = null;
      st.denk = null; st.speichernJetzt = true; st.abendZaehler = 0; st.stickerGezeigt = false;
      // ab v0.9: Sticker fuer heute ins Album (wird in der Abendszene gezeigt)
      if (st.tagesziel.erreicht) merke(st, 'ziel');
      if (Dorf.Sticker) Dorf.Sticker.vergib(st);
      klang(st, st.tagesziel.erreicht ? 'feier' : 'nacht');
      // nur zum Vorlesen (am Abend ist keine Sprechblase zu sehen)
      sage(st, 'Biel', 'Bona nit! Gute Nacht.' + (st.neuerSticker ? ' Für heute gibt es einen Sticker.' : ''), 4, ['mond']);
    }
  }

  // ab v0.9: wie viele Herzen zeigt Gast i in der Abendszene nach seit Sekunden? (zaehlt hoch bis zu seinen Herzen)
  // ab v0.9: muede Gaeste gaehnen ab und zu (wenig Ruhe oder Daemmerung). 0 = Mund zu, 1 = ganz offen
  var GAEHN = { takt: 14, dauer: 1.6, ruhe: 35, daemmer: 0.2, tonAbstand: 30 };
  function gaehnen(st, i) {
    var gs = st.gaeste && st.gaeste[i];
    if (!gs || st.abend || gs.dir === 'oben') return 0;
    if (gs.zustand === 'aktiv' && gs.ziel === 'couch') return 0;   // schlaeft schon
    var b = gs.beduerfnisse || {}, muede = (b.ruhe !== undefined && b.ruhe < GAEHN.ruhe) || Dorf.Uhr.daemmerung(st.uhr, st.spielzeit) > GAEHN.daemmer;
    if (!muede) return 0;
    var p = ((st.zeit || 0) + i * 4.3) % GAEHN.takt;
    return p < GAEHN.dauer ? Math.sin(p / GAEHN.dauer * Math.PI) : 0;
  }
  function gaehnTon(st) {
    if (st.zeit - (st.gaehnZeit === undefined ? -999 : st.gaehnZeit) < GAEHN.tonAbstand) return;
    for (var i = 0; i < st.gaeste.length; i++) {
      var gs = st.gaeste[i], sx = gs.x - st.kamera.x, sy = gs.y - st.kamera.y;
      if (gaehnen(st, i) > 0.5 && sx > 0 && sx < 320 && sy > 0 && sy < 176) { st.gaehnZeit = st.zeit; klang(st, 'gaehn'); return; }
    }
  }
  function abendHerzen(st, i, seit) {
    var gs = st.gaeste[i]; if (!gs) return 0;
    var n = Dorf.Glueck ? Dorf.Glueck.herzen(gs) : 0, ab = ABEND.herzStart + i * ABEND.versatz;
    if (seit < ab) return 0;
    return Math.max(0, Math.min(n, Math.floor((seit - ab) / ABEND.herzTakt) + 1));
  }

  // Notfall-Aufraeumen nach einem Fehler: alles Vorlaeufige weg, Figuren zurueck auf sichere Plaetze.
  function rette(st) {
    st.menue = null; st.frage = null; st.buch = null; st.blase = null; st.marker = null; st.wartetAuf = null; st.denk = null; st.kochen = null;
    st.flieger = []; st.herzchen = []; st.herzFlug = []; st.chipPuls = {}; st.toene = []; st.naechsterTag = false;
    if (st.spieler) {
      Dorf.Spieler.stoppe(st.spieler);
      if (!isFinite(st.spieler.x) || !isFinite(st.spieler.y) || Dorf.Spieler.kollidiert(st.karte, st.spieler.x, st.spieler.y)) {
        st.spieler.x = st.karte.start.biel.x * 16 + 8; st.spieler.y = st.karte.start.biel.y * 16 + 12;
      }
    }
    (st.gaeste || []).forEach(function (gs) {
      if (isFinite(gs.x) && isFinite(gs.y)) return;
      var t = st.karte.start[gs.id]; gs.x = t.x * 16 + 8; gs.y = t.y * 16 + 12; gs.zustand = 'frei'; gs.ziel = null; gs.zielTile = null; gs.pfad = [];
    });
    if (st.uhr && !isFinite(st.uhr.minute)) st.uhr.minute = Dorf.Uhr.START;
    if (st.kamera && st.spieler) Dorf.Kamera.sofort(st.kamera, st.spieler.x, st.spieler.y - 12);
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
    if (mu) { st.uhr.minute = Math.max(Dorf.Uhr.START, Math.min(Dorf.Uhr.ENDE - 1, parseInt(mu[1], 10) * 60)); st.spielzeit = Dorf.Uhr.schaetzeSpielzeit(st.uhr.minute); }
    if (win.location && /[?&]herzen=1/.test(win.location.search || '')) st.gaeste.forEach(function (gs) { gs.glueck = Dorf.Glueck.MAX - 5; });
    if (win.location && /[?&]abend=1/.test(win.location.search || '')) st.uhr.minute = Dorf.Uhr.ENDE;
    // ?korb=1 legt von allem drei Stueck in den Korb (zum Ausprobieren)
    if (win.location && /[?&]korb=1/.test(win.location.search || '')) Dorf.Garten.ZUTATEN.forEach(function (a) { st.vorrat[a] = 3; });
    // Entwicklerhilfe: ?menue=1 oeffnet gleich das Kochmenue (fuer Screenshots)
    if (win.location && /[?&]menue=1/.test(win.location.search || '')) oeffneMenue(st);
    var R = Dorf.Render.erstelle(canvas, ui, doc);
    var rahmen = doc.getElementById('rahmen');
    var ton = st.ton = Dorf.Ton ? Dorf.Ton.erstelle(win) : null;

    // ab v0.6: Spielstand laden. Entwicklerhilfen (?uhr, ?abend, ?korb ...) und ?neu=1 spielen ohne alten Stand.
    var such = (win.location && win.location.search) || '';
    var speicher = st.speicher = Dorf.Speicher ? Dorf.Speicher.speicherVon(win) : null;
    var ohneStand = /[?&](neu|uhr|abend|herzen|korb|menue|start)=/.test(such);
    var darfSpeichern = !/[?&](uhr|abend|herzen|korb|menue|start)=/.test(such);   // Ausprobieren ueberschreibt keinen echten Spielstand
    if (speicher && /[?&]neu=1/.test(such)) Dorf.Speicher.loesche(speicher);
    if (speicher && !ohneStand) {
      var alt = Dorf.Speicher.lade(speicher);
      if (alt && Dorf.Speicher.anwenden(st, alt)) {
        st.geladen = true;
        sage(st, 'Biel', 'Schön, dass du wieder da bist! Tag ' + st.uhr.tag + ' geht weiter.', 4.5, ['lachen', 'herz']);
        st.herzchen.push({ x: st.spieler.x, y: st.spieler.y - 26, t: 0, farbe: '#ff7fa0' });
      }
    }
    // ab v0.9: Sticker Album (eigener Schluessel). Entwicklerhilfe ?album=5 klebt die ersten 5 Sticker ein (nur zum Ansehen, wird nicht gespeichert).
    if (speicher && darfSpeichern && Dorf.Sticker) st.album = Dorf.Sticker.lade(speicher);
    var ma = /[?&]album=(\d+)/.exec(such);
    if (ma && Dorf.Sticker) { darfSpeichern = false; st.album = {}; Dorf.Sticker.LISTE.slice(0, parseInt(ma[1], 10)).forEach(function (x) { st.album[x.id] = 1; }); }
    if (/[?&]buch=(\d)/.test(such)) oeffneBuch(st, parseInt(/[?&]buch=(\d)/.exec(such)[1], 10));
    var speicherUhr = 0;
    function sichere() {
      if (speicher && darfSpeichern) { Dorf.Speicher.schreibe(speicher, st); if (Dorf.Sticker && st.albumAendern) { Dorf.Sticker.schreibe(speicher, st.album); st.albumAendern = false; } }
      speicherUhr = 0; st.speichernJetzt = false;
    }

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
    // ab v0.8: ein einziger grosser Knopf unten rechts. Sein Bild zeigt, was er gerade tut, ohne Ziel ist er weg.
    var aktionKnopf = doc.getElementById('knopf-aktion'), aktionZustand = null, aktionSchluessel = null, popWechsel = false;
    knopf(aktionKnopf, function () {
      if (!aktionZustand) return;
      st.aktionGenutzt = (st.aktionGenutzt || 0) + 1;
      st.eingabe.tippe(st.abend ? 'weiter' : 'sprechen');
    });
    function zeigeAktion() {
      if (!aktionKnopf) return;
      var k = kontext(st), art = k ? k.art : null;
      var hinweisDa = !!(st.hinweis && st.hinweis.alpha > 0);
      var puls = !!art && (st.aktionGenutzt || 0) < AKTION_PULS && !hinweisDa;
      var schluessel = (art || '-') + (puls ? '+' : '');
      if (schluessel === aktionSchluessel) return;
      aktionSchluessel = schluessel;
      if (art !== aktionZustand) popWechsel = !popWechsel;   // neues Bild: kurz aufploppen (zwei gleiche Animationen im Wechsel)
      aktionZustand = art;
      aktionKnopf.className = 'knopf' + (art ? ' art-' + art + ' ' + (popWechsel ? 'pop' : 'pop2') : ' leer') + (puls ? ' puls' : '');
      if (aktionKnopf.setAttribute) {
        aktionKnopf.setAttribute('data-art', art || '');
        aktionKnopf.setAttribute('aria-label', art ? AKTION_NAME[art] : 'Gerade nichts zu tun');
        aktionKnopf.setAttribute('aria-hidden', art ? 'false' : 'true');
      }
    }
    // ab v0.8: Vorlesen mit der Stimme des Browsers (nur wenn vorhanden und eine deutsche Stimme da ist)
    var vorlesen = st.vorlesen = Dorf.Vorlesen ? Dorf.Vorlesen.erstelle(win, speicher) : null, letzteBlase = null;
    var vorlesenKnopf = doc.getElementById('vorlesen-knopf');
    function zeigeVorlesen() {
      if (!vorlesenKnopf) return;
      var da = !!(vorlesen && vorlesen.verfuegbar), stumm = !ton || ton.stumm;
      if (vorlesenKnopf.style) vorlesenKnopf.style.display = da ? '' : 'none';
      vorlesenKnopf.className = 'knopf' + (vorlesen && vorlesen.an ? '' : ' aus') + (stumm ? ' stumm' : '');
      if (vorlesenKnopf.setAttribute) {
        vorlesenKnopf.setAttribute('aria-pressed', vorlesen && vorlesen.an && !stumm ? 'true' : 'false');
        vorlesenKnopf.setAttribute('aria-label', vorlesen && vorlesen.an ? 'Vorlesen ausschalten' : 'Vorlesen einschalten');
      }
      if (R.uiSkala) groesse();
    }
    if (vorlesen) vorlesen.beiAenderung = zeigeVorlesen;
    knopf(vorlesenKnopf, function () {
      if (!vorlesen) return;
      // Ton aus und Vorlesen gewuenscht: dann kommt der Ton mit an, sonst wuerde man ja nichts hoeren
      if (ton && ton.stumm) { ton.entsperre(); ton.umschalten(); vorlesen.setze(true); }
      else vorlesen.umschalten();
      if (vorlesen.an && st.blase) letzteBlase = null;   // die aktuelle Blase gleich noch einmal vorlesen
    });
    if (ton) { var tonAlt = ton.beiAenderung; ton.beiAenderung = function () { if (tonAlt) tonAlt(); if (ton.stumm && vorlesen) vorlesen.stopp(); zeigeVorlesen(); }; }
    var neuKnopf = doc.getElementById('neu-knopf');
    knopf(neuKnopf, function () { if (st.frage) st.frage = null; else frageAuf(st); });
    // ab v0.9: Bilderbuch-Knopf (Rezepte und Sticker). Ein Punkt am Knopf zeigt einen neuen Sticker an.
    var buchKnopf = doc.getElementById('buch-knopf'), buchPunkt = null;
    knopf(buchKnopf, function () { if (ton) ton.entsperre(); if (st.buch) schliesseBuch(st); else { st.menue = null; oeffneBuch(st); } });
    function zeigeBuch() {
      if (!buchKnopf) return;
      var p = !!st.albumNeu && !st.buch;
      if (p === buchPunkt) return;
      buchPunkt = p; buchKnopf.className = 'knopf' + (p ? ' neu' : '');
      if (buchKnopf.setAttribute) buchKnopf.setAttribute('aria-label', p ? 'Bilderbuch, neuer Sticker' : 'Bilderbuch');
    }
    var touchAn = !!((win.matchMedia && win.matchMedia('(pointer: coarse)').matches) || (win.navigator && win.navigator.maxTouchPoints > 0) || /[?&]touch=1/.test((win.location && win.location.search) || ''));
    function zeigeTouch() { R.touch = touchAn; if (rahmen && rahmen.classList) rahmen.classList.toggle('touch', touchAn); if (R.uiSkala) groesse(); }
    zeigeTouch();
    if (doc.addEventListener) doc.addEventListener('visibilitychange', function () { if (ton) ton.pausiere(doc.hidden); if (doc.hidden) { sichere(); if (vorlesen) vorlesen.stopp(); } last = null; });
    if (win.addEventListener) win.addEventListener('pagehide', function () { sichere(); });

    function groesse() {
      // Rand fuer Notch und abgerundete Ecken (safe-area, als Padding am body)
      var rand = { l: 0, r: 0, o: 0, u: 0 };
      try {
        if (win.getComputedStyle && doc.body) {
          var cs = win.getComputedStyle(doc.body);
          rand = { l: parseFloat(cs.paddingLeft) || 0, r: parseFloat(cs.paddingRight) || 0, o: parseFloat(cs.paddingTop) || 0, u: parseFloat(cs.paddingBottom) || 0 };
        }
      } catch (e) { /* egal */ }
      var roh = Math.min(((win.innerWidth || 320) - rand.l - rand.r) / Dorf.Render.W, ((win.innerHeight || 176) - rand.o - rand.u) / Dorf.Render.H);
      // ab 2x ganzzahlig und pixelscharf, auf kleinen Handys darf es krumm sein
      var s = roh >= 2 ? Math.floor(roh) : Math.max(0.5, Math.floor(roh * 100) / 100);
      var dpr = win.devicePixelRatio || 1;
      var cw = Dorf.Render.W * s + 'px', ch = Dorf.Render.H * s + 'px';
      canvas.style.width = cw; canvas.style.height = ch;
      if (rahmen && rahmen.style && rahmen.style.setProperty) rahmen.style.setProperty('--s', String(s));
      if (ui) { ui.width = Math.round(Dorf.Render.W * s * dpr); ui.height = Math.round(Dorf.Render.H * s * dpr); ui.style.width = cw; ui.style.height = ch; R.uiSkala = s * dpr; }
      // Platz der Knoepfe oben rechts in internen Pixeln, damit der Hilfetext nicht darunter liegt
      var bw = R.touch ? Math.max(36 / s, 11) : Math.max(26 / s, 9), anzahl = ((vollKnopf && vollGeht) ? 3 : 2) + (neuKnopf ? 1 : 0) + (buchKnopf ? 1 : 0) + (vorlesenKnopf && vorlesen && vorlesen.verfuegbar ? 1 : 0);
      R.knopfBreite = bw;
      R.obenBreite = Math.ceil(anzahl * bw + (anzahl - 1) * 2 + 2 + 3);
      R.knopfAnzahl = anzahl;
    }
    win.addEventListener('resize', groesse);
    groesse();
    zeigeVorlesen();

    // Fehlerschutz (ab v0.6): die Schleife bittet immer zuerst um den naechsten Frame. Geht in Logik, Ton oder
    // Zeichnen etwas schief, wird aufgeraeumt und weitergespielt, statt dass das Bild einfriert.
    var last = null, fehler = { anzahl: 0, folge: 0, gemeldet: false };
    function melde(wo, err) {
      fehler.anzahl++; fehler.folge++; st.fehler = fehler.anzahl;
      if (!fehler.gemeldet && g.console && g.console.warn) { fehler.gemeldet = true; g.console.warn('Finca: Fehler in ' + wo + ', das Spiel räumt auf und läuft weiter.', err); }
      if (fehler.folge >= 3) { try { rette(st); } catch (e2) { /* weiter */ } fehler.folge = 0; }
    }
    function frame(t) {
      win.requestAnimationFrame(frame);
      if (!isFinite(t)) t = last === null ? 0 : last + 16.7;
      if (last === null) last = t;
      var roh = Math.max(0, (t - last) / 1000), dt = Math.min(0.05, roh); last = t;
      var ok = true;
      try {
        if (dt > 0) st.fps = st.fps ? st.fps * 0.9 + 0.1 / dt : 1 / dt;
        if (st.eingabe.touch && !touchAn) { touchAn = true; zeigeTouch(); }
        if (ton && st.eingabe.neu('stumm')) { ton.entsperre(); ton.umschalten(); }
        st.eingabe.klicks().forEach(function (k) { klickBild(st, k.x, k.y, k.zeiger); });
        schritt(st, dt, Math.min(1, roh));
      } catch (err) { ok = false; melde('Spiellogik', err); }
      try {
        if (ton) {
          st.toene.forEach(function (n) { ton.spiele(n); });
          var sp = st.spieler, kb = st.karte.brunnen, pool = st.karte.orte.pool[0];
          var dB = Math.hypot(sp.x - (kb.x * 16 + 16), sp.y - (kb.y * 16 + 16));
          var dP = pool ? Math.hypot(sp.x - pool.x * 16, sp.y - pool.y * 16) : 999;
          ton.umgebung(Math.max(0, 1 - Math.min(dB, dP * 1.4) / 110));
          ton.tageszeit(st.uhr.minute / 60, st.abend);
        }
      } catch (err) { ok = false; melde('Ton', err); }
      st.toene.length = 0;
      // ab v0.8: neue Sprechblase vorlesen, sonst leise plappern (beides nur mit Ton)
      try {
        if (st.blase && st.blase.nr !== letzteBlase) {
          letzteBlase = st.blase.nr;
          var stumm = !ton || ton.stumm;
          var gelesen = vorlesen ? vorlesen.sage(st.blase.text, st.blase.sprecher, stumm) : false;
          if (!gelesen && ton && !stumm && !(vorlesen && vorlesen.spricht)) ton.spiele('plapper_' + String(st.blase.sprecher || 'biel').toLowerCase());
        }
        if (st.abend && vorlesen && vorlesen.spricht && !st.blase) vorlesen.stopp();
        zeigeAktion(); zeigeBuch();
      } catch (err) { ok = false; melde('Vorlesen', err); }
      try { Dorf.Render.zeichne(R, st); } catch (err) { ok = false; melde('Zeichnen', err); }
      try { st.eingabe.ende(); } catch (err) { ok = false; }
      if (ok) fehler.folge = 0;
      // Spielstand sichern: alle paar Sekunden, am Abend und am neuen Morgen
      speicherUhr += dt;
      if (st.speichernJetzt || speicherUhr >= SPEICHER_TAKT) { try { sichere(); } catch (err) { speicherUhr = 0; } }
    }
    win.requestAnimationFrame(frame);
    return { st: st, R: R, fehler: fehler, sichere: sichere, vorlesen: vorlesen, ton: ton };
  }

  Dorf.Spiel = { STANDARD_SEED: STANDARD_SEED, VERSION: VERSION, KOCHDAUER: KOCHDAUER, PORTIONEN: PORTIONEN, erstelle: erstelle, schritt: schritt, sage: sage, klick: klick, klickBild: klickBild, kochen: kochen, streichle: streichle, tierPlatz: tierPlatz, oeffneMenue: oeffneMenue, zumHerd: zumHerd, frageAuf: frageAuf, neuAnfangen: neuAnfangen, rette: rette, naechstesZiel: naechstesZiel, kontext: kontext, tueKontext: tueKontext, sammle: sammle, FLUG_KORB: FLUG_KORB, AKTION_PULS: AKTION_PULS, AKTION_NAME: AKTION_NAME, FRAGE: FRAGE, ABEND_SPERRE: ABEND_SPERRE, LAMPEN: LAMPEN, TIPP_DAUER: TIPP_DAUER, SPEICHER_TAKT: SPEICHER_TAKT, menueKarten: menueKarten, MENUE: MENUE, TAFEL_MAX: TAFEL_MAX, starte: starte, ABEND: ABEND, abendHerzen: abendHerzen, BUCH: BUCH, BUCH_SEITEN: BUCH_SEITEN, ALBUM_SEITE: ALBUM_SEITE, MENUE_BUCH: MENUE_BUCH, oeffneBuch: oeffneBuch, schliesseBuch: schliesseBuch, blaettere: blaettere, WACKEL: WACKEL, MENUE_ZU: MENUE_ZU, gaehnen: gaehnen, GAEHN: GAEHN };

  if (typeof g.document !== 'undefined' && typeof g.window !== 'undefined' && g.document.getElementById) {
    g.window.addEventListener('load', function () { Dorf.Spiel.laufend = starte(g.document, g.window); });
  }
})(globalThis);
