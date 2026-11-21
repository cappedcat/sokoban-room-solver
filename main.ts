// Sokoban solver: hallway + room decomposition, push-optimal A* per room (deadlock pruning, matching heuristic).
// Deterministic: work-counted caps only, no clock.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const I = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const O = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const CAP = 1500000; // node expansions per room search
const INF = 1e9;
const CH = 'udlr';

// Search one room. cells: grid (W*H) wall flags; hall = hallway cell (player start/exit, boxes never go there).
function room(W, H, wall, goal, boxes0, start, hall, needExit) {
  const N = W * H, dirs = [-W, W, -1, 1];
  const goals = [];
  for (let i = 0; i < N; i++) if (goal[i]) goals.push(i);
  const dist = goals.map(() => new Int32Array(N).fill(INF));
  goals.forEach((g, k) => {
    const d = dist[k]; d[g] = 0; const q = [g];
    for (let h = 0; h < q.length; h++) {
      const c = q[h];
      for (let a = 0; a < 4; a++) {
        const dd = dirs[a], from = c - dd, p0 = from - dd;
        if (wall[from] || wall[p0] || from === hall) continue;
        if (d[from] > d[c] + 1) { d[from] = d[c] + 1; q.push(from); }
      }
    }
  });
  const dead = new Uint8Array(N);
  for (let i = 0; i < N; i++) if (!wall[i] && dist.every((d) => d[i] >= INF)) dead[i] = 1;
  const nb = boxes0.length;
  const perms = [];
  (function p(a, u) { if (a.length === nb) { perms.push(a.slice()); return; } for (let i = 0; i < nb; i++) if (!u[i]) { u[i] = 1; a.push(i); p(a, u); a.pop(); u[i] = 0; } })([], []);
  const hf = (bx) => { let best = INF; for (const pm of perms) { let s = 0; for (let i = 0; i < nb && s < best; i++) s += dist[pm[i]][bx[i]]; if (s < best) best = s; } return best; };
  const frozen = (bx, set) => {
    for (const b of bx) {
      if (!goal[b]) {
        const bh = wall[b - 1] || wall[b + 1] || (dead[b - 1] && dead[b + 1]);
        const bv = wall[b - W] || wall[b + W] || (dead[b - W] && dead[b + W]);
        if (bh && bv) return true;
      }
      for (const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const c = [b, b + dx, b + dy * W, b + dx + dy * W];
        if (c.every((i) => wall[i] || set.has(i)) && c.some((i) => set.has(i) && !goal[i])) return true;
      }
    }
    return false;
  };
  const reach = (p, set) => {
    const seen = new Uint8Array(N); seen[p] = 1; const q = [p]; let mn = p;
    for (let i = 0; i < q.length; i++) { const c = q[i]; for (let a = 0; a < 4; a++) { const n = c + dirs[a]; if (!wall[n] && !seen[n] && !set.has(n)) { seen[n] = 1; q.push(n); if (n < mn) mn = n; } } }
    return { seen, mn };
  };
  const walk = (p, to, set) => {
    if (p === to) return '';
    const prev = new Int32Array(N).fill(-1), pa = new Int8Array(N); prev[p] = p; const q = [p];
    for (let i = 0; i < q.length; i++) { const c = q[i]; if (c === to) break; for (let a = 0; a < 4; a++) { const n = c + dirs[a]; if (!wall[n] && prev[n] < 0 && !set.has(n)) { prev[n] = c; pa[n] = a; q.push(n); } } }
    if (prev[to] < 0) return null;
    let s = ''; let c = to; while (c !== p) { s = CH[pa[c]] + s; c = prev[c]; }
    return s;
  };
  const key = (bx, r) => bx.join(',') + '|' + r;
  const heap = [];
  const less = (a, b) => a.f < b.f || (a.f === b.f && (a.g > b.g || (a.g === b.g && a.id < b.id)));
  const hpush = (n) => { let i = heap.length; heap.push(n); while (i > 0) { const p = (i - 1) >> 1; if (!less(n, heap[p])) break; heap[i] = heap[p]; i = p; } heap[i] = n; };
  const hpop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { let i = 0; for (;;) { let l = 2 * i + 1; if (l >= heap.length) break; if (l + 1 < heap.length && less(heap[l + 1], heap[l])) l++; if (!less(heap[l], last)) break; heap[i] = heap[l]; i = l; } heap[i] = last; } return top; };
  const sb = boxes0.slice().sort((a, b) => a - b);
  const h0 = hf(sb);
  if (h0 >= INF) return null;
  const r0 = reach(start, new Set(sb));
  const best = new Map([[key(sb, r0.mn), 0]]);
  let id = 0;
  hpush({ bx: sb, pp: start, g: 0, f: h0, id: id++, par: null, mv: null });
  let exp = 0;
  while (heap.length) {
    const n = hpop();
    const set = new Set(n.bx); const r = reach(n.pp, set);
    if (best.get(key(n.bx, r.mn)) < n.g) continue;
    if (n.bx.every((b) => goal[b]) && (!needExit || r.seen[hall])) {
      const s = []; for (let c = n; c.par; c = c.par) s.push(c.mv); s.reverse();
      let out = '', p = start; const bset = new Set(sb);
      for (const m of s) { out += walk(p, m.from - dirs[m.a], bset); out += CH[m.a].toUpperCase(); bset.delete(m.from); bset.add(m.to); p = m.from; }
      let tail = '';
      if (needExit) tail = walk(p, hall, bset);
      return { moves: out, tail, pushes: s.length, end: p, bset };
    }
    if (++exp > CAP) return null;
    for (let i = 0; i < nb; i++) {
      const b = n.bx[i];
      for (let a = 0; a < 4; a++) {
        const d = dirs[a], from = b - d, to = b + d;
        if (!r.seen[from] || wall[to] || set.has(to) || dead[to]) continue;
        const nbx = n.bx.slice(); nbx[i] = to; nbx.sort((x, y) => x - y);
        const ns = new Set(nbx);
        if (frozen(nbx, ns)) continue;
        const hv = hf(nbx); if (hv >= INF) continue;
        const rr = reach(b, ns), kk = key(nbx, rr.mn), g = n.g + 1;
        if (best.has(kk) && best.get(kk) <= g) continue;
        best.set(kk, g);
        hpush({ bx: nbx, pp: b, g, f: g + hv, id: id++, par: n, mv: { a, from: b, to } });
      }
    }
  }
  return null;
}

function solve(text) {
  const rows = text.split('\n').filter((r) => r.length > 0);
  const W = Math.max(...rows.map((r) => r.length)), H = rows.length, N = W * H;
  const wall = new Uint8Array(N).fill(1), goal = new Uint8Array(N), isBox = new Uint8Array(N);
  let pl = 0;
  rows.forEach((row, y) => { for (let x = 0; x < W; x++) { const c = row[x] ?? '#', i = y * W + x; if (c !== '#') wall[i] = 0; if ('.*+'.includes(c)) goal[i] = 1; if ('$*'.includes(c)) isBox[i] = 1; if ('@+'.includes(c)) pl = i; } });
  const hy = Math.floor(pl / W);
  // room components: open cells off the hallway row
  const comp = new Int32Array(N).fill(-1); const comps = [];
  for (let i = 0; i < N; i++) {
    if (wall[i] || comp[i] >= 0 || Math.floor(i / W) === hy) continue;
    const q = [i]; comp[i] = comps.length;
    for (let k = 0; k < q.length; k++) for (const d of [-W, W, -1, 1]) { const n = q[k] + d; if (n < 0 || n >= N || wall[n] || comp[n] >= 0 || Math.floor(n / W) === hy) continue; if ((d === -1 || d === 1) && Math.floor(n / W) !== Math.floor(q[k] / W)) continue; comp[n] = comps.length; q.push(n); }
    comps.push(q);
  }
  const rooms = [];
  for (const cells of comps) {
    let door = -1, hall = -1;
    for (const c of cells) for (const d of [-W, W]) { const n = c + d; if (Math.floor(n / W) === hy && !wall[n]) { door = c; hall = n; } }
    const w2 = new Uint8Array(N).fill(1), g2 = new Uint8Array(N); const bx = [];
    for (const c of cells) { w2[c] = 0; g2[c] = goal[c]; if (isBox[c]) bx.push(c); }
    w2[hall] = 0;
    const withExit = room(W, H, w2, g2, bx, hall, hall, true);
    const noExit = room(W, H, w2, g2, bx, hall, hall, false);
    rooms.push({ hall, withExit, noExit });
  }
  // order rooms by hall column; the room where exiting costs extra goes last
  rooms.sort((a, b) => (a.hall % W) - (b.hall % W));
  let lastIdx = -1, bestGain = 0;
  rooms.forEach((r, i) => { const e = r.withExit ? r.withExit.pushes : INF; const f = r.noExit ? r.noExit.pushes : INF; if (e - f > bestGain) { bestGain = e - f; lastIdx = i; } });
  if (lastIdx >= 0) rooms.push(rooms.splice(lastIdx, 1)[0]);
  let out = '', p = pl;
  const hallBlock = new Set();
  for (let i = 0; i < rooms.length; i++) {
    const r = rooms[i];
    const sol = i === rooms.length - 1 && lastIdx >= 0 ? r.noExit : r.withExit ?? r.noExit;
    if (!sol) continue;
    // walk along the hallway row to this room's hall cell
    const wallH = new Uint8Array(N).fill(1);
    for (let c = hy * W; c < hy * W + W; c++) if (!isWall(c)) wallH[c] = 0;
    function isWall(c) { return rowsWall(c); }
    function rowsWall(c) { const y = Math.floor(c / W), x = c % W; return (rows[y]?.[x] ?? '#') === '#'; }
    let s = '', c = p; const tgt = r.hall;
    while (c !== tgt) { const step = tgt > c ? 1 : -1; s += step > 0 ? 'r' : 'l'; c += step; }
    out += s + sol.moves + sol.tail;
    p = sol.tail ? r.hall : sol.end;
  }
  return out;
}

for (const id of readdirSync(I).sort()) {
  const moves = solve(readFileSync(join(I, id, 'level.txt'), 'utf8'));
  mkdirSync(join(O, id), { recursive: true });
  writeFileSync(join(O, id, 'solution.txt'), `${moves}\n`);
}
