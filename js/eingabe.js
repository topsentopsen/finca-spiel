/* Eingabe: gehaltene und frisch gedrueckte Tasten pro Frame, dazu Klicks und Tippen (Pointer). */
(function (g) {
  'use strict';
  var Dorf = g.Dorf = g.Dorf || {};

  var AKTIONEN = {
    hoch: ['ArrowUp', 'KeyW'], runter: ['ArrowDown', 'KeyS'],
    links: ['ArrowLeft', 'KeyA'], rechts: ['ArrowRight', 'KeyD'],
    sprechen: ['KeyE'], weiter: ['Enter', 'NumpadEnter', 'Space'],
    // Debug liegt ab v0.2 auf der Taste links neben der 1 (auf deutschen Tastaturen ^), kein Konflikt mit der Browser-Hilfe
    debug: ['Backquote']
  };
  var RELEVANT = {};
  Object.keys(AKTIONEN).forEach(function (a) { AKTIONEN[a].forEach(function (c) { RELEVANT[c] = true; }); });

  // Bildschirmpunkt (clientX/Y) in interne Canvas-Pixel umrechnen.
  function zuIntern(cx, cy, rect, W, H) {
    return { x: (cx - rect.left) / rect.width * W, y: (cy - rect.top) / rect.height * H };
  }

  function erstelle(win, canvas, W, H) {
    var halt = {}, frisch = {}, klicks = [];
    var e = {
      druecke: function (code) { if (!halt[code]) frisch[code] = true; halt[code] = true; },
      loese: function (code) { halt[code] = false; },
      halt: function (a) { return AKTIONEN[a].some(function (c) { return !!halt[c]; }); },
      neu: function (a) { return AKTIONEN[a].some(function (c) { return !!frisch[c]; }); },
      // Klick in internen Canvas-Pixeln (0..320, 0..176)
      klicke: function (x, y) { klicks.push({ x: x, y: y }); },
      klicks: function () { return klicks; },
      ende: function () { frisch = {}; klicks = []; }
    };
    if (win && win.addEventListener) {
      win.addEventListener('keydown', function (ev) { if (RELEVANT[ev.code]) { ev.preventDefault(); e.druecke(ev.code); } });
      win.addEventListener('keyup', function (ev) { if (RELEVANT[ev.code]) { ev.preventDefault(); e.loese(ev.code); } });
      win.addEventListener('blur', function () { halt = {}; });
    }
    if (canvas && canvas.addEventListener) {
      canvas.addEventListener('pointerdown', function (ev) {
        if (ev.preventDefault) ev.preventDefault();
        var rect = canvas.getBoundingClientRect();
        var p = zuIntern(ev.clientX, ev.clientY, rect, W || 320, H || 176);
        e.klicke(p.x, p.y);
      });
      canvas.addEventListener('contextmenu', function (ev) { if (ev.preventDefault) ev.preventDefault(); });
    }
    return e;
  }

  Dorf.Eingabe = { AKTIONEN: AKTIONEN, erstelle: erstelle, zuIntern: zuIntern };
})(globalThis);
