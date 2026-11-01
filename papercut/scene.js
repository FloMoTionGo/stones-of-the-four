// The Papercut Noir diorama: board, stones, scenery, light, effects and picking. Presentation only; it reads engine state and never changes it.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const S = window.SOTF;
const { N, NN, X, Y, DIAG, JUMP, KNIGHT } = S;

// Palette: the artboard's paper colours.
export const C = {
  night: 0x07080c, card: 0x1a1e27, card2: 0x232838, card3: 0x262b3a, board: 0x2a2d38, table: 0x0b0d12, bone: 0xe9e2d2, boneLo: 0x9c927d, ink: 0x0a0b0f, inkHi: 0x3a3f4d,
  moon: 0xd8352a, moonDeep: 0xb8231a, ember: 0xff5a36, blood: 0x5a1612, fire: 0xf7a21b, fireHi: 0xf9d64f, fireLo: 0xe8343c,
  water: 0x4a9ee6, waterHi: 0x8bc8ff, waterLo: 0x145266, earth: 0x5fb86a, earthHi: 0x9ad59a, earthLo: 0x1e4f30, air: 0xb9c8dd, airLo: 0x6f7f96,
  ground1: 0x1e2a22, ground2: 0x141c17, cloud1: 0x141821, cloud2: 0x1b2029,
};
// [main, mine, theirs]: pip and link colours per element, light for your stones, dark for the opponent's (as on the artboard).
const ELC = { fire: [C.fire, C.fireHi, C.moon], water: [C.water, C.waterHi, C.waterLo], earth: [C.earth, C.earthHi, C.earthLo], air: [C.air, C.air, C.airLo] };
// The generated emblem meshes don't share an up or front axis; these make each stand upright facing the player, at a common height.
const EMBLEM = { fire: { rot: [0, 0, 0], h: 0.52 }, water: { rot: [0, -Math.PI / 2, 0], h: 0.44 }, earth: { rot: [0, 0, 0], h: 0.46 }, air: { rot: [Math.PI / 2, 0, 0], h: 0.42 } };
const SVG = {
  cloudA: 'M980,150 c0,-30 30,-52 62,-48 c14,-34 66,-40 90,-12 c30,-16 72,2 76,36 c30,2 50,22 46,50 L960,176 c-4,-12 4,-24 20,-26 Z',
  cloudB: 'M1030,170 c0,-30 30,-52 62,-48 c14,-34 66,-40 90,-12 c30,-16 72,2 76,36 c30,2 50,22 46,50 L1010,196 c-4,-12 4,-24 20,-26 Z',
  hill1: 'M0,800 C180,740 300,760 440,800 C600,845 720,730 900,775 C1050,812 1180,752 1280,780 L1280,1040 L0,1040 Z',
  hill2: 'M0,860 C160,815 320,835 470,870 C640,910 760,805 950,845 C1090,875 1200,835 1280,850 L1280,1040 L0,1040 Z',
  flame: ['M0,0 C-16,-4 -18,-22 -9,-32 C-11,-20 -5,-16 -2,-20 C-8,-32 0,-42 3,-52 C4,-38 11,-33 10,-24 C15,-31 15,-38 12,-44 C22,-32 22,-10 8,0 Z',
          'M0,0 C-10,-3 -12,-15 -5,-23 C-6,-14 -2,-12 0,-15 C-4,-23 1,-29 3,-36 C3,-27 8,-24 7,-17 C12,-22 12,-8 6,0 Z',
          'M0,0 C-5,-2 -6,-9 -3,-13 C-3,-8 0,-7 1,-9 C0,-14 2,-17 3,-21 C3,-16 5,-13 5,-9 C8,-5 6,-2 3,0 Z'],
};

const px = p => X(p) - 4, pz = p => Y(p) - 4;   // board point -> world x/z (row 9 is far, at -z)
const ease = { out: t => 1 - Math.pow(1 - t, 3), inout: t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2, back: t => { const c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }, in: t => t * t };
const paper = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.96, metalness: 0, ...extra });
const svgLoader = new SVGLoader();
function extrude(d, color, depth = 0.12, scale = 1, sy = scale) {
  const shapes = svgLoader.parse(`<svg xmlns="http://www.w3.org/2000/svg"><path d="${d}"/></svg>`).paths.flatMap(p => SVGLoader.createShapes(p));
  const geo = new THREE.ExtrudeGeometry(shapes, { depth, bevelEnabled: false });
  geo.scale(scale, -sy, 1);
  const m = new THREE.Mesh(geo, paper(color, { side: THREE.DoubleSide }));
  m.castShadow = m.receiveShadow = true;
  return m;
}

export async function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.2;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(C.night);
  scene.fog = new THREE.Fog(C.night, 24, 50);
  const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 120);
  const cam = { home: new THREE.Vector3(1.7, 9.0, 12.4), target: new THREE.Vector3(1.7, 0, 0.9), far: new THREE.Vector3(1.7, 16, 20) };
  camera.position.copy(cam.home); camera.lookAt(cam.target);

  /* ---- light: a red moon from the upper right, a cool fill from the night sky ---- */
  scene.add(new THREE.HemisphereLight(0x55648a, 0x0d0f16, 1.15));
  const moonLight = new THREE.DirectionalLight(0xffc0a0, 2.4);
  moonLight.position.set(9, 14, -10); moonLight.castShadow = true;
  Object.assign(moonLight.shadow.camera, { left: -13, right: 13, top: 13, bottom: -13, near: 1, far: 60 });
  moonLight.shadow.mapSize.set(2048, 2048); moonLight.shadow.bias = -0.0005; moonLight.shadow.normalBias = 0.02;
  scene.add(moonLight);
  const fill = new THREE.DirectionalLight(0x8bb0ff, 0.5); fill.position.set(-8, 7, 12); scene.add(fill);

  /* ---- table, board stack ---- */
  const table = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), paper(C.table)); table.rotation.x = -Math.PI / 2; table.position.y = -0.55; table.receiveShadow = true; scene.add(table);
  const boardG = new THREE.Group(); boardG.rotation.y = 0.008; scene.add(boardG);
  const backing = new THREE.Mesh(new RoundedBoxGeometry(10.8, 0.2, 10.8, 3, 0.5), paper(C.card3)); backing.position.set(0.3, -0.42, 0.3); backing.castShadow = backing.receiveShadow = true; boardG.add(backing);
  const sheet = new THREE.Mesh(new RoundedBoxGeometry(10.8, 0.24, 10.8, 3, 0.45), paper(C.card)); sheet.position.y = -0.2; sheet.castShadow = sheet.receiveShadow = true; boardG.add(sheet);
  const board = new THREE.Mesh(new RoundedBoxGeometry(9.7, 0.18, 9.7, 3, 0.3), paper(C.board)); board.position.y = 0; board.castShadow = board.receiveShadow = true; boardG.add(board);
  const grid = new THREE.Mesh(new THREE.PlaneGeometry(9.7, 9.7), new THREE.MeshStandardMaterial({ map: gridTexture(), transparent: true, roughness: 1, metalness: 0, polygonOffset: true, polygonOffsetFactor: -1 }));
  grid.rotation.x = -Math.PI / 2; grid.position.y = 0.091; grid.receiveShadow = true; boardG.add(grid);
  const pickPlane = new THREE.Mesh(new THREE.PlaneGeometry(9.7, 9.7), new THREE.MeshBasicMaterial({ visible: false })); pickPlane.rotation.x = -Math.PI / 2; pickPlane.position.y = 0.1; boardG.add(pickPlane);
  // the hand: a paper palm laid over the near edge of the sheet
  const tray = new THREE.Mesh(new RoundedBoxGeometry(4.4, 0.16, 1.5, 3, 0.4), paper(C.card2)); tray.position.set(2.6, -0.02, 5.95); tray.castShadow = tray.receiveShadow = true; scene.add(tray);
  const HAND_X = [1.4, 2.6, 3.8], HAND_Z = 5.95, HAND_Y = 0.06;

  /* ---- scenery: the shadow box behind the board ---- */
  const scenery = new THREE.Group(); scene.add(scenery);
  const sx = 0.024, sy = 0.0085, groundY = -0.55;   // the artboard's horizon, wide and low
  const hillA = extrude(SVG.hill1, C.ground1, 0.3, sx, sy); hillA.position.set(-1280 * sx / 2, groundY + 1040 * sy, -9.6); scenery.add(hillA);
  const hillB = extrude(SVG.hill2, C.ground2, 0.3, sx, sy); hillB.position.set(-1280 * sx / 2, groundY + 1040 * sy, -8.0); scenery.add(hillB);
  const moon = new THREE.Group();
  const moonA = new THREE.Mesh(new THREE.CircleGeometry(1.75, 48), new THREE.MeshBasicMaterial({ color: C.moonDeep, fog: false }));
  const moonB = new THREE.Mesh(new THREE.CircleGeometry(1.35, 48), new THREE.MeshBasicMaterial({ color: C.moon, fog: false })); moonB.position.z = 0.05;
  moon.add(moonA, moonB); moon.position.set(11, 2.2, -11.5); scenery.add(moon);
  const cs = 0.017;
  const cloudA = extrude(SVG.cloudA, C.cloud1, 0.2, cs); cloudA.position.set(moon.position.x - 1090 * cs, moon.position.y + 120 * cs, -10.9); scenery.add(cloudA);
  const cloudB = extrude(SVG.cloudB, C.cloud2, 0.2, cs); cloudB.position.set(moon.position.x - 1090 * cs, moon.position.y + 120 * cs, -10.6); scenery.add(cloudB);
  for (const [x, s] of [[-11, 1.3], [-8.5, 0.9], [-3.5, 1.1], [1.5, 0.8], [7.5, 1.2], [13.5, 1.0]]) { const t = deadTree(s); t.position.set(x, groundY + 1.2, -8.6); scenery.add(t); }
  const groundFlames = [];
  for (const [x, s, flip] of [[-12, 1.3, 1], [-9.6, 1.7, -1], [-7, 1.1, 1], [-4.2, 1.5, 1], [-1.4, 1.2, -1], [1.6, 1.8, 1], [4.6, 1.25, -1], [7.4, 1.5, 1], [10.2, 1.1, -1], [12.6, 1.6, 1]]) {
    const f = flameMesh(0.02 * s); f.position.set(x, groundY + 0.2, -6.9); f.scale.x = flip; f.userData.phase = Math.random() * 6; scenery.add(f); groundFlames.push(f);
  }

  /* ---- shared geometry ---- */
  const discGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.14, 48), underGeo = new THREE.CylinderGeometry(0.43, 0.43, 0.02, 48);
  const pipGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.02, 12), ringGeo = new THREE.TorusGeometry(0.34, 0.012, 6, 48);
  const rimGeo = new THREE.TorusGeometry(0.41, 0.013, 6, 48), ghostRingGeo = new THREE.TorusGeometry(0.47, 0.022, 6, 48);
  const dangerGeo = new THREE.TorusGeometry(0.5, 0.025, 6, 48), dotGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.02, 10), linkDotGeo = dotGeo;
  const glowGeo = new THREE.CircleGeometry(0.34, 24), terrGeo = new THREE.PlaneGeometry(0.3, 0.3), cursorGeo = new THREE.EdgesGeometry(new THREE.PlaneGeometry(0.92, 0.92));
  const shardGeos = Array.from({ length: 6 }, () => { const s = new THREE.Shape(); const a = 0.06 + Math.random() * 0.08, b = 0.06 + Math.random() * 0.1; s.moveTo(0, 0); s.lineTo(a, b * 0.3); s.lineTo(a * 0.3, b); s.lineTo(0, 0); return new THREE.ShapeGeometry(s); });

  /* ---- emblems from the generated models ---- */
  const loader = new GLTFLoader();
  const protos = {}, emblemMats = {};
  // Models come from assets/models/*.glb, or from window.__models (base64 GLBs) where a host serves no .glb files.
  const loadModel = (el, onLoad, onError) => {
    const b64 = window.__models && window.__models[el];
    if (!b64) return loader.load(`./assets/models/${el}.glb`, onLoad, undefined, onError);
    const bin = atob(b64), buf = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    loader.parse(buf.buffer, '', onLoad, onError);
  };
  await Promise.all(Object.keys(EMBLEM).map(el => new Promise((res, rej) => loadModel(el, g => {
    const cfg = EMBLEM[el], inner = g.scene; inner.rotation.set(...cfg.rot);
    const wrap = new THREE.Group(); wrap.add(inner);
    const box = new THREE.Box3().setFromObject(wrap), size = box.getSize(new THREE.Vector3()), k = cfg.h / size.y;
    wrap.scale.setScalar(k); wrap.updateMatrixWorld(true);
    const b2 = new THREE.Box3().setFromObject(wrap), c2 = b2.getCenter(new THREE.Vector3());
    wrap.position.set(-c2.x, -b2.min.y, -c2.z);
    const holder = new THREE.Group(); holder.add(wrap);
    let base = null; wrap.traverse(o => { if (o.isMesh && !base) base = o.material; });
    const mk = (color, ghost) => { const m = base.clone(); m.roughness = 0.9; m.metalness = 0; m.color.setHex(color); if (ghost) { m.transparent = true; m.opacity = 0.5; m.depthWrite = false; } return m; };
    emblemMats[el] = { me: mk(0xffffff, false), them: mk(0x8f96a8, false), meGhost: mk(0xffffff, true), themGhost: mk(0x8f96a8, true) };
    protos[el] = holder; res();
  }, rej))));
  const emblem = (el, owner, ghost) => { const e = protos[el].clone(); const mat = emblemMats[el][(owner ? 'them' : 'me') + (ghost ? 'Ghost' : '')]; e.traverse(o => { if (o.isMesh) { o.material = mat; o.castShadow = !ghost; o.receiveShadow = true; } }); return e; };

  function makeStone(el, tier, owner, ghost = false) {
    const g = new THREE.Group();
    const gh = ghost ? { transparent: true, opacity: 0.5, depthWrite: false } : {};
    const under = new THREE.Mesh(underGeo, paper(owner ? C.boneLo : 0x000000, gh)); under.position.set(0, 0.01, 0.05); under.receiveShadow = true;
    const disc = new THREE.Mesh(discGeo, paper(owner ? C.bone : 0x171920, gh)); disc.position.y = 0.07; disc.castShadow = !ghost; disc.receiveShadow = true;
    g.add(under, disc);
    if (!owner) { const rim = new THREE.Mesh(rimGeo, paper(C.inkHi, gh)); rim.rotation.x = Math.PI / 2; rim.position.y = 0.14; g.add(rim); }   // the black card's lighter cut edge
    if (ghost) { const ring = new THREE.Mesh(ghostRingGeo, new THREE.MeshBasicMaterial({ color: el === S.PLAIN ? C.bone : ELC[el][0] })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.16; g.add(ring); }
    if (el !== S.PLAIN) {
      const e = emblem(el, owner, ghost); e.position.set(0, 0.14, -0.05); g.add(e);
      const col = ELC[el][owner ? 2 : 1];
      for (const x of [[], [0], [-0.09, 0.09], [-0.16, 0, 0.16]][tier]) { const pip = new THREE.Mesh(pipGeo, paper(col, gh)); pip.position.set(x, 0.145, 0.3); g.add(pip); }
      if (tier === 3) { const ring = new THREE.Mesh(ringGeo, paper(col, gh)); ring.rotation.x = Math.PI / 2; ring.position.y = 0.142; g.add(ring); }
    }
    g.userData = { el, tier, owner };
    return g;
  }

  /* ---- scene state ---- */
  const stonesG = new THREE.Group(), marksG = new THREE.Group(), scorchG = new THREE.Group(), previewG = new THREE.Group(), fxG = new THREE.Group(), handG = new THREE.Group();
  boardG.add(stonesG, marksG, scorchG, previewG); scene.add(fxG, handG);
  const stones = new Map();            // stone id -> group
  const scorches = new Map();          // point -> { group, light, flame, phase }
  const lightPool = Array.from({ length: 7 }, () => { const l = new THREE.PointLight(C.ember, 0, 2.8, 2); scene.add(l); return l; });
  const tweens = [], shards = [], pulses = [];
  let hand = [], handSel = -1, handLabels = [], cursorMesh = null, t = 0;
  const projV = new THREE.Vector3();
  function setHandLabels(els) { handLabels = els; }
  function placeHandLabels() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    handLabels.forEach((el, i) => { const g = hand[i]; if (!g) { el.style.visibility = 'hidden'; return; } projV.set(g.position.x, -0.1, g.position.z + 0.45).project(camera); el.style.visibility = 'visible'; el.style.transform = `translate(${((projV.x + 1) / 2 * w).toFixed(1)}px, ${((1 - projV.y) / 2 * h).toFixed(1)}px) translate(-50%, 0)`; });
  }
  const tween = (dur, fn, easing = ease.out, done) => { const tw = { t0: t, dur, fn, easing, done }; tweens.push(tw); fn(0); return tw; };

  /* ---- embers ---- */
  const EMB = 220, embPos = new Float32Array(EMB * 3), embCol = new Float32Array(EMB * 3), embVel = new Float32Array(EMB * 3), embLife = new Float32Array(EMB);
  const embGeo = new THREE.BufferGeometry(); embGeo.setAttribute('position', new THREE.BufferAttribute(embPos, 3)); embGeo.setAttribute('color', new THREE.BufferAttribute(embCol, 3));
  const embers = new THREE.Points(embGeo, new THREE.PointsMaterial({ size: 0.11, map: spriteTexture(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  embers.frustumCulled = false; scene.add(embers); let embNext = 0;
  function emitEmber(x, y, z, hot = 1) {
    const i = embNext++ % EMB; embPos.set([x + (Math.random() - .5) * .3, y, z + (Math.random() - .5) * .3], i * 3);
    embVel.set([(Math.random() - .5) * .5, .6 + Math.random() * .9, (Math.random() - .5) * .5], i * 3); embLife[i] = 1; embCol.set([1 * hot, .35 * hot, .2 * hot], i * 3);
  }

  /* ---- public: board sync ---- */
  function syncBoard(m, fx) {
    const s = m.s; fx = fx || { removed: [], moved: [], placed: null };
    const movedTo = new Map(fx.moved.map(mv => [mv.to, mv.from]));
    const keep = new Set();
    for (let p = 0; p < NN; p++) {
      const c = s.board[p]; if (!c) continue; keep.add(c.id);
      let g = stones.get(c.id);
      if (!g || g.userData.hp !== c.hp) {
        if (g) stonesG.remove(g);
        g = makeStone(c.el, c.tier, c.owner); g.userData.hp = c.hp; g.userData.id = c.id;
        if (c.el === 'earth' && c.hp < c.tier) g.add(crackLine());
        stones.set(c.id, g); stonesG.add(g);
        if (fx.placed === c.id) { g.position.set(px(p), 0, pz(p)); tween(0.3, k => { g.position.y = (1 - k) * 1.1; g.scale.setScalar(1.25 - 0.25 * k); }, ease.out, () => emitPuff(px(p), pz(p))); }
        else if (!movedTo.has(p)) g.position.set(px(p), 0, pz(p));
      }
      if (movedTo.has(p)) { const f = movedTo.get(p), x0 = px(f), z0 = pz(f), x1 = px(p), z1 = pz(p); tween(0.42, k => g.position.set(x0 + (x1 - x0) * k, 0.12 * Math.sin(k * Math.PI), z0 + (z1 - z0) * k)); }
      else if (!fx.placed || fx.placed !== c.id) g.position.set(px(p), 0, pz(p));
    }
    for (const [id, g] of stones) if (!keep.has(id)) { stones.delete(id); const rm = fx.removed.find(r => r.c.id === id); shatter(g, rm ? rm.i : null); }
    // scorch marks
    const want = new Set();
    for (let p = 0; p < NN; p++) {
      const scz = s.scorch[p]; if (!scz) continue; want.add(p);
      if (!scorches.has(p)) {
        const g = new THREE.Group(); g.position.set(px(p), 0.09, pz(p));
        const glow = new THREE.Mesh(glowGeo, new THREE.MeshBasicMaterial({ color: C.ember, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false })); glow.rotation.x = -Math.PI / 2; g.add(glow);
        const flame = protos.fire.clone(); flame.traverse(o => { if (o.isMesh) { o.material = emblemMats.fire.me; o.castShadow = true; } }); flame.scale.setScalar(0.5); flame.position.y = 0.01; g.add(flame);
        const light = lightPool.find(l => !l.userData.busy); if (light) { light.userData.busy = true; light.position.set(px(p), 0.6, pz(p)); light.intensity = 1.1; }
        scorchG.add(g); scorches.set(p, { g, light, flame, phase: Math.random() * 6, owner: scz.owner });
        tween(0.35, k => flame.scale.setScalar(0.5 * ease.back(k)));
      }
    }
    for (const [p, o] of scorches) if (!want.has(p)) { scorches.delete(p); if (o.light) { o.light.userData.busy = false; o.light.intensity = 0; } tween(0.3, k => o.g.scale.setScalar(1 - k), ease.in, () => scorchG.remove(o.g)); }
    // marks: danger rings, last move, air links, territory
    marksG.clear();
    for (const side of [0, 1]) for (const g of S.computeGroups(s, side).groups) if (g.libs <= 1) for (const j of g.stones) {
      const ring = new THREE.Mesh(dangerGeo, new THREE.MeshBasicMaterial({ color: C.ember, transparent: true, opacity: g.libs === 0 ? 1 : 0.75 })); ring.rotation.x = Math.PI / 2; ring.position.set(px(j), 0.16, pz(j)); marksG.add(ring);
      if (g.libs === 0) pulses.push(ring.material);
    }
    if (m.last) { const dot = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 8), new THREE.MeshBasicMaterial({ color: C.moon })); dot.position.set(px(m.last.p) + 0.36, 0.3, pz(m.last.p) - 0.3); marksG.add(dot); }
    for (const [a, b, owner] of airLinks(s)) {
      const ax = px(a), az = pz(a), bx = px(b), bz = pz(b), n = Math.max(3, Math.round(Math.hypot(bx - ax, bz - az) / 0.22));
      const mat = paper(owner ? C.airLo : C.air);
      for (let k = 1; k < n; k++) { const d = new THREE.Mesh(linkDotGeo, mat); d.position.set(ax + (bx - ax) * k / n, 0.17, az + (bz - az) * k / n); marksG.add(d); }
    }
    if (m.over && m.result) for (let p = 0; p < NN; p++) if (m.result.sc.own[p] >= 0 && !s.board[p]) {
      const sq = new THREE.Mesh(terrGeo, new THREE.MeshBasicMaterial({ color: m.result.sc.own[p] === 0 ? C.inkHi : C.bone, transparent: true, opacity: 0.85 })); sq.rotation.x = -Math.PI / 2; sq.position.set(px(p), 0.105, pz(p)); marksG.add(sq);
    }
  }
  function airLinks(s) {
    const out = [], b = s.board, airT = c => c && c.el === 'air' ? c.tier : 0;
    for (let i = 0; i < NN; i++) { const c = b[i]; if (!c) continue;
      for (const [list, need] of [[DIAG, 1], [JUMP, 2], [KNIGHT, 3]]) for (const j of list[i]) if (j > i && b[j] && b[j].owner === c.owner && Math.max(airT(c), airT(b[j])) >= need) out.push([i, j, c.owner]);
    }
    return out;
  }
  function crackLine() {
    const pts = [[-0.24, -0.26], [-0.09, -0.1], [-0.17, 0.02], [-0.02, 0.16], [-0.06, 0.28]].map(([x, z]) => new THREE.Vector3(x, 0.146, z));
    return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: C.ember }));
  }
  function shatter(g, p) {
    const { el, owner } = g.userData, x = g.position.x, z = g.position.z;
    tween(0.22, k => g.scale.setScalar(1 - k), ease.in, () => stonesG.remove(g));
    if (p === null) return;
    const cols = [owner ? C.bone : C.inkHi, owner ? C.boneLo : C.inkHi, el !== S.PLAIN ? ELC[el][0] : (owner ? C.bone : C.inkHi)];
    for (let i = 0; i < 11; i++) {
      const sh = new THREE.Mesh(shardGeos[i % shardGeos.length], paper(cols[i % 3], { side: THREE.DoubleSide, transparent: true }));
      const a = Math.random() * Math.PI * 2, sp = 1.2 + Math.random() * 1.6;
      sh.position.set(x, 0.3, z); sh.rotation.set(Math.random() * 6, Math.random() * 6, 0);
      sh.userData = { v: new THREE.Vector3(Math.cos(a) * sp, 2 + Math.random() * 2.2, Math.sin(a) * sp), w: new THREE.Vector3(Math.random() * 8, Math.random() * 8, Math.random() * 8), life: 1.15 };
      fxG.add(sh); shards.push(sh);
    }
    const l = lightPool.find(l => !l.userData.busy); if (l) { l.userData.busy = true; l.position.set(x, 0.7, z); tween(0.5, k => { l.intensity = 2.4 * (1 - k); }, ease.out, () => { l.userData.busy = false; l.intensity = 0; }); }
    for (let i = 0; i < 14; i++) emitEmber(x, 0.3, z, 1);
  }
  function emitPuff(x, z) { for (let i = 0; i < 4; i++) emitEmber(x, 0.15, z, 0.35); }

  /* ---- public: hand ---- */
  function syncHand(list, sel, drawn) {
    // list: stones in hand; drawn: indices that are new (fall in from above)
    handG.clear(); hand = [];
    list.forEach((st, i) => {
      const g = makeStone(st.el, st.tier, 0); g.position.set(HAND_X[i], HAND_Y, HAND_Z); g.userData.hand = i; handG.add(g); hand.push(g);
      if (drawn && drawn.includes(i)) {
        const delay = drawn.length > 1 ? drawn.indexOf(i) * 0.18 : 0;
        g.userData.dropping = true; g.position.y = HAND_Y + 2.2; g.visible = delay === 0;
        tween(0.55 + delay, k => { const kk = Math.max(0, (k * (0.55 + delay) - delay) / 0.55); g.visible = kk > 0 || delay === 0; g.position.y = HAND_Y + (1 - ease.back(kk)) * 2.2; g.rotation.z = (1 - kk) * -0.4; }, t => t, () => { g.rotation.z = 0; g.userData.dropping = false; emitPuff(g.position.x, g.position.z); });
      }
    });
    setHandSel(sel);
  }
  function setHandSel(i) { handSel = i; }

  /* ---- public: preview and cursor ---- */
  function clearPreview() { previewG.clear(); }
  function showPreview(p, st, r, fx) {
    previewG.clear();
    if (p < 0) return;
    if (!r) return;
    if (!r.ok) { previewG.add(cross(px(p), pz(p), C.ember)); return; }
    for (let q = 0; q < NN; q++) { const a = r.s.scorch[q]; if (a && a.owner === 0 && (!fx.before.scorch[q] || fx.before.scorch[q].owner !== 0 || fx.before.scorch[q].left < a.left)) { const gl = new THREE.Mesh(glowGeo, new THREE.MeshBasicMaterial({ color: C.ember, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false })); gl.rotation.x = -Math.PI / 2; gl.position.set(px(q), 0.1, pz(q)); previewG.add(gl); } }
    for (const mv of fx.moved) { const c = r.s.board[mv.to]; previewG.add(arrow(px(mv.from), pz(mv.from), px(mv.to), pz(mv.to), C.water)); const gst = makeStone(c.el, c.tier, c.owner, true); gst.position.set(px(mv.to), 0, pz(mv.to)); previewG.add(gst); }
    for (const rm of fx.removed) { previewG.add(cross(px(rm.i), pz(rm.i), C.ember)); const ring = new THREE.Mesh(dangerGeo, new THREE.MeshBasicMaterial({ color: C.ember })); ring.rotation.x = Math.PI / 2; ring.position.set(px(rm.i), 0.2, pz(rm.i)); previewG.add(ring); }
    const ghost = makeStone(st.el, st.tier, 0, true); ghost.position.set(px(p), 0.02, pz(p)); previewG.add(ghost);
  }
  function cross(x, z, color) { const g = new THREE.Group(); for (const a of [Math.PI / 4, -Math.PI / 4]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.09), new THREE.MeshBasicMaterial({ color })); b.rotation.y = a; g.add(b); } g.position.set(x, 0.24, z); return g; }
  function arrow(x0, z0, x1, z1, color) {
    const g = new THREE.Group(), dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz), ang = Math.atan2(dx, dz);
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, len - 0.35), new THREE.MeshBasicMaterial({ color })); shaft.position.z = (len - 0.35) / 2; g.add(shaft);
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.3, 3), new THREE.MeshBasicMaterial({ color })); head.rotation.x = Math.PI / 2; head.position.z = len - 0.2; g.add(head);
    g.position.set(x0, 0.2, z0); g.rotation.y = ang; return g;
  }
  function showCursor(p) {
    if (cursorMesh) { marksG.remove(cursorMesh); cursorMesh = null; }
    if (p < 0) return;
    cursorMesh = new THREE.LineSegments(cursorGeo, new THREE.LineBasicMaterial({ color: C.bone })); cursorMesh.rotation.x = -Math.PI / 2; cursorMesh.position.set(px(p), 0.12, pz(p)); marksG.add(cursorMesh);
  }

  /* ---- public: picking ---- */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function pick(clientX, clientY) {
    const r = canvas.getBoundingClientRect(); ndc.set((clientX - r.left) / r.width * 2 - 1, -((clientY - r.top) / r.height * 2 - 1));
    ray.setFromCamera(ndc, camera);
    const hh = ray.intersectObjects(hand, true); if (hh.length) { let o = hh[0].object; while (o && o.userData.hand === undefined) o = o.parent; if (o) return { type: 'hand', i: o.userData.hand }; }
    const hb = ray.intersectObject(pickPlane); if (hb.length) { const pt = boardG.worldToLocal(hb[0].point.clone()); const x = Math.round(pt.x + 4), y = Math.round(pt.z + 4); if (x >= 0 && x < N && y >= 0 && y < N && Math.abs(pt.x + 4 - x) < 0.48 && Math.abs(pt.z + 4 - y) < 0.48) return { type: 'point', p: S.idx(x, y) }; }
    return null;
  }

  /* ---- public: sprites of stones for the HTML (hand labels, shop, log) ---- */
  const spriteCache = new Map();
  let spriteRig = null;
  function sprite(el, tier, owner, size = 96) {
    const key = `${el}${tier}${owner}${size}`; if (spriteCache.has(key)) return spriteCache.get(key);
    if (!spriteRig) {
      const cv = document.createElement('canvas'), rd = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, preserveDrawingBuffer: true }); rd.setPixelRatio(1); rd.toneMapping = THREE.ACESFilmicToneMapping; rd.toneMappingExposure = 1.1;
      const scn = new THREE.Scene(); scn.add(new THREE.HemisphereLight(0x9aa4bf, 0x07080c, 1.5)); const dl = new THREE.DirectionalLight(0xfff1e0, 2.0); dl.position.set(2, 4, 3); scn.add(dl);
      const cm = new THREE.PerspectiveCamera(30, 1, 0.1, 20); cm.position.set(0, 1.75, 1.55); cm.lookAt(0, 0.1, 0);
      spriteRig = { rd, scn, cm, cv };
    }
    const { rd, scn, cm, cv } = spriteRig; rd.setSize(size, size, false);
    const g = makeStone(el, tier, owner); scn.add(g); rd.render(scn, cm); scn.remove(g);
    const url = cv.toDataURL('image/png'); spriteCache.set(key, url); return url;
  }

  /* ---- camera moves ---- */
  function enterMatch() {
    const from = cam.far.clone(), to = cam.home.clone();
    tween(1.4, k => { camera.position.lerpVectors(from, to, k); camera.lookAt(cam.target); }, ease.inout);
  }
  function settleCamera() { camera.position.copy(cam.home); camera.lookAt(cam.target); }

  /* ---- loop ---- */
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
    for (let i = tweens.length - 1; i >= 0; i--) { const tw = tweens[i]; const k = Math.min(1, (t - tw.t0) / tw.dur); tw.fn(tw.easing(k)); if (k >= 1) { tweens.splice(i, 1); tw.done && tw.done(); } }
    for (const [, o] of scorches) { const f = 1 + 0.12 * Math.sin(t * 9 + o.phase) + 0.05 * Math.sin(t * 23 + o.phase * 2); o.flame.scale.set(0.5, 0.5 * f, 0.5); o.flame.rotation.y = 0.08 * Math.sin(t * 4 + o.phase); if (o.light) o.light.intensity = 0.95 + 0.35 * Math.sin(t * 13 + o.phase) + 0.15 * Math.random(); if (Math.random() < dt * 7) emitEmber(o.g.position.x, 0.25, o.g.position.z, 0.9); }
    for (const f of groundFlames) f.scale.y = 1 + 0.1 * Math.sin(t * 6 + f.userData.phase);
    for (let i = shards.length - 1; i >= 0; i--) { const sh = shards[i], u = sh.userData; u.life -= dt; if (u.life <= 0) { fxG.remove(sh); shards.splice(i, 1); continue; } u.v.y -= 9 * dt; sh.position.addScaledVector(u.v, dt); if (sh.position.y < -0.5) { sh.position.y = -0.5; u.v.set(0, 0, 0); u.w.set(0, 0, 0); } sh.rotation.x += u.w.x * dt; sh.rotation.y += u.w.y * dt; sh.rotation.z += u.w.z * dt; sh.material.opacity = Math.min(1, u.life * 2); }
    for (let i = 0; i < EMB; i++) { if (embLife[i] <= 0) continue; embLife[i] -= dt * 0.8; const k = i * 3; embPos[k] += embVel[k] * dt; embPos[k + 1] += embVel[k + 1] * dt; embPos[k + 2] += embVel[k + 2] * dt; const a = Math.max(0, embLife[i]); embCol[k] = a; embCol[k + 1] = 0.35 * a; embCol[k + 2] = 0.15 * a; if (embLife[i] <= 0) embPos[k + 1] = -50; }
    embGeo.attributes.position.needsUpdate = true; embGeo.attributes.color.needsUpdate = true;
    hand.forEach((g, i) => { if (g.userData.dropping) return; const on = i === handSel; const target = HAND_Y + (on ? 0.36 : 0) + 0.04 * Math.sin(t * 2.2 + i); g.position.y += (target - g.position.y) * Math.min(1, dt * 8); });
    for (const m of pulses) m.opacity = 0.55 + 0.45 * Math.sin(t * 5);
    placeHandLabels();
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  function resize() { const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  addEventListener('resize', resize); resize();
  requestAnimationFrame(frame);

  return { syncBoard, syncHand, setHandSel, setHandLabels, showPreview, clearPreview, showCursor, pick, sprite, enterMatch, settleCamera, camera, scene, renderer, C };

  /* ---- helpers ---- */
  function gridTexture() {
    const n = 1024, cv = document.createElement('canvas'); cv.width = cv.height = n; const g = cv.getContext('2d');
    const u = n / 9.7, o = (9.7 - 8) / 2 * u;
    g.strokeStyle = '#646a7c'; g.lineWidth = 3; g.lineCap = 'round';
    for (let i = 0; i < 9; i++) { const a = o + i * u; g.beginPath(); g.moveTo(o, a); g.lineTo(o + 8 * u, a); g.moveTo(a, o); g.lineTo(a, o + 8 * u); g.stroke(); }
    g.fillStyle = '#5a5f70'; for (const [x, y] of [[2, 2], [6, 2], [4, 4], [2, 6], [6, 6]]) { g.beginPath(); g.arc(o + x * u, o + y * u, 5, 0, 7); g.fill(); }
    g.fillStyle = '#9aa0b4'; g.font = '700 22px Cabin, "Segoe UI", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let i = 0; i < 9; i++) { g.fillText('ABCDEFGHJ'[i], o + i * u, o + 8 * u + 0.45 * u); g.fillText(String(9 - i), o - 0.48 * u, o + i * u); }
    const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 8; return tx;
  }
  function spriteTexture() {
    const cv = document.createElement('canvas'); cv.width = cv.height = 32; const g = cv.getContext('2d'); const r = g.createRadialGradient(16, 16, 0, 16, 16, 16); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.4, 'rgba(255,255,255,.6)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 32, 32);
    return new THREE.CanvasTexture(cv);
  }
  function flameMesh(scale) {
    const g = new THREE.Group();
    [C.fireLo, C.fire, C.fireHi].forEach((col, i) => { const m = extrude(SVG.flame[i], col, 0.12, scale); m.position.z = i * 0.13; g.add(m); });
    return g;
  }
  function deadTree(s) {
    const g = new THREE.Group(), mat = paper(0x000000);
    const trunk = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.4, 0.1), mat); trunk.position.y = 0.7; trunk.castShadow = true; g.add(trunk);
    for (const [y, a, l] of [[1.2, 0.9, 0.7], [1.0, -0.8, 0.8], [1.35, -0.4, 0.5], [0.85, 0.5, 0.45]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.1, l, 0.1), mat); b.position.set(Math.sin(a) * l / 2, y + Math.cos(a) * l / 2, 0); b.rotation.z = -a; b.castShadow = true; g.add(b); }
    g.scale.setScalar(s); return g;
  }
}
