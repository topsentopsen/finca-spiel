/* Spielstand (ab v0.6): Tag, Uhrzeit, Herzen, Korb, Garten und Tafel bleiben im Browser (localStorage).
   Mit Formatnummer, damit spaetere Versionen alte Spielstaende erkennen. Kaputte oder fremde Daten werden
   einfach ignoriert, dann beginnt ein frischer Tag. Der Ton (an/aus) hat seit v0.3 einen eigenen Schluessel
   und bleibt deshalb auch nach "Neu anfangen" so, wie er war. */
(function (g) {
  'use strict';
  var Dorf = g.Dorf = g.Dorf || {};
  var SCHLUESSEL = 'finca.spielstand', FORMAT = 1;

  function zahl(v, min, max, std) { return (typeof v === 'number' && isFinite(v)) ? Math.max(min, Math.min(max, v)) : std; }

  // Zugriff auf den Browserspeicher, ohne dass ein gesperrter Speicher (privates Fenster) das Spiel stoppt
  function speicherVon(win) {
    try { return win && win.localStorage ? win.localStorage : null; } catch (e) { return null; }
  }

  function daten(st) {
    var d = {
      format: FORMAT, version: Dorf.VERSION || '', tag: st.uhr.tag, minute: Math.round(st.uhr.minute * 10) / 10,
      abend: !!st.abend, ziel: !!st.tagesziel.erreicht, gaeste: {}, vorrat: {}, garten: [], teller: st.teller.slice(0, 6),
      gelernt: st.gelernt || {}
    };
    st.gaeste.forEach(function (gs) {
      var b = gs.beduerfnisse;
      d.gaeste[gs.id] = { glueck: Math.round(gs.glueck || 0), satt: Math.round(b.satt), spielen: Math.round(b.spielen), ruhe: Math.round(b.ruhe) };
    });
    Dorf.Garten.REIHE.forEach(function (a) { d.vorrat[a] = st.vorrat[a] || 0; });
    st.garten.liste.forEach(function (p) { d.garten.push(p.reif ? 1 : Math.round(p.wachs * 100) / 100); });
    if (st.ton) d.stumm = !!st.ton.stumm;
    return d;
  }

  // Gespeicherte Daten pruefen und ins frische Spiel uebernehmen. Rueckgabe true, wenn etwas geladen wurde.
  function anwenden(st, d) {
    if (!d || typeof d !== 'object' || d.format !== FORMAT) return false;
    var U = Dorf.Uhr, G = Dorf.Glueck, MAXV = Dorf.Garten.VORRAT_MAX;
    var tag = Math.floor(zahl(d.tag, 1, 9999, 1)), minute = zahl(d.minute, U.START, U.ENDE, U.START);
    var neuerMorgen = !!d.abend || minute >= U.ENDE;
    st.uhr.tag = tag; st.uhr.minute = minute;
    st.tagesziel.erreicht = !!d.ziel;
    if (d.gaeste && typeof d.gaeste === 'object') st.gaeste.forEach(function (gs) {
      var x = d.gaeste[gs.id]; if (!x || typeof x !== 'object') return;
      gs.glueck = zahl(x.glueck, 0, G ? G.MAX : 100, gs.glueck);
      var b = gs.beduerfnisse;
      b.satt = zahl(x.satt, 0, 100, b.satt); b.spielen = zahl(x.spielen, 0, 100, b.spielen);
      if (b.ruhe !== undefined) b.ruhe = zahl(x.ruhe, 0, 100, b.ruhe);
    });
    if (d.vorrat && typeof d.vorrat === 'object') Dorf.Garten.REIHE.forEach(function (a) { st.vorrat[a] = Math.floor(zahl(d.vorrat[a], 0, MAXV, 0)); });
    if (Array.isArray(d.garten)) st.garten.liste.forEach(function (p, i) {
      var w = zahl(d.garten[i], 0, 1, 1); p.wachs = w; p.reif = w >= 1;
    });
    if (Array.isArray(d.teller)) st.teller = d.teller.filter(function (id) { return !!Dorf.Gerichte.hole(id) && Dorf.Gerichte.REIHE.indexOf(id) >= 0; }).slice(0, 6);
    st.gelernt = {};
    if (d.gelernt && typeof d.gelernt === 'object') Object.keys(d.gelernt).slice(0, 20).forEach(function (k) { st.gelernt[k] = Math.floor(zahl(d.gelernt[k], 0, 99, 0)); });
    // Abends gespeichert: beim naechsten Besuch beginnt gleich der neue Morgen
    if (neuerMorgen) {
      U.neuerTag(st.uhr);
      st.gaeste.forEach(function (gs) { gs.beduerfnisse.satt = 60; if (gs.beduerfnisse.ruhe !== undefined) gs.beduerfnisse.ruhe = 80; });
      if (G) G.neuerTag(st);
      Dorf.Garten.neuerTag(st.garten);
    }
    return true;
  }

  function lade(sp) {
    if (!sp) return null;
    try {
      var roh = sp.getItem(SCHLUESSEL);
      if (!roh || roh.length > 20000) return null;
      var d = JSON.parse(roh);
      return d && typeof d === 'object' && d.format === FORMAT ? d : null;
    } catch (e) { return null; }
  }
  function schreibe(sp, st) {
    if (!sp) return false;
    try { sp.setItem(SCHLUESSEL, JSON.stringify(daten(st))); return true; } catch (e) { return false; }
  }
  function loesche(sp) {
    if (!sp) return false;
    try { if (sp.removeItem) sp.removeItem(SCHLUESSEL); else sp.setItem(SCHLUESSEL, ''); return true; } catch (e) { return false; }
  }

  Dorf.Speicher = { SCHLUESSEL: SCHLUESSEL, FORMAT: FORMAT, speicherVon: speicherVon, daten: daten, anwenden: anwenden, lade: lade, schreibe: schreibe, loesche: loesche };
})(globalThis);
