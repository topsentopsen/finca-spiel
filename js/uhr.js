/* Spieluhr 06:00 bis 23:00, ca. 40 s Echtzeit pro Spielstunde, Tageslicht-Toenung. */
(function (g) {
  'use strict';
  var Dorf = g.Dorf = g.Dorf || {};

  var START = 6 * 60, ENDE = 23 * 60, SEK_PRO_STUNDE = 40;

  function erstelle() { return { minute: START, tag: 1 }; }

  // Gibt die vergangenen Spielstunden zurueck.
  function update(uhr, dt) {
    var alt = uhr.minute;
    uhr.minute = Math.min(ENDE, uhr.minute + dt * 60 / SEK_PRO_STUNDE);
    return (uhr.minute - alt) / 60;
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

  Dorf.Uhr = { START: START, ENDE: ENDE, SEK_PRO_STUNDE: SEK_PRO_STUNDE, erstelle: erstelle, update: update, vorbei: vorbei, neuerTag: neuerTag, text: text, phase: phase, toenung: toenung };
})(globalThis);
