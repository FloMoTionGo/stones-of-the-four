// Cut-paper stones. A stone is a disc of card (hand-cut, so its edge wobbles a little) with a paper edge and a hard cast
// shadow, carrying a standing emblem made of three paper layers, each throwing a small shadow on the one beneath.
// Every element has three emblem shapes and every disc three cuts, picked by the stone's identity, so a board of
// Fire I stones is a crowd of individuals rather than copies. Coordinates: the disc centre is 0,0 and its radius 19;
// emblems stand on the disc with their base at y = -2 and are drawn ~44 units tall before scaling.

export const TONES = {
  fire:  { me: ['#e8343c', '#f7a21b', '#f9d64f'], them: ['#8a1c18', '#c0551a', '#d8352a'], pip: ['#f9d64f', '#d8352a'] },
  water: { me: ['#145266', '#4a9ee6', '#8bc8ff'], them: ['#0b2a36', '#1e5f86', '#4a9ee6'], pip: ['#8bc8ff', '#145266'] },
  earth: { me: ['#9ad59a', '#1e4f30', '#5fb86a'], them: ['#4f8052', '#0f2b1a', '#2e6a3b'], pip: ['#9ad59a', '#1e4f30'] },
  air:   { me: ['#6f7f96', '#b9c8dd', '#e9e2d2'], them: ['#3b4556', '#6f7f96', '#a9b3c6'], pip: ['#b9c8dd', '#6f7f96'] },
};
export const EL_MAIN = { fire: '#f7a21b', water: '#4a9ee6', earth: '#5fb86a', air: '#b9c8dd', plain: '#e9e2d2' };

// Emblem layers, back to front. A variant is three path strings, with an optional transform on the whole emblem.
export const EMBLEMS = {
  fire: [
    { d: ['M0,0 C-16,-4 -18,-22 -9,-32 C-11,-20 -5,-16 -2,-20 C-8,-32 0,-42 3,-52 C4,-38 11,-33 10,-24 C15,-31 15,-38 12,-44 C22,-32 22,-10 8,0 Z',
          'M0,0 C-10,-3 -12,-15 -5,-23 C-6,-14 -2,-12 0,-15 C-4,-23 1,-29 3,-36 C3,-27 8,-24 7,-17 C12,-22 12,-8 6,0 Z',
          'M0,0 C-5,-2 -6,-9 -3,-13 C-3,-8 0,-7 1,-9 C0,-14 2,-17 3,-21 C3,-16 5,-13 5,-9 C8,-5 6,-2 3,0 Z'], t: 'scale(0.86)' },
    { d: ['M0,0 C-16,-4 -18,-22 -9,-32 C-11,-20 -5,-16 -2,-20 C-8,-32 0,-42 3,-52 C4,-38 11,-33 10,-24 C15,-31 15,-38 12,-44 C22,-32 22,-10 8,0 Z',
          'M0,0 C-10,-3 -12,-15 -5,-23 C-6,-14 -2,-12 0,-15 C-4,-23 1,-29 3,-36 C3,-27 8,-24 7,-17 C12,-22 12,-8 6,0 Z',
          'M0,0 C-5,-2 -6,-9 -3,-13 C-3,-8 0,-7 1,-9 C0,-14 2,-17 3,-21 C3,-16 5,-13 5,-9 C8,-5 6,-2 3,0 Z'], t: 'scale(-0.94,0.8)' },
    { d: ['M0,0 C-18,-4 -22,-20 -14,-30 C-16,-16 -8,-14 -5,-18 C-10,-30 -2,-40 2,-50 C3,-37 9,-32 8,-24 C14,-30 16,-40 14,-46 C24,-34 22,-10 8,0 Z',
          'M0,0 C-11,-3 -13,-14 -7,-22 C-8,-13 -3,-11 0,-14 C-4,-22 1,-28 3,-35 C3,-26 8,-23 7,-16 C12,-21 12,-8 6,0 Z',
          'M0,0 C-5,-2 -6,-9 -3,-13 C-3,-8 0,-7 1,-9 C0,-14 2,-17 3,-21 C3,-16 5,-13 5,-9 C8,-5 6,-2 3,0 Z'], t: 'skewX(-8) scale(0.84,0.92)' },
  ],
  water: [
    { d: ['M-22,0 C-19,-11 -9,-17 0,-15 C9,-13 16,-8 22,0 Z',
          'M-20,0 C-21,-15 -12,-30 2,-32 C14,-34 22,-25 19,-15 C17,-21 11,-22 8,-16 C13,-12 17,-6 16,0 Z',
          'M-2,-31 C1,-37 9,-38 13,-34 C17,-37 21,-34 20,-29 C18,-31 15,-31 13,-29 C10,-33 4,-33 1,-29 C0,-30 -2,-30 -2,-31 Z'], t: '' },
    { d: ['M-22,0 C-19,-11 -9,-17 0,-15 C9,-13 16,-8 22,0 Z',
          'M-20,0 C-21,-15 -12,-30 2,-32 C14,-34 22,-25 19,-15 C17,-21 11,-22 8,-16 C13,-12 17,-6 16,0 Z',
          'M-2,-31 C1,-37 9,-38 13,-34 C17,-37 21,-34 20,-29 C18,-31 15,-31 13,-29 C10,-33 4,-33 1,-29 C0,-30 -2,-30 -2,-31 Z'], t: 'scale(-1,1.06)' },
    { d: ['M-24,0 C-20,-10 -12,-14 -4,-12 C2,-11 8,-12 14,-10 C18,-9 22,-5 24,0 Z',
          'M-22,0 C-22,-12 -16,-24 -8,-24 C-2,-24 0,-18 -2,-14 C2,-20 8,-28 16,-26 C22,-25 22,-14 18,-8 C20,-4 20,-2 18,0 Z',
          'M-14,-22 C-11,-27 -4,-27 -1,-23 C-4,-24 -8,-24 -10,-21 Z M8,-25 C11,-31 18,-31 20,-26 C17,-27 13,-27 10,-24 Z'], t: '' },
  ],
  earth: [
    { d: ['M-20,0 C-16,-22 -4,-42 4,-42 C14,-42 22,-22 24,0 Z',
          'M-24,0 C-20,-14 -10,-21 0,-19 C10,-17 20,-11 24,0 Z',
          'M-26,0 C-25,-12 -18,-21 -11,-20 C-5,-19 -1,-10 0,0 Z'], t: '' },
    { d: ['M-20,0 C-16,-22 -4,-42 4,-42 C14,-42 22,-22 24,0 Z',
          'M-24,0 C-20,-14 -10,-21 0,-19 C10,-17 20,-11 24,0 Z',
          'M-26,0 C-25,-12 -18,-21 -11,-20 C-5,-19 -1,-10 0,0 Z'], t: 'scale(-1,0.96)' },
    { d: ['M-24,0 C-20,-18 -14,-30 -6,-30 C0,-30 2,-22 4,-20 C8,-28 14,-34 18,-32 C22,-30 24,-14 24,0 Z',
          'M-26,0 C-22,-12 -14,-18 -4,-16 C6,-14 16,-10 26,0 Z',
          'M-10,0 C-8,-10 -2,-16 4,-15 C10,-14 14,-8 16,0 Z'], t: '' },
  ],
  air: [
    { d: ['M-26,0 C-32,-3 -30,-15 -20,-14 C-20,-27 -4,-31 2,-21 C12,-28 26,-21 22,-10 C30,-8 28,0 20,0 Z',
          'M-22,-2 C-26,-5 -24,-14 -16,-13 C-16,-24 -2,-27 3,-18 C11,-23 22,-18 19,-9 C25,-7 23,-2 17,-2 Z',
          'M-8,-14 C-8,-24 4,-27 8,-18 C14,-20 18,-14 14,-10 C10,-8 -4,-8 -8,-14 Z'], t: '' },
    { d: ['M-26,0 C-32,-3 -30,-15 -20,-14 C-20,-27 -4,-31 2,-21 C12,-28 26,-21 22,-10 C30,-8 28,0 20,0 Z',
          'M-22,-2 C-26,-5 -24,-14 -16,-13 C-16,-24 -2,-27 3,-18 C11,-23 22,-18 19,-9 C25,-7 23,-2 17,-2 Z',
          'M-8,-14 C-8,-24 4,-27 8,-18 C14,-20 18,-14 14,-10 C10,-8 -4,-8 -8,-14 Z'], t: 'scale(-0.94,1)' },
    { d: ['M-20,0 C-26,-2 -24,-12 -16,-12 C-18,-22 -6,-28 0,-22 C4,-32 18,-30 16,-18 C24,-16 24,-2 16,0 Z',
          'M-16,-2 C-20,-4 -18,-11 -12,-11 C-13,-19 -4,-23 1,-18 C4,-26 14,-25 13,-15 C19,-13 19,-3 13,-2 Z',
          'M-6,-18 C-5,-26 6,-28 9,-20 C13,-21 15,-16 11,-13 C6,-11 -4,-12 -6,-18 Z'], t: '' },
  ],
};

// Three hand cuts of the disc: a smooth closed curve through 12 points with a little radius jitter.
const WOBBLE = [
  [0.4, -0.3, 0.5, 0.2, -0.4, 0.3, -0.2, 0.5, -0.5, 0.2, 0.3, -0.4],
  [-0.3, 0.5, 0.1, -0.5, 0.4, -0.2, 0.5, -0.3, 0.2, -0.4, 0.5, 0.1],
  [0.5, 0.1, -0.4, 0.4, -0.1, -0.5, 0.3, 0.2, -0.3, 0.5, -0.4, 0.1],
];
const discCache = new Map();
export function discPath(variant = 0, r = 19) {
  const key = `${variant}:${r}`; if (discCache.has(key)) return discCache.get(key);
  const jit = WOBBLE[variant % 3], n = jit.length, pts = [];
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, rr = r + jit[i] * (r / 19); pts.push([Math.cos(a) * rr, Math.sin(a) * rr]); }
  let d = `M${pts[0][0].toFixed(2)},${pts[0][1].toFixed(2)}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(2)},${c1[1].toFixed(2)} ${c2[0].toFixed(2)},${c2[1].toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)}`;
  }
  d += ' Z'; discCache.set(key, d); return d;
}

export const variantOf = st => ((st && (st.uid ?? st.id)) || 0) % 3;

// The standing emblem: three layers, each with a hard shadow on what lies beneath. scale sets its height on the disc.
export function emblemSVG(el, owner, variant = 0, scale = 0.55, ghost = false) {
  const v = EMBLEMS[el][variant % 3], tones = TONES[el][owner ? 'them' : 'me'];
  let s = `<g transform="translate(0,2) scale(${scale}) ${v.t}">`;
  v.d.forEach((d, i) => {
    if (!ghost) s += `<path d="${d}" transform="translate(-1.6,1.8)" fill="#000" opacity="${i === 0 ? .5 : .32}"/>`;
    s += `<path d="${d}" fill="${tones[i]}"/>`;
  });
  return s + '</g>';
}

// A whole stone. squash flattens the disc for an oblique view (1 = seen from the front, as in the hand).
export function stoneSVG({ el, tier = 0, owner = 0, variant = 0, squash = 1, ghost = false, extra = '' }) {
  const disc = discPath(variant), top = owner ? '#e9e2d2' : '#15171d', edge = owner ? '#9c927d' : '#000';
  let s = ghost ? `<g opacity=".55">` : '<g>';
  s += `<g transform="scale(1,${squash})">`;
  if (!ghost) s += `<path d="${disc}" transform="translate(-3,6)" fill="#000" opacity=".5"/>`;
  s += `<path d="${disc}" transform="translate(0,3.2)" fill="${edge}"/>`;
  s += `<path d="${disc}" fill="${top}"/>`;
  if (!owner) s += `<path d="${disc}" fill="none" stroke="#3a3f4d" stroke-width="1.2"/>`;
  if (tier === 3 && el !== 'plain') s += `<path d="${discPath(variant, 16)}" fill="none" stroke="${TONES[el].pip[owner]}" stroke-width="1.1" opacity=".8"/>`;
  s += '</g>';
  if (el !== 'plain') {
    s += emblemSVG(el, owner, variant, 0.55, ghost);
    const pip = TONES[el].pip[owner], y = 12.5 * squash;
    for (const x of [[], [0], [-3.4, 3.4], [-6, 0, 6]][tier]) s += `<ellipse cx="${x}" cy="${y}" rx="2" ry="${2 * squash}" fill="${pip}"/>`;
  }
  s += extra;
  if (ghost) s += `<path d="${discPath(variant, 21)}" transform="scale(1,${squash})" fill="none" stroke="${EL_MAIN[el]}" stroke-width="2.2" stroke-dasharray="5 4"/>`;
  return s + '</g>';
}

// Standalone markup for the HTML: hand, shop, log, rules.
export const stoneIcon = (st, owner = 0, size = 48, cls = '') =>
  `<svg class="st ${cls}" viewBox="-28 -34 56 62" width="${size}" height="${size}" aria-hidden="true" focusable="false">${stoneSVG({ el: st.el, tier: st.tier, owner, variant: variantOf(st) })}</svg>`;

// A scorch flame: the three fire tongues, flickering, with its ember glow.
export function flameSVG(scale = 0.4, cls = 'fl') {
  const v = EMBLEMS.fire[0];
  let s = `<g class="${cls}" transform="scale(${scale})">`;
  v.d.forEach((d, i) => { s += `<path d="${d}" fill="${TONES.fire.me[i]}"/>`; });
  return s + '</g>';
}

// Paper shards for a shattered stone: small triangles with per-shard flight vectors for the CSS animation.
export function shardsSVG(el, owner) {
  const cols = [owner ? '#e9e2d2' : '#3a3f4d', owner ? '#9c927d' : '#15171d', el !== 'plain' ? EL_MAIN[el] : (owner ? '#e9e2d2' : '#3a3f4d')];
  let s = '';
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + 0.3, dist = 26 + (i % 3) * 10, dx = Math.cos(a) * dist, dy = Math.sin(a) * dist * 0.7 - 18;
    const w = 5 + (i % 3) * 2, h = 6 + ((i * 7) % 4) * 2;
    s += `<path class="shard" style="--dx:${dx.toFixed(1)}px;--dy:${dy.toFixed(1)}px;--rot:${(i % 2 ? 1 : -1) * (120 + i * 25)}deg;animation-delay:${(i % 4) * 25}ms" d="M0,0 L${w},${(h * 0.3).toFixed(1)} L${(w * 0.3).toFixed(1)},${h} Z" fill="${cols[i % 3]}"/>`;
  }
  return s;
}
