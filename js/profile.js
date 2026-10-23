/* Profile (ab v0.10): jedes Kind waehlt am Anfang sein Bild (Esel, Huhn oder Gecko) und hat einen eigenen
   Spielstand, eigene Herzen und ein eigenes Stickeralbum.
   Zeitregel: pro Profil und Kalendertag hoechstens ein Spieltag (15 Minuten aktives Spielen). Die Zeit steht
   in einem eigenen Tageskonto (finca.zeitkonto), das weder Neu anfangen noch Neuladen noch ein Profilwechsel
   zuruecksetzt. Damit niemand einfach das Bild wechselt, um weiterzuspielen: sobald heute mit einem Profil
   gespielt wurde, geht es beim naechsten Start direkt mit diesem Profil weiter, und ein anderes Bild waehlen
   geht nur ueber den Elternbereich. Um Mitternacht beginnt ein neues Konto. */
(function (g) {
  'use strict';
  var Dorf = g.Dorf = g.Dorf || {};

  var LISTE = [
    { id: 'esel', bild: 'esel', name: 'Esel', wer: 'Der Esel', farbe: '#e6defb', rand: '#9a86c8' },
    { id: 'huhn', bild: 'huhn', name: 'Huhn', wer: 'Das Huhn', farbe: '#fff1c9', rand: '#e0ad3e' },
    { id: 'gecko', bild: 'gecko', name: 'Gecko', wer: 'Der Gecko', farbe: '#d4f2e6', rand: '#56b06c' }
  ];
  var KONTO = 'finca.zeitkonto', LETZTES = 'finca.profil', RUHIG = 'finca.ruhig';
  var MAX_SEK = 24 * 3600;

  function hole(id) { for (var i = 0; i < LISTE.length; i++) if (LISTE[i].id === id) return LISTE[i]; return null; }
  function schluessel(basis, id) { return basis + '.' + id; }
  function spielstandSchluessel(id) { return schluessel(Dorf.Speicher ? Dorf.Speicher.SCHLUESSEL : 'finca.spielstand', id); }
  function albumSchluessel(id) { return schluessel(Dorf.Sticker ? Dorf.Sticker.SCHLUESSEL : 'finca.album', id); }

  function zwei(n) { return (n < 10 ? '0' : '') + n; }
  // Kalendertag in Ortszeit als 'JJJJ-MM-TT'
  function datum(d) { return d.getFullYear() + '-' + zwei(d.getMonth() + 1) + '-' + zwei(d.getDate()); }

  function lies(sp, k) { try { return sp ? sp.getItem(k) : null; } catch (e) { return null; } }
  function schreib(sp, k, v) { try { if (sp) { sp.setItem(k, v); return true; } } catch (e) { /* privat */ } return false; }
  function weg(sp, k) { try { if (sp) { if (sp.removeItem) sp.removeItem(k); else sp.setItem(k, ''); } } catch (e) { /* egal */ } }

  function leer(heute) { return { datum: heute, profile: {} }; }
  function ladeKonto(sp, heute) {
    var roh = lies(sp, KONTO), k = null;
    try { k = roh ? JSON.parse(roh) : null; } catch (e) { k = null; }
    if (!k || typeof k !== 'object' || k.datum !== heute || !k.profile || typeof k.profile !== 'object') return leer(heute);
    var sauber = leer(heute);
    LISTE.forEach(function (p) {
      var e = k.profile[p.id];
      if (e && typeof e === 'object') {
        var s = (typeof e.sek === 'number' && isFinite(e.sek)) ? Math.max(0, Math.min(MAX_SEK, e.sek)) : 0;
        sauber.profile[p.id] = { sek: s, fertig: !!e.fertig };
      }
    });
    return sauber;
  }
  function schreibeKonto(sp, konto) { return schreib(sp, KONTO, JSON.stringify(konto)); }
  // Neuer Kalendertag: alles wieder frei. Rueckgabe true, wenn das Konto neu begonnen hat.
  function pruefeDatum(konto, heute) {
    if (konto.datum === heute) return false;
    konto.datum = heute; konto.profile = {};
    return true;
  }
  function eintrag(konto, id) { return konto.profile[id] || (konto.profile[id] = { sek: 0, fertig: false }); }
  function buche(konto, id, sek) { var e = eintrag(konto, id); e.sek = Math.min(MAX_SEK, e.sek + Math.max(0, sek)); return e.sek; }
  function sekunden(konto, id) { var e = konto && konto.profile[id]; return e ? e.sek : 0; }
  function fertig(konto, id) { var e = konto && konto.profile[id]; return !!(e && e.fertig); }
  function setzeFertig(konto, id) { eintrag(konto, id).fertig = true; }
  function gespielt(konto, id) { return sekunden(konto, id) > 0 || fertig(konto, id); }

  function letztes(sp) { var id = lies(sp, LETZTES); return hole(id) ? id : null; }
  function merkeLetztes(sp, id) { return schreib(sp, LETZTES, id); }
  function ladeRuhig(sp, std) { var v = lies(sp, RUHIG); return v === '1' ? true : (v === '0' ? false : !!std); }
  function schreibeRuhig(sp, an) { return schreib(sp, RUHIG, an ? '1' : '0'); }

  // Alte Spielstaende (bis v0.9, ein gemeinsamer Stand) gehoeren ab jetzt dem Esel-Profil
  function migriere(sp) {
    if (!sp) return false;
    var geaendert = false;
    [Dorf.Speicher ? Dorf.Speicher.SCHLUESSEL : 'finca.spielstand', Dorf.Sticker ? Dorf.Sticker.SCHLUESSEL : 'finca.album'].forEach(function (basis) {
      var alt = lies(sp, basis);
      if (!alt) return;
      if (!lies(sp, schluessel(basis, 'esel'))) schreib(sp, schluessel(basis, 'esel'), alt);
      weg(sp, basis); geaendert = true;
    });
    return geaendert;
  }

  // Fuer die Auswahl und den Elternbereich: Tag und Stickerzahl je Profil
  function uebersicht(sp, konto) {
    return LISTE.map(function (p) {
      var tag = 0, sticker = 0, d = null;
      try { d = JSON.parse(lies(sp, spielstandSchluessel(p.id)) || 'null'); } catch (e) { d = null; }
      if (d && typeof d.tag === 'number' && isFinite(d.tag)) tag = Math.max(1, Math.min(9999, Math.floor(d.tag)));
      if (Dorf.Sticker) sticker = Dorf.Sticker.anzahl(Dorf.Sticker.lade(sp, albumSchluessel(p.id)));
      return { id: p.id, bild: p.bild, name: p.name, farbe: p.farbe, rand: p.rand, tag: tag, sticker: sticker,
        sek: sekunden(konto, p.id), fertig: fertig(konto, p.id) };
    });
  }

  // ---------- ab v0.11: Minuten pro Bild (5 bis 15, nie ueber die harte Grenze) ----------
  var GRENZEN = 'finca.grenzen', WOCHE = 'finca.woche', MIN_GRENZE = 5, WOCHE_TAGE = 14, CODE_KOPF = 'FINCA1';
  function maxGrenze() { return Math.floor(((Dorf.Uhr && Dorf.Uhr.TAG_LIMIT) || 900) / 60); }
  function klemmeGrenze(v) {
    var m = maxGrenze();
    if (typeof v !== 'number' || !isFinite(v)) return m;
    return Math.max(MIN_GRENZE, Math.min(m, Math.round(v)));
  }
  function ladeGrenzen(sp) {
    var roh = lies(sp, GRENZEN), d = null, aus = {};
    try { d = roh ? JSON.parse(roh) : null; } catch (e) { d = null; }
    LISTE.forEach(function (p) { if (d && typeof d === 'object' && typeof d[p.id] === 'number') aus[p.id] = klemmeGrenze(d[p.id]); });
    return aus;
  }
  function schreibeGrenzen(sp, gr) {
    var aus = {};
    LISTE.forEach(function (p) { if (gr && typeof gr[p.id] === 'number') aus[p.id] = klemmeGrenze(gr[p.id]); });
    return schreib(sp, GRENZEN, JSON.stringify(aus));
  }
  function grenze(gr, id) { return gr && typeof gr[id] === 'number' ? klemmeGrenze(gr[id]) : maxGrenze(); }
  // Schlaeft das Bild heute? Entweder schon ins Bett gegangen oder die eingestellten Minuten sind voll
  function schlaeft(konto, gr, id) { return fertig(konto, id) || sekunden(konto, id) >= grenze(gr, id) * 60; }
  // Eltern geben mehr Minuten: wer noch mindestens eine halbe Minute uebrig hat, wacht wieder auf
  function entsperre(konto, gr) {
    var auf = [];
    if (!konto) return auf;
    LISTE.forEach(function (p) {
      var e = konto.profile[p.id];
      if (e && e.fertig && e.sek < grenze(gr, p.id) * 60 - 30) { e.fertig = false; auf.push(p.id); }
    });
    return auf;
  }

  // ---------- ab v0.11: Wochenrueckblick (Sekunden je Kalendertag und Bild, 14 Tage aufbewahrt) ----------
  function verschiebe(tag, k) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(tag || '');
    if (!m) return tag;
    var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + k));
    return d.getUTCFullYear() + '-' + zwei(d.getUTCMonth() + 1) + '-' + zwei(d.getUTCDate());
  }
  function ladeWoche(sp) {
    var roh = lies(sp, WOCHE), d = null, w = { tage: {}, grenzen: {} };
    try { d = roh ? JSON.parse(roh) : null; } catch (e) { d = null; }
    if (d && d.tage && typeof d.tage === 'object') Object.keys(d.tage).forEach(function (t) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(t) || !d.tage[t] || typeof d.tage[t] !== 'object') return;
      var e = {};
      LISTE.forEach(function (p) { var v = d.tage[t][p.id]; if (typeof v === 'number' && isFinite(v) && v > 0) e[p.id] = Math.min(MAX_SEK, Math.round(v)); });
      w.tage[t] = e;
    });
    // ab v0.12: die Grenze (Minuten) jedes Tages, damit der Balken weiss, ob der Tag vor der Grenze endete
    if (d && d.grenzen && typeof d.grenzen === 'object') Object.keys(d.grenzen).forEach(function (t) {
      if (!w.tage[t] || !d.grenzen[t] || typeof d.grenzen[t] !== 'object') return;
      var e = {};
      LISTE.forEach(function (p) { var v = d.grenzen[t][p.id]; if (typeof v === 'number' && isFinite(v)) e[p.id] = klemmeGrenze(v); });
      w.grenzen[t] = e;
    });
    return w;
  }
  function merkeWoche(w, konto, gr) {
    w = w && w.tage ? w : { tage: {} };
    if (!w.grenzen || typeof w.grenzen !== 'object') w.grenzen = {};
    if (!konto || !konto.datum) return w;
    var e = {}, ge = {};
    LISTE.forEach(function (p) { var s = sekunden(konto, p.id); if (s > 0) { e[p.id] = Math.round(s); ge[p.id] = grenze(gr, p.id); } });
    w.tage[konto.datum] = e;
    if (gr !== undefined) w.grenzen[konto.datum] = ge;
    var grenzTag = verschiebe(konto.datum, -(WOCHE_TAGE - 1));
    Object.keys(w.tage).forEach(function (t) { if (t < grenzTag || t > konto.datum) delete w.tage[t]; });
    Object.keys(w.grenzen).forEach(function (t) { if (!w.tage[t]) delete w.grenzen[t]; });
    return w;
  }
  function schreibeWoche(sp, w) { return schreib(sp, WOCHE, JSON.stringify(w && w.tage ? { tage: w.tage, grenzen: w.grenzen || {} } : { tage: {}, grenzen: {} })); }
  // ab v0.12: ein Tag blieb im Rahmen, wenn gespielt wurde und der Tag mindestens 30 Sekunden vor der Grenze endete
  // (ganz ohne Belohnung, nur ein sanft gruener Balken fuer die Eltern)
  var RAHMEN_LUFT = 30;
  function imRahmen(sek, grenzeMin) { var g = typeof grenzeMin === 'number' && isFinite(grenzeMin) ? grenzeMin : maxGrenze(); return sek > 0 && sek <= g * 60 - RAHMEN_LUFT; }
  // Die letzten 7 Kalendertage, aeltester zuerst. Heute kommt immer frisch aus dem Konto.
  function letzteWoche(w, konto, heute, gr) {
    var aus = [];
    for (var k = 6; k >= 0; k--) {
      var t = verschiebe(heute, -k), sek = {};
      var e = w && w.tage ? w.tage[t] : null;
      LISTE.forEach(function (p) { sek[p.id] = e && e[p.id] ? e[p.id] : 0; });
      var heuteDa = k === 0 && konto && konto.datum === t;
      if (heuteDa) LISTE.forEach(function (p) { sek[p.id] = Math.max(sek[p.id], sekunden(konto, p.id)); });
      // ab v0.12: Grenze des Tages (alte Tage ohne Eintrag: 15) und ob der Tag im Rahmen blieb. Heute erst, wenn er vorbei ist.
      var gt = w && w.grenzen ? w.grenzen[t] : null, gz = {}, gruen = {};
      LISTE.forEach(function (p) {
        gz[p.id] = k === 0 && gr ? grenze(gr, p.id) : (gt && typeof gt[p.id] === 'number' ? gt[p.id] : maxGrenze());
        gruen[p.id] = imRahmen(sek[p.id], gz[p.id]) && (k > 0 || !!(heuteDa && fertig(konto, p.id)));
      });
      aus.push({ datum: t, sek: sek, grenze: gz, gruen: gruen });
    }
    return aus;
  }

  // ---------- ab v0.11: Sicherung als Text-Code (Spielstaende, Alben, Einstellungen; nie das Zeitkonto) ----------
  function erlaubt(k) {
    if (k === GRENZEN || k === RUHIG || k === LETZTES || k === 'finca.stumm' || k === 'finca.vorlesen' || k === 'finca.vorleseart') return true;
    for (var i = 0; i < LISTE.length; i++) if (k === spielstandSchluessel(LISTE[i].id) || k === albumSchluessel(LISTE[i].id)) return true;
    return false;
  }
  function erlaubteSchluessel() {
    var l = [GRENZEN, RUHIG, LETZTES, 'finca.stumm', 'finca.vorlesen', 'finca.vorleseart'];
    LISTE.forEach(function (p) { l.push(spielstandSchluessel(p.id), albumSchluessel(p.id)); });
    return l;
  }
  function utf8(str) {
    var b = [];
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      if (c >= 0xd800 && c < 0xdc00 && i + 1 < str.length) { var c2 = str.charCodeAt(i + 1); if (c2 >= 0xdc00 && c2 < 0xe000) { c = 0x10000 + ((c - 0xd800) << 10) + (c2 - 0xdc00); i++; } }
      if (c < 0x80) b.push(c);
      else if (c < 0x800) b.push(0xc0 | c >> 6, 0x80 | c & 63);
      else if (c < 0x10000) b.push(0xe0 | c >> 12, 0x80 | c >> 6 & 63, 0x80 | c & 63);
      else b.push(0xf0 | c >> 18, 0x80 | c >> 12 & 63, 0x80 | c >> 6 & 63, 0x80 | c & 63);
    }
    return b;
  }
  function ausUtf8(b) {
    var s = '', i = 0;
    while (i < b.length) {
      var c = b[i++], cp;
      if (c < 0x80) cp = c;
      else if (c < 0xe0) cp = (c & 31) << 6 | b[i++] & 63;
      else if (c < 0xf0) { cp = (c & 15) << 12 | (b[i++] & 63) << 6; cp |= b[i++] & 63; }
      else { cp = (c & 7) << 18 | (b[i++] & 63) << 12; cp |= (b[i++] & 63) << 6; cp |= b[i++] & 63; }
      if (cp >= 0x10000) { cp -= 0x10000; s += String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 1023)); }
      else s += String.fromCharCode(cp);
    }
    return s;
  }
  var B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  function zuB64(b) {
    var s = '';
    for (var i = 0; i < b.length; i += 3) {
      var n = b[i] << 16 | (b[i + 1] || 0) << 8 | (b[i + 2] || 0);
      s += B64[n >> 18 & 63] + B64[n >> 12 & 63] + (i + 1 < b.length ? B64[n >> 6 & 63] : '=') + (i + 2 < b.length ? B64[n & 63] : '=');
    }
    return s;
  }
  function ausB64(s) {
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(s) || s.length % 4) return null;
    var b = [];
    for (var i = 0; i < s.length; i += 4) {
      var n = 0, pad = 0;
      for (var j = 0; j < 4; j++) { var ch = s[i + j]; if (ch === '=') { pad++; n <<= 6; } else n = n << 6 | B64.indexOf(ch); }
      b.push(n >> 16 & 255); if (pad < 2) b.push(n >> 8 & 255); if (pad < 1) b.push(n & 255);
    }
    return b;
  }
  function pruefsumme(text) {
    var h = 5381;
    for (var i = 0; i < text.length; i++) h = ((h * 33) ^ text.charCodeAt(i)) >>> 0;
    return ('000' + (h & 0xffff).toString(16)).slice(-4);
  }
  function sicherungsCode(sp) {
    var d = {};
    erlaubteSchluessel().forEach(function (k) { var v = lies(sp, k); if (v !== null && v !== undefined && v !== '') d[k] = String(v); });
    var b = zuB64(utf8(JSON.stringify({ v: 1, d: d })));
    return CODE_KOPF + '-' + pruefsumme(b) + '-' + b;
  }
  function liesCode(code) {
    var c = String(code || '').replace(/\s+/g, '');
    if (!c) return { ok: false, grund: 'leer' };
    var m = /^FINCA1-([0-9a-f]{4})-([A-Za-z0-9+/=]+)$/.exec(c);
    if (!m) return { ok: false, grund: 'form' };
    if (pruefsumme(m[2]) !== m[1]) return { ok: false, grund: 'pruefsumme' };
    var b = ausB64(m[2]), roh = null;
    try { roh = b ? JSON.parse(ausUtf8(b)) : null; } catch (e) { roh = null; }
    if (!roh || roh.v !== 1 || !roh.d || typeof roh.d !== 'object') return { ok: false, grund: 'inhalt' };
    var daten = {}, n = 0;
    Object.keys(roh.d).forEach(function (k) { if (erlaubt(k) && typeof roh.d[k] === 'string') { daten[k] = roh.d[k]; n++; } });
    return { ok: true, daten: daten, anzahl: n };
  }
  // Uebernimmt nur erlaubte Schluessel. Was im Code fehlt, wird auf diesem Geraet geleert (der Code ersetzt den Stand).
  function uebernimmCode(sp, code) {
    var r = liesCode(code);
    if (!r.ok) return r;
    erlaubteSchluessel().forEach(function (k) { if (Object.prototype.hasOwnProperty.call(r.daten, k)) schreib(sp, k, r.daten[k]); else weg(sp, k); });
    return r;
  }

  Dorf.Profile = { GRENZEN: GRENZEN, WOCHE: WOCHE, MIN_GRENZE: MIN_GRENZE, WOCHE_TAGE: WOCHE_TAGE, CODE_KOPF: CODE_KOPF,
    maxGrenze: maxGrenze, klemmeGrenze: klemmeGrenze, ladeGrenzen: ladeGrenzen, schreibeGrenzen: schreibeGrenzen, grenze: grenze,
    schlaeft: schlaeft, entsperre: entsperre, verschiebe: verschiebe, ladeWoche: ladeWoche, merkeWoche: merkeWoche,
    schreibeWoche: schreibeWoche, letzteWoche: letzteWoche, imRahmen: imRahmen, RAHMEN_LUFT: RAHMEN_LUFT, erlaubt: erlaubt, sicherungsCode: sicherungsCode, liesCode: liesCode,
    uebernimmCode: uebernimmCode, pruefsumme: pruefsumme,
    LISTE: LISTE, KONTO: KONTO, LETZTES: LETZTES, RUHIG: RUHIG, hole: hole, schluessel: schluessel,
    spielstandSchluessel: spielstandSchluessel, albumSchluessel: albumSchluessel, datum: datum,
    ladeKonto: ladeKonto, schreibeKonto: schreibeKonto, pruefeDatum: pruefeDatum, buche: buche, sekunden: sekunden,
    fertig: fertig, setzeFertig: setzeFertig, gespielt: gespielt, letztes: letztes, merkeLetztes: merkeLetztes,
    ladeRuhig: ladeRuhig, schreibeRuhig: schreibeRuhig, migriere: migriere, uebersicht: uebersicht };
})(globalThis);
