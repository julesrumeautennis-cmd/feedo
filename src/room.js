import { BoxGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { makeExterior } from './exterior.js';
import { makeSurfaceMaps, mapBoxInMeters } from './surfaces.js';

export const screenPositions = [-14.1, -5.45, 5.45, 14.1];

export const room = {
  width: 11.8,
  depth: 40,
  height: 4.75,
  recess: { depth: 3, width: 2.4, z: .1 },
  entrance: [0, -12.4, .07, .09],
  stations: [
    [0, -12.4, 'Entrée', .07, .09],
    [0, .85, 'Allée centrale', -2.46, .14],
    [-4.2, .65, 'Renfoncement', 1.57, .04],
    [0, 12.7, 'Fond vitré', Math.PI + .11, .09],
    [0, 5.15, 'Plaques suspendues', -.3, .72],
    [-.15, 9.2, 'Bars latéraux', 1.59, .11],
    [-3.7, 17.4, 'Porte vitrée', 1.73, .08],
  ],
};

const colors = {
  concrete: '#7d7b74', wall: '#c8c4bc', ceiling: '#8b8983',
  charcoal: '#24272d', rail: '#535b62', steel: '#898b85',
  glazing: '#a6c9df', whiteWall: '#edece6', blind: '#22242b',
  maple: '#c59354', chair: '#8e9eab', cabinet: '#3e3835',
  tile: '#c8c0b4', cladding: '#302f2d', glassDoor: '#c3dce1', green: '#386650', screen: '#180bde', lamp: '#fff1cc', whiteLamp: '#e1f2ff',
};
export function makeRoom() {
  const maps = makeSurfaceMaps();
  const metersPerRepeat = { concrete: 2.35, maple: 2.2, tile: 1.0, cladding: 1.1 };
  const glazingOpacity = { glazing: .23, glassDoor: .31 };
  const emissiveMaterials = new Set(['lamp', 'whiteLamp', 'screen']);
  const materials = Object.fromEntries(Object.entries(colors).map(([name, color]) => [
    name, new MeshStandardMaterial({
      color: maps[name] ? '#ffffff' : name === 'screen' ? '#020207' : color,
      map: maps[name] ?? null,
      roughness: glazingOpacity[name] ? .12 : ({ concrete: .38, maple: .47, tile: .33, steel: .36, chair: .57, screen: .98 }[name] ?? .81),
      metalness: name === 'steel' ? .62 : 0,
      transparent: name in glazingOpacity,
      opacity: glazingOpacity[name] ?? 1,
      emissive: emissiveMaterials.has(name) ? color : '#000000',
      emissiveIntensity: name === 'screen' ? 1.45 : 2.2,
    }),
  ]));

  const group = new Group();
  function piece(name, material, geometry, x, y, z, collision = false) {
    const mesh = new Mesh(geometry, materials[material]);
    mesh.name = name;
    mesh.position.set(x, y, z);
    if (collision) mesh.userData.collision = true;
    group.add(mesh);
    return mesh;
  }
  const geometryCache = new Map();
  function box(name, material, x, y, z, w, h, d, collision, bevel = 0) {
    const repeat = metersPerRepeat[material];
    const key = [w, h, d, repeat, bevel].join('/');
    if (!geometryCache.has(key)) {
      const geometry = bevel ? new RoundedBoxGeometry(w, h, d, 1, bevel) : new BoxGeometry(w, h, d);
      if (repeat) mapBoxInMeters(geometry, repeat);
      geometryCache.set(key, geometry);
    }
    return piece(name, material, geometryCache.get(key), x, y, z, collision);
  }
  function pipe(name, material, x, y, z, radius, length, axis = 'y') {
    const mesh = piece(name, material, new CylinderGeometry(radius, radius, length, 12), x, y, z);
    if (axis === 'z') mesh.rotation.x = Math.PI / 2;
    if (axis === 'x') mesh.rotation.z = Math.PI / 2;
    return mesh;
  }

  const { width, depth, height, recess } = room;
  const edge = width / 2;
  const end = depth / 2;
  const sideDoor = { start: end - 3.55, end: end - .55, height: 3 };
  group.add(makeExterior(edge, end));
  const floor = (x, z, w, d) => box('Béton poli', 'concrete', x, -.085, z, w, .17, d);
  const wall = (x, z, w, d, h = height) => box('Cloison', 'wall', x, h / 2, z, w, h, d);
  floor(0, 0, width, depth);
  floor(-edge - recess.depth / 2, recess.z, recess.depth, recess.width);
  box('Dalle haute', 'ceiling', 0, height + .09, 0, width, .18, depth);
  const openingStart = recess.z - recess.width / 2;
  const openingEnd = recess.z + recess.width / 2;
  wall(-edge, (-end + openingStart) / 2, .16, openingStart + end);
  wall(-edge, (openingEnd + sideDoor.start) / 2, .16, sideDoor.start - openingEnd);
  wall(-edge, (sideDoor.end + end) / 2, .16, end - sideDoor.end);
  box('Linteau du passage latéral', 'wall', -edge, (height + sideDoor.height) / 2,
    (sideDoor.start + sideDoor.end) / 2, .16, height - sideDoor.height, sideDoor.end - sideDoor.start);
  for (const z of [openingStart, openingEnd]) wall(-edge - recess.depth / 2, z, recess.depth, .14, 3.15);
  wall(-edge - recess.depth, recess.z, .18, recess.width, 3.15);
  box('Plafond du renfoncement', 'wall', -edge - 1.5, 3.13, recess.z, 3, .18, recess.width);
  box('Porte du renfoncement', 'rail', -edge - 2.87, 1.14, recess.z, .12, 2.28, 1.38);
  box('Poignée', 'steel', -edge - 2.79, 1.02, recess.z + .47, .13, .05, .16);
  box('Luminaire du renfoncement', 'lamp', -edge - 1.46, 3.02, recess.z, .96, .06, .09);

  wall(0, -end, width, .17);
  box('Parement anthracite d’entrée', 'cladding', -3.92, 1.61, -end + .11, 3.88, 3.22, .11);
  const entranceDoorX = -4.48;
  box('Porte d’entrée à un battant', 'glassDoor', entranceDoorX, 1.45, -end + .25, 1.34, 2.9, .07);
  for (const x of [entranceDoorX - .7, entranceDoorX + .7]) {
    box('Montant de la porte d’entrée', 'steel', x, 1.46, -end + .28, .055, 2.92, .08);
  }
  box('Linteau de la porte d’entrée', 'rail', entranceDoorX, 2.93, -end + .28, 1.45, .065, .08);
  box('Poignée de la porte d’entrée', 'steel', entranceDoorX + .48, 1.08, -end + .31, .065, .29, .11);
  box('Réfrigérateur près du bar d’entrée', 'steel', -2.66, 1.02, -end + .34, .93, 2.04, .56, true);

  wall(-5.64, end, .52, .17);
  wall(-.03, end, 1.26, .17);
  for (const [x, w] of [[-2.99, 4.78], [3.25, 5.29]]) {
    box('Grande baie vitrée du fond', 'glazing', x, 2.51, end, w, 4.48, .055);
    for (const ratio of [-.5, -1/6, 1/6, .5]) {
      box('Montant de la baie', 'rail', x + w * ratio, 2.51, end - .09, .06, 4.48, .09);
    }
    for (const y of [.29, 1.14, 2.75, 4.72]) box('Traverse de la baie', 'rail', x, y, end - .09, w, .06, .09);
    box('Allège de la baie', 'wall', x, .14, end - .07, w, .28, .14);
  }

  // Negative X is on the visitor's right when looking toward the glazed end.
  const doorZ = (sideDoor.start + sideDoor.end) / 2;
  const vestibuleDepth = 1.85;
  floor(-edge - vestibuleDepth / 2, doorZ, vestibuleDepth, 3);
  for (const z of [sideDoor.start, sideDoor.end]) wall(-edge - vestibuleDepth / 2, z, vestibuleDepth, .13, 3);
  box('Plafond du vestibule', 'wall', -edge - vestibuleDepth / 2, 3.06, doorZ, vestibuleDepth, .16, 3);
  box('Mur du vestibule', 'wall', -edge - vestibuleDepth, 1.5, doorZ, .13, 3, 3);
  box('Porte vitrée latérale', 'glassDoor', -edge + .035, 1.5, doorZ, .045, 3, 3);
  for (const z of [sideDoor.start, doorZ, sideDoor.end]) box('Montant du passage vitré', 'rail', -edge + .071, 1.5, z, .11, 3, .065);
  for (const y of [.04, 2.98]) box('Traverse du passage vitré', 'rail', -edge + .071, y, doorZ, .11, .07, 3);
  for (const z of [doorZ - .16, doorZ + .16]) box('Poignée inox du passage', 'steel', -edge + .13, 1.17, z, .1, .41, .045);
  box('Éclairage du vestibule', 'whiteLamp', -edge - .68, 2.95, doorZ, .058, .045, 2.45);

  const signY = 3.08;
  const signZ = -end + .36;
  box('Panneau EXIT', 'green', entranceDoorX, signY, signZ, .57, .22, .055);
  const letters = [
    [[0, -.065, 0, .065], [0, .065, .075, .065], [0, 0, .065, 0], [0, -.065, .075, -.065]],
    [[0, -.065, .08, .065], [.08, -.065, 0, .065]],
    [[.04, -.065, .04, .065]],
    [[0, .065, .08, .065], [.04, -.065, .04, .065]],
  ];
  for (const [i, strokes] of letters.entries()) {
    for (const [x1, y1, x2, y2] of strokes) {
      const letter = box('Lettrage EXIT', 'lamp', entranceDoorX - .232 + i * .126 + (x1 + x2) / 2,
        signY + (y1 + y2) / 2, signZ + .032, Math.hypot(x2 - x1, y2 - y1) + .015, .019, .008);
      letter.rotation.z = Math.atan2(y2 - y1, x2 - x1);
    }
  }

  box('Mur blanc côté entrée', 'whiteWall', edge, height / 2, -end / 2, .18, height, end);
  box('Plinthe du mur blanc', 'whiteWall', edge - .1, .07, -end / 2, .045, .14, end);
  box('Soubassement vitré', 'wall', edge, .24, end / 2, .18, .48, end);
  box('Vitrage latéral côté fond', 'glazing', edge + .02, 2.59, end / 2, .12, 4.25, end);
  for (let z = .05; z <= end; z += 1.38) {
    box('Montant de vitrage', 'rail', edge - .08, 2.58, z, .14, 4.26, .055);
    if (z + .2 < end) box('Liseré lumineux du vitrage', 'whiteLamp', edge - .17, 2.55, z + .105, .018, 4.06, .024);
  }
  for (const y of [.5, 1.32, 2.66, 3.87, 4.7]) box('Traverse de vitrage', 'rail', edge - .09, y, end / 2, .12, .055, end);
  box('Convecteur bas', 'wall', edge - .17, .2, end / 2, .33, .34, end);
  for (const z of screenPositions) {
    if (z > 0) box('Store sombre', 'blind', edge - .145, 2.65, z, .045, 3.31, 3.22);
    box('Cadre de projection', 'charcoal', edge - .23, 2.45, z, .095, 1.95, 2.82);
    box('Surface de projection bleue', 'screen', edge - .29, 2.43, z, .033, 1.73, 2.62);
    pipe('Enrouleur', 'wall', edge - .3, 3.49, z, .062, 2.96, 'z');
    for (const dz of [-1.08, 1.08]) {
      const speaker = box('Enceinte au-dessus de l’écran', 'wall', edge - .24, 3.78, z + dz, .24, .39, .23, false, .018);
      speaker.rotation.z = -.19;
      pipe('Grille de l’enceinte', 'rail', edge - .371, 3.74, z + dz, .075, .014, 'x');
    }
  }
  box('Estrade basse', 'wall', 5.24, .105, 2.94, 1.11, .21, 3.14, true);
  box('Pupitre', 'charcoal', 4.94, .68, 3.76, .44, .94, .48, true);

  box('Retombée transversale', 'wall', 0, 3.91, 0, width, 1.68, .72);
  box('Soffite latéral', 'wall', -5.14, 3.92, 0, 1.53, 1.66, depth);
  box('Soffite d’entrée', 'wall', 0, 3.99, -end + .63, width, 1.46, 1.26);
  function pier(z, width, x = -5.325, projection = 1.15) {
    box('Pilier anthracite', 'cladding', x, 1.55, z, projection, 3.1, width, true);
    for (let y = .27; y < 3.1; y += .28) {
      box('Joint du parement', 'charcoal', x + projection / 2 + .004, y, z, .008, .008, width);
    }
  }
  for (const z of [-16.4, -9.3, -3.9]) pier(z, .65);
  const recessPierEnd = openingEnd + .46;
  const divider = 8.86;
  const doorPierStart = sideDoor.start - .5;
  pier(openingEnd + .23, .46);
  pier(divider, .58);
  pier(sideDoor.start - .25, .5);
  function bar(name, groupX, groupZ, length, facing) {
    const at = (name, material, u, y, v, w, h, d, collision) => {
      if (facing === 'x') return box(name, material, groupX + v, y, groupZ + u, d, h, w, collision);
      return box(name, material, groupX + u, y, groupZ + v, w, h, d, collision);
    };
    at(name, 'cabinet', 0, .44, .35, length, .88, .69, true);
    at('Plan de travail', 'wall', 0, .91, .37, length, .07, .75);
    at('Plinthe en retrait', 'charcoal', 0, .07, .71, length, .14, .06);
    for (let u = -length / 2 + .57; u < length / 2 - .2; u += .57) {
      at('Joint de porte du meuble', 'charcoal', u, .48, .7, .012, .66, .008);
      at('Poignée de meuble', 'steel', u + .19, .74, .719, .13, .028, .036);
    }
    at('Crédence claire', 'tile', 0, 1.92, .03, length, 1.91, .055);
    for (const side of [-1, 1]) {
      const bank = side * length / 3.25;
      for (const shelf of [-.43, 0, .43]) at('Étagère ouverte', 'wall', bank, 2.03 + shelf, .23, length * .34, .042, .42);
      for (const fraction of [-.17, -.057, .057, .17]) {
        at('Montant de casier', 'wall', bank + length * fraction, 2.03, .24, .045, .87, .43);
      }
      at('Éclairage sous étagère', 'lamp', bank, 1.565, .29, length * .31, .018, .032);
      at('Machine à café', 'charcoal', side * length * .23, 1.16, .41, .34, .43, .32);
      at('Façade inox de la machine', 'steel', side * length * .23, 1.26, .575, .31, .2, .024);
      for (const offset of [-.24, -.12, 0, .12, .24]) {
        at('Tasse sur étagère', 'wall', bank + offset, 1.66, .29, .071, .071, .075);
      }
    }
    at('Évier inox', 'steel', 0, .955, .39, .56, .035, .38);
    at('Robinet', 'steel', .18, 1.08, .23, .035, .24, .035);
  }

  bar('Bar en face de la salle côté entrée', 1.87, -end + .11, 6.85, 'z');
  function sideBar(name, start, finish) {
    bar(name, -edge + .08, (start + finish) / 2, finish - start, 'x');
  }
  sideBar('Bar latéral près de la porte vitrée', divider + .29, doorPierStart);
  sideBar('Bar latéral avant le renfoncement', recessPierEnd, divider - .29);

  for (const x of [-3.05, -.25, 2.55, 4.42]) {
    for (const side of [-1, 1]) {
      pipe('Conduite au-dessus des plaques', 'steel', x + .31, 4.15, side * (end / 2), .105, end - 1.06, 'z');
      box('Rail porteur', 'rail', x, 3.67, side * (end / 2), .065, .075, end - 1.16);
    }
  }
  for (const side of [-1, 1]) {
    for (let row = 0; 1.35 + row * 1.82 < end - 1.15; row++) {
      const z = side * (1.35 + row * 1.82);
      for (const [i, x] of [-3.18, -.91, 1.35, 3.59].entries()) {
        const shade = ['wall', 'charcoal', 'ceiling'][(i * 2 + row + Number(side > 0)) % 3];
        box('Plaque acoustique suspendue', shade, x, 3.5, z, 2.01, .07, 1.57);
        for (const dx of [-.77, .77]) pipe('Suspente', 'rail', x + dx, 4.12, z, .009, 1.18);
      }
      for (const x of [-2.04, 2.49]) {
        if ((row + Number(x > 0)) % 2 === 0) box('Rampe lumineuse', 'lamp', x, 3.45, z, .055, .055, 1.86);
      }
    }
  }
  for (const z of screenPositions) {
    pipe('Support de projecteur', 'charcoal', 2.48, 3.28, z, .032, .66);
    box('Projecteur', 'charcoal', 2.48, 2.89, z, .46, .22, .58);
    pipe('Lentille', 'screen', 2.74, 2.9, z, .072, .12, 'x');
  }

  function table(x, z) {
    box('Plateau en bois clair', 'maple', x, .755, z, 2.22, .055, .91, true, .018);
    box('Chant du plateau', 'charcoal', x, .715, z, 2.2, .038, .9);
    for (const dx of [-.91, .91]) {
      for (const dz of [-.33, .33]) pipe('Pied de table', 'charcoal', x + dx, .35, z + dz, .025, .7);
    }
    for (const dx of [-.55, .55]) {
      for (const side of [-1, 1]) {
        const cx = x + dx;
        const cz = z + side * .73;
        box('Assise grise', 'chair', cx, .444, cz, .45, .07, .43, true, .033);
        const back = box('Dossier gris', 'chair', cx, .68, cz + side * .19, .438, .29, .048, true, .023);
        back.rotation.x = side * .11;
        for (const lx of [-.166, .166]) {
          for (const lz of [-.145, .145]) pipe('Tube de chaise', 'rail', cx + lx, .213, cz + lz, .014, .425);
        }
      }
    }
  }
  for (const z of [-16.45, -13.57, -10.69, -7.81, -4.93, -2.05, 1.88, 4.76, 7.64, 10.52, 13.4, 16.28]) {
    table(-2.67, z);
    table(2.45, z + .14);
  }
  return group;
}
