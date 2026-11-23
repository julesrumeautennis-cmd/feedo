import { mkdir, writeFile } from 'node:fs/promises';
import { PNG } from 'pngjs';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { makeRoom } from '../src/room.js';

globalThis.FileReader = class {
  async readAsArrayBuffer(blob) {
    this.result = await blob.arrayBuffer();
    this.onloadend();
  }
};

// The exporter uses a 2D canvas to encode procedural RGBA textures as PNG.
globalThis.ImageData = class {
  constructor(data, width, height) {
    this.data = data;
    this.width = width;
    this.height = height;
  }
};
globalThis.OffscreenCanvas = class {
  getContext() {
    return { putImageData: image => { this.image = image; } };
  }

  async convertToBlob() {
    const { data, width, height } = this.image;
    const png = PNG.sync.write({ data: Buffer.from(data), width, height });
    return new Blob([png], { type: 'image/png' });
  }
};

const glb = await new GLTFExporter().parseAsync(makeRoom(), { binary: true });
const publicDirectory = new URL('../public/', import.meta.url);
await mkdir(publicDirectory, { recursive: true });
await writeFile(new URL('salle.glb', publicDirectory), Buffer.from(glb));
