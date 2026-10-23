/* Vorlesen (ab v0.8): die Sprechblasen werden mit der eingebauten Stimme des Browsers leise vorgelesen.
   Nichts wird geladen oder installiert. Gibt es keine deutsche Stimme, bleibt der Knopf einfach weg.
   Nie Pflicht: alles ist auch an den Bildern zu verstehen. Ist der Ton aus, wird auch nicht vorgelesen. */
(function (g) {
  'use strict';
  var Dorf = g.Dorf = g.Dorf || {};
  var SCHLUESSEL = 'finca.vorlesen';
  // ruhige Stimmen: etwas langsamer als normal, je Figur etwas hoeher oder tiefer
  var STIMME = {
    biel: { pitch: 1.1, rate: 0.9 },
    mia: { pitch: 1.35, rate: 0.9 },
    jonas: { pitch: 0.8, rate: 0.9 },
    padrina: { pitch: 0.95, rate: 0.8 }
  };
  var MAX_ZEICHEN = 140;

  // Klammern werden zu kleinen Pausen, damit es ruhig klingt: "Bon dia! (Guten Morgen!)" -> "Bon dia! Guten Morgen!"
  function saeubere(text) {
    var t = String(text || '').replace(/\s*\(([^)]*)\)\s*/g, function (m, innen) { return ', ' + innen.trim() + '\u0001'; });
    t = t.replace(/\u0001\s*(?=[A-ZÄÖÜ])/g, '. ').replace(/\u0001/g, ', ');
    t = t.replace(/([!?.])\s*[,.]/g, '$1').replace(/,\s*([!?.,])/g, '$1').replace(/\s+([!?.,])/g, '$1').replace(/\s+/g, ' ').replace(/^\s*,\s*/, '').replace(/[\s,]+$/, '').trim();
    if (t && !/[!?.]$/.test(t)) t += '.';
    if (t.length > MAX_ZEICHEN) t = t.slice(0, MAX_ZEICHEN).replace(/\s+\S*$/, '') + '.';
    return t;
  }

  function lies(speicher) {
    try { var v = speicher && speicher.getItem(SCHLUESSEL); return v === null || v === undefined ? true : v !== 'aus'; } catch (e) { return true; }
  }
  function schreib(speicher, an) { try { if (speicher) speicher.setItem(SCHLUESSEL, an ? 'an' : 'aus'); } catch (e) { /* egal */ } }

  function erstelle(win, speicher) {
    var ss = null, Utter = null;
    try { if (win && 'speechSynthesis' in win && win.speechSynthesis && typeof win.SpeechSynthesisUtterance === 'function') { ss = win.speechSynthesis; Utter = win.SpeechSynthesisUtterance; } } catch (e) { ss = null; }
    var v = { verfuegbar: false, an: lies(speicher), stimme: null, frei: false, spricht: false, beiAenderung: null, gesagt: 0 };

    function waehleStimme() {
      if (!ss || !ss.getVoices) return;
      var liste = [];
      try { liste = ss.getVoices() || []; } catch (e) { liste = []; }
      var de = liste.filter(function (s) { return s && /^de([-_]|$)/i.test(s.lang || ''); });
      // lieber eine Stimme aus Deutschland, lokal installiert (geht ohne Internet)
      de.sort(function (a, b) { return punkte(b) - punkte(a); });
      var vorher = v.verfuegbar;
      v.stimme = de[0] || null;
      v.verfuegbar = !!v.stimme;
      if (vorher !== v.verfuegbar && v.beiAenderung) v.beiAenderung();
    }
    function punkte(s) { return (/de[-_]DE/i.test(s.lang) ? 2 : 0) + (s.localService ? 1 : 0); }
    if (ss) {
      waehleStimme();
      try {
        if (ss.addEventListener) ss.addEventListener('voiceschanged', waehleStimme);
        else ss.onvoiceschanged = waehleStimme;
      } catch (e) { /* egal */ }
    }
    // erst nach dem ersten Tippen sprechen (Browser verlangen das, und es soll niemanden ueberraschen)
    if (win && win.addEventListener) {
      var frei = function () { v.frei = true; };
      ['pointerdown', 'keydown', 'touchend', 'click'].forEach(function (n) { win.addEventListener(n, frei, true); });
    }

    v.stopp = function () { v.spricht = false; if (ss) { try { ss.cancel(); } catch (e) { /* egal */ } } };
    v.setze = function (an) { v.an = !!an; schreib(speicher, v.an); if (!v.an) v.stopp(); if (v.beiAenderung) v.beiAenderung(); return v.an; };
    v.umschalten = function () { return v.setze(!v.an); };
    // Rueckgabe true, wenn wirklich vorgelesen wird
    v.sage = function (text, sprecher, stumm) {
      if (!ss || !v.verfuegbar || !v.an || !v.frei) return false;
      if (stumm) { v.stopp(); return false; }
      var t = saeubere(text);
      if (!t) return false;
      var p = STIMME[String(sprecher || '').toLowerCase()] || STIMME.biel;
      try {
        ss.cancel();
        var u = new Utter(t);
        u.lang = 'de-DE'; if (v.stimme) u.voice = v.stimme;
        u.rate = p.rate; u.pitch = p.pitch; u.volume = 0.9;
        u.onend = u.onerror = function () { v.spricht = false; };
        v.spricht = true; v.gesagt++;
        ss.speak(u);
        return true;
      } catch (e) { v.spricht = false; return false; }
    };
    return v;
  }

  Dorf.Vorlesen = { SCHLUESSEL: SCHLUESSEL, STIMME: STIMME, MAX_ZEICHEN: MAX_ZEICHEN, saeubere: saeubere, erstelle: erstelle };
})(globalThis);
