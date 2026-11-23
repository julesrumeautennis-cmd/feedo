import * as THREE from 'three';

const materials = new Map();
function material(color) {
  if (!materials.has(color)) materials.set(color, new THREE.MeshStandardMaterial({ color, roughness: .72 }));
  return materials.get(color);
}

const sphere = new THREE.SphereGeometry(1, 12, 9);
const block = new THREE.BoxGeometry(1, 1, 1);
const tube = new THREE.CylinderGeometry(1, 1, 1, 12);
function piece(parent, geometry, color, x, y, z, width, height, depth) {
  const mesh = new THREE.Mesh(geometry, material(color));
  mesh.position.set(x, y, z);
  mesh.scale.set(width, height, depth);
  parent.add(mesh);
  return mesh;
}

const uniforms = [
  { id: 'scout', name: 'Alma', hat: '#e5a04a', vest: '#d98d46', skin: '#aa7357' },
  { id: 'mentor', name: 'Noé', hat: '#507e8b', vest: '#3c6574', skin: '#ce9e79' },
  { id: 'auditor', name: 'Iris', hat: '#e3e8e5', vest: '#9189af', skin: '#895f4f' },
];

function nameplate(name, accent) {
  const canvas = document.createElement('canvas');
  canvas.width = 208;
  canvas.height = 65;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#1d2f32';
  ctx.fillRect(0, 0, 208, 65);
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, 10, 65);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#f5faf8';
  ctx.font = '600 44px system-ui, sans-serif';
  ctx.fillText(name, 107, 33);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map, toneMapped: false }));
  sprite.scale.set(.64, .20, 1);
  sprite.position.y = 1.91;
  return sprite;
}

function makeWorker(person) {
  const root = new THREE.Group();
  root.name = person.name;
  root.add(nameplate(person.name, person.hat));
  const shade = new THREE.Mesh(new THREE.CircleGeometry(1, 24), new THREE.MeshBasicMaterial({
    color: '#263235', transparent: true, opacity: .18, depthWrite: false,
  }));
  shade.rotation.x = -Math.PI / 2;
  shade.scale.set(.28, .16, 1);
  shade.position.y = .011;
  root.add(shade);
  const coat = '#25383d';
  const pants = '#34454c';
  const boots = '#273036';
  const silver = '#d8dfdf';
  const legs = [], arms = [];
  for (const side of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(side * .102, .84, 0);
    root.add(leg);
    piece(leg, tube, pants, 0, -.365, 0, .088, .71, .09);
    piece(leg, sphere, boots, 0, -.735, .047, .097, .086, .151);
    legs.push(leg);
    const arm = new THREE.Group();
    arm.position.set(side * .23, 1.315, 0);
    root.add(arm);
    piece(arm, sphere, coat, 0, -.155, 0, .079, .208, .08);
    piece(arm, tube, coat, 0, -.373, .018, .057, .232, .06);
    piece(arm, sphere, person.skin, 0, -.506, .022, .06, .076, .063);
    arms.push(arm);
  }
  piece(root, sphere, person.vest, 0, 1.1, 0, .249, .325, .146);
  piece(root, block, silver, 0, 1.12, .135, .38, .037, .018);
  piece(root, block, coat, 0, 1.20, .143, .017, .31, .017);
  const head = new THREE.Group();
  head.position.y = 1.45;
  root.add(head);
  piece(head, sphere, person.skin, 0, .066, 0, .132, .161, .12);
  piece(head, sphere, person.skin, 0, .071, .106, .036, .041, .035);
  piece(head, sphere, person.hat, 0, .172, -.002, .149, .108, .145);
  piece(head, tube, person.hat, 0, .147, .015, .158, .024, .164);
  for (const side of [-1, 1]) piece(head, sphere, boots, side * .047, .094, .105, .012, .012, .01);
  if (person.id === 'scout') {
    const light = piece(arms[1], tube, boots, 0, -.50, .09, .034, .155, .034);
    light.rotation.x = Math.PI / 2;
    piece(arms[1], sphere, silver, 0, -.505, .167, .032, .032, .015);
  } else if (person.id === 'auditor') {
    const pad = piece(arms[1], block, '#b2a48c', 0, -.46, .104, .18, .24, .025);
    pad.rotation.x = -.3;
  } else {
    piece(root, block, coat, .113, 1.23, .128, .067, .094, .026);
  }
  return { ...person, root, head, arms, legs, destination: new THREE.Vector3(), active: false };
}

// The cross-aisle is clear of desks. All destinations stay within it or its
// central corridor, including when the incident switches to the second fitting.
const stations = {
  scout: new THREE.Vector3(-1.75, 0, .12),
  mentor: new THREE.Vector3(.95, 0, -.36),
  auditor: new THREE.Vector3(.12, 0, 3.15),
};
export function makeCrew(scene) {
  const workers = uniforms.map(makeWorker);
  for (const worker of workers) {
    worker.root.position.copy(stations[worker.id]);
    scene.add(worker.root);
  }
  const target = new THREE.Vector3();
  let stage = 'observe';
  function assign(state, jointX) {
    stage = state.stage;
    target.set(jointX, 0, .05);
    for (const worker of workers) {
      worker.destination.copy(stations[worker.id]);
      worker.active = false;
    }
    const [scout, mentor, auditor] = workers;
    if (stage === 'complete') {
      auditor.destination.set(.28, 0, .68);
      return;
    }
    if (stage === 'observe' || stage === 'diagnose') {
      scout.active = true;
      scout.destination.set(jointX - .73, 0, .52);
      mentor.active = stage === 'diagnose';
    } else if (stage === 'repair') {
      mentor.active = true;
      mentor.destination.set(jointX + .76, 0, .40);
    } else if (stage === 'verify') {
      auditor.active = true;
      auditor.destination.set(jointX + .63, 0, .66);
    }
  }
  const delta = new THREE.Vector3();
  return {
    assign,
    animate(dt, time) {
      for (const [i, worker] of workers.entries()) {
        delta.subVectors(worker.destination, worker.root.position);
        delta.y = 0;
        const distance = delta.length();
        const walking = distance > .012;
        if (walking) worker.root.position.addScaledVector(delta, Math.min(dt * .88 / distance, 1));
        const faceX = walking ? delta.x : target.x - worker.root.position.x;
        const faceZ = walking ? delta.z : target.z - worker.root.position.z;
        const angle = Math.atan2(faceX, faceZ);
        const angleDelta = angle - worker.root.rotation.y;
        worker.root.rotation.y += Math.atan2(Math.sin(angleDelta), Math.cos(angleDelta)) * Math.min(dt * 9, 1);
        const stride = walking ? Math.sin(time * 9 + i) * .38 : 0;
        worker.legs[0].rotation.x = stride;
        worker.legs[1].rotation.x = -stride;
        worker.arms[0].rotation.x = -stride - .13;
        const gesture = worker.active ? (worker.id === 'auditor' ? .8 : 1.88) : .1;
        worker.arms[1].rotation.x += ((stride - gesture) - worker.arms[1].rotation.x) * Math.min(dt * 6, 1);
        worker.head.rotation.x = worker.active && stage !== 'complete' ? -.45 : -.06;
      }
    },
  };
}
