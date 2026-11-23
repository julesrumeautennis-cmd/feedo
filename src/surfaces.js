import { DataTexture, LinearFilter, LinearMipmapLinearFilter, RepeatWrapping, SRGBColorSpace } from 'three';

const size = 256;

function hash(x, y) {
  const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

function noise(u, v, columns, rows = columns) {
  const x = u * columns;
  const y = v * rows;
  const i = Math.floor(x);
  const j = Math.floor(y);
  const smooth = x => x * x * (3 - 2 * x);
  const tx = smooth(x - i);
  const ty = smooth(y - j);
  const mix = (a, b, t) => a + (b - a) * t;
  return mix(
    mix(hash(i % columns, j % rows), hash((i + 1) % columns, j % rows), tx),
    mix(hash(i % columns, (j + 1) % rows), hash((i + 1) % columns, (j + 1) % rows), tx),
    ty,
  ) - .5;
}

function texture(name, base, sample) {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const offset = (y * size + x) * 4;
      const shade = sample(x / size, y / size) + (hash(x, y) - .5) * 5;
      for (let c = 0; c < 3; c++) data[offset + c] = Math.max(0, Math.min(255, base[c] + shade));
      data[offset + 3] = 255;
    }
  }
  const map = new DataTexture(data, size, size);
  map.name = name;
  map.colorSpace = SRGBColorSpace;
  map.wrapS = map.wrapT = RepeatWrapping;
  map.magFilter = LinearFilter;
  map.minFilter = LinearMipmapLinearFilter;
  map.generateMipmaps = true;
  map.needsUpdate = true;
  return map;
}

export function makeSurfaceMaps() {
  return {
    concrete: texture('Béton poli moucheté', [130, 126, 120], (u, v) =>
      18 * noise(u, v, 4) + 15 * noise(u, v, 13) + 13 * noise(u, v, 71) + (hash(u, v) > .978 ? -19 : 0)),
    maple: texture('Fil du bois clair', [202, 157, 103], (u, v) =>
      12 * noise(u, v, 3, 42) + 15 * noise(u, v, 5, 112) +
      6 * Math.sin(2 * Math.PI * (v * 34 + noise(u, v, 3, 8) * .4))),
    tile: texture('Carreaux satinés et joints fins', [204, 199, 189], (u, v) => {
      const dx = (u * 4) % 1;
      const dy = (v * 4) % 1;
      if (Math.min(dx, 1 - dx, dy, 1 - dy) < .016) return -26;
      return 16 * (hash(Math.floor(u * 4), Math.floor(v * 4)) - .5) + 6 * noise(u, v, 18);
    }),
    cladding: texture('Fil du parement anthracite', [48, 47, 45], (u, v) =>
      13 * noise(u, v, 4, 58) + 6 * noise(u, v, 8, 111)),
  };
}

export function mapBoxInMeters(geometry, metersPerRepeat) {
  const { position, normal, uv } = geometry.attributes;
  for (let i = 0; i < uv.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const top = Math.abs(normal.getY(i)) > .5;
    const side = Math.abs(normal.getX(i)) > .5;
    uv.setXY(i, (side ? z : x) / metersPerRepeat, (top ? z : y) / metersPerRepeat);
  }
}
