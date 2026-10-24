/* Feuerstelle (ab v0.24): im Garten an-/ausmachen, Sitzrunde, Lagerfeuer-Gitarre. */
(function (g) {
  'use strict';
  var Dorf = g.Dorf = g.Dorf || {};
  var K = 16;
  var NAH = 32;
  var GITARRE_NAH = 28;
  // Mitte oestlich vom Hofweg, suedlich der Clastra — klar sichtbar, rundherum Platz
  var MITTE = { x: 24, y: 23 };
  var SITZE = [
    { x: 23, y: 23, dir: 'rechts' },
    { x: 25, y: 23, dir: 'links' },
    { x: 24, y: 22, dir: 'unten' },
    { x: 24, y: 24, dir: 'oben' }
  ];
  var GITARRE = { x: 25, y: 22 };

  function erstelle(karte) {
    var f = {
      tx: MITTE.x, ty: MITTE.y,
      x: MITTE.x * K + 8, y: MITTE.y * K + 12,
      an: false, t: 0, funken: [],
      gitarre: { art: 'lager', x: GITARRE.x, y: GITARRE.y, wackel: 0, schlag: 0 },
      sitze: SITZE.map(function (s) { return { x: s.x, y: s.y, dir: s.dir }; }),
      knisternRest: 0
    };
    if (karte && karte.orte) karte.orte.feuer = f.sitze.map(function (s) { return { x: s.x, y: s.y }; });
    return f;
  }

  function feuerAn(f, wx, wy, rad) {
    if (!f) return false;
    var r = rad || 18;
    return Math.hypot(wx - f.x, wy - (f.y - 4)) <= r;
  }

  function feuerNah(f, sp) {
    if (!f || !sp) return false;
    return Math.hypot(f.x - sp.x, f.y - sp.y) <= NAH;
  }

  function gitarreAn(f, wx, wy, rad) {
    if (!f || !f.gitarre) return false;
    var gx = f.gitarre.x * K + 8, gy = f.gitarre.y * K + 6;
    return Math.hypot(wx - gx, wy - gy) <= (rad || 14);
  }

  function gitarreNah(f, sp) {
    if (!f || !f.gitarre || !sp) return false;
    var gx = f.gitarre.x * K + 8, gy = f.gitarre.y * K + 12;
    return Math.hypot(gx - sp.x, gy - sp.y) <= GITARRE_NAH;
  }

  function nachbar(f, st) {
    if (!f) return null;
    return (typeof Dorf.Spiel !== 'undefined' && Dorf.Spiel)
      ? null
      : null;
  }

  function rufeSitzrunde(f, welt) {
    if (!f || !f.an || !welt || !welt.gaeste || !Dorf.Gaeste) return;
    welt.gaeste.forEach(function (gs) {
      if (gs.ziel === 'feuer' && (gs.zustand === 'unterwegs' || gs.zustand === 'aktiv')) return;
      gs.planPause = 0;
      Dorf.Gaeste.plane(gs, welt, 'feuer');
    });
  }

  function entlasse(f, welt) {
    if (!welt || !welt.gaeste) return;
    welt.gaeste.forEach(function (gs) {
      if (gs.ziel !== 'feuer') return;
      gs.zustand = 'frei'; gs.ziel = null; gs.zielTile = null; gs.pfad = []; gs.pfadIndex = 0; gs.warte = 0.8; gs.portion = false;
    });
  }

  function umschalten(f, welt) {
    if (!f) return false;
    f.an = !f.an;
    f.t = 0;
    if (f.an) {
      f.funken = [];
      rufeSitzrunde(f, welt);
    } else {
      f.funken = [];
      entlasse(f, welt);
    }
    return true;
  }

  function faceFeuer(gast, f) {
    if (!gast || !f) return;
    var dx = f.x - gast.x, dy = f.y - gast.y;
    if (Math.abs(dx) > Math.abs(dy)) gast.dir = dx < 0 ? 'links' : 'rechts';
    else gast.dir = dy < 0 ? 'oben' : 'unten';
    // bevorzugte Sitzrichtung, wenn auf Sitzkachel
    var tx = Math.floor(gast.x / K), ty = Math.floor(gast.y / K);
    for (var i = 0; i < f.sitze.length; i++) {
      if (f.sitze[i].x === tx && f.sitze[i].y === ty) { gast.dir = f.sitze[i].dir; return; }
    }
  }

  function update(f, welt, dt) {
    if (!f) return;
    f.t += dt;
    if (f.gitarre && f.gitarre.wackel > 0) f.gitarre.wackel = Math.max(0, f.gitarre.wackel - dt);
    if (!f.an) { f.funken = []; f.knisternRest = 0; return; }
    // Funken
    if (!welt || !welt.ruhig) {
      if (f.funken.length < 10 && Math.random() < dt * 6) {
        f.funken.push({
          x: f.x + (Math.random() - 0.5) * 6,
          y: f.y - 6,
          vx: (Math.random() - 0.5) * 12,
          vy: -20 - Math.random() * 24,
          t: 0, dauer: 0.5 + Math.random() * 0.5,
          farbe: Math.random() < 0.5 ? '#ffb037' : '#ff6b4a'
        });
      }
      for (var i = f.funken.length - 1; i >= 0; i--) {
        var u = f.funken[i];
        u.t += dt; u.x += u.vx * dt; u.y += u.vy * dt; u.vy += 8 * dt;
        if (u.t >= u.dauer) f.funken.splice(i, 1);
      }
    } else f.funken = [];
    f.knisternRest -= dt;
    // Sitzrunde nachziehen (neu hinzugekommene / abgelenkte Gaeste)
    if (welt && welt.gaeste) rufeSitzrunde(f, welt);
  }

  function knisternFaellig(f) {
    if (!f || !f.an) return false;
    if (f.knisternRest > 0) return false;
    f.knisternRest = 1.6 + Math.random() * 1.4;
    return true;
  }

  Dorf.Feuer = {
    MITTE: MITTE, SITZE: SITZE, GITARRE: GITARRE, NAH: NAH, GITARRE_NAH: GITARRE_NAH,
    erstelle: erstelle, feuerAn: feuerAn, feuerNah: feuerNah,
    gitarreAn: gitarreAn, gitarreNah: gitarreNah,
    umschalten: umschalten, rufeSitzrunde: rufeSitzrunde, entlasse: entlasse,
    faceFeuer: faceFeuer, update: update, knisternFaellig: knisternFaellig, nachbar: nachbar
  };
})(globalThis);
