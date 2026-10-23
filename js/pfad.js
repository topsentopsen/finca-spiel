/* A*-Pfadsuche auf dem Raster (4 Richtungen, Manhattan-Heuristik). */
(function (g) {
  'use strict';
  var Dorf = g.Dorf = g.Dorf || {};

  // grid: { w, h, blockiert(x, y) }. Rueckgabe: Liste {x,y} von Start bis Ziel oder null.
  function suche(grid, sx, sy, zx, zy) {
    var w = grid.w, h = grid.h;
    function drin(x, y) { return x >= 0 && y >= 0 && x < w && y < h; }
    if (!drin(sx, sy) || !drin(zx, zy) || grid.blockiert(zx, zy)) return null;
    if (sx === zx && sy === zy) return [{ x: sx, y: sy }];
    var n = w * h, gk = new Float64Array(n).fill(Infinity), von = new Int32Array(n).fill(-1), zu = new Uint8Array(n);
    var heap = [];
    function hh(i) { return Math.abs(i % w - zx) + Math.abs(Math.floor(i / w) - zy); }
    function kleiner(a, b) { return a.f < b.f || (a.f === b.f && a.h < b.h); }
    function push(e) { heap.push(e); var i = heap.length - 1; while (i > 0) { var p = (i - 1) >> 1; if (!kleiner(heap[i], heap[p])) break; var t = heap[i]; heap[i] = heap[p]; heap[p] = t; i = p; } }
    function pop() {
      var top = heap[0], last = heap.pop();
      if (heap.length) { heap[0] = last; var i = 0; for (;;) { var l = 2 * i + 1, r = l + 1, m = i; if (l < heap.length && kleiner(heap[l], heap[m])) m = l; if (r < heap.length && kleiner(heap[r], heap[m])) m = r; if (m === i) break; var t = heap[i]; heap[i] = heap[m]; heap[m] = t; i = m; } }
      return top;
    }
    var s = sy * w + sx, z = zy * w + zx;
    gk[s] = 0; push({ i: s, f: hh(s), h: hh(s) });
    var DX = [1, -1, 0, 0], DY = [0, 0, 1, -1];
    while (heap.length) {
      var cur = pop();
      if (zu[cur.i]) continue;
      if (cur.i === z) {
        var pfad = [], k = z;
        while (k !== -1) { pfad.push({ x: k % w, y: Math.floor(k / w) }); k = von[k]; }
        return pfad.reverse();
      }
      zu[cur.i] = 1;
      var cx = cur.i % w, cy = Math.floor(cur.i / w);
      for (var d = 0; d < 4; d++) {
        var nx = cx + DX[d], ny = cy + DY[d];
        if (!drin(nx, ny) || grid.blockiert(nx, ny)) continue;
        var ni = ny * w + nx, ng = gk[cur.i] + 1;
        if (ng < gk[ni]) { gk[ni] = ng; von[ni] = cur.i; var hn = hh(ni); push({ i: ni, f: ng + hn, h: hn }); }
      }
    }
    return null;
  }

  Dorf.Pfad = { suche: suche };
})(globalThis);
