import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { makeFloorReflection } from './floor-reflection.js';
import { room, screenPositions } from './room.js';
import { createIncident } from './leak/incident.js';
import { batchRoom } from './leak/static-room.js';
import './style.css';

const view = document.querySelector('#view');
const status = document.querySelector('#status');
const stations = document.querySelector('#stations');


const keys = new Set();
const movementKeys = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyZ', 'KeyQ',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
]);
const camera = new THREE.PerspectiveCamera(68, 1, .05, 78);
camera.rotation.order = 'YXZ';
const radius = .24;
const obstacles = [];
let redraw = true;

function goTo(x, z, yaw = 0, pitch = -.045) {
  camera.position.set(x, 1.65, z);
  camera.rotation.set(pitch, yaw, 0);
  redraw = true;
}

function canStand(x, z) {
  const halfWidth = room.width / 2;
  const inRoom = Math.abs(x) <= halfWidth - radius && Math.abs(z) <= room.depth / 2 - radius;
  const { recess } = room;
  const inRecess = x <= -halfWidth + radius && x >= -halfWidth - recess.depth + radius &&
    Math.abs(z - recess.z) <= recess.width / 2 - radius;
  if (!inRoom && !inRecess) return false;
  return obstacles.every(box => {
    const dx = x - THREE.MathUtils.clamp(x, box.min.x, box.max.x);
    const dz = z - THREE.MathUtils.clamp(z, box.min.z, box.max.z);
    return dx * dx + dz * dz >= radius * radius;
  });
}

async function start() {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.13;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#b8ccde');
  const pmrem = new THREE.PMREMGenerator(renderer);
  const indoor = new RoomEnvironment();
  scene.environment = pmrem.fromScene(indoor, .17).texture;
  scene.environmentIntensity = .27;
  indoor.dispose();
  pmrem.dispose();

  scene.add(new THREE.HemisphereLight('#d6e7ff', '#887664', .93));
  const daylight = new THREE.DirectionalLight('#dceaff', 1.45);
  daylight.position.set(9, 11.5, 3);
  daylight.castShadow = true;
  Object.assign(daylight.shadow.camera, {
    left: -23, right: 23, top: 21, bottom: -21, near: .1, far: 39,
  });
  daylight.shadow.mapSize.set(2048, 2048);
  daylight.shadow.normalBias = .026;
  daylight.shadow.bias = -.0002;
  daylight.shadow.radius = 2;
  scene.add(daylight);

  function glow(color, intensity, range, x, y, z) {
    const light = new THREE.PointLight(color, intensity, range);
    light.position.set(x, y, z);
    scene.add(light);
  }
  for (const z of screenPositions) {
    glow('#4639ff', 26, 9, 5.05, 2.6, z);
    glow('#ffe1aa', 14, 10, -.3, 3.12, z - .7);
  }
  glow('#ffe5bc', 14, 8, -4.65, 2.75, 9.1);
  glow('#edf4ff', 8, 7, -7, 2.72, .1);
  glow('#c9e6ff', 9, 7, -6.71, 2.75, 17.95);

  function resize() {
    const { clientWidth: width, clientHeight: height } = view;
    if (!width || !height) return;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.setSize(width, height);
    redraw = true;
  }

  const localModel = import.meta.env.BASE_URL + 'salle.glb';
  const modelUrl = import.meta.env.VITE_ROOM_MODEL_URL || localModel;
  const { scene: model } = await new GLTFLoader().loadAsync(modelUrl);
  model.updateMatrixWorld(true);
  model.traverse(node => {
    if (node.userData.collision) obstacles.push(new THREE.Box3().setFromObject(node));
    if (!node.isMesh || node.userData.exterior || node.material.transparent) return;
    node.receiveShadow = true;
    node.castShadow = Boolean(node.userData.collision) || /Pied|Tube|Montant de vitrage/.test(node.name);
    if (node.name.startsWith('Béton poli')) {
      node.material.bumpMap = node.material.map;
      node.material.bumpScale = .011;
    }
  });
  batchRoom(model);
  scene.add(model, makeFloorReflection(room.width, room.depth));
  const incident = createIncident(scene);
  const frameIncident = (close = false) => {
    const { position, aim } = incident.cameraTarget(close, view.clientWidth / Math.max(view.clientHeight, 1) < .95);
    camera.position.set(...position);
    camera.lookAt(...aim);
    redraw = true;
  };
  window.addEventListener('feedo:state', ({ detail }) => {
    incident.setState(detail);
    redraw = true;
  });
  window.addEventListener('feedo:focus', ({ detail }) => {
    frameIncident(detail !== 'overview' && detail?.mode !== 'overview');
  });
  renderer.shadowMap.needsUpdate = true;
  view.append(renderer.domElement);
  frameIncident();
  resize();
  new ResizeObserver(resize).observe(view);

  for (const [x, z, label, yaw, pitch] of room.stations) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.addEventListener('click', () => {
      goTo(x, z, yaw, pitch);
      view.focus({ preventScroll: true });
    });
    stations.append(button);
  }

  view.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return;
    view.focus({ preventScroll: true });
    view.setPointerCapture(event.pointerId);
  });
  view.addEventListener('pointermove', event => {
    if (!view.hasPointerCapture(event.pointerId)) return;
    redraw = true;
    camera.rotation.y -= event.movementX * .004;
    camera.rotation.x = THREE.MathUtils.clamp(camera.rotation.x - event.movementY * .004, -1.35, 1.35);
  });
  window.addEventListener('keydown', event => {
    if (!movementKeys.has(event.code) || event.altKey || event.metaKey || event.ctrlKey ||
        event.target.closest('button, input, textarea, select, [contenteditable]')) return;
    event.preventDefault();
    keys.add(event.code);
  });
  window.addEventListener('keyup', event => keys.delete(event.code));
  window.addEventListener('blur', () => keys.clear());

  let previous = performance.now();
  let elapsed = 0;
  const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
  renderer.setAnimationLoop(now => {
    if (document.hidden) { previous = now; return; }
    const interval = motionPreference.matches ? 100 : 1000 / 30;
    if (!redraw && now - previous < interval - 1) return;
    const dt = Math.min((now - previous) / 1000, .15);
    elapsed += dt;
    previous = now;
    const turn = Number(keys.has('ArrowLeft')) - Number(keys.has('ArrowRight'));
    camera.rotation.y += turn * dt * 1.7;
    const forward = Number(keys.has('KeyW') || keys.has('KeyZ') || keys.has('ArrowUp')) -
      Number(keys.has('KeyS') || keys.has('ArrowDown'));
    const strafe = Number(keys.has('KeyD')) - Number(keys.has('KeyQ') || keys.has('KeyA'));
    const { x, z } = camera.position;
    const yaw = camera.rotation.y;
    const step = dt * 2.65 / (Math.hypot(forward, strafe) || 1);
    const nextX = x + (strafe * Math.cos(yaw) - forward * Math.sin(yaw)) * step;
    const nextZ = z - (strafe * Math.sin(yaw) + forward * Math.cos(yaw)) * step;
    if (canStand(nextX, z)) camera.position.x = nextX;
    if (canStand(camera.position.x, nextZ)) camera.position.z = nextZ;
    incident.animate(dt, elapsed);
    renderer.render(scene, camera);
    redraw = false;
  });
  status.hidden = true;
  window.dispatchEvent(new Event('feedo:scene-ready'));
}

start().catch(error => {
  console.error(error);
  status.textContent = 'La salle 3D n’a pas pu se charger. Vérifiez que WebGL est disponible, puis rechargez la page.';
});
