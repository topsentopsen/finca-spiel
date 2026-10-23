#!/usr/bin/env node
/* Eigener Test-Runner ohne Abhaengigkeiten: laedt die Spieldateien per vm in einen Kontext. */
'use strict';
var fs = require('fs'), path = require('path'), vm = require('vm');

var DATEIEN = ['rng', 'karte', 'pfad', 'kamera', 'eingabe', 'uhr', 'spieler', 'gaeste', 'render', 'main'];

function ladeKontext(extra) {
  var ctx = { console: console, Math: Math };
  Object.assign(ctx, extra || {});
  vm.createContext(ctx);
  vm.runInContext('globalThis.globalThis = globalThis;', ctx);
  DATEIEN.forEach(function (n) {
    var f = path.join(__dirname, '..', 'js', n + '.js');
    vm.runInContext(fs.readFileSync(f, 'utf8'), ctx, { filename: f });
  });
  return ctx;
}

var tests = [], ok = 0, fehler = 0;
function test(name, fn) { tests.push({ name: name, fn: fn }); }
function gleich(a, b, msg) { if (a !== b) throw new Error((msg || 'ungleich') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b)); }
function wahr(v, msg) { if (!v) throw new Error(msg || 'erwartet true'); }
function nah(a, b, eps, msg) { if (Math.abs(a - b) > eps) throw new Error((msg || 'nicht nah') + ': ' + a + ' vs ' + b); }

// ---------- RNG ----------
test('RNG: gleicher Seed liefert gleiche Folge', function () {
  var D = ladeKontext().Dorf;
  var a = D.RNG.erstelle(42), b = D.RNG.erstelle(42), c = D.RNG.erstelle(43);
  var fa = [], fb = [], fc = [];
  for (var i = 0; i < 50; i++) { fa.push(a.next()); fb.push(b.next()); fc.push(c.next()); }
  gleich(JSON.stringify(fa), JSON.stringify(fb), 'Folge');
  wahr(JSON.stringify(fa) !== JSON.stringify(fc), 'anderer Seed muss andere Folge geben');
  wahr(fa.every(function (v) { return v >= 0 && v < 1; }), 'Bereich [0,1)');
});
test('RNG: Karte mit gleichem Seed ist identisch', function () {
  var D = ladeKontext().Dorf;
  var k1 = D.Karte.erstelle(D.RNG.erstelle(7)), k2 = D.Karte.erstelle(D.RNG.erstelle(7));
  gleich(JSON.stringify(k1.blumen), JSON.stringify(k2.blumen));
});

// ---------- A* ----------
test('A*: findet kuerzesten Weg um den Brunnen', function () {
  var D = ladeKontext().Dorf;
  var k = D.Karte.erstelle(D.RNG.erstelle(1));
  wahr(k.blockiert(19, 15) && k.blockiert(20, 15), 'Brunnen blockiert');
  var p = D.Pfad.suche(k, 18, 15, 21, 15);
  wahr(p, 'Pfad gefunden');
  gleich(p.length - 1, 5, 'Schrittzahl (um 2x2-Brunnen herum)');
  wahr(p.every(function (n) { return !k.blockiert(n.x, n.y); }), 'kein Schritt durch Hindernis');
  for (var i = 1; i < p.length; i++) gleich(Math.abs(p[i].x - p[i - 1].x) + Math.abs(p[i].y - p[i - 1].y), 1, 'Nachbarschritt');
  gleich(p[0].x + ',' + p[0].y, '18,15'); gleich(p[p.length - 1].x + ',' + p[p.length - 1].y, '21,15');
});
test('A*: meldet unerreichbare Ziele', function () {
  var D = ladeKontext().Dorf;
  var k = D.Karte.erstelle(D.RNG.erstelle(1));
  gleich(D.Pfad.suche(k, 18, 18, 28, 5), null, 'Ziel im Wasser');
  // Eingeschlossene Zelle in einem Testraster
  var wand = { '2,1': 1, '1,2': 1, '3,2': 1, '2,3': 1 };
  var grid = { w: 5, h: 5, blockiert: function (x, y) { return !!wand[x + ',' + y]; } };
  gleich(D.Pfad.suche(grid, 0, 0, 2, 2), null, 'eingeschlossen');
  wahr(D.Pfad.suche(grid, 0, 0, 4, 4), 'freies Ziel erreichbar');
});
test('A*: Pool und Tafel sind vom Innenhof erreichbar', function () {
  var D = ladeKontext().Dorf;
  var k = D.Karte.erstelle(D.RNG.erstelle(1));
  wahr(k.orte.pool.length > 0 && k.orte.tafel.length > 0, 'Zielorte vorhanden');
  wahr(D.Pfad.suche(k, 16, 17, k.orte.pool[0].x, k.orte.pool[0].y), 'Pool erreichbar');
  wahr(D.Pfad.suche(k, 16, 17, k.orte.tafel[0].x, k.orte.tafel[0].y), 'Tafel erreichbar');
});

// ---------- Kamera ----------
test('Kamera: bleibt in den Kartengrenzen', function () {
  var D = ladeKontext().Dorf;
  var k = D.Kamera.erstelle(320, 176, 640, 480);
  D.Kamera.sofort(k, 0, 0); gleich(k.x, 0); gleich(k.y, 0);
  D.Kamera.sofort(k, 9999, 9999); gleich(k.x, 320); gleich(k.y, 304);
  D.Kamera.sofort(k, 320, 240); gleich(k.x, 160); gleich(k.y, 152);
  var klein = D.Kamera.erstelle(320, 176, 160, 100); D.Kamera.sofort(klein, 50, 50);
  gleich(klein.x, -80); gleich(klein.y, -38);
});
test('Kamera: folgt weich und erreicht das Ziel', function () {
  var D = ladeKontext().Dorf;
  var k = D.Kamera.erstelle(320, 176, 640, 480);
  D.Kamera.sofort(k, 160, 88);
  D.Kamera.update(k, 640, 480, 1 / 60);
  wahr(k.x > 0 && k.x < 320, 'nach einem Frame noch unterwegs (weich)');
  for (var i = 0; i < 600; i++) D.Kamera.update(k, 640, 480, 1 / 60);
  gleich(k.x, 320); gleich(k.y, 304);
});

// ---------- Beduerfnisse / KI ----------
test('KI: Satt < 30 fuehrt zur Tafel (Vorrang vor Spielen)', function () {
  var D = ladeKontext().Dorf;
  gleich(D.Gaeste.entscheide({ satt: 20, spielen: 10 }), 'tafel');
  gleich(D.Gaeste.entscheide({ satt: 29.9, spielen: 90 }), 'tafel');
  gleich(D.Gaeste.entscheide({ satt: 50, spielen: 30 }), 'pool');
  gleich(D.Gaeste.entscheide({ satt: 30, spielen: 40 }), null);
});
test('KI: Abfall pro Spielstunde entspricht Profilfaktor', function () {
  var D = ladeKontext().Dorf;
  var k = D.Karte.erstelle(D.RNG.erstelle(1));
  var mia = D.Gaeste.erstelle('mia', k);
  mia.beduerfnisse = { satt: 80, spielen: 80 };
  D.Gaeste.abfall(mia, 1);
  nah(mia.beduerfnisse.satt, 80 - 8 * 1.3, 1e-9); nah(mia.beduerfnisse.spielen, 80 - 6 * 1.4, 1e-9);
});
test('Abnahme: Mia geht allein zum Pool und spaeter zur Tafel', function () {
  var D = ladeKontext().Dorf;
  var st = D.Spiel.erstelle({ seed: 5 });
  var mia = st.gaeste[0];
  mia.beduerfnisse = { satt: 90, spielen: 35 };
  var dt = 1 / 30, i;
  for (i = 0; i < 30 * 20 && mia.zustand !== 'aktiv'; i++) D.Spiel.schritt(st, dt);
  gleich(mia.ziel, 'pool', 'Ziel'); gleich(mia.zustand, 'aktiv', 'am Pool angekommen');
  var t = D.Gaeste.tileVon(mia);
  gleich(st.karte.tile(t.x, t.y), D.Karte.T.RAND, 'steht am Poolrand');
  var vorher = mia.beduerfnisse.spielen;
  for (i = 0; i < 60; i++) D.Spiel.schritt(st, dt);
  wahr(mia.beduerfnisse.spielen > vorher, 'Spielen steigt am Pool');
  mia.beduerfnisse.satt = 20;
  for (i = 0; i < 30 * 30 && !(mia.ziel === 'tafel' && mia.zustand === 'aktiv'); i++) D.Spiel.schritt(st, dt);
  gleich(mia.ziel, 'tafel'); gleich(mia.zustand, 'aktiv', 'an der Tafel angekommen');
});
test('KI: gleicher Seed ergibt gleiche Ablaeufe', function () {
  function lauf() {
    var D = ladeKontext().Dorf, st = D.Spiel.erstelle({ seed: 99 }), spur = [];
    for (var i = 0; i < 30 * 120; i++) { D.Spiel.schritt(st, 1 / 30); if (i % 90 === 0) spur.push(st.gaeste.map(function (g) { return g.zustand + ':' + g.ziel + ':' + Math.round(g.x) + ',' + Math.round(g.y); }).join('|')); }
    return spur.join(';');
  }
  gleich(lauf(), lauf());
});

// ---------- Uhr ----------
test('Uhr: 40 s pro Stunde, Abendszene bei 23:00 und naechster Tag', function () {
  var D = ladeKontext().Dorf;
  var st = D.Spiel.erstelle({ seed: 1 });
  gleich(D.Uhr.text(st.uhr), '06:00');
  for (var i = 0; i < 40 * 10; i++) D.Spiel.schritt(st, 0.1);
  nah(st.uhr.minute, 7 * 60, 1e-6, 'nach 40 s eine Stunde');
  for (i = 0; i < 17 * 40 * 10; i++) D.Spiel.schritt(st, 0.1);
  wahr(st.abend, 'Abendszene aktiv');
  st.eingabe.druecke('Enter'); D.Spiel.schritt(st, 0.1); st.eingabe.ende();
  wahr(!st.abend, 'Abendszene beendet'); gleich(st.uhr.tag, 2); gleich(D.Uhr.text(st.uhr), '06:00');
});

// ---------- Spieler ----------
test('Spieler: Kollision mit Brunnen und Wasser', function () {
  var D = ladeKontext().Dorf;
  var st = D.Spiel.erstelle({ seed: 1 });
  st.eingabe.druecke('ArrowUp');
  for (var i = 0; i < 200; i++) D.Spiel.schritt(st, 1 / 60);
  var t = D.Gaeste.tileVon(st.spieler);
  gleich(t.x + ',' + t.y, '19,17', 'stoppt vor dem Brunnen');
  gleich(st.spieler.dir, 'oben');
});

// ---------- Smoke-Test Browser-Start ----------
test('Smoke: main.js laeuft mit Fake-Canvas 300 Frames', function () {
  var aufrufe = 0;
  function fakeCtx() {
    var ziel = {};
    return new Proxy(ziel, {
      get: function (t, k) { if (k in t) return t[k]; if (k === 'measureText') return function (s) { return { width: String(s).length * 4 }; }; return function () { aufrufe++; }; },
      set: function (t, k, v) { t[k] = v; return true; }
    });
  }
  var canvasListener = {};
  function fakeCanvas() { var c = fakeCtx(); return { width: 320, height: 176, style: {}, getContext: function () { return c; },
    addEventListener: function (n, f) { (canvasListener[n] = canvasListener[n] || []).push(f); },
    getBoundingClientRect: function () { return { left: 0, top: 0, width: 1280, height: 704 }; } }; }
  var canvases = { spiel: fakeCanvas(), ui: fakeCanvas() }, queue = [], listener = {};
  var win = {
    innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1,
    addEventListener: function (n, f) { (listener[n] = listener[n] || []).push(f); },
    requestAnimationFrame: function (f) { queue.push(f); }
  };
  var doc = { getElementById: function (id) { return canvases[id]; } };
  var ctx = ladeKontext({ window: win, document: doc });
  gleich((listener.load || []).length, 1, 'Autostart an load gebunden');
  listener.load[0]();
  var h = ctx.Dorf.Spiel.laufend;
  wahr(h && h.st, 'Spiel gestartet');
  gleich(canvases.spiel.style.width, (320 * 4) + 'px', 'ganzzahlige Skalierung');
  listener.keydown.forEach(function (f) { f({ code: 'ArrowRight', preventDefault: function () {} }); });
  listener.keydown.forEach(function (f) { f({ code: 'Backquote', preventDefault: function () {} }); });
  var t = 0;
  for (var i = 0; i < 300; i++) { var f = queue.shift(); t += 16.7; f(t); }
  wahr(h.st.debug, 'Debug-Overlay an');
  wahr(h.st.spieler.x > 19 * 16 + 8, 'Biel ist nach rechts gelaufen');
  wahr(aufrufe > 10000, 'es wurde gezeichnet (' + aufrufe + ' Aufrufe)');
  wahr(h.st.fps > 50, 'FPS gemessen');
  // Tippen/Klicken auf den Canvas setzt ein Laufziel
  listener.keyup.forEach(function (f) { f({ code: 'ArrowRight', preventDefault: function () {} }); });
  wahr(canvasListener.pointerdown && canvasListener.pointerdown.length === 1, 'Pointer-Listener am Canvas');
  canvasListener.pointerdown[0]({ clientX: 640, clientY: 600, preventDefault: function () {} });
  for (i = 0; i < 3; i++) { f = queue.shift(); t += 16.7; f(t); }
  wahr(h.st.spieler.ziel || h.st.marker, 'Klick erzeugt Laufziel');
});
test('Version: sichtbares Label ist v0.2', function () {
  var D = ladeKontext().Dorf;
  gleich(D.VERSION, 'v0.2');
  var html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  wahr(html.indexOf('Finca v0.2') >= 0, 'Titel enthaelt v0.2');
});
test('Debug: F1 ist frei, Debug liegt auf Backquote', function () {
  var D = ladeKontext().Dorf;
  gleich(D.Eingabe.AKTIONEN.debug.indexOf('F1'), -1);
  wahr(D.Eingabe.AKTIONEN.debug.indexOf('Backquote') >= 0);
  var st = D.Spiel.erstelle({ seed: 1 });
  st.eingabe.druecke('Backquote'); D.Spiel.schritt(st, 0.016); st.eingabe.ende();
  wahr(st.debug, 'Debug an');
});

// ---------- Raeume und Einrichtung (v0.2) ----------
test('Raeume: Haus und Gaestehaus rund 20 Prozent groesser als v0.1', function () {
  var D = ladeKontext().Dorf;
  var k = D.Karte.erstelle(D.RNG.erstelle(1));
  // v0.1: Kueche 6x7, Wohnbereich 5x7, Gaestehaus 6x6
  var alt = 42 + 35 + 36, neu = k.groesse('kueche') + k.groesse('wohnen') + k.groesse('gaestehaus');
  var faktor = neu / alt;
  wahr(faktor >= 1.15 && faktor <= 1.3, 'Faktor ' + faktor.toFixed(2));
  wahr(k.groesse('gaestehaus') / 36 >= 1.15, 'Gaestehaus groesser');
});
test('Einrichtung: Couch, Sessel, Pflanzen, Teppich, Bett vorhanden, aber nicht zugestellt', function () {
  var D = ladeKontext().Dorf, T = D.Karte.T;
  var k = D.Karte.erstelle(D.RNG.erstelle(1)), zahl = {};
  for (var i = 0; i < k.tiles.length; i++) zahl[k.tiles[i]] = (zahl[k.tiles[i]] || 0) + 1;
  wahr(zahl[T.COUCH] >= 2 && zahl[T.SESSEL] >= 1 && zahl[T.PFLANZE] >= 3 && zahl[T.TEPPICH] >= 4 && zahl[T.BETT] >= 2, 'Moebel da');
  ['kueche', 'wohnen', 'gaestehaus'].forEach(function (id) {
    wahr(k.flaeche(id) / k.groesse(id) >= 0.75, id + ': mindestens 75 Prozent frei begehbar');
  });
  wahr(!k.blockiert(12, 4), 'Teppich ist begehbar');
});
test('Einrichtung: jede freie Kachel in Haus und Gaestehaus ist vom Innenhof erreichbar', function () {
  var D = ladeKontext().Dorf;
  var k = D.Karte.erstelle(D.RNG.erstelle(1));
  Object.keys(k.raeume).forEach(function (id) {
    var r = k.raeume[id];
    for (var y = r.y0; y <= r.y1; y++) for (var x = r.x0; x <= r.x1; x++) {
      if (k.blockiert(x, y)) continue;
      wahr(D.Pfad.suche(k, 19, 18, x, y), id + ' ' + x + ',' + y + ' erreichbar');
    }
  });
  wahr(k.orte.couch.length >= 2, 'Couchplaetze');
  wahr(k.orte.herd.length >= 1, 'Platz vor dem Herd');
});

// ---------- Maus und Tippen (v0.2) ----------
test('Klick: Bildschirm in interne Pixel umrechnen', function () {
  var D = ladeKontext().Dorf;
  var p = D.Eingabe.zuIntern(100 + 640, 50 + 352, { left: 100, top: 50, width: 1280, height: 704 }, 320, 176);
  nah(p.x, 160, 1e-9); nah(p.y, 88, 1e-9);
});
test('Klick: Biel laeuft per A* zur angeklickten Kachel, Marker verschwindet bei Ankunft', function () {
  var D = ladeKontext().Dorf;
  var st = D.Spiel.erstelle({ seed: 1 });
  st.gaeste = [];
  gleich(D.Spiel.klick(st, 22 * 16 + 8, 14 * 16 + 8), 'laufen');
  wahr(st.marker && st.marker.x === 22 && st.marker.y === 14, 'Marker gesetzt');
  for (var i = 0; i < 60 * 10 && st.spieler.ziel; i++) D.Spiel.schritt(st, 1 / 60);
  var t = D.Spieler.tile(st.spieler);
  gleich(t.x + ',' + t.y, '22,14', 'angekommen (um den Brunnen herum)');
  gleich(st.marker, null, 'Marker weg');
});
test('Klick: ins Haus bis vor die Couch', function () {
  var D = ladeKontext().Dorf;
  var st = D.Spiel.erstelle({ seed: 1 });
  st.gaeste = [];
  D.Spiel.klick(st, 13 * 16 + 8, 2 * 16 + 8);  // auf die Couch geklickt
  for (var i = 0; i < 60 * 20 && st.spieler.ziel; i++) D.Spiel.schritt(st, 1 / 60);
  var t = D.Spieler.tile(st.spieler);
  gleich(t.x + ',' + t.y, '13,3', 'steht direkt vor der Couch');
});
test('Klick: unerreichbares Ziel (Pool) wird abgelehnt, Biel bleibt stehen', function () {
  var D = ladeKontext().Dorf;
  var st = D.Spiel.erstelle({ seed: 1 });
  var x0 = st.spieler.x;
  gleich(D.Spiel.klick(st, 30 * 16 + 8, 6 * 16 + 8), 'nein');
  wahr(!st.spieler.ziel, 'kein Ziel'); gleich(st.spieler.x, x0);
});
test('Klick: Pfeiltaste bricht den Klickweg ab', function () {
  var D = ladeKontext().Dorf;
  var st = D.Spiel.erstelle({ seed: 1 });
  D.Spiel.klick(st, 13 * 16 + 8, 14 * 16 + 8);
  D.Spiel.schritt(st, 1 / 60);
  wahr(st.spieler.ziel, 'unterwegs');
  st.eingabe.druecke('ArrowDown'); D.Spiel.schritt(st, 1 / 60);
  wahr(!st.spieler.ziel, 'abgebrochen'); gleich(st.marker, null);
});
test('Klick auf Gast: Biel geht hin und der Gast spricht', function () {
  var D = ladeKontext().Dorf;
  var st = D.Spiel.erstelle({ seed: 3 });
  var jonas = st.gaeste[1];
  jonas.beduerfnisse = { satt: 90, spielen: 90, ruhe: 90 }; jonas.warte = 999;
  st.blase = null;
  gleich(D.Spiel.klick(st, jonas.x, jonas.y - 10), 'sprechen');
  for (var i = 0; i < 60 * 10 && !(st.blase && st.blase.sprecher === 'Jonas'); i++) D.Spiel.schritt(st, 1 / 60);
  wahr(st.blase && st.blase.sprecher === 'Jonas', 'Jonas spricht');
  wahr(Math.hypot(jonas.x - st.spieler.x, jonas.y - st.spieler.y) < 30, 'Biel steht neben Jonas');
});
test('Klick in der Abendszene startet den naechsten Tag', function () {
  var D = ladeKontext().Dorf;
  var st = D.Spiel.erstelle({ seed: 1 });
  st.abend = true;
  gleich(D.Spiel.klick(st, 10, 10), 'tag');
  D.Spiel.schritt(st, 0.1);
  wahr(!st.abend); gleich(st.uhr.tag, 2);
});

// ---------- Kueche und Couch (v0.2) ----------
test('Kochen: Klick auf den Herd, Biel kocht, Portionen stehen auf der Tafel', function () {
  var D = ladeKontext().Dorf;
  var st = D.Spiel.erstelle({ seed: 1 });
  st.gaeste = [];
  gleich(D.Spiel.klick(st, 5 * 16 + 8, 2 * 16 + 8), 'kochen');
  for (var i = 0; i < 60 * 25 && !st.kochen; i++) D.Spiel.schritt(st, 1 / 60);
  wahr(st.kochen, 'Kochen begonnen');
  gleich(st.essen, 0);
  for (i = 0; i < 60 * (D.Spiel.KOCHDAUER + 1); i++) D.Spiel.schritt(st, 1 / 60);
  gleich(st.kochen, null); gleich(st.essen, D.Spiel.PORTIONEN, 'Portionen');
});
test('Kochen: Taste E vor dem Herd', function () {
  var D = ladeKontext().Dorf;
  var st = D.Spiel.erstelle({ seed: 1 });
  st.gaeste = [];
  var h = st.karte.orte.herd[0];
  st.spieler.x = h.x * 16 + 8; st.spieler.y = h.y * 16 + 12;
  st.eingabe.druecke('KeyE'); D.Spiel.schritt(st, 1 / 60); st.eingabe.ende();
  wahr(st.kochen, 'kocht');
});
test('Kochen: hungriger Gast nimmt eine Portion und wird schneller satt', function () {
  var D = ladeKontext().Dorf;
  var st = D.Spiel.erstelle({ seed: 5 });
  st.essen = 3;
  var mia = st.gaeste[0];
  mia.beduerfnisse = { satt: 20, spielen: 90, ruhe: 90 };
  for (var i = 0; i < 30 * 40 && mia.zustand !== 'aktiv'; i++) D.Spiel.schritt(st, 1 / 30);
  gleich(mia.ziel, 'tafel'); wahr(mia.portion, 'Portion genommen'); gleich(st.essen, 2);
  var vorher = mia.beduerfnisse.satt;
  D.Gaeste.update(mia, st, 0, 0.1);
  var mit = mia.beduerfnisse.satt - vorher;
  mia.portion = false; vorher = mia.beduerfnisse.satt;
  D.Gaeste.update(mia, st, 0, 0.1);
  var ohne = mia.beduerfnisse.satt - vorher;
  wahr(mit > ohne * 1.5, 'mit Portion schneller (' + mit.toFixed(2) + ' vs ' + ohne.toFixed(2) + ')');
});
test('Ruhe: muede Gaeste setzen sich auf die Couch und erholen sich', function () {
  var D = ladeKontext().Dorf;
  gleich(D.Gaeste.entscheide({ satt: 80, spielen: 80, ruhe: 20 }), 'couch');
  gleich(D.Gaeste.entscheide({ satt: 80, spielen: 20, ruhe: 20 }), 'pool', 'Spielen vor Ruhe');
  var st = D.Spiel.erstelle({ seed: 2 });
  var jonas = st.gaeste[1];
  jonas.beduerfnisse = { satt: 90, spielen: 90, ruhe: 20 };
  for (var i = 0; i < 30 * 60 && jonas.zustand !== 'aktiv'; i++) D.Spiel.schritt(st, 1 / 30);
  gleich(jonas.ziel, 'couch'); gleich(jonas.zustand, 'aktiv');
  wahr(D.Gaeste.sitzt(jonas), 'sitzt');
  gleich(D.Gaeste.symbol(jonas), 'zzz');
  var t = D.Gaeste.tileVon(jonas);
  gleich(st.karte.tile(t.x, t.y - 1), D.Karte.T.COUCH, 'vor der Couch');
  var vorher = jonas.beduerfnisse.ruhe;
  for (i = 0; i < 60; i++) D.Spiel.schritt(st, 1 / 30);
  wahr(jonas.beduerfnisse.ruhe > vorher, 'Ruhe steigt');
});
test('KI: lange Laeufe bleiben deterministisch und kein Gast steht in Moebeln', function () {
  var D = ladeKontext().Dorf;
  var st = D.Spiel.erstelle({ seed: 11 });
  for (var i = 0; i < 30 * 600; i++) {
    D.Spiel.schritt(st, 1 / 30);
    if (i % 30 === 0) st.gaeste.forEach(function (gs) { var t = D.Gaeste.tileVon(gs); wahr(!st.karte.blockiert(t.x, t.y), gs.name + ' auf freier Kachel ' + t.x + ',' + t.y); });
  }
});

// ---------- Ausfuehren ----------
tests.forEach(function (t) {
  try { t.fn(); ok++; console.log('  ok    ' + t.name); }
  catch (e) { fehler++; console.log('  FEHLER ' + t.name + '\n         ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join('\n         ') : e)); }
});
console.log('\n' + ok + ' bestanden, ' + fehler + ' fehlgeschlagen');
process.exit(fehler ? 1 : 0);
