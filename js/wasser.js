/* Boot und aufblasbarer Flamingo (ab v0.20).
   v0.21: Boot nur auf MEER (kein Strand-Cruise).
   v0.22: Flamingo treibt/steuerbar im Pool; Boot-Ausstieg am Ufer zuverlaessiger. */
(function (g) {
  'use strict';
  var Dorf = g.Dorf = g.Dorf || {};
  var K = 16;
  var BOOT_TEMPO = 52;
  var BOOT_NAH = 28;
  var FLAMINGO_NAH = 52;
  var FLAMINGO_TEMPO = 38;
  var FLAMINGO_TREIB = 12;
  var AUSSTIEG_NAH = 44;   // ab v0.22: Ausstieg wenn Boot so nah am Sand

  function erstelle(karte) {
    var meer = karte.meer;
    var boot = {
      x: 15 * K + 8, y: (meer ? meer.strandY : 30) * K + 10,
      dir: 'rechts', besetzt: false, ziel: null, pfad: [], pfadIndex: 0, phase: 0
    };
    // Flamingo mittig im Pool (Wasser 25..34 / 3..8)
    var flamingo = {
      x: 29 * K + 8, y: 7 * K + 8,
      besetzt: false, phase: 0, dir: 'rechts',
      vx: FLAMINGO_TREIB * 0.6, vy: 0, ziel: null, dreh: 0
    };
    return { boot: boot, flamingo: flamingo };
  }

  function tileAn(karte, x, y) {
    return karte.tile(Math.floor(x / K), Math.floor(y / K));
  }

  function istMeer(t) {
    return t === Dorf.Karte.T.MEER;
  }

  function istLande(t) {
    var T = Dorf.Karte.T;
    return t === T.STRAND || t === T.TOR;
  }

  function bootTiles(karte, x, y) {
    var pts = [
      [x - 6, y - 4], [x + 5, y - 4],
      [x - 6, y + 2], [x + 5, y + 2]
    ];
    var out = [], i;
    for (i = 0; i < pts.length; i++) out.push(tileAn(karte, pts[i][0], pts[i][1]));
    return out;
  }

  function bootKollidiert(karte, x, y, altX, altY) {
    var ts = bootTiles(karte, x, y), i;
    for (i = 0; i < ts.length; i++) {
      if (!istMeer(ts[i]) && !istLande(ts[i])) return true;
    }
    var mitte = tileAn(karte, x, y);
    if (istMeer(mitte)) return false;
    if (istLande(mitte)) {
      if (altX == null || altY == null) return false;
      var altMitte = tileAn(karte, altX, altY);
      if (istLande(altMitte)) return true;
      return false;
    }
    return true;
  }

  function meerGrid(karte, landeZiel) {
    var T = Dorf.Karte.T;
    return {
      w: karte.w, h: karte.h,
      blockiert: function (x, y) {
        var t = karte.tile(x, y);
        if (t === T.MEER) return false;
        if (landeZiel && x === landeZiel.x && y === landeZiel.y && (t === T.STRAND || t === T.TOR)) return false;
        return true;
      }
    };
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

  // Naechstes Strand-/Tor-Tile (Pixelmitte) relativ zur Bootposition
  function naechsterStrand(karte, x, y) {
    var T = Dorf.Karte.T;
    var strandY = (karte.meer && karte.meer.strandY != null) ? karte.meer.strandY : 30;
    var bx = Math.floor(x / K), best = null, bd = Infinity, dx, tx, d, px, py;
    for (dx = -12; dx <= 12; dx++) {
      tx = bx + dx;
      if (tx < 0 || tx >= karte.w) continue;
      if (karte.tile(tx, strandY) !== T.STRAND && karte.tile(tx, strandY) !== T.TOR) continue;
      px = tx * K + 8; py = strandY * K + 10;
      d = Math.hypot(px - x, py - y);
      if (d < bd) { bd = d; best = { x: px, y: py, tx: tx, ty: strandY, d: d }; }
    }
    return best;
  }

  function strandNah(karte, x, y, maxD) {
    if (aufStrand(karte, x, y)) return true;
    var s = naechsterStrand(karte, x, y);
    return !!(s && s.d <= (maxD != null ? maxD : AUSSTIEG_NAH));
  }

  function einsteigen(w, sp) {
    if (!w || !w.boot || w.boot.besetzt || (w.flamingo && w.flamingo.besetzt)) return false;
    if (!bootNah(w, sp)) return false;
    w.boot.besetzt = true; w.boot.ziel = null; w.boot.pfad = []; w.boot.pfadIndex = 0;
    sp.x = w.boot.x; sp.y = w.boot.y; sp.dir = w.boot.dir;
    Dorf.Spieler.stoppe(sp);
    return true;
  }

  // ab v0.22: Ausstieg am Strand oder wenn nah genug am Sand (Boot dockt an)
  function aussteigen(w, sp, karte) {
    if (!w || !w.boot || !w.boot.besetzt) return false;
    var b = w.boot;
    if (!aufStrand(karte, b.x, b.y)) {
      var s = naechsterStrand(karte, b.x, b.y);
      if (!s || s.d > AUSSTIEG_NAH) return false;
      b.x = s.x; b.y = s.y; b.ziel = null; b.pfad = []; b.pfadIndex = 0;
    }
    b.besetzt = false; b.ziel = null; b.pfad = []; b.pfadIndex = 0;
    var nx = b.x, ny = b.y - 10;
    if (Dorf.Spieler.kollidiert(karte, nx, ny)) { nx = b.x; ny = b.y + 4; }
    if (Dorf.Spieler.kollidiert(karte, nx, ny)) {
      nx = 19 * K + 8;
      ny = (karte.meer ? karte.meer.strandY : 30) * K + 12;
    }
    sp.x = nx; sp.y = ny; Dorf.Spieler.stoppe(sp);
    return true;
  }

  function setzeBootZiel(w, karte, tx, ty) {
    if (!w || !w.boot || !w.boot.besetzt) return false;
    var T = Dorf.Karte.T, t = karte.tile(tx, ty), b = w.boot;
    var lande = (t === T.STRAND || t === T.TOR);
    if (t !== T.MEER && !lande) return false;
    if (lande && aufStrand(karte, b.x, b.y)) return false;
    var von = { x: Math.floor(b.x / K), y: Math.floor(b.y / K) };
    var landeZiel = lande ? { x: tx, y: ty } : null;
    var p = Dorf.Pfad.suche(meerGrid(karte, landeZiel), von.x, von.y, tx, ty);
    if (!p) return false;
    var i;
    for (i = 0; i < p.length - (lande ? 1 : 0); i++) {
      if (karte.tile(p[i].x, p[i].y) !== T.MEER && !(i === 0 && aufStrand(karte, b.x, b.y))) return false;
    }
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

  function imPoolWasser(karte, x, y) {
    return tileAn(karte, x, y) === Dorf.Karte.T.WASSER;
  }

  // Flamingo bleibt mit etwas Rand im Poolwasser
  function flamingoKollidiert(karte, x, y) {
    var offs = [[0, 0], [-9, 0], [9, 0], [0, -7], [0, 7], [-6, -5], [6, -5], [-6, 5], [6, 5]];
    var i;
    for (i = 0; i < offs.length; i++) {
      if (!imPoolWasser(karte, x + offs[i][0], y + offs[i][1])) return true;
    }
    return false;
  }

  function aufFlamingo(w, sp) {
    if (!w || !w.flamingo || w.flamingo.besetzt || (w.boot && w.boot.besetzt)) return false;
    if (!flamingoNah(w, sp)) return false;
    w.flamingo.besetzt = true; w.flamingo.ziel = null;
    w.flamingo.vx = 0; w.flamingo.vy = 0;
    sp.x = w.flamingo.x; sp.y = w.flamingo.y - 2; sp.dir = 'unten';
    Dorf.Spieler.stoppe(sp);
    return true;
  }

  function abFlamingo(w, sp, karte) {
    if (!w || !w.flamingo || !w.flamingo.besetzt) return false;
    w.flamingo.besetzt = false; w.flamingo.ziel = null;
    w.flamingo.vx = FLAMINGO_TREIB * 0.5; w.flamingo.vy = 0;
    var p = poolRandPlatz(karte, sp);
    sp.x = p.x; sp.y = p.y; Dorf.Spieler.stoppe(sp);
    return true;
  }

  function setzeFlamingoZiel(w, karte, tx, ty) {
    if (!w || !w.flamingo || !w.flamingo.besetzt) return false;
    if (karte.tile(tx, ty) !== Dorf.Karte.T.WASSER) return false;
    // Ziel darf am Rand liegen; Bewegung stoppt spaeter an flamingoKollidiert
    w.flamingo.ziel = { x: tx * K + 8, y: ty * K + 8 };
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
      var ox = b.x, oy = b.y;
      var nx = b.x + dx * BOOT_TEMPO * dt; if (!bootKollidiert(karte, nx, b.y, ox, oy)) b.x = nx;
      var ny = b.y + dy * BOOT_TEMPO * dt; if (!bootKollidiert(karte, b.x, ny, ox, oy)) b.y = ny;
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

  function bewegeFlamingo(karte, f, dx, dy, tempo, dt) {
    if (!dx && !dy) return false;
    if (dx && dy) { dx *= Math.SQRT1_2; dy *= Math.SQRT1_2; }
    if (Math.abs(dx) > Math.abs(dy)) f.dir = dx < 0 ? 'links' : 'rechts';
    else if (dy) f.dir = dy < 0 ? 'oben' : 'unten';
    var nx = f.x + dx * tempo * dt, ny = f.y + dy * tempo * dt, bewegt = false;
    if (!flamingoKollidiert(karte, nx, f.y)) { f.x = nx; bewegt = true; }
    else if (f.besetzt) { /* Steuer-Bounce: Stop */ }
    else { f.vx = -f.vx; f.dreh = 0.4; }
    if (!flamingoKollidiert(karte, f.x, ny)) { f.y = ny; bewegt = true; }
    else if (!f.besetzt) { f.vy = -f.vy; f.dreh = 0.4; }
    return bewegt;
  }

  function updateFlamingo(w, karte, sp, eingabe, dt) {
    var f = w.flamingo; if (!f) return;
    f.phase += dt;
    if (f.besetzt) {
      var dx = 0, dy = 0;
      if (eingabe) {
        if (eingabe.halt('links')) dx -= 1;
        if (eingabe.halt('rechts')) dx += 1;
        if (eingabe.halt('hoch')) dy -= 1;
        if (eingabe.halt('runter')) dy += 1;
      }
      if ((dx || dy) && f.ziel) f.ziel = null;
      if (dx || dy) {
        bewegeFlamingo(karte, f, dx, dy, FLAMINGO_TEMPO, dt);
      } else if (f.ziel) {
        var ex = f.ziel.x - f.x, ey = f.ziel.y - f.y, dist = Math.hypot(ex, ey);
        if (dist < 2) { f.ziel = null; }
        else {
          bewegeFlamingo(karte, f, ex / dist, ey / dist, FLAMINGO_TEMPO, dt);
          if (Math.hypot(f.ziel.x - f.x, f.ziel.y - f.y) >= dist - 0.01) f.ziel = null; // stecken
        }
      }
      if (sp) {
        var bob = Math.sin(f.phase * 2.2) * 1.5;
        sp.x = f.x; sp.y = f.y - 2 + bob;
        sp.laeuft = !!(dx || dy || f.ziel); sp.frame = 0;
        if (dx || dy || f.ziel) sp.dir = f.dir;
        else sp.dir = 'unten';
      }
      return;
    }
    // Leer: ruhig im Pool treiben
    f.dreh = (f.dreh || 0) - dt;
    if (f.dreh <= 0) {
      f.dreh = 1.8 + (f.phase % 1.7);
      var winkel = (f.phase * 0.35 + f.x * 0.01) % (Math.PI * 2);
      f.vx = Math.cos(winkel) * FLAMINGO_TREIB;
      f.vy = Math.sin(winkel * 0.8) * FLAMINGO_TREIB * 0.7;
    }
    bewegeFlamingo(karte, f, f.vx, f.vy, 1, dt); // vx/vy schon in px/s
    // falls stecken: leichte Korrektur zur Poolmitte
    if (flamingoKollidiert(karte, f.x, f.y)) {
      f.x = 29 * K + 8; f.y = 6 * K + 8; f.vx = FLAMINGO_TREIB; f.vy = 0;
    }
  }

  function update(w, karte, sp, eingabe, dt) {
    if (!w) return;
    updateBoot(w, karte, sp, eingabe, dt);
    updateFlamingo(w, karte, sp, eingabe, dt);
  }

  function besetzt(w) {
    return !!(w && ((w.boot && w.boot.besetzt) || (w.flamingo && w.flamingo.besetzt)));
  }

  Dorf.Wasser = {
    BOOT_TEMPO: BOOT_TEMPO, BOOT_NAH: BOOT_NAH, FLAMINGO_NAH: FLAMINGO_NAH,
    FLAMINGO_TEMPO: FLAMINGO_TEMPO, FLAMINGO_TREIB: FLAMINGO_TREIB, AUSSTIEG_NAH: AUSSTIEG_NAH,
    erstelle: erstelle, update: update, besetzt: besetzt,
    bootAn: bootAn, flamingoAn: flamingoAn, bootNah: bootNah, flamingoNah: flamingoNah,
    einsteigen: einsteigen, aussteigen: aussteigen, setzeBootZiel: setzeBootZiel,
    aufFlamingo: aufFlamingo, abFlamingo: abFlamingo, setzeFlamingoZiel: setzeFlamingoZiel,
    meerGrid: meerGrid, aufStrand: aufStrand, strandNah: strandNah,
    naechsterStrand: naechsterStrand, bootKollidiert: bootKollidiert,
    flamingoKollidiert: flamingoKollidiert
  };
})(globalThis);
