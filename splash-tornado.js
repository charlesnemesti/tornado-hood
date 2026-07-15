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
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
camera.position.set(0, 0.2, 5.8);
camera.lookAt(0, -0.1, 0);

const root = new THREE.Group();
scene.add(root);

scene.add(new THREE.AmbientLight(0xffffff, 0.35));
const key = new THREE.DirectionalLight(YELLOW, 1.4);
key.position.set(3, 4, 5);
const rim = new THREE.DirectionalLight(0x88aa00, 0.55);
rim.position.set(-3, -1, -2);
scene.add(key, rim);

function funnelRadius(t) {
  return 1.45 * Math.pow(1 - t, 1.28) + 0.05;
}

function makeShell(scale, opacity, emissive) {
  const pts = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    pts.push(new THREE.Vector2(funnelRadius(t) * scale, 1.65 - t * 3.35));
  }
  return new THREE.Mesh(
    new THREE.LatheGeometry(pts, 96),
    new THREE.MeshStandardMaterial({
      color: YELLOW,
      emissive: YELLOW,
      emissiveIntensity: emissive,
      metalness: 0.35,
      roughness: 0.4,
      transparent: true,
      opacity,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
}

root.add(makeShell(1.0, 0.22, 0.2));
root.add(makeShell(0.92, 0.12, 0.12));

function makeHelix(turns, tube, phase, opacity) {
  const pts = [];
  const segments = 180;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const y = 1.55 - t * 3.15;
    const r = funnelRadius(t) * 0.96;
    const a = t * Math.PI * 2 * turns + phase;
    pts.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  return new THREE.Mesh(
    new THREE.TubeGeometry(curve, segments, tube, 10, false),
    new THREE.MeshStandardMaterial({
      color: YELLOW,
      emissive: YELLOW,
      emissiveIntensity: 0.55,
      metalness: 0.25,
      roughness: 0.32,
      transparent: true,
      opacity,
    })
  );
}

root.add(makeHelix(2.4, 0.032, 0, 0.9));
root.add(makeHelix(2.4, 0.018, Math.PI, 0.4));

// Clean accent rings (few, intentional)
for (let i = 0; i < 5; i++) {
  const t = 0.08 + i * 0.18;
  const r = funnelRadius(t);
  const y = 1.65 - t * 3.35;
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(r, 0.012, 12, 96),
    new THREE.MeshBasicMaterial({
      color: YELLOW,
      transparent: true,
      opacity: 0.55 - i * 0.07,
    })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = y;
  root.add(ring);
}

// Sparse elegant orbit points — no additive sparkle soup
const COUNT = 48;
const positions = new Float32Array(COUNT * 3);
const seeds = new Float32Array(COUNT);
for (let i = 0; i < COUNT; i++) {
  seeds[i] = i / COUNT;
  positions[i * 3 + 1] = 0;
}
const pGeo = new THREE.BufferGeometry();
pGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
const particles = new THREE.Points(
  pGeo,
  new THREE.PointsMaterial({
    color: YELLOW,
    size: 0.035,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    sizeAttenuation: true,
  })
);
root.add(particles);

const tip = new THREE.Mesh(
  new THREE.SphereGeometry(0.055, 24, 24),
  new THREE.MeshStandardMaterial({
    color: YELLOW,
    emissive: YELLOW,
    emissiveIntensity: 0.8,
    metalness: 0.3,
    roughness: 0.25,
  })
);
tip.position.y = -1.72;
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

  root.rotation.y = t * 1.15;
  root.rotation.x = 0.08;

  const attr = pGeo.getAttribute("position");
  for (let i = 0; i < COUNT; i++) {
    const seed = seeds[i];
    const lift = (seed + t * 0.12) % 1;
    const y = 1.55 - lift * 3.15;
    const r = funnelRadius(lift) * 1.02;
    const a = seed * Math.PI * 2 + t * 1.4;
    attr.setXYZ(i, Math.cos(a) * r, y, Math.sin(a) * r);
  }
  attr.needsUpdate = true;

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
