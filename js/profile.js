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
    { id: 'esel', bild: 'esel', farbe: '#e6defb', rand: '#9a86c8' },
    { id: 'huhn', bild: 'huhn', farbe: '#fff1c9', rand: '#e0ad3e' },
    { id: 'gecko', bild: 'gecko', farbe: '#d4f2e6', rand: '#56b06c' }
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
      return { id: p.id, bild: p.bild, farbe: p.farbe, rand: p.rand, tag: tag, sticker: sticker,
        sek: sekunden(konto, p.id), fertig: fertig(konto, p.id) };
    });
  }

  Dorf.Profile = { LISTE: LISTE, KONTO: KONTO, LETZTES: LETZTES, RUHIG: RUHIG, hole: hole, schluessel: schluessel,
    spielstandSchluessel: spielstandSchluessel, albumSchluessel: albumSchluessel, datum: datum,
    ladeKonto: ladeKonto, schreibeKonto: schreibeKonto, pruefeDatum: pruefeDatum, buche: buche, sekunden: sekunden,
    fertig: fertig, setzeFertig: setzeFertig, gespielt: gespielt, letztes: letztes, merkeLetztes: merkeLetztes,
    ladeRuhig: ladeRuhig, schreibeRuhig: schreibeRuhig, migriere: migriere, uebersicht: uebersicht };
})(globalThis);
