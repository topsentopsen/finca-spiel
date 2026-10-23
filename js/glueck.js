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
      if (welt.herzchen) welt.herzchen.push({ x: gast.x, y: gast.y - 30, t: 0, farbe: (gast.aussehen && gast.aussehen.farbe) || '#ff7fa0' });
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
