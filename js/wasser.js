/* Boot und aufblasbarer Flamingo (ab v0.20).
   Boot liegt am Strand suedlich vom Tor; eingestiegen faehrt man auf MEER/STRAND.
   Flamingo schwimmt im Pool; draufsetzen und wieder aufstehen. */
(function (g) {
  'use strict';
  var Dorf = g.Dorf = g.Dorf || {};
  var K = 16;
  var BOOT_TEMPO = 52;
  var BOOT_NAH = 28;
  var FLAMINGO_NAH = 52;

  function erstelle(karte) {
    var meer = karte.meer;
    // Boot am Strand, etwas links vom Tor (Tor 19/20), damit der Durchgang frei bleibt
    var boot = {
      x: 15 * K + 8, y: (meer ? meer.strandY : 30) * K + 10,
      dir: 'rechts', besetzt: false, ziel: null, pfad: [], pfadIndex: 0, phase: 0
    };
    // Flamingo mittig im Pool (Wasser 25..34 / 3..8)
    var flamingo = {
      x: 29 * K + 8, y: 7 * K + 8,
      besetzt: false, phase: 0
    };
    return { boot: boot, flamingo: flamingo };
  }

  function istWasserTile(karte, t) {
    var T = Dorf.Karte.T;
    return t === T.MEER || t === T.STRAND || t === T.TOR;
  }

  // Raster nur fuer Bootfahrt: Meer, Strand und Tor sind frei
  function meerGrid(karte) {
    var T = Dorf.Karte.T;
    return {
      w: karte.w, h: karte.h,
      blockiert: function (x, y) {
        var t = karte.tile(x, y);
        return !(t === T.MEER || t === T.STRAND || t === T.TOR);
      }
    };
  }

  function bootKollidiert(karte, x, y) {
    var l = Math.floor((x - 6) / K), r = Math.floor((x + 5) / K);
    var o = Math.floor((y - 4) / K), u = Math.floor((y + 2) / K);
    return !istWasserTile(karte, karte.tile(l, o)) || !istWasserTile(karte, karte.tile(r, o))
      || !istWasserTile(karte, karte.tile(l, u)) || !istWasserTile(karte, karte.tile(r, u));
  }

  function bootAn(w, wx, wy, rad) {
    if (!w || !w.boot) return null;
    var b = w.boot, d = Math.hypot(wx - b.x, wy - (b.y - 4));
    return d <= (rad || 14) ? b : null;
  }

  function flamingoAn(w, wx, wy, rad) {
    if (!w || !w.flamingo) return null;
    var f = w.flamingo, d = Math.hypot(wx - f.x, wy - (f.y - 6));
    return d <= (rad || 16) ? f : null;
  }

  function bootNah(w, sp) {
    if (!w || !w.boot || !sp) return false;
    return Math.hypot(w.boot.x - sp.x, w.boot.y - sp.y) <= BOOT_NAH;
  }

  function flamingoNah(w, sp) {
    if (!w || !w.flamingo || !sp) return false;
    return Math.hypot(w.flamingo.x - sp.x, (w.flamingo.y - 4) - sp.y) <= FLAMINGO_NAH;
  }

  function aufStrand(karte, x, y) {
    var T = Dorf.Karte.T, t = karte.tile(Math.floor(x / K), Math.floor(y / K));
    return t === T.STRAND || t === T.TOR;
  }

  function einsteigen(w, sp) {
    if (!w || !w.boot || w.boot.besetzt || (w.flamingo && w.flamingo.besetzt)) return false;
    if (!bootNah(w, sp)) return false;
    w.boot.besetzt = true; w.boot.ziel = null; w.boot.pfad = []; w.boot.pfadIndex = 0;
    sp.x = w.boot.x; sp.y = w.boot.y; sp.dir = w.boot.dir;
    Dorf.Spieler.stoppe(sp);
    return true;
  }

  function aussteigen(w, sp, karte) {
    if (!w || !w.boot || !w.boot.besetzt) return false;
    if (!aufStrand(karte, w.boot.x, w.boot.y)) return false;
    w.boot.besetzt = false; w.boot.ziel = null; w.boot.pfad = []; w.boot.pfadIndex = 0;
    // Biel etwas neben/hinter dem Boot auf den Sand
    var nx = w.boot.x, ny = w.boot.y - 10;
    if (Dorf.Spieler.kollidiert(karte, nx, ny)) { nx = w.boot.x; ny = w.boot.y + 4; }
    if (Dorf.Spieler.kollidiert(karte, nx, ny)) { nx = 19 * K + 8; ny = (karte.meer ? karte.meer.strandY : 30) * K + 12; }
    sp.x = nx; sp.y = ny; Dorf.Spieler.stoppe(sp);
    return true;
  }

  function setzeBootZiel(w, karte, tx, ty) {
    if (!w || !w.boot || !w.boot.besetzt) return false;
    var T = Dorf.Karte.T, t = karte.tile(tx, ty);
    if (t !== T.MEER && t !== T.STRAND && t !== T.TOR) return false;
    var b = w.boot, von = { x: Math.floor(b.x / K), y: Math.floor(b.y / K) };
    var p = Dorf.Pfad.suche(meerGrid(karte), von.x, von.y, tx, ty);
    if (!p) return false;
    b.pfad = p; b.pfadIndex = 0; b.ziel = { x: tx, y: ty };
    return true;
  }

  function poolRandPlatz(karte, sp) {
    var beste = null, bd = Infinity, orte = (karte.orte && karte.orte.pool) || [];
    orte.forEach(function (o) {
      var d = Math.hypot(o.x * K + 8 - sp.x, o.y * K + 12 - sp.y);
      if (d < bd && !karte.blockiert(o.x, o.y)) { bd = d; beste = o; }
    });
    if (beste) return { x: beste.x * K + 8, y: beste.y * K + 12 };
    return { x: 25 * K + 8, y: 9 * K + 12 };
  }

  function aufFlamingo(w, sp) {
    if (!w || !w.flamingo || w.flamingo.besetzt || (w.boot && w.boot.besetzt)) return false;
    if (!flamingoNah(w, sp)) return false;
    w.flamingo.besetzt = true;
    sp.x = w.flamingo.x; sp.y = w.flamingo.y - 2; sp.dir = 'unten';
    Dorf.Spieler.stoppe(sp);
    return true;
  }

  function abFlamingo(w, sp, karte) {
    if (!w || !w.flamingo || !w.flamingo.besetzt) return false;
    w.flamingo.besetzt = false;
    var p = poolRandPlatz(karte, sp);
    sp.x = p.x; sp.y = p.y; Dorf.Spieler.stoppe(sp);
    return true;
  }

  function updateBoot(w, karte, sp, eingabe, dt) {
    var b = w.boot; if (!b || !b.besetzt) { if (b) b.phase += dt; return; }
    b.phase += dt;
    var dx = 0, dy = 0;
    if (eingabe) {
      if (eingabe.halt('links')) dx -= 1;
      if (eingabe.halt('rechts')) dx += 1;
      if (eingabe.halt('hoch')) dy -= 1;
      if (eingabe.halt('runter')) dy += 1;
    }
    if ((dx || dy) && b.ziel) { b.ziel = null; b.pfad = []; b.pfadIndex = 0; }
    if (dx && dy) { dx *= Math.SQRT1_2; dy *= Math.SQRT1_2; }
    if (dx || dy) {
      if (Math.abs(dx) > Math.abs(dy)) b.dir = dx < 0 ? 'links' : 'rechts';
      else if (dy) b.dir = dy < 0 ? 'oben' : 'unten';
      var nx = b.x + dx * BOOT_TEMPO * dt; if (!bootKollidiert(karte, nx, b.y)) b.x = nx;
      var ny = b.y + dy * BOOT_TEMPO * dt; if (!bootKollidiert(karte, b.x, ny)) b.y = ny;
    } else if (b.ziel) {
      var rest = BOOT_TEMPO * dt;
      while (rest > 0 && b.pfadIndex < b.pfad.length) {
        var n = b.pfad[b.pfadIndex], zx = n.x * K + 8, zy = n.y * K + 10;
        var ex = zx - b.x, ey = zy - b.y, dist = Math.sqrt(ex * ex + ey * ey);
        if (dist > 0.01) {
          if (Math.abs(ex) > Math.abs(ey)) b.dir = ex < 0 ? 'links' : 'rechts';
          else b.dir = ey < 0 ? 'oben' : 'unten';
        }
        if (dist <= rest) { b.x = zx; b.y = zy; b.pfadIndex++; rest -= dist; }
        else { b.x += ex / dist * rest; b.y += ey / dist * rest; rest = 0; }
      }
      if (b.pfadIndex >= b.pfad.length) { b.ziel = null; b.pfad = []; b.pfadIndex = 0; }
    }
    sp.x = b.x; sp.y = b.y; sp.dir = b.dir; sp.laeuft = !!(dx || dy || b.ziel);
    if (sp.laeuft) { sp.animT = (sp.animT || 0) + dt; sp.frame = Math.floor(sp.animT * 6) % 4; }
    else { sp.animT = 0; sp.frame = 0; }
  }

  function updateFlamingo(w, sp, dt) {
    var f = w.flamingo; if (!f) return;
    f.phase += dt;
    if (f.besetzt && sp) {
      var bob = Math.sin(f.phase * 2.2) * 1.5;
      sp.x = f.x; sp.y = f.y - 2 + bob; sp.laeuft = false; sp.frame = 0; sp.dir = 'unten';
    }
  }

  function update(w, karte, sp, eingabe, dt) {
    if (!w) return;
    updateBoot(w, karte, sp, eingabe, dt);
    updateFlamingo(w, sp, dt);
  }

  function besetzt(w) {
    return !!(w && ((w.boot && w.boot.besetzt) || (w.flamingo && w.flamingo.besetzt)));
  }

  Dorf.Wasser = {
    BOOT_TEMPO: BOOT_TEMPO, BOOT_NAH: BOOT_NAH, FLAMINGO_NAH: FLAMINGO_NAH,
    erstelle: erstelle, update: update, besetzt: besetzt,
    bootAn: bootAn, flamingoAn: flamingoAn, bootNah: bootNah, flamingoNah: flamingoNah,
    einsteigen: einsteigen, aussteigen: aussteigen, setzeBootZiel: setzeBootZiel,
    aufFlamingo: aufFlamingo, abFlamingo: abFlamingo, meerGrid: meerGrid, aufStrand: aufStrand
  };
})(globalThis);
