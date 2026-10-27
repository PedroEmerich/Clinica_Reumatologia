/* ==========================================================================
   Creass — coluna vertebral 3D do hero
   A coluna começa comprimida (discos inflamados, desalinhamento, tremor) e
   descomprime conforme a rolagem: os discos recuperam altura e a tensão some.

   Fonte: src/spine.js · gere assets/js/spine.js com `npm run build`.
   ========================================================================== */
import {
  BackSide,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CatmullRomCurve3,
  Color,
  DirectionalLight,
  DoubleSide,
  Group,
  HemisphereLight,
  LineBasicMaterial,
  LineLoop,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  NeutralToneMapping,
  PCFShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  PointLight,
  RepeatWrapping,
  Scene,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  TubeGeometry,
  Vector3,
  WebGLRenderer
} from 'three';

const clamp = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// Segmento T12–L5: escala de cada vértebra (as lombares crescem para baixo)
const SCALE = [0.86, 0.9, 0.94, 0.98, 1.02, 1.06];
// Discos de cima para baixo: T11–T12 … L5–S1. Tensão relativa de cada nível
const DISC_LOAD = [0.28, 0.4, 0.52, 0.64, 0.82, 1, 0.72];
const BODY_H = 0.72;
const GAP = { tight: 0.07, free: 0.27 };

function ready(fn) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once: true });
  else fn();
}

/* ---------- Geometria ---------- */

// Contorno do corpo vertebral visto de cima: "rim", com a borda posterior (-z) côncava
function kidney(t, a, b, c) {
  const s = Math.sin(t);
  const x = a * Math.cos(t);
  let z = b * s;
  if (s < 0) z *= 1 - c * Math.pow(s, 8);
  return [x, z];
}

// Superfície fechada: perfil (raio relativo, altura) girado ao longo do contorno em rim
function kidneyLathe({ a, b, c = 0.3, profile, rings = 32, segments = 64 }) {
  const pos = [];
  const uv = [];
  const idx = [];
  for (let k = 0; k <= rings; k++) {
    const theta = Math.PI / 2 - (Math.PI * k) / rings;
    const [r, y] = profile(theta);
    for (let j = 0; j < segments; j++) {
      const [x, z] = kidney((j / segments) * Math.PI * 2, a, b, c);
      pos.push(x * r, y, z * r);
      uv.push(j / segments, k / rings);
    }
  }
  for (let k = 0; k < rings; k++) {
    for (let j = 0; j < segments; j++) {
      const j2 = (j + 1) % segments;
      const p1 = k * segments + j;
      const p2 = k * segments + j2;
      const p3 = (k + 1) * segments + j;
      const p4 = (k + 1) * segments + j2;
      idx.push(p1, p2, p3, p2, p4, p3);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// Perfil de caixa arredondada (superelipse) com cintura, borda saliente (anel apofisário)
// e placas terminais levemente côncavas
const roundedProfile = (n, h, waist, cup, lip = 0) => theta => {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  let r = Math.pow(Math.abs(c), 2 / n);
  let y = Math.sign(s) * Math.pow(Math.abs(s), 2 / n) * (h / 2);
  const edge = Math.abs(y) / (h / 2);
  r *= 1 - waist * (1 - edge * edge);
  r *= 1 + lip * Math.exp(-Math.pow((1 - edge) / 0.12, 2));
  y -= Math.sign(y) * cup * (1 - r * r);
  return [Math.max(r, 0.0001), y];
};

// Processo ósseo: superelipsoide (caixa de cantos suaves) ao longo de +y, da base (0) à ponta (len).
// w = espessura em x, d = largura em z; `taper` ajusta a seção conforme o avanço (0 → 1).
function process(len, w, d, { e = 0.42, taper = () => [1, 1], rings = 22, segments = 28 } = {}) {
  const sp = (v, p) => Math.sign(v) * Math.pow(Math.abs(v), p);
  const pos = [];
  const uv = [];
  const idx = [];
  for (let k = 0; k <= rings; k++) {
    const u = Math.PI / 2 - (Math.PI * k) / rings;
    const cu = sp(Math.cos(u), e);
    const y = (sp(Math.sin(u), e) + 1) * 0.5 * len;
    const [tx, tz] = taper(y / len);
    for (let j = 0; j < segments; j++) {
      const v = (j / segments) * Math.PI * 2;
      pos.push((w / 2) * cu * sp(Math.cos(v), e) * tx, y, (d / 2) * cu * sp(Math.sin(v), e) * tz);
      uv.push(j / segments, k / rings);
    }
  }
  for (let k = 0; k < rings; k++) {
    for (let j = 0; j < segments; j++) {
      const j2 = (j + 1) % segments;
      const p1 = k * segments + j;
      const p2 = k * segments + j2;
      const p3 = (k + 1) * segments + j;
      const p4 = (k + 1) * segments + j2;
      idx.push(p1, p2, p3, p2, p4, p3);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function merge(geometries) {
  let vertices = 0;
  let indices = 0;
  geometries.forEach(g => {
    vertices += g.attributes.position.count;
    indices += g.index.count;
  });
  const pos = new Float32Array(vertices * 3);
  const nor = new Float32Array(vertices * 3);
  const uv = new Float32Array(vertices * 2);
  const idx = new Uint32Array(indices);
  let vo = 0;
  let io = 0;
  geometries.forEach(g => {
    pos.set(g.attributes.position.array, vo * 3);
    nor.set(g.attributes.normal.array, vo * 3);
    uv.set(g.attributes.uv.array, vo * 2);
    const src = g.index.array;
    for (let i = 0; i < src.length; i++) idx[io + i] = src[i] + vo;
    vo += g.attributes.position.count;
    io += src.length;
    g.dispose();
  });
  const out = new BufferGeometry();
  out.setAttribute('position', new BufferAttribute(pos, 3));
  out.setAttribute('normal', new BufferAttribute(nor, 3));
  out.setAttribute('uv', new BufferAttribute(uv, 2));
  out.setIndex(new BufferAttribute(idx, 1));
  return out;
}

// Vértebra lombar simplificada: corpo, arco (pedículos + lâminas), processos espinhoso,
// transversos e articulares. Origem no centro do corpo; +z anterior, -z posterior.
function vertebraGeometry() {
  const parts = [];
  parts.push(kidneyLathe({ a: 0.62, b: 0.45, c: 0.3, profile: roundedProfile(7, BODY_H, 0.1, 0.03, 0.025), rings: 40, segments: 72 }));

  const yA = 0.1;
  const arch = new TubeGeometry(
    new CatmullRomCurve3([
      new Vector3(0.3, 0, -0.2),
      new Vector3(0.35, 0, -0.5),
      new Vector3(0.31, 0, -0.76),
      new Vector3(0.17, 0, -0.97),
      new Vector3(0, 0, -1.04),
      new Vector3(-0.17, 0, -0.97),
      new Vector3(-0.31, 0, -0.76),
      new Vector3(-0.35, 0, -0.5),
      new Vector3(-0.3, 0, -0.2)
    ], false, 'centripetal'),
    80, 0.085, 14, false
  );
  arch.scale(1, 2.1, 1);
  arch.translate(0, yA, 0);
  parts.push(arch);

  // Processo espinhoso em "machadinha": lâmina fina que se alarga na ponta, para trás e um pouco para baixo
  const spinous = process(0.86, 0.12, 0.36, { e: 0.4, taper: t => [lerp(1, 0.82, t), lerp(0.6, 1.12, t)] });
  spinous.rotateX(-Math.PI / 2 - 0.22);
  spinous.translate(0, yA - 0.02, -0.96);
  parts.push(spinous);

  [1, -1].forEach(side => {
    // Processos transversos: longos, finos de frente para trás, levemente para cima e para trás
    const transverse = process(0.8, 0.13, 0.07, { e: 0.5, taper: t => [lerp(1, 0.7, t), lerp(1, 0.75, t)] });
    transverse.rotateZ(side * (-Math.PI / 2 + 0.1));
    transverse.rotateY(side * 0.32);
    transverse.translate(side * 0.3, yA + 0.02, -0.74);
    parts.push(transverse);

    // Processos articulares (facetas) superiores e inferiores
    const superior = process(0.38, 0.1, 0.16, { e: 0.45, taper: t => [1, lerp(1, 0.78, t)] });
    superior.rotateZ(side * -0.22);
    superior.rotateX(-0.25);
    superior.translate(side * 0.27, yA + 0.06, -0.8);
    parts.push(superior);

    const inferior = process(0.46, 0.1, 0.14, { e: 0.45, taper: t => [1, lerp(1, 0.8, t)] });
    inferior.rotateX(Math.PI - 0.15);
    inferior.rotateZ(side * 0.1);
    inferior.translate(side * 0.2, yA - 0.06, -0.93);
    parts.push(inferior);
  });

  return merge(parts);
}

const discGeometry = () =>
  kidneyLathe({
    a: 0.6,
    b: 0.43,
    c: 0.3,
    rings: 22,
    segments: 64,
    profile: theta => {
      const c = Math.cos(theta);
      const s = Math.sin(theta);
      const r = Math.pow(Math.abs(c), 2 / 3.2);
      const y = Math.sign(s) * Math.pow(Math.abs(s), 2 / 3.2) * 0.5;
      return [Math.max(r * (1 + 0.04 * (1 - 4 * y * y)), 0.0001), y];
    }
  });

function kidneyOutline(a, b, c, n = 72) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const [x, z] = kidney((i / n) * Math.PI * 2, a, b, c);
    pts.push(x, 0, z);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pts), 3));
  return g;
}

/* ---------- Texturas procedurais ---------- */

// Ruído suave e repetível para a porosidade do osso (relevo + rugosidade)
function boneTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const octaves = [[8, 0.45], [16, 0.25], [32, 0.16], [64, 0.1]].map(([n, amp]) => {
    const grid = new Float32Array(n * n);
    for (let i = 0; i < grid.length; i++) grid[i] = Math.random();
    return { n, amp, grid };
  });
  const sample = ({ n, grid }, u, v) => {
    const x = u * n;
    const y = v * n;
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const at = (i, j) => grid[((j % n) + n) % n * n + (((i % n) + n) % n)];
    return lerp(lerp(at(x0, y0), at(x0 + 1, y0), sx), lerp(at(x0, y0 + 1), at(x0 + 1, y0 + 1), sx), sy);
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let v = 0;
      octaves.forEach(o => { v += sample(o, x / size, y / size) * o.amp; });
      if (Math.random() < 0.012) v -= 0.25;
      const c = clamp(0.5 + (v - 0.48) * 1.4) * 255;
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = c;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.repeat.set(2, 2);
  return tex;
}

function glowTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(206, 24, 36, 1)');
  g.addColorStop(0.35, 'rgba(190, 22, 34, .5)');
  g.addColorStop(0.7, 'rgba(179, 18, 29, .12)');
  g.addColorStop(1, 'rgba(179, 18, 29, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

// Estúdio fotográfico mínimo para os reflexos (equivalente leve ao RoomEnvironment)
function studioEnvironment(renderer) {
  const env = new Scene();
  env.add(new Mesh(new SphereGeometry(12, 32, 16), new MeshBasicMaterial({ color: 0xb9b0aa, side: BackSide })));
  const panel = (w, h, color, power, position) => {
    const mesh = new Mesh(
      new PlaneGeometry(w, h),
      new MeshBasicMaterial({ color: new Color(color).multiplyScalar(power), side: DoubleSide })
    );
    mesh.position.set(...position);
    mesh.lookAt(0, 0, 0);
    env.add(mesh);
  };
  panel(7, 5, 0xffffff, 3.2, [-5, 6, 5]);
  panel(4, 7, 0xffece4, 2, [7, 2, -4]);
  panel(9, 2.5, 0xfff8f2, 1.1, [0, -7, 3]);
  const pmrem = new PMREMGenerator(renderer);
  const texture = pmrem.fromScene(env, 0.04).texture;
  pmrem.dispose();
  return texture;
}

/* ---------- Cena ---------- */

export function createScene(canvas, small, force = false) {
  // Sem GPU de verdade (renderização por software) a cena não é criada e fica a imagem estática
  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
    failIfMajorPerformanceCaveat: !force
  });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = NeutralToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;

  const scene = new Scene();
  scene.environment = studioEnvironment(renderer);
  scene.environmentIntensity = 0.45;

  const camera = new PerspectiveCamera(24, 1, 0.5, 60);

  scene.add(new HemisphereLight(0xfffaf5, 0xcbbfb7, 0.5));
  const key = new DirectionalLight(0xfff3ea, 2.8);
  key.position.set(-4.5, 7, 6);
  key.castShadow = true;
  key.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048);
  Object.assign(key.shadow.camera, { left: -3.6, right: 3.6, top: 4.4, bottom: -4.4, near: 1, far: 22 });
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  key.shadow.radius = 4;
  scene.add(key);
  const rim = new DirectionalLight(0xffe2da, 2.1);
  rim.position.set(5, 2.5, -6);
  scene.add(rim);

  const bone = boneTexture();
  const boneMat = new MeshPhysicalMaterial({
    color: 0xe8dfcf,
    roughness: 0.68,
    roughnessMap: bone,
    bumpMap: bone,
    bumpScale: 1.4,
    metalness: 0,
    sheen: 0.35,
    sheenRoughness: 0.7,
    sheenColor: new Color(0xfff0e6),
    clearcoat: 0.16,
    clearcoatRoughness: 0.6,
    specularIntensity: 0.45
  });

  const spine = new Group();
  scene.add(spine);
  // Pivô no centro de massa (entre os corpos e os processos posteriores)
  const column = new Group();
  column.position.z = 0.5;
  spine.add(column);

  const vGeo = vertebraGeometry();
  const vertebrae = SCALE.map(s => {
    const mesh = new Mesh(vGeo, boneMat);
    mesh.scale.setScalar(s);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    column.add(mesh);
    return mesh;
  });

  const dGeo = discGeometry();
  const outline = kidneyOutline(0.6, 0.43, 0.3);
  const glow = glowTexture();
  const healthy = new Color(0xebe1dc);
  const inflamed = new Color(0xc94c48);
  const discs = DISC_LOAD.map(() => {
    const material = new MeshPhysicalMaterial({
      color: healthy.clone(),
      roughness: 0.3,
      metalness: 0,
      sheen: 0.5,
      sheenColor: new Color(0xffe5df),
      clearcoat: 0.55,
      clearcoatRoughness: 0.3,
      emissive: new Color(0xc0141f),
      emissiveIntensity: 0
    });
    const mesh = new Mesh(dGeo, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    column.add(mesh);

    const ring = new LineLoop(outline, new LineBasicMaterial({ color: 0xb3121d, transparent: true, opacity: 0, depthWrite: false }));
    column.add(ring);

    const halo = new Sprite(new SpriteMaterial({ map: glow, transparent: true, opacity: 0, depthWrite: false }));
    column.add(halo);
    return { mesh, material, ring, halo };
  });

  const ache = new PointLight(0xff2b2b, 0, 3.4, 2);
  column.add(ache);

  const tmp = new Vector3();
  const stage = { width: 1, height: 1, distance: 14 };
  let pixelCap = small ? 1.5 : 2;

  function resize(width, height) {
    stage.width = Math.max(1, width);
    stage.height = Math.max(1, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, pixelCap));
    renderer.setSize(stage.width, stage.height, false);
    camera.aspect = stage.width / stage.height;
    // Enquadra a coluna já descomprimida (mais alta) com folga para as etiquetas
    const t = Math.tan((camera.fov * Math.PI) / 360);
    stage.distance = Math.max(3.75 / t, 2.15 / (t * camera.aspect));
    camera.position.set(0, 0.9, stage.distance);
    camera.lookAt(0, 0.05, 0);
    camera.updateProjectionMatrix();
  }

  // Posiciona vértebras e discos para um nível de alívio e (0 = comprimida, 1 = livre)
  function pose(e, time, motion) {
    const relief = clamp(e);
    const strain = 1 - relief;
    const breathe = motion ? 1 + 0.025 * relief * Math.sin(time * 0.9) : 1;
    const gaps = DISC_LOAD.map((_, j) => lerp(GAP.tight, GAP.free, relief) * breathe * SCALE[Math.min(j, SCALE.length - 1)]);

    // Pilha de cima para baixo: disco 0, vértebra 0, disco 1, …, vértebra 5, disco 6
    let total = 0;
    gaps.forEach(g => { total += g; });
    SCALE.forEach(s => { total += BODY_H * s; });
    let y = total / 2;
    const discY = [];
    const vertY = [];
    for (let j = 0; j < DISC_LOAD.length; j++) {
      discY.push(y - gaps[j] / 2);
      y -= gaps[j];
      if (j < SCALE.length) {
        vertY.push(y - (BODY_H * SCALE[j]) / 2);
        y -= BODY_H * SCALE[j];
      }
    }

    // Linha central: lordose natural quando livre; escoliose e retificação quando comprimida
    const half = total / 2;
    const center = yy => {
      const u = yy / half;
      const lateral = 0.36 * strain * Math.sin(Math.PI * u * 0.95);
      const ap = lerp(-0.06, 0.2, relief) * (1 - u * u);
      return [lateral, ap];
    };
    const slope = yy => {
      const d = 0.02;
      const [x1, z1] = center(yy + d);
      const [x0, z0] = center(yy - d);
      return [(x1 - x0) / (2 * d), (z1 - z0) / (2 * d)];
    };
    const tremor = (k, f) => (motion ? Math.pow(strain, 2) * 0.006 * (Math.sin(time * f + k * 1.7) + 0.6 * Math.sin(time * f * 1.9 + k * 0.6)) : 0);

    vertebrae.forEach((mesh, i) => {
      const [x, z] = center(vertY[i]);
      const [dx, dz] = slope(vertY[i]);
      const wobble = strain * (i % 2 ? -1 : 1);
      mesh.position.set(x + tremor(i, 31), vertY[i] + tremor(i + 3, 27), z + tremor(i + 7, 29));
      mesh.rotation.set(Math.atan(dz) + wobble * 0.05, wobble * 0.09 * (1 + i * 0.1), -Math.atan(dx) + wobble * 0.07);
    });

    const tensions = [];
    let peak = 0;
    let hottest = 0;
    discs.forEach((d, j) => {
      const [x, z] = center(discY[j]);
      const [dx, dz] = slope(discY[j]);
      const s = SCALE[Math.min(j, SCALE.length - 1)] * (j === 0 ? 0.97 : 1);
      const bulge = lerp(1.16, 1, relief);
      d.mesh.position.set(x, discY[j], z);
      d.mesh.rotation.set(Math.atan(dz), 0, -Math.atan(dx));
      d.mesh.scale.set(s * bulge, gaps[j] + 0.055, s * bulge);

      const tension = clamp(Math.pow(strain, 1.15) * DISC_LOAD[j] + 0.03 * DISC_LOAD[j]);
      const pulse = motion ? 0.72 + 0.28 * Math.sin(time * 7.2 + j * 0.9) : 1;
      tensions.push(tension);
      if (tension > peak) {
        peak = tension;
        hottest = j;
      }
      d.material.emissiveIntensity = tension * pulse * 0.62;
      d.material.color.copy(healthy).lerp(inflamed, tension);

      d.halo.position.set(x, discY[j], z);
      const hs = (2 + tension * 1.2) * s;
      d.halo.scale.set(hs, hs * 0.6, 1);
      d.halo.material.opacity = tension * (0.2 + 0.2 * pulse);

      // Ondas de tensão: anéis que se expandem a partir dos discos sobrecarregados
      const phase = motion ? (time * 0.55 + j * 0.37) % 1 : 0.35;
      d.ring.position.copy(d.mesh.position);
      d.ring.rotation.copy(d.mesh.rotation);
      d.ring.scale.setScalar(s * (1.06 + phase * 1.15));
      d.ring.material.opacity = tension > 0.12 ? (1 - phase) * tension * 0.7 : 0;
    });

    const pulse = motion ? 0.7 + 0.3 * Math.sin(time * 7.2 + hottest * 0.9) : 1;
    ache.position.copy(discs[hottest].mesh.position);
    ache.position.z += 0.9;
    ache.intensity = peak * pulse * 2.4;

    return { tensions, peak, gap: gaps[5] / SCALE[5] };
  }

  function frame(e, time, view, motion) {
    spine.rotation.y = view.yaw;
    spine.rotation.x = view.pitch;
    camera.position.set(0, 0.9, stage.distance / (view.zoom || 1));
    camera.lookAt(0, 0.05 + (view.lift || 0), 0);
    const info = pose(e, time, motion);
    renderer.render(scene, camera);
    return info;
  }

  // Centro de um disco em pixels do canvas (para as etiquetas)
  function project(j) {
    const mesh = discs[j].mesh;
    mesh.updateWorldMatrix(true, false);
    tmp.setFromMatrixPosition(mesh.matrixWorld).project(camera);
    return {
      x: (tmp.x + 1) * 0.5 * stage.width,
      y: (1 - tmp.y) * 0.5 * stage.height,
      width: stage.width,
      unit: stage.height / (2 * stage.distance * Math.tan((camera.fov * Math.PI) / 360))
    };
  }

  // Compila os shaders fora da thread principal (quando suportado) antes do primeiro quadro
  const prepare = () =>
    renderer.compileAsync && renderer.extensions.has('KHR_parallel_shader_compile')
      ? renderer.compileAsync(scene, camera)
      : Promise.resolve();

  // Qualidade adaptável: 2 = completa; 1 = sem sombras e com resolução reduzida
  function quality(level) {
    const shadows = level >= 2;
    if (renderer.shadowMap.enabled !== shadows) {
      renderer.shadowMap.enabled = shadows;
      key.castShadow = shadows;
      boneMat.needsUpdate = true;
      discs.forEach(d => { d.material.needsUpdate = true; });
    }
    pixelCap = shadows ? (small ? 1.5 : 2) : 1;
    resize(stage.width, stage.height);
  }

  return { renderer, resize, frame, project, prepare, quality };
}

/* ---------- Leituras do HUD ---------- */

function createHud(hero, stage) {
  const fmt = (v, digits = 0) => v.toFixed(digits).replace('.', ',');
  const tags = Array.from(hero.querySelectorAll('[data-spine-tag]')).map(el => ({
    el,
    disc: Number(el.dataset.spineTag),
    side: el.classList.contains('spine-tag--left') ? -1 : 1,
    value: el.querySelector('[data-spine-value]'),
    text: ''
  }));
  const gauge = hero.querySelector('[data-gauge]');
  const bar = gauge && gauge.querySelector('.gauge__bar i');
  const gaugeValue = gauge && gauge.querySelector('[data-gauge-value]');
  const hint = gauge && gauge.querySelector('[data-gauge-hint]');
  let lastGauge = '';
  let lastHint = '';
  let lastTension = -1;

  return {
    resize() {
      tags.forEach(tag => { tag.w = 0; });
    },
    update(e, info, project) {
      const relief = clamp(e);
      const peak = info ? info.peak : 1 - relief;
      tags.forEach(tag => {
        const tension = info ? info.tensions[tag.disc] : (1 - relief) * 0.9;
        const mm = lerp(2.6, 11.2, relief);
        const text = `Tensão ${Math.round(tension * 100)}% · ${fmt(mm, 1)} mm`;
        if (text !== tag.text) {
          tag.text = text;
          if (tag.value) tag.value.textContent = text;
          tag.el.classList.toggle('is-hot', tension > 0.35);
        }
        if (project) {
          const p = project(tag.disc);
          if (!tag.w) tag.w = tag.el.offsetWidth;
          // Mantém a etiqueta inteira dentro do palco
          let x = p.x + tag.side * p.unit * 0.9;
          x = tag.side > 0 ? Math.min(x, p.width - tag.w - 6) : Math.max(x, tag.w + 6);
          tag.el.style.transform = `translate3d(${x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0)`;
        }
      });
      if (bar) bar.style.transform = `scaleX(${clamp(peak).toFixed(3)})`;
      if (Math.abs(peak - lastTension) > 0.004) {
        lastTension = peak;
        stage.style.setProperty('--tension', peak.toFixed(3));
      }
      const g = `${Math.round(peak * 100)}%`;
      if (gaugeValue && g !== lastGauge) {
        lastGauge = g;
        gaugeValue.textContent = g;
        gauge.classList.toggle('is-hot', peak > 0.35);
      }
      const h = relief > 0.96 ? 'Coluna aliviada' : 'Role para aliviar';
      if (hint && h !== lastHint) {
        lastHint = h;
        hint.textContent = h;
      }
    }
  };
}

/* ---------- Inicialização ---------- */

function init() {
  const root = document.documentElement;
  const hero = document.querySelector('.hero');
  const stageEl = hero && hero.querySelector('.hero__stage');
  const canvas = stageEl && stageEl.querySelector('.hero__canvas');
  if (!hero || !stageEl || !canvas) return;

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const small = Math.min(window.innerWidth, window.innerHeight) < 700 || (navigator.hardwareConcurrency || 8) <= 4;
  // ?3d=1 força a cena mesmo com renderização por software (útil para testes)
  const force = /[?&]3d=1\b/.test(window.location.search);
  const hud = createHud(hero, stageEl);

  let gl = null;
  let compiled = false;
  let top = 0;
  let range = 1;
  let visible = true;
  let relief = reduce ? 1 : 0;
  let last = performance.now();
  let started = false;
  let failed = false;
  let level = 2;
  let samples = [];
  const drawn = { relief: -1, yaw: 0, pitch: 0 };
  const pointer = { x: 0, y: 0 };
  const view = { yaw: 1, pitch: 0 };

  const measure = () => {
    const rect = hero.getBoundingClientRect();
    top = rect.top + window.scrollY;
    range = Math.max(1, hero.offsetHeight - window.innerHeight);
    if (gl) {
      const r = stageEl.getBoundingClientRect();
      gl.resize(r.width, r.height);
    }
    hud.resize();
  };
  measure();
  window.addEventListener('resize', measure);
  window.addEventListener('load', measure);
  if ('ResizeObserver' in window) new ResizeObserver(measure).observe(stageEl);

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }).observe(hero);
  }

  if (fine) {
    window.addEventListener('pointermove', e => {
      pointer.x = e.clientX / window.innerWidth - 0.5;
      pointer.y = e.clientY / window.innerHeight - 0.5;
    }, { passive: true });
  }

  const createGL = () => {
    try {
      gl = createScene(canvas, small, force);
    } catch (err) {
      gl = null;
      failed = true;
      console.info('[creass] Coluna 3D indisponível neste aparelho; mantendo a imagem estática.');
      return;
    }
    measure();
    gl.prepare().then(() => { compiled = true; }, () => { compiled = true; });
    canvas.addEventListener('webglcontextlost', e => {
      e.preventDefault();
      gl = null;
      stageEl.classList.remove('is-3d');
    });
  };

  // Mede o ritmo dos quadros e reduz a qualidade se o aparelho não acompanhar
  const govern = dt => {
    if (!samples) return;
    samples.push(dt);
    if (samples.length < 90) return;
    const median = samples.sort((a, b) => a - b)[45];
    samples = [];
    if (level === 2 && median > 24) {
      level = 1;
      gl.quality(1);
    } else if (level === 1 && median > 34) {
      level = 0;
      samples = null;
    } else {
      samples = null;
    }
  };

  function tick(now) {
    const dt = Math.min(64, now - last);
    last = now;
    if (visible && !document.hidden) {
      const progress = clamp((window.scrollY - top) / range);
      const target = reduce ? 1 : easeInOut(clamp(progress / 0.9));
      relief = reduce ? 1 : lerp(relief, target, 1 - Math.pow(0.9, dt / 16.67));
      if (Math.abs(relief - target) < 0.0005) relief = target;

      const time = now / 1000;
      const animate = !reduce && level > 0;
      // Oscila entre as vistas lateral e posterolateral; o cursor gira a coluna
      const yawTarget = 1 + (animate ? 0.45 * Math.sin(time * 0.17) : 0) + pointer.x * 0.8;
      view.yaw = reduce ? 1 : lerp(view.yaw, yawTarget, 0.05);
      view.pitch = reduce ? 0 : lerp(view.pitch, pointer.y * 0.16, 0.05);

      let info = null;
      if (gl && compiled) {
        // No modo econômico só redesenha quando algo muda de fato
        const changed = Math.abs(relief - drawn.relief) > 0.001 || Math.abs(view.yaw - drawn.yaw) > 0.002 || Math.abs(view.pitch - drawn.pitch) > 0.002;
        if (animate || changed || !started) {
          info = gl.frame(relief, time, view, animate);
          drawn.relief = relief;
          drawn.yaw = view.yaw;
          drawn.pitch = view.pitch;
          drawn.info = info;
          if (started && animate) govern(dt);
        } else {
          info = drawn.info;
        }
        if (!started) {
          started = true;
          stageEl.classList.add('is-3d');
        }
      }
      hud.update(relief, info, gl && compiled ? gl.project : null);
    }
    if (!reduce || (!started && !failed)) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  // A cena só é criada depois da abertura, para não disputar a thread principal com ela
  let requested = false;
  const request = () => {
    if (requested) return;
    requested = true;
    (window.requestIdleCallback || (cb => setTimeout(cb, 1)))(createGL, { timeout: 700 });
  };
  if (root.classList.contains('is-ready')) request();
  else {
    const mo = new MutationObserver(() => {
      if (root.classList.contains('is-ready')) {
        mo.disconnect();
        request();
      }
    });
    mo.observe(root, { attributes: true, attributeFilter: ['class'] });
    setTimeout(request, 4000);
  }

  // Movimento reduzido: um único quadro estático, redesenhado só ao redimensionar
  if (reduce) {
    window.addEventListener('resize', () => requestAnimationFrame(tick));
  }
}

// Por último: o script é assíncrono e pode rodar com o DOM já pronto,
// então só inicializa depois de todas as declarações acima
ready(() => {
  try {
    init();
  } catch (err) {
    console.error('[creass] coluna 3D:', err);
  }
});
