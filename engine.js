/* Stones of the Four: rules engine.
   Pure functions over plain state objects. No DOM, no timers, no async and no Math.random
   inside a match: bag shuffles, the computer player's tie-break noise and the market all
   draw from a seeded mulberry32 stream whose state lives as a number on the state object,
   so a match replays from its seed and move log to the same board hash (see tests/).
   Loaded as a classic script in the browser (window.SOTF) or require()d from Node. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SOTF = factory();
}(typeof self !== 'undefined' ? self : this, function () {
'use strict';

/* ============================== constants ============================== */
const N = 9, NN = N * N, MAX_TURNS = 30, KOMI = 2.5, HAND = 3, MIN_BAG = 6, LIVES = 2;
const COLS = 'ABCDEFGHJ', ROMAN = ['', 'I', 'II', 'III'];
const EL_ORDER = ['fire', 'water', 'earth', 'air'];
const ELEM = {
  fire:  { name: 'Fire',  beats: 'air'   },
  water: { name: 'Water', beats: 'fire'  },
  earth: { name: 'Earth', beats: 'water' },
  air:   { name: 'Air',   beats: 'earth' },
};
const EFFECT = {
  fire:  ['', 'Scorches the empty points next to it for 1 enemy turn.',
              'Scorches the empty points next to it for 2 enemy turns.',
              'Scorches adjacent and diagonal empty points for 2 enemy turns.'],
  water: ['', 'Pushes adjacent enemy plain and tier I stones one point away.',
              'Pushes adjacent enemy plain, tier I and tier II stones one point away.',
              'Pushes any adjacent enemy stone up to two points away.'],
  earth: ['', 'Its group survives 1 enemy turn after being surrounded.',
              'Its group survives 2 enemy turns after being surrounded.',
              'Its group survives 3 enemy turns after being surrounded.'],
  air:   ['', 'Connects diagonally to your stones.',
              'Connects diagonally and across a one-point jump.',
              'Connects diagonally, across a jump, and at a knight’s move.'],
};
const PRICE = { up: { 1: 3, 2: 6 }, buy: { 1: 2, 2: 5, 3: 9 }, plain: 1, infuse: 3, tx: 2, rm: 1, reroll: 2 };
// Plain stones: no element, tier 0. At most half of any bag may be element stones.
const PLAIN = 'plain', SORT_ORDER = ['fire', 'water', 'earth', 'air', 'plain'];
const PLAIN_TEXT = 'An ordinary Go stone with no element.';
const START_MIX = { plain: 8, 1: 2 };
const OPPONENTS = [
  { name: 'Ren',    title: 'the Apprentice', mix: { plain: 8, 1: 2 }, blurb: 'Brings the same bag you start with: 8 plain stones and 8 tier I element stones.' },
  { name: 'Mirela', title: 'the Adept',      mix: { plain: 8, 2: 2 }, blurb: '8 plain stones, and all 8 of her element stones are tier II.' },
  { name: 'Ozu',    title: 'the Master',     mix: { plain: 8, 3: 2 }, blurb: '8 plain stones, and all 8 of his element stones are tier III.' },
];
const MARKET_WEIGHTS = [[0.8, 0.2, 0], [0.55, 0.4, 0.05], [0.25, 0.5, 0.25]];

/* ============================== geometry ============================== */
const X = i => i % N, Y = i => (i / N) | 0, idx = (x, y) => y * N + x;
const inb = (x, y) => x >= 0 && y >= 0 && x < N && y < N;
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const ORTH = [], DIAG = [], JUMP = [], KNIGHT = [], NEAR = [];
const INFW = [0, 1.0, 0.5, 0.22];
for (let i = 0; i < NN; i++) {
  const x = X(i), y = Y(i);
  const pick = list => list.filter(([dx, dy]) => inb(x + dx, y + dy)).map(([dx, dy]) => idx(x + dx, y + dy));
  ORTH[i] = pick(DIRS);
  DIAG[i] = pick([[1, 1], [1, -1], [-1, 1], [-1, -1]]);
  JUMP[i] = pick([[2, 0], [-2, 0], [0, 2], [0, -2]]);
  KNIGHT[i] = pick([[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]]);
  const near = [];
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
    const d = Math.abs(dx) + Math.abs(dy);
    if (d >= 1 && d <= 3 && inb(x + dx, y + dy)) near.push(idx(x + dx, y + dy), d);
  }
  NEAR[i] = near;
}
const stepD = (p, dx, dy) => { const x = X(p) + dx, y = Y(p) + dy; return inb(x, y) ? idx(x, y) : -1; };
const coord = p => COLS[X(p)] + (N - Y(p));

/* ============================== seeded randomness ============================== */
// mulberry32. The stream state is the uint32 number h[key]; advancing it mutates h.
function nextRandom(h, key = 'rng') {
  const a = (h[key] + 0x6D2B79F5) | 0; h[key] = a >>> 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const rnd = (h, n, key) => Math.floor(nextRandom(h, key) * n);
function shuffle(a, h, key) { for (let i = a.length - 1; i > 0; i--) { const j = rnd(h, i + 1, key); [a[i], a[j]] = [a[j], a[i]]; } return a; }
// The only call to Math.random: picking a fresh seed for a new run.
const randomSeed = () => (Math.random() * 4294967296) >>> 0;
function mixSeed(seed, k) {
  let x = (seed ^ Math.imul(k + 1, 0x9E3779B1)) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x85EBCA6B) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 0xC2B2AE35) >>> 0;
  return (x ^ (x >>> 16)) >>> 0;
}

/* ============================== stones and bags ============================== */
let NEXT_ID = 1, UID = 1;
const ids = o => { if (o) { NEXT_ID = o.NEXT_ID; UID = o.UID; } return { NEXT_ID, UID }; };
const newStone = (el, tier) => ({ uid: UID++, el, tier });
const isPlain = st => st.el === PLAIN;
const stoneName = st => isPlain(st) ? 'Plain stone' : `${ELEM[st.el].name} ${ROMAN[st.tier]}`;
const effectText = st => isPlain(st) ? PLAIN_TEXT : EFFECT[st.el][st.tier];
const clashText = st => isPlain(st) ? 'Can’t be shattered, but Water can push it.' : st.tier === 1 ? 'Too weak to shatter anything.' : `Shatters an adjacent ${ELEM[ELEM[st.el].beats].name} of tier ${st.tier === 2 ? 'I' : 'I or II'}.`;
const bagFrom = mix => { const b = []; for (let k = 0; k < (mix.plain || 0); k++) b.push(newStone(PLAIN, 0)); for (const el of EL_ORDER) for (const t of [1, 2, 3]) for (let k = 0; k < (mix[t] || 0); k++) b.push(newStone(el, t)); return b; };
const sortBag = bag => bag.slice().sort((a, b) => SORT_ORDER.indexOf(a.el) - SORT_ORDER.indexOf(b.el) || b.tier - a.tier);
const elementCount = bag => bag.filter(s => !isPlain(s)).length;
const elementCap = n => Math.floor(n / 2);

/* ============================== rules ============================== */
const cloneS = s => ({ board: s.board.map(c => c ? { ...c } : null), scorch: s.scorch.map(x => x ? { ...x } : null), captures: s.captures.slice() });
const sig = board => board.map(c => c ? c.owner : '.').join('');
const airT = c => (c && c.el === 'air') ? c.tier : 0;
const newEv = () => ({ shatter: null, scorched: 0, pushed: 0, captured: 0, cracked: 0 });

function computeGroups(s, owner) {
  const b = s.board, sc = s.scorch, gid = new Int16Array(NN).fill(-1), groups = [];
  for (let i = 0; i < NN; i++) {
    const c = b[i];
    if (!c || c.owner !== owner || gid[i] >= 0) continue;
    const g = { stones: [], libs: 0 }, gi = groups.length, stack = [i];
    gid[i] = gi;
    while (stack.length) {
      const j = stack.pop(); g.stones.push(j);
      const aj = airT(b[j]);
      const visit = (n, need) => {
        const cn = b[n];
        if (cn && cn.owner === owner && gid[n] < 0 && Math.max(aj, airT(cn)) >= need) { gid[n] = gi; stack.push(n); }
      };
      for (const n of ORTH[j]) visit(n, 0);
      for (const n of DIAG[j]) visit(n, 1);
      for (const n of JUMP[j]) visit(n, 2);
      for (const n of KNIGHT[j]) visit(n, 3);
    }
    const libs = new Set();
    for (const j of g.stones) for (const n of ORTH[j]) if (!b[n] && !(sc[n] && sc[n].owner !== owner)) libs.add(n);
    g.libs = libs.size;
    groups.push(g);
  }
  return { groups, gid };
}

// Victim groups without liberties crack their Earth armor or get captured. Groups that breathe regain armor.
function resolveCaptures(t, victim, attacker, ev) {
  const { groups } = computeGroups(t, victim);
  for (const g of groups) {
    const earth = g.stones.filter(j => t.board[j].el === 'earth');
    if (g.libs === 0) {
      const armor = earth.reduce((mx, j) => Math.max(mx, t.board[j].hp), 0);
      if (armor > 0) { for (const j of earth) t.board[j].hp = Math.max(0, t.board[j].hp - 1); ev.cracked += g.stones.length; }
      else { for (const j of g.stones) t.board[j] = null; t.captures[attacker] += g.stones.length; ev.captured += g.stones.length; }
    } else {
      for (const j of earth) t.board[j].hp = t.board[j].tier;
    }
  }
}

function applyMove(s, owner, stone, p, koSig) {
  if (s.board[p]) return { ok: false, why: 'That point is taken.' };
  if (s.scorch[p] && s.scorch[p].owner !== owner) return { ok: false, why: 'That point is scorched. You can’t play there until the fire dies down.' };
  const t = cloneS(s), opp = 1 - owner, ev = newEv(), tier = stone.tier;
  t.board[p] = { id: NEXT_ID++, owner, el: stone.el, tier, hp: stone.el === 'earth' ? tier : 0, uid: stone.uid };
  t.scorch[p] = null;
  // 1. Clash: shatter one adjacent enemy stone of the element this one beats, of a strictly lower tier.
  const prey = isPlain(stone) ? null : ELEM[stone.el].beats; let best = -1;
  for (const n of ORTH[p]) {
    const c = t.board[n];
    if (prey && c && c.owner === opp && c.el === prey && c.tier < tier && (best < 0 || c.tier > t.board[best].tier)) best = n;
  }
  if (best >= 0) { ev.shatter = { at: best, el: t.board[best].el, tier: t.board[best].tier }; t.board[best] = null; t.captures[owner]++; }
  // 2. Element effect
  if (stone.el === 'fire') {
    const dur = tier === 1 ? 1 : 2, pts = tier === 3 ? ORTH[p].concat(DIAG[p]) : ORTH[p];
    for (const q of pts) if (!t.board[q]) {
      const cur = t.scorch[q];
      if (!cur || cur.owner !== owner || cur.left < dur) { t.scorch[q] = { owner, left: dur }; ev.scorched++; }
    }
  } else if (stone.el === 'water') {
    const reach = tier === 3 ? 2 : 1;
    for (const [dx, dy] of DIRS) {
      const n = stepD(p, dx, dy); if (n < 0) continue;
      const c = t.board[n];
      if (!c || c.owner !== opp || c.tier > tier) continue;
      let cur = n;
      for (let k = 0; k < reach; k++) { const nx = stepD(cur, dx, dy); if (nx < 0 || t.board[nx]) break; cur = nx; }
      if (cur !== n) { t.board[cur] = c; t.board[n] = null; t.scorch[cur] = null; ev.pushed++; }
    }
  }
  // 3. Captures
  resolveCaptures(t, opp, owner, ev);
  // 4. Legality: no suicide
  const { groups, gid } = computeGroups(t, owner);
  const g = groups[gid[p]];
  if (!g || g.libs === 0) return { ok: false, why: 'That stone would have no liberties, so it can’t be played there.' };
  for (const gg of groups) if (gg.libs > 0) for (const j of gg.stones) { const c = t.board[j]; if (c.el === 'earth') c.hp = c.tier; }
  const sg = sig(t.board);
  if (koSig && sg === koSig) return { ok: false, why: 'Ko: that would repeat the previous position. Play elsewhere first.' };
  return { ok: true, s: t, ev, sig: sg };
}

function tickScorch(s, mover) {
  for (let i = 0; i < NN; i++) {
    const sc = s.scorch[i];
    if (sc && sc.owner !== mover) { sc.left--; if (sc.left <= 0) s.scorch[i] = null; }
    if (s.board[i]) s.scorch[i] = null;
  }
}

function areaScore(s) {
  const b = s.board, st = [0, 0], ter = [0, 0], own = new Int8Array(NN).fill(-1), seen = new Uint8Array(NN);
  for (let i = 0; i < NN; i++) if (b[i]) st[b[i].owner]++;
  for (let i = 0; i < NN; i++) {
    if (b[i] || seen[i]) continue;
    const region = [], stack = [i]; let mask = 0; seen[i] = 1;
    while (stack.length) {
      const j = stack.pop(); region.push(j);
      for (const n of ORTH[j]) {
        if (b[n]) mask |= (1 << b[n].owner);
        else if (!seen[n]) { seen[n] = 1; stack.push(n); }
      }
    }
    if (mask === 1 || mask === 2) { const o = mask === 1 ? 0 : 1; ter[o] += region.length; for (const j of region) own[j] = o; }
  }
  return { st, ter, own, total: [st[0] + ter[0], st[1] + ter[1] + KOMI] };
}

// A stable fingerprint of a position: owner, element, tier and armor of every stone, every scorch mark, the capture counts.
function hashState(s) {
  let str = '';
  for (let i = 0; i < NN; i++) {
    const c = s.board[i], sc = s.scorch[i];
    str += c ? `${c.owner}${c.el[0]}${c.tier}${c.hp}` : '.';
    if (sc) str += `s${sc.owner}${sc.left}`;
    str += '|';
  }
  str += s.captures.join(',');
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}

/* ============================== computer player ============================== */
// The same greedy one-move lookahead plays every level. Only the bag differs.
function evaluate(s, me) {
  const b = s.board, inf = new Float32Array(NN); let v = 0;
  for (let i = 0; i < NN; i++) {
    const c = b[i]; if (!c) continue;
    const sg = c.owner === me ? 1 : -1; v += sg;
    const near = NEAR[i];
    for (let k = 0; k < near.length; k += 2) inf[near[k]] += sg * INFW[near[k + 1]];
  }
  for (let i = 0; i < NN; i++) if (!b[i]) { let x = inf[i] / 1.6; if (x > 1) x = 1; else if (x < -1) x = -1; v += x * 0.85; }
  for (const side of [me, 1 - me]) {
    const mine = side === me;
    for (const g of computeGroups(s, side).groups) {
      const n = g.stones.length;
      if (g.libs === 0) v += mine ? -1.3 * n : 0.9 * n;
      else if (g.libs === 1) v += mine ? -0.75 * n : 0.45 * n;
      else if (g.libs === 2) v += mine ? -0.12 * n : 0.08 * n;
    }
  }
  return v;
}

// Picks a move for side `me` (the opponent is side 1 in a run). Tie-break noise comes from the match's own AI stream.
function aiChoose(m, me = 1) {
  const pile = m.piles[me], ko = koSig(m), base = evaluate(m.s, me);
  const stonesOnBoard = m.s.board.reduce((n, c) => n + (c ? 1 : 0), 0);
  let best = null; const seen = new Set();
  pile.hand.forEach((st, hi) => {
    const key = st.el + st.tier; if (seen.has(key)) return; seen.add(key);
    for (let p = 0; p < NN; p++) {
      if (m.s.board[p]) continue;
      const r = applyMove(m.s, me, st, p, ko); if (!r.ok) continue;
      let v = evaluate(r.s, me) + nextRandom(m, 'aiRng') * 0.3;
      const x = X(p), y = Y(p);
      if (stonesOnBoard < 14 && (x === 0 || y === 0 || x === N - 1 || y === N - 1)) v -= 0.6;
      if (!best || v > best.v) best = { v, hi, p };
    }
  });
  if (!best) return null;
  const sc = areaScore(m.s), ahead = sc.total[me] > sc.total[1 - me], gain = best.v - base;
  if (m.passes === 1 && ahead && gain < 1.0) return null;
  if (m.turn[me] >= 14 && gain < 0.35) return null;
  return best;
}

/* ============================== match flow ============================== */
// Stones keep their uid through the pile and onto the board, so a front end can give each one a stable look.
function mkPile(list, m) { const p = { draw: shuffle(list.map((s, i) => ({ el: s.el, tier: s.tier, uid: s.uid ?? i + 1 })), m), discard: [], hand: [] }; refill(p, m); return p; }
function refill(p, m) {
  while (p.hand.length < HAND) {
    if (!p.draw.length) { if (!p.discard.length) break; p.draw = shuffle(p.discard, m); p.discard = []; }
    p.hand.push(p.draw.pop());
  }
}
const koSig = m => m.history.length >= 2 ? m.history[m.history.length - 2] : null;
const who = (m, side) => side === 0 ? 'You' : OPPONENTS[m.lv].name;
const whose = (m, side) => side === 0 ? 'your' : `${OPPONENTS[m.lv].name}’s`;
function addLog(m, side, text) { m.log.unshift({ side, text }); if (m.log.length > 60) m.log.pop(); }

function evText(m, ev, side) {
  const parts = [], plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  if (ev.shatter) parts.push(`shattered ${whose(m, 1 - side)} ${ELEM[ev.shatter.el].name} ${ROMAN[ev.shatter.tier]}`);
  if (ev.scorched) parts.push(`scorched ${plural(ev.scorched, 'point')}`);
  if (ev.pushed) parts.push(`pushed ${plural(ev.pushed, 'stone')}`);
  if (ev.captured) parts.push(`captured ${plural(ev.captured, 'stone')}`);
  if (ev.cracked) parts.push(`${whose(m, 1 - side)} surrounded group held on with Earth armor`);
  return parts.length ? ': ' + parts.join(', ') : '';
}

function hasAnyLegal(m, side) {
  const ko = koSig(m);
  for (const st of m.piles[side].hand) for (let p = 0; p < NN; p++) if (!m.s.board[p] && applyMove(m.s, side, st, p, ko).ok) return true;
  return false;
}

// What changed between two positions, for animation: stones that vanished, stones that slid, the stone just placed.
function diffFx(before, after, p) {
  const apos = new Map(); after.board.forEach((c, i) => c && apos.set(c.id, i));
  const removed = [], moved = [];
  before.board.forEach((c, i) => {
    if (!c) return;
    if (!apos.has(c.id)) removed.push({ i, c });
    else if (apos.get(c.id) !== i) moved.push({ id: c.id, from: i, to: apos.get(c.id) });
  });
  return { removed, moved, placed: p >= 0 && after.board[p] ? after.board[p].id : null };
}

// A match from explicit bag contents (lists of {el, tier}) and a seed. Side 0 (you) plays first.
function matchFrom(lv, bags, seed) {
  const opp = OPPONENTS[lv];
  const m = {
    lv, seed: seed >>> 0, rng: seed >>> 0, aiRng: mixSeed(seed, 0x51), bags, moves: [],
    s: { board: Array(NN).fill(null), scorch: Array(NN).fill(null), captures: [0, 0] },
    toMove: 0, turn: [0, 0], passes: 0, history: [], log: [], over: false, result: null, last: null, fx: null, piles: null,
  };
  m.piles = [mkPile(bags[0], m), mkPile(bags[1], m)];
  m.history.push(sig(m.s.board));
  addLog(m, -1, `Match ${lv + 1} against ${opp.name} ${opp.title}. You play first. ${opp.name} gets ${KOMI} komi.`);
  return m;
}
function newMatch(run, lv, seed) {
  if (seed === undefined) seed = mixSeed(run.seed, run.matchNo++);
  const bags = [run.bag.map(s => ({ el: s.el, tier: s.tier, uid: s.uid })), bagFrom(OPPONENTS[lv].mix).map(s => ({ el: s.el, tier: s.tier, uid: s.uid }))];
  return matchFrom(lv, bags, seed);
}

// Moves play to the side whose turn it is: ends the match at the turn limit, skips a side out of turns,
// passes for a side with no legal move. Returns the side to move (0 or 1) or 'over'.
function advance(m, run) {
  for (;;) {
    if (m.over) return 'over';
    if (m.turn[0] >= MAX_TURNS && m.turn[1] >= MAX_TURNS) { endMatch(m, run, 'turns'); return 'over'; }
    const side = m.toMove;
    if (m.turn[side] >= MAX_TURNS) { m.toMove = 1 - side; continue; }
    if (!hasAnyLegal(m, side)) { doPass(m, run, side, true); continue; }
    return side;
  }
}

function commit(m, side, hi, p) {
  const pile = m.piles[side], st = pile.hand[hi], before = m.s;
  const r = applyMove(before, side, st, p, koSig(m));
  if (!r.ok) return r;
  m.s = r.s; tickScorch(m.s, side);
  m.history.push(r.sig); m.passes = 0; m.turn[side]++;
  pile.hand.splice(hi, 1); pile.discard.push(st); refill(pile, m);
  m.fx = diffFx(before, m.s, p);
  m.last = { p };
  m.moves.push({ side, el: st.el, tier: st.tier, p });
  addLog(m, side, `${who(m, side)} played ${stoneName(st)} at ${coord(p)}${evText(m, r.ev, side)}.`);
  m.toMove = 1 - side;
  r.stone = st;
  return r;
}

function doPass(m, run, side, forced) {
  const before = m.s, t = cloneS(m.s), ev = newEv();
  resolveCaptures(t, 1 - side, side, ev); tickScorch(t, side);
  m.s = t; m.fx = diffFx(before, t, -1); m.last = null;
  m.passes++; m.turn[side]++; m.history.push(sig(t.board));
  if (!forced) m.moves.push({ side, pass: true });
  addLog(m, side, `${who(m, side)} ${forced ? 'had no legal move and passed' : 'passed'}${evText(m, ev, side)}.`);
  if (m.passes >= 2) return endMatch(m, run, 'passes');
  m.toMove = 1 - side;
}

// Scores the match, pays out and updates the run (when one is given). Returns the result.
function endMatch(m, run, reason) {
  m.over = true;
  const sc = areaScore(m.s), diff = sc.total[0] - sc.total[1], won = diff > 0, margin = Math.abs(diff);
  const caps = m.s.captures[0];
  const capGold = Math.floor(caps / 2);
  const gold = won ? 12 + Math.min(12, Math.floor(margin)) + capGold : 6 + capGold;
  m.result = { won, sc, margin, gold, caps, capGold, reason };
  if (run) {
    run.gold += gold; run.goldTotal += gold; run.captures += caps;
    if (won) { run.cleared[m.lv] = true; run.wins++; } else { run.lives--; run.losses++; }
  }
  addLog(m, -1, `Match over (${reason === 'passes' ? 'both players passed' : 'turn limit reached'}). ${won ? 'You win' : OPPONENTS[m.lv].name + ' wins'} by ${margin}.`);
  return m.result;
}

/* ============================== move logs and replay ============================== */
// Everything needed to replay a match: the seed, both bags and every chosen move. Forced passes are derived.
function exportLog(m) {
  return { v: 1, game: 'stones-of-the-four', seed: m.seed, lv: m.lv, bags: m.bags, moves: m.moves.slice(), turns: m.turn.slice(), hash: hashState(m.s) };
}
// Replays a log on a fresh match and reports the resulting hash. ok is false if a logged move was illegal.
function replayLog(log) {
  const m = matchFrom(log.lv, log.bags, log.seed);
  for (let i = 0; i < log.moves.length; i++) {
    const mv = log.moves[i], side = advance(m, null);
    if (side !== mv.side) return { ok: false, at: i, why: `expected side ${mv.side} to move, got ${side}`, hash: hashState(m.s), m };
    if (mv.pass) { doPass(m, null, side, false); continue; }
    const hi = m.piles[side].hand.findIndex(h => h.el === mv.el && h.tier === mv.tier);
    if (hi < 0) return { ok: false, at: i, why: `${mv.el} ${mv.tier} is not in hand`, hash: hashState(m.s), m };
    const r = commit(m, side, hi, mv.p);
    if (!r.ok) return { ok: false, at: i, why: r.why, hash: hashState(m.s), m };
  }
  if (!m.over) advance(m, null);
  return { ok: true, hash: hashState(m.s), turns: m.turn.slice(), m };
}
// The computer player against itself from one seed. Used by the determinism tests.
function selfPlay(seed, lv = 0) {
  const run = newRun(seed), m = newMatch(run, lv, seed);
  for (;;) {
    const side = advance(m, run);
    if (side === 'over') return m;
    const c = aiChoose(m, side);
    if (!c) doPass(m, run, side, false); else commit(m, side, c.hi, c.p);
  }
}

/* ============================== run and shop ============================== */
function newRun(seed) {
  seed = seed >>> 0;
  return { seed, rng: mixSeed(seed, 0xB5), matchNo: 0, level: 0, lives: LIVES, gold: 0, goldTotal: 0, bag: bagFrom(START_MIX), cleared: [false, false, false], market: [], wins: 0, losses: 0, captures: 0 };
}
function makeMarket(run) {
  const w = MARKET_WEIGHTS[run.level];
  run.market = Array.from({ length: 4 }, () => {
    const r = nextRandom(run); const tier = r < w[0] ? 1 : r < w[0] + w[1] ? 2 : 3;
    return newStone(EL_ORDER[rnd(run, 4)], tier);
  });
}
// After the result screen: where the run goes next and what to tell the player.
function afterMatch(run, m) {
  const res = m.result;
  if ((res.won && m.lv === 2) || (!res.won && run.lives <= 0)) return { screen: 'end', flash: '' };
  if (res.won) run.level = m.lv + 1;
  makeMarket(run);
  const name = OPPONENTS[run.level].name;
  return { screen: 'shop', flash: res.won ? `You earned ${res.gold} gold. Spend it before facing ${name}.` : `You earned ${res.gold} gold. Rework your bag and try ${name} again.` };
}

const roomToAdd = run => elementCount(run.bag) + 1 <= elementCap(run.bag.length + 1);
const roomToInfuse = run => elementCount(run.bag) + 1 <= elementCap(run.bag.length);
const canRemove = (run, st) => run.bag.length > MIN_BAG && elementCount(run.bag) - (isPlain(st) ? 0 : 1) <= elementCap(run.bag.length - 1);
const freeSlots = run => elementCap(run.bag.length) - elementCount(run.bag);

// One Stonecutter action on the selected stone (by uid). arg is an element name or a market index.
// Returns null when nothing happened, else { flash, sel? } with the new selection when it changed.
function shopAct(run, act, selUid, arg) {
  const st = run.bag.find(s => s.uid === selUid);
  if (act === 'up' && st && !isPlain(st) && st.tier < 3 && run.gold >= PRICE.up[st.tier]) {
    run.gold -= PRICE.up[st.tier]; st.tier++; return { flash: `Carved it up to ${stoneName(st)}.` };
  }
  if (act === 'tx' && st && !isPlain(st) && st.el !== arg && run.gold >= PRICE.tx) {
    run.gold -= PRICE.tx; st.el = arg; return { flash: `Transmuted it into ${stoneName(st)}.` };
  }
  if (act === 'infuse' && st && isPlain(st) && roomToInfuse(run) && run.gold >= PRICE.infuse) {
    run.gold -= PRICE.infuse; st.el = arg; st.tier = 1; return { flash: `Infused it into ${stoneName(st)}.` };
  }
  if (act === 'rm' && st && canRemove(run, st) && run.gold >= PRICE.rm) {
    run.gold -= PRICE.rm; run.bag = run.bag.filter(s => s !== st); return { flash: `Removed a ${stoneName(st)} from your bag.`, sel: null };
  }
  if (act === 'plain' && run.gold >= PRICE.plain) {
    run.gold -= PRICE.plain; const ns = newStone(PLAIN, 0); run.bag.push(ns);
    const free = freeSlots(run);
    return { sel: ns.uid, flash: `Added a plain stone. ${free ? `You have room for ${free} more element stone${free === 1 ? '' : 's'}.` : 'One more plain stone makes room for another element stone.'}` };
  }
  if (act === 'buy') {
    const i = +arg, o = run.market[i];
    if (o && roomToAdd(run) && run.gold >= PRICE.buy[o.tier]) { run.gold -= PRICE.buy[o.tier]; run.bag.push(o); run.market[i] = null; return { sel: o.uid, flash: `Bought ${stoneName(o)}.` }; }
    return {};
  }
  if (act === 'reroll' && run.gold >= PRICE.reroll) {
    run.gold -= PRICE.reroll; makeMarket(run); return { flash: 'The merchant laid out new stones.' };
  }
  return null;
}

return {
  N, NN, MAX_TURNS, KOMI, HAND, MIN_BAG, LIVES, COLS, ROMAN, EL_ORDER, ELEM, EFFECT, PRICE, PLAIN, SORT_ORDER, PLAIN_TEXT, START_MIX, OPPONENTS, MARKET_WEIGHTS,
  X, Y, idx, inb, DIRS, ORTH, DIAG, JUMP, KNIGHT, stepD, coord,
  nextRandom, rnd, shuffle, randomSeed, mixSeed,
  ids, newStone, isPlain, stoneName, effectText, clashText, bagFrom, sortBag, elementCount, elementCap,
  cloneS, sig, computeGroups, resolveCaptures, applyMove, tickScorch, areaScore, hashState,
  evaluate, aiChoose,
  mkPile, refill, koSig, who, whose, addLog, evText, hasAnyLegal, diffFx, matchFrom, newMatch, advance, commit, doPass, endMatch,
  exportLog, replayLog, selfPlay,
  newRun, makeMarket, afterMatch, roomToAdd, roomToInfuse, canRemove, freeSlots, shopAct,
};
}));
