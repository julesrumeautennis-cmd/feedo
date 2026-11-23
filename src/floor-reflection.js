import { PlaneGeometry } from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';

export function makeFloorReflection(width, depth) {
  const floor = new Reflector(new PlaneGeometry(width, depth), {
    textureWidth: 768,
    textureHeight: 512,
    multisample: 0,
    clipBias: .002,
    shader: {
      uniforms: Reflector.ReflectorShader.uniforms,
      vertexShader: /* glsl */`
        uniform mat4 textureMatrix;
        varying vec4 reflectedUV;
        varying vec3 worldPosition;

        void main() {
          reflectedUV = textureMatrix * vec4(position, 1.0);
          worldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */`
        uniform sampler2D tDiffuse;
        varying vec4 reflectedUV;
        varying vec3 worldPosition;

        void main() {
          vec2 uv = reflectedUV.xy / reflectedUV.w;
          vec3 reflected = texture2D(tDiffuse, uv).rgb * .36;
          reflected += texture2D(tDiffuse, uv + vec2(.0039, .004)).rgb * .16;
          reflected += texture2D(tDiffuse, uv + vec2(.0039, -.004)).rgb * .16;
          reflected += texture2D(tDiffuse, uv + vec2(-.0039, .004)).rgb * .16;
          reflected += texture2D(tDiffuse, uv + vec2(-.0039, -.004)).rgb * .16;
          float grazing = 1.0 - abs(normalize(cameraPosition - worldPosition).y);
          float strength = .04 + .22 * pow(grazing, 2.0);
          gl_FragColor = vec4(reflected, strength);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    },
  });

  floor.name = 'Reflets du béton poli';
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = .004;
  floor.material.transparent = true;
  floor.material.depthWrite = false;
  floor.renderOrder = -1;
  return floor;
}
