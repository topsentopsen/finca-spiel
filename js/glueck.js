/* Glueck der Gaeste (ab v0.4): kleine Herzen sammeln, sanftes Tagesziel "Alle Gäste glücklich".
   Herzen gehen nie verloren, es gibt kein Verlieren und keine Strafe. */
(function (g) {
  'use strict';
  var Dorf = g.Dorf = g.Dorf || {};
  var PRO_HERZ = 20, HERZEN = 5, MAX = PRO_HERZ * HERZEN, START = PRO_HERZ;   // jeder Tag beginnt mit einem Herz

  // Wofuer es Glueck gibt. pause = Sekunden, bis derselbe Grund wieder zaehlt.
  var GRUND = {
    reden: { menge: 10, pause: 12 },
    essen: { menge: 15 },
    liebling: { menge: 25 },
    pool: { menge: 10 },
    couch: { menge: 10 },
    tier: { menge: 8, pause: 6 },
    fuettern: { menge: 20, pause: 8 }
  };

  function start(gast) { gast.glueck = START; gast.glueckPause = {}; }
  function herzen(gast) { return Math.floor((gast.glueck || 0) / PRO_HERZ); }
  function gluecklich(gast) { return (gast.glueck || 0) >= MAX; }
  function alle(welt) { return !!(welt.gaeste && welt.gaeste.length) && welt.gaeste.every(gluecklich); }

  function pruefe(welt) {
    if (!welt.tagesziel || welt.tagesziel.erreicht) return false;
    if (!alle(welt)) return false;
    welt.tagesziel.erreicht = true; welt.tagesziel.neu = true;
    return true;
  }

  // Gibt dem Gast Glueck. Rueckgabe: Anzahl neuer Herzen (0 oder mehr).
  function gib(welt, gast, grund) {
    var d = GRUND[grund];
    if (!d || !gast) return 0;
    if (gast.glueck === undefined) start(gast);
    var jetzt = welt.zeit || 0, p = gast.glueckPause;
    if (d.pause) { if (p[grund] !== undefined && jetzt < p[grund]) return 0; p[grund] = jetzt + d.pause; }
    var vor = herzen(gast);
    gast.glueck = Math.min(MAX, gast.glueck + d.menge);
    var neu = herzen(gast) - vor;
    if (neu > 0) {
      var farbe = (gast.aussehen && gast.aussehen.farbe) || '#ff7fa0';
      if (welt.herzchen) {
        // ab v0.8: vier kleine Herzchen steigen auf, der Gast huepft, ein Herz fliegt zu seinem Bild oben
        for (var k = 0; k < 4 && welt.herzchen.length < 40; k++) welt.herzchen.push({ x: gast.x + (k - 1.5) * 4, y: gast.y - 26 - (k % 2) * 3, t: -k * 0.08, farbe: farbe, klein: true });
      }
      gast.hop = 0.25;
      if (welt.herzFlug) { for (var n = 0; n < neu; n++) welt.herzFlug.push({ id: gast.id, x: gast.x, y: gast.y - 28, t: -n * 0.15, dauer: 0.7, farbe: farbe }); }
      if (welt.toene) { welt.toene.push('herz'); if (welt.toene.length > 32) welt.toene.shift(); }
    }
    pruefe(welt);
    return neu;
  }

  function neuerTag(welt) {
    (welt.gaeste || []).forEach(start);
    welt.tagesziel = { erreicht: false, neu: false };
  }

  Dorf.Glueck = { PRO_HERZ: PRO_HERZ, HERZEN: HERZEN, MAX: MAX, START: START, GRUND: GRUND,
    start: start, herzen: herzen, gluecklich: gluecklich, alle: alle, gib: gib, pruefe: pruefe, neuerTag: neuerTag };
})(globalThis);
