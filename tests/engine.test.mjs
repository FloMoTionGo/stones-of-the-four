// Determinism and edge-rule contract for engine.js. Run: node --test tests/
// A port of the engine (C++, Unreal, anything) must replay these same logs to the same hashes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const S = require('../engine.js');

const SEEDS = [1, 2, 3, 7, 11, 42, 99, 1234, 65535, 123456789, 0xdeadbeef, 0];

test('same seed, same match', () => {
  for (const seed of SEEDS) {
    const a = S.selfPlay(seed, seed % 3), b = S.selfPlay(seed, seed % 3);
    assert.equal(S.hashState(a.s), S.hashState(b.s), `seed ${seed}`);
    assert.deepEqual(a.moves, b.moves);
    assert.ok(a.moves.length >= 10, `seed ${seed} played ${a.moves.length} moves`);
    assert.ok(a.over && a.result);
  }
});

test('a move log replays to the same hash', () => {
  for (const seed of SEEDS) {
    const m = S.selfPlay(seed, seed % 3), log = S.exportLog(m);
    const json = JSON.stringify(log);
    const r = S.replayLog(JSON.parse(json));
    assert.ok(r.ok, `seed ${seed}: ${r.why} at move ${r.at}`);
    assert.equal(r.hash, log.hash, `seed ${seed}`);
    assert.deepEqual(r.turns, log.turns);
    assert.equal(r.m.result.won, m.result.won);
    assert.equal(r.m.result.margin, m.result.margin);
  }
});

test('different seeds give different matches', () => {
  const hashes = new Set(SEEDS.map(seed => S.hashState(S.selfPlay(seed, 0).s)));
  assert.ok(hashes.size >= SEEDS.length - 1);
});

test('the market draws from the run stream, not Math.random', () => {
  const a = S.newRun(5), b = S.newRun(5);
  S.makeMarket(a); S.makeMarket(b);
  assert.deepEqual(a.market.map(s => s.el + s.tier), b.market.map(s => s.el + s.tier));
});

/* ---- edge rules the analysis flagged as drift risks ---- */
const empty = () => ({ board: Array(S.NN).fill(null), scorch: Array(S.NN).fill(null), captures: [0, 0] });
const put = (s, p, owner, el = S.PLAIN, tier = 0) => { s.board[p] = { id: 1000 + p, owner, el, tier, hp: el === 'earth' ? tier : 0 }; return s; };
const P = (col, row) => S.idx('ABCDEFGHJ'.indexOf(col), 9 - row);
const stone = (el, tier) => ({ el, tier });

test('scorched points are not liberties: a group whose last liberty is scorched is captured', () => {
  const s = put(put(empty(), P('A', 9), 0), P('B', 9), 1);
  const r = S.applyMove(s, 1, stone('fire', 1), P('A', 7), null);
  assert.ok(r.ok);
  assert.equal(r.ev.scorched, 3);
  assert.equal(r.ev.captured, 1);
  assert.equal(r.s.board[P('A', 9)], null);
});

test('earth armor absorbs enemy turns and comes back once the group breathes', () => {
  const s = put(put(empty(), P('A', 9), 0, 'earth', 2), P('B', 9), 1);
  let r = S.applyMove(s, 1, stone(S.PLAIN, 0), P('A', 8), null);
  assert.ok(r.ok); assert.equal(r.ev.cracked, 1); assert.equal(r.s.board[P('A', 9)].hp, 1);
  r = S.applyMove(r.s, 1, stone(S.PLAIN, 0), P('E', 5), null);
  assert.equal(r.ev.cracked, 1); assert.equal(r.s.board[P('A', 9)].hp, 0);
  // Black frees the group by capturing B9 (it has one liberty, C9, once A9's group counts as alive... give it room first).
  const t = S.cloneS(r.s); t.board[P('A', 8)] = null;
  const r2 = S.applyMove(t, 0, stone(S.PLAIN, 0), P('E', 4), null);
  assert.equal(r2.s.board[P('A', 9)].hp, 2, 'armor restored once the group has a liberty again');
  r = S.applyMove(r.s, 1, stone(S.PLAIN, 0), P('E', 3), null);
  assert.equal(r.ev.captured, 1, 'armor gone: captured on the next enemy turn');
});

test('air links share liberties as one group', () => {
  const s = put(put(empty(), P('A', 9), 0, 'air', 1), P('B', 8), 0);
  const { groups } = S.computeGroups(s, 0);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].stones.length, 2);
  assert.equal(groups[0].libs, 4);
  const t = put(put(empty(), P('A', 9), 0, 'air', 1), P('A', 7), 0);
  assert.equal(S.computeGroups(t, 0).groups.length, 2, 'a one-point jump needs Air II');
  const u = put(put(empty(), P('A', 9), 0, 'air', 2), P('A', 7), 0);
  assert.equal(S.computeGroups(u, 0).groups.length, 1);
});

test('water pushes by tier, two points at tier III', () => {
  let s = put(empty(), P('E', 5), 1, 'earth', 2);
  let r = S.applyMove(s, 0, stone('water', 1), P('D', 5), null);
  assert.equal(r.ev.pushed, 0, 'tier I cannot push a tier II stone');
  r = S.applyMove(s, 0, stone('water', 3), P('D', 5), null);
  assert.equal(r.ev.pushed, 1);
  assert.equal(r.s.board[P('E', 5)], null);
  assert.equal(r.s.board[P('G', 5)].el, 'earth');
  s = put(put(empty(), P('E', 5), 1), P('G', 5), 1);
  r = S.applyMove(s, 0, stone('water', 3), P('D', 5), null);
  assert.equal(r.s.board[P('F', 5)].owner, 1, 'blocked after one step');
});

test('ko: retaking at once repeats the position and is refused', () => {
  const s = empty();
  for (const [c, rw] of [['E', 6], ['D', 5], ['E', 4]]) put(s, P(c, rw), 0);
  for (const [c, rw] of [['F', 6], ['G', 5], ['F', 4], ['E', 5]]) put(s, P(c, rw), 1);
  const r1 = S.applyMove(s, 0, stone(S.PLAIN, 0), P('F', 5), null);
  assert.ok(r1.ok); assert.equal(r1.ev.captured, 1);
  const r2 = S.applyMove(r1.s, 1, stone(S.PLAIN, 0), P('E', 5), S.sig(s.board));
  assert.equal(r2.ok, false); assert.match(r2.why, /Ko/);
  const r3 = S.applyMove(r1.s, 1, stone(S.PLAIN, 0), P('E', 5), null);
  assert.ok(r3.ok, 'legal once the ko threat is answered');
});

test('clash shatters a lower-tier stone of the beaten element', () => {
  const s = put(empty(), P('E', 5), 1, 'air', 1);
  const r = S.applyMove(s, 0, stone('fire', 2), P('D', 5), null);
  assert.deepEqual(r.ev.shatter, { at: P('E', 5), el: 'air', tier: 1 });
  assert.equal(r.s.captures[0], 1);
  const r2 = S.applyMove(s, 0, stone('fire', 1), P('D', 5), null);
  assert.equal(r2.ev.shatter, null, 'tier I never shatters');
});
