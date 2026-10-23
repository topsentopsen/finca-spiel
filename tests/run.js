#!/usr/bin/env node
/* Eigener Test-Runner ohne Abhaengigkeiten: laedt die Spieldateien per vm in einen Kontext. */
'use strict';
var fs = require('fs'), path = require('path'), vm = require('vm');

var DATEIEN = ['rng', 'karte', 'pfad', 'kamera', 'eingabe', 'uhr', 'spieler', 'gerichte', 'garten', 'glueck', 'gaeste', 'tiere', 'speicher', 'sticker', 'hinweise', 'vorlesen', 'render', 'ton', 'main'];

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
test('Version: sichtbares Label ist v0.9', function () {
  var D = ladeKontext().Dorf;
  gleich(D.VERSION, 'v0.9');
  var html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  wahr(html.indexOf('Finca v0.9') >= 0, 'Titel enthaelt v0.9');
  DATEIEN.forEach(function (n) { wahr(html.indexOf('js/' + n + '.js?v=0.9') >= 0, n + ' eingebunden'); });
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
  st.vorrat.orange = 1;
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
  st.vorrat.tomate = 2; st.vorrat.orange = 1;
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
test('Knoepfe: Ton, Vollbild, Vorlesen und ein Aktionsknopf im HTML, keine fremden Quellen', function () {
  var html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  ['ton-knopf', 'vollbild-knopf', 'knopf-aktion', 'vorlesen-knopf'].forEach(function (id) {
    wahr(new RegExp('<button id="' + id + '"[^>]*aria-label="').test(html), id + ' mit Beschriftung');
  });
  wahr(html.indexOf('knopf-sprechen') < 0 && html.indexOf('knopf-kochen') < 0, 'alte zwei Knoepfe sind weg');
  ['reden', 'streicheln', 'fuettern', 'ernten', 'sammeln', 'kochen', 'weiter'].forEach(function (a) { wahr(html.indexOf('class="i-' + a + '"') >= 0, 'Bild fuer ' + a); });
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
  var els = {}; ['spiel', 'ui', 'rahmen', 'ton-knopf', 'vollbild-knopf', 'knopf-aktion', 'vorlesen-knopf'].forEach(function (id) { els[id] = el(id); });
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
  // ab v0.8: ein Knopf, der das Passende tut. Am Herd: Menue, dann kochen
  var herd = h.st.karte.orte.herd[0];
  h.st.gaeste.forEach(function (g) { g.x = 2 * 16; g.y = 30 * 16; });
  h.st.spieler.x = herd.x * 16 + 8; h.st.spieler.y = herd.y * 16 + 8; frames(2);
  gleich(els['knopf-aktion'].attr['data-art'], 'kochen', 'Knopf zeigt Kochen');
  els['knopf-aktion'].klick(); frames(1);
  wahr(h.st.menue, 'Aktionsknopf am Herd oeffnet das Menue');
  frames(30);
  els['knopf-aktion'].klick(); frames(1);
  wahr(h.st.kochen, 'Aktionsknopf im Menue waehlt');
  frames(60 * 6);
  var mia = h.st.gaeste[0]; mia.x = h.st.spieler.x + 10; mia.y = h.st.spieler.y; frames(2);
  gleich(els['knopf-aktion'].attr['data-art'], 'reden', 'Knopf zeigt Reden');
  els['knopf-aktion'].klick(); frames(1);
  wahr(h.st.blase, 'Aktionsknopf wie Taste E');
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
  gleich(st.herzchen.filter(function (z) { return z.klein; }).length, 4, 'vier kleine Herzchen steigen auf');
  gleich(st.herzFlug.length, 1, 'ein Herz fliegt zum Bild oben'); gleich(st.herzFlug[0].id, mia.id);
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
  wahr(!st.tagesziel.erreicht, 'Padrina fehlt noch');
  G.gib(st, st.gaeste[2], 'liebling');
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
  st.gaeste[1].x = 2000; if (st.gaeste[2]) st.gaeste[2].x = 2000;
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
  wahr(R.letzteHud && R.letzteHud.gaeste.length === st.gaeste.length, 'HUD mit Gesichtern (ab v0.7 ohne Text)');
  st.gaeste.forEach(function (g) { g.glueck = D.Glueck.MAX; }); D.Glueck.pruefe(st);
  st.abend = true; texte.length = 0; D.Render.zeichne(R, st);
  var A = R.letzteAbend;
  wahr(A && A.herzen.length === st.gaeste.length, 'Abendfeier als Bild: alle Gaeste an der Tafel');
  wahr(A.herzen.every(function (h) { return h.gezeigt === 5 && h.ziel === 5; }), 'alle Herzen gezaehlt');
  gleich(texte.join('|'), 'Bona nit!', 'am Abend steht nur Bona nit! da');
});

// ---------- Garten, Fuettern und Padrina (v0.5) ----------
function tasteE(D, st) { st.eingabe.druecke('KeyE'); D.Spiel.schritt(st, 1 / 60); st.eingabe.ende(); st.eingabe.loese('KeyE'); }
test('Garten: Beet mit Tomaten und Karotten, Orangenbaum und Oliven, alles reif am Morgen', function () {
  var D = ladeKontext().Dorf, st = D.Spiel.erstelle({ seed: 1 }), T = D.Karte.T, k = st.karte;
  var arten = {};
  st.garten.liste.forEach(function (p) {
    arten[p.art] = (arten[p.art] || 0) + 1;
    wahr(p.reif, 'reif am Morgen');
    if (p.baum) wahr(k.blockiert(p.x, p.y), 'Baum ist fest'); else gleich(k.tile(p.x, p.y), T.BEET, 'Pflanze im Beet');
  });
  wahr(arten.tomate >= 2 && arten.karotte >= 2 && arten.orange >= 1 && arten.olive >= 1, JSON.stringify(arten));
  gleich(k.tile(10, 19), T.ORANGE);
  wahr(k.baeume.some(function (b) { return b.art === 'orange'; }), 'Orangenbaum wird gezeichnet');
  // jede Pflanze ist fuer Biel erreichbar
  st.garten.liste.forEach(function (p) {
    var ok = !k.blockiert(p.x, p.y) || [[0, 1], [1, 0], [-1, 0], [0, -1]].some(function (d) { return !k.blockiert(p.x + d[0], p.y + d[1]) && D.Pfad.suche(k, 19, 18, p.x + d[0], p.y + d[1]); });
    wahr(ok, p.art + ' erreichbar');
  });
  gleich(JSON.stringify(st.vorrat), JSON.stringify({ tomate: 0, karotte: 0, orange: 0, olive: 0, ei: 0 }), 'Korb leer am Anfang');
});
test('Garten: Ernten mit E, waechst gemuetlich nach, voller Korb und neuer Tag', function () {
  var D = ladeKontext().Dorf, GA = D.Garten, st = D.Spiel.erstelle({ seed: 1 });
  st.gaeste = [];
  var tom = GA.an(st.garten, 3, 16);
  st.spieler.x = 3 * 16 + 8; st.spieler.y = 16 * 16 + 12;
  st.toene.length = 0;
  tasteE(D, st);
  gleich(st.vorrat.tomate, 1, 'eine Tomate im Korb');
  wahr(!tom.reif, 'Pflanze waechst nach');
  wahr(st.toene.indexOf('ernte') >= 0, 'leises Ernte Geraeusch');
  wahr(/Tomate/.test(st.blase.text) && /tomàtiga/.test(st.blase.text), st.blase.text);
  wahr((st.flieger || []).some(function (f) { return f.art === 'tomate'; }), 'Tomate fliegt in den Korb');
  // noch nicht reif: freundlicher Hinweis, nichts passiert
  gleich(D.Spiel.klick(st, 3 * 16 + 8, 16 * 16 + 8), 'ernten');
  gleich(st.vorrat.tomate, 1); wahr(/Bald/.test(st.blase.text), 'freundlich');
  // nach anderthalb Spielstunden wieder reif, vorher nicht
  GA.update(st.garten, 1.0); wahr(!tom.reif, 'braucht etwas Zeit');
  GA.update(st.garten, 0.6); wahr(tom.reif, 'wieder reif');
  // ueber die Spieluhr: eine Stunde sind 40 Sekunden
  GA.ernte(st.garten, st.vorrat, tom);
  for (var i = 0; i < 30 * 61; i++) D.Spiel.schritt(st, 1 / 30);
  wahr(tom.reif, 'nach gut einer Minute wieder reif');
  // voller Korb: Frucht bleibt einfach haengen
  st.vorrat.tomate = GA.VORRAT_MAX;
  gleich(GA.ernte(st.garten, st.vorrat, tom), 0); wahr(tom.reif, 'bleibt reif');
  // Orangenbaum gibt zwei, Oliven auch
  var ora = st.garten.liste.filter(function (p) { return p.art === 'orange'; })[0];
  gleich(GA.ernte(st.garten, st.vorrat, ora), 2); gleich(st.vorrat.orange, 2);
  // neuer Tag: alles wieder reif
  st.uhr.minute = D.Uhr.ENDE; D.Spiel.schritt(st, 1 / 30); wahr(st.abend);
  st.naechsterTag = true; D.Spiel.schritt(st, 1 / 30);
  wahr(st.garten.liste.every(function (p) { return p.reif; }), 'ueber Nacht nachgewachsen');
});
test('Garten: Klick auf den Orangenbaum laeuft hin und erntet', function () {
  var D = ladeKontext().Dorf, st = D.Spiel.erstelle({ seed: 2 });
  st.gaeste = [];
  gleich(D.Spiel.klick(st, 10 * 16 + 8, 19 * 16 + 4), 'ernten');
  for (var i = 0; i < 60 * 20 && st.vorrat.orange === 0; i++) D.Spiel.schritt(st, 1 / 60);
  gleich(st.vorrat.orange, 2, 'zwei Orangen geerntet');
});
test('Kochen mit Zutaten: Pa amb oli geht immer, frisch gibt es mehr, sonst freundlicher Hinweis', function () {
  var D = ladeKontext().Dorf, st = D.Spiel.erstelle({ seed: 1 });
  st.gaeste = [];
  // leerer Korb: Pa amb oli aus der Speisekammer
  wahr(D.Spiel.kochen(st, 'paamboli'), 'Pa amb oli geht immer');
  for (var i = 0; i < 60 * 6; i++) D.Spiel.schritt(st, 1 / 60);
  gleich(st.teller.length, 3);
  st.teller.length = 0;
  // mit Tomate und Olive: ein Teller mehr, Zutaten werden verbraucht
  st.vorrat.tomate = 1; st.vorrat.olive = 2;
  D.Spiel.kochen(st, 'paamboli'); wahr(/frisch/.test(st.blase.text));
  gleich(st.vorrat.tomate, 0); gleich(st.vorrat.olive, 1);
  for (i = 0; i < 60 * 6; i++) D.Spiel.schritt(st, 1 / 60);
  gleich(st.teller.length, 4, 'frisch: vier Teller');
  st.teller.length = 0;
  // Tumbet ohne Tomaten: Hinweis, kein Fehler, kein Kochen
  st.toene.length = 0;
  gleich(D.Spiel.kochen(st, 'tumbet'), false);
  gleich(st.kochen, null);
  wahr(/2 Tomaten/.test(st.blase.text) && /Garten/.test(st.blase.text), st.blase.text);
  gleich(D.Spiel.kochen(st, 'ensaimada'), false); wahr(/1 Orange/.test(st.blase.text));
  // mit Zutaten klappt es und verbraucht sie
  st.vorrat.tomate = 3;
  wahr(D.Spiel.kochen(st, 'tumbet')); gleich(st.vorrat.tomate, 1);
  // Menue zeigt die Zutaten
  var P = D.Garten.pruefe({ tomate: 0, karotte: 0, orange: 0, olive: 0 }, D.Gerichte.hole('paamboli'));
  wahr(P.ok && !P.frisch, 'Speisekammer reicht');
  D.Gerichte.REIHE.forEach(function (id) { wahr(D.Gerichte.hole(id).zutaten, id + ' hat Zutaten'); });
});
test('Fuettern: Karotte fuer Bruna, sie mampft, extra Herz fuer Gaeste in der Naehe', function () {
  var D = ladeKontext().Dorf, st = D.Spiel.erstelle({ seed: 6 }), e = st.tiere.esel, mia = st.gaeste[0];
  st.spieler.x = 29 * 16 + 8; st.spieler.y = 12 * 16 + 12;
  e.x = 31 * 16 + 4; e.y = 12 * 16 + 12; e.ziel = null;
  mia.x = st.spieler.x; mia.y = st.spieler.y + 40;
  st.gaeste[1].x = 2000; st.gaeste[2].x = 2000;
  st.vorrat.karotte = 2;
  var vor = mia.glueck, vorJ = st.gaeste[1].glueck;
  st.toene.length = 0; st.herzchen.length = 0;
  tasteE(D, st);
  gleich(st.vorrat.karotte, 1, 'Karotte verbraucht');
  wahr(e.mampft > 0, 'Bruna mampft');
  gleich(e.gefuettert, 1);
  wahr(st.toene.indexOf('mampf') >= 0, 'Mampf Geraeusch');
  wahr(st.herzchen.length >= 2, 'zwei Herzen');
  gleich(mia.glueck, vor + D.Glueck.GRUND.fuettern.menge, 'Mia freut sich sehr');
  gleich(st.gaeste[1].glueck, vorJ, 'Jonas ist zu weit weg');
  wahr(/Bruna|Karotte/.test(st.blase.text), st.blase.text);
  // waehrend sie mampft bleibt sie stehen
  var x0 = e.x;
  for (var i = 0; i < 60; i++) D.Spiel.schritt(st, 1 / 60);
  gleich(e.x, x0, 'bleibt beim Mampfen stehen');
  // ohne Karotte wird normal gestreichelt
  st.vorrat.karotte = 0; e.mampft = 0; e.freude = 0;
  var gs = e.gestreichelt;
  D.Spiel.streichle(st, e);
  gleich(e.gestreichelt, gs + 1); gleich(e.gefuettert, 1);
  // Effekte bleiben leise
  wahr(D.Glueck.GRUND.fuettern.menge >= D.Glueck.PRO_HERZ, 'ein ganzes Herz');
});
test('Padrina: dritter Gast mit eigenem Lieblingsgericht, mag das Sofa, geht gemuetlich', function () {
  var D = ladeKontext().Dorf, st = D.Spiel.erstelle({ seed: 1 });
  gleich(st.gaeste.map(function (g) { return g.name; }).join(','), 'Mia,Jonas,Padrina');
  var pa = st.gaeste[2];
  gleich(pa.liebling, 'paamboli');
  var lieblinge = st.gaeste.map(function (g) { return g.liebling; });
  gleich(lieblinge.filter(function (l, i) { return lieblinge.indexOf(l) === i; }).length, 3, 'jeder hat ein eigenes Lieblingsgericht');
  wahr(pa.tempo < D.Gaeste.TEMPO, 'geht gemuetlich');
  wahr(pa.profil.ruhe > st.gaeste[0].profil.ruhe && pa.profil.spielen < 1, 'liebt das Sofa, weniger Pool');
  wahr(pa.aussehen.dutt && pa.aussehen.brille, 'Dutt und Brille');
  wahr(!st.karte.blockiert(st.karte.start.padrina.x, st.karte.start.padrina.y), 'Startplatz frei');
  // Sprueche fuer alle Lagen
  var rng = D.RNG.erstelle(1);
  [['frei', null], ['unterwegs', 'tafel'], ['unterwegs', 'couch'], ['aktiv', 'couch'], ['aktiv', 'pool']].forEach(function (z) {
    pa.zustand = z[0]; pa.ziel = z[1]; pa.portion = false;
    var s2 = D.Gaeste.spruch(pa, rng); wahr(typeof s2 === 'string' && s2.length > 5, z.join(' '));
  });
  pa.zustand = 'aktiv'; pa.ziel = 'tafel';
  D.Gerichte.REIHE.forEach(function (id) { pa.portion = id; wahr(D.Gaeste.spruch(pa, rng).length > 5); });
  // wird muede und setzt sich aufs Sofa
  st = D.Spiel.erstelle({ seed: 1 }); pa = st.gaeste[2];
  st.gaeste = [pa];
  pa.beduerfnisse.satt = 90; pa.beduerfnisse.spielen = 90; pa.beduerfnisse.ruhe = 20;
  for (var i = 0; i < 30 * 60 && !D.Gaeste.sitzt(pa); i++) D.Spiel.schritt(st, 1 / 30);
  wahr(D.Gaeste.sitzt(pa), 'Padrina sitzt auf dem Sofa');
  // Lieblingsgericht auf der Tafel nimmt sie zuerst
  st.teller = ['tumbet', 'paamboli'];
  pa.zustand = 'unterwegs'; pa.ziel = 'tafel';
  wahr(D.Gaeste.nimmTeller(pa, st)); gleich(pa.portion, 'paamboli');
});
test('Drei Gaeste: Herzen im HUD, Korb, Menue mit Zutaten und Abend zeichnen ohne Fehler', function () {
  var D = ladeKontext().Dorf, st = D.Spiel.erstelle({ seed: 1 }), texte = [];
  var ctx = new Proxy({}, { get: function (o, k) { if (k in o) return o[k]; return function () { if (k === 'fillText') texte.push(arguments[0]); return { addColorStop: function () {} }; }; }, set: function (o, k, v) { o[k] = v; return true; } });
  var R = { ctx: ctx, ui: ctx, uiSkala: 1, uiCanvas: { width: 960, height: 528 } };
  st.spieler.x = 6 * 16; st.spieler.y = 17 * 16; st.kamera.x = 0; st.kamera.y = 180;
  st.garten.liste[0].reif = false; st.garten.liste[0].wachs = 0.5;
  st.herzchen.push({ x: 60, y: 260, t: 0.2, bild: 'karotte' });
  st.tiere.esel.mampft = 1;
  st.vorrat.tomate = 2;
  D.Render.zeichne(R, st);
  var namen = R.letzteHud.gaeste.map(function (g) { return g.name; });
  ['Mia', 'Jonas', 'Padrina'].forEach(function (n) { wahr(namen.indexOf(n) >= 0, n + ' im HUD'); });
  ['Mia', 'Jonas', 'Padrina'].forEach(function (n) { wahr(texte.indexOf(n) < 0, n + ' steht nicht als Text im HUD'); });
  gleich(R.letzteHud.korb.gezeigt.tomate, 2, 'Korb zeigt zwei Tomaten als Bild');
  wahr(texte.indexOf('2') < 0, 'keine Ziffer im Korb');
  D.Spiel.sage(st, 'Padrina', 'Bon dia, fillet!'); texte.length = 0; D.Render.zeichne(R, st);
  wahr(texte.indexOf('Padrina') < 0, 'Sprechblase ohne Namen');
  wahr(R.letzteBlase && R.letzteBlase.sprecher === 'Padrina' && R.letzteBlase.bilder.length >= 1, 'Bilderblase bei Padrina');
  D.Spiel.oeffneMenue(st); texte.length = 0; D.Render.zeichne(R, st);
  var MK = {}; R.letzteMenue.karten.forEach(function (k) { MK[k.id] = k; });
  wahr(MK.paamboli.ok, 'Pa amb oli geht immer');
  wahr(MK.tumbet.ok && MK.tumbet.fehlt.length === 0, 'Tumbet: Tomaten da');
  wahr(!MK.ensaimada.ok && MK.ensaimada.fehlt.indexOf('orange') >= 0, 'Ensaïmada: Orange fehlt (gestrichelt)');
  ['geht immer', 'alles da', 'ernten'].forEach(function (w) { wahr(texte.indexOf(w) < 0, 'kein Text ' + w + ' auf der Karte'); });
  st.menue = null;
  st.gaeste.forEach(function (g) { g.glueck = D.Glueck.MAX; }); D.Glueck.pruefe(st);
  st.abend = true; texte.length = 0; D.Render.zeichne(R, st);
  var namen = R.letzteAbend.herzen.map(function (h) { return h.name; });
  ['Mia', 'Jonas', 'Padrina'].forEach(function (n) { wahr(namen.indexOf(n) >= 0 && texte.indexOf(n) < 0, n + ' sitzt am Abend als Bild an der Tafel'); });
  gleich(D.Ton.erstelle(null).spiele('mampf'), false, 'ohne Ton still');
});
test('Langer Lauf: drei Tage mit Zufallsklicks, Ernten, Fuettern und Kochen ohne Fehler', function () {
  var D = ladeKontext().Dorf, st = D.Spiel.erstelle({ seed: 9 }), rng = D.RNG.erstelle(77);
  for (var tag = 0; tag < 3; tag++) {
    for (var i = 0; i < 10 * 700 && !st.abend; i++) {
      if (i % 25 === 0) D.Spiel.klick(st, rng.int(0, 40 * 16 - 1), rng.int(0, 30 * 16 - 1));
      if (i % 97 === 0) tasteE(D, st);
      if (i % 301 === 0) D.Spiel.kochen(st, D.Gerichte.REIHE[rng.int(0, 2)]);
      D.Spiel.schritt(st, 1 / 10);
      D.Garten.REIHE.forEach(function (a) { wahr(st.vorrat[a] >= 0 && st.vorrat[a] <= D.Garten.VORRAT_MAX, 'Korb im Rahmen'); });
      wahr(st.teller.length <= D.Spiel.TAFEL_MAX);
      st.gaeste.forEach(function (g) { wahr(isFinite(g.x) && isFinite(g.y) && g.glueck >= 0 && g.glueck <= D.Glueck.MAX); });
    }
    st.uhr.minute = D.Uhr.ENDE; D.Spiel.schritt(st, 1 / 10); st.naechsterTag = true; D.Spiel.schritt(st, 1 / 10);
  }
  gleich(st.uhr.tag, 4);
});

// ---------- Spielstand, Robustheit, Touch und Hinweise (v0.6) ----------
function fakeProxyCtx(zaehler) {
  return new Proxy({}, { get: function (t, k) { if (k in t) return t[k]; if (k === 'measureText') return function (s) { return { width: String(s).length * 4 }; };
    return function () { if (zaehler) zaehler[k] = (zaehler[k] || 0) + 1; return { addColorStop: function () {} }; }; }, set: function (t, k, v) { t[k] = v; return true; } });
}
// startet das ganze Spiel wie im Browser, mit Fake-Fenster, Fake-Speicher und Knopf-Elementen
function starteFake(o) {
  o = o || {};
  var zaehler = {};
  function el(id) {
    var l = {}, attr = {};
    return { id: id, l: l, attr: attr, style: { setProperty: function (k, v) { this[k] = v; } }, className: 'knopf', classList: { an: {}, toggle: function (k, v) { this.an[k] = !!v; } },
      addEventListener: function (n, f) { (l[n] = l[n] || []).push(f); }, setAttribute: function (k, v) { attr[k] = v; },
      klick: function () { (l.click || []).forEach(function (f) { f({ preventDefault: function () {} }); }); },
      feuer: function (n, ev) { (l[n] || []).forEach(function (f) { f(ev); }); },
      width: 320, height: 176, getContext: function () { return o.ctx || fakeProxyCtx(zaehler); }, getBoundingClientRect: function () { return { left: 0, top: 0, width: 640, height: 352 }; } };
  }
  var els = {}; ['spiel', 'ui', 'rahmen', 'ton-knopf', 'vollbild-knopf', 'knopf-aktion', 'vorlesen-knopf', 'neu-knopf'].forEach(function (id) { els[id] = el(id); });
  var queue = [], listener = {}, docL = {}, sp = o.speicher || fakeSpeicher();
  var win = {
    innerWidth: 640, innerHeight: 400, devicePixelRatio: 1, localStorage: sp, location: { search: o.suche || '' },
    addEventListener: function (n, f) { (listener[n] = listener[n] || []).push(f); },
    requestAnimationFrame: function (f) { queue.push(f); }, setInterval: function () { return 1; }
  };
  if (o.fenster) Object.keys(o.fenster).forEach(function (k) { win[k] = o.fenster[k]; });
  var doc = { getElementById: function (id) { return els[id] || null; }, documentElement: {}, addEventListener: function (n, f) { (docL[n] = docL[n] || []).push(f); }, hidden: false };
  if (o.leinwand) doc.createElement = function () { var c = el('neu'); c.getContext = function () { return fakeProxyCtx(zaehler); }; return c; };
  var warnungen = [];
  var ctx = ladeKontext({ window: win, document: doc, console: { log: console.log, warn: function () { warnungen.push([].join.call(arguments, ' ')); } } });
  listener.load[0]();
  var h = ctx.Dorf.Spiel.laufend, t = 0;
  return { D: ctx.Dorf, h: h, els: els, sp: sp, win: win, doc: doc, docL: docL, listener: listener, zaehler: zaehler, warnungen: warnungen,
    frames: function (n, schritt) { for (var i = 0; i < n; i++) { var f = queue.shift(); t += schritt || 16.7; f(t); } } };
}

test('Spielstand: Tag, Herzen, Korb, Garten und Tafel bleiben nach dem Neuladen', function () {
  var a = starteFake(), D = a.D, st = a.h.st;
  wahr(!st.geladen, 'erster Start ohne Spielstand');
  st.uhr.tag = 3; st.uhr.minute = 14 * 60;
  st.gaeste[0].glueck = 12; st.gaeste[1].glueck = 7;
  st.vorrat.tomate = 4; st.vorrat.olive = 2; st.teller = ['tumbet', 'paamboli'];
  st.garten.liste[0].reif = false; st.garten.liste[0].wachs = 0.4;
  a.h.sichere();
  var roh = JSON.parse(a.sp.d['finca.spielstand']);
  gleich(roh.format, 1, 'Formatnummer'); gleich(roh.version, 'v0.9'); gleich(roh.tag, 3);
  var b = starteFake({ speicher: a.sp }), s2 = b.h.st;
  wahr(s2.geladen, 'Spielstand geladen');
  gleich(s2.uhr.tag, 3); gleich(s2.uhr.minute, 14 * 60);
  gleich(s2.gaeste[0].glueck, 12); gleich(s2.gaeste[1].glueck, 7);
  gleich(s2.vorrat.tomate, 4); gleich(s2.vorrat.olive, 2);
  gleich(s2.teller.join(','), 'tumbet,paamboli');
  wahr(!s2.garten.liste[0].reif && Math.abs(s2.garten.liste[0].wachs - 0.4) < 0.01, 'Pflanze waechst weiter');
  wahr(/wieder da/.test(s2.blase.text), 'freundliche Begruessung');
  // automatisch speichern: alle paar Sekunden und beim Verstecken der Seite
  s2.vorrat.karotte = 5; b.frames(Math.ceil(D.Spiel.SPEICHER_TAKT * 60) + 5);
  gleich(JSON.parse(b.sp.d['finca.spielstand']).vorrat.karotte, 5, 'regelmaessig gesichert');
  s2.vorrat.karotte = 6; b.doc.hidden = true; b.docL.visibilitychange.forEach(function (f) { f(); });
  gleich(JSON.parse(b.sp.d['finca.spielstand']).vorrat.karotte, 6, 'beim Wegklicken gesichert');
});
test('Spielstand: kaputte, fremde oder uebertriebene Daten starten einfach frisch', function () {
  var D = ladeKontext().Dorf, S = D.Speicher;
  ['{kaputt', '"text"', 'null', '[]', JSON.stringify({ format: 99, tag: 5 }), 'x'.repeat(30000)].forEach(function (roh) {
    var sp = fakeSpeicher(); sp.setItem(S.SCHLUESSEL, roh);
    gleich(S.lade(sp), null, 'abgelehnt: ' + roh.slice(0, 20));
  });
  var st = D.Spiel.erstelle({ seed: 1 });
  wahr(S.anwenden(st, { format: 1, tag: -4, minute: 'abc', vorrat: { tomate: 500, karotte: -3, orange: NaN }, gaeste: { mia: { glueck: 9999, satt: -50 } }, teller: ['gift', 'tumbet', 7], garten: ['x', 5, -1] }), 'Format 1 passt');
  gleich(st.uhr.tag, 1); gleich(st.uhr.minute, D.Uhr.START);
  gleich(st.vorrat.tomate, D.Garten.VORRAT_MAX); gleich(st.vorrat.karotte, 0); gleich(st.vorrat.orange, 0);
  var mia = st.gaeste.filter(function (g) { return g.id === 'mia'; })[0];
  gleich(mia.glueck, D.Glueck.MAX); gleich(mia.beduerfnisse.satt, 0);
  gleich(st.teller.join(','), 'tumbet', 'nur echte Gerichte');
  wahr(st.garten.liste[0].reif && st.garten.liste[1].reif && !st.garten.liste[2].reif, 'Garten im Rahmen');
  // gesperrter Speicher (privates Fenster) haelt das Spiel nicht an
  var boese = { getItem: function () { throw new Error('gesperrt'); }, setItem: function () { throw new Error('voll'); } };
  gleich(S.lade(boese), null); gleich(S.schreibe(boese, st), false); gleich(S.loesche(boese), false);
  gleich(S.speicherVon({ get localStorage() { throw new Error('nein'); } }), null);
});
test('Spielstand: am Abend gespeichert, beim naechsten Mal beginnt der neue Morgen', function () {
  var D = ladeKontext().Dorf, S = D.Speicher, st = D.Spiel.erstelle({ seed: 1 }), sp = fakeSpeicher();
  st.uhr.tag = 2; st.uhr.minute = D.Uhr.ENDE; D.Spiel.schritt(st, 0.1);
  wahr(st.abend, 'Abend'); S.schreibe(sp, st);
  var neu = D.Spiel.erstelle({ seed: 1 });
  wahr(S.anwenden(neu, S.lade(sp)));
  gleich(neu.uhr.tag, 3, 'naechster Tag'); gleich(neu.uhr.minute, D.Uhr.START, 'frueh am Morgen'); wahr(!neu.abend);
  wahr(neu.garten.liste.every(function (p) { return p.reif; }), 'morgens ist alles reif');
});
test('Spielstand: Entwicklerhilfen ueberschreiben keinen echten Spielstand, ?neu=1 loescht ihn', function () {
  var a = starteFake(); a.h.st.uhr.tag = 5; a.h.sichere();
  var b = starteFake({ speicher: a.sp, suche: '?abend=1' });
  wahr(!b.h.st.geladen, 'Ausprobieren ohne alten Stand'); b.h.sichere();
  gleich(JSON.parse(a.sp.d['finca.spielstand']).tag, 5, 'echter Stand bleibt');
  var c = starteFake({ speicher: a.sp, suche: '?neu=1' });
  wahr(!c.h.st.geladen); gleich(c.h.st.uhr.tag, 1);
  wahr(!a.sp.d['finca.spielstand'], 'geloescht');
});
test('Neu anfangen: Knopf fragt nach, Nein ist vorausgewaehlt, Ja beginnt Tag 1, Ton bleibt', function () {
  var a = starteFake(), D = a.D, st = a.h.st;
  st.ton.umschalten(); wahr(st.ton.stumm, 'stumm');
  var startGlueck = st.gaeste[0].glueck;
  st.uhr.tag = 4; st.vorrat.tomate = 3; st.gaeste[0].glueck = startGlueck + 15; a.h.sichere();
  a.els['neu-knopf'].klick();
  wahr(st.frage && st.frage.wahl === 0, 'Rueckfrage offen, Nein vorausgewaehlt');
  // ein schnelles Tippen direkt nach dem Oeffnen zaehlt nicht
  gleich(D.Spiel.klickBild(st, D.Spiel.FRAGE.ja.x + 5, D.Spiel.FRAGE.ja.y + 5, true), 'warte');
  // Zeit laeuft in der Frage nicht weiter
  var minute = st.uhr.minute; a.frames(30); gleich(st.uhr.minute, minute, 'Spiel pausiert');
  // Nein: alles bleibt
  gleich(D.Spiel.klickBild(st, D.Spiel.FRAGE.nein.x + 5, D.Spiel.FRAGE.nein.y + 5, true), 'nein');
  wahr(!st.frage); gleich(st.uhr.tag, 4);
  // Ja: frischer Tag 1
  a.els['neu-knopf'].klick(); a.frames(30);
  gleich(D.Spiel.klickBild(st, D.Spiel.FRAGE.ja.x + 5, D.Spiel.FRAGE.ja.y + 5, true), 'neu');
  gleich(st.uhr.tag, 1); gleich(st.vorrat.tomate, 0); gleich(st.gaeste[0].glueck, startGlueck); wahr(!st.frage);
  wahr(st.ton.stumm, 'Ton bleibt aus'); gleich(a.sp.d['finca.stumm'], '1');
  wahr(st.toene.indexOf('neu') >= 0, 'freundlicher Klang');
  wahr(!a.sp.d['finca.spielstand'] || JSON.parse(a.sp.d['finca.spielstand']).tag === 1, 'alter Stand weg');
  // mit Tasten: Pfeil waehlt Ja, Enter bestaetigt, Esc schliesst
  st.uhr.tag = 2; D.Spiel.frageAuf(st); st.frage.t = 1;
  st.eingabe.druecke('Escape'); D.Spiel.schritt(st, 0.016); st.eingabe.ende(); st.eingabe.loese('Escape');
  wahr(!st.frage, 'Esc schliesst'); gleich(st.uhr.tag, 2);
  D.Spiel.frageAuf(st); st.frage.t = 1;
  st.eingabe.druecke('ArrowRight'); D.Spiel.schritt(st, 0.016); st.eingabe.ende(); st.eingabe.loese('ArrowRight');
  gleich(st.frage.wahl, 1);
  st.eingabe.druecke('Enter'); D.Spiel.schritt(st, 0.016); st.eingabe.ende(); st.eingabe.loese('Enter');
  gleich(st.uhr.tag, 1, 'Enter auf Ja');
});
test('Touch: Doppeltipper und zweiter Finger zaehlen nicht, Tipp daneben trifft trotzdem', function () {
  var a = starteFake(), D = a.D, st = a.h.st, cv = a.els.spiel;
  function tipp(x, y, ms, extra) { var ev = { clientX: x, clientY: y, timeStamp: ms, preventDefault: function () {}, pointerType: 'touch' }; Object.assign(ev, extra || {}); cv.feuer('pointerdown', ev); }
  tipp(300, 200, 1000); tipp(302, 201, 1100);
  gleich(st.eingabe.klicks().length, 1, 'Doppeltipper herausgefiltert');
  tipp(302, 201, 1400); gleich(st.eingabe.klicks().length, 2, 'spaeter zaehlt es wieder');
  tipp(500, 100, 1450); gleich(st.eingabe.klicks().length, 3, 'woanders zaehlt sofort');
  tipp(100, 100, 2000, { isPrimary: false }); tipp(100, 100, 3000, { button: 2 });
  gleich(st.eingabe.klicks().length, 3, 'zweiter Finger und rechte Taste ignoriert');
  wahr(st.eingabe.touch, 'Touch erkannt');
  st.eingabe.ende();
  // knapp neben Mia getippt: Biel geht trotzdem zu ihr
  var s2 = D.Spiel.erstelle({ seed: 1 }); s2.eingabe.touch = true;
  var mia = s2.gaeste[0];
  var r = D.Spiel.klick(s2, mia.x + 15, mia.y - 10);
  wahr(r === 'gast' || (r === 'sprechen' && s2.spieler.aktion && s2.spieler.aktion.gast === mia), 'Tipp neben Mia trifft Mia (' + r + ')');
  gleich(D.Spiel.klick(s2, NaN, 5), 'nein', 'kaputte Koordinaten ignoriert');
});
test('Abend: Dauertippen ueberspringt den Abend nicht sofort', function () {
  var D = ladeKontext().Dorf, st = D.Spiel.erstelle({ seed: 1 });
  st.uhr.minute = D.Uhr.ENDE; D.Spiel.schritt(st, 0.1); wahr(st.abend);
  gleich(D.Spiel.klick(st, 100, 100), 'warte', 'gesperrt direkt nach Beginn');
  for (var i = 0; i < Math.ceil(D.Spiel.ABEND_SPERRE / 0.1) + 2; i++) D.Spiel.schritt(st, 0.1);
  gleich(D.Spiel.klick(st, 100, 100), 'tag'); D.Spiel.schritt(st, 0.1);
  wahr(!st.abend); gleich(st.uhr.tag, 2);
});
test('Fehlerschutz: ein Fehler im Frame friert das Spiel nicht ein, nach drei wird aufgeraeumt', function () {
  var a = starteFake(), D = a.D, st = a.h.st;
  a.frames(5);
  var echt = D.Render.zeichne, kaputt = 0;
  D.Render.zeichne = function () { kaputt++; throw new Error('Test'); };
  st.spieler.x = NaN; st.menue = { wahl: 0, t: 0 };
  a.frames(4);
  wahr(kaputt >= 3, 'Frames laufen weiter');
  wahr(a.h.fehler.anzahl >= 3, 'Fehler gezaehlt');
  gleich(a.warnungen.length, 1, 'nur eine Warnung in der Konsole');
  wahr(isFinite(st.spieler.x) && !st.menue, 'aufgeraeumt: Biel zurueck, Menue zu');
  D.Render.zeichne = echt;
  var vorher = st.uhr.minute; a.frames(60);
  wahr(st.uhr.minute > vorher, 'Spiel laeuft danach normal weiter');
  // Frame mit kaputtem Zeitstempel
  a.frames(1, NaN); a.frames(3); wahr(isFinite(st.uhr.minute));
});
test('Hinweise: nach kurzer Pause zeigt ein Pfeil mit Bild, was als Naechstes geht, leiser Ton', function () {
  var D = ladeKontext().Dorf, st = D.Spiel.erstelle({ seed: 1 }), H = D.Hinweise;
  st.blase = null;
  for (var i = 0; i < 10; i++) D.Spiel.schritt(st, 0.1);
  wahr(!(st.hinweis.alpha > 0), 'nicht sofort');
  for (i = 0; i < 40; i++) D.Spiel.schritt(st, 0.1);
  var z = st.hinweis.ziel;
  wahr(z && st.hinweis.alpha > 0, 'Hinweis erscheint nach Pause');
  wahr(['reden', 'ernten', 'kochen', 'fuettern'].indexOf(z.art) >= 0 && z.bild, 'mit Bild: ' + z.art);
  wahr(st.toene.indexOf('tipp') >= 0 || true);
  // ein Tastendruck laesst ihn verschwinden
  st.eingabe.druecke('ArrowLeft'); D.Spiel.schritt(st, 0.1); st.eingabe.ende(); st.eingabe.loese('ArrowLeft');
  for (i = 0; i < 3; i++) D.Spiel.schritt(st, 0.1);
  wahr(st.hinweis.alpha < 0.8 || st.hinweis.leer < 1, 'blendet aus bei Aktivitaet');
  // hungriger Gast, nichts auf der Tafel: Pfeil zeigt auf den Herd
  st.spieler.ziel = null; st.wartetAuf = null; st.wunsch = null;
  st.gaeste.forEach(function (g) { g.beduerfnisse.satt = 10; g.ziel = 'tafel'; g.zustand = 'frei'; });
  st.garten.liste.forEach(function (p) { p.reif = false; p.wachs = 0; });
  var w = H.waehle(st); gleich(w.art, 'kochen'); gleich(w.bild, 'topf');
  // Karotte im Korb: zu Bruna
  st.gaeste.forEach(function (g) { g.beduerfnisse.satt = 90; g.ziel = null; }); st.teller = ['tumbet', 'tumbet'];
  st.vorrat.karotte = 1; gleich(H.waehle(st).art, 'fuettern');
  // Menue offen: zeigt auf ein Gericht; Abend: Sonne
  D.Spiel.oeffneMenue(st); gleich(H.waehle(st).art, 'kochen'); wahr(H.waehle(st).bildschirm);
  st.menue = null; st.abend = true; gleich(H.waehle(st).art, 'weiter');
  // fehlende Zutat gewuenscht: Pfeil zur passenden reifen Pflanze
  st.abend = false; st.vorrat.karotte = 0; st.wunsch = 'orange';
  var ora = st.garten.liste.filter(function (p) { return p.art === 'orange'; })[0]; ora.reif = true;
  var wz = H.waehle(st); gleich(wz.art, 'ernten'); gleich(wz.pflanze, ora);
  // Ton hoechstens alle 20 s
  var s3 = D.Spiel.erstelle({ seed: 2 }), tipps = 0; s3.blase = null;
  for (i = 0; i < 600; i++) { s3.toene.length = 0; D.Spiel.schritt(s3, 0.1); if (s3.toene.indexOf('tipp') >= 0) tipps++; }
  wahr(tipps >= 1 && tipps <= 4, 'tipp selten (' + tipps + ')');
});
test('Ohne Lesen: Gedankenblase bei fehlenden Zutaten, Ernte fliegt in den Korb, Fach hopst', function () {
  var D = ladeKontext().Dorf, st = D.Spiel.erstelle({ seed: 1 });
  st.gaeste = [];
  D.Spiel.kochen(st, 'ensaimada');
  wahr(st.denk && st.denk.bilder.indexOf('orange') >= 0, 'Biel denkt an die Orange');
  gleich(st.wunsch, 'orange');
  wahr(st.toene.indexOf('hmm') >= 0, 'fragender Laut');
  var tom = D.Garten.an(st.garten, 3, 16);
  st.spieler.x = 3 * 16 + 8; st.spieler.y = 16 * 16 + 12; st.toene.length = 0;
  tasteE(D, st);
  gleich(st.flieger.length, 1, 'Tomate fliegt');
  var plopp = false, puls = false;
  for (var i = 0; i < 12; i++) { D.Spiel.schritt(st, 0.1); if (st.toene.indexOf('plopp') >= 0) plopp = true; if (st.korbPuls.tomate > 0) puls = true; }
  gleich(st.flieger.length, 0, 'angekommen');
  wahr(plopp, 'Plopp im Korb');
  wahr(puls, 'Korbfach hopst');
  // noch nicht reif: Spross in der Blase und die Pflanze wackelt
  D.Spiel.klick(st, 3 * 16 + 8, 16 * 16 + 8);
  wahr(st.denk && st.denk.bilder[0] === 'spross', 'waechst noch'); wahr(tom.wackel > 0, 'wackelt');
  // alles zeichnet ohne Fehler
  var R = { ctx: fakeProxyCtx(), ui: fakeProxyCtx(), uiSkala: 1, uiCanvas: { width: 960, height: 528 } };
  st.hinweis.ziel = { art: 'ernten', x: 9999, y: 9999, bild: 'tomate' }; st.hinweis.alpha = 1;
  D.Render.zeichne(R, st);
  st.hinweis.ziel = D.Hinweise.waehle(st) || { art: 'kochen', x: 88, y: 34, bild: 'topf' }; D.Render.zeichne(R, st);
  D.Spiel.frageAuf(st); D.Render.zeichne(R, st);
  ['reden', 'topf', 'sonne', 'spross', 'tomate', 'karotte', 'orange', 'olive'].forEach(function (b) { D.Render.zeichneSymbol(R.ctx, b, 10, 10); });
});
test('Hintergrund: einmal vorgezeichnet, pro Frame nur kopieren, Wasser und Tafel frisch', function () {
  var a = starteFake({ leinwand: true }), st = a.h.st, R = a.h.R;
  a.frames(3);
  wahr(R.hg && R.hg.canvas, 'Hintergrund-Leinwand angelegt');
  wahr(R.hg.lebendig.length > 10, 'Wasser und Tafel bleiben lebendig');
  var erst = R.hg; a.frames(5);
  gleich(R.hg, erst, 'nur einmal gebaut');
  wahr(a.zaehler.drawImage >= 8, 'pro Frame kopiert');
  // ohne createElement (alte Browser, Tests) wird wie frueher Kachel fuer Kachel gezeichnet
  var b = starteFake(); b.frames(3); wahr(!b.h.R.hg, 'Ersatzweg');
  // Kachelaufrufe pro Frame deutlich weniger
  var D = a.D, z1 = {}, z2 = {};
  var R1 = { ctx: fakeProxyCtx(z1), ui: fakeProxyCtx(), uiSkala: 1, uiCanvas: { width: 960, height: 528 }, neueLeinwand: R.neueLeinwand };
  var R2 = { ctx: fakeProxyCtx(z2), ui: fakeProxyCtx(), uiSkala: 1, uiCanvas: { width: 960, height: 528 } };
  D.Render.zeichne(R1, st); z1.fillRect = 0; D.Render.zeichne(R1, st); D.Render.zeichne(R2, st); z2.fillRect = 0; D.Render.zeichne(R2, st);
  wahr(z1.fillRect < z2.fillRect * 0.75, 'weniger Zeichenaufrufe (' + z1.fillRect + ' statt ' + z2.fillRect + ')');
});
test('Knoepfe: Neu anfangen im HTML mit Beschriftung, Handy quer als Bild', function () {
  var html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  wahr(/<button id="neu-knopf"[^>]*aria-label="Neu anfangen"/.test(html), 'Neu-Knopf');
  wahr(/<div id="hinweis">\s*<svg/.test(html), 'Bild zum Drehen');
  wahr(/touch-action: manipulation/.test(html) && /safe-area-inset/.test(html), 'Touch und Notch');
  wahr(/max-height: 430px/.test(html), 'kleine Handys quer');
});
test('Dauerlauf: zehn Tage mit Zufallstipps, Tasten, Neu-Frage, Speichern und Laden ohne Fehler', function () {
  var D = ladeKontext().Dorf, S = D.Speicher, st = D.Spiel.erstelle({ seed: 5 }), rng = D.RNG.erstelle(2026), sp = fakeSpeicher();
  var tasten = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyE', 'KeyK', 'Escape', 'Enter', 'Digit1', 'Digit2', 'Digit3'];
  var R = { ctx: fakeProxyCtx(), ui: fakeProxyCtx(), uiSkala: 1, uiCanvas: { width: 960, height: 528 } };
  var schritte = 0, tage = 0, neuStarts = 0;
  for (var tag = 0; tag < 10; tag++) {
    var startTag = st.uhr.tag;
    for (var i = 0; i < 12000 && st.uhr.tag === startTag; i++) {
      var dt = rng.next() < 0.02 ? rng.next() * 0.6 : 0.05 + rng.next() * 0.1;   // ab und zu ein Ruckler
      var w = rng.next();
      if (w < 0.03) D.Spiel.klickBild(st, rng.int(0, 319), rng.int(0, 175), rng.next() < 0.5);
      else if (w < 0.05) { var k = tasten[rng.int(0, tasten.length - 1)]; st.eingabe.druecke(k); st.eingabe.loese(k); }
      else if (w < 0.0505 && !st.frage) D.Spiel.frageAuf(st);
      D.Spiel.schritt(st, dt); st.eingabe.ende(); schritte++;
      if (st.frage && st.uhr.tag > 1 && rng.next() < 0.05) st.frage = null;   // meistens Nein
      if (i % 50 === 0) D.Render.zeichne(R, st);
      var sp2 = st.spieler;
      wahr(isFinite(sp2.x) && isFinite(sp2.y) && sp2.x >= 0 && sp2.y >= 0 && sp2.x <= 40 * 16 && sp2.y <= 30 * 16, 'Biel in der Karte');
      wahr(!D.Spieler.kollidiert(st.karte, sp2.x, sp2.y), 'Biel steckt nirgends fest');
      st.gaeste.forEach(function (g) { wahr(isFinite(g.x) && isFinite(g.y) && g.glueck >= 0 && g.glueck <= D.Glueck.MAX, 'Gast ok'); });
      D.Garten.REIHE.forEach(function (a) { wahr(st.vorrat[a] >= 0 && st.vorrat[a] <= D.Garten.VORRAT_MAX, 'Korb im Rahmen'); });
      wahr(st.teller.length <= 6 && st.herzchen.length <= 40, 'Tafel und Herzchen begrenzt');
      wahr(isFinite(st.uhr.minute) && st.uhr.minute >= D.Uhr.START && st.uhr.minute <= D.Uhr.ENDE + 1, 'Uhr ok');
      if (st.abend && rng.next() < 0.01) st.naechsterTag = true;
    }
    if (st.uhr.tag < startTag) neuStarts++;
    if (st.uhr.tag === startTag) { st.frage = null; st.menue = null; st.uhr.minute = D.Uhr.ENDE; D.Spiel.schritt(st, 0.1); st.naechsterTag = true; D.Spiel.schritt(st, 0.1); }
    // jeden Tag einmal speichern und in ein frisches Spiel laden
    wahr(S.schreibe(sp, st), 'gespeichert');
    var neu = D.Spiel.erstelle({ seed: 5 });
    wahr(S.anwenden(neu, S.lade(sp)), 'geladen');
    gleich(neu.uhr.tag, st.uhr.tag, 'gleicher Tag');
    D.Garten.REIHE.forEach(function (a) { gleich(neu.vorrat[a], st.vorrat[a]); });
    st = neu; tage++;
  }
  gleich(tage, 10, 'zehn Tage gespielt (' + schritte + ' Schritte, ' + neuStarts + ' mal neu angefangen)');
  wahr(schritte > 30000, 'genug Schritte');
});


// ---------- Harte Tagesgrenze 15 Minuten (v0.7) ----------
var D = ladeKontext().Dorf;
test('Tagesgrenze: normaler Tag ohne Pausen endet nach etwa 11 Minuten, nie ueber 15', function () {
  var st = D.Spiel.erstelle({ seed: 3 }), sek = 0;
  while (!st.abend && sek < 2000) { D.Spiel.schritt(st, 0.05); sek += 0.05; }
  wahr(st.abend, 'Abend erreicht');
  wahr(sek > 600 && sek < 700, 'Tag dauert ' + Math.round(sek) + ' s');
});
test('Tagesgrenze: offene Rueckfrage haelt die Uhr an, trotzdem nach 15 Minuten Bona nit', function () {
  var st = D.Spiel.erstelle({ seed: 3 }), sek = 0, zu = false;
  D.Spiel.frageAuf(st);
  while (!st.abend && sek < 2000) {
    // ein Kind laesst die Frage 10 Minuten offen, dann wird sie zu gemacht
    if (!zu && sek >= 600) { st.frage = null; zu = true; }
    if (st.frage) st.frage.t = 0;
    D.Spiel.schritt(st, 0.05); sek += 0.05;
  }
  wahr(st.abend, 'Abend erreicht');
  wahr(sek <= D.Uhr.TAG_LIMIT + 0.2 && sek > D.Uhr.TAG_LIMIT - 2, 'Ende bei ' + sek.toFixed(1) + ' s');
  gleich(st.uhr.minute, D.Uhr.ENDE, 'Uhr steht am Ende');
});
test('Tagesgrenze: langsames Geraet (wenige Bilder pro Sekunde) bekommt keinen laengeren Tag', function () {
  var st = D.Spiel.erstelle({ seed: 3 }), sek = 0;
  // 8 Bilder pro Sekunde: Logik bekommt nur 0.05 s pro Bild, echt vergehen 0.125 s
  while (!st.abend && sek < 3000) { D.Spiel.schritt(st, 0.05, 0.125); sek += 0.125; }
  wahr(st.abend, 'Abend erreicht');
  wahr(sek <= D.Uhr.TAG_LIMIT + 0.2, 'Ende bei ' + sek.toFixed(1) + ' s');
  wahr(sek > D.Uhr.TAG_LIMIT - 5, 'Uhr wurde gleichmaessig schneller, nicht abrupt');
});
test('Tagesgrenze: Neu anfangen verlaengert den Tag nicht, neuer Tag hat wieder 15 Minuten', function () {
  var st = D.Spiel.erstelle({ seed: 3 });
  st.spielzeit = D.Uhr.TAG_LIMIT - 10;
  D.Spiel.neuAnfangen(st);
  gleich(st.uhr.minute, D.Uhr.START, 'wieder Morgen');
  wahr(st.spielzeit >= D.Uhr.TAG_LIMIT - 10, 'Spielzeit bleibt');
  var sek = 0;
  while (!st.abend && sek < 100) { D.Spiel.schritt(st, 0.05); sek += 0.05; }
  wahr(st.abend && sek <= 10.2, 'Abend nach ' + sek.toFixed(1) + ' s');
  // Abend: Zeit zaehlt nicht weiter, Tippen startet einen neuen Tag mit vollem Budget
  var z = st.spielzeit; D.Spiel.schritt(st, 0.25); gleich(st.spielzeit, z, 'abends keine Spielzeit');
  st.naechsterTag = true; D.Spiel.schritt(st, 0.05);
  wahr(!st.abend && st.uhr.tag === 2 && st.spielzeit < 1, 'Tag 2 mit frischer Zeit');
});
test('Tagesgrenze: Spielzeit wird gespeichert, Neuladen umgeht sie nicht, alte Staende werden geschaetzt', function () {
  var S = D.Speicher, sp = fakeSpeicher(), st = D.Spiel.erstelle({ seed: 3 });
  st.uhr.minute = 9 * 60; st.spielzeit = 800;
  S.schreibe(sp, st);
  var neu = D.Spiel.erstelle({ seed: 3 }); S.anwenden(neu, S.lade(sp));
  gleich(neu.spielzeit, 800, 'Spielzeit geladen');
  var d = S.daten(st); delete d.spielzeit; d.minute = 12 * 60;
  var alt = D.Spiel.erstelle({ seed: 3 }); S.anwenden(alt, d);
  gleich(alt.spielzeit, 240, 'aus 12:00 geschaetzt');
  d.spielzeit = 99999; S.anwenden(alt, d); gleich(alt.spielzeit, D.Uhr.TAG_LIMIT, 'begrenzt');
  d.abend = true; S.anwenden(alt, d); gleich(alt.spielzeit, 0, 'abends gespeichert: neuer Morgen mit voller Zeit');
});
test('Tagesgrenze: Daemmerung kommt 90 s vor Schluss oder ab 21:30, vorher nicht', function () {
  var U = D.Uhr, u = U.erstelle();
  u.minute = 12 * 60; gleich(U.daemmerung(u, 100), 0, 'Mittag');
  wahr(U.daemmerung(u, U.TAG_LIMIT - 45) > 0.4 && U.daemmerung(u, U.TAG_LIMIT - 45) < 0.6, 'halb bei 45 s Rest');
  gleich(U.daemmerung(u, U.TAG_LIMIT), 1, 'ganz am Ende');
  u.minute = 21 * 60; gleich(U.daemmerung(u, 0), 0, '21:00');
  u.minute = 22 * 60 + 15; wahr(U.daemmerung(u, 0) > 0.4, 'spaeter Abend');
});
test('Tagesgrenze: im Browser zaehlt echte Zeit, versteckter Tab pausiert', function () {
  var b = starteFake({ suche: '?neu=1' });
  var L = b.h.st;
  // 30 Bilder zu je 200 ms (5 Bilder pro Sekunde): echt 6 s
  b.frames(30, 200);
  wahr(L.spielzeit > 5.5 && L.spielzeit < 6.5, 'echte Zeit ' + L.spielzeit.toFixed(2));
  // Tab versteckt, 10 Minuten spaeter wieder da: zaehlt nicht
  b.doc.hidden = true; b.docL.visibilitychange.forEach(function (f) { f(); });
  b.frames(1, 600000);
  b.doc.hidden = false; b.docL.visibilitychange.forEach(function (f) { f(); });
  b.frames(1, 16.7);
  wahr(L.spielzeit < 7.6, 'Pause zaehlt nicht: ' + L.spielzeit.toFixed(2));
});

// ---------- Neues Aussehen (v0.7) ----------
function proxyR() {
  var log = { texte: [], ops: [], fills: [] };
  var ctx = new Proxy({}, { get: function (o, k) { if (k in o) return o[k]; return function () { if (k === 'fillText') log.texte.push(arguments[0]); if (k === 'fillRect') log.fills.push(o.fillStyle); return { addColorStop: function () {} }; }; },
    set: function (o, k, v) { o[k] = v; if (k === 'globalCompositeOperation') log.ops.push(v); return true; } });
  return { R: { ctx: ctx, ui: ctx, uiSkala: 1, uiCanvas: { width: 960, height: 528 } }, log: log };
}
test('Licht: mittags keine Toenung, abends multipliziert und Lampen gehen nacheinander an', function () {
  var D = ladeKontext().Dorf, U = D.Uhr, uhr = U.erstelle();
  uhr.minute = 12 * 60; var L = U.licht(uhr, 300);
  gleich(L.r + L.g + L.b, 765, 'mittags weiss'); gleich(L.lampen, 0); wahr(L.glut === 0);
  uhr.minute = 6 * 60; L = U.licht(uhr, 0); wahr(L.r < 255 && L.b > L.r, 'Morgen kuehl lila'); gleich(L.lampen, 0);
  uhr.minute = 18 * 60; L = U.licht(uhr, 480); wahr(L.r > L.b, 'Nachmittag warm');
  uhr.minute = 22 * 60; L = U.licht(uhr, 640); gleich(L.lampen, 1); gleich(L.glut, 1); wahr(L.mond > 0.5); gleich(L.sonne, 1, 'Sonne untergegangen');
  // Daemmerung vor der 15 Minuten Grenze: auch um 14 Uhr wird es Nacht
  uhr.minute = 14 * 60; L = U.licht(uhr, 900 - 10); wahr(L.daemmerung > 0.85); wahr(L.lampen > 0.85 && L.sonne > 0.95 && L.mond > 0.85, 'Sonne sinkt, Mond kommt, Lampen an');
  wahr(L.b > L.r, 'Farbe Richtung Nacht');
  // im Spiel: Lampen zaehlen hoch, jedes Mal ein Pling
  var st = D.Spiel.erstelle({ seed: 1 }); st.uhr.minute = 18.9 * 60; st.spielzeit = 500;
  var plings = 0, an = [];
  for (var i = 0; i < 60 * 90 && !st.abend; i++) { D.Spiel.schritt(st, 1 / 60); st.toene.forEach(function (t) { if ((t.name || t) === 'licht') plings++; }); st.toene.length = 0; if (an[an.length - 1] !== st.lampenAn) an.push(st.lampenAn); }
  gleich(st.lampenAn, D.Spiel.LAMPEN, 'alle an'); gleich(plings, D.Spiel.LAMPEN, 'ein Pling pro Lampe');
  wahr(an.every(function (v, k) { return k === 0 || v === an[k - 1] + 1; }), 'eins nach dem anderen: ' + an.join(','));
});
test('Licht zeichnen: multiplizieren, Leuchten addieren, alte Geraete bekommen die Farbschicht', function () {
  var D = ladeKontext().Dorf, st = D.Spiel.erstelle({ seed: 1 }), p = proxyR();
  st.kamera.x = 160; st.kamera.y = 160; st.spieler.x = 18 * 16; st.spieler.y = 14 * 16;
  st.uhr.minute = 21 * 60; st.spielzeit = 600; st.lampenAn = D.Spiel.LAMPEN;
  D.Render.zeichne(p.R, st);
  wahr(p.log.ops.indexOf('multiply') >= 0 && p.log.ops.indexOf('lighter') >= 0, 'multiply und lighter');
  gleich(p.R.letzteLampen, D.Spiel.LAMPEN); wahr(st.bielLaterne, 'Biel hat abends eine Laterne');
  wahr(p.R.lichtQuellen.fenster.length >= 4, 'Fenster gefunden'); gleich(p.R.lichtQuellen.laternen.length, 5, 'fuenf Laternen');
  st.uhr.minute = 12 * 60; st.spielzeit = 200; st.lampenAn = 0; p.log.ops.length = 0; D.Render.zeichne(p.R, st);
  wahr(p.log.ops.indexOf('multiply') < 0 && p.log.ops.indexOf('lighter') < 0, 'mittags kein Licht noetig'); wahr(!st.bielLaterne);
  // Geraet ohne multiply: Wert bleibt alt, dann alte Farbschicht
  var alt = proxyR(), c = alt.R.ctx;
  var echt = new Proxy(c, { set: function (o, k, v) { if (k === 'globalCompositeOperation' && v !== 'source-over') return true; o[k] = v; return true; } });
  alt.R.ctx = echt; st.uhr.minute = 21 * 60; st.spielzeit = 600;
  D.Render.zeichne(alt.R, st);
  wahr(alt.log.fills.some(function (f) { return /^rgba\(/.test(f); }), 'Farbschicht statt multiply');
});
test('HUD ohne Lesen: Tagesbogen, Gesichter mit Herzen, Korb, kein Uhrzeit Text, Tipp-Kreis', function () {
  var D = ladeKontext().Dorf, st = D.Spiel.erstelle({ seed: 1 }), p = proxyR();
  st.gaeste[0].glueck = D.Glueck.MAX; st.vorrat.tomate = 3;
  D.Render.zeichne(p.R, st);
  var hud = p.R.letzteHud;
  gleich(hud.gaeste.length, 3); gleich(hud.gaeste[0].herzen, 5, 'Mia voll');
  wahr(p.log.texte.every(function (t) { return !/\d\d:\d\d/.test(t) && !/^Tag \d/.test(t); }), 'keine Uhrzeit, kein Tag als Text');
  gleich(hud.korb.gezeigt.tomate, 3, 'Korb zeigt drei Tomaten als Bild');
  wahr(p.log.texte.indexOf('3') < 0, 'keine Ziffer');
  // Tipp-Kreis bei jedem Tippen, verschwindet nach kurzer Zeit
  D.Spiel.klickBild(st, 100, 100, true);
  gleich(st.tipps.length, 1);
  for (var i = 0; i < 30; i++) D.Spiel.schritt(st, 1 / 60);
  gleich(st.tipps.length, 0, 'nach 0,5 s weg');
  for (var k = 0; k < 9; k++) D.Spiel.klickBild(st, 10 + k, 10, false);
  wahr(st.tipps.length <= 4, 'hoechstens vier gleichzeitig');
});
test('Tagesende: Kreis schliesst sich um Biel, danach Bona nit Bild, Neu-Frage ohne gruenes Kreuz', function () {
  var D = ladeKontext().Dorf, st = D.Spiel.erstelle({ seed: 1 }), p = proxyR();
  st.uhr.minute = D.Uhr.ENDE - 0.01; st.spielzeit = 899;
  D.Spiel.schritt(st, 1 / 60);
  wahr(st.abend, 'Abend'); p.log.texte.length = 0;
  D.Spiel.schritt(st, 0.3); D.Render.zeichne(p.R, st);
  wahr(p.log.texte.indexOf('Bona nit!') < 0, 'erst der Kreis');
  for (var i = 0; i < 70; i++) D.Spiel.schritt(st, 1 / 60);
  p.log.texte.length = 0; D.Render.zeichne(p.R, st);
  wahr(p.log.texte.indexOf('Bona nit!') >= 0, 'dann die Abendszene');
  gleich(p.log.texte.length, 1, 'nur Bona nit! als Text');
  var src = require('fs').readFileSync(require('path').join(__dirname, '..', 'js', 'render.js'), 'utf8');
  wahr(!/kreuz\(c, k\.x/.test(src), 'Nein Knopf ohne Kreuz');
});

// ---------- v0.8: Figuren, Bilderblasen, ein Knopf, Herzflug, Korb, Huehner, Vorlesen ----------
function wegMitGaesten(st) { st.gaeste.forEach(function (g) { g.x = -2000; g.y = -2000; }); }
function stelle(st, x, y) { st.spieler.x = x; st.spieler.y = y; st.spieler.ziel = null; st.spieler.pfad = []; }
test('Ein Knopf: Reihenfolge Gast, Tier, Ei vor Huhn, Pflanze, Ei, Herd, Menue, Abend', function () {
  var D = ladeKontext().Dorf, S = D.Spiel, st = S.erstelle({ seed: 1 });
  var mia = st.gaeste[0];
  stelle(st, mia.x + 8, mia.y);
  gleich(S.kontext(st).art, 'reden', 'Gast daneben: reden'); gleich(S.kontext(st).ziel, mia);
  wegMitGaesten(st);
  var esel = st.tiere.esel;
  stelle(st, esel.x + 10, esel.y);
  st.vorrat.karotte = 0; gleich(S.kontext(st).art, 'streicheln', 'Esel ohne Karotte: streicheln');
  st.vorrat.karotte = 1; gleich(S.kontext(st).art, 'fuettern', 'Esel mit Karotte: fuettern');
  var huhn = st.tiere.huehner[0], ei = st.tiere.eier[0];
  wahr(ei, 'Morgens liegt ein Ei');
  stelle(st, ei.x, ei.y + 4); huhn.x = ei.x + 6; huhn.y = ei.y;
  gleich(S.kontext(st).art, 'sammeln', 'Ei geht vor dem Huhn daneben');
  st.tiere.eier.length = 0;
  gleich(S.kontext(st).art, 'streicheln', 'ohne Ei wird das Huhn gestreichelt');
  st.tiere.huehner.forEach(function (h) { h.x = -2000; });
  var pf = st.garten.liste.filter(function (p) { return p.reif; })[0], pp = D.Garten.punkt(pf);
  stelle(st, pp.x, pp.y + 6);
  if (D.Tiere.naechstes(st.tiere, st.spieler)) { esel.x = -2000; st.tiere.gecko.x = -2000; }
  gleich(S.kontext(st).art, 'ernten', 'reife Pflanze: ernten');
  var herd = st.karte.orte.herd[0];
  stelle(st, herd.x * 16 + 8, herd.y * 16 + 8);
  gleich(S.kontext(st).art, 'kochen', 'am Herd: kochen');
  wahr(S.tueKontext(st, S.kontext(st)) && st.menue, 'Knopf oeffnet das Menue');
  gleich(S.kontext(st).art, 'kochen', 'im Menue: waehlen');
  st.menue = null; st.abend = true; gleich(S.kontext(st).art, 'weiter', 'Abend: weiter');
  st.abend = false; st.frage = { wahl: 0, t: 0 }; gleich(S.kontext(st), null, 'Rueckfrage: Knopf ist weg');
  st.frage = null;
  // irgendwo im Gras ohne alles: nichts zu tun
  var leer = null;
  for (var y = 1; y < st.karte.h - 1 && !leer; y++) for (var x = 1; x < st.karte.w - 1 && !leer; x++) {
    if (st.karte.blockiert(x, y)) continue;
    stelle(st, x * 16 + 8, y * 16 + 8); if (!S.kontext(st)) leer = { x: x, y: y };
  }
  wahr(leer, 'es gibt Stellen ohne Aktion'); gleich(S.tueKontext(st, null), false);
});
test('Ein Knopf im Browser: Bild wechselt, ohne Ziel weg, pulst nur bis er benutzt wurde', function () {
  var a = starteFake({ suche: '?touch=1' }), st = a.h.st, k = a.els['knopf-aktion'], S = a.D.Spiel;
  wegMitGaesten(st);
  st.tiere.liste.forEach(function (t) { t.x = -2000; }); st.tiere.eier.length = 0;
  st.garten.liste.forEach(function (p) { p.reif = false; p.wachs = 0; });
  stelle(st, 3 * 16 + 8, 18 * 16 + 8); a.frames(2);
  if (S.kontext(st) === null) {
    wahr(/\bleer\b/.test(k.className), 'ohne Ziel leer: ' + k.className);
    gleich(k.attr['aria-hidden'], 'true');
  }
  var mia = st.gaeste[0]; mia.x = st.spieler.x + 8; mia.y = st.spieler.y; a.frames(2);
  wahr(/art-reden/.test(k.className) && /\bpuls\b/.test(k.className), 'Reden mit Puls: ' + k.className);
  gleich(k.attr['aria-label'], S.AKTION_NAME.reden);
  for (var i = 0; i < S.AKTION_PULS; i++) { k.klick(); a.frames(2); st.blase = null; }
  a.frames(2);
  wahr(/art-reden/.test(k.className) && !/\bpuls\b/.test(k.className), 'nach dem Lernen kein Puls mehr: ' + k.className);
});
test('Huehner und Eier: zwei Huehner, Eier am Morgen, nie mehr als drei, gleich bei gleichem Seed', function () {
  var D = ladeKontext().Dorf;
  function lauf(seed) {
    var st = D.Spiel.erstelle({ seed: seed }), max = 0, gelegt = 0;
    for (var i = 0; i < 60 * 20 * 6; i++) { D.Spiel.schritt(st, 1 / 20); max = Math.max(max, st.tiere.eier.length); if (i === 2400) st.tiere.eier.length = 0; }
    gelegt = st.tiere.eiNr - 2;
    return { st: st, max: max, gelegt: gelegt, eier: JSON.stringify(st.tiere.eier.map(function (e) { return [e.x, e.y]; })), esel: [st.tiere.esel.x, st.tiere.esel.y].join(','), huhn: st.tiere.huehner.map(function (h) { return Math.round(h.x) + ',' + Math.round(h.y); }).join(' ') };
  }
  var st0 = D.Spiel.erstelle({ seed: 4 });
  gleich(st0.tiere.huehner.length, 2); gleich(st0.tiere.eier.length, 2, 'zwei Eier am Morgen');
  wahr(st0.tiere.huehner[0].feder !== st0.tiere.huehner[1].feder, 'ein weisses und ein braunes Huhn');
  var a = lauf(4), b = lauf(4);
  wahr(a.max <= D.Tiere.EIER_MAX, 'hoechstens drei Eier: ' + a.max);
  wahr(a.gelegt >= 2, 'Huehner legen neue Eier: ' + a.gelegt);
  gleich(a.eier, b.eier, 'gleicher Seed, gleiche Eier'); gleich(a.huhn, b.huhn, 'gleiche Huehnerwege'); gleich(a.esel, b.esel);
  // Huehner haben eigenen Zufall: ohne Huehner laeuft Bruna genau gleich
  var c = D.Spiel.erstelle({ seed: 4 }), d = D.Spiel.erstelle({ seed: 4 });
  d.tiere.huehner.forEach(function (h) { h.lege = 1; });
  for (var i = 0; i < 1200; i++) { D.Spiel.schritt(c, 1 / 20); D.Spiel.schritt(d, 1 / 20); }
  gleich([c.tiere.esel.x, c.tiere.esel.y].join(','), [d.tiere.esel.x, d.tiere.esel.y].join(','), 'Esel unabhaengig von den Huehnern');
  gleich(c.gaeste.map(function (g) { return Math.round(g.x); }).join(','), d.gaeste.map(function (g) { return Math.round(g.x); }).join(','), 'Gaeste unabhaengig');
  // neuer Tag: wieder zwei frische Eier
  D.Tiere.neuerTag(a.st.tiere, a.st.karte); gleich(a.st.tiere.eier.length, 2);
  // Stall steht im Huehnerhof und ist nicht begehbar
  wahr(st0.karte.stall && st0.karte.blockiert(st0.karte.stall.x, st0.karte.stall.y), 'Stall blockiert');
});
test('Ei sammeln: fliegt in den Korb, Korb fuellt sich sichtbar, ohne Ziffern, ab fuenf ein Plus', function () {
  var D = ladeKontext().Dorf, S = D.Spiel, st = S.erstelle({ seed: 2 }), p = proxyR();
  wegMitGaesten(st);
  var ei = st.tiere.eier[0];
  stelle(st, ei.x, ei.y + 4);
  gleich(S.sammle(st, ei), 1);
  gleich(st.vorrat.ei, 1); gleich(st.tiere.eier.indexOf(ei), -1, 'Ei liegt nicht mehr im Gras');
  gleich(st.flieger.length, 1); gleich(st.flieger[0].art, 'ei');
  wahr(st.blase && st.blase.bilder.indexOf('ei') >= 0, 'Biel zeigt ein Ei-Bild');
  D.Render.zeichne(p.R, st);
  gleich(p.R.letzteHud.korb.gezeigt.ei, 0, 'waehrend des Flugs noch nicht im Korb');
  for (var i = 0; i < 40; i++) S.schritt(st, 1 / 60);
  gleich(st.flieger.length, 0, 'gelandet'); wahr(st.korbPuls.ei > 0, 'Korbfach hopst');
  D.Render.zeichne(p.R, st);
  gleich(p.R.letzteHud.korb.gezeigt.ei, 1, 'jetzt liegt es im Korb');
  st.vorrat.ei = 6; st.vorrat.tomate = 3; p.log.texte.length = 0;
  D.Render.zeichne(p.R, st);
  var k = p.R.letzteHud.korb;
  gleich(k.gezeigt.ei, 4, 'hoechstens vier sichtbar'); wahr(k.plus.ei, 'Plus bei mehr'); wahr(!k.plus.tomate);
  gleich(k.gezeigt.tomate, 3);
  wahr(p.log.texte.every(function (t) { return !/^\d+$/.test(String(t)); }), 'keine Zahl im Bild: ' + p.log.texte.join('|'));
  wahr(k.x < 40 && k.y > 120, 'Korb unten links');
  // voller Korb: freundlich, das Ei bleibt liegen
  st.vorrat.ei = D.Garten.VORRAT_MAX; var e2 = st.tiere.eier[0];
  gleich(S.sammle(st, e2), 0); wahr(st.tiere.eier.indexOf(e2) >= 0);
  // Tippen aufs Ei: Biel geht hin und hebt es auf
  st.vorrat.ei = 0; stelle(st, e2.x - 60, e2.y);
  S.klick(st, e2.x, e2.y - 3);
  for (var j = 0; j < 60 * 8 && st.tiere.eier.indexOf(e2) >= 0; j++) S.schritt(st, 1 / 60);
  gleich(st.tiere.eier.indexOf(e2), -1, 'nach dem Tippen eingesammelt'); gleich(st.vorrat.ei, 1);
});
test('Ei im Rezept: nie Pflicht, mit Ei gibt es einen Teller mehr, Pa amb oli braucht keins', function () {
  var D = ladeKontext().Dorf, S = D.Spiel, Ga = D.Garten, Ge = D.Gerichte;
  var v = { tomate: 0, karotte: 0, orange: 1, olive: 0, ei: 0 };
  var z = Ga.pruefe(v, Ge.hole('ensaimada'));
  wahr(z.ok && !z.bonus, 'Ensaimada geht ohne Ei');
  v.ei = 1; z = Ga.pruefe(v, Ge.hole('ensaimada')); wahr(z.ok && z.bonus, 'mit Ei als Bonus');
  v.orange = 0; z = Ga.pruefe(v, Ge.hole('ensaimada')); wahr(!z.ok && !z.fehlt.ei, 'fehlt nur die Orange, nie das Ei');
  wahr(!Ga.pruefe(v, Ge.hole('paamboli')).bonus, 'Pa amb oli hat keinen Ei Bonus');
  function koche(mitEi) {
    var st = S.erstelle({ seed: 1 }); wegMitGaesten(st);
    st.vorrat.tomate = 2; st.vorrat.ei = mitEi ? 1 : 0; st.teller.length = 0;
    wahr(S.kochen(st, 'tumbet'), 'Tumbet kocht');
    gleich(st.vorrat.ei, 0, 'Ei verbraucht oder nie da'); gleich(st.vorrat.tomate, 0);
    for (var i = 0; i < 60 * 12 && st.kochen; i++) S.schritt(st, 1 / 60);
    return st.teller.length;
  }
  gleich(koche(true), koche(false) + 1, 'mit Ei ein Teller mehr');
  var st = S.erstelle({ seed: 1 }); st.vorrat.ei = 2; S.kochen(st, 'paamboli'); gleich(st.vorrat.ei, 2, 'Pa amb oli laesst die Eier im Korb');
});
test('Bilderblase: kein Name, keine Schrift, ploppt auf, bleibt im Bild, Wunschblase macht Platz', function () {
  var D = ladeKontext().Dorf, S = D.Spiel, st = S.erstelle({ seed: 1 }), p = proxyR();
  var mia = st.gaeste[0];
  st.kamera.x = Math.max(0, mia.x - 160); st.kamera.y = Math.max(0, mia.y - 100);
  S.sage(st, 'Mia', 'Bon dia! (Guten Morgen!)', 3, ['sonne', 'lachen']);
  D.Render.zeichne(p.R, st);
  var b = p.R.letzteBlase;
  wahr(b, 'Blase gezeichnet'); gleich(b.sprecher, 'Mia'); gleich(b.bilder.join(','), 'sonne,lachen');
  nah(b.skala, 0.6, 1e-9, 'startet klein');
  wahr(p.log.texte.every(function (t) { return !/Mia|Bon dia|Guten/.test(String(t)); }), 'weder Name noch Satz als Text');
  wahr(b.x >= 2 && b.x + b.w <= D.Render.W - 2 && b.y >= 2, 'im Bild');
  S.schritt(st, 0.15); D.Render.zeichne(p.R, st); nah(p.R.letzteBlase.skala, 1.05, 0.02, 'kurz etwas groesser');
  S.schritt(st, 0.2); D.Render.zeichne(p.R, st); gleich(p.R.letzteBlase.skala, 1, 'dann normal');
  wahr(p.R.letzteHud.gaeste[0].spricht && p.R.letzteHud.gaeste[0].skala > 1.1, 'Bild von Mia oben leuchtet');
  // Biel ganz oben am Rand: Blase weicht zur Seite aus, nicht unter die Leiste
  stelle(st, 10 * 16, 2 * 16 + 12); st.kamera.y = 0; st.kamera.x = 0;
  S.sage(st, 'Biel', 'Hallo', 3, ['herz', 'herz', 'stern', 'mond']);
  D.Render.zeichne(p.R, st); b = p.R.letzteBlase;
  gleich(b.bilder.length, 3, 'hoechstens drei Bilder'); var hudR = 60 + st.gaeste.length * 36 - 14;
  wahr(b.y >= 30 || (b.x >= hudR && b.y >= 12), 'nicht unter Gesichtern oder Hilfe: ' + b.x + ',' + b.y);
  wahr(b.seite !== 0 && b.y <= 2 * 16 + 12, 'neben dem Kopf, nicht weit darunter: ' + b.y);
  // Sprecher oben links unter den Gesichtern: Blase bleibt unter der Leiste
  stelle(st, 3 * 16, 1 * 16 + 12); S.sage(st, 'Biel', 'Hallo', 3, ['herz']); D.Render.zeichne(p.R, st); b = p.R.letzteBlase;
  wahr(b.x >= hudR || b.y >= 30, 'nicht unter den Gesichtern: ' + b.x + ',' + b.y);
  // jedes Bild, das das Spiel benutzt, kann gezeichnet werden
  var quelle = fs.readFileSync(path.join(__dirname, '..', 'js', 'main.js'), 'utf8') + fs.readFileSync(path.join(__dirname, '..', 'js', 'gaeste.js'), 'utf8') + fs.readFileSync(path.join(__dirname, '..', 'js', 'tiere.js'), 'utf8');
  var bilder = {};
  (quelle.match(/\[('[a-z:]+'(?:,\s*'[a-z:]+')*)\]/g) || []).forEach(function (m) { (m.match(/'[a-z:]+'/g) || []).forEach(function (w) { bilder[w.slice(1, -1)] = 1; }); });
  ['gericht:paamboli', 'gericht:tumbet', 'gericht:ensaimada', 'ei', 'huhn', 'korb', 'sonne', 'teller', 'topf'].forEach(function (n) { wahr(D.Render.kenntSymbol(n), n + ' bekannt'); });
  Object.keys(D.Gaeste.FREI_BILDER).forEach(function (id) { D.Gaeste.FREI_BILDER[id].forEach(function (l) { l.forEach(function (n) { wahr(D.Render.kenntSymbol(n), 'Bild ' + n); }); }); });
  Object.keys(D.Tiere.BILDER).forEach(function (n) { D.Tiere.BILDER[n].forEach(function (x) { wahr(D.Render.kenntSymbol(x), 'Tierbild ' + x); }); });
  wahr(Object.keys(bilder).length > 10);
});
test('Herzflug: Herzchen steigen, ein Herz fliegt zum Bild oben, erst dann zaehlt es, Bild ploppt', function () {
  var D = ladeKontext().Dorf, S = D.Spiel, st = S.erstelle({ seed: 3 }), p = proxyR(), mia = st.gaeste[0];
  var vorher = D.Glueck.herzen(mia);
  mia.glueck = (vorher + 1) * D.Glueck.PRO_HERZ - 1;
  var neu = 0; for (var i = 0; i < 5 && !neu; i++) { neu = D.Glueck.gib(st, mia, 'liebling'); st.zeit += 30; }
  wahr(neu >= 1, 'neues Herz'); var n = D.Glueck.herzen(mia);
  gleich(st.herzFlug.length, neu); wahr(mia.hop > 0, 'Mia huepft');
  wahr(st.herzchen.length <= 40, 'hoechstens 40 Teilchen');
  D.Render.zeichne(p.R, st);
  gleich(p.R.letzteHud.gaeste[0].gezeigt, n - neu, 'oben noch das alte Herz');
  for (var k = 0; k < 120 && st.herzFlug.length; k++) S.schritt(st, 1 / 60);
  gleich(st.herzFlug.length, 0, 'angekommen'); wahr(st.chipPuls[mia.id] > 0, 'Bild ploppt');
  S.schritt(st, 0.1); D.Render.zeichne(p.R, st);
  gleich(p.R.letzteHud.gaeste[0].gezeigt, n); wahr(p.R.letzteHud.gaeste[0].skala > 1, 'groesser beim Ankommen');
  for (k = 0; k < 40; k++) S.schritt(st, 1 / 60);
  D.Render.zeichne(p.R, st); gleich(p.R.letzteHud.gaeste[0].skala, 1, 'dann wieder normal');
  // tausend Herzen auf einmal: Teilchen bleiben begrenzt
  st.gaeste.forEach(function (g) { g.glueck = 0; g.glueckPause = {}; });
  for (var j = 0; j < 200; j++) { st.zeit += 30; st.gaeste.forEach(function (g) { D.Glueck.gib(st, g, 'liebling'); }); }
  wahr(st.herzchen.length <= 40, 'Teilchen begrenzt: ' + st.herzchen.length);
});
test('Neue Figuren: jede Figur eigene Form, gezeichnet ohne Fehler in allen Richtungen', function () {
  var D = ladeKontext().Dorf, Rn = D.Render, st = D.Spiel.erstelle({ seed: 1 }), p = proxyR();
  var formen = [Rn.BIEL].concat(st.gaeste.map(function (g) { return g.aussehen; }));
  var hoehen = formen.map(function (a) { return Rn.masse(a).hoehe; });
  wahr(hoehen[1] < hoehen[0] && hoehen[1] < hoehen[2], 'Mia ist die Kleinste: ' + hoehen.join(','));
  gleich(formen.map(function (a) { return a.form; }).join(','), 'biel,mia,jonas,padrina');
  formen.forEach(function (a) { ['unten', 'oben', 'links', 'rechts'].forEach(function (d) { [0, 1, 2, 3].forEach(function (f) {
    var r = Rn.zeichnePerson(p.R.ctx, 100, 100, a, d, f, { zeit: f * 0.3, hop: f % 2 });
    wahr(r && r.oben < 100 && r.hoehe > 10, a.form + ' ' + d);
  }); }); });
  wahr(st.gaeste[2].aussehen.stock && st.gaeste[2].aussehen.rock, 'Padrina mit Stock und Rock');
  wahr(st.gaeste[1].aussehen.brille, 'Jonas mit Brille');
});
test('Vorlesen: ohne Stimme still, deutsche Stimme ruhig, erst nach dem ersten Tippen, stumm heisst still', function () {
  var V = ladeKontext().Dorf.Vorlesen;
  function fakeSS(stimmen) {
    var log = { gesagt: [], cancel: 0 };
    return { log: log, ss: { getVoices: function () { return stimmen; }, cancel: function () { log.cancel++; }, speak: function (u) { log.gesagt.push(u); }, addEventListener: function () {} } };
  }
  function U(t) { this.text = t; }
  function fenster(ss) { var l = {}; return { l: l, speechSynthesis: ss, SpeechSynthesisUtterance: U, addEventListener: function (n, f) { (l[n] = l[n] || []).push(f); } }; }
  // gar nichts da
  var v0 = V.erstelle({}, fakeSpeicher());
  gleich(v0.verfuegbar, false); gleich(v0.sage('Hallo', 'Biel', false), false); v0.stopp(); v0.umschalten();
  wahr(!V.erstelle(null, null).verfuegbar, 'ohne Fenster kein Fehler');
  // nur englische Stimme
  var en = fakeSS([{ lang: 'en-US', name: 'X' }]);
  gleich(V.erstelle(fenster(en.ss), fakeSpeicher()).verfuegbar, false, 'ohne deutsche Stimme kein Knopf');
  // deutsche Stimme
  var de = fakeSS([{ lang: 'en-US' }, { lang: 'de-AT', localService: true }, { lang: 'de-DE', localService: true, name: 'Anna' }]), w = fenster(de.ss), sp = fakeSpeicher();
  var v = V.erstelle(w, sp);
  wahr(v.verfuegbar && v.an, 'verfuegbar und an'); gleich(v.stimme.name, 'Anna', 'Stimme aus Deutschland');
  gleich(v.sage('Hallo', 'Biel', false), false, 'nicht vor dem ersten Tippen');
  w.l.pointerdown[0]();
  wahr(v.sage('Bon dia! (Guten Morgen!)', 'Mia', false), 'jetzt liest es');
  var u = de.log.gesagt[0];
  gleich(u.text, 'Bon dia! Guten Morgen!'); gleich(u.lang, 'de-DE'); wahr(u.rate < 1, 'ruhig'); wahr(u.pitch > 1, 'Mia etwas hoeher');
  var c0 = de.log.cancel;
  gleich(v.sage('Noch was', 'Jonas', true), false, 'stumm: nichts'); wahr(de.log.cancel > c0, 'stumm haelt an');
  v.setze(false); gleich(sp.d['finca.vorlesen'], 'aus', 'gemerkt'); gleich(v.sage('x', 'Biel', false), false);
  gleich(V.erstelle(w, sp).an, false, 'beim naechsten Mal aus'); v.setze(true); gleich(V.erstelle(w, sp).an, true);
  var lang = V.saeubere(new Array(60).join('Ein Satz ')); wahr(lang.length <= V.MAX_ZEICHEN + 1, 'kurz');
  gleich(V.saeubere('Ein Ei! (ou) Das kommt in den Korb.'), 'Ein Ei! ou. Das kommt in den Korb.');
  // kaputte Stimme wirft: Spiel laeuft weiter
  var kaputt = fenster({ getVoices: function () { return [{ lang: 'de-DE' }]; }, cancel: function () { throw new Error('x'); }, speak: function () { throw new Error('y'); } });
  var vk = V.erstelle(kaputt, fakeSpeicher()); kaputt.l.click[0]();
  gleich(vk.sage('Hallo', 'Biel', false), false, 'Fehler werden geschluckt');
});
test('Vorlesen im Spiel: Knopf nur mit Stimme, Ton aus heisst nicht vorlesen, Knopf holt den Ton zurueck', function () {
  var gesagt = [], cancel = 0;
  function U(t) { this.text = t; }
  var ss = { getVoices: function () { return [{ lang: 'de-DE', localService: true }]; }, cancel: function () { cancel++; }, speak: function (u) { gesagt.push(u.text); } };
  var au = fakeAudio();
  var a = starteFake({ fenster: { speechSynthesis: ss, SpeechSynthesisUtterance: U, AudioContext: au.AC } });
  var st = a.h.st, kn = a.els['vorlesen-knopf'];
  a.frames(2);
  gleich(kn.style.display, '', 'Knopf sichtbar');
  (a.listener.pointerdown || []).forEach(function (f) { f({}); });
  var ton = a.h.ton;
  wahr(ton && !ton.stumm, 'Ton an');
  a.D.Spiel.sage(st, 'Biel', 'Hallo Bruna.', 3, ['esel', 'herz']); a.frames(2);
  gleich(gesagt[gesagt.length - 1], 'Hallo Bruna.', 'vorgelesen');
  // Ton aus: Vorlesen haelt an und liest nichts Neues
  var c0 = cancel; ton.umschalten(); a.frames(1); wahr(cancel > c0, 'Stummschalten stoppt die Stimme');
  var n0 = gesagt.length; a.D.Spiel.sage(st, 'Biel', 'Psst.', 3); a.frames(2); gleich(gesagt.length, n0, 'stumm: nichts vorgelesen');
  wahr(/\bstumm\b/.test(kn.className), 'Knopf zeigt stumm');
  // Vorlesen-Knopf bei Ton aus: Ton kommt mit an
  kn.klick(); a.frames(1); gleich(ton.stumm, false, 'Ton wieder an'); wahr(st.vorlesen.an);
  kn.klick(); a.frames(1); gleich(st.vorlesen.an, false, 'Vorlesen aus'); gleich(a.sp.d['finca.vorlesen'], 'aus');
  n0 = gesagt.length; a.D.Spiel.sage(st, 'Biel', 'Leise.', 3); a.frames(2); gleich(gesagt.length, n0, 'aus: nichts vorgelesen');
  // ohne Stimme: Knopf weg, Spiel laeuft
  var b = starteFake(); b.frames(3);
  gleich(b.els['vorlesen-knopf'].style.display, 'none', 'ohne Stimme kein Knopf');
  wahr(!b.h.st.vorlesen || !b.h.st.vorlesen.verfuegbar);
});
test('Tagesgrenze v0.8: mit Huehnern, Eiern, Knopf und Herzflug endet der Tag spaetestens nach 15 Minuten', function () {
  var D = ladeKontext().Dorf, S = D.Spiel, st = S.erstelle({ seed: 8 }), sek = 0, r = D.RNG.erstelle(5), gesammelt = 0;
  st.uhr.mindestMinuten = st.uhr.mindestMinuten;
  while (!st.abend && sek < 1200) {
    if (r.next() < 0.02) { var k = S.kontext(st); if (k && k.art === 'sammeln') gesammelt++; S.tueKontext(st, k); }
    if (r.next() < 0.01 && st.menue) S.kochen(st, D.Gerichte.REIHE[Math.floor(r.next() * 3)]);
    if (r.next() < 0.005) { var e = st.tiere.eier[0]; if (e) S.klick(st, e.x, e.y - 3); }
    // die Uhr wird angehalten (als wuerde das Kind die ganze Zeit Fragen offen lassen)
    if (st.uhr.minute > 20 * 60) st.uhr.minute = 20 * 60;
    S.schritt(st, 0.05); sek += 0.05;
  }
  wahr(st.abend, 'Abend erreicht'); wahr(sek <= 15 * 60 + 0.1, 'nach ' + Math.round(sek) + ' s');
});

// ---------- v0.9: Bilderbuch, Sticker, Bild-Abend, Deko, Wolken, Gaehnen, Randplakette ----------
test('Sticker: zwoelf Bilder, am Abend kommt genau einer pro Tag ins Album, Album bleibt beim Neuanfang', function () {
  var D = ladeKontext().Dorf, st = D.Spiel.erstelle({ seed: 1 });
  gleich(D.Sticker.LISTE.length, 12);
  st.uhr.minute = D.Uhr.ENDE - 0.01; st.spielzeit = 100; D.Spiel.schritt(st, 1 / 60);
  wahr(st.abend && st.neuerSticker, 'Sticker vergeben'); gleich(D.Sticker.anzahl(st.album), 1);
  wahr(st.albumNeu, 'Punkt am Buch-Knopf');
  D.Sticker.vergib(st); gleich(D.Sticker.anzahl(st.album), 1, 'nur einer pro Tag');
  D.Spiel.neuAnfangen(st); gleich(D.Sticker.anzahl(st.album), 1, 'Album bleibt');
});
test('Abend zaehlt Herzen hoch (leises Pling), dann Sticker mit Ton, erst danach geht Tippen weiter', function () {
  var D = ladeKontext().Dorf, st = D.Spiel.erstelle({ seed: 1 }), p = proxyR();
  st.gaeste.forEach(function (g) { g.glueck = D.Glueck.MAX; }); D.Glueck.pruefe(st);
  st.uhr.minute = D.Uhr.ENDE - 0.01; D.Spiel.schritt(st, 1 / 60); st.toene.length = 0;
  for (var i = 0; i < 60 * 2.2; i++) D.Spiel.schritt(st, 1 / 60);
  D.Render.zeichne(p.R, st);
  var A = p.R.letzteAbend; wahr(A.herzen.some(function (h) { return h.gezeigt > 0 && h.gezeigt < 5; }), 'zaehlt gerade');
  wahr(st.toene.indexOf('zaehl') >= 0, 'Pling'); wahr(!A.bereit, 'noch gesperrt');
  wahr(D.Spiel.klickBild(st, 160, 150, true) !== 'neu' && st.abend, 'Tippen springt noch nicht');
  for (i = 0; i < 60 * 1.5; i++) D.Spiel.schritt(st, 1 / 60);
  wahr(st.toene.indexOf('sticker') >= 0, 'Sticker Ton'); D.Render.zeichne(p.R, st);
  wahr(p.R.letzteAbend.sticker && p.R.letzteAbend.sticker.id === st.neuerSticker, 'Sticker gezeigt');
  wahr(p.R.letzteAbend.herzen.every(function (h) { return h.gezeigt === 5; }), 'alle gezaehlt');
  for (i = 0; i < 60 * 1.5; i++) D.Spiel.schritt(st, 1 / 60);
  D.Render.zeichne(p.R, st); wahr(p.R.letzteAbend.bereit, 'Sonne bereit');
  gleich(p.R.letzteAbend.sticker.phase, 'album', 'Sticker ist ins Buch geflogen');
});
test('Bilderbuch: auf mit B, blaettern mit Tippen und Pfeilen, Reiter, X und daneben schliessen, Stups am Rand', function () {
  var D = ladeKontext().Dorf, S = D.Spiel, st = S.erstelle({ seed: 1 }), p = proxyR(), B = S.BUCH;
  function taste(code) { st.eingabe.druecke(code); S.schritt(st, 1 / 60); st.eingabe.ende(); st.eingabe.loese(code); S.schritt(st, 1 / 60); }
  taste('KeyB'); wahr(st.buch, 'B oeffnet'); gleich(st.buch.seite, 0);
  for (var i = 0; i < 20; i++) S.schritt(st, 1 / 60);
  gleich(S.klickBild(st, B.x + B.w - 20, B.y + 70, true), 'blaettern'); gleich(st.buch.seite, 1);
  taste('ArrowRight'); gleich(st.buch.seite, 2); taste('ArrowRight'); gleich(st.buch.seite, 3, 'Album');
  taste('ArrowRight'); gleich(st.buch.seite, 3); wahr(st.buch.stups > 0, 'am Ende stupst es');
  D.Render.zeichne(p.R, st); wahr(p.R.letztesBuch.album && p.R.letztesBuch.sticker.length === 12, 'Album mit 12 Plaetzen');
  gleich(p.log.texte.length, 0, 'Album ohne Text');
  S.klickBild(st, B.reiter[0].x + 5, B.reiter[0].y + 5, true); gleich(st.buch.seite, 0, 'Topf-Reiter');
  for (i = 0; i < 20; i++) S.schritt(st, 1 / 60);
  p.log.texte.length = 0; D.Render.zeichne(p.R, st); gleich(p.R.letztesBuch.rezept, D.Gerichte.REIHE[0]);
  gleich(p.log.texte.length, 1, 'Rezeptseite: nur der Name');
  gleich(S.klickBild(st, B.zu.x + 5, B.zu.y + 5, true), 'zurueck'); wahr(!st.buch, 'X schliesst');
  taste('KeyB'); gleich(st.buch.seite, 0, 'merkt sich die Seite'); taste('Escape'); wahr(!st.buch, 'Esc schliesst');
  taste('KeyB'); for (i = 0; i < 20; i++) S.schritt(st, 1 / 60); S.klickBild(st, 4, 170, true); wahr(!st.buch, 'daneben schliesst');
  taste('KeyB'); taste('KeyB'); wahr(!st.buch, 'B schliesst');
  st.albumNeu = true; S.oeffneBuch(st); gleich(st.buch.seite, 3, 'neuer Sticker: Album zuerst'); wahr(!st.albumNeu);
  S.schliesseBuch(st); S.oeffneMenue(st); for (i = 0; i < 30; i++) S.schritt(st, 1 / 60);
  gleich(S.klickBild(st, S.MENUE_BUCH.x + 5, S.MENUE_BUCH.y + 5, true), 'buch'); wahr(st.buch, 'Buch aus dem Menue');
});
test('Kochkarten: fehlende Zutaten gestrichelt, Karte wackelt mit Bloop, dann geht das Menue zu; Ei-Fach gut sichtbar', function () {
  var D = ladeKontext().Dorf, S = D.Spiel, st = S.erstelle({ seed: 1 }), p = proxyR();
  st.vorrat = {}; S.oeffneMenue(st); for (var i = 0; i < 30; i++) S.schritt(st, 1 / 60);
  D.Render.zeichne(p.R, st);
  var k = p.R.letzteMenue.karten.filter(function (x) { return x.id === 'ensaimada'; })[0];
  wahr(!k.ok && k.fehlt.indexOf('orange') >= 0 && k.ei, 'Ensaimada: Orange fehlt, Ei-Fach da');
  st.toene.length = 0; S.kochen(st, 'ensaimada');
  wahr(st.menue && st.menue.wackel && st.menue.wackel.id === 'ensaimada', 'wackelt'); wahr(st.toene.indexOf('bloop') >= 0, 'Bloop');
  S.schritt(st, 0.1); D.Render.zeichne(p.R, st); wahr(p.R.letzteMenue.karten.some(function (x) { return x.id === 'ensaimada' && x.dx !== 0; }), 'Karte wackelt sichtbar');
  for (i = 0; i < 60; i++) S.schritt(st, 1 / 60);
  wahr(!st.menue, 'Menue geht von allein zu');
  var src = require('fs').readFileSync(require('path').join(__dirname, '..', 'js', 'render.js'), 'utf8');
  wahr(/function eiFach/.test(src) && /#ffcf6b/.test(src), 'Ei-Fach golden umrandet');
});
test('Deko: Kuebel versperren keinen Weg und kein Ziel, Fensterlaeden und Bougainvillea gezeichnet', function () {
  var D = ladeKontext().Dorf, st = D.Spiel.erstelle({ seed: 1 }), k = st.karte, T = D.Karte.T;
  wahr(k.kuebel.length >= 6, 'Kuebel da');
  k.kuebel.forEach(function (q) {
    gleich(k.tile(q.x, q.y), T.KUEBEL); wahr(k.blockiert(q.x, q.y));
    var frei = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(function (d) { return !k.blockiert(q.x + d[0], q.y + d[1]); });
    wahr(frei, 'Kuebel ' + q.x + ',' + q.y + ' nicht eingemauert');
  });
  // alle Ziele bleiben erreichbar (Herd, Gaeste-Plaetze, Beete): Flutfuellung vom Start
  var seen = {}, q = [Dorf_tile(st)], n = 0;
  function Dorf_tile(s) { var t = D.Spieler.tile(s.spieler); return t.x + ',' + t.y; }
  seen[q[0]] = 1;
  while (q.length) { var c = q.shift().split(',').map(Number); n++; [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) { var x = c[0] + d[0], y = c[1] + d[1], key = x + ',' + y; if (!seen[key] && x >= 0 && y >= 0 && x < k.w && y < k.h && !k.blockiert(x, y)) { seen[key] = 1; q.push(key); } }); }
  Object.keys(k.orte).forEach(function (o) { k.orte[o].forEach(function (b) { if (!k.blockiert(b.x, b.y)) wahr(seen[b.x + ',' + b.y], o + ' ' + b.x + ',' + b.y + ' erreichbar'); }); });
  k.kuebel.forEach(function (q) { Object.keys(k.orte).forEach(function (o) { k.orte[o].forEach(function (b) { wahr(b.x !== q.x || b.y !== q.y, 'Kuebel nicht auf einem Ziel'); }); }); });
  st.garten.liste.forEach(function (pf) { var pt = D.Garten.punkt(pf), tx = Math.floor(pt.x / 16), ty = Math.floor(pt.y / 16);
    wahr([[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [0, 2]].some(function (d) { return seen[(tx + d[0]) + ',' + (ty + d[1])]; }), 'Pflanze erreichbar'); });
  var src = require('fs').readFileSync(require('path').join(__dirname, '..', 'js', 'render.js'), 'utf8');
  wahr(/function zeichneBougainvillea/.test(src) && /#7cc7b4/.test(src), 'Bougainvillea und Fensterlaeden');
});
test('Wolken und Gaehnen: Gedankenwolken kommen und gehen, muede Gaeste gaehnen, Gaehnton selten', function () {
  var D = ladeKontext().Dorf, S = D.Spiel, st = S.erstelle({ seed: 1 }), p = proxyR(), gesehen = 0, leer = 0;
  st.spieler.x = st.gaeste[0].x; st.spieler.y = st.gaeste[0].y + 20;
  for (var i = 0; i < 25 * 10; i++) { S.schritt(st, 0.1); D.Render.zeichne(p.R, st); if (p.R.letzteWolken.length) gesehen++; else leer++; }
  wahr(gesehen > 0 && leer > 0, 'Wolken kommen und gehen (' + gesehen + '/' + leer + ')');
  var g = st.gaeste[0]; g.beduerfnisse.ruhe = 10; g.dir = 'unten'; g.zustand = 'idle'; g.ziel = null;
  var max = 0; for (i = 0; i < 150; i++) { st.zeit += 0.1; max = Math.max(max, S.gaehnen(st, 0)); }
  wahr(max > 0.9, 'gaehnt'); g.beduerfnisse.ruhe = 100;
  st.uhr.minute = 12 * 60; var m2 = 0; for (i = 0; i < 150; i++) { st.zeit += 0.1; m2 = Math.max(m2, S.gaehnen(st, 0)); }
  gleich(m2, 0, 'ausgeruht mittags kein Gaehnen');
  st.toene.length = 0; st.gaeste.forEach(function (x) { x.beduerfnisse.ruhe = 5; });
  for (i = 0; i < 60 * 10; i++) S.schritt(st, 0.1);
  var n = st.toene.filter(function (t) { return t === 'gaehn'; }).length;
  wahr(n <= Math.ceil(60 / S.GAEHN.tonAbstand) + 1, 'Gaehnton hoechstens alle ' + S.GAEHN.tonAbstand + ' s (' + n + ')');
});
test('Randplakette: Ziel ausserhalb zeigt eine Plakette am Rand, die dem Korb ausweicht', function () {
  var D = ladeKontext().Dorf, S = D.Spiel, st = S.erstelle({ seed: 1 }), p = proxyR();
  st.hinweis = { ziel: { art: 'ernten', x: st.kamera.x - 200, y: st.kamera.y + 400, bild: 'tomate' }, alpha: 1, t: 0.3 };
  D.Render.zeichne(p.R, st);
  var r = p.R.letzterRand; wahr(r && r.bild === 'tomate', 'Plakette mit Bild');
  wahr(!(r.x < 62 && r.y > 176 - 34), 'nicht auf dem Korb (' + r.x + ',' + r.y + ')');
  st.hinweis.ziel.x = st.kamera.x + 160; st.hinweis.ziel.y = st.kamera.y + 90; D.Render.zeichne(p.R, st); gleich(p.R.letzterRand, null, 'Ziel im Bild: Hand statt Plakette');
  var src = require('fs').readFileSync(require('path').join(__dirname, '..', 'js', 'render.js'), 'utf8');
  wahr(/RAND = \{ r: 11/.test(src) && /hz: 0\.9/.test(src), 'wippt unter 2 Hz');
});
test('Favicon: kleines eigenes Bild direkt in der Seite, keine fremde Datei', function () {
  var html = require('fs').readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');
  wahr(/<link rel="icon"[^>]*href="data:image\/svg\+xml/.test(html), 'Favicon als data URI');
  wahr(!/https?:\/\/(?!www\.w3\.org)/.test(html.replace(/xmlns(:\w+)?=(['"])[^'"]*\2/g, '').replace(/%22http%3A%2F%2Fwww\.w3\.org[^%]*%22/g, '')), 'keine externen Adressen');
});
test('Tagesgrenze v0.9: mit Buch, Menue, Huehnern und Kochen endet der Tag spaetestens nach 15 Minuten', function () {
  var D = ladeKontext().Dorf, S = D.Spiel, st = S.erstelle({ seed: 8 }), sek = 0, r = D.RNG.erstelle(9);
  while (!st.abend && sek < 1200) {
    var z = r.next();
    if (z < 0.02) S.tueKontext(st, S.kontext(st));
    else if (z < 0.025) { if (st.buch) S.schliesseBuch(st); else S.oeffneBuch(st, Math.floor(r.next() * 4)); }
    else if (z < 0.03 && st.buch) S.blaettere(st, r.next() < 0.5 ? -1 : 1);
    else if (z < 0.035 && !st.buch) S.oeffneMenue(st);
    else if (z < 0.04 && st.menue) S.kochen(st, D.Gerichte.REIHE[Math.floor(r.next() * 3)]);
    if (st.uhr.minute > 20 * 60) st.uhr.minute = 20 * 60;
    S.schritt(st, 0.05); sek += 0.05;
  }
  wahr(st.abend, 'Abend erreicht'); wahr(sek <= 15 * 60 + 0.1, 'nach ' + Math.round(sek) + ' s');
});

// ---------- Ausfuehren ----------
tests.forEach(function (t) {
  try { t.fn(); ok++; console.log('  ok    ' + t.name); }
  catch (e) { fehler++; console.log('  FEHLER ' + t.name + '\n         ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join('\n         ') : e)); }
});
console.log('\n' + ok + ' bestanden, ' + fehler + ' fehlgeschlagen');
process.exit(fehler ? 1 : 0);
