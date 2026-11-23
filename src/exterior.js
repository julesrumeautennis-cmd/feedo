import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export function makeExterior(edge, end) {
  const exterior = new Group();
  exterior.name = 'Îlots urbains';
  const batches = new Map();
  function block(color, x, y, z, w, h, d) {
    const geometry = new BoxGeometry(w, h, d).translate(x, y, z);
    if (!batches.has(color)) batches.set(color, []);
    batches.get(color).push(geometry);
  }

  function building({ x, z, width, depth, levels, body, facing, windows }) {
    const base = -7;
    const story = 2.86;
    const height = levels * story;
    block(body, x, base + height / 2, z, width, height, depth);
    block(body, x, base + height + .27, z, width + .28, .54, depth + .28);
    const span = facing === 'x' ? depth : width;
    const step = span / windows;
    const facade = facing === 'x' ? x - width / 2 : z - depth / 2;
    const trim = '#919898';
    for (let row = 0; row < levels; row++) {
      const y = base + story * (row + .5);
      for (let col = 0; col < windows; col++) {
        const offset = step * (col + .5) - span / 2;
        const variation = (row * 11 + col * 7) % 13;
        const tint = variation < 2 ? '#b1af9c' : variation < 6 ? '#596d7a' : '#748a99';
        if (facing === 'x') block(tint, facade - .024, y, z + offset, .055, 1.69, step * .79);
        else block(tint, x + offset, y, facade - .024, step * .79, 1.69, .055);
      }
      if (facing === 'x') block(trim, facade - .085, y - 1.10, z, .18, .15, depth);
      else block(trim, x, y - 1.10, facade - .085, width, .15, .18);
    }
  }

  building({ x: edge + 13, z: -16, width: 9, depth: 13, levels: 8, body: '#9ea3a3', facing: 'x', windows: 8 });
  building({ x: edge + 15.5, z: -.9, width: 11, depth: 14, levels: 12, body: '#a4a9a7', facing: 'x', windows: 10 });
  building({ x: edge + 12, z: 15.4, width: 8, depth: 13, levels: 9, body: '#969d9e', facing: 'x', windows: 7 });
  building({ x: -8.3, z: end + 23, width: 16, depth: 10, levels: 10, body: '#adb1ac', facing: 'z', windows: 9 });
  building({ x: 9.2, z: end + 18, width: 16, depth: 9, levels: 12, body: '#939da0', facing: 'z', windows: 10 });
  block('#888d8d', 11, -6.32, 12, 68, .25, 90);

  for (const [color, geometries] of batches) {
    const geometry = mergeGeometries(geometries);
    for (const piece of geometries) piece.dispose();
    const facade = new Mesh(geometry, new MeshStandardMaterial({ color, roughness: .86 }));
    facade.name = 'Façades et fenêtres voisines';
    facade.userData.exterior = true;
    exterior.add(facade);
  }
  return exterior;
}
