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
    { id: 'sonne', name: 'Sonne', bild: 'sonne', farbe: '#fff0a8' },
    { id: 'esel', name: 'Esel', bild: 'esel', farbe: '#e6defb', wenn: 'esel' },
    { id: 'ei', name: 'Ei', bild: 'ei', farbe: '#fff4dc', wenn: 'ei' },
    { id: 'tomate', name: 'Tomate', bild: 'tomate', farbe: '#ffd6cf', wenn: 'ernte' },
    { id: 'paamboli', name: 'Pa amb oli', bild: 'gericht:paamboli', farbe: '#ffe1c9', wenn: 'koch_paamboli' },
    { id: 'ensaimada', name: 'Ensaïmada', bild: 'gericht:ensaimada', farbe: '#fff0c2', wenn: 'koch_ensaimada' },
    { id: 'tumbet', name: 'Tumbet', bild: 'gericht:tumbet', farbe: '#ffd6cf', wenn: 'koch_tumbet' },
    { id: 'herz', name: 'Herz', bild: 'herz', farbe: '#ffdbe6', wenn: 'ziel' },
    { id: 'huhn', name: 'Huhn', bild: 'huhn', farbe: '#fff8ee', wenn: 'huhn' },
    { id: 'gecko', name: 'Gecko', bild: 'gecko', farbe: '#d4f2ee', wenn: 'gecko' },
    // ab v0.11: Musik und Tiere im Garten (Album mit 16 Plaetzen)
    { id: 'lied', name: 'Lied', bild: 'note', farbe: '#ffe7b8', wenn: 'lied' },
    { id: 'gitarre', name: 'Gitarre', bild: 'gitarre', farbe: '#ffe1c9', wenn: 'musik' },
    { id: 'vogel', name: 'Vogel', bild: 'vogel', farbe: '#dcecff', wenn: 'vogel' },
    { id: 'mond', name: 'Mond', bild: 'mond', farbe: '#d8d0f4' },
    { id: 'stern', name: 'Stern', bild: 'stern', farbe: '#fff0a8' },
    { id: 'falter', name: 'Schmetterling', bild: 'falter', farbe: '#ffe3ec' }
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
  // ab v0.12: das Abendbuch. Was heute geklappt hat, als Bilder (hoechstens 6) und als ein ruhiger Satz zum Vorlesen.
  var TATEN = [
    { tat: 'ziel', bild: 'herz', satz: 'alle Gäste glücklich gemacht' },
    { tat: 'koch_paamboli', bild: 'gericht:paamboli', satz: 'Pa amb oli gekocht' },
    { tat: 'koch_ensaimada', bild: 'gericht:ensaimada', satz: 'Ensaïmada gebacken' },
    { tat: 'koch_tumbet', bild: 'gericht:tumbet', satz: 'Tumbet gekocht' },
    { tat: 'esel', bild: 'esel', satz: 'Bruna besucht' },
    { tat: 'ernte', bild: 'tomate', satz: 'im Garten geerntet' },
    { tat: 'ei', bild: 'ei', satz: 'ein Ei gefunden' },
    { tat: 'huhn', bild: 'huhn', satz: 'das Huhn gestreichelt' },
    { tat: 'gecko', bild: 'gecko', satz: 'den Gecko gestreichelt' },
    { tat: 'lied', bild: 'note', satz: 'ein Lied gespielt' },
    { tat: 'musik', bild: 'gitarre', satz: 'Musik gemacht' },
    { tat: 'vogel', bild: 'vogel', satz: 'Vögel gesehen' }
  ];
  var TATEN_MAX = 6, SATZ_TATEN = 3;
  function heuteTaten(heute) {
    heute = heute || {};
    var l = TATEN.filter(function (t) { return heute[t.tat]; });
    if (heute.lied) l = l.filter(function (t) { return t.tat !== 'musik'; });   // ein Lied ist schon Musik
    return l.slice(0, TATEN_MAX);
  }
  // Sticker von heute (meist einer): im Album mit dem heutigen Spieltag
  function heuteSticker(st) {
    var a = st.album || {}, tag = st.uhr ? st.uhr.tag : -1, l = [];
    if (st.neuerSticker && a[st.neuerSticker]) l.push(st.neuerSticker);
    LISTE.forEach(function (s) { if (a[s.id] === tag && l.indexOf(s.id) < 0) l.push(s.id); });
    return l.slice(0, 2);
  }
  function heuteSatz(st) {
    var st2 = heuteSticker(st), t = heuteTaten(st.heute).slice(0, SATZ_TATEN), s = '';
    if (st2.length) s += 'Dein Sticker heute: ' + st2.map(function (id) { return hole(id).name; }).join(' und ') + '. ';
    if (t.length) {
      var teile = t.map(function (x) { return x.satz; });
      s += 'Du hast ' + (teile.length > 1 ? teile.slice(0, -1).join(', ') + ' und ' + teile[teile.length - 1] : teile[0]) + '. ';
    } else s += 'Ein ruhiger Tag auf der Finca. ';
    return s + 'Schlaf gut.';
  }
  function neuerTag(st) { st.heute = {}; st.neuerSticker = null; }

  // ab v0.10: schluessel optional (ein Album pro Profil)
  function lade(sp, schluessel) {
    try {
      var roh = sp && sp.getItem(schluessel || SCHLUESSEL); if (!roh) return {};
      var d = JSON.parse(roh), a = {};
      if (!d || typeof d !== 'object') return {};
      LISTE.forEach(function (s) { var v = d[s.id]; if (typeof v === 'number' && isFinite(v) && v > 0) a[s.id] = Math.floor(v); });
      return a;
    } catch (e) { return {}; }
  }
  function schreibe(sp, album, schluessel) {
    try { if (!sp) return false; sp.setItem(schluessel || SCHLUESSEL, JSON.stringify(album || {})); return true; } catch (e) { return false; }
  }

  Dorf.Sticker = { TATEN: TATEN, TATEN_MAX: TATEN_MAX, heuteTaten: heuteTaten, heuteSticker: heuteSticker, heuteSatz: heuteSatz, LISTE: LISTE, SCHLUESSEL: SCHLUESSEL, hole: hole, anzahl: anzahl, merke: merke, waehle: waehle, vergib: vergib, neuerTag: neuerTag, lade: lade, schreibe: schreibe };
})(globalThis);
