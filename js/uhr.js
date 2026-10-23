/* Spieluhr 06:00 bis 23:00, ca. 40 s Echtzeit pro Spielstunde, Tageslicht-Toenung.
   Ab v0.7 dauert ein Spieltag hoechstens 15 echte Minuten (TAG_LIMIT Sekunden aktives Spielen). */
(function (g) {
  'use strict';
  var Dorf = g.Dorf = g.Dorf || {};

  var START = 6 * 60, ENDE = 23 * 60, SEK_PRO_STUNDE = 40;
  var TAG_LIMIT = 15 * 60;        // harte Grenze in echten Sekunden
  var DAEMMER_SEK = 90;           // so lange vor dem Ende geht sichtbar die Sonne unter
  var DAEMMER_AB = 21.5 * 60;     // oder ab 21:30 Spielzeit

  function erstelle() { return { minute: START, tag: 1 }; }

  // Gibt die vergangenen Spielstunden zurueck.
  // mindest: so viele Spielminuten muessen mindestens vergehen (damit der Tag rechtzeitig endet)
  function update(uhr, dt, mindest) {
    var alt = uhr.minute, schritt = dt * 60 / SEK_PRO_STUNDE;
    if (mindest > schritt) schritt = mindest;
    uhr.minute = Math.min(ENDE, uhr.minute + schritt);
    return (uhr.minute - alt) / 60;
  }
  // Spielminuten, die in diesem Schritt mindestens vergehen muessen, damit der Tag nach TAG_LIMIT echten Sekunden vorbei ist.
  // spielzeit ist schon um echt erhoeht.
  function mindestMinuten(uhr, spielzeit, echt) {
    var restSek = TAG_LIMIT - spielzeit, restMin = ENDE - uhr.minute;
    if (restMin <= 0) return 0;
    if (restSek <= 0) return restMin;
    return restMin * echt / (restSek + echt);
  }
  // Geschaetzte Spielzeit fuer eine Uhrzeit (alte Spielstaende ohne gespeicherte Spielzeit)
  function schaetzeSpielzeit(minute) { return Math.max(0, Math.min(TAG_LIMIT, (minute - START) * SEK_PRO_STUNDE / 60)); }
  // 0 bis 1: wie weit die Daemmerung vor dem Tagesende schon ist (Laternen, sinkende Sonne)
  function daemmerung(uhr, spielzeit) {
    var a = (DAEMMER_SEK - (TAG_LIMIT - (spielzeit || 0))) / DAEMMER_SEK, b = (uhr.minute - DAEMMER_AB) / (ENDE - DAEMMER_AB);
    return Math.max(0, Math.min(1, Math.max(a, b)));
  }
  function vorbei(uhr) { return uhr.minute >= ENDE; }
  function neuerTag(uhr) { uhr.minute = START; uhr.tag += 1; }
  function text(uhr) {
    var m = Math.floor(uhr.minute), hh = Math.floor(m / 60), mm = m % 60;
    return (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm;
  }
  function phase(uhr) {
    var h = uhr.minute / 60;
    if (h < 8) return 'Morgennebel'; if (h < 10) return 'Frühstück'; if (h < 12) return 'Vormittag';
    if (h < 15) return 'Volles Leben'; if (h < 16) return 'Siesta'; if (h < 19) return 'Nachmittag';
    if (h < 22) return 'Abend'; return 'Ausklang';
  }
  var KEYS = [
    [6, 150, 170, 235, 0.30], [8, 255, 240, 220, 0.08], [10, 255, 255, 255, 0], [15, 255, 255, 255, 0],
    [16, 120, 120, 160, 0.06], [18, 255, 170, 80, 0.16], [20, 140, 80, 160, 0.26], [22, 40, 40, 110, 0.45], [23, 30, 30, 90, 0.52]
  ];
  function toenung(uhr) {
    var h = uhr.minute / 60;
    for (var i = 0; i < KEYS.length - 1; i++) {
      var a = KEYS[i], b = KEYS[i + 1];
      if (h >= a[0] && h <= b[0]) {
        var t = (h - a[0]) / (b[0] - a[0]);
        return { r: Math.round(a[1] + (b[1] - a[1]) * t), g: Math.round(a[2] + (b[2] - a[2]) * t), b: Math.round(a[3] + (b[3] - a[3]) * t), a: a[4] + (b[4] - a[4]) * t };
      }
    }
    var l = KEYS[KEYS.length - 1]; return { r: l[1], g: l[2], b: l[3], a: l[4] };
  }

  // ab v0.7: Licht zum Multiplizieren (Farbe pro Uhrzeit) plus wie stark Lampen leuchten.
  // Die Daemmerung vor der 15 Minuten Grenze zieht alles Richtung Nacht, damit das Ende sichtbar angekuendigt wird.
  var LICHT = [
    [6, 0xd6d2f4], [8, 0xfff4e8], [10, 0xffffff], [14, 0xffffff], [15, 0xfff0da], [16.5, 0xfff0da], [17.5, 0xffd9ad],
    [19, 0xffd9ad], [19.75, 0xe7b5cf], [20.5, 0xb8a6e0], [21.5, 0x8e90d6], [23, 0x8e90d6]
  ];
  var NACHT = 0x8e90d6;
  function kanal(f, k) { return (f >> k) & 255; }
  function mische(a, b, t) {
    return { r: Math.round(kanal(a, 16) + (kanal(b, 16) - kanal(a, 16)) * t), g: Math.round(kanal(a, 8) + (kanal(b, 8) - kanal(a, 8)) * t), b: Math.round(kanal(a, 0) + (kanal(b, 0) - kanal(a, 0)) * t) };
  }
  function klemme(v) { return Math.max(0, Math.min(1, v)); }
  function licht(uhr, spielzeit) {
    var h = uhr.minute / 60, d = daemmerung(uhr, spielzeit), f = LICHT[LICHT.length - 1][1];
    for (var i = 0; i < LICHT.length - 1; i++) {
      var a = LICHT[i], b = LICHT[i + 1];
      if (h >= a[0] && h <= b[0]) { var m = mische(a[1], b[1], (h - a[0]) / (b[0] - a[0])); f = (m.r << 16) | (m.g << 8) | m.b; break; }
    }
    if (h < LICHT[0][0]) f = LICHT[0][1];
    var farbe = mische(f, NACHT, d);
    var sonne = klemme((h - 6) / 14);
    if (d > 0) sonne = Math.max(sonne, 0.8 + 0.2 * d);
    return {
      r: farbe.r, g: farbe.g, b: farbe.b, daemmerung: d,
      glut: Math.max(klemme((h - 18.75) / 1.75), klemme((7 - h) / 1) * 0.5, d),   // wie hell Lampen und Fenster leuchten
      lampen: Math.max(klemme((h - 19) / 1.5), d),                                    // Anteil der Lampen, die schon an sind
      sonne: sonne, mond: Math.max(klemme((h - 20) / 2.5), d)
    };
  }

  Dorf.Uhr = { licht: licht, TAG_LIMIT: TAG_LIMIT, DAEMMER_SEK: DAEMMER_SEK, DAEMMER_AB: DAEMMER_AB, mindestMinuten: mindestMinuten, schaetzeSpielzeit: schaetzeSpielzeit, daemmerung: daemmerung, START: START, ENDE: ENDE, SEK_PRO_STUNDE: SEK_PRO_STUNDE, erstelle: erstelle, update: update, vorbei: vorbei, neuerTag: neuerTag, text: text, phase: phase, toenung: toenung };
})(globalThis);
