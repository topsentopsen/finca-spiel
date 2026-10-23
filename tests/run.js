#!/usr/bin/env node
/* Eigener Test-Runner ohne Abhaengigkeiten: laedt die Spieldateien per vm in einen Kontext. */
'use strict';
var fs = require('fs'), path = require('path'), vm = require('vm');

var DATEIEN = ['rng', 'karte', 'pfad', 'kamera', 'eingabe', 'uhr', 'spieler', 'gerichte', 'glueck', 'gaeste', 'tiere', 'render', 'ton', 'main'];

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
test('Version: sichtbares Label ist v0.4', function () {
  var D = ladeKontext().Dorf;
  gleich(D.VERSION, 'v0.4');
  var html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  wahr(html.indexOf('Finca v0.4') >= 0, 'Titel enthaelt v0.4');
  DATEIEN.forEach(function (n) { wahr(html.indexOf('js/' + n + '.js?v=0.4') >= 0, n + ' eingebunden'); });
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
  for (var i = 0; i < 60 * 25 && !st.menue; i++) D.Spiel.schritt(st, 1 / 60);
  wahr(st.menue, 'Menue offen');
  st.eingabe.druecke('Digit1'); D.Spiel.schritt(st, 1 / 60); st.eingabe.ende();
  wahr(st.kochen, 'Kochen begonnen');
  gleich(st.teller.length, 0);
  for (i = 0; i < 60 * (D.Spiel.KOCHDAUER + 1); i++) D.Spiel.schritt(st, 1 / 60);
  gleich(st.kochen, null); gleich(st.teller.length, D.Spiel.PORTIONEN, 'Portionen');
  gleich(st.teller[0], 'paamboli');
});
test('Kochen: Taste E vor dem Herd', function () {
  var D = ladeKontext().Dorf;
  var st = D.Spiel.erstelle({ seed: 1 });
  st.gaeste = [];
  var h = st.karte.orte.herd[0];
  st.spieler.x = h.x * 16 + 8; st.spieler.y = h.y * 16 + 12;
  st.eingabe.druecke('KeyE'); D.Spiel.schritt(st, 1 / 60); st.eingabe.ende(); st.eingabe.loese('KeyE');
  wahr(st.menue, 'Menue offen'); wahr(!st.kochen);
  st.eingabe.druecke('KeyE'); D.Spiel.schritt(st, 1 / 60); st.eingabe.ende();
  wahr(st.kochen, 'kocht'); gleich(st.menue, null);
});
test('Kochen: hungriger Gast nimmt eine Portion und wird schneller satt', function () {
  var D = ladeKontext().Dorf;
  var st = D.Spiel.erstelle({ seed: 5 });
  st.teller = ['paamboli', 'paamboli', 'paamboli'];
  var mia = st.gaeste[0];
  mia.beduerfnisse = { satt: 20, spielen: 90, ruhe: 90 };
  for (var i = 0; i < 30 * 40 && mia.zustand !== 'aktiv'; i++) D.Spiel.schritt(st, 1 / 30);
  gleich(mia.ziel, 'tafel'); gleich(mia.portion, 'paamboli', 'Portion genommen'); gleich(st.teller.length, 2);
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

// ---------- Musik und Ton (v0.3) ----------
function fakeSpeicher() { var d = {}; return { d: d, getItem: function (k) { return k in d ? d[k] : null; }, setItem: function (k, v) { d[k] = String(v); } }; }
// Aufzeichnendes Ersatz-WebAudio: merkt sich jede Lautstaerke, die gesetzt wird
function fakeAudio() {
  var log = { kontexte: 0, quellen: 0, gains: [], ziele: [], oszi: 0 };
  function param(v, istGain) {
    function merke(x) { if (istGain) log.gains.push(x); }
    return { value: v, setValueAtTime: merke, linearRampToValueAtTime: merke,
      exponentialRampToValueAtTime: function () {}, setTargetAtTime: function (x) { if (istGain) log.ziele.push(x); }, cancelScheduledValues: function () {} };
  }
  function knoten(extra) { var k = { connect: function () {}, start: function () { log.quellen++; }, stop: function () {} }; Object.keys(extra || {}).forEach(function (n) { k[n] = extra[n]; }); return k; }
  function AC() {
    log.kontexte++;
    this.currentTime = 0; this.sampleRate = 8000; this.state = 'running'; this.destination = {};
  }
  AC.prototype.createGain = function () { var g = knoten({ gain: param(1, true) }); var p = g.gain; var alt = p.value; Object.defineProperty(p, 'value', { get: function () { return alt; }, set: function (v) { alt = v; log.gains.push(v); } }); return g; };
  AC.prototype.createBiquadFilter = function () { return knoten({ frequency: param(1000), Q: param(1), type: '' }); };
  AC.prototype.createDynamicsCompressor = function () { return knoten(); };
  AC.prototype.createDelay = function () { return knoten({ delayTime: param(0) }); };
  AC.prototype.createStereoPanner = function () { return knoten({ pan: param(0) }); };
  AC.prototype.createOscillator = function () { log.oszi++; return knoten({ frequency: param(440), type: 'sine' }); };
  AC.prototype.createBufferSource = function () { return knoten({ buffer: null, loop: false, playbackRate: param(1) }); };
  AC.prototype.createBuffer = function (ch, len) { var d = new Float32Array(len); return { getChannelData: function () { return d; } }; };
  AC.prototype.resume = function () { this.state = 'running'; };
  AC.prototype.suspend = function () { this.state = 'suspended'; };
  return { AC: AC, log: log };
}
function fakeTonFenster(speicher, audio) {
  var l = {}, takte = [];
  return { l: l, takte: takte, localStorage: speicher, AudioContext: audio ? audio.AC : undefined,
    addEventListener: function (n, f) { (l[n] = l[n] || []).push(f); },
    setInterval: function (f) { takte.push(f); return takte.length; } };
}

test('Musik: ruhige Schleife in a-Moll, langsames Tempo, Melodie nur jede zweite Runde', function () {
  var T = ladeKontext().Dorf.Ton;
  wahr(T.BPM <= 80, 'langsam');
  var a = T.noten(0), b = T.noten(1);
  wahr(a.every(function (n) { return n.zeit >= 0 && n.zeit < 64; }), '8 Takte zu 8 Achteln');
  gleich(a.filter(function (n) { return n.art === 'melodie'; }).length, 0, 'erste Runde nur Begleitung');
  wahr(b.filter(function (n) { return n.art === 'melodie'; }).length > 10, 'zweite Runde mit Melodie');
  var tonleiter = [9, 11, 0, 2, 4, 5, 7, 8];   // a-Moll mit gis
  wahr(b.every(function (n) { return tonleiter.indexOf(n.midi % 12) >= 0; }), 'nur Toene aus a-Moll');
  wahr(b.every(function (n) { return n.staerke <= 0.6; }), 'keine lauten Noten');
  nah(T.mtof(69), 440, 1e-9);
});
test('Musik: gezupfte Saite ist begrenzt, klingt aus und ist reproduzierbar', function () {
  var T = ladeKontext().Dorf.Ton;
  var s = T.zupfe(220, 8000, 2, 5), s2 = T.zupfe(220, 8000, 2, 5);
  gleich(s.length, 16000);
  var max = 0, i, anf = 0, end = 0;
  for (i = 0; i < s.length; i++) { max = Math.max(max, Math.abs(s[i])); if (s[i] !== s2[i]) throw new Error('nicht gleich'); }
  for (i = 200; i < 1800; i++) anf += s[i] * s[i];
  for (i = 13000; i < 14600; i++) end += s[i] * s[i];
  wahr(max <= 1, 'begrenzt'); wahr(end < anf / 4, 'klingt aus');
  gleich(s[0], 0, 'sanfter Einsatz ohne Knacken'); gleich(s[s.length - 1], 0, 'sanftes Ende');
});
test('Ton: ohne WebAudio laeuft das Spiel stumm weiter, Stumm wird gespeichert', function () {
  var T = ladeKontext().Dorf.Ton, sp = fakeSpeicher();
  var t = T.erstelle(fakeTonFenster(sp, null));
  gleich(t.stumm, false, 'Standard: Ton an');
  gleich(t.entsperre(), false); gleich(t.spiele('glocke'), false);
  t.umschalten();
  gleich(sp.d[T.SCHLUESSEL], '1');
  gleich(T.erstelle(fakeTonFenster(sp, null)).stumm, true, 'nach Neuladen weiter stumm');
  t.umschalten(); gleich(sp.d[T.SCHLUESSEL], '0');
  var kaputt = { getItem: function () { throw new Error('privat'); }, setItem: function () { throw new Error('privat'); } };
  var t2 = T.erstelle(fakeTonFenster(kaputt, null)); t2.umschalten(); gleich(t2.stumm, true, 'ohne Speicher kein Absturz');
});
test('Ton: startet erst nach der ersten Beruehrung, leise eingeblendet', function () {
  var T = ladeKontext().Dorf.Ton, au = fakeAudio(), win = fakeTonFenster(fakeSpeicher(), au);
  var t = T.erstelle(win);
  gleich(au.log.kontexte, 0, 'vor der Beruehrung kein Audio');
  gleich(t.spiele('glocke'), false);
  wahr(win.l.pointerdown && win.l.keydown && win.l.touchend, 'wartet auf Beruehrung oder Taste');
  win.l.pointerdown[0]({});
  gleich(au.log.kontexte, 1); wahr(t.bereit);
  wahr(au.log.ziele.length >= 1 && au.log.ziele[au.log.ziele.length - 1] === T.LAUT.gesamt, 'blendet auf Zielwert ein');
  wahr(T.LAUT.gesamt * T.LAUT.musik <= 0.35, 'leise Grundlautstaerke');
  gleich(win.takte.length, 1, 'Taktgeber laeuft');
  win.takte[0]();
  wahr(t.gespielt > 0, 'Noten geplant');
  wahr(au.log.gains.every(function (v) { return v <= 1; }), 'nie lauter als 1 (' + Math.max.apply(null, au.log.gains) + ')');
  var abHier = au.log.gains.length;
  ['glocke', 'fertig', 'kochen', 'menue', 'schritt'].forEach(function (n) { gleich(t.spiele(n), true, n); });
  gleich(t.spiele('quatsch'), false);
  var effekte = au.log.gains.slice(abHier);
  wahr(effekte.length >= 10, 'Effekte haben Lautstaerken');
  wahr(effekte.every(function (v) { return v <= 0.06; }), 'Effekte sehr leise ' + effekte.join(' '));
  t.umschalten();
  gleich(au.log.ziele[au.log.ziele.length - 1], 0, 'Stumm blendet aus');
  var vorher = t.gespielt; t.ctx.currentTime = 5; win.takte[0]();
  gleich(t.gespielt, vorher, 'stumm: keine neuen Noten');
  gleich(t.spiele('glocke'), false, 'stumm: keine Effekte');
  t.umschalten(); win.takte[0]();
  wahr(t.gespielt > vorher, 'wieder an: Musik laeuft weiter');
});
test('Ton: Spiel meldet Glocke beim Reden, Kochgeraeusch, Fertig und leise Schritte', function () {
  var D = ladeKontext().Dorf;
  var st = D.Spiel.erstelle({ seed: 3 });
  var jonas = st.gaeste[1];
  st.spieler.x = jonas.x - 14; st.spieler.y = jonas.y;
  st.eingabe.druecke('KeyE'); D.Spiel.schritt(st, 1 / 60); st.eingabe.ende(); st.eingabe.loese('KeyE');
  wahr(st.toene.indexOf('glocke') >= 0, 'Glocke beim Sprechen');
  st = D.Spiel.erstelle({ seed: 1 }); st.gaeste = [];
  st.eingabe.druecke('ArrowRight');
  for (var i = 0; i < 60; i++) D.Spiel.schritt(st, 1 / 60);
  var schritte = st.toene.filter(function (n) { return n === 'schritt'; }).length;
  wahr(schritte >= 2 && schritte <= 6, 'Schritte pro Sekunde: ' + schritte);
  st.eingabe.loese('ArrowRight');
  st.toene.length = 0;
  D.Spiel.kochen(st, 'ensaimada');
  wahr(st.toene.indexOf('kochen') >= 0);
  for (i = 0; i < 60 * 5; i++) D.Spiel.schritt(st, 1 / 60);
  wahr(st.toene.indexOf('fertig') >= 0, 'Fertig-Glocke');
});

// ---------- Kochmenue und Gerichte (v0.3) ----------
test('Gerichte: drei Gerichte mit unterschiedlicher Wirkung', function () {
  var D = ladeKontext().Dorf, G = D.Gerichte;
  gleich(G.REIHE.join(','), 'paamboli,ensaimada,tumbet');
  gleich(G.hole('paamboli').name, 'Pa amb oli'); gleich(G.hole('ensaimada').name, 'Ensaïmada'); gleich(G.hole('tumbet').name, 'Tumbet');
  wahr(G.hole('paamboli').satt > G.hole('tumbet').satt && G.hole('tumbet').satt > G.hole('ensaimada').satt, 'Pa amb oli macht am meisten satt');
  wahr(G.hole('ensaimada').extra.spielen > 0, 'Ensaïmada gibt Spiellaune');
  wahr(G.hole('tumbet').extra.ruhe > 0, 'Tumbet macht ruhig');
  wahr(G.hole('tumbet').dauer > G.hole('paamboli').dauer && G.hole('paamboli').dauer > G.hole('ensaimada').dauer, 'Kochzeiten verschieden');
  gleich(G.hole('tumbet').portionen, 4); gleich(G.hole('ensaimada').portionen, 2);
});
test('Kochmenue: Pfeile waehlen, Biel bleibt stehen, Esc schliesst', function () {
  var D = ladeKontext().Dorf;
  var st = D.Spiel.erstelle({ seed: 1 }); st.gaeste = [];
  var h = st.karte.orte.herd[0];
  st.spieler.x = h.x * 16 + 8; st.spieler.y = h.y * 16 + 12;
  gleich(D.Spiel.zumHerd(st), 'menue');
  gleich(st.menue.wahl, 0);
  var x0 = st.spieler.x;
  st.eingabe.druecke('ArrowRight'); D.Spiel.schritt(st, 1 / 60); st.eingabe.ende();
  for (var i = 0; i < 30; i++) D.Spiel.schritt(st, 1 / 60);
  st.eingabe.loese('ArrowRight');
  gleich(st.menue.wahl, 1, 'zweites Gericht'); gleich(st.spieler.x, x0, 'Biel laeuft nicht weg');
  st.eingabe.druecke('ArrowLeft'); D.Spiel.schritt(st, 1 / 60); st.eingabe.ende(); st.eingabe.loese('ArrowLeft');
  st.eingabe.druecke('ArrowLeft'); D.Spiel.schritt(st, 1 / 60); st.eingabe.ende(); st.eingabe.loese('ArrowLeft');
  gleich(st.menue.wahl, 2, 'rundherum zum dritten');
  st.eingabe.druecke('Escape'); D.Spiel.schritt(st, 1 / 60); st.eingabe.ende();
  gleich(st.menue, null); gleich(st.kochen, null);
});
test('Kochmenue: Tippen auf eine Karte kocht genau dieses Gericht, daneben tippen schliesst', function () {
  var D = ladeKontext().Dorf;
  var st = D.Spiel.erstelle({ seed: 1 }); st.gaeste = [];
  var karten = D.Spiel.menueKarten();
  gleich(karten.length, 3);
  karten.forEach(function (k) { wahr(k.x >= 0 && k.y >= 12 && k.x + k.w <= 320 && k.y + k.h <= 176, 'Karte im Bild'); wahr(k.w >= 40 && k.h >= 40, 'gross genug zum Tippen'); });
  D.Spiel.oeffneMenue(st);
  gleich(D.Spiel.klickBild(st, 5, 170), 'zurueck'); gleich(st.menue, null);
  D.Spiel.oeffneMenue(st);
  var k = karten[2];
  gleich(D.Spiel.klickBild(st, k.x + k.w / 2, k.y + k.h / 2), 'gekocht');
  gleich(st.kochen.gericht, 'tumbet');
  for (var i = 0; i < 60 * 9; i++) D.Spiel.schritt(st, 1 / 60);
  gleich(st.teller.join(','), 'tumbet,tumbet,tumbet,tumbet');
  D.Spiel.oeffneMenue(st); gleich(st.menue.wahl, 2, 'merkt sich die letzte Wahl');
  D.Spiel.kochen(st, 'ensaimada');
  for (i = 0; i < 60 * 5; i++) D.Spiel.schritt(st, 1 / 60);
  gleich(st.teller.length, D.Spiel.TAFEL_MAX, 'Tafel voll');
  gleich(D.Spiel.oeffneMenue(st), false, 'volle Tafel: kein Menue');
});
test('Kochknopf: vom Innenhof zum Herd laufen, Menue oeffnet sich, zweiter Druck kocht', function () {
  var D = ladeKontext().Dorf;
  var st = D.Spiel.erstelle({ seed: 1 }); st.gaeste = [];
  st.eingabe.tippe('kochen'); D.Spiel.schritt(st, 1 / 60); st.eingabe.ende();
  wahr(st.spieler.ziel, 'laeuft los');
  for (var i = 0; i < 60 * 25 && !st.menue; i++) D.Spiel.schritt(st, 1 / 60);
  wahr(st.menue, 'Menue am Herd');
  st.eingabe.tippe('kochen'); D.Spiel.schritt(st, 1 / 60); st.eingabe.ende();
  gleich(st.kochen.gericht, 'paamboli');
});
test('Gerichte: Gast nimmt sein Lieblingsgericht, Ensaïmada gibt Spiellaune, Tumbet Ruhe', function () {
  var D = ladeKontext().Dorf;
  var st = D.Spiel.erstelle({ seed: 5 });
  st.teller = ['paamboli', 'tumbet', 'ensaimada'];
  var mia = st.gaeste[0], jonas = st.gaeste[1];
  gleich(mia.liebling, 'ensaimada'); gleich(jonas.liebling, 'tumbet');
  D.Gaeste.nimmTeller(mia, st); gleich(mia.portion, 'ensaimada');
  D.Gaeste.nimmTeller(jonas, st); gleich(jonas.portion, 'tumbet');
  gleich(st.teller.join(','), 'paamboli');
  function zuwachs(gast, gericht, wert) {
    gast.zustand = 'aktiv'; gast.ziel = 'tafel'; gast.portion = gericht;
    gast.beduerfnisse = { satt: 40, spielen: 40, ruhe: 40 };
    D.Gaeste.update(gast, st, 0, 0.1);
    return gast.beduerfnisse[wert] - 40 + D.Gaeste.BASIS[wert] * gast.profil[wert] * 0.1;
  }
  wahr(zuwachs(mia, 'ensaimada', 'spielen') > 1, 'Ensaïmada: Spielen steigt');
  nah(zuwachs(mia, 'paamboli', 'spielen'), 0, 1e-9, 'Pa amb oli: Spielen bleibt');
  wahr(zuwachs(jonas, 'tumbet', 'ruhe') > 1, 'Tumbet: Ruhe steigt');
  wahr(zuwachs(jonas, 'paamboli', 'satt') > zuwachs(jonas, 'ensaimada', 'satt'), 'Pa amb oli macht satter');
  mia.zustand = 'aktiv'; mia.ziel = 'tafel'; mia.portion = 'ensaimada';
  wahr(/Ensaïmada/.test(D.Gaeste.spruch(mia, st.rng)), 'Mia freut sich ueber Ensaïmada');
});

// ---------- Knoepfe, Touch und Vollbild (v0.3) ----------
test('Knoepfe: Ton, Vollbild, Sprechen und Kochen im HTML, keine fremden Quellen', function () {
  var html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  ['ton-knopf', 'vollbild-knopf', 'knopf-sprechen', 'knopf-kochen'].forEach(function (id) {
    wahr(new RegExp('<button id="' + id + '"[^>]*aria-label="').test(html), id + ' mit Beschriftung');
  });
  wahr(/>\s*Sprechen\s*</.test(html) && /<\/svg>\s*Kochen\s*</.test(html), 'Knoepfe sind beschriftet');
  wahr(!/https?:\/\//.test(html.replace(/http:\/\/www\.w3\.org\/2000\/svg/g, '')), 'keine externen Adressen');
  DATEIEN.forEach(function (n) { wahr(!/https?:\/\//.test(fs.readFileSync(path.join(__dirname, '..', 'js', n + '.js'), 'utf8')), n + ' ohne Netz'); });
});
test('Smoke: Taste M, Lautsprecher-Knopf, Touch-Knoepfe und Vollbild im Browser', function () {
  function fakeCtx() { return new Proxy({}, { get: function (t, k) { if (k in t) return t[k]; if (k === 'measureText') return function (s) { return { width: String(s).length * 4 }; }; return function () {}; }, set: function (t, k, v) { t[k] = v; return true; } }); }
  function el(id) {
    var l = {}, attr = {};
    return { id: id, l: l, attr: attr, style: { setProperty: function (k, v) { this[k] = v; } }, className: 'knopf', classList: { an: {}, toggle: function (k, v) { this.an[k] = !!v; } },
      addEventListener: function (n, f) { (l[n] = l[n] || []).push(f); }, setAttribute: function (k, v) { attr[k] = v; },
      klick: function () { (l.click || []).forEach(function (f) { f({ preventDefault: function () {} }); }); },
      width: 320, height: 176, getContext: function () { return fakeCtx(); }, getBoundingClientRect: function () { return { left: 0, top: 0, width: 640, height: 352 }; } };
  }
  var els = {}; ['spiel', 'ui', 'rahmen', 'ton-knopf', 'vollbild-knopf', 'knopf-sprechen', 'knopf-kochen'].forEach(function (id) { els[id] = el(id); });
  var voll = 0, queue = [], listener = {}, sp = fakeSpeicher();
  var win = {
    innerWidth: 640, innerHeight: 400, devicePixelRatio: 1, localStorage: sp, navigator: { maxTouchPoints: 5 },
    matchMedia: function () { return { matches: true }; },
    addEventListener: function (n, f) { (listener[n] = listener[n] || []).push(f); },
    requestAnimationFrame: function (f) { queue.push(f); }, setInterval: function () { return 1; }
  };
  var doc = { getElementById: function (id) { return els[id] || null; }, documentElement: { requestFullscreen: function () { voll++; } }, addEventListener: function () {} };
  var ctx = ladeKontext({ window: win, document: doc });
  listener.load[0]();
  var h = ctx.Dorf.Spiel.laufend, t = 0;
  function frames(n) { for (var i = 0; i < n; i++) { var f = queue.shift(); t += 16.7; f(t); } }
  frames(2);
  gleich(els.rahmen.style['--s'], '2', 'Skalierung fuer die Knoepfe');
  wahr(els.rahmen.classList.an.touch, 'Touch-Knoepfe sichtbar');
  gleich(h.st.ton.stumm, false);
  listener.keydown.forEach(function (f) { f({ code: 'KeyM', preventDefault: function () {} }); });
  frames(1);
  listener.keyup.forEach(function (f) { f({ code: 'KeyM', preventDefault: function () {} }); });
  gleich(h.st.ton.stumm, true, 'M schaltet stumm'); gleich(sp.d['finca.stumm'], '1', 'gespeichert');
  gleich(els['ton-knopf'].className, 'knopf aus', 'Knopf zeigt stumm');
  els['ton-knopf'].klick();
  gleich(h.st.ton.stumm, false, 'Lautsprecher-Knopf schaltet wieder an'); gleich(els['ton-knopf'].attr['aria-pressed'], 'false');
  els['vollbild-knopf'].klick(); gleich(voll, 1, 'Vollbild angefragt');
  els['knopf-kochen'].klick(); frames(1);
  wahr(h.st.spieler.ziel, 'Kochknopf: Biel laeuft zum Herd');
  frames(60 * 20);
  wahr(h.st.menue, 'Kochmenue offen');
  els['knopf-kochen'].klick(); frames(1);
  wahr(h.st.kochen, 'Kochknopf waehlt');
  els['knopf-sprechen'].klick(); frames(1);
  wahr(h.st.blase, 'Sprechknopf wie Taste E');
});
test('Skalierung: kleines Handy bekommt krumme Skalierung statt winzig', function () {
  function fakeCtx() { return new Proxy({}, { get: function (t, k) { if (k in t) return t[k]; return function () { return { width: 4 }; }; }, set: function (t, k, v) { t[k] = v; return true; } }); }
  function cv() { return { width: 320, height: 176, style: {}, getContext: function () { return fakeCtx(); }, addEventListener: function () {}, getBoundingClientRect: function () { return { left: 0, top: 0, width: 1, height: 1 }; } }; }
  var c = { spiel: cv(), ui: cv() }, listener = {};
  var win = { innerWidth: 568, innerHeight: 320, devicePixelRatio: 2, addEventListener: function (n, f) { (listener[n] = listener[n] || []).push(f); }, requestAnimationFrame: function () {} };
  var ctx = ladeKontext({ window: win, document: { getElementById: function (id) { return c[id] || null; } } });
  listener.load[0]();
  gleich(c.spiel.style.width, (320 * 1.77) + 'px');
});


// ---------- Glueck, Tiere und Abendmusik (v0.4) ----------
test('Glueck: Herzen fuer Reden, Essen und Lieblingsgericht, mit Pause und Obergrenze', function () {
  var D = ladeKontext().Dorf, G = D.Glueck, st = D.Spiel.erstelle({ seed: 3 }), mia = st.gaeste[0];
  gleich(G.herzen(mia), 1, 'Start mit einem Herz');
  st.toene.length = 0;
  gleich(G.gib(st, mia, 'reden'), 0, '10 Punkte sind noch kein neues Herz');
  gleich(G.gib(st, mia, 'reden'), 0, 'Reden zaehlt erst nach einer Pause wieder');
  gleich(mia.glueck, 30);
  st.zeit += 13;
  gleich(G.gib(st, mia, 'reden'), 1, 'nach der Pause wieder');
  gleich(st.toene.filter(function (t) { return t === 'herz'; }).length, 1, 'neues Herz klingt');
  gleich(st.herzchen.length, 1, 'Herzchen steigt auf');
  var a = G.gib(st, mia, 'essen'), b = G.gib(st, mia, 'liebling');
  wahr(G.GRUND.liebling.menge > G.GRUND.essen.menge, 'Lieblingsgericht macht gluecklicher');
  wahr(a + b >= 1);
  for (var i = 0; i < 20; i++) G.gib(st, mia, 'liebling');
  gleich(mia.glueck, G.MAX, 'nie mehr als voll'); gleich(G.herzen(mia), 5);
  gleich(G.gib(st, mia, 'quatsch'), 0, 'unbekannter Grund tut nichts');
  wahr(!st.tagesziel.erreicht, 'Jonas fehlt noch');
});
test('Glueck: Tagesziel einmal feiern, nie sinken, neuer Tag beginnt frisch', function () {
  var D = ladeKontext().Dorf, G = D.Glueck, st = D.Spiel.erstelle({ seed: 4 });
  var vorher = st.gaeste.map(function (g) { return g.glueck; });
  for (var i = 0; i < 30 * 200; i++) D.Spiel.schritt(st, 1 / 30);
  st.gaeste.forEach(function (g, k) { wahr(g.glueck >= vorher[k], 'Glueck sinkt nie'); });
  st.gaeste.forEach(function (g) { g.glueck = G.MAX - 5; });
  st.toene.length = 0;
  G.gib(st, st.gaeste[0], 'liebling');
  wahr(!st.tagesziel.erreicht, 'erst wenn alle gluecklich sind');
  G.gib(st, st.gaeste[1], 'liebling');
  wahr(st.tagesziel.erreicht && st.tagesziel.neu, 'Ziel erreicht');
  D.Spiel.schritt(st, 1 / 30);
  gleich(st.tagesziel.neu, false, 'nur einmal gemeldet');
  wahr(st.toene.indexOf('feier') >= 0, 'leise Feier-Melodie');
  wahr(/glücklich/.test(st.blase.text), 'Biel freut sich');
  // Abend: Feier statt Nacht
  st.uhr.minute = D.Uhr.ENDE; st.toene.length = 0;
  D.Spiel.schritt(st, 1 / 30);
  wahr(st.abend); wahr(st.toene.indexOf('feier') >= 0, 'Abendszene feiert');
  st.naechsterTag = true; D.Spiel.schritt(st, 1 / 30);
  wahr(!st.abend); gleich(st.tagesziel.erreicht, false, 'neues Ziel am neuen Tag');
  st.gaeste.forEach(function (g) { gleich(g.glueck, G.START, 'neuer Tag, neue Herzen'); });
  // ohne Ziel: sanfter Abend, keine Strafe
  st.uhr.minute = D.Uhr.ENDE; st.toene.length = 0; D.Spiel.schritt(st, 1 / 30);
  wahr(st.abend && st.toene.indexOf('nacht') >= 0 && st.toene.indexOf('feier') < 0, 'leises Gute-Nacht');
  st.gaeste.forEach(function (g) { gleich(g.glueck, G.START, 'nichts wird abgezogen'); });
});
test('Glueck: Gaeste werden gluecklicher, wenn sie Essen nehmen (Liebling mehr)', function () {
  var D = ladeKontext().Dorf, st = D.Spiel.erstelle({ seed: 2 }), mia = st.gaeste[0], jonas = st.gaeste[1];
  st.teller = ['ensaimada', 'ensaimada'];
  wahr(D.Gaeste.nimmTeller(mia, st)); gleich(mia.glueck, D.Glueck.START + D.Glueck.GRUND.liebling.menge);
  wahr(D.Gaeste.nimmTeller(jonas, st)); gleich(jonas.glueck, D.Glueck.START + D.Glueck.GRUND.essen.menge);
});
test('Esel: Wiese mit Zaun, Bruna bleibt drin, Biel kommt bis an den Zaun', function () {
  var D = ladeKontext().Dorf, st = D.Spiel.erstelle({ seed: 8 }), k = st.karte, T = D.Karte.T, w = k.wiese;
  for (var x = w.x0 - 1; x <= w.x1 + 1; x++) { gleich(k.tile(x, w.y0 - 1), T.ZAUN); gleich(k.tile(x, w.y1 + 1), T.ZAUN); }
  wahr(k.blockiert(w.x0, w.y0) && k.blockiert(w.x0 - 1, w.y0), 'Wiese und Zaun nicht begehbar');
  wahr(D.Pfad.suche(k, 19, 18, w.x0 + 1, w.y1 + 2), 'unter dem Zaun erreichbar');
  var e = st.tiere.esel, orte = {};
  for (var i = 0; i < 30 * 240; i++) {
    D.Tiere.update(st.tiere, k, 1 / 30);
    wahr(e.x >= w.x0 * 16 && e.x <= (w.x1 + 1) * 16 && e.y >= w.y0 * 16 && e.y <= (w.y1 + 1) * 16, 'Bruna bleibt auf der Wiese');
    orte[Math.floor(e.x / 16) + ',' + Math.floor(e.y / 16)] = 1;
  }
  wahr(Object.keys(orte).length >= 3, 'Bruna bummelt umher');
  var g = st.tiere.gecko;
  gleich(k.tile(Math.floor(g.x / 16), Math.floor(g.y / 16)), T.WAND, 'Gecko sitzt an der Hauswand');
  // eigener Zufall: Gaeste entscheiden wie in v0.3
  var s1 = D.Spiel.erstelle({ seed: 8 }), s2 = D.Spiel.erstelle({ seed: 8 });
  for (i = 0; i < 3000; i++) D.Tiere.update(s1.tiere, s1.karte, 1 / 10);
  gleich(s1.rng.next(), s2.rng.next(), 'Spielzufall unberuehrt');
});
test('Streicheln: Klick laeuft zum Zaun, Bruna kommt, Herz und leiser Laut', function () {
  var D = ladeKontext().Dorf, st = D.Spiel.erstelle({ seed: 6 }), e = st.tiere.esel;
  st.toene.length = 0;
  var r = D.Spiel.klick(st, e.x, e.y - 8);
  gleich(r, 'streicheln', 'Biel macht sich auf den Weg');
  for (var i = 0; i < 60 * 30 && e.gestreichelt === 0; i++) { D.Spiel.schritt(st, 1 / 60); st.toene = st.toene.filter(function (t) { return t !== 'schritt'; }); }
  gleich(e.gestreichelt, 1, 'gestreichelt');
  wahr(st.toene.indexOf('esel') >= 0, 'Bruna macht ein leises Geraeusch');
  wahr(st.herzchen.length >= 1, 'Herz steigt auf');
  wahr(e.freude > 0, 'Bruna freut sich');
  gleich(st.blase.sprecher, 'Biel'); wahr(/Bruna|Ase/.test(st.blase.text));
  wahr(D.Tiere.nah(e, st.spieler), 'Biel steht am Zaun');
  // Klick direkt nochmal: sofort streicheln
  gleich(D.Spiel.klick(st, e.x, e.y - 8), 'tier'); gleich(e.gestreichelt, 2);
});
test('Streicheln: Taste E beim Gecko, Gaeste in der Naehe freuen sich mit', function () {
  var D = ladeKontext().Dorf, st = D.Spiel.erstelle({ seed: 6 }), g = st.tiere.gecko, mia = st.gaeste[0];
  st.spieler.x = g.x; st.spieler.y = 11 * 16 + 10;
  mia.x = st.spieler.x + 30; mia.y = st.spieler.y + 10;  // aber nicht in Sprechweite
  st.gaeste[1].x = 2000;
  st.toene.length = 0;
  var vor = mia.glueck;
  st.eingabe.druecke('KeyE'); D.Spiel.schritt(st, 1 / 60); st.eingabe.ende();
  gleich(g.gestreichelt, 1, 'Gecko gestreichelt');
  wahr(st.toene.indexOf('gecko') >= 0);
  wahr(/Gecko|Dragó/.test(st.blase.text));
  gleich(mia.glueck, vor + D.Glueck.GRUND.tier.menge, 'Mia freut sich mit');
  gleich(st.gaeste[1].glueck, D.Glueck.START, 'Jonas ist zu weit weg');
  // E bei einem Gast in Sprechweite redet weiterhin zuerst
  mia.x = st.spieler.x + 10; mia.y = st.spieler.y; st.eingabe.loese('KeyE');
  st.eingabe.druecke('KeyE'); D.Spiel.schritt(st, 1 / 60); st.eingabe.ende();
  gleich(st.blase.sprecher, 'Mia', 'Gast geht vor Tier'); gleich(g.gestreichelt, 1);
});
test('Abendmusik: weiche Mischung nach Uhrzeit, Abendvariante in a-Moll und leise', function () {
  var T = ladeKontext().Dorf.Ton;
  var m = T.mischung(12, false); gleich(m.tag, 1); gleich(m.abend, 0); gleich(m.grillen, 0);
  m = T.mischung(19.25, false); nah(m.abend, 0.5, 1e-9); nah(m.tag + m.abend, 1, 1e-9); gleich(m.grillen, 0);
  m = T.mischung(21, false); gleich(m.abend, 1); nah(m.grillen, 0.5, 1e-9);
  m = T.mischung(22.5, false); gleich(m.grillen, 1);
  m = T.mischung(8, true); gleich(m.abend, 1); gleich(m.grillen, 1, 'Abendszene immer mit Grillen');
  var tonleiter = [9, 11, 0, 2, 4, 5, 7, 8];
  [0, 1].forEach(function (rd) {
    var n = T.noten(rd, 'abend');
    wahr(n.length > 20 && n.length < T.noten(1).length, 'sparsamer als am Tag');
    wahr(n.every(function (x) { return tonleiter.indexOf(x.midi % 12) >= 0 && x.staerke <= 0.5 && x.zeit >= 0 && x.zeit < 64; }), 'ruhig und in a-Moll');
  });
  var z = T.zirpen(1, 4200);
  gleich(z.length, 3); wahr(z.every(function (p) { return p.dauer < 0.05 && p.freq > 3000; }), 'kurze, hohe Zirper');
  wahr(T.LAUT.grillen <= 0.08, 'Grillen ganz leise');
});
test('Abendmusik: Ueberblenden im Ton, Grillen nur nachts, neue Effekte leise', function () {
  var T = ladeKontext().Dorf.Ton, au = fakeAudio(), win = fakeTonFenster(fakeSpeicher(), au);
  var t = T.erstelle(win); win.l.pointerdown[0]({});
  win.takte[0]();
  gleich(t.grillenGespielt, 0, 'tags keine Grillen');
  var z0 = au.log.ziele.length;
  gleich(t.tageszeit(10, false), false, 'tags nichts zu tun');
  wahr(t.tageszeit(19.25, false), 'Abend blendet ein');
  var ziele = au.log.ziele.slice(z0);
  wahr(ziele.indexOf(0.5) >= 0, 'Tag und Abend je halb');
  wahr(t.tageszeit(23, false));
  wahr(au.log.ziele.indexOf(T.LAUT.grillen) >= 0, 'Grillen eingeblendet');
  wahr(au.log.ziele.slice(z0).indexOf(0) >= 0, 'Tag ausgeblendet');
  win.takte[0]();
  wahr(t.grillenGespielt > 0, 'nachts zirpt es');
  var abHier = au.log.gains.length;
  ['herz', 'feier', 'esel', 'gecko', 'nacht'].forEach(function (n) { gleich(t.spiele(n), true, n); });
  var eff = au.log.gains.slice(abHier);
  wahr(eff.length >= 10 && eff.every(function (v) { return v <= 0.06; }), 'Effekte sehr leise');
  wahr(au.log.gains.every(function (v) { return v <= 1; }));
});
test('Render: Wiese, Esel, Gecko, Herzen im HUD und Abendfeier zeichnen ohne Fehler', function () {
  var D = ladeKontext().Dorf, st = D.Spiel.erstelle({ seed: 1 }), aufrufe = 0, texte = [];
  var ctx = new Proxy({}, { get: function (o, k) { if (k in o) return o[k]; return function () { aufrufe++; if (k === 'fillText') texte.push(arguments[0]); return { addColorStop: function () {} }; }; }, set: function (o, k, v) { o[k] = v; return true; } });
  var R = { ctx: ctx, ui: ctx, uiSkala: 1, uiCanvas: { width: 960, height: 528 } };
  st.spieler.x = 30 * 16; st.spieler.y = 15 * 16; st.kamera.x = 360; st.kamera.y = 120;
  st.herzchen.push({ x: st.tiere.esel.x, y: st.tiere.esel.y, t: 0.3 });
  D.Render.zeichne(R, st);
  wahr(texte.indexOf('Ziel: alle glücklich') >= 0, 'HUD mit Tagesziel');
  st.gaeste.forEach(function (g) { g.glueck = D.Glueck.MAX; }); D.Glueck.pruefe(st);
  st.abend = true; texte.length = 0; D.Render.zeichne(R, st);
  wahr(texte.some(function (s) { return /Alle Gäste sind glücklich/.test(s); }), 'Abendfeier');
});

// ---------- Ausfuehren ----------
tests.forEach(function (t) {
  try { t.fn(); ok++; console.log('  ok    ' + t.name); }
  catch (e) { fehler++; console.log('  FEHLER ' + t.name + '\n         ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join('\n         ') : e)); }
});
console.log('\n' + ok + ' bestanden, ' + fehler + ' fehlgeschlagen');
process.exit(fehler ? 1 : 0);
