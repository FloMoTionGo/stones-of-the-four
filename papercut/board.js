// The oblique cut-paper board and everything that lives on it, in 2D SVG. The illusion of depth comes from a grid that
// recedes (rows shrink and tighten toward the far side), paper thickness under every sheet and stone, hard offset
// shadows from one light (the moon, upper right), emblems that stand upright on their discs, and parallax scenery.
import { stoneSVG, flameSVG, shardsSVG, variantOf, discPath, EL_MAIN } from './stones.js';

const S = window.SOTF;
const { N, NN, X, Y, DIAG, JUMP, KNIGHT, COLS } = S;

export const VB = { w: 440, h: 404 };
const CX = 220, Y0 = 66, DY = 36, CELL = 42;
export const K = 0.78;                                    // how flat a disc looks on the tilted board
const sc = v => 0.82 + 0.18 * v / 8;                      // depth scale by row, row 0 is far
const PY = v => Y0 + DY * (0.82 * v + 0.18 * v * v / 16);
const PX = (u, v) => CX + (u - 4) * CELL * sc(v);
export const P = p => ({ x: PX(X(p), Y(p)), y: PY(Y(p)), s: sc(Y(p)) });
const pt = (u, v) => `${PX(u, v).toFixed(1)},${PY(v).toFixed(1)}`;
const quad = (u0, v0, u1, v1) => `${pt(u0, v0)} ${pt(u1, v0)} ${pt(u1, v1)} ${pt(u0, v1)}`;
const f1 = n => n.toFixed(1);

// Sheets with rounded corners: a polygon stroked in its own colour with round joins.
const sheet = (pts, fill, w, extra = '') => `<polygon points="${pts}" fill="${fill}" stroke="${fill}" stroke-width="${w}" stroke-linejoin="round" ${extra}/>`;

export function staticSVG() {
  const sheetPts = quad(-1.45, -1.4, 9.45, 9.4), boardPts = quad(-0.92, -0.88, 8.92, 8.88);
  let s = `<defs>
    <radialGradient id="ember"><stop offset="0" stop-color="#ff5a36" stop-opacity=".55"/><stop offset=".6" stop-color="#ff5a36" stop-opacity=".22"/><stop offset="1" stop-color="#ff5a36" stop-opacity="0"/></radialGradient>
    <marker id="arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#4a9ee6"/></marker>
    <filter id="fibre" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".02 .7" numOctaves="2" seed="7"/><feColorMatrix type="saturate" values="0"/></filter>
    <clipPath id="boardclip"><polygon points="${boardPts}"/></clipPath>
  </defs>`;
  // backing card, lower right, then the sheet, then the board paper with its cut edge
  s += `<g transform="translate(12,13)">${sheet(sheetPts, '#000', 24, 'transform="translate(0,5)"')}${sheet(sheetPts, '#262b3a', 24)}</g>`;
  s += sheet(sheetPts, '#000', 24, 'transform="translate(-5,9)" opacity=".85"');
  s += sheet(sheetPts, '#1a1e27', 24);
  s += `<g transform="translate(0,6)">${sheet(boardPts, '#1b1e27', 12)}</g>`;
  s += sheet(boardPts, '#2a2d38', 12);
  s += `<polygon points="${boardPts}" filter="url(#fibre)" opacity=".07" style="mix-blend-mode:screen"/>`;
  s += '<g stroke="#5a5f70" stroke-linecap="round">';
  for (let i = 0; i < N; i++) {
    s += `<line x1="${f1(PX(0, i))}" y1="${f1(PY(i))}" x2="${f1(PX(8, i))}" y2="${f1(PY(i))}" stroke-width="${f1(1.3 + 0.8 * sc(i))}"/>`;
    s += `<line x1="${f1(PX(i, 0))}" y1="${f1(PY(0))}" x2="${f1(PX(i, 8))}" y2="${f1(PY(8))}" stroke-width="1.8"/>`;
  }
  s += '</g>';
  for (const [u, v] of [[2, 2], [6, 2], [4, 4], [2, 6], [6, 6]]) s += `<ellipse cx="${f1(PX(u, v))}" cy="${f1(PY(v))}" rx="${f1(3.6 * sc(v))}" ry="${f1(3.6 * sc(v) * K)}" fill="#5a5f70"/>`;
  s += '<g font-family="Cabin, sans-serif" font-weight="700" fill="#9aa0b4" text-anchor="middle">';
  for (let i = 0; i < N; i++) {
    s += `<text x="${f1(PX(i, 8.75))}" y="${f1(PY(8.75) + 4)}" font-size="11">${COLS[i]}</text>`;
    s += `<text x="${f1(PX(-0.72, i))}" y="${f1(PY(i) + 3.5)}" font-size="${f1(8 + 3 * sc(i))}">${N - i}</text>`;
  }
  s += '</g>';
  s += '<g id="L-terr"></g><g id="L-scorch"></g><g id="L-links"></g><g id="L-stones"></g><g id="L-fx"></g><g id="L-over"></g><g id="L-hit">';
  for (let p = 0; p < NN; p++) { const q = P(p); s += `<ellipse data-p="${p}" cx="${f1(q.x)}" cy="${f1(q.y)}" rx="${f1(21 * q.s)}" ry="${f1(21 * q.s * K)}" fill="transparent"/>`; }
  s += '</g>';
  return s;
}

const at = (p, inner, extra = '') => { const q = P(p); return `<g transform="translate(${f1(q.x)},${f1(q.y)}) scale(${f1(q.s)})" ${extra}>${inner}</g>`; };
const crack = `<path d="M-11,-12 L-4,-5 L-8,1 L-1,7 L-3,13" fill="none" stroke="#ff5a36" stroke-width="1.6" stroke-linecap="round" transform="scale(1,${K})"/>`;

export function createBoard(svg) {
  svg.innerHTML = staticSVG();
  const L = id => svg.querySelector('#' + id);

  function airLinks(s) {
    const out = [], b = s.board, airT = c => c && c.el === 'air' ? c.tier : 0;
    for (let i = 0; i < NN; i++) { const c = b[i]; if (!c) continue;
      for (const [list, need] of [[DIAG, 1], [JUMP, 2], [KNIGHT, 3]]) for (const j of list[i]) if (j > i && b[j] && b[j].owner === c.owner && Math.max(airT(c), airT(b[j])) >= need) out.push([i, j, c.owner]);
    }
    return out;
  }

  // The whole position: stones (with drop, slide and shatter animations from fx), scorch marks, links, danger rings, territory.
  function syncBoard(m, fx) {
    const s = m.s; fx = fx || { removed: [], moved: [], placed: null };
    const movedTo = new Map(fx.moved.map(mv => [mv.to, mv.from]));
    const danger = new Map();
    for (const side of [0, 1]) for (const g of S.computeGroups(s, side).groups) if (g.libs <= 1) for (const j of g.stones) danger.set(j, g.libs);
    let h = '';
    for (let p = 0; p < NN; p++) {
      const c = s.board[p]; if (!c) continue;
      const v = variantOf(c);
      let extra = c.el === 'earth' && c.hp < c.tier ? crack : '';
      if (danger.get(p) === 0) extra += `<path d="${discPath(v, 22)}" transform="scale(1,${K})" fill="none" stroke="#ff5a36" stroke-width="2.5" class="peril"/>`;
      else if (danger.get(p) === 1) extra += `<path d="${discPath(v, 21.5)}" transform="scale(1,${K})" fill="none" stroke="#ff5a36" stroke-width="1.4" stroke-dasharray="4 3" opacity=".85"/>`;
      if (m.last && m.last.p === p) extra += '<circle cx="15" cy="-13" r="4.5" fill="#d8352a"/>';
      let inner = stoneSVG({ el: c.el, tier: c.tier, owner: c.owner, variant: v, squash: K, extra });
      let cls = '';
      if (fx.placed === c.id) cls = 'drop';
      let style = '';
      if (movedTo.has(p)) { const a = P(movedTo.get(p)), b = P(p); cls = 'slide'; style = `style="--dx:${f1(a.x - b.x)}px;--dy:${f1(a.y - b.y)}px"`; }
      h += at(p, cls ? `<g class="${cls}" ${style}>${inner}</g>` : inner);
    }
    L('L-stones').innerHTML = h;
    // shattered or captured stones: the stone shrinks away and throws paper shards
    let fxh = '';
    for (const rm of fx.removed) fxh += at(rm.i, `<g class="vanish">${stoneSVG({ el: rm.c.el, tier: rm.c.tier, owner: rm.c.owner, variant: variantOf(rm.c), squash: K })}</g><g class="shards">${shardsSVG(rm.c.el, rm.c.owner)}</g>`);
    if (fxh) { L('L-fx').insertAdjacentHTML('beforeend', `<g>${fxh}</g>`); const batch = L('L-fx').lastElementChild; setTimeout(() => batch.remove(), 1200); }
    // scorch marks: ember glow, a flickering flame, rising sparks, the turns left
    let sh = '';
    for (let p = 0; p < NN; p++) {
      const scz = s.scorch[p]; if (!scz) continue;
      sh += at(p, `<ellipse class="gl" rx="15" ry="${f1(15 * K)}" fill="url(#ember)" style="animation-delay:${(p % 5) * 160}ms"/>` +
        `<ellipse rx="13" ry="${f1(13 * K)}" fill="none" stroke="${scz.owner === 0 ? '#3a3f4d' : '#e9e2d2'}" stroke-width="1.2" stroke-dasharray="3 3"/>` +
        `<g transform="translate(0,5)">${flameSVG(0.36, 'fl')}</g>` +
        [0, 1, 2].map(i => `<circle class="emb" cx="${(i - 1) * 5}" cy="-4" r="1.4" fill="#ffb36b" style="--dx:${(i - 1) * 6}px;animation-delay:${i * 420 + (p % 3) * 200}ms"/>`).join('') +
        `<text x="11" y="-9" font-size="9" font-family="Nunito, sans-serif" font-weight="900" font-style="italic" fill="#e9e2d2">${scz.left}</text>`);
    }
    L('L-scorch').innerHTML = sh;
    // air links as dotted paper threads between the stones they join
    let lk = '';
    for (const [a, b, owner] of airLinks(s)) {
      const A = P(a), B = P(b), n = Math.max(3, Math.round(Math.hypot(B.x - A.x, B.y - A.y) / 7));
      lk += `<line x1="${f1(A.x)}" y1="${f1(A.y)}" x2="${f1(B.x)}" y2="${f1(B.y)}" stroke="#07080c" stroke-width="6" stroke-linecap="round" opacity=".8"/>`;
      for (let k = 1; k < n; k++) lk += `<circle cx="${f1(A.x + (B.x - A.x) * k / n)}" cy="${f1(A.y + (B.y - A.y) * k / n)}" r="1.5" fill="${owner ? '#6f7f96' : '#b9c8dd'}"/>`;
    }
    L('L-links').innerHTML = lk;
    // territory, once the match is over
    let th = '';
    if (m.over && m.result) for (let p = 0; p < NN; p++) if (m.result.sc.own[p] >= 0 && !s.board[p]) th += at(p, `<rect x="-6" y="-5" width="12" height="10" rx="2" fill="${m.result.sc.own[p] === 0 ? '#15171d' : '#e9e2d2'}" stroke="${m.result.sc.own[p] === 0 ? '#3a3f4d' : '#9c927d'}" opacity=".9"/>`);
    L('L-terr').innerHTML = th;
  }

  // Hover preview: the ghost stone, every push as an arrow to a ghost at the destination, every loss as a red mark,
  // new scorch marks as ember discs. r is the engine's applyMove result; fx its diff against the current position.
  function showPreview(p, st, r, fx, kbd) {
    let h = '';
    if (p >= 0 && kbd) h += at(p, `<rect x="-21" y="${f1(-21 * K)}" width="42" height="${f1(42 * K)}" rx="6" fill="none" stroke="#e9e2d2" stroke-width="2"/>`);
    if (p < 0 || !r) { L('L-over').innerHTML = h; return; }
    if (!r.ok) { L('L-over').innerHTML = h + at(p, '<path d="M-7,-7 L7,7 M7,-7 L-7,7" stroke="#ff5a36" stroke-width="3" stroke-linecap="round"/>'); return; }
    for (let q = 0; q < NN; q++) { const a = r.s.scorch[q], b = fx.before.scorch[q]; if (a && a.owner === 0 && (!b || b.owner !== 0 || b.left < a.left)) h += at(q, `<ellipse rx="13" ry="${f1(13 * K)}" fill="url(#ember)"/><ellipse rx="13" ry="${f1(13 * K)}" fill="none" stroke="#e8343c" stroke-dasharray="3 3"/>`); }
    for (const mv of fx.moved) {
      const c = r.s.board[mv.to], A = P(mv.from), B = P(mv.to);
      h += `<line x1="${f1(A.x)}" y1="${f1(A.y)}" x2="${f1(B.x)}" y2="${f1(B.y)}" stroke="#4a9ee6" stroke-width="3" marker-end="url(#arrow)"/>`;
      h += at(mv.to, `<g class="gh">${stoneSVG({ el: c.el, tier: c.tier, owner: c.owner, variant: variantOf(c), squash: K, ghost: true })}</g>`);
    }
    for (const rm of fx.removed) h += at(rm.i, `<path d="${discPath(variantOf(rm.c), 21)}" transform="scale(1,${K})" fill="none" stroke="#ff5a36" stroke-width="2.5"/><path d="M-9,-9 L9,9 M9,-9 L-9,9" stroke="#ff5a36" stroke-width="3" stroke-linecap="round"/>`);
    h += at(p, `<g class="gh">${stoneSVG({ el: st.el, tier: st.tier, owner: 0, variant: variantOf(st), squash: K, ghost: true })}</g>`);
    L('L-over').innerHTML = h;
  }
  function clearPreview() { L('L-over').innerHTML = ''; }

  return { syncBoard, showPreview, clearPreview, hitLayer: L('L-hit') };
}

/* ---- the hand: a paper palm, three stones held up, and the flight of a drawn stone from the bag ---- */
export function createHand({ palmEl, flightEl, bagEl, rowEl }) {
  let flights = 0;
  function render(list, sel, drawn, canAct) {
    const key = list.map(s => s.uid).join(',');
    if (palmEl.dataset.key === key && !(drawn && drawn.length)) {   // same stones: only the selection changes, flights go on
      palmEl.querySelectorAll('.hs-btn').forEach((b, i) => { b.setAttribute('aria-pressed', sel === i); b.disabled = !canAct; b.querySelector('.hs').classList.toggle('on', sel === i); });
      return;
    }
    palmEl.dataset.key = key;
    palmEl.innerHTML = list.map((st, i) => `<button class="hs-btn" data-act="hand" data-i="${i}" aria-pressed="${sel === i}" aria-label="Stone ${i + 1}, ${S.stoneName(st)}${sel === i ? ', selected' : ''}" ${canAct ? '' : 'disabled'}>
      <span class="hs ${sel === i ? 'on' : ''}" style="animation-delay:${i * 0.4}s;${drawn && drawn.includes(i) ? 'visibility:hidden' : ''}">
        <svg viewBox="-28 -34 56 62" width="92" height="102" aria-hidden="true">${stoneSVG({ el: st.el, tier: st.tier, owner: 0, variant: variantOf(st) })}</svg>
        <span class="hkey">${i + 1}</span></span>
      <span class="hname el-${st.el}">${S.stoneName(st)}</span></button>`).join('');
    if (drawn && drawn.length) drawn.forEach((i, k) => setTimeout(() => fly(i, list[i]), k * 220));
  }
  // A stone leaves the bag and lands in its slot along an arc; the slot's stone then appears with a bounce.
  function fly(i, st) {
    const slot = palmEl.querySelector(`[data-i="${i}"] .hs`); if (!slot) return;
    const row = rowEl.getBoundingClientRect(), b = bagEl.getBoundingClientRect(), t = slot.getBoundingClientRect();
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || row.width === 0) { slot.style.visibility = ''; return; }
    const x0 = b.left + b.width / 2 - row.left, y0 = b.top + b.height * 0.42 - row.top, x1 = t.left + t.width / 2 - row.left, y1 = t.top + t.height / 2 - row.top;
    const id = 'fp' + (++flights);
    flightEl.setAttribute('viewBox', `0 0 ${row.width} ${row.height}`); flightEl.style.width = row.width + 'px'; flightEl.style.height = row.height + 'px';
    flightEl.insertAdjacentHTML('beforeend', `<g id="g${id}"><path id="${id}" d="M${f1(x0)},${f1(y0)} C${f1(x0 - 40)},${f1(y0 - 120)} ${f1(x1 + 60)},${f1(y1 - 130)} ${f1(x1)},${f1(y1)}" fill="none" stroke="#e9e2d2" stroke-width="2" stroke-dasharray="3 7" opacity=".45"/>
      <g><g transform="scale(.8)">${stoneSVG({ el: st.el, tier: st.tier, owner: 0, variant: variantOf(st) })}</g><animateMotion dur="0.8s" begin="indefinite" fill="freeze" calcMode="spline" keySplines="0.3 0 0.6 1" keyTimes="0;1" keyPoints="0;1"><mpath href="#${id}"/></animateMotion></g></g>`);
    const g = flightEl.querySelector(`#g${id}`), anim = g.querySelector('animateMotion');
    bagEl.classList.remove('jiggle'); void bagEl.offsetWidth; bagEl.classList.add('jiggle');
    anim.beginElement();
    setTimeout(() => { g.remove(); slot.style.visibility = ''; slot.classList.add('new'); }, 820);
  }
  return { render };
}

/* ---- scenery parallax and the board's slight tilt toward the pointer ---- */
export function initParallax(sceneryEl, tiltEl) {
  const layers = [...sceneryEl.querySelectorAll('[data-depth]')];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) return;
  let mx = 0, my = 0, raf = 0;
  const apply = () => { raf = 0; for (const l of layers) { const d = +l.dataset.depth; l.setAttribute('transform', `translate(${(mx * d).toFixed(1)},${(my * d * 0.5).toFixed(1)})`); } if (tiltEl) tiltEl.style.transform = `perspective(1400px) rotateX(${(-my * 1.6).toFixed(2)}deg) rotateY(${(mx * 1.6).toFixed(2)}deg)`; };
  addEventListener('pointermove', e => { mx = e.clientX / innerWidth - 0.5; my = e.clientY / innerHeight - 0.5; if (!raf) raf = requestAnimationFrame(apply); }, { passive: true });
}
