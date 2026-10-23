/* Gerichte aus Biels Kueche (ab v0.3). Jedes Gericht hat eine kleine eigene Wirkung. */
(function (g) {
  'use strict';
  var Dorf = g.Dorf = g.Dorf || {};

  // satt: Faktor fuer das Sattwerden an der Tafel
  // extra: zusaetzlicher Anstieg pro Spielstunde, solange der Gast isst
  // zutaten (ab v0.5): was Biel aus dem Garten braucht. immer: geht auch ohne (Speisekammer), frisch gibt es einen Teller mehr
  var GERICHTE = {
    paamboli: { id: 'paamboli', name: 'Pa amb oli', info: 'Brot mit Tomate und Öl', wirkung: 'macht schnell satt',
      dauer: 5, portionen: 3, satt: 2, extra: {}, zutaten: { tomate: 1, olive: 1 }, immer: true, farben: ['#f3c27a', '#ff7a6b', '#9fd86b'] },
    ensaimada: { id: 'ensaimada', name: 'Ensaïmada', info: 'süße Schnecke mit Puderzucker', wirkung: 'süß, macht Lust zu spielen',
      dauer: 4, portionen: 2, satt: 1.3, extra: { spielen: 40 }, zutaten: { orange: 1 }, farben: ['#f8c98a', '#ffffff', '#e8a865'] },
    tumbet: { id: 'tumbet', name: 'Tumbet', info: 'Gemüse aus dem Ofen', wirkung: 'warm und gemütlich, macht ruhig',
      dauer: 8, portionen: 4, satt: 1.6, extra: { ruhe: 40 }, zutaten: { tomate: 2 }, farben: ['#ff9a6b', '#b48ae0', '#8fd46b'] }
  };
  var REIHE = ['paamboli', 'ensaimada', 'tumbet'];

  function hole(id) { return GERICHTE[id] || null; }

  Dorf.Gerichte = { GERICHTE: GERICHTE, REIHE: REIHE, hole: hole };
})(globalThis);
