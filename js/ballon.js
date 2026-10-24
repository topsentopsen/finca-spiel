/* Heissluftballon (ab v0.23): bunte Ballons in der Garteneecke, einsteigen und ueber die Finca schweben. */
(function (g) {
  'use strict';
  var Dorf = g.Dorf = g.Dorf || {};
  var K = 16;
  var TEMPO = 44;
  var NAH = 36;
  var FARBEN = ['#ff6b8a', '#ffd35e', '#7ec8e3', '#b8e07a', '#d4a0ff'];

  function parkListe(karte) {
    // Garteneecke suedwestlich nahe den Beeten (Gras), klar sichtbar
    var basen = [
      { x: 5 * K + 8, y: 21 * K + 10, farbe: FARBEN[0], fahrbar: true },
      { x: 7 * K + 8, y: 20 * K + 8, farbe: FARBEN[1], fahrbar: false },
      { x: 3 * K + 10, y: 20 * K + 12, farbe: FARBEN[2], fahrbar: false },
      { x: 6 * K + 4, y: 22 * K + 6, farbe: FARBEN[3], fahrbar: false }
    ];
    return basen.map(function (b, i) {
      return { x: b.x, y: b.y, farbe: b.farbe, fahrbar: b.fahrbar, phase: i * 0.7, dir: 'unten', besetzt: false, ziel: null, parkX: b.x, parkY: b.y };
    });
  }

  function erstelle(karte) {
    var liste = parkListe(karte);
    var aktiv = null;
    liste.forEach(function (b) { if (b.fahrbar && !aktiv) aktiv = b; });
    return { liste: liste, aktiv: aktiv };
  }

  function ballonAn(b, wx, wy, rad) {
    if (!b || !b.liste) return null;
    var r = rad || 20, best = null, bd = r + 1, i, d;
    for (i = 0; i < b.liste.length; i++) {
      var bl = b.liste[i];
      // Korbmitte / Ballonmitte etwas hoeher
      d = Math.hypot(wx - bl.x, wy - (bl.y - 18));
      if (d < bd) { bd = d; best = bl; }
    }
    return best;
  }

  function ballonNah(b, sp) {
    if (!b || !sp) return false;
    var bl = b.aktiv; if (!bl) return false;
    return Math.hypot(bl.x - sp.x, bl.y - sp.y) <= NAH;
  }

  function besetzt(b) {
    return !!(b && b.aktiv && b.aktiv.besetzt);
  }

  function einsteigen(b, sp) {
    if (!b || !b.aktiv || b.aktiv.besetzt) return false;
    if (!ballonNah(b, sp)) return false;
    // Boot/Flamingo nicht gleichzeitig
    b.aktiv.besetzt = true; b.aktiv.ziel = null;
    sp.x = b.aktiv.x; sp.y = b.aktiv.y; sp.dir = 'unten';
    Dorf.Spieler.stoppe(sp);
    return true;
  }

  // Einsteigen in einen bestimmten Ballon (Tipp) — macht ihn zum aktiven
  function einsteigenIn(b, bl, sp) {
    if (!b || !bl || !sp) return false;
    if (b.aktiv && b.aktiv.besetzt) return false;
    if (Math.hypot(bl.x - sp.x, bl.y - sp.y) > NAH + 8) return false;
    b.aktiv = bl;
    bl.fahrbar = true;
    bl.besetzt = true; bl.ziel = null;
    sp.x = bl.x; sp.y = bl.y; sp.dir = 'unten';
    Dorf.Spieler.stoppe(sp);
    return true;
  }

  function freiBoden(karte, x, y) {
    var tx = Math.floor(x / K), ty = Math.floor(y / K);
    if (tx < 1 || ty < 1 || tx >= karte.w - 1 || ty >= karte.h - 1) return false;
    // nicht mitten im Meer aussteigen
    if (karte.tile(tx, ty) === Dorf.Karte.T.MEER) return false;
    return !karte.blockiert(tx, ty);
  }

  function naechsterBoden(karte, x, y) {
    if (freiBoden(karte, x, y)) return { x: x, y: y };
    var best = null, bd = Infinity, dx, dy, nx, ny, d;
    for (dy = -4; dy <= 4; dy++) for (dx = -4; dx <= 4; dx++) {
      nx = x + dx * K; ny = y + dy * K;
      if (!freiBoden(karte, nx, ny)) continue;
      d = Math.hypot(nx - x, ny - y);
      if (d < bd) { bd = d; best = { x: Math.floor(nx / K) * K + 8, y: Math.floor(ny / K) * K + 12 }; }
    }
    return best || { x: 5 * K + 8, y: 21 * K + 10 };
  }

  function aussteigen(b, sp, karte) {
    if (!b || !b.aktiv || !b.aktiv.besetzt) return false;
    var bl = b.aktiv;
    var p = naechsterBoden(karte, bl.x, bl.y);
    bl.besetzt = false; bl.ziel = null;
    bl.x = p.x; bl.y = p.y; bl.parkX = p.x; bl.parkY = p.y;
    // dekorative bleiben; aktiver bleibt wo gelandet
    sp.x = p.x; sp.y = p.y; Dorf.Spieler.stoppe(sp);
    return true;
  }

  function setzeZiel(b, karte, tx, ty) {
    if (!b || !b.aktiv || !b.aktiv.besetzt) return false;
    if (tx < 1 || ty < 1 || tx >= karte.w - 1 || ty >= karte.h - 1) return false;
    // ueber die ganze Karte schweben (auch Meer-Luft), Ausstieg filtert spaeter
    b.aktiv.ziel = { x: tx * K + 8, y: ty * K + 10 };
    return true;
  }

  function clampFlug(karte, x, y) {
    var minX = K + 4, maxX = (karte.w - 1) * K - 4;
    var minY = K + 4, maxY = (karte.h - 1) * K - 4;
    return {
      x: Math.max(minX, Math.min(maxX, x)),
      y: Math.max(minY, Math.min(maxY, y))
    };
  }

  function update(b, karte, sp, eingabe, dt) {
    if (!b) return;
    var i, bl;
    for (i = 0; i < b.liste.length; i++) {
      bl = b.liste[i];
      bl.phase += dt;
      if (!bl.besetzt) {
        // sanftes Schweben am Parkplatz
        var bob = Math.sin(bl.phase * 1.3 + i) * 1.2;
        bl.y = bl.parkY + bob;
        continue;
      }
      // besetzt = fliegen
      var dx = 0, dy = 0;
      if (eingabe) {
        if (eingabe.halt('links')) dx -= 1;
        if (eingabe.halt('rechts')) dx += 1;
        if (eingabe.halt('hoch')) dy -= 1;
        if (eingabe.halt('runter')) dy += 1;
      }
      if ((dx || dy) && bl.ziel) bl.ziel = null;
      if (dx && dy) { dx *= Math.SQRT1_2; dy *= Math.SQRT1_2; }
      if (dx || dy) {
        if (Math.abs(dx) > Math.abs(dy)) bl.dir = dx < 0 ? 'links' : 'rechts';
        else if (dy) bl.dir = dy < 0 ? 'oben' : 'unten';
        var n = clampFlug(karte, bl.x + dx * TEMPO * dt, bl.y + dy * TEMPO * dt);
        bl.x = n.x; bl.y = n.y;
        bl.parkX = bl.x; bl.parkY = bl.y;
      } else if (bl.ziel) {
        var ex = bl.ziel.x - bl.x, ey = bl.ziel.y - bl.y, dist = Math.hypot(ex, ey);
        if (dist < 2) { bl.ziel = null; }
        else {
          if (Math.abs(ex) > Math.abs(ey)) bl.dir = ex < 0 ? 'links' : 'rechts';
          else bl.dir = ey < 0 ? 'oben' : 'unten';
          var schritt = Math.min(dist, TEMPO * dt);
          n = clampFlug(karte, bl.x + ex / dist * schritt, bl.y + ey / dist * schritt);
          bl.x = n.x; bl.y = n.y;
          bl.parkX = bl.x; bl.parkY = bl.y;
        }
      }
      if (sp) {
        var lift = Math.sin(bl.phase * 2) * 1.5;
        sp.x = bl.x; sp.y = bl.y + lift;
        sp.laeuft = !!(dx || dy || bl.ziel); sp.frame = 0;
        if (dx || dy || bl.ziel) sp.dir = bl.dir; else sp.dir = 'unten';
      }
    }
  }

  Dorf.Ballon = {
    TEMPO: TEMPO, NAH: NAH, FARBEN: FARBEN,
    erstelle: erstelle, update: update, besetzt: besetzt,
    ballonAn: ballonAn, ballonNah: ballonNah,
    einsteigen: einsteigen, einsteigenIn: einsteigenIn, aussteigen: aussteigen,
    setzeZiel: setzeZiel
  };
})(globalThis);
