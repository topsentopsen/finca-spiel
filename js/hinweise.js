/* Hinweise ohne Lesen (ab v0.6): Tobis Kinder koennen noch nicht lesen. Wenn eine Weile nichts passiert,
   zeigt eine huepfende Hand mit pulsierendem Ring und einem kleinen Bild, was man als Naechstes tun kann:
   Sprechblase = mit einem Gast reden, Frucht = ernten, Topf = kochen, Karotte = Bruna fuettern, Ei = Ei einsammeln, Sonne = neuer Tag.
   Beim ersten Mal kommt der Hinweis schnell, wenn etwas schon oft geklappt hat, erst nach laengerer Pause. */
(function (g) {
  'use strict';
  var Dorf = g.Dorf = g.Dorf || {};
  var WARTE = { neu: 2.5, etwas: 6, gelernt: 12, wunsch: 1.2 };  // Sekunden ohne Eingabe bis zur Hand
  var TON_PAUSE = 20;                                             // hoechstens alle 20 Sekunden ein leises Ploeppchen
  var HERD = { x: 5 * 16 + 8, y: 2 * 16 + 2 };

  function erstelle() { return { ziel: null, alpha: 0, leer: 0, wahl: 0, tonZeit: -99, t: 0 }; }

  function lerne(st, art) { if (!st.gelernt) st.gelernt = {}; st.gelernt[art] = Math.min(99, (st.gelernt[art] || 0) + 1); }
  function warte(st, art) {
    if (st.abend) return WARTE.neu;
    var n = (st.gelernt && st.gelernt[art]) || 0;
    return n >= 3 ? WARTE.gelernt : (n >= 1 ? WARTE.etwas : WARTE.neu);
  }

  function nahePflanze(st, arten) {
    var sp = st.spieler, best = null, bd = Infinity;
    st.garten.liste.forEach(function (p) {
      if (!p.reif || arten.indexOf(p.art) < 0) return;
      if ((st.vorrat[p.art] || 0) >= Dorf.Garten.VORRAT_MAX) return;
      var q = Dorf.Garten.punkt(p), d = Math.hypot(q.x - sp.x, q.y - sp.y);
      if (d < bd) { bd = d; best = p; }
    });
    return best;
  }
  function pflanzenZiel(p) { var q = Dorf.Garten.punkt(p); return { art: 'ernten', x: q.x, y: q.y - (p.baum ? 30 : 12), bild: p.art, pflanze: p }; }

  // Was ist jetzt der beste naechste Schritt? Weltkoordinaten (oder bildschirm: true fuer Menue und Abend)
  function waehle(st) {
    if (st.frage || st.buch) return null;
    if (st.abend) return { art: 'weiter', bildschirm: true, x: 160, y: 150, bild: null };
    if (st.menue && st.menue.zu !== undefined) return null;   // Menue schliesst gleich (es fehlt etwas)
    if (st.menue) {
      var karten = Dorf.Spiel.menueKarten(), beste = 0;
      for (var i = 0; i < karten.length; i++) {
        var z = Dorf.Garten.pruefe(st.vorrat, Dorf.Gerichte.hole(karten[i].id));
        if (z.ok && (z.frisch || !Dorf.Gerichte.hole(karten[i].id).immer)) { beste = i; break; }
      }
      var k = karten[beste];
      return { art: 'kochen', bildschirm: true, x: k.x + k.w / 2, y: k.y + 6, bild: null };
    }
    if (st.kochen || st.spieler.ziel || st.wartetAuf || st.tagesziel.erreicht) return null;
    var V = st.vorrat;
    // gerade fehlte etwas zum Kochen: genau dahin zeigen
    if (st.wunsch) {
      if ((V[st.wunsch] || 0) > 0) st.wunsch = null;
      else { var pw = nahePflanze(st, [st.wunsch]); if (pw) return pflanzenZiel(pw); }
    }
    var esel = st.tiere && st.tiere.esel;
    if (esel && V.karotte > 0) return { art: 'fuettern', x: esel.x, y: esel.y - 30, bild: 'karotte' };
    var hungrig = st.gaeste.some(function (gs) { return gs.ziel === 'tafel' && gs.zustand !== 'aktiv'; });
    var frisch = (V.tomate || 0) >= 2 || (V.orange || 0) >= 1 || (V.zitrone || 0) >= 1 || ((V.tomate || 0) >= 1 && (V.olive || 0) >= 1);
    if (st.teller.length < Dorf.Spiel.TAFEL_MAX && ((hungrig && st.teller.length === 0) || (frisch && st.teller.length < 2)))
      return { art: 'kochen', x: HERD.x, y: HERD.y, bild: 'topf' };
    var leer = Dorf.Garten.REIHE.filter(function (a) { return a !== 'karotte' && (V[a] || 0) < 2; });
    if (!V.karotte) leer.push('karotte');
    var pf = leer.length ? nahePflanze(st, leer) : null;
    var traurig = null;
    st.gaeste.forEach(function (gs) {
      if (Dorf.Glueck && Dorf.Glueck.gluecklich(gs)) return;
      var p = gs.glueckPause || {};
      if (p.reden !== undefined && st.zeit < p.reden) return;      // gerade erst geredet, Herz kommt spaeter wieder
      if (!traurig || (gs.glueck || 0) < (traurig.glueck || 0)) traurig = gs;
    });
    // abwechselnd: wer weniger Herzen hat, bekommt zuerst Besuch, sonst Garten
    if (traurig && (!pf || (traurig.glueck || 0) <= 40)) return { art: 'reden', x: traurig.x, y: traurig.y - (Dorf.Gaeste.sitzt(traurig) ? 14 : 0) - 28, bild: 'reden', gast: traurig };
    if (pf) return pflanzenZiel(pf);
    // ab v0.8: noch kein Ei im Korb, aber im Gras liegt eins
    var eier = (st.tiere && st.tiere.eier) || [];
    if (!V.ei && eier.length) { var e0 = eier[0]; return { art: 'sammeln', x: e0.x, y: e0.y - 16, bild: 'ei', ei: e0 }; }
    if (traurig) return { art: 'reden', x: traurig.x, y: traurig.y - (Dorf.Gaeste.sitzt(traurig) ? 14 : 0) - 28, bild: 'reden', gast: traurig };
    return null;
  }

  // Jeden Schritt: Leerlauf zaehlen, Ziel alle 0,5 s neu waehlen, sanft ein- und ausblenden
  function update(st, dt, aktiv) {
    var h = st.hinweis || (st.hinweis = erstelle());
    h.t += dt;
    if (aktiv) { h.leer = 0; h.alpha = Math.max(0, h.alpha - dt * 6); return; }
    h.leer += dt;
    h.wahl -= dt;
    if (h.wahl <= 0) {
      h.wahl = 0.5;
      var neu = waehle(st);
      if (!neu || !h.ziel || neu.art !== h.ziel.art || neu.bild !== h.ziel.bild) h.alpha = Math.min(h.alpha, 0);
      h.ziel = neu;
    }
    var schwelle = st.wunsch ? WARTE.wunsch : (h.ziel ? warte(st, h.ziel.art) : 99);
    var zeigen = !!h.ziel && h.leer >= schwelle && !st.blase;
    var vorher = h.alpha;
    h.alpha = zeigen ? Math.min(1, h.alpha + dt * 2.5) : Math.max(0, h.alpha - dt * 4);
    if (vorher === 0 && h.alpha > 0 && st.zeit - h.tonZeit > TON_PAUSE) { h.tonZeit = st.zeit; st.toene.push('tipp'); }
  }

  Dorf.Hinweise = { WARTE: WARTE, TON_PAUSE: TON_PAUSE, HERD: HERD, erstelle: erstelle, lerne: lerne, waehle: waehle, update: update };
})(globalThis);
