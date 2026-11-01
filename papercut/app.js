// Stones of the Four, Papercut Noir build. Game flow and the HTML sheets; the diorama lives in scene.js, the rules in ../engine.js.
import { createScene } from './scene.js';

const S = window.SOTF;
const { N, NN, MAX_TURNS, KOMI, LIVES, MIN_BAG, ROMAN, EL_ORDER, ELEM, EFFECT, PRICE, PLAIN, SORT_ORDER, PLAIN_TEXT, OPPONENTS, X, Y, coord, applyMove, computeGroups, areaScore, koSig, diffFx, isPlain, stoneName, effectText, clashText, bagFrom, sortBag, elementCount, elementCap } = S;
const STORE_KEY = 'stones-of-the-four:v1';
const $ = sel => document.querySelector(sel);

let run = null, m = null, screen = 'title', scene = null;
const ui = { sel: -1, hover: -1, cursor: 40, kbd: false, shopSel: null, flash: '', lastPointer: 'mouse', aiTimer: 0, passArm: 0, shattered: [0, 0], handKey: '' };

function loadRecord() { try { return JSON.parse(localStorage.getItem(STORE_KEY)) || { best: 0, runsWon: 0 }; } catch (e) { return { best: 0, runsWon: 0 }; } }
function saveRecord(r) { try { localStorage.setItem(STORE_KEY, JSON.stringify(r)); } catch (e) { /* storage unavailable */ } }
const img = (el, tier, owner, size = 96, cls = '') => `<img src="${scene.sprite(el, tier, owner, size)}" alt="" class="${cls}" width="${size / 2}" height="${size / 2}">`;
const elClass = st => `el-${st.el}`;

/* ============================== match flow ============================== */
function startMatch(lv) {
  m = S.newMatch(run, lv);
  ui.sel = 0; ui.hover = -1; ui.passArm = 0; ui.shattered = [0, 0]; ui.handKey = '';
  screen = 'match'; showScreen();
  scene.enterMatch();
  syncAll({ removed: [], moved: [], placed: null });
  startTurn();
}
function startTurn() {
  if (!m || m.over) return;
  const side = S.advance(m, run);
  if (side === 'over') return finishMatch();
  syncAll(m.fx); m.fx = null;
  if (side === 1) { clearTimeout(ui.aiTimer); ui.aiTimer = setTimeout(aiTurn, 800); }
}
function aiTurn() {
  if (!m || m.over || m.toMove !== 1 || screen !== 'match') return;
  const c = S.aiChoose(m, 1);
  if (!c) { S.doPass(m, run, 1, false); ui.passArm = 0; }
  else { const r = S.commit(m, 1, c.hi, c.p); if (r.ev.shatter) ui.shattered[1]++; }
  if (m.over) finishMatch(); else { syncAll(m.fx); m.fx = null; startTurn(); }
}
function playerMove(hi, p) {
  const r = S.commit(m, 0, hi, p);
  if (!r.ok) return r;
  if (r.ev.shatter) ui.shattered[0]++;
  ui.hover = -1; scene.clearPreview();
  const same = m.piles[0].hand.findIndex(h => h.el === r.stone.el && h.tier === r.stone.tier);
  ui.sel = same >= 0 ? same : 0;
  syncAll(m.fx); m.fx = null;
  startTurn();
  return r;
}
function playerPass() {
  S.doPass(m, run, 0, false); ui.passArm = 0;
  if (m.over) finishMatch(); else { syncAll(m.fx); m.fx = null; startTurn(); }
}
function finishMatch() {
  clearTimeout(ui.aiTimer);
  const rec = loadRecord(), cleared = run.cleared.filter(Boolean).length;
  if (cleared > rec.best) rec.best = cleared;
  if (m.result.won && m.lv === 2) rec.runsWon++;
  saveRecord(rec);
  ui.hover = -1; scene.clearPreview();
  syncAll(m.fx); m.fx = null;
  renderResult();
}
// Copies the log to the clipboard and offers it as a download (hosted viewers block downloads, so the copy is the sure path).
function downloadLog() {
  const log = S.exportLog(m), json = JSON.stringify(log, null, 1), a = document.createElement('a');
  const note = $('#result .lognote');
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(json).then(() => { if (note) note.textContent = 'Copied the move log to the clipboard.'; }).catch(() => {});
  a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  a.download = `stones-match-${log.lv + 1}-${log.seed}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ============================== run / shop ============================== */
function newRun() { run = S.newRun(S.randomSeed()); ui.shopSel = null; ui.flash = ''; startMatch(0); }
function afterMatch() {
  const next = S.afterMatch(run, m);
  m = null; screen = next.screen; ui.shopSel = null; ui.flash = next.flash;
  showScreen();
}
function shopAct(act, el) {
  const r = S.shopAct(run, act, ui.shopSel, act === 'buy' ? el.dataset.i : el.dataset.el);
  if (!r) return;
  if (r.flash !== undefined) ui.flash = r.flash;
  if ('sel' in r) ui.shopSel = r.sel;
  renderShop();
}

/* ============================== sync: diorama + HUD ============================== */
function syncAll(fx) {
  if (!m) return;
  scene.syncBoard(m, fx);
  const hand = m.piles[0].hand, key = hand.map(s => s.el + s.tier).join(',');
  if (key !== ui.handKey) {
    // a changed hand: stones that are new fall in from above
    const old = ui.handKey ? ui.handKey.split(',') : [];
    const drawn = hand.map((s, i) => (old[i] !== s.el + s.tier) ? i : -1).filter(i => i >= 0);
    scene.syncHand(hand, ui.sel, drawn);
    ui.handKey = key;
    if (old.length && drawn.length) { const b = $('#bagbox'); b.classList.remove('jiggle'); void b.offsetWidth; b.classList.add('jiggle'); }
  }
  scene.setHandSel(m.over || m.toMove !== 0 ? -1 : ui.sel);
  renderHud();
}

function renderHud() {
  const opp = OPPONENTS[m.lv], sc = areaScore(m.s), op = m.piles[1];
  const lead = sc.total[0] - sc.total[1];
  $('#header').innerHTML = `<h1>Stones of the Four</h1>
    <span class="label" style="display:inline-flex;gap:6px;align-items:center">Level <span class="dots">${[0, 1, 2].map(i => `<span class="dot ${run.cleared[i] ? 'done' : i === m.lv ? 'now' : ''}"></span>`).join('')}</span></span>
    <span class="label">${run.gold} gold</span>
    <span class="label ${run.lives <= 1 ? 'last-life' : ''}" style="display:inline-flex;gap:5px;align-items:center" aria-label="${run.lives} of ${LIVES} lives">${run.lives <= 1 ? 'Last life' : 'Lives'} ${Array.from({ length: LIVES }, (_, i) => `<span class="life ${i < run.lives ? '' : 'lost'}"></span>`).join('')}</span>
    <button class="btn quiet" data-act="rules">How to play</button>`;
  $('#opp').innerHTML = `${img('earth', 3, 1, 128)}<div style="display:flex;flex-direction:column;gap:2px;min-width:0">
    <span class="label">Opponent · level ${m.lv + 1}</span>
    <span class="name display">${opp.name} ${opp.title}</span>
    <span class="meta">Hand ${op.hand.length} · Bag ${op.draw.length} · ${lead === 0 ? 'level' : lead > 0 ? `you lead by ${Math.abs(lead)}` : `leads by ${Math.abs(lead)}`}</span>
    <span class="opphand" aria-label="Their hand">${op.hand.map(s => img(s.el, s.tier, 1, 64)).join('')}</span>
    ${run.lives <= 1 && !m.over ? '<span class="warn">Lose this match and the run is over.</span>' : ''}</div>`;
  const caps = [m.s.captures[0] - ui.shattered[0], m.s.captures[1] - ui.shattered[1]];
  $('#score-in').innerHTML = `<h2>${m.over ? 'Final score' : 'Score right now'}</h2><div class="scoregrid">
    <span></span><span class="h">You</span><span class="h them">${opp.name}</span>
    <span>Stones</span><span class="v">${sc.st[0]}</span><span class="v">${sc.st[1]}</span>
    <span>Territory</span><span class="v">${sc.ter[0]}</span><span class="v">${sc.ter[1]}</span>
    <span>Komi</span><span class="v">0</span><span class="v">${KOMI}</span>
    <span class="tot">Total</span><span class="badge me">${sc.total[0]}</span><span class="badge them">${sc.total[1]}</span>
    <span class="hot">Shattered</span><span class="v hot">${ui.shattered[0]}</span><span class="v hot">${ui.shattered[1]}</span>
    <span class="quiet">Captured</span><span class="v quiet">${caps[0]}</span><span class="v quiet">${caps[1]}</span>
    <span class="quiet">Turns</span><span class="v quiet">${m.turn[0]}/${MAX_TURNS}</span><span class="v quiet">${m.turn[1]}/${MAX_TURNS}</span>
    <span class="quiet">In the bag</span><span class="v quiet">${m.piles[0].draw.length}</span><span class="v quiet">${op.draw.length}</span></div>`;
  $('#log').innerHTML = m.log.map(l => `<li class="${l.side < 0 ? 'sys' : 's' + l.side}"><span>${l.text.replace(/shattered ([^,.]+)/, 'shattered <b>$1</b>')}</span></li>`).join('');
  $('#bagcount').textContent = m.piles[0].draw.length;
  const armed = ui.passArm && Date.now() - ui.passArm < 4000;
  $('#passrow').innerHTML = m.over ? '' : `<button class="btn ${armed ? 'bone' : 'blood'}" data-act="pass" ${canAct() ? '' : 'disabled'}>${armed ? 'Confirm pass' : `Pass · ${lead === 0 ? 'level' : lead > 0 ? 'you lead' : opp.name + ' leads'}`}</button>`;
  $('#hand').innerHTML = m.over ? '' : m.piles[0].hand.map((st, i) => `<button class="hbtn ${ui.sel === i ? 'on' : ''}" data-act="hand" data-i="${i}" aria-pressed="${ui.sel === i}" aria-label="Stone ${i + 1}, ${stoneName(st)}"><span class="k">${i + 1}</span><span class="n ${elClass(st)}">${stoneName(st)}</span></button>`).join('');
  scene.setHandLabels([...document.querySelectorAll('#hand .hbtn')]);
  setStatus(defaultStatus());
}

const canAct = () => m && !m.over && m.toMove === 0;
function setStatus(html) { $('#status').innerHTML = html; }
function defaultStatus() {
  if (!m) return '';
  if (m.over) return 'The match is over. The squares on the board show the territory each side surrounds.';
  if (m.toMove === 1) return `<span class="think">${OPPONENTS[m.lv].name} is choosing a stone…</span>`;
  const st = m.piles[0].hand[ui.sel];
  if (!st) return 'Pick a stone from your hand.';
  return `<b class="${elClass(st)}">${stoneName(st)}.</b> ${effectText(st)} ${clashText(st)}`;
}
function statusFor(p) {
  const c = m.s.board[p];
  if (c) {
    const { groups, gid } = computeGroups(m.s, c.owner), g = groups[gid[p]];
    let t = `${c.owner === 0 ? 'Your' : OPPONENTS[m.lv].name + '’s'} <b class="el-${c.el}">${stoneName(c)}</b> at ${coord(p)}. Its group: ${g.stones.length} stone${g.stones.length === 1 ? '' : 's'}, ${g.libs} libert${g.libs === 1 ? 'y' : 'ies'}.`;
    if (c.el === 'earth') t += ` Armor ${c.hp} of ${c.tier}.`;
    return t;
  }
  const sc = m.s.scorch[p];
  if (sc) return `${coord(p)} is scorched by ${sc.owner === 0 ? 'you' : OPPONENTS[m.lv].name} for ${sc.left} more turn${sc.left === 1 ? '' : 's'}.`;
  return coord(p);
}
function preview() {
  const p = ui.hover;
  scene.showCursor(ui.kbd && p >= 0 ? p : -1);
  if (p < 0 || !m) { scene.clearPreview(); setStatus(defaultStatus()); return; }
  if (m.s.board[p] || m.over || m.toMove !== 0 || ui.sel < 0) { scene.clearPreview(); setStatus(m.s.board[p] || (m.s.scorch[p] && !m.over) ? statusFor(p) : defaultStatus()); return; }
  const st = m.piles[0].hand[ui.sel], r = applyMove(m.s, 0, st, p, koSig(m));
  if (!r.ok) { scene.showPreview(p, st, r, null); setStatus(`<span class="why">${r.why}</span>`); return; }
  const fx = diffFx(m.s, r.s, p); fx.before = m.s;
  scene.showPreview(p, st, r, fx);
  const parts = S.evText(m, r.ev, 0);
  setStatus(`<b class="${elClass(st)}">${stoneName(st)}</b> at ${coord(p)}${parts || ': no special effect here'}.`);
}
function setHover(p) { ui.hover = p; preview(); }
function tryPlace(p) {
  if (!canAct()) return;
  if (ui.sel < 0) { setStatus('Pick a stone from your hand first.'); return; }
  const r = playerMove(ui.sel, p);
  if (!r.ok) setStatus(`<span class="why">${r.why}</span>`);
}

/* ============================== result, screens ============================== */
function renderResult() {
  const r = m.result, opp = OPPONENTS[m.lv];
  let next, label;
  if (r.won && m.lv === 2) { next = 'to-end'; label = 'Finish the run'; }
  else if (!r.won && run.lives <= 0) { next = 'to-end'; label = 'See how the run ended'; }
  else { next = 'to-shop'; label = 'Visit the Stonecutter'; }
  const head = r.won ? `You beat ${opp.name} by ${r.margin}` : `${opp.name} wins by ${r.margin}`;
  const sub = r.won ? (m.lv === 2 ? 'That was the last opponent.' : `Next up: ${OPPONENTS[m.lv + 1].name} ${OPPONENTS[m.lv + 1].title}.`) : (run.lives > 0 ? `You lose a life. ${run.lives} left, and you get a rematch.` : 'That was your last life.');
  const el = $('#result'); el.hidden = false;
  el.innerHTML = `<h2>${head}</h2><p>${sub}</p><p class="gold">+${r.gold} gold <span class="meta">(${r.won ? `12 for the win, ${Math.min(12, Math.floor(r.margin))} for the margin` : '6 for playing'}, ${r.capGold} for ${r.caps} captures)</span></p>
    <div class="row"><button class="btn blood" data-act="${next}">${label}</button><button class="btn small" data-act="log">Save move log</button><span class="meta lognote" aria-live="polite"></span></div>`;
}

function showScreen() {
  $('#hud').hidden = screen !== 'match';
  $('#result').hidden = true;
  const sc = $('#screen');
  if (screen === 'match') { sc.hidden = true; return; }
  sc.hidden = false;
  if (screen === 'title') renderTitle();
  else if (screen === 'shop') renderShop();
  else if (screen === 'end') renderEnd();
}
function renderTitle() {
  const rec = loadRecord();
  const recText = rec.best || rec.runsWon ? `Your best: ${rec.best} of 3 opponents beaten${rec.runsWon ? `, ${rec.runsWon} completed run${rec.runsWon === 1 ? '' : 's'}` : ''}.` : 'Three opponents. Two lives. One bag of stones.';
  $('#screen').innerHTML = `<div class="sheet deep panel" style="transform:rotate(-.5deg)">
    <h1>Stones of the Four</h1>
    <p class="lede">Draw stones from your bag and play them on a 9×9 board. Up to half of them are element stones: Fire, Water, Earth and Air each bend the rules of Go in their own way, in three tiers. The rest are plain Go stones. Beat three opponents in a row, and spend your winnings at the Stonecutter between matches.</p>
    <div class="row"><button class="btn blood" data-act="begin">Begin a run</button><button class="btn" data-act="rules">How to play</button></div>
    <p class="record">${recText}</p>
    <div class="ladder">${OPPONENTS.map((o, i) => { const bag = bagFrom(o.mix); return `<article class="rung"><span class="label">Level ${i + 1}</span><h3>${o.name} ${o.title}</h3><p>${o.blurb}</p><div class="row" style="gap:2px">${[['fire', 1], ['water', 1], ['earth', 1], ['air', 1]].map(([e]) => img(e, i + 1, 1, 64)).join('')}${img(PLAIN, 0, 1, 64)}</div></article>`; }).join('')}</div>
  </div>`;
}
function mixCounts(bag) { const c = { plain: 0 }; EL_ORDER.forEach(el => c[el] = [0, 0, 0, 0]); bag.forEach(s => { if (isPlain(s)) c.plain++; else c[s.el][s.tier]++; }); return c; }
function mixTable(you, them, name) {
  const a = mixCounts(you), b = mixCounts(them);
  const cell = (n, sep) => `<td class="num${n ? '' : ' z'}${sep ? ' sep' : ''}">${n || '·'}</td>`;
  return `<table class="mix"><thead><tr><th></th><th colspan="3">You</th><th colspan="3" class="sep">${name}</th></tr>
    <tr><th></th>${['I', 'II', 'III'].map(t => `<th>${t}</th>`).join('')}${['I', 'II', 'III'].map((t, i) => `<th${i ? '' : ' class="sep"'}>${t}</th>`).join('')}</tr></thead>
    <tbody>${EL_ORDER.map(el => `<tr><td><span class="elcell el-${el}">${ELEM[el].name}</span></td>${[1, 2, 3].map(t => cell(a[el][t])).join('')}${[1, 2, 3].map(t => cell(b[el][t], t === 1)).join('')}</tr>`).join('')}
    <tr><td>Plain</td><td colspan="3" class="num">${a.plain}</td><td colspan="3" class="num sep">${b.plain}</td></tr>
    <tr><td><b>Total</b></td><td colspan="3" class="num"><b>${you.length}</b></td><td colspan="3" class="num sep"><b>${them.length}</b></td></tr></tbody></table>`;
}
function benchHTML() {
  const st = run.bag.find(s => s.uid === ui.shopSel);
  const flash = `<p class="flash" aria-live="polite">${ui.flash}</p>`;
  if (!st) return `<p class="meta">Select a stone in your bag to work on it. You can infuse a plain stone with an element, upgrade or transmute an element stone, or remove any stone.</p>${flash}`;
  const rmBtn = `<button class="btn small" data-act="rm" ${run.gold >= PRICE.rm && S.canRemove(run, st) ? '' : 'disabled'}>Remove · ${PRICE.rm} gold</button>`;
  let rmNote = '';
  if (run.bag.length <= MIN_BAG) rmNote = `<p class="meta">Your bag is at the minimum of ${MIN_BAG} stones.</p>`;
  else if (!S.canRemove(run, st)) rmNote = `<p class="meta">Removing this plain stone would make element stones more than half your bag.</p>`;
  if (isPlain(st)) {
    const room = S.roomToInfuse(run);
    return `<div class="bench-top">${img(PLAIN, 0, 0, 104)}<div><h3>Plain stone</h3><p class="meta">${PLAIN_TEXT} It can’t be shattered, but Water can push it.</p></div></div>
    <div class="acts"><span class="meta">Infuse into tier I (${PRICE.infuse} gold):</span>${EL_ORDER.map(e => `<button class="btn small" data-act="infuse" data-el="${e}" ${room && run.gold >= PRICE.infuse ? '' : 'disabled'}>${ELEM[e].name}</button>`).join('')}</div>
    ${room ? '' : '<p class="meta">Half your bag is already element stones. Add plain stones to make room.</p>'}
    <div class="acts">${rmBtn}</div>${rmNote}${flash}`;
  }
  const up = st.tier < 3 ? PRICE.up[st.tier] : 0;
  return `<div class="bench-top">${img(st.el, st.tier, 0, 104)}<div><h3 class="${elClass(st)}">${stoneName(st)}</h3><p class="meta">${EFFECT[st.el][st.tier]}</p></div></div>
    ${st.tier < 3 ? `<p class="meta"><b>At tier ${ROMAN[st.tier + 1]}:</b> ${EFFECT[st.el][st.tier + 1]}</p>` : ''}
    <div class="acts">${st.tier < 3 ? `<button class="btn blood small" data-act="up" ${run.gold >= up ? '' : 'disabled'}>Upgrade to ${ROMAN[st.tier + 1]} · ${up} gold</button>` : '<span class="meta">Already at the top tier.</span>'}${rmBtn}</div>
    <div class="acts"><span class="meta">Transmute (${PRICE.tx} gold):</span>${EL_ORDER.filter(e => e !== st.el).map(e => `<button class="btn small" data-act="tx" data-el="${e}" ${run.gold >= PRICE.tx ? '' : 'disabled'}>${ELEM[e].name}</button>`).join('')}</div>
    ${rmNote}${flash}`;
}
function renderShop() {
  const opp = OPPONENTS[run.level], bag = sortBag(run.bag);
  const rows = SORT_ORDER.map(el => { const list = bag.filter(s => s.el === el); return `<div class="bagrow"><span class="rowlbl el-${el}">${el === PLAIN ? 'Plain' : ELEM[el].name}</span>${list.length ? list.map(s => `<button class="chip ${ui.shopSel === s.uid ? 'on' : ''}" data-act="sel" data-uid="${s.uid}" aria-pressed="${ui.shopSel === s.uid}" aria-label="${stoneName(s)}">${img(s.el, s.tier, 0, 80)}</button>`).join('') : '<span class="meta">none</span>'}</div>`; }).join('');
  const offers = run.market.map((o, i) => o ? `<div class="offer"><div class="top">${img(o.el, o.tier, 0, 80)}<span class="${elClass(o)}">${stoneName(o)}</span></div><p>${EFFECT[o.el][o.tier]}</p>
      <button class="btn small" data-act="buy" data-i="${i}" ${run.gold >= PRICE.buy[o.tier] && S.roomToAdd(run) ? '' : 'disabled'}>Buy · ${PRICE.buy[o.tier]} gold</button></div>` : '<div class="offer empty">Sold</div>').join('');
  $('#screen').innerHTML = `<div class="sheet deep panel" style="max-width:980px;transform:rotate(.3deg)">
    <nav class="path" aria-label="Run progress">${OPPONENTS.map((o, i) => `<span class="node ${run.cleared[i] ? 'done' : i === run.level ? 'next' : ''}"><span class="dot ${run.cleared[i] ? 'done' : i === run.level ? 'now' : ''}" style="width:12px;height:12px"></span><span><span class="label" style="display:block;font-size:10px">Level ${i + 1}${run.cleared[i] ? ' · beaten' : i === run.level ? ' · next' : ''}</span><b class="display">${o.name}</b></span></span>`).join('')}</nav>
    <div class="pane-h"><h1 style="font-size:34px">The Stonecutter</h1><p class="meta" style="font-size:15px">You have <b class="num" style="color:var(--fire-hi);font-size:18px">${run.gold}</b> gold to spend before the next match.</p></div>
    <div class="shop-grid">
      <section class="pane">
        <div class="pane-h"><h2>Your bag</h2><span class="meta">${run.bag.length} stones · ${elementCount(run.bag)} of ${elementCap(run.bag.length)} element slots used</span></div>
        <div style="display:grid;gap:8px">${rows}</div>
        <div class="acts"><button class="btn small" data-act="plain" ${run.gold >= PRICE.plain ? '' : 'disabled'}>Add a plain stone · ${PRICE.plain} gold</button><span class="meta">At most half your bag can be element stones. Every 2 plain stones you add make room for 1 more.</span></div>
        <div class="bench">${benchHTML()}</div>
      </section>
      <div style="display:grid;gap:18px">
        <section class="pane"><div class="pane-h"><h2>Next: ${opp.name} ${opp.title}</h2></div><p class="meta">${opp.blurb}</p>${mixTable(run.bag, bagFrom(opp.mix), opp.name)}<div><button class="btn blood" data-act="go">Play ${opp.name}</button></div></section>
        <section class="pane"><div class="pane-h"><h2>Market</h2><button class="btn small" data-act="reroll" ${run.gold >= PRICE.reroll ? '' : 'disabled'}>New offers · ${PRICE.reroll} gold</button></div>
          ${S.roomToAdd(run) ? '' : '<p class="meta">Your bag is at its element limit. Add plain stones or infuse a plain stone instead.</p>'}<div class="offers">${offers}</div></section>
      </div>
    </div></div>`;
}
function renderEnd() {
  const won = run.cleared[2], cleared = run.cleared.filter(Boolean).length;
  $('#screen').innerHTML = `<div class="sheet deep panel" style="transform:rotate(-.4deg)">
    <span class="label">${won ? 'Run complete' : 'Run over'}</span>
    <h1>${won ? 'Ozu the Master yields.' : `Your run ends at level ${cleared + 1}.`}</h1>
    <p class="lede">${won ? 'You beat all three opponents. The bag you built is below.' : `You beat ${cleared} of 3 opponents before running out of lives.`}</p>
    <div class="stats"><div class="stat"><small>Matches won</small><b>${run.wins}</b></div><div class="stat"><small>Matches lost</small><b>${run.losses}</b></div><div class="stat"><small>Captures</small><b>${run.captures}</b></div><div class="stat"><small>Gold earned</small><b>${run.goldTotal}</b></div></div>
    <div class="pane"><div class="pane-h"><h2>Final bag</h2><span class="meta">${run.bag.length} stones</span></div><div class="bagrow">${sortBag(run.bag).map(s => img(s.el, s.tier, 0, 68)).join('')}</div></div>
    <div class="row"><button class="btn blood" data-act="begin">Start a new run</button><button class="btn" data-act="title">Back to title</button></div></div>`;
}
function codexHTML() {
  const rows = EL_ORDER.map(el => `<tr><td class="elname"><span class="elcell">${img(el, 2, 0, 56)}<span class="el-${el}">${ELEM[el].name}</span></span><div class="meta">Beats ${ELEM[ELEM[el].beats].name}</div></td>${[1, 2, 3].map(t => `<td>${EFFECT[el][t]}</td>`).join('')}</tr>`).join('');
  return `<div class="codex">
    <div><h3>A match</h3><ul>
      <li>On your turn, pick one of the three stones in your hand and place it on an empty point. You then draw back up to three. When your bag runs out, your used stones are shuffled back in.</li>
      <li>At most half of every bag can be element stones. The rest are plain stones: ordinary Go stones with no element. Plain stones can’t be shattered, but Water can push them.</li>
      <li>Stones that touch along the lines form a group. A group with no empty neighboring points (liberties) left is captured.</li>
      <li>You can’t play a stone that would have no liberties, and you can’t retake a ko straight away.</li>
      <li>Each side gets ${MAX_TURNS} turns. The match also ends when both players pass in a row.</li>
      <li>Area scoring: your stones on the board plus the empty points only you surround. Your opponent plays second and gets ${KOMI} komi.</li></ul></div>
    <div><h3>Clash</h3><div class="cycle">${['fire', 'air', 'earth', 'water'].map(el => `<div>${img(el, 2, 0, 96)}<span class="el-${el} display">${ELEM[el].name}</span><span class="meta">beats ${ELEM[ELEM[el].beats].name}</span></div>`).join('')}</div>
      <p style="max-width:72ch;margin-top:8px">When you place a stone next to an enemy stone of the element it beats, and the enemy stone has a lower tier, that enemy stone shatters. One shatter per placement, and it counts as a capture. Tier I stones never shatter anything, and a stone is safe from anything of its own tier or lower. The dots in front of each emblem show the tier; tier III stones also carry a ring.</p></div>
    <div><h3>Elements by tier</h3><div class="tablewrap"><table class="tiers"><thead><tr><th>Element</th><th>Tier I</th><th>Tier II</th><th>Tier III</th></tr></thead><tbody>${rows}</tbody></table></div>
      <p class="meta" style="margin-top:6px">Scorched points block the enemy and don’t count as their liberties. Pushed stones only slide into empty points. Earth armor comes back once the group has a liberty again. Air links count as real connections, so linked stones share liberties.</p></div>
    <div><h3>The run</h3><ul>
      <li>Beat three opponents in order. They all think the same way. The difference is the bag they bring.</li>
      <li>You have ${LIVES} lives. Losing a match costs one, and you rematch the same opponent after visiting the Stonecutter.</li>
      <li>A win pays 12 gold, plus your winning margin (up to 12), plus 1 for every 2 stones you captured. A loss pays 6 plus the same capture bonus.</li>
      <li>At the Stonecutter: upgrade an element stone (I→II ${PRICE.up[1]} gold, II→III ${PRICE.up[2]}), transmute its element (${PRICE.tx}), infuse a plain stone with an element (${PRICE.infuse}), add a plain stone (${PRICE.plain}), remove any stone (${PRICE.rm}), or buy element stones (${PRICE.buy[1]} / ${PRICE.buy[2]} / ${PRICE.buy[3]} by tier). Element stones can never be more than half your bag, and your bag can’t drop below ${MIN_BAG} stones.</li></ul></div>
    <div><h3>Controls</h3><ul><li>Hover a point to see exactly what your move does, click to place. On touch screens, tap once to preview and again to place.</li><li>Keys 1, 2 and 3 pick a stone from your hand. With the board focused, the arrow keys move the cursor and Enter places.</li><li>Pass needs a second click to confirm.</li></ul></div>
  </div>`;
}
function openCodex() { $('#codex-body').innerHTML = codexHTML(); $('#codex').hidden = false; $('#codex-close').focus(); }
function closeCodex() { $('#codex').hidden = true; }

/* ============================== input ============================== */
function bindInput() {
  const stage = $('#stage');
  stage.addEventListener('pointerdown', e => { ui.lastPointer = e.pointerType || 'mouse'; });
  stage.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse' || screen !== 'match') return;
    const hit = scene.pick(e.clientX, e.clientY);
    stage.style.cursor = hit ? 'pointer' : '';
    const p = hit && hit.type === 'point' ? hit.p : -1;
    if (p !== ui.hover) { ui.kbd = false; setHover(p); }
  });
  stage.addEventListener('pointerleave', () => { if (ui.hover >= 0) setHover(-1); });
  stage.addEventListener('click', e => {
    if (screen !== 'match' || !m) return;
    const hit = scene.pick(e.clientX, e.clientY); if (!hit) return;
    ui.kbd = false;
    if (hit.type === 'hand') { if (canAct()) { ui.sel = hit.i; scene.setHandSel(ui.sel); renderHud(); preview(); } return; }
    const p = hit.p;
    if (ui.lastPointer === 'mouse' || ui.hover === p) tryPlace(p);
    else { setHover(p); if (canAct() && ui.sel >= 0 && !m.s.board[p]) setStatus(statusFor(p) + ' <b>Tap again to place.</b>'); }
  });
  stage.addEventListener('keydown', e => {
    if (screen !== 'match' || !m) return;
    const k = e.key; let c = ui.cursor;
    if (k === 'ArrowLeft') c = X(c) > 0 ? c - 1 : c;
    else if (k === 'ArrowRight') c = X(c) < N - 1 ? c + 1 : c;
    else if (k === 'ArrowUp') c = Y(c) > 0 ? c - N : c;
    else if (k === 'ArrowDown') c = Y(c) < N - 1 ? c + N : c;
    else if (k === 'Enter' || k === ' ') { e.preventDefault(); tryPlace(ui.cursor); return; }
    else return;
    e.preventDefault(); ui.cursor = c; ui.kbd = true; setHover(c);
  });
  stage.addEventListener('focus', () => stage.classList.add('focus-ring'));
  stage.addEventListener('blur', () => stage.classList.remove('focus-ring'));
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-act]'); if (!el) return;
    const act = el.dataset.act;
    if (act === 'rules') return openCodex();
    if (act === 'close-codex') return closeCodex();
    if (act === 'begin') { closeCodex(); return newRun(); }
    if (act === 'title') { clearTimeout(ui.aiTimer); screen = 'title'; m = null; if (run && (run.lives <= 0 || run.cleared[2])) run = null; return showScreen(); }
    if (act === 'hand') { if (!canAct()) return; ui.sel = +el.dataset.i; scene.setHandSel(ui.sel); renderHud(); preview(); return; }
    if (act === 'pass') {
      if (!canAct()) return;
      if (ui.passArm && Date.now() - ui.passArm < 4000) return playerPass();
      ui.passArm = Date.now(); renderHud(); setStatus('Passing ends the match if your opponent also passes. Press <b>Confirm pass</b> to pass.');
      setTimeout(() => { if (ui.passArm && Date.now() - ui.passArm >= 4000) { ui.passArm = 0; if (canAct()) renderHud(); } }, 4100);
      return;
    }
    if (act === 'log') return downloadLog();
    if (act === 'to-shop' || act === 'to-end') return afterMatch();
    if (act === 'sel') { ui.shopSel = +el.dataset.uid; ui.flash = ''; return renderShop(); }
    if (act === 'go') { ui.flash = ''; return startMatch(run.level); }
    if (['up', 'tx', 'infuse', 'rm', 'plain', 'buy', 'reroll'].includes(act)) return shopAct(act, el);
  });
  $('#codex').addEventListener('click', e => { if (e.target.id === 'codex') closeCodex(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !$('#codex').hidden) { closeCodex(); return; }
    if (screen !== 'match' || !m || m.over || !$('#codex').hidden) return;
    if (e.target.closest && e.target.closest('input,textarea')) return;
    if (['1', '2', '3'].includes(e.key)) { const i = +e.key - 1; if (i < m.piles[0].hand.length && canAct()) { ui.sel = i; scene.setHandSel(ui.sel); renderHud(); preview(); } }
  });
}

/* ============================== boot ============================== */
(async function boot() {
  try {
    scene = await createScene($('#stage'));
  } catch (err) {
    $('#loading').textContent = 'The diorama could not be built: ' + err;
    throw err;
  }
  bindInput();
  showScreen();
  $('#loading').classList.add('off');
  window.__sotf = { get run() { return run; }, get m() { return m; }, get ui() { return ui; }, scene, startMatch, newRun, tryPlace, setHover, playerPass, S };
  window.__ready = true;
})();
