/* Musik und Geraeusche, komplett im eigenen Code mit WebAudio erzeugt (ab v0.3).
   Ruhige gezupfte Gitarrenschleife (Karplus-Strong), leise Effekte, Brunnenrauschen.
   Startet erst nach der ersten Beruehrung oder Taste (Regel der Browser). */
(function (g) {
  'use strict';
  var Dorf = g.Dorf = g.Dorf || {};

  var SCHLUESSEL = 'finca.stumm';
  var BPM = 66;                        // langsam und entspannt
  var ACHTEL = 60 / BPM / 2;           // Sekunden pro Achtel
  var LAUT = { gesamt: 0.6, musik: 0.55, effekte: 0.9, umgebung: 0.05, grillen: 0.06 };
  var UEBERBLENDEN = 2.5;              // Zeitkonstante in Sekunden fuer Tag zu Abend (ganz weich)

  // Akkorde in MIDI: Bass und drei Toene. Spanische Kadenz in a-Moll, sanft gezupft.
  var AKKORDE = {
    Am: [45, 57, 60, 64], G: [43, 55, 59, 62], F: [41, 53, 57, 60], E: [40, 56, 59, 64], Dm: [38, 50, 57, 62]
  };
  var FOLGE = ['Am', 'G', 'F', 'E', 'Dm', 'Am', 'F', 'E'];
  // Zupfmuster pro Takt (8 Achtel): 0 = Bass, 1..3 = Akkordtoene
  var MUSTER = [0, 1, 2, 3, 1, 2, 3, 2];
  // Kleine Melodie, nur in jeder zweiten Runde: [Takt, Achtel, MIDI]
  var MELODIE = [[0, 0, 76], [0, 4, 72], [1, 0, 74], [1, 4, 71], [2, 0, 72], [2, 3, 69], [2, 5, 72], [3, 0, 71], [3, 4, 68],
    [4, 0, 69], [4, 4, 74], [5, 0, 72], [5, 4, 76], [6, 0, 77], [6, 3, 76], [6, 5, 74], [7, 0, 71], [7, 4, 68]];

  // Abendvariante (ab v0.4): gleiche Akkorde, aber sparsamer gezupft, tiefer und mit Schlaflied-Melodie
  var MUSTER_ABEND = [[0, 0], [2, 1], [3, 2], [4, 3], [6, 2]];     // [Achtel, Stufe]
  var MELODIE_ABEND = [[0, 0, 72], [0, 4, 69], [1, 0, 71], [1, 4, 67], [2, 0, 69], [2, 4, 65], [3, 0, 68], [3, 6, 64],
    [4, 0, 65], [4, 4, 69], [5, 0, 64], [5, 4, 67], [6, 0, 69], [6, 4, 72], [7, 0, 71], [7, 4, 68]];

  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  // Alle Noten einer Runde (8 Takte). zeit in Achteln ab Rundenbeginn.
  function noten(runde, art) {
    var liste = [];
    if (art === 'abend') {
      FOLGE.forEach(function (name, takt) {
        var a = AKKORDE[name];
        MUSTER_ABEND.forEach(function (m) { liste.push({ zeit: takt * 8 + m[0], midi: a[m[1]], staerke: m[1] === 0 ? 0.5 : 0.3, art: m[1] === 0 ? 'bass' : 'akkord' }); });
      });
      MELODIE_ABEND.forEach(function (m) { liste.push({ zeit: m[0] * 8 + m[1], midi: m[2], staerke: 0.3, art: 'melodie' }); });
      liste.sort(function (a, b) { return a.zeit - b.zeit; });
      return liste;
    }
    FOLGE.forEach(function (name, takt) {
      var a = AKKORDE[name];
      MUSTER.forEach(function (stufe, i) {
        var bass = stufe === 0;
        liste.push({ zeit: takt * 8 + i, midi: a[stufe], staerke: bass ? 0.55 : (i === 4 ? 0.34 : 0.26), art: bass ? 'bass' : 'akkord' });
      });
      liste.push({ zeit: takt * 8 + 4, midi: a[0], staerke: 0.3, art: 'bass' });
    });
    if (runde % 2 === 1) MELODIE.forEach(function (m) { liste.push({ zeit: m[0] * 8 + m[1], midi: m[2], staerke: 0.3, art: 'melodie' }); });
    liste.sort(function (a, b) { return a.zeit - b.zeit; });
    return liste;
  }

  // Karplus-Strong: gezupfte Saite als Zahlenreihe. Deterministisch durch eigenen Zufall.
  function zupfe(freq, rate, dauer, seed) {
    var n = Math.max(2, Math.round(rate / freq)), len = Math.floor(rate * dauer);
    var ring = new Float32Array(n), out = new Float32Array(len), s = (seed || 1) >>> 0, i;
    function zuf() { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 * 2 - 1; }
    var vor = 0;
    for (i = 0; i < n; i++) { var z = zuf(); ring[i] = (z + vor) * 0.5; vor = z; }   // weiches Rauschen = sanfter Anschlag
    var daempf = freq < 120 ? 0.994 : 0.996, idx = 0;
    for (i = 0; i < len; i++) {
      var j = idx + 1; if (j === n) j = 0;
      out[i] = ring[idx];
      ring[idx] = daempf * 0.5 * (ring[idx] + ring[j]);
      idx = j;
    }
    var ein = Math.min(len, Math.floor(rate * 0.003)), aus = Math.min(len, Math.floor(rate * 0.08));
    for (i = 0; i < ein; i++) out[i] *= i / ein;
    for (i = 0; i < aus; i++) out[len - 1 - i] *= i / aus;
    return out;
  }

  // ab v0.10: Instrumente zum Antippen. Was gerade klingt, passt immer zum aktuellen Akkord der Musik.
  function akkordBei(schritt) { var s = ((Math.floor(schritt) % 64) + 64) % 64; return FOLGE[Math.floor(s / 8)]; }
  // Reine Funktion: welche Toene ein Instrument zu einem Akkord spielt. n zaehlt die Schlaege (Abwechslung).
  function instrumentNoten(art, akkord, n) {
    var a = AKKORDE[akkord] || AKKORDE.Am, k = n || 0, l = [];
    if (art === 'gitarre') {
      // weicher Strum, eine Oktave ueber der Begleitung, abwechselnd ab und auf
      var toene = [a[1] + 12, a[2] + 12, a[3] + 12];
      if (k % 2 === 1) toene.reverse();
      toene.forEach(function (m, i) { l.push({ midi: m, versatz: i * 0.035, staerke: 0.2 - i * 0.025, klang: 'saite' }); });
    } else if (art === 'kastagnetten') {
      // zwei helle Klicks, beim dritten Schlag ein kleines Trippeln
      l.push({ freq: 2600, versatz: 0, staerke: 0.05, klang: 'klick' });
      l.push({ freq: 3100, versatz: ACHTEL / 4, staerke: 0.04, klang: 'klick' });
      if (k % 3 === 2) l.push({ freq: 2800, versatz: ACHTEL / 2, staerke: 0.035, klang: 'klick' });
    } else if (art === 'trommel') {
      // weicher, tiefer Schlag auf dem Grundton des Akkords
      l.push({ midi: a[0] + 12, versatz: 0, staerke: 0.09, klang: 'trommel' });
      if (k % 2 === 1) l.push({ midi: a[0] + 19, versatz: ACHTEL / 2, staerke: 0.05, klang: 'trommel' });
    }
    return l;
  }
  // Naechster Zeitpunkt im feinen Raster der Musik (Viertel einer Achtel), damit Schlaege im Takt landen
  function raster(jetzt, naechste, fein) {
    if (!(fein > 0) || !(naechste > jetzt)) return jetzt;
    var k = Math.floor((naechste - jetzt) / fein);
    return naechste - k * fein;
  }

  function klemme(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }
  // Mischung nach Uhrzeit: ab 18:30 Abendmusik, ab 20:30 Grillen. Abendszene: ganz Abend.
  function mischung(stunde, abendSzene) {
    if (abendSzene) return { tag: 0, abend: 1, grillen: 1 };
    var abend = klemme((stunde - 18.5) / 1.5);
    return { tag: 1 - abend, abend: abend, grillen: klemme((stunde - 20.5) / 1) };
  }
  // Eine Grille: drei kurze, weiche Zirper
  function zirpen(start, hoehe) {
    var l = [];
    for (var i = 0; i < 3; i++) l.push({ zeit: start + i * 0.07, freq: hoehe, dauer: 0.035, staerke: i === 1 ? 0.5 : 0.38 });
    return l;
  }

  function stummLaden(speicher) {
    try { return !!(speicher && speicher.getItem(SCHLUESSEL) === '1'); } catch (e) { return false; }
  }
  function stummSpeichern(speicher, wert) {
    try { if (speicher) speicher.setItem(SCHLUESSEL, wert ? '1' : '0'); } catch (e) { /* privat, egal */ }
  }

  function erstelle(win) {
    var speicher = null;
    try { speicher = win && win.localStorage ? win.localStorage : null; } catch (e) { speicher = null; }
    var AC = win ? (win.AudioContext || win.webkitAudioContext) : null;
    var t = {
      stumm: stummLaden(speicher), bereit: false, verfuegbar: !!AC, ctx: null,
      beiAenderung: null, runde: 0, schrittIndex: 0, naechste: 0, puffer: {}, gespielt: 0,
      mix: { tag: 1, abend: 0, grillen: 0 }, grillenGespielt: 0, naechsteGrille: 0
    };
    var leiseSeit = { tag: -1, abend: -1 }, grillenZufall = 12345;
    var knoten = {}, takt = null, rauschen = null, umgebungZiel = 0, schrittL = false;

    function baue() {
      var c = t.ctx;
      knoten.gesamt = c.createGain(); knoten.gesamt.gain.value = 0;
      knoten.filter = c.createBiquadFilter(); knoten.filter.type = 'lowpass'; knoten.filter.frequency.value = 3800;
      knoten.komp = c.createDynamicsCompressor();
      knoten.gesamt.connect(knoten.filter); knoten.filter.connect(knoten.komp); knoten.komp.connect(c.destination);
      knoten.musik = c.createGain(); knoten.musik.gain.value = LAUT.musik; knoten.musik.connect(knoten.gesamt);
      // zwei Musikspuren zum Ueberblenden: Tag und Abend (Abend etwas waermer gefiltert)
      knoten.tag = c.createGain(); knoten.tag.gain.value = t.mix.tag; knoten.tag.connect(knoten.musik);
      knoten.abendFilter = c.createBiquadFilter(); knoten.abendFilter.type = 'lowpass'; knoten.abendFilter.frequency.value = 1700;
      knoten.abend = c.createGain(); knoten.abend.gain.value = t.mix.abend; knoten.abend.connect(knoten.abendFilter); knoten.abendFilter.connect(knoten.musik);
      // Grillen laufen am Tiefpass vorbei, sonst waeren sie weg
      knoten.grillen = c.createGain(); knoten.grillen.gain.value = t.mix.grillen * LAUT.grillen; knoten.grillen.connect(knoten.komp);
      knoten.effekte = c.createGain(); knoten.effekte.gain.value = LAUT.effekte; knoten.effekte.connect(knoten.gesamt);
      // weicher Raumhall als Echo mit Rueckkopplung
      knoten.hall = c.createDelay(1); knoten.hall.delayTime.value = 0.27;
      knoten.hallRueck = c.createGain(); knoten.hallRueck.gain.value = 0.28;
      knoten.hallFilter = c.createBiquadFilter(); knoten.hallFilter.type = 'lowpass'; knoten.hallFilter.frequency.value = 1800;
      knoten.hallNass = c.createGain(); knoten.hallNass.gain.value = 0.22;
      knoten.musik.connect(knoten.hall); knoten.hall.connect(knoten.hallFilter); knoten.hallFilter.connect(knoten.hallRueck);
      knoten.hallRueck.connect(knoten.hall); knoten.hallFilter.connect(knoten.hallNass); knoten.hallNass.connect(knoten.gesamt);
      // Brunnen: gefiltertes Rauschen in Schleife
      var len = c.sampleRate * 2, b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0), s = 7, i;
      for (i = 0; i < len; i++) { s = (s * 1664525 + 1013904223) >>> 0; d[i] = s / 4294967296 * 2 - 1; }
      rauschen = b;
      var q = c.createBufferSource(); q.buffer = b; q.loop = true;
      var bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 0.6;
      knoten.umgebung = c.createGain(); knoten.umgebung.gain.value = 0;
      q.connect(bp); bp.connect(knoten.umgebung); knoten.umgebung.connect(knoten.gesamt);
      q.start();
    }

    function saite(midi) {
      if (!t.puffer[midi]) {
        var c = t.ctx, roh = zupfe(mtof(midi), c.sampleRate, midi < 50 ? 2.6 : 2.0, midi * 97 + 3);
        var b = c.createBuffer(1, roh.length, c.sampleRate); b.getChannelData(0).set(roh);
        t.puffer[midi] = b;
      }
      return t.puffer[midi];
    }

    function spieleNote(n, wann, spur) {
      var c = t.ctx, q = c.createBufferSource(), gn = c.createGain();
      q.buffer = saite(n.midi); gn.gain.value = n.staerke;
      q.connect(gn);
      var ziel = knoten[spur] || knoten.musik;
      if (c.createStereoPanner) { var p = c.createStereoPanner(); p.pan.value = n.art === 'bass' ? -0.1 : (n.art === 'melodie' ? 0.2 : 0.05); gn.connect(p); p.connect(ziel); }
      else gn.connect(ziel);
      q.start(wann);
      t.gespielt++;
    }

    function planer() {
      if (!t.ctx || t.stumm || t.ctx.state !== 'running') return;
      var jetzt = t.ctx.currentTime;
      if (t.naechste < jetzt) t.naechste = jetzt + 0.08;        // nach Pause nicht nachholen, einfach weiter
      // Eine Spur nur planen, solange sie hoerbar ist (nach dem Ausblenden noch 15 s Nachklang)
      var spuren = ['tag', 'abend'].filter(function (sp) {
        if (t.mix[sp] > 0.001) { leiseSeit[sp] = -1; return true; }
        if (leiseSeit[sp] < 0) leiseSeit[sp] = jetzt;
        return jetzt - leiseSeit[sp] < 15;
      });
      var listen = { tag: noten(t.runde, 'tag'), abend: noten(t.runde, 'abend') };
      while (t.naechste < jetzt + 0.35) {
        var pos = t.schrittIndex;
        // leichtes Schwingen (Swing) fuer ein lockeres Gefuehl
        var wann = t.naechste + (pos % 2 === 1 ? ACHTEL * 0.08 : 0);
        spuren.forEach(function (sp) { listen[sp].forEach(function (n) { if (n.zeit === pos) spieleNote(n, wann, sp); }); });
        t.naechste += ACHTEL; t.schrittIndex++;
        if (t.schrittIndex >= 64) { t.schrittIndex = 0; t.runde++; listen = { tag: noten(t.runde, 'tag'), abend: noten(t.runde, 'abend') }; }
      }
      // Grillen in der Nacht, zwei Tiere abwechselnd, mit ruhigen Pausen
      if (t.mix.grillen > 0.001) {
        if (t.naechsteGrille < jetzt) t.naechsteGrille = jetzt + 0.2;
        while (t.naechsteGrille < jetzt + 0.35) {
          grillenZufall = (grillenZufall * 1664525 + 1013904223) >>> 0;
          var zf = grillenZufall / 4294967296;
          zirpen(t.naechsteGrille, zf < 0.5 ? 4200 : 4650).forEach(grille);
          t.naechsteGrille += 0.9 + zf * 1.8;
        }
      }
    }

    function lautstaerke() {
      if (!t.ctx) return;
      var jetzt = t.ctx.currentTime;
      knoten.gesamt.gain.cancelScheduledValues(jetzt);
      knoten.gesamt.gain.setValueAtTime(knoten.gesamt.gain.value, jetzt);
      // Einblenden langsam, Ausblenden schnell, nie ploetzlich laut
      knoten.gesamt.gain.setTargetAtTime(t.stumm ? 0 : LAUT.gesamt, jetzt, t.stumm ? 0.08 : 1.2);
    }

    function grille(z) {
      var c = t.ctx, o = c.createOscillator(), gn = c.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(z.freq, z.zeit);
      gn.gain.setValueAtTime(0, z.zeit);
      gn.gain.linearRampToValueAtTime(z.staerke, z.zeit + 0.008);
      gn.gain.linearRampToValueAtTime(0, z.zeit + z.dauer);
      o.connect(gn); gn.connect(knoten.grillen); o.start(z.zeit); o.stop(z.zeit + z.dauer + 0.02);
      t.grillenGespielt++;
    }
    // Uhrzeit vom Spiel: blendet weich zwischen Tag, Abend und Grillen
    t.tageszeit = function (stunde, abendSzene) {
      var m = mischung(stunde, abendSzene), alt = t.mix;
      if (m.tag === alt.tag && m.abend === alt.abend && m.grillen === alt.grillen) return false;
      t.mix = m;
      if (t.ctx && knoten.tag) {
        var j = t.ctx.currentTime;
        knoten.tag.gain.setTargetAtTime(m.tag, j, UEBERBLENDEN);
        knoten.abend.gain.setTargetAtTime(m.abend, j, UEBERBLENDEN);
        knoten.grillen.gain.setTargetAtTime(m.grillen * LAUT.grillen, j, UEBERBLENDEN);
      }
      return true;
    };

    t.entsperre = function () {
      if (!AC) return false;
      try {
        if (!t.ctx) { t.ctx = new AC(); baue(); t.naechste = t.ctx.currentTime + 0.3; }
        if (t.ctx.state === 'suspended' && t.ctx.resume) t.ctx.resume();
        if (!t.bereit) { t.bereit = true; lautstaerke(); takt = win.setInterval(planer, 50); }
      } catch (e) { t.verfuegbar = false; return false; }
      return true;
    };
    t.setzeStumm = function (wert) {
      t.stumm = !!wert; stummSpeichern(speicher, t.stumm);
      if (t.ctx) { lautstaerke(); if (!t.stumm) t.naechste = t.ctx.currentTime + 0.2; }
      if (t.beiAenderung) t.beiAenderung(t.stumm);
      return t.stumm;
    };
    t.umschalten = function () { return t.setzeStumm(!t.stumm); };
    t.pausiere = function (an) { if (t.ctx) { try { if (an) t.ctx.suspend(); else t.ctx.resume(); } catch (e) { /* egal */ } } };
    // Brunnen und Pool: nah = 0..1
    t.umgebung = function (nah) {
      umgebungZiel = Math.max(0, Math.min(1, nah)) * LAUT.umgebung;
      if (t.ctx && knoten.umgebung) knoten.umgebung.gain.setTargetAtTime(umgebungZiel, t.ctx.currentTime, 0.4);
    };

    function ton(freq, start, dauer, staerke, form, bis) {
      var c = t.ctx, o = c.createOscillator(), gn = c.createGain();
      o.type = form || 'sine'; o.frequency.setValueAtTime(freq, start);
      if (bis) o.frequency.exponentialRampToValueAtTime(bis, start + dauer);
      gn.gain.setValueAtTime(0, start);
      gn.gain.linearRampToValueAtTime(staerke, start + 0.008);
      gn.gain.exponentialRampToValueAtTime(0.0001, start + dauer);
      o.connect(gn); gn.connect(knoten.effekte); o.start(start); o.stop(start + dauer + 0.05);
    }
    // Gerade hoerbarer Achtelschritt (der Planer ist bis zu 0,35 s voraus)
    t.aktuellerSchritt = function () {
      if (!t.ctx) return t.schrittIndex;
      var vor = Math.max(0, Math.ceil((t.naechste - t.ctx.currentTime) / ACHTEL));
      return ((t.schrittIndex - vor) % 64 + 64) % 64;
    };
    function klick(freq, wann, staerke) {
      if (!rauschen) return;
      var c = t.ctx, q = c.createBufferSource(), bp = c.createBiquadFilter(), gn = c.createGain();
      q.buffer = rauschen; bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = 4;
      gn.gain.setValueAtTime(0.0001, wann); gn.gain.linearRampToValueAtTime(staerke * 3, wann + 0.002); gn.gain.exponentialRampToValueAtTime(0.0001, wann + 0.045);
      q.connect(bp); bp.connect(gn); gn.connect(knoten.effekte); q.start(wann, (freq % 13) / 10, 0.06);
    }
    function trommel(midi, wann, staerke) {
      var c = t.ctx, o = c.createOscillator(), gn = c.createGain(), f = mtof(midi);
      o.type = 'sine'; o.frequency.setValueAtTime(f * 1.6, wann); o.frequency.exponentialRampToValueAtTime(f, wann + 0.06);
      gn.gain.setValueAtTime(0, wann); gn.gain.linearRampToValueAtTime(staerke, wann + 0.006); gn.gain.exponentialRampToValueAtTime(0.0001, wann + 0.5);
      o.connect(gn); gn.connect(knoten.musik); o.start(wann); o.stop(wann + 0.55);
    }
    // ab v0.10: ein Instrument spielen. Rueckgabe: die gespielten Noten (oder false ohne Ton)
    t.instrument = function (art, n) {
      if (!t.ctx || t.stumm || !t.bereit) return false;
      var c = t.ctx, jetzt = c.currentTime + 0.01;
      var wann = raster(jetzt, t.naechste, ACHTEL / 4), liste = instrumentNoten(art, akkordBei(t.aktuellerSchritt()), n);
      liste.forEach(function (x) {
        var w = wann + x.versatz;
        if (x.klang === 'saite') spieleNote({ midi: x.midi, staerke: x.staerke, art: 'melodie' }, w, 'musik');
        else if (x.klang === 'klick') klick(x.freq, w, x.staerke);
        else if (x.klang === 'trommel') trommel(x.midi, w, x.staerke);
      });
      return liste;
    };
    // Leise Effekte. Unbekannte Namen werden ignoriert.
    t.spiele = function (name) {
      if (!t.ctx || t.stumm || !t.bereit) return false;
      var c = t.ctx, j = c.currentTime + 0.01;
      if (name === 'glocke') { ton(1318.5, j, 0.9, 0.05); ton(1975.5, j + 0.07, 0.8, 0.035); }
      else if (name === 'fertig') { ton(1046.5, j, 0.7, 0.045); ton(1318.5, j + 0.12, 0.7, 0.045); ton(1568, j + 0.24, 1.0, 0.045); }
      else if (name === 'kochen') { ton(330, j, 0.16, 0.05, 'sine', 660); ton(392, j + 0.18, 0.16, 0.04, 'sine', 784); }
      else if (name === 'menue') ton(880, j, 0.08, 0.025, 'triangle');
      else if (name === 'herz') { ton(1568, j, 0.35, 0.03); ton(2093, j + 0.09, 0.45, 0.025); }
      else if (name === 'esel') { ton(196, j, 0.28, 0.05, 'triangle', 247); ton(247, j + 0.3, 0.32, 0.045, 'triangle', 185); ton(1318.5, j + 0.62, 0.6, 0.025); }
      else if (name === 'gecko') { ton(2637, j, 0.05, 0.02, 'triangle'); ton(3136, j + 0.08, 0.05, 0.02, 'triangle'); ton(1975.5, j + 0.2, 0.4, 0.02); }
      else if (name === 'ernte') { ton(660, j, 0.09, 0.035, 'sine', 990); ton(1318.5, j + 0.08, 0.3, 0.025); }
      else if (name === 'mampf') { [0, 0.16, 0.32].forEach(function (d) { ton(220, j + d, 0.07, 0.04, 'triangle', 150); }); ton(1568, j + 0.5, 0.35, 0.03); ton(2093, j + 0.6, 0.45, 0.025); }
      // ab v0.6: Hinweis-Ploeppchen, fragendes Hmm, Frucht landet im Korb, Neuanfang
      else if (name === 'tipp') { ton(1760, j, 0.12, 0.02, 'sine'); ton(2217.5, j + 0.1, 0.22, 0.016, 'sine'); }
      else if (name === 'hmm') { ton(392, j, 0.18, 0.03, 'triangle', 349.2); ton(349.2, j + 0.2, 0.26, 0.025, 'triangle', 392); }
      else if (name === 'licht') { ton(1568, j, 0.5, 0.016); ton(2349.3, j + 0.07, 0.6, 0.011); }   // ab v0.7: eine Laterne geht an
      else if (name === 'plopp') ton(988, j, 0.08, 0.025, 'sine', 1480);
      // ab v0.8: Huhn gackert, ein Ei liegt im Gras, Plappern zur Sprechblase (wenn nicht vorgelesen wird)
      else if (name === 'gack') { ton(740, j, 0.07, 0.03, 'triangle', 620); ton(784, j + 0.1, 0.07, 0.03, 'triangle', 660); ton(988, j + 0.22, 0.12, 0.028, 'triangle', 700); }
      else if (name === 'ei') { ton(1175, j, 0.1, 0.022, 'sine', 1568); ton(1568, j + 0.09, 0.3, 0.016); }
      else if (name.indexOf('plapper_') === 0) {
        var PL = { mia: [880, 0.075], jonas: [262, 0.1], padrina: [392, 0.15], biel: [523, 0.09] }[name.slice(8)];
        if (!PL) return false;
        [0, 1, 2, 3].forEach(function (k) { var f = PL[0] * [1, 1.12, 0.94, 1.06][k]; ton(f, j + k * PL[1], PL[1] * 0.8, 0.018, 'triangle', f * 0.92); });
      }
      // ab v0.9: es fehlt etwas (Bloop), Abendherzen zaehlen (Pling), Sticker, Umblaettern, Gaehnen
      else if (name === 'bloop') ton(330, j, 0.16, 0.022, 'sine', 196);
      else if (name === 'zaehl') ton(1318.5, j, 0.14, 0.014, 'sine', 1568);
      else if (name === 'sticker') { ton(1046.5, j, 0.2, 0.025, 'triangle', 1568); ton(1568, j + 0.12, 0.35, 0.02); ton(2093, j + 0.22, 0.45, 0.014); }
      else if (name === 'blaettern') { ton(1200, j, 0.09, 0.008, 'triangle', 600); ton(900, j + 0.05, 0.08, 0.006, 'triangle', 500); }
      else if (name === 'gaehn') ton(392, j, 0.55, 0.012, 'triangle', 247);
      else if (name === 'neu') { [783.99, 659.25, 523.25, 659.25, 783.99].forEach(function (f, i) { ton(f, j + i * 0.11, 0.5, 0.03); }); }
      else if (name === 'feier') { [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach(function (f, i) { ton(f, j + i * 0.16, 1.1, 0.04); }); }
      else if (name === 'nacht') { ton(783.99, j, 1.0, 0.035); ton(659.25, j + 0.3, 1.0, 0.03); ton(523.25, j + 0.6, 1.4, 0.03); }
      // ab v0.10: Bild gewaehlt (kleines Arpeggio in a-Moll), Profil schlaeft schon, Elternbereich, Vogel zwitschert
      else if (name === 'wahl') { [440, 523.25, 659.25, 880].forEach(function (f, i) { ton(f, j + i * 0.09, 0.5, 0.028); }); }
      else if (name === 'schlaf') { ton(523.25, j, 0.6, 0.02, 'sine', 440); ton(392, j + 0.35, 0.8, 0.016); }
      else if (name === 'eltern') { ton(660, j, 0.07, 0.02, 'triangle'); ton(990, j + 0.08, 0.12, 0.016, 'triangle'); }
      else if (name === 'vogel') { ton(2900, j, 0.07, 0.006, 'sine', 3600); ton(3300, j + 0.1, 0.06, 0.005, 'sine', 4100); }
      else if (name === 'flattern') { ton(1800, j, 0.05, 0.004, 'triangle', 1200); ton(1600, j + 0.06, 0.05, 0.003, 'triangle', 1100); }
      else if (name === 'schritt') {
        if (!rauschen) return false;
        var q = c.createBufferSource(), lp = c.createBiquadFilter(), gn = c.createGain();
        q.buffer = rauschen; q.playbackRate.value = schrittL ? 0.8 : 0.95; schrittL = !schrittL;
        lp.type = 'lowpass'; lp.frequency.value = 700;
        gn.gain.setValueAtTime(0.0001, j); gn.gain.linearRampToValueAtTime(0.05, j + 0.006); gn.gain.exponentialRampToValueAtTime(0.0001, j + 0.06);
        q.connect(lp); lp.connect(gn); gn.connect(knoten.effekte); q.start(j, Math.random() * 1.5, 0.08);
      } else return false;
      return true;
    };

    // Erste Beruehrung oder Taste schaltet den Ton frei
    if (win && win.addEventListener) {
      var frei = function () { t.entsperre(); };
      ['pointerdown', 'keydown', 'touchend', 'click'].forEach(function (n) { win.addEventListener(n, frei, true); });
    }
    return t;
  }

  Dorf.Ton = { SCHLUESSEL: SCHLUESSEL, BPM: BPM, LAUT: LAUT, UEBERBLENDEN: UEBERBLENDEN, AKKORDE: AKKORDE, FOLGE: FOLGE, mtof: mtof, noten: noten, zupfe: zupfe, mischung: mischung, zirpen: zirpen,
    akkordBei: akkordBei, instrumentNoten: instrumentNoten, raster: raster, ACHTEL: ACHTEL,
    stummLaden: stummLaden, stummSpeichern: stummSpeichern, erstelle: erstelle };
})(globalThis);
