/* Gaeste mit einfacher, deterministischer Utility-KI (Satt, Spielen, Ruhe). */
(function (g) {
  'use strict';
  var Dorf = g.Dorf = g.Dorf || {};
  var K = 16, TEMPO = 40;
  var BASIS = { satt: 8, spielen: 6, ruhe: 5 }; // Abfall pro Spielstunde
  var AUFFUELLEN = { tafel: 80, pool: 70, couch: 60 }; // Anstieg pro Spielstunde am Ziel
  var WIRKT_AUF = { tafel: 'satt', pool: 'spielen', couch: 'ruhe' };
  var PORTION_BONUS = 2;                         // Pa amb oli fuellt doppelt so schnell (siehe gerichte.js)

  var DEFS = {
    mia: { name: 'Mia', alter: 7, liebling: 'ensaimada', profil: { satt: 1.3, spielen: 1.4, ruhe: 0.6 }, start: { satt: 55, spielen: 45, ruhe: 85 },
      aussehen: { kind: true, haut: '#f3c29b', haar: '#c98b4a', bart: null, zoepfe: true, hemd: '#ffb3c7', hemd2: '#f493ad', hose: '#ffb3c7', schuhe: '#ffffff', farbe: '#ff7fa0' } },
    jonas: { name: 'Jonas', alter: 41, liebling: 'tumbet', profil: { satt: 1.0, spielen: 0.8, ruhe: 1.2 }, start: { satt: 34, spielen: 70, ruhe: 50 },
      aussehen: { kind: false, haut: '#eab48c', haar: '#9a6a3e', bart: null, hemd: '#aeeed6', hemd2: '#86d4b8', hose: '#9cb8ee', schuhe: '#5a4a44', farbe: '#4fb594' } }
  };

  function erstelle(id, karte) {
    var d = DEFS[id], t = karte.start[id];
    var gast = {
      id: id, name: d.name, alter: d.alter, liebling: d.liebling, profil: d.profil, aussehen: d.aussehen,
      beduerfnisse: { satt: d.start.satt, spielen: d.start.spielen, ruhe: d.start.ruhe }, portion: false,
      x: t.x * K + 8, y: t.y * K + 12, dir: 'unten', animT: 0, frame: 0,
      zustand: 'frei', ziel: null, zielTile: null, pfad: [], pfadIndex: 0, warte: 1
    };
    if (Dorf.Glueck) Dorf.Glueck.start(gast);
    return gast;
  }
  function clamp(v) { return v < 0 ? 0 : (v > 100 ? 100 : v); }
  function abfall(gast, stunden) {
    var b = gast.beduerfnisse;
    b.satt = clamp(b.satt - BASIS.satt * gast.profil.satt * stunden);
    b.spielen = clamp(b.spielen - BASIS.spielen * gast.profil.spielen * stunden);
    if (b.ruhe !== undefined) b.ruhe = clamp(b.ruhe - BASIS.ruhe * (gast.profil.ruhe || 1) * stunden);
  }
  // Satt hat Vorrang vor Spielen, Spielen vor Ruhe.
  function entscheide(b) {
    if (b.satt < 30) return 'tafel';
    if (b.spielen < 40) return 'pool';
    if (b.ruhe < 30) return 'couch';
    return null;
  }
  function sitzt(gast) { return gast.zustand === 'aktiv' && gast.ziel === 'couch'; }
  function tileVon(gast) { return { x: Math.floor(gast.x / K), y: Math.floor(gast.y / K) }; }

  function plane(gast, welt, art) {
    var karte = welt.karte, von = tileVon(gast);
    var belegt = welt.gaeste.filter(function (o) { return o !== gast && o.zielTile; }).map(function (o) { return o.zielTile.x + ',' + o.zielTile.y; });
    var ziele = (art === 'bummeln') ? [welt.rng.pick(karte.orte.bummeln)] : karte.orte[art].slice();
    ziele.sort(function (a, b) { return (Math.abs(a.x - von.x) + Math.abs(a.y - von.y)) - (Math.abs(b.x - von.x) + Math.abs(b.y - von.y)); });
    for (var i = 0; i < ziele.length; i++) {
      var z = ziele[i];
      if (belegt.indexOf(z.x + ',' + z.y) >= 0) continue;
      var p = Dorf.Pfad.suche(karte, von.x, von.y, z.x, z.y);
      if (p) { gast.ziel = art; gast.zielTile = z; gast.pfad = p; gast.pfadIndex = 0; gast.zustand = 'unterwegs'; return true; }
    }
    return false;
  }

  function laufe(gast, dt) {
    if (gast.pfadIndex >= gast.pfad.length) return true;
    var n = gast.pfad[gast.pfadIndex], zx = n.x * K + 8, zy = n.y * K + 12;
    var dx = zx - gast.x, dy = zy - gast.y, dist = Math.sqrt(dx * dx + dy * dy), schritt = TEMPO * dt;
    if (Math.abs(dx) > Math.abs(dy)) gast.dir = dx < 0 ? 'links' : 'rechts'; else if (dy) gast.dir = dy < 0 ? 'oben' : 'unten';
    gast.animT += dt; gast.frame = Math.floor(gast.animT * 8) % 4;
    if (dist <= schritt) { gast.x = zx; gast.y = zy; gast.pfadIndex++; } else { gast.x += dx / dist * schritt; gast.y += dy / dist * schritt; }
    return gast.pfadIndex >= gast.pfad.length;
  }

  function update(gast, welt, dt, stunden) {
    abfall(gast, stunden);
    var b = gast.beduerfnisse;
    if (gast.zustand === 'aktiv') {
      var wert = WIRKT_AUF[gast.ziel];
      var gericht = gast.portion && Dorf.Gerichte ? Dorf.Gerichte.hole(gast.portion) : null;
      var faktor = gast.ziel === 'tafel' && gast.portion ? (gericht ? gericht.satt : PORTION_BONUS) : 1;
      b[wert] = clamp(b[wert] + AUFFUELLEN[gast.ziel] * faktor * stunden);
      if (gericht && gast.ziel === 'tafel') Object.keys(gericht.extra).forEach(function (k) { if (b[k] !== undefined) b[k] = clamp(b[k] + gericht.extra[k] * stunden); });
      gast.frame = 0;
      var wunschJetzt = entscheide(b);
      if (b[wert] >= 95 || (wunschJetzt === 'tafel' && gast.ziel !== 'tafel')) {
        // Schoen gebadet oder ausgeruht: ein bisschen Glueck (Essen zaehlt schon beim Teller)
        if (b[wert] >= 95 && Dorf.Glueck && (gast.ziel === 'pool' || gast.ziel === 'couch')) Dorf.Glueck.gib(welt, gast, gast.ziel);
        gast.zustand = 'frei'; gast.ziel = null; gast.zielTile = null; gast.pfad = []; gast.warte = 1.5; gast.portion = false;
      } else return;
    }
    var wunsch = entscheide(b);
    if (wunsch && wunsch !== gast.ziel) plane(gast, welt, wunsch);
    if (gast.zustand === 'frei') {
      gast.frame = 0; gast.animT = 0;
      gast.warte -= dt;
      if (gast.warte <= 0) { if (!plane(gast, welt, 'bummeln')) gast.warte = 1; }
      return;
    }
    if (gast.zustand === 'unterwegs' && laufe(gast, dt)) {
      gast.frame = 0; gast.animT = 0;
      if (gast.ziel === 'bummeln') { gast.zustand = 'frei'; gast.ziel = null; gast.zielTile = null; gast.pfad = []; gast.warte = 2 + welt.rng.next() * 4; }
      else {
        gast.zustand = 'aktiv';
        if (gast.ziel === 'couch') gast.dir = 'unten';
        else gast.dir = gast.ziel === 'pool' ? 'oben' : (gast.zielTile.y < 12 ? 'unten' : 'oben');
        // Hat Biel gekocht, nimmt sich der Gast eine Portion von der Tafel
        if (gast.ziel === 'tafel') nimmTeller(gast, welt);
      }
    }
  }

  // Der Gast nimmt sein Lieblingsgericht, sonst den ersten Teller.
  function nimmTeller(gast, welt) {
    var t = welt.teller;
    if (!t || !t.length) return false;
    var i = t.indexOf(gast.liebling); if (i < 0) i = 0;
    gast.portion = t.splice(i, 1)[0];
    if (Dorf.Glueck) Dorf.Glueck.gib(welt, gast, gast.portion === gast.liebling ? 'liebling' : 'essen');
    return true;
  }

  // Wunsch-Symbol fuer die Gedankenblase
  function symbol(gast) {
    if (gast.zustand === 'aktiv') return gast.ziel === 'couch' ? 'zzz' : 'herz';
    if (gast.ziel === 'tafel') return 'teller';
    if (gast.ziel === 'pool') return 'ball';
    if (gast.ziel === 'couch') return 'kissen';
    return null;
  }

  var SPRUECHE = {
    mia: {
      tafel: ['Ich hab Hunger! Gibt es Ensaïmada?'],
      pool: ['Amo Biel, kommst du mit in den Pool?'],
      aktiv_pool: ['Guck mal, eine Arschbombe!', 'Das Wasser ist sooo schön!'],
      aktiv_tafel: ['Lecker! Moltes gràcies! (Vielen Dank!)'],
      portion_paamboli: ['Mmh, dein Pa amb oli ist das Beste, Biel!'],
      portion_ensaimada: ['Ensaïmada! Juhu, jetzt hab ich ganz viel Energie!'],
      portion_tumbet: ['Tumbet ist warm und lecker. Ich werd ganz gemütlich.'],
      couch: ['Ich bin ein bisschen müde.'],
      aktiv_couch: ['Die Couch ist so kuschelig!'],
      frei: ['Bon dia! (Guten Morgen!) Spielst du mit?', 'Ich hab den Gecko gesehen!', 'Wo ist eigentlich der Esel?']
    },
    jonas: {
      tafel: ['Ich könnte was essen. Pa amb oli wäre super.'],
      pool: ['Ich spring gleich mal ins Wasser.'],
      aktiv_pool: ['Herrlich, so muss Urlaub sein.'],
      aktiv_tafel: ['Bon profit! (Guten Appetit!)'],
      portion_paamboli: ['Bon profit! Dein Pa amb oli schmeckt herrlich.'],
      portion_ensaimada: ['Eine Ensaïmada zum Kaffee, perfekt.'],
      portion_tumbet: ['Tumbet! Wie bei meiner Lieblingsbar in Sóller.'],
      couch: ['Ich leg mich kurz hin. Migdiada (Mittagsruhe)!'],
      aktiv_couch: ['Herrlich ruhig hier drinnen.'],
      frei: ['Moltes gràcies (Vielen Dank) für den Kaffee!', 'Herrlich ruhig hier am Brunnen.', 'Die Clastra (Innenhof) ist wunderschön.']
    }
  };
  function spruch(gast, rng) {
    var s = SPRUECHE[gast.id], key;
    if (gast.zustand === 'aktiv') key = (gast.ziel === 'tafel' && gast.portion) ? 'portion_' + gast.portion : 'aktiv_' + gast.ziel;
    else if (gast.ziel === 'tafel' || gast.ziel === 'pool' || gast.ziel === 'couch') key = gast.ziel;
    else key = 'frei';
    return rng.pick(s[key] || s.frei);
  }

  Dorf.Gaeste = { BASIS: BASIS, PORTION_BONUS: PORTION_BONUS, DEFS: DEFS, erstelle: erstelle, nimmTeller: nimmTeller, abfall: abfall, entscheide: entscheide, plane: plane, update: update, symbol: symbol, spruch: spruch, tileVon: tileVon, sitzt: sitzt };
})(globalThis);
