import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";

const YELLOW = 0xccff00;
const wrap = document.querySelector(".th-tornado-wrap");
const canvas = document.getElementById("th-tornado-canvas");
if (!wrap || !canvas) throw new Error("tornado canvas missing");

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setClearColor(0x000000, 0);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
camera.position.set(0, 0.35, 5.4);
camera.lookAt(0, -0.15, 0);

const root = new THREE.Group();
scene.add(root);

const ambient = new THREE.AmbientLight(0x334411, 0.55);
const key = new THREE.PointLight(YELLOW, 2.4, 20);
key.position.set(2.2, 2.5, 3);
const fill = new THREE.PointLight(YELLOW, 0.9, 16);
fill.position.set(-2.5, -1.2, 2);
scene.add(ambient, key, fill);

function funnelRadius(t) {
  // t: 0 top -> 1 bottom
  return 1.55 * Math.pow(1 - t, 1.35) + 0.06;
}

function makeHelix(turns, tube, phase, opacity) {
  const pts = [];
  const segments = 220;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const y = 1.7 - t * 3.5;
    const r = funnelRadius(t);
    const a = t * Math.PI * 2 * turns + phase;
    pts.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const geo = new THREE.TubeGeometry(curve, segments, tube, 8, false);
  const mat = new THREE.MeshStandardMaterial({
    color: YELLOW,
    emissive: YELLOW,
    emissiveIntensity: 0.85,
    metalness: 0.2,
    roughness: 0.35,
    transparent: true,
    opacity,
  });
  return new THREE.Mesh(geo, mat);
}

root.add(makeHelix(3.2, 0.045, 0, 0.95));
root.add(makeHelix(3.2, 0.028, Math.PI * 0.7, 0.7));
root.add(makeHelix(2.6, 0.02, Math.PI * 1.3, 0.55));

// Outer translucent funnel shell
const shellPts = [];
for (let i = 0; i <= 28; i++) {
  const t = i / 28;
  shellPts.push(new THREE.Vector2(funnelRadius(t) * 1.05, 1.7 - t * 3.5));
}
const shell = new THREE.Mesh(
  new THREE.LatheGeometry(shellPts, 64),
  new THREE.MeshStandardMaterial({
    color: YELLOW,
    emissive: YELLOW,
    emissiveIntensity: 0.25,
    metalness: 0.1,
    roughness: 0.55,
    transparent: true,
    opacity: 0.14,
    side: THREE.DoubleSide,
  })
);
root.add(shell);

// Debris particles
const COUNT = 900;
const positions = new Float32Array(COUNT * 3);
const seeds = new Float32Array(COUNT);
for (let i = 0; i < COUNT; i++) {
  seeds[i] = Math.random();
  const t = Math.random();
  const y = 1.7 - t * 3.5;
  const r = funnelRadius(t) * (0.75 + Math.random() * 0.55);
  const a = Math.random() * Math.PI * 2;
  positions[i * 3] = Math.cos(a) * r;
  positions[i * 3 + 1] = y;
  positions[i * 3 + 2] = Math.sin(a) * r;
}
const pGeo = new THREE.BufferGeometry();
pGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
const particles = new THREE.Points(
  pGeo,
  new THREE.PointsMaterial({
    color: YELLOW,
    size: 0.045,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  })
);
root.add(particles);

// Tip glow sphere
const tip = new THREE.Mesh(
  new THREE.SphereGeometry(0.08, 16, 16),
  new THREE.MeshBasicMaterial({ color: YELLOW })
);
tip.position.y = -1.82;
root.add(tip);

function resize() {
  const w = wrap.clientWidth || 300;
  const h = wrap.clientHeight || 300;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
resize();
window.addEventListener("resize", resize);

let raf = 0;
let alive = true;
const clock = new THREE.Clock();

function animate() {
  if (!alive) return;
  raf = requestAnimationFrame(animate);
  const t = clock.getElapsedTime();

  // Rotate on its own vertical axis
  root.rotation.y = t * 1.85;
  root.rotation.x = Math.sin(t * 0.4) * 0.06;
  root.position.y = Math.sin(t * 1.2) * 0.05;

  // Swirl debris around the funnel
  const attr = pGeo.getAttribute("position");
  for (let i = 0; i < COUNT; i++) {
    const seed = seeds[i];
    const lift = ((t * (0.35 + seed * 0.55) + seed) % 1);
    const y = 1.7 - lift * 3.5;
    const r = funnelRadius(lift) * (0.8 + seed * 0.45);
    const a = seed * Math.PI * 2 + t * (2.8 + seed * 2.2);
    attr.setXYZ(i, Math.cos(a) * r, y, Math.sin(a) * r);
  }
  attr.needsUpdate = true;

  tip.scale.setScalar(1 + Math.sin(t * 6) * 0.18);
  renderer.render(scene, camera);
}
animate();

function dispose() {
  alive = false;
  cancelAnimationFrame(raf);
  window.removeEventListener("resize", resize);
  renderer.dispose();
  scene.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
      else obj.material.dispose();
    }
  });
}

const splash = document.getElementById("th-splash");
if (splash) {
  const obs = new MutationObserver(() => {
    if (splash.classList.contains("is-done")) {
      dispose();
      obs.disconnect();
    }
  });
  obs.observe(splash, { attributes: true, attributeFilter: ["class"] });
}

window.__thTornadoDispose = dispose;
