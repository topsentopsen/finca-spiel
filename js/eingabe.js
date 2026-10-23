/* Eingabe: gehaltene und frisch gedrueckte Tasten pro Frame, dazu Klicks und Tippen (Pointer). */
(function (g) {
  'use strict';
  var Dorf = g.Dorf = g.Dorf || {};

  var AKTIONEN = {
    hoch: ['ArrowUp', 'KeyW'], runter: ['ArrowDown', 'KeyS'],
    links: ['ArrowLeft', 'KeyA'], rechts: ['ArrowRight', 'KeyD'],
    sprechen: ['KeyE'], weiter: ['Enter', 'NumpadEnter', 'Space'],
    // ab v0.3: Kochen, Ton an/aus, Menue
    kochen: ['KeyK'], stumm: ['KeyM'], abbruch: ['Escape', 'Backspace'],
    wahl1: ['Digit1', 'Numpad1'], wahl2: ['Digit2', 'Numpad2'], wahl3: ['Digit3', 'Numpad3'],
    // Debug liegt ab v0.2 auf der Taste links neben der 1 (auf deutschen Tastaturen ^), kein Konflikt mit der Browser-Hilfe
    debug: ['Backquote'],
    // ab v0.9: Bilderbuch mit Rezepten und Stickern
    buch: ['KeyB']
  };
  var RELEVANT = {};
  Object.keys(AKTIONEN).forEach(function (a) { AKTIONEN[a].forEach(function (c) { RELEVANT[c] = true; }); });

  // Bildschirmpunkt (clientX/Y) in interne Canvas-Pixel umrechnen.
  function zuIntern(cx, cy, rect, W, H) {
    return { x: (cx - rect.left) / rect.width * W, y: (cy - rect.top) / rect.height * H };
  }

  // ab v0.6: ein zweites Tippen kurz danach an fast derselben Stelle zaehlt nicht (Kinderfinger tippen gern doppelt)
  var DOPPEL_MS = 280, DOPPEL_PX = 8;

  function erstelle(win, canvas, W, H) {
    var halt = {}, frisch = {}, klicks = [], letzter = null, ersatzMs = 0;
    var e = {
      druecke: function (code) { if (!halt[code]) frisch[code] = true; halt[code] = true; },
      loese: function (code) { halt[code] = false; },
      halt: function (a) { return AKTIONEN[a].some(function (c) { return !!halt[c]; }); },
      neu: function (a) { return AKTIONEN[a].some(function (c) { return !!frisch[c]; }); },
      // Klick in internen Canvas-Pixeln (0..320, 0..176)
      klicke: function (x, y, quelle) { if (isFinite(x) && isFinite(y)) klicks.push({ x: x, y: y, zeiger: !!quelle }); },
      // Pointer mit Zeitstempel: Doppeltipper herausfiltern. Rueckgabe true, wenn der Tipp zaehlt
      zeiger: function (x, y, ms) {
        if (letzter && ms - letzter.ms >= 0 && ms - letzter.ms < DOPPEL_MS && Math.hypot(x - letzter.x, y - letzter.y) < DOPPEL_PX) return false;
        letzter = { x: x, y: y, ms: ms };
        e.klicke(x, y, 'zeiger');
        return true;
      },
      // Hat das Kind gerade irgendetwas gedrueckt oder getippt? (fuer die Hinweise)
      aktiv: function () { return klicks.length > 0 || Object.keys(frisch).length > 0 || Object.keys(halt).some(function (c) { return halt[c]; }); },
      // Knopf auf dem Bildschirm: wirkt wie ein kurzer Tastendruck
      tippe: function (a) { if (AKTIONEN[a]) frisch[AKTIONEN[a][0]] = true; },
      touch: false,
      klicks: function () { return klicks; },
      ende: function () { frisch = {}; klicks = []; }
    };
    if (win && win.addEventListener) {
      win.addEventListener('keydown', function (ev) { if (RELEVANT[ev.code]) { ev.preventDefault(); e.druecke(ev.code); } });
      win.addEventListener('keyup', function (ev) { if (RELEVANT[ev.code]) { ev.preventDefault(); e.loese(ev.code); } });
      win.addEventListener('blur', function () { halt = {}; });
      win.addEventListener('pagehide', function () { halt = {}; });
    }
    if (canvas && canvas.addEventListener) {
      canvas.addEventListener('pointerdown', function (ev) {
        if (ev.preventDefault) ev.preventDefault();
        if (ev.isPrimary === false) return;                 // zweiter Finger: ignorieren
        if (ev.button !== undefined && ev.button > 0) return; // nur linke Maustaste
        if (ev.pointerType === 'touch') e.touch = true;
        var rect = canvas.getBoundingClientRect();
        if (!rect || !(rect.width > 0) || !(rect.height > 0)) return;
        var p = zuIntern(ev.clientX, ev.clientY, rect, W || 320, H || 176);
        var ms = typeof ev.timeStamp === 'number' && ev.timeStamp > 0 ? ev.timeStamp : (typeof Date !== 'undefined' ? Date.now() : (ersatzMs += 1000));
        e.zeiger(p.x, p.y, ms);
      });
      canvas.addEventListener('contextmenu', function (ev) { if (ev.preventDefault) ev.preventDefault(); });
    }
    return e;
  }

  Dorf.Eingabe = { AKTIONEN: AKTIONEN, DOPPEL_MS: DOPPEL_MS, DOPPEL_PX: DOPPEL_PX, erstelle: erstelle, zuIntern: zuIntern };
})(globalThis);
