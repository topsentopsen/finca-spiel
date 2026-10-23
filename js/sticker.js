/* Sticker (ab v0.9): Am Abend gibt es zur Belohnung einen Sticker fuer das kleine Album.
   Was heute geklappt hat, bestimmt den Sticker (Bruna gefuettert = Esel, Ei gefunden = Ei, ...).
   Hat man nichts Neues gemacht, gibt es trotzdem einen (Sonne, Mond, Stern), solange das Album nicht voll ist.
   Das Album liegt unter einem eigenen Schluessel und bleibt auch nach "Neu anfangen" erhalten. */
(function (g) {
  'use strict';
  var Dorf = g.Dorf = g.Dorf || {};
  var SCHLUESSEL = 'finca.album';
  // bild: Name fuer zeichneSymbol, farbe: Grund des runden Stickers, wenn: Tat im Tageslog
  var LISTE = [
    { id: 'sonne', bild: 'sonne', farbe: '#fff0a8' },
    { id: 'esel', bild: 'esel', farbe: '#e6defb', wenn: 'esel' },
    { id: 'ei', bild: 'ei', farbe: '#fff4dc', wenn: 'ei' },
    { id: 'tomate', bild: 'tomate', farbe: '#ffd6cf', wenn: 'ernte' },
    { id: 'paamboli', bild: 'gericht:paamboli', farbe: '#ffe1c9', wenn: 'koch_paamboli' },
    { id: 'ensaimada', bild: 'gericht:ensaimada', farbe: '#fff0c2', wenn: 'koch_ensaimada' },
    { id: 'tumbet', bild: 'gericht:tumbet', farbe: '#ffd6cf', wenn: 'koch_tumbet' },
    { id: 'herz', bild: 'herz', farbe: '#ffdbe6', wenn: 'ziel' },
    { id: 'huhn', bild: 'huhn', farbe: '#fff8ee', wenn: 'huhn' },
    { id: 'gecko', bild: 'gecko', farbe: '#d4f2ee', wenn: 'gecko' },
    { id: 'mond', bild: 'mond', farbe: '#d8d0f4' },
    { id: 'stern', bild: 'stern', farbe: '#fff0a8' }
  ];
  function hole(id) { for (var i = 0; i < LISTE.length; i++) if (LISTE[i].id === id) return LISTE[i]; return null; }
  function anzahl(album) { var n = 0; LISTE.forEach(function (s) { if (album && album[s.id]) n++; }); return n; }

  // Tageslog: was hat heute geklappt?
  function merke(st, tat) { if (!st.heute) st.heute = {}; st.heute[tat] = 1; }

  // Welcher Sticker ist heute dran? Erst einer, der zu einer Tat passt, dann ein Geschenk, dann irgendein fehlender.
  function waehle(album, heute) {
    album = album || {}; heute = heute || {};
    var frei = LISTE.filter(function (s) { return !album[s.id]; });
    if (!frei.length) return null;
    for (var i = 0; i < frei.length; i++) if (frei[i].wenn && heute[frei[i].wenn]) return frei[i].id;
    for (var j = 0; j < frei.length; j++) if (!frei[j].wenn) return frei[j].id;
    return frei[0].id;
  }

  // Am Abend genau einmal: Sticker ins Album, fuer die Abendszene merken
  function vergib(st) {
    if (!st.album) st.album = {};
    if (st.stickerTag === st.uhr.tag) return st.neuerSticker || null;
    st.stickerTag = st.uhr.tag;
    var id = waehle(st.album, st.heute);
    st.neuerSticker = id;
    if (id) { st.album[id] = st.uhr.tag; st.albumNeu = true; st.albumAendern = true; }
    return id;
  }
  function neuerTag(st) { st.heute = {}; st.neuerSticker = null; }

  function lade(sp) {
    try {
      var roh = sp && sp.getItem(SCHLUESSEL); if (!roh) return {};
      var d = JSON.parse(roh), a = {};
      if (!d || typeof d !== 'object') return {};
      LISTE.forEach(function (s) { var v = d[s.id]; if (typeof v === 'number' && isFinite(v) && v > 0) a[s.id] = Math.floor(v); });
      return a;
    } catch (e) { return {}; }
  }
  function schreibe(sp, album) {
    try { if (!sp) return false; sp.setItem(SCHLUESSEL, JSON.stringify(album || {})); return true; } catch (e) { return false; }
  }

  Dorf.Sticker = { LISTE: LISTE, SCHLUESSEL: SCHLUESSEL, hole: hole, anzahl: anzahl, merke: merke, waehle: waehle, vergib: vergib, neuerTag: neuerTag, lade: lade, schreibe: schreibe };
})(typeof window !== 'undefined' ? window : globalThis);
