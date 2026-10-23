/* Garten (ab v0.5): Tomaten und Karotten im Beet, Orangen und Oliven an den Baeumen.
   Alles waechst gemuetlich nach, Biel erntet in seinen Korb (Vorrat). Nichts kann vertrocknen. */
(function (g) {
  'use strict';
  var Dorf = g.Dorf = g.Dorf || {};
  var K = 16, REICHWEITE = 26, VORRAT_MAX = 9;

  // wachsen: Spielstunden bis wieder reif (eine Spielstunde sind 40 Sekunden)
  var ARTEN = {
    tomate: { name: 'Tomate', mehrzahl: 'Tomaten', wort: 'tomàtiga', wachsen: 1.5, menge: 1, farbe: '#ff7a6b' },
    karotte: { name: 'Karotte', mehrzahl: 'Karotten', wort: 'pastanaga', wachsen: 2, menge: 1, farbe: '#ffa64d' },
    orange: { name: 'Orange', mehrzahl: 'Orangen', wort: 'taronja', wachsen: 2, menge: 2, farbe: '#ffb340' },
    olive: { name: 'Olive', mehrzahl: 'Oliven', wort: 'oliva', wachsen: 2, menge: 2, farbe: '#8d6fb0' }
  };
  var REIHE = ['tomate', 'karotte', 'orange', 'olive'];

  function leererVorrat() { var v = {}; REIHE.forEach(function (a) { v[a] = 0; }); return v; }

  function erstelle(karte) {
    var liste = [];
    (karte.garten || []).forEach(function (p) { liste.push({ art: p.art, x: p.x, y: p.y, reif: true, wachs: 1, baum: !!p.baum }); });
    return { liste: liste };
  }

  function punkt(p) { return { x: p.x * K + 8, y: p.y * K + (p.baum ? 14 : 12) }; }
  function an(garten, tx, ty) {
    for (var i = 0; i < garten.liste.length; i++) { var p = garten.liste[i]; if (p.x === tx && p.y === ty) return p; }
    return null;
  }
  function nah(p, sp) { var q = punkt(p); return Math.hypot(q.x - sp.x, q.y - sp.y) <= REICHWEITE; }
  // naechste reife Pflanze in Reichweite (fuer Taste E)
  function naechste(garten, sp) {
    var best = null, bd = Infinity;
    garten.liste.forEach(function (p) {
      if (!p.reif || !nah(p, sp)) return;
      var q = punkt(p), d = Math.hypot(q.x - sp.x, q.y - sp.y);
      if (d < bd) { bd = d; best = p; }
    });
    return best;
  }

  function update(garten, stunden) {
    if (!(stunden > 0)) return;
    garten.liste.forEach(function (p) {
      if (p.reif) return;
      p.wachs = Math.min(1, p.wachs + stunden / ARTEN[p.art].wachsen);
      if (p.wachs >= 1) p.reif = true;
    });
  }

  // Ernten: Rueckgabe Anzahl, 0 wenn noch nicht reif. Ein voller Korb nimmt nichts mehr, die Frucht bleibt einfach haengen.
  function ernte(garten, vorrat, p) {
    if (!p || !p.reif) return 0;
    var platz = VORRAT_MAX - (vorrat[p.art] || 0);
    if (platz <= 0) return 0;
    var n = Math.min(platz, ARTEN[p.art].menge);
    vorrat[p.art] = (vorrat[p.art] || 0) + n;
    p.reif = false; p.wachs = 0;
    return n;
  }

  function neuerTag(garten) { garten.liste.forEach(function (p) { p.reif = true; p.wachs = 1; }); }

  // Kann ein Gericht gekocht werden? Pa amb oli geht immer (Brot und Öl aus der Speisekammer),
  // mit frischer Tomate und Olive gibt es einen Teller mehr.
  function pruefe(vorrat, G) {
    var z = G.zutaten || {}, fehlt = {}, alles = true;
    Object.keys(z).forEach(function (a) { var f = z[a] - (vorrat[a] || 0); if (f > 0) { fehlt[a] = f; alles = false; } });
    if (G.immer) return { ok: true, frisch: alles && Object.keys(z).length > 0, fehlt: fehlt };
    return { ok: alles, frisch: alles, fehlt: fehlt };
  }
  function verbrauche(vorrat, G) {
    var z = G.zutaten || {};
    Object.keys(z).forEach(function (a) { vorrat[a] = Math.max(0, (vorrat[a] || 0) - z[a]); });
  }
  function fehltText(fehlt) {
    return Object.keys(fehlt).map(function (a) { return fehlt[a] + ' ' + (fehlt[a] === 1 ? ARTEN[a].name : ARTEN[a].mehrzahl); }).join(' und ');
  }

  Dorf.Garten = { ARTEN: ARTEN, REIHE: REIHE, REICHWEITE: REICHWEITE, VORRAT_MAX: VORRAT_MAX, leererVorrat: leererVorrat,
    erstelle: erstelle, an: an, nah: nah, naechste: naechste, punkt: punkt, update: update, ernte: ernte, neuerTag: neuerTag,
    pruefe: pruefe, verbrauche: verbrauche, fehltText: fehltText };
})(globalThis);
