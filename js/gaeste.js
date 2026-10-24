/* Gaeste mit einfacher, deterministischer Utility-KI (Satt, Spielen, Ruhe). */
(function (g) {
  'use strict';
  var Dorf = g.Dorf = g.Dorf || {};
  var K = 16, TEMPO = 40;
  var BASIS = { satt: 8, spielen: 6, ruhe: 5 }; // Abfall pro Spielstunde
  var AUFFUELLEN = { tafel: 80, pool: 70, couch: 60, feuer: 40 }; // Anstieg pro Spielstunde am Ziel
  var WIRKT_AUF = { tafel: 'satt', pool: 'spielen', couch: 'ruhe', feuer: 'ruhe' };
  var PORTION_BONUS = 2;                         // Pa amb oli fuellt doppelt so schnell (siehe gerichte.js)

  var DEFS = {
    mia: { name: 'Mia', alter: 7, liebling: 'ensaimada', profil: { satt: 1.3, spielen: 1.4, ruhe: 0.6 }, start: { satt: 55, spielen: 45, ruhe: 85 },
      aussehen: { form: 'mia', kind: true, haut: '#f3c29b', haar: '#e07a4a', haarGlanz: '#f0a070', bart: null, zoepfe: true, hemd: '#ff7fa6', hemd2: '#e45f8a', hose: '#ff7fa6', schuhe: '#ffffff', farbe: '#ff7fa0' } },
    jonas: { name: 'Jonas', alter: 41, liebling: 'tumbet', profil: { satt: 1.0, spielen: 0.8, ruhe: 1.2 }, start: { satt: 34, spielen: 70, ruhe: 50 },
      aussehen: { form: 'jonas', kind: false, haut: '#eab48c', haar: '#9a6a3e', haarGlanz: '#c08a58', bart: null, brille: '#4a3560', hemd: '#4fc0b0', hemd2: '#33998e', hose: '#d9b77a', schuhe: '#5a4a44', farbe: '#4fb594' } },
    // ab v0.5: Padrina, die Oma. Liebt das Sofa, geht gemuetlich und mag Pa amb oli wie frueher
    padrina: { name: 'Padrina', alter: 78, liebling: 'paamboli', tempo: 28, profil: { satt: 0.9, spielen: 0.4, ruhe: 1.6 }, start: { satt: 50, spielen: 80, ruhe: 42 },
      aussehen: { form: 'padrina', kind: false, stock: true, rock: '#8a6fc8', haut: '#f0c4a4', haar: '#cfc8da', haarGlanz: '#f4f1f8', bart: null, dutt: true, brille: '#7a5a9a', hemd: '#b9a3f5', hemd2: '#8a6fc8', hose: '#5a4370', schuhe: '#7a6a8a', farbe: '#a77fd6' } }
  };
  var REIHE = ['mia', 'jonas', 'padrina'];

  function erstelle(id, karte) {
    var d = DEFS[id], t = karte.start[id];
    var gast = {
      id: id, name: d.name, alter: d.alter, liebling: d.liebling, tempo: d.tempo || TEMPO, profil: d.profil, aussehen: d.aussehen,
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
  function sitzt(gast) { return gast.zustand === 'aktiv' && (gast.ziel === 'couch' || gast.ziel === 'feuer'); }
  function tileVon(gast) { return { x: Math.floor(gast.x / K), y: Math.floor(gast.y / K) }; }

  function plane(gast, welt, art) {
    var karte = welt.karte, von = tileVon(gast);
    var belegt = welt.gaeste.filter(function (o) { return o !== gast && o.zielTile; }).map(function (o) { return o.zielTile.x + ',' + o.zielTile.y; });
    var ziele = (art === 'bummeln') ? [welt.rng.pick((karte.orte.zaun && welt.rng.next() < 0.25) ? karte.orte.zaun : karte.orte.bummeln)] : karte.orte[art].slice();
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
    var dx = zx - gast.x, dy = zy - gast.y, dist = Math.sqrt(dx * dx + dy * dy), schritt = (gast.tempo || TEMPO) * dt;
    if (Math.abs(dx) > Math.abs(dy)) gast.dir = dx < 0 ? 'links' : 'rechts'; else if (dy) gast.dir = dy < 0 ? 'oben' : 'unten';
    gast.animT += dt; gast.frame = Math.floor(gast.animT * 8) % 4;
    if (dist <= schritt) { gast.x = zx; gast.y = zy; gast.pfadIndex++; } else { gast.x += dx / dist * schritt; gast.y += dy / dist * schritt; }
    return gast.pfadIndex >= gast.pfad.length;
  }

  function update(gast, welt, dt, stunden) {
    abfall(gast, stunden);
    var b = gast.beduerfnisse;
    // ab v0.24: Feuer an → alle kommen zur Sitzrunde und bleiben, bis es aus ist
    if (welt.feuer && welt.feuer.an) {
      if (gast.planPause > 0) gast.planPause -= dt;
      if (gast.ziel !== 'feuer' && !(gast.planPause > 0)) {
        if (!plane(gast, welt, 'feuer')) gast.planPause = 0.5;
      }
      if (gast.zustand === 'aktiv' && gast.ziel === 'feuer') {
        b.ruhe = clamp(b.ruhe + AUFFUELLEN.feuer * stunden);
        gast.frame = 0;
        if (Dorf.Feuer && Dorf.Feuer.faceFeuer) Dorf.Feuer.faceFeuer(gast, welt.feuer);
        return;
      }
      if (gast.zustand === 'unterwegs' && gast.ziel === 'feuer') {
        if (laufe(gast, dt)) {
          gast.frame = 0; gast.animT = 0; gast.zustand = 'aktiv';
          if (Dorf.Feuer && Dorf.Feuer.faceFeuer) Dorf.Feuer.faceFeuer(gast, welt.feuer);
          else gast.dir = 'unten';
        }
        return;
      }
      return;
    } else if (gast.ziel === 'feuer') {
      gast.zustand = 'frei'; gast.ziel = null; gast.zielTile = null; gast.pfad = []; gast.warte = 0.8; gast.portion = false;
    }
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
    // ab v0.6: sind alle Plaetze belegt, nicht jeden Frame neu suchen, sondern kurz warten
    if (gast.planPause > 0) gast.planPause -= dt;
    if (wunsch && wunsch !== gast.ziel && !(gast.planPause > 0)) { if (!plane(gast, welt, wunsch)) gast.planPause = 0.75; }
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
        else if (gast.ziel === 'feuer' && Dorf.Feuer && welt.feuer) Dorf.Feuer.faceFeuer(gast, welt.feuer);
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
    if (gast.zustand === 'aktiv') return gast.ziel === 'couch' ? 'zzz' : (gast.ziel === 'feuer' ? 'herz' : 'herz');
    if (gast.ziel === 'tafel') return 'teller';
    if (gast.ziel === 'pool') return 'ball';
    if (gast.ziel === 'couch') return 'kissen';
    if (gast.ziel === 'feuer') return 'sonne';
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
      feuer: ['Ohhh, ein Feuer! Darf ich mich dazu setzen?'],
      aktiv_feuer: ['So warm und schön!', 'Erzähl eine Geschichte, Amo Biel!'],
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
      feuer: ['Ein Lagerfeuer — klasse Idee.'],
      aktiv_feuer: ['So gemütlich. Musik dazu wäre perfekt.'],
      frei: ['Moltes gràcies (Vielen Dank) für den Kaffee!', 'Herrlich ruhig hier am Brunnen.', 'Die Clastra (Innenhof) ist wunderschön.']
    },
    padrina: {
      tafel: ['Ein Pa amb oli wie früher, das wär jetzt was.'],
      pool: ['Ich halte nur kurz die Füße ins Wasser.'],
      aktiv_pool: ['Ui, das Wasser ist frisch! Herrlich.'],
      aktiv_tafel: ['Bon profit, fillet! (Guten Appetit, mein Kleiner!)'],
      portion_paamboli: ['Pa amb oli! Genau wie bei mir zu Hause. Molt bo! (Sehr gut!)'],
      portion_ensaimada: ['Ensaïmada zum Kaffee, die mochte schon mein Großvater.'],
      portion_tumbet: ['Tumbet wärmt den Bauch. Danke, fillet.'],
      couch: ['Meine alten Knochen wollen aufs Sofa.'],
      aktiv_couch: ['Ah, so ein Sofa ist Gold wert. Ich strick ein bisschen.', 'Hier sitz ich am liebsten.'],
      feuer: ['Ein Feuer wie früher auf dem Land.'],
      aktiv_feuer: ['Poc a poc am Feuer. Das wärmt die alten Knochen.'],
      frei: ['Bon dia, fillet! (Guten Morgen, mein Kleiner!)', 'Hast du schon die Tomaten im Garten gesehen?', 'Bruna ist ein gutes Eselchen.', 'Poc a poc. (Immer schön langsam.) So sagt man hier.']
    }
  };
  // ab v0.8: Bilder fuer die Sprechblase. Kinder lesen noch nicht, die Bilder erzaehlen dasselbe wie der Satz.
  var BILDER = {
    tafel: function (g) { return ['teller', 'frage']; },
    pool: function () { return ['welle', 'ball']; },
    aktiv_pool: function () { return ['welle', 'lachen']; },
    aktiv_tafel: function () { return ['teller', 'herz']; },
    couch: function () { return ['kissen', 'zzz']; },
    aktiv_couch: function () { return ['kissen', 'herz']; },
    feuer: function () { return ['sonne', 'herz']; },
    aktiv_feuer: function () { return ['sonne', 'lachen']; },
    portion: function (g) { return ['gericht:' + g.portion, 'herz']; }
  };
  var FREI_BILDER = {
    mia: [['sonne', 'ball'], ['gecko', 'lachen'], ['esel', 'frage']],
    jonas: [['tasse', 'herz'], ['welle', 'lachen'], ['haus', 'stern']],
    padrina: [['sonne', 'herz'], ['tomate', 'frage'], ['esel', 'herz'], ['schnecke', 'lachen']]
  };
  var WUNSCH_GERICHT = { mia: 'ensaimada', jonas: 'paamboli', padrina: 'paamboli' };
  function spruchInfo(gast, rng) {
    var s = SPRUECHE[gast.id], key;
    if (gast.zustand === 'aktiv') key = (gast.ziel === 'tafel' && gast.portion) ? 'portion_' + gast.portion : 'aktiv_' + gast.ziel;
    else if (gast.ziel === 'tafel' || gast.ziel === 'pool' || gast.ziel === 'couch' || gast.ziel === 'feuer') key = gast.ziel;
    else key = 'frei';
    var liste = s[key] ? s[key] : s.frei, k = s[key] ? key : 'frei';
    var text = rng.pick(liste), bilder;
    if (k === 'frei') bilder = (FREI_BILDER[gast.id] || [])[liste.indexOf(text)] || ['lachen'];
    else if (k.indexOf('portion_') === 0) bilder = BILDER.portion(gast);
    else if (k === 'tafel') bilder = ['gericht:' + (WUNSCH_GERICHT[gast.id] || 'paamboli'), 'frage'];
    else bilder = BILDER[k] ? BILDER[k](gast) : ['lachen'];
    return { text: text, bilder: bilder };
  }
  function spruch(gast, rng) { return spruchInfo(gast, rng).text; }

  Dorf.Gaeste = { REIHE: REIHE, TEMPO: TEMPO, BASIS: BASIS, PORTION_BONUS: PORTION_BONUS, DEFS: DEFS, erstelle: erstelle, nimmTeller: nimmTeller, abfall: abfall, entscheide: entscheide, plane: plane, update: update, symbol: symbol, spruch: spruch, spruchInfo: spruchInfo, FREI_BILDER: FREI_BILDER, tileVon: tileVon, sitzt: sitzt };
})(globalThis);
