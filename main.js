import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';

const params = new URLSearchParams(location.search);
if (params.has('emulate')) {
  try {
    const { XRDevice, metaQuest3 } = await import('https://esm.sh/iwer@2.8.0');
    const xrDevice = new XRDevice(metaQuest3);
    xrDevice.installRuntime({ forceInstall: true });
    xrDevice.primaryInputMode = 'hand';
    try { const { DevUI } = await import('https://esm.sh/@iwer/devui@2.8.0'); new DevUI(xrDevice); } catch (e) { console.warn(e); }
  } catch (e) { console.warn('IWER unavailable', e); }
}

const PRESETS = ['expressjs/express', 'pmndrs/zustand', 'fozagtx/repo-town'];
let repo = params.get('repo') || PRESETS[0];
document.getElementById('repo').value = repo;
document.getElementById('f').addEventListener('submit', e => {
  e.preventDefault(); const v = document.getElementById('repo').value.trim();
  if (/^[\w.-]+\/[\w.-]+$/.test(v)) { history.replaceState(null, '', `?repo=${v}`); buildTown(v); }
});

// ---------- Scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local');
document.body.appendChild(renderer.domElement);
document.body.appendChild(VRButton.createButton(renderer, { optionalFeatures: ['hand-tracking'] }));

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x10131c);
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.01, 50);
// Desktop preview camera (in VR the headset pose replaces this)
camera.position.set(0, 0.12, 0.32);
camera.lookAt(0, -0.3, -0.5);
scene.add(camera);
scene.add(new THREE.HemisphereLight(0xdde8ff, 0x302030, 1.6));
const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(0.5, 1, 0.3); scene.add(sun);

// Tray table: town sits 35 cm below and 50 cm in front of the head (seated reach)
const TABLE = new THREE.Vector3(0, -0.35, -0.5);
const SIZE = 0.5;
const table = new THREE.Group(); table.position.copy(TABLE); scene.add(table);
const base = new THREE.Mesh(new THREE.CylinderGeometry(SIZE * 0.75, SIZE * 0.78, 0.015, 64), new THREE.MeshStandardMaterial({ color: 0x232a3a, roughness: 0.9 }));
base.position.y = -0.008; table.add(base);
const town = new THREE.Group(); table.add(town);

// ---------- Panels (canvas text) ----------
function makePanel(w, h, px = 1024) {
  const c = document.createElement('canvas'); c.width = px; c.height = Math.round(px * h / w);
  const tex = new THREE.CanvasTexture(c);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
  return { c, ctx: c.getContext('2d'), tex, m };
}
const title = makePanel(0.5, 0.06);
title.m.position.set(0, -0.08, -0.62); title.m.rotation.x = -0.3; scene.add(title.m);
function drawTitle(a, b) {
  const { ctx, c } = title; ctx.clearRect(0, 0, c.width, c.height);
  ctx.textAlign = 'center'; ctx.fillStyle = '#eef1f8'; ctx.font = '600 52px system-ui'; ctx.fillText(a, c.width / 2, 58);
  ctx.fillStyle = '#9fd3ff'; ctx.font = '34px system-ui'; ctx.fillText(b, c.width / 2, 108); title.tex.needsUpdate = true;
}
const card = makePanel(0.3, 0.22, 900);
card.m.position.set(0.36, -0.15, -0.42); card.m.rotation.y = -0.6; card.m.visible = false; scene.add(card.m);
function drawCard(path, size, lines) {
  const { ctx, c } = card; ctx.clearRect(0, 0, c.width, c.height);
  ctx.fillStyle = 'rgba(16,19,28,.92)'; ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = '#f2b56b'; ctx.font = '600 34px system-ui'; ctx.fillText(path.length > 44 ? '…' + path.slice(-43) : path, 24, 52);
  ctx.fillStyle = '#9fd3ff'; ctx.font = '26px system-ui'; ctx.fillText(`${(size / 1024).toFixed(1)} KB`, 24, 90);
  ctx.fillStyle = '#dfe5f2'; ctx.font = '22px ui-monospace, Menlo, monospace';
  lines.slice(0, 20).forEach((l, i) => ctx.fillText(l.replace(/\t/g, '  ').slice(0, 64), 24, 132 + i * 27));
  card.tex.needsUpdate = true; card.m.visible = true;
}

// Preset signs: pinch to switch towns without leaving VR
const signs = PRESETS.map((p, i) => {
  const s = makePanel(0.16, 0.035, 512);
  s.ctx.fillStyle = '#1d2433'; s.ctx.fillRect(0, 0, 512, 112);
  s.ctx.fillStyle = '#eef1f8'; s.ctx.font = '600 40px system-ui'; s.ctx.textAlign = 'center'; s.ctx.fillText(p, 256, 70); s.tex.needsUpdate = true;
  s.m.position.set(-0.38, -0.12 - i * 0.05, -0.42); s.m.rotation.y = 0.6; s.m.userData.repo = p; scene.add(s.m);
  return s.m;
});

// ---------- Town building ----------
const EXT = { js: 0xf2d16b, ts: 0x78c4ff, tsx: 0x78c4ff, jsx: 0xf2d16b, md: 0xb9c3d6, json: 0x96e6a1, css: 0xe58fd8, html: 0xf29b6b, py: 0x6bb8f2, yml: 0xc9a3ff, yaml: 0xc9a3ff };
let buildings = [], selected = null;
const boxGeo = new THREE.BoxGeometry(1, 1, 1); boxGeo.translate(0, 0.5, 0);

async function buildTown(r) {
  repo = r; town.clear(); buildings = []; selected = null; card.m.visible = false;
  drawTitle(r, 'surveying the repo…');
  let tree;
  try {
    const res = await fetch(`https://api.github.com/repos/${r}/git/trees/HEAD?recursive=1`);
    if (!res.ok) throw new Error(res.status === 403 ? 'GitHub rate limit, try again in a minute' : `repo not found (${res.status})`);
    tree = (await res.json()).tree.filter(x => x.type === 'blob').slice(0, 1200);
  } catch (e) { drawTitle(r, String(e.message || e)); return; }

  // Districts = top-level folder (root files go in "/")
  const districts = new Map();
  for (const f of tree) { const d = f.path.includes('/') ? f.path.split('/')[0] : '/'; if (!districts.has(d)) districts.set(d, []); districts.get(d).push(f); }
  const ds = [...districts.entries()].sort((a, b) => b[1].length - a[1].length);
  const dCols = Math.ceil(Math.sqrt(ds.length));
  const dRows = Math.ceil(ds.length / dCols);
  const cell = (SIZE * 0.95) / dCols;
  ds.forEach(([name, files], di) => {
    const cx = (di % dCols - (dCols - 1) / 2) * cell, cz = (Math.floor(di / dCols) - (dRows - 1) / 2) * cell;
    const plot = new THREE.Mesh(new THREE.BoxGeometry(cell * 0.92, 0.003, cell * 0.92), new THREE.MeshStandardMaterial({ color: 0x2f384c }));
    plot.position.set(cx, 0.0015, cz); town.add(plot);
    const n = Math.ceil(Math.sqrt(files.length)), sub = (cell * 0.85) / n, w = sub * 0.78;
    files.forEach((f, fi) => {
      const h = 0.006 + Math.log10(1 + (f.size || 0)) * 0.012;
      const ext = f.path.split('.').pop().toLowerCase();
      const m = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({ color: EXT[ext] ?? 0x8a93a8, roughness: 0.6 }));
      m.scale.set(w, h, w);
      m.position.set(cx + (fi % n - (n - 1) / 2) * sub, 0.003, cz + (Math.floor(fi / n) - (n - 1) / 2) * sub);
      m.userData = { file: f, baseColor: m.material.color.getHex() };
      town.add(m); buildings.push(m);
    });
  });
  drawTitle(r, `${tree.length} files · ${ds.length} districts · pinch a building`);
}

async function select(b) {
  if (selected) selected.material.emissive.setHex(0x000000);
  selected = b; b.material.emissive.setHex(0x553311);
  const f = b.userData.file;
  drawCard(f.path, f.size || 0, ['loading…']);
  blip(660);
  try {
    if ((f.size || 0) > 400000) throw new Error('large file');
    const t = await (await fetch(`https://raw.githubusercontent.com/${repo}/HEAD/${f.path}`)).text();
    if (selected === b) drawCard(f.path, f.size || 0, t.split('\n'));
  } catch { if (selected === b) drawCard(f.path, f.size || 0, ['(binary or large file)']); }
}

// ---------- Audio ----------
let actx;
function blip(freq) {
  actx ??= new AudioContext();
  const o = actx.createOscillator(), g = actx.createGain(); o.frequency.value = freq;
  g.gain.setValueAtTime(0.08, actx.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + 0.25);
  o.connect(g).connect(actx.destination); o.start(); o.stop(actx.currentTime + 0.25);
}

// ---------- Picking ----------
const tmpBox = new THREE.Box3();
function buildingAt(p, pad = 0.008) {
  let best = null, bd = Infinity;
  for (const b of buildings) {
    tmpBox.setFromObject(b).expandByScalar(pad);
    if (tmpBox.containsPoint(p)) { const d = tmpBox.getCenter(new THREE.Vector3()).distanceTo(p); if (d < bd) { bd = d; best = b; } }
  }
  return best;
}
function signAt(p) {
  return signs.find(s => s.getWorldPosition(new THREE.Vector3()).distanceTo(p) < 0.06) || null;
}
function overTable(p) {
  const l = table.worldToLocal(p.clone());
  return Math.hypot(l.x, l.z) < SIZE * 0.8 && l.y > -0.05 && l.y < 0.2;
}

// ---------- Hands: pinch to open, pinch-drag ground to spin ----------
const hands = [0, 1].map(i => {
  const hand = renderer.xr.getHand(i); scene.add(hand);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.006, 12, 8), new THREE.MeshBasicMaterial({ color: 0x9fd3ff }));
  tip.visible = false; scene.add(tip);
  return { hand, tip, pinching: false, spin: null, point: new THREE.Vector3() };
});
function angleAt(p) { const l = p.clone().sub(TABLE); return Math.atan2(l.x, l.z); }

function pinchStart(h, p) {
  const s = signAt(p); if (s) { buildTown(s.userData.repo); blip(440); return; }
  const b = buildingAt(p); if (b) { select(b); return; }
  if (overTable(p)) h.spin = { a0: angleAt(p), r0: table.rotation.y };
}
function updateHands() {
  for (const h of hands) {
    const j = h.hand.joints, ti = j && j['index-finger-tip'], tt = j && j['thumb-tip'];
    if (!ti || !tt || !ti.visible) { h.tip.visible = false; h.pinching = false; h.spin = null; continue; }
    const a = ti.getWorldPosition(new THREE.Vector3()), b = tt.getWorldPosition(new THREE.Vector3());
    const d = a.distanceTo(b); h.point.copy(a).add(b).multiplyScalar(0.5);
    h.tip.visible = true; h.tip.position.copy(h.point);
    if (!h.pinching && d < 0.02) { h.pinching = true; pinchStart(h, h.point); }
    else if (h.pinching && d > 0.035) { h.pinching = false; h.spin = null; }
    if (h.spin) table.rotation.y = h.spin.r0 + (angleAt(h.point) - h.spin.a0);
    h.tip.material.color.set(h.pinching ? 0xf2b56b : 0x9fd3ff);
    // Hover: lift the building under the fingertip
    const hov = !h.pinching && buildingAt(a, 0.004);
    buildings.forEach(bb => { if (bb !== selected) bb.material.emissive.setHex(bb === hov ? 0x222222 : 0x000000); });
  }
}

// ---------- Mouse fallback ----------
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
let drag = null;
function rayFrom(e) { ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera); }
renderer.domElement.addEventListener('pointerdown', e => {
  rayFrom(e);
  const s = ray.intersectObjects(signs)[0]; if (s) { buildTown(s.object.userData.repo); return; }
  const b = ray.intersectObjects(buildings)[0]; if (b) { select(b.object); return; }
  drag = { x: e.clientX, r0: table.rotation.y };
});
renderer.domElement.addEventListener('pointermove', e => { if (drag) table.rotation.y = drag.r0 + (e.clientX - drag.x) * 0.01; });
addEventListener('pointerup', () => (drag = null));
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

buildTown(repo);
renderer.setAnimationLoop(() => { updateHands(); renderer.render(scene, camera); });
