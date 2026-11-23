import { Group, Mesh } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// The authored GLB keeps each chair leg and fitting as a named object. Once
// collision boxes are captured, opaque static surfaces can share draw calls.
export function batchRoom(model) {
  const groups = new Map();
  model.traverse(mesh => {
    if (!mesh.isMesh || mesh.children.length || mesh.isSkinnedMesh || Array.isArray(mesh.material) || mesh.material.transparent) return;
    const position = mesh.matrixWorld.elements;
    const band = Math.floor(position[14] / 10);
    const attributes = Object.keys(mesh.geometry.attributes).sort().join(',');
    const key = [mesh.material.uuid, band, Boolean(mesh.geometry.index), attributes, mesh.castShadow, mesh.receiveShadow].join(':');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(mesh);
  });

  const staticParts = new Group();
  staticParts.name = 'Surfaces statiques de la salle';
  for (const meshes of groups.values()) {
    if (meshes.length < 2) continue;
    const geometries = meshes.map(mesh => mesh.geometry.clone().applyMatrix4(mesh.matrixWorld));
    const geometry = mergeGeometries(geometries);
    for (const copy of geometries) copy.dispose();
    if (!geometry) continue;
    const mesh = new Mesh(geometry, meshes[0].material);
    mesh.castShadow = meshes[0].castShadow;
    mesh.receiveShadow = meshes[0].receiveShadow;
    for (const original of meshes) original.removeFromParent();
    staticParts.add(mesh);
  }
  model.add(staticParts);
}
