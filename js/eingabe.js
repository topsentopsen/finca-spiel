/* Tastatur: gehaltene Tasten und frisch gedrueckte Tasten pro Frame. */
(function (g) {
  'use strict';
  var Dorf = g.Dorf = g.Dorf || {};

  var AKTIONEN = {
    hoch: ['ArrowUp', 'KeyW'], runter: ['ArrowDown', 'KeyS'],
    links: ['ArrowLeft', 'KeyA'], rechts: ['ArrowRight', 'KeyD'],
    sprechen: ['KeyE'], weiter: ['Enter', 'NumpadEnter', 'Space'], debug: ['F1']
  };
  var RELEVANT = {};
  Object.keys(AKTIONEN).forEach(function (a) { AKTIONEN[a].forEach(function (c) { RELEVANT[c] = true; }); });

  function erstelle(win) {
    var halt = {}, frisch = {};
    var e = {
      druecke: function (code) { if (!halt[code]) frisch[code] = true; halt[code] = true; },
      loese: function (code) { halt[code] = false; },
      halt: function (a) { return AKTIONEN[a].some(function (c) { return !!halt[c]; }); },
      neu: function (a) { return AKTIONEN[a].some(function (c) { return !!frisch[c]; }); },
      ende: function () { frisch = {}; }
    };
    if (win && win.addEventListener) {
      win.addEventListener('keydown', function (ev) { if (RELEVANT[ev.code]) { ev.preventDefault(); e.druecke(ev.code); } });
      win.addEventListener('keyup', function (ev) { if (RELEVANT[ev.code]) { ev.preventDefault(); e.loese(ev.code); } });
      win.addEventListener('blur', function () { halt = {}; });
    }
    return e;
  }

  Dorf.Eingabe = { AKTIONEN: AKTIONEN, erstelle: erstelle };
})(globalThis);
