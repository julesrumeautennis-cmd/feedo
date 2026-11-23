import * as THREE from 'three';
import { makeCrew } from './crew.js';

const circuits = {
  A: { x: -.72, y: 3.02, z: -.18, color: '#659bc0' },
  B: { x: .14, y: 3.11, z: .26, color: '#d18c48' },
};
const steel = '#8d9696';
const gasket = new THREE.MeshStandardMaterial({ color: '#253b47', roughness: .68 });
const clampMaterial = new THREE.MeshStandardMaterial({ color: '#bdc8c6', metalness: .65, roughness: .31 });
const jointMetal = new THREE.MeshStandardMaterial({ color: '#708283', metalness: .5, roughness: .42 });
const repairMetal = new THREE.MeshStandardMaterial({ color: '#91b5a5', metalness: .55, roughness: .32 });

function cylinder(parent, mat, x, y, z, length, radius, axis = 'x') {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 16), mat);
  if (axis === 'x') mesh.rotation.z = Math.PI / 2;
  if (axis === 'z') mesh.rotation.x = Math.PI / 2;
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

function pipeLabel(letter) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#23383e';
  ctx.fillRect(0, 0, 128, 96);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 76px sans-serif';
  ctx.fillText(letter, 64, 50);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Sprite(new THREE.SpriteMaterial({ map, toneMapped: false }));
  mesh.scale.set(.28, .21, 1);
  return mesh;
}

function pipeRun(scene, id, data) {
  const {x,y,z} = data;
  const metal = new THREE.MeshStandardMaterial({ color: steel, roughness: .39, metalness: .49 });
  cylinder(scene, metal, -1.51, y, z, 8.72, .079);
  for (const position of [-4.30, -.26, 2.76]) {
    cylinder(scene, clampMaterial, position, y, z, .056, .092);
    cylinder(scene, clampMaterial, position, (3.46 + y) / 2, z, 3.46 - y, .012, 'y');
  }
  cylinder(scene, jointMetal, x, y, z, .31, .113);
  for (const offset of [-.127, .127]) cylinder(scene, clampMaterial, x + offset, y, z, .034, .136);
  cylinder(scene, gasket, x, y, z, .026, .117);
  // A visible return to the service ceiling terminates the fictional run.
  cylinder(scene, metal, 2.80, (y + 3.50) / 2, z, 3.50 - y, .079, 'y');
  const label = pipeLabel(id);
  label.position.set(x + .34, y - .12, z);
  scene.add(label);

  const patch = cylinder(scene, repairMetal, x, y, z, .246, .145);
  patch.visible = false;
  const valve = new THREE.Group();
  valve.position.set(x - .62, y - .10, z);
  const handle = new THREE.Mesh(new THREE.BoxGeometry(.25, .038, .049), gasket);
  handle.position.x = .075;
  valve.add(handle);
  scene.add(valve);
  return { metal, patch, label, valve };
}

function makeWetFloor(scene) {
  const outline = new THREE.Shape();
  for (let i = 0; i <= 96; i++) {
    const t = Math.PI * 2 * i / 96;
    const r = 1 + .13 * Math.sin(3*t + .4) + .09*Math.cos(5*t) + .041*Math.sin(9*t);
    const x = Math.cos(t)*r*.82;
    const y = Math.sin(t)*r*.50;
    if (i === 0) outline.moveTo(x, y); else outline.lineTo(x, y);
  }
  const pool = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.ShapeGeometry(outline), new THREE.MeshPhysicalMaterial({
    color: '#325f6a', metalness: .12, roughness: .24, envMapIntensity: .32, transparent: true, opacity: .64, depthWrite: false,
  }));
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = 2;
  pool.add(mesh);
  const ripples = Array.from({length: 3}, () => {
    const ripple = new THREE.Mesh(new THREE.RingGeometry(.95, 1, 48), new THREE.MeshBasicMaterial({
      color: '#b8dfe2', transparent: true, depthWrite: false,
    }));
    ripple.rotation.x = -Math.PI / 2;
    ripple.position.y = .007;
    ripple.renderOrder = 3;
    pool.add(ripple);
    return ripple;
  });
  scene.add(pool);
  return { pool, ripples };
}

function makeWater(scene) {
  const count = 26;
  // Instances share one draw call. The deterministic phases also keep the first
  // frame legible before a slow device has completed its next animation frame.
  const drops = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshStandardMaterial({
    color: '#61bfce', emissive: '#296f84', emissiveIntensity: .30,
    roughness: .18, metalness: .22, envMapIntensity: .38, transparent: true, opacity: .93,
  }), count);
  drops.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  drops.frustumCulled = false;
  scene.add(drops);
  const { pool, ripples } = makeWetFloor(scene);
  const temp = new THREE.Object3D();
  return function drawWater(active, joint, t, wetArea) {
    drops.visible = active;
    pool.position.set(joint.x, .022, joint.z);
    pool.scale.setScalar(wetArea);
    if (!active) {
      for (const ripple of ripples) ripple.visible = false;
      return;
    }
    for (let i = 0; i < count; i++) {
      const p = (i / count + t * (1.05 + .14 * (i % 3))) % 1;
      const spread = .006 + .055 * p;
      temp.position.set(joint.x + spread * Math.sin(i * 23.77),
        (joint.y - .11) * (1 - p*p), joint.z + spread * Math.cos(i * 5.34));
      temp.scale.set(.015 + .006 * (i % 3), .023 + .082*p, .021);
      temp.updateMatrix();
      drops.setMatrixAt(i, temp.matrix);
    }
    drops.instanceMatrix.needsUpdate = true;
    ripples.forEach((ripple, i) => {
      const p = (t * 1.24 + i / ripples.length) % 1;
      ripple.visible = true;
      ripple.scale.setScalar(.016 + .36*p);
      ripple.material.opacity = .64 * (1-p);
    });
  };
}

export function createIncident(scene) {
  const pipes = Object.fromEntries(Object.entries(circuits).map(([id, data]) => [id, pipeRun(scene, id, data)]));
  const drawWater = makeWater(scene);
  const crew = makeCrew(scene);
  let state, wetArea = .72;
  function setState(next) {
    if (!next || !(next.variant in circuits)) return;
    if (state?.variant !== next.variant) wetArea = .72;
    state = next;
    for (const [id, pipe] of Object.entries(pipes)) {
      pipe.metal.color.set(state.overlay ? circuits[id].color : steel);
      pipe.patch.visible = Boolean(state.repaired && id === state.variant);
      pipe.label.visible = Boolean(state.overlay);
      pipe.valve.rotation.y = state.isolated === id ? Math.PI / 2 : 0;
    }
    crew.assign(state, circuits[state.variant].x);
  }
  setState({ variant: 'A', stage: 'observe', leakActive: true });
  return {
    setState,
    cameraTarget(close, narrow) {
      const joint = circuits[state.variant];
      if (close) return {
        position: [joint.x - .3, 1.65, joint.z - (narrow ? 2.0 : 1.7)],
        aim: [joint.x, joint.y - .13, joint.z],
      };
      return { position: [.08, 1.65, narrow ? -5.9 : -4.5], aim: [-.29, 1.69, .04] };
    },
    animate(dt, time) {
      // The damp patch stays after isolating the branch. A dry-looking floor
      // alone is never proof that a pressure test has succeeded.
      const goal = state.leakActive ? 1.13 : .46;
      wetArea += (goal - wetArea) * (1 - Math.exp(-dt * .06));
      drawWater(state.leakActive, circuits[state.variant], time, wetArea);
      crew.animate(dt, time);
    },
  };
}
