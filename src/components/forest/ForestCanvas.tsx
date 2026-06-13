import { useEffect, useRef, useCallback } from "react";
import * as THREE from "three";
import * as d3 from "d3";
import type { ForestGraph, ForestNode } from "../../db/client";

// ─── Types ─────────────────────────────────────────

interface Props {
  graph: ForestGraph;
  onNodeClick: (nodeId: string) => void;
  selectedNodeId: string | null;
}

interface TreeData {
  node: ForestNode;
  mesh: THREE.Group;
}

interface LayoutNode extends d3.SimulationNodeDatum {
  id: string;
  noteCount: number;
  radius: number;
}

// ─── Constants ─────────────────────────────────────

const ISLAND_SIZE = 8;
const ISLAND_HEIGHT = 0.8;
const ROTATE_SPEED = 0.005;
const MIN_VIEW_SIZE = 6;
const MAX_VIEW_SIZE = 20;
const DEFAULT_VIEW_SIZE = 12;
const ZOOM_SMOOTH = 0.1;
const ISLAND_RX = ISLAND_SIZE * 0.9;
const ISLAND_RY = ISLAND_SIZE * 0.7;
const ISLAND_SEED = 42;
const GROUND_Y = ISLAND_HEIGHT * 0.50; // top of grass surface after ExtrudeGeometry rotation

// ─── Helpers ───────────────────────────────────────

function hashSeed(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(h) / 2147483647;
}

function crownRadius3D(noteCount: number): number {
  return 0.25 + Math.log1p(noteCount) * 0.3;
}

function healthColorHex(health: number, status: string): number {
  if (status === "dormant") return 0x9e9e9e;
  const r = Math.round((0.1 + (1 - health) * 0.8) * 255);
  const g = Math.round((0.5 + health * 0.5) * 255);
  const b = Math.round((0.1 + health * 0.1) * 255);
  return (r << 16) | (g << 8) | b;
}

function crownLayers(
  noteCount: number,
  health: number,
  status: string,
): number {
  if (status === "dormant") return 0;
  const base = Math.min(3, Math.ceil(Math.log1p(noteCount)));
  if (health < 0.3) return Math.max(0, base - 2);
  if (health < 0.6) return Math.max(1, base - 1);
  return base;
}

function treeCrownOffset(node: ForestNode): number {
  const scale = 0.6 + Math.log1p(node.noteCount) * 0.5;
  const trunkH = 0.8 * scale;
  const layers = crownLayers(node.noteCount, node.health, node.status);
  // Crown center: top of trunk + half of crown height
  const crownH = layers > 0 ? 0.5 * scale * layers * 0.55 : 0;
  return trunkH + crownH * 0.5;
}

function crownMaterial(
  hexColor: number,
  health: number,
  status: string,
): THREE.MeshStandardMaterial {
  const opacity = status === "dormant" ? 0.3 : 0.6 + health * 0.4;
  return new THREE.MeshStandardMaterial({
    color: hexColor,
    roughness: 0.5,
    opacity,
    transparent: opacity < 1,
  });
}

function vineColorHex(
  mixHealth: number,
  statusA: string,
  statusB: string,
): number {
  if (statusA === "dormant" && statusB === "dormant") return 0x9e9e9e;
  const g = Math.round((0.4 + mixHealth * 0.6) * 255);
  const r = Math.round((0.2 + (1 - mixHealth) * 0.6) * 255);
  return (r << 16) | (g << 8) | 0x20;
}

// ─── Tree Positioning (d3-force pre-layout) ────────

function rankNormalized(index: number, total: number): number {
  return total <= 1 ? 0 : index / (total - 1);
}

function computeLayout(
  nodes: ForestNode[],
  edges: { source: string; target: string; weight: number }[],
  islandRadius: number,
): Map<string, THREE.Vector3> {
  // Sort by noteCount descending → big trees get small rank → closer to center
  const sorted = [...nodes].sort((a, b) => b.noteCount - a.noteCount);
  const rankMap = new Map<string, number>();
  sorted.forEach((n, i) => rankMap.set(n.id, i));

  const layoutNodes: LayoutNode[] = nodes.map((n) => {
    const rank = rankMap.get(n.id) ?? 0;
    const rNorm = rankNormalized(rank, nodes.length);
    const r = crownRadius3D(n.noteCount);
    // Big trees start near center, small trees near edge
    const initR = islandRadius * rNorm * 0.8;
    const initAngle = Math.random() * Math.PI * 2;
    return {
      id: n.id,
      noteCount: n.noteCount,
      radius: r + 0.5,
      x: Math.cos(initAngle) * initR,
      y: Math.sin(initAngle) * initR,
    };
  });

  const layoutEdges = edges.map((e) => ({
    source: e.source,
    target: e.target,
    weight: e.weight,
  }));

  const sim = d3
    .forceSimulation<LayoutNode>(layoutNodes)
    .force(
      "collide",
      d3.forceCollide<LayoutNode>().radius((d) => d.radius + 0.5),
    )
    .force(
      "radial",
      d3
        .forceRadial(
          (d) => {
            const layoutD = d as LayoutNode;
            const rank = rankMap.get(layoutD.id) ?? 0;
            return islandRadius * rankNormalized(rank, nodes.length) * 0.85;
          },
        )
        .strength(0.3),
    )
    .force(
      "link",
      d3
        .forceLink<LayoutNode, { source: string; target: string; weight: number }>(layoutEdges)
        .id((d) => (d as LayoutNode).id)
        .distance((d) => Math.max(1.5, 4 - d.weight * 0.3))
        .strength((d) => Math.min(0.3, d.weight * 0.05)),
    )
    .stop();

  // 200 tick convergence
  for (let i = 0; i < 200; i++) sim.tick();

  // Clamp to elliptical island boundary (island is not circular!)
  const safeMargin = 0.88; // keep trees within 88% of the ellipse
  for (const n of layoutNodes) {
    const x = n.x ?? 0;
    const z = n.y ?? 0; // d3 y → world Z
    const ex = x / ISLAND_RX;
    const ez = z / ISLAND_RY;
    const e = ex * ex + ez * ez;
    if (e > safeMargin * safeMargin) {
      const scale = safeMargin / Math.sqrt(e);
      n.x = x * scale;
      n.y = z * scale;
    }
  }

  const positions = new Map<string, THREE.Vector3>();
  for (const n of layoutNodes) {
    positions.set(
      n.id,
      new THREE.Vector3(n.x ?? 0, GROUND_Y, n.y ?? 0),
    );
  }
  return positions;
}

// ─── Island Builder ────────────────────────────────

function createIslandShape(
  rx: number,
  ry: number,
  seed: number,
): THREE.Shape {
  const shape = new THREE.Shape();
  const segments = 36;
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const wobble =
      1 +
      Math.sin(angle * 3 + seed) * 0.08 +
      Math.sin(angle * 5 + seed * 2) * 0.04;
    const x = Math.cos(angle) * rx * wobble;
    const y = Math.sin(angle) * ry * wobble;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  return shape;
}

function addEdgeGravel(
  group: THREE.Group,
  rx: number,
  ry: number,
): void {
  const count = 40;
  const gravelGeo = new THREE.IcosahedronGeometry(0.08, 0);
  const gravelMat = new THREE.MeshStandardMaterial({
    color: 0x9e8c7a,
    roughness: 0.8,
  });
  const instancedMesh = new THREE.InstancedMesh(gravelGeo, gravelMat, count);

  const dummy = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
    const r = ((rx + ry) / 2) * (0.9 + Math.random() * 0.15);
    dummy.position.set(
      Math.cos(angle) * r,
      -ISLAND_HEIGHT * 0.3 + Math.random() * ISLAND_HEIGHT * 0.25,
      Math.sin(angle) * r * (ry / rx),
    );
    dummy.scale.setScalar(0.4 + Math.random() * 0.8);
    dummy.updateMatrix();
    instancedMesh.setMatrixAt(i, dummy.matrix);
  }
  group.add(instancedMesh);
}

function addBottomRoots(
  group: THREE.Group,
  rx: number,
  ry: number,
): void {
  const count = 25;
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = ((rx + ry) / 2) * (0.3 + Math.random() * 0.7);
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r * (ry / rx);
    const h = 0.2 + Math.random() * 0.6;

    const coneGeo = new THREE.ConeGeometry(0.04, h, 4);
    const coneMat = new THREE.MeshStandardMaterial({
      color: 0x6d5c4a,
      roughness: 0.9,
    });
    const cone = new THREE.Mesh(coneGeo, coneMat);
    cone.position.set(x, -ISLAND_HEIGHT * 0.9 - h / 2, z);
    cone.rotation.x = (Math.random() - 0.5) * 0.5;
    cone.rotation.z = (Math.random() - 0.5) * 0.5;
    group.add(cone);
  }
}

function createMushroom(): THREE.Group {
  const group = new THREE.Group();
  const stemGeo = new THREE.CylinderGeometry(0.03, 0.04, 0.12, 6);
  const stemMat = new THREE.MeshStandardMaterial({
    color: 0xf5f0e8,
    roughness: 0.7,
  });
  const stem = new THREE.Mesh(stemGeo, stemMat);
  stem.position.y = 0.06;
  group.add(stem);

  const capColors = [0xe57373, 0xffb74d, 0xfff176];
  const capGeo = new THREE.SphereGeometry(0.08, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2);
  const capMat = new THREE.MeshStandardMaterial({
    color: capColors[Math.floor(Math.random() * 3)],
    roughness: 0.5,
  });
  const cap = new THREE.Mesh(capGeo, capMat);
  cap.position.y = 0.12;
  group.add(cap);

  return group;
}

function addGrassDecorations(
  group: THREE.Group,
  rx: number,
  ry: number,
  treePositions: THREE.Vector3[],
): void {
  // Grass tufts — InstancedMesh
  const grassCount = 60;
  const grassGeo = new THREE.ConeGeometry(0.04, 0.15, 4);
  const grassMat = new THREE.MeshStandardMaterial({
    color: 0x81c784,
    roughness: 0.7,
  });
  const grassInstanced = new THREE.InstancedMesh(
    grassGeo,
    grassMat,
    grassCount,
  );

  const dummy = new THREE.Object3D();
  for (let i = 0; i < grassCount; i++) {
    let x: number, z: number;
    // Avoid tree positions
    let attempts = 0;
    do {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * rx * 0.85;
      x = Math.cos(angle) * r;
      z = Math.sin(angle) * r * (ry / rx);
      attempts++;
    } while (
      attempts < 50 &&
      treePositions.some((p) => Math.hypot(x - p.x, z - p.z) < 0.5)
    );

    dummy.position.set(x, GROUND_Y + 0.04, z);
    dummy.scale.setScalar(0.5 + Math.random() * 1.0);
    dummy.updateMatrix();
    grassInstanced.setMatrixAt(i, dummy.matrix);
  }
  group.add(grassInstanced);

  // Mushrooms
  const mushroomCount = 8;
  for (let i = 0; i < mushroomCount; i++) {
    const mushroom = createMushroom();
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * rx * 0.5;
    mushroom.position.set(
      Math.cos(angle) * r,
      GROUND_Y + 0.02,
      Math.sin(angle) * r * (ry / rx),
    );
    group.add(mushroom);
  }
}

function createIsland(group: THREE.Group, treePositions: THREE.Vector3[]): void {
  const rx = ISLAND_RX;
  const ry = ISLAND_RY;

  // Grass top layer
  const grassShape = createIslandShape(rx, ry, ISLAND_SEED);
  const grassExtrudeSettings = {
    steps: 1,
    depth: ISLAND_HEIGHT * 0.35,
    bevelEnabled: true,
    bevelThickness: 0.1,
    bevelSize: 0.05,
    bevelSegments: 3,
  };
  const grassGeo = new THREE.ExtrudeGeometry(grassShape, grassExtrudeSettings);
  const grassMat = new THREE.MeshStandardMaterial({
    color: 0x66bb6a,
    roughness: 0.6,
  });
  const grassMesh = new THREE.Mesh(grassGeo, grassMat);
  grassMesh.rotation.x = -Math.PI / 2;
  grassMesh.position.y = ISLAND_HEIGHT * 0.15;
  grassMesh.receiveShadow = true;
  group.add(grassMesh);

  // Middle dirt layer
  const dirtShape = createIslandShape(rx * 0.98, ry * 0.98, ISLAND_SEED);
  const dirtGeo = new THREE.ExtrudeGeometry(dirtShape, {
    steps: 1,
    depth: ISLAND_HEIGHT * 0.5,
    bevelEnabled: false,
  });
  const dirtMat = new THREE.MeshStandardMaterial({
    color: 0x8b6b4a,
    roughness: 0.9,
  });
  const dirtMesh = new THREE.Mesh(dirtGeo, dirtMat);
  dirtMesh.rotation.x = -Math.PI / 2;
  dirtMesh.position.y = -ISLAND_HEIGHT * 0.35;
  dirtMesh.castShadow = true;
  dirtMesh.receiveShadow = true;
  group.add(dirtMesh);

  // Bottom stone layer
  const stoneShape = createIslandShape(rx * 1.02, ry * 1.02, ISLAND_SEED);
  const stoneGeo = new THREE.ExtrudeGeometry(stoneShape, {
    steps: 1,
    depth: ISLAND_HEIGHT * 0.3,
    bevelEnabled: false,
  });
  const stoneMat = new THREE.MeshStandardMaterial({
    color: 0x6d5c4a,
    roughness: 0.95,
  });
  const stoneMesh = new THREE.Mesh(stoneGeo, stoneMat);
  stoneMesh.rotation.x = -Math.PI / 2;
  stoneMesh.position.y = -ISLAND_HEIGHT * 0.85;
  group.add(stoneMesh);

  // Edge gravel, bottom roots, grass decorations
  addEdgeGravel(group, rx, ry);
  addBottomRoots(group, rx, ry);
  addGrassDecorations(group, rx, ry, treePositions);
}

// ─── Tree Builder ──────────────────────────────────

function buildConeCrown(
  group: THREE.Group,
  trunkH: number,
  scale: number,
  color: number,
  node: ForestNode,
): void {
  const layers = crownLayers(node.noteCount, node.health, node.status);
  for (let l = 0; l < layers; l++) {
    const coneH = 0.5 * scale * (1 - l * 0.15);
    const coneR = 0.35 * scale * (1 - l * 0.2);
    const coneGeo = new THREE.ConeGeometry(coneR, coneH, 8);
    const coneMat = crownMaterial(color, node.health, node.status);
    const cone = new THREE.Mesh(coneGeo, coneMat);
    cone.position.y = trunkH + l * coneH * 0.55;
    cone.castShadow = true;
    cone.receiveShadow = true;
    group.add(cone);
  }
}

function buildSphereCrown(
  group: THREE.Group,
  trunkH: number,
  scale: number,
  color: number,
  node: ForestNode,
): void {
  const mainR = 0.3 * scale;
  const mat = crownMaterial(color, node.health, node.status);

  const mainGeo = new THREE.SphereGeometry(mainR, 8, 6);
  const main = new THREE.Mesh(mainGeo, mat);
  main.position.y = trunkH + mainR * 0.7;
  main.castShadow = true;
  group.add(main);

  const topR = mainR * 0.5;
  const topGeo = new THREE.SphereGeometry(topR, 6, 4);
  const top = new THREE.Mesh(topGeo, mat);
  top.position.y = trunkH + mainR * 1.5;
  top.castShadow = true;
  group.add(top);
}

function buildHemiCrown(
  group: THREE.Group,
  trunkH: number,
  scale: number,
  color: number,
  node: ForestNode,
): void {
  const r = 0.4 * scale;
  const geo = new THREE.SphereGeometry(r, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  const mat = crownMaterial(color, node.health, node.status);
  const crown = new THREE.Mesh(geo, mat);
  crown.position.y = trunkH;
  crown.castShadow = true;
  group.add(crown);
}

function buildMixedCrown(
  group: THREE.Group,
  trunkH: number,
  scale: number,
  color: number,
  node: ForestNode,
): void {
  buildConeCrown(group, trunkH, scale * 0.7, color, node);
  buildSphereCrown(group, trunkH + 0.1, scale * 0.6, color, node);
}

function createTreeMesh(node: ForestNode): THREE.Group {
  const group = new THREE.Group();
  group.userData = { nodeId: node.id, isTree: true };
  const seed = hashSeed(node.id);
  const scale = 0.6 + Math.log1p(node.noteCount) * 0.5;
  const color = healthColorHex(node.health, node.status);

  // Trunk
  const trunkH = 0.8 * scale;
  const trunkGeo = new THREE.CylinderGeometry(0.08, 0.12, trunkH, 6);
  const trunkColor =
    node.status === "dormant" ? 0x9e9e9e : 0x6d4c41;
  const trunkMat = new THREE.MeshStandardMaterial({
    color: trunkColor,
    roughness: 0.8,
  });
  const trunk = new THREE.Mesh(trunkGeo, trunkMat);
  trunk.position.y = trunkH / 2;
  trunk.castShadow = true;
  group.add(trunk);

  // Crown shape based on seed
  const crownType = Math.floor(seed * 4); // 0-3
  switch (crownType) {
    case 0:
      buildConeCrown(group, trunkH, scale, color, node);
      break;
    case 1:
      buildSphereCrown(group, trunkH, scale, color, node);
      break;
    case 2:
      buildHemiCrown(group, trunkH, scale, color, node);
      break;
    case 3:
      buildMixedCrown(group, trunkH, scale, color, node);
      break;
  }

  return group;
}

// ─── Vine Builder ──────────────────────────────────

function createVine(
  a: THREE.Vector3,
  b: THREE.Vector3,
  weight: number,
  healthA: number,
  healthB: number,
  statusA: string,
  statusB: string,
): THREE.Group {
  const group = new THREE.Group();
  const strands = weight >= 5 ? 3 : weight >= 3 ? 2 : 1;

  for (let s = 0; s < strands; s++) {
    const offset = (s - (strands - 1) / 2) * 0.15;
    const mid = new THREE.Vector3()
      .addVectors(a, b)
      .multiplyScalar(0.5);
    mid.y += 0.5 + weight * 0.1;
    mid.x += offset;
    mid.z += offset;

    const curve = new THREE.QuadraticBezierCurve3(
      a.clone(),
      mid,
      b.clone(),
    );
    const tubeGeo = new THREE.TubeGeometry(
      curve,
      20,
      0.04 + Math.log1p(weight) * 0.02,
      6,
      false,
    );

    const mixHealth = (healthA + healthB) / 2;
    const mat = new THREE.MeshStandardMaterial({
      color: vineColorHex(mixHealth, statusA, statusB),
      roughness: 0.6,
      transparent: true,
      opacity: Math.min(0.7, 0.15 + weight / 15),
    });

    const tube = new THREE.Mesh(tubeGeo, mat);
    group.add(tube);
  }

  return group;
}

// ─── Atmosphere Builders ───────────────────────────

function createSkyTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;

  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, "#1a1b3e");
  grad.addColorStop(0.3, "#252850");
  grad.addColorStop(0.6, "#3a4a70");
  grad.addColorStop(0.8, "#4a6078");
  grad.addColorStop(1, "#5a7a80");

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

function createStars(): THREE.Points {
  const count = 50;
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 30;
    positions[i * 3 + 1] = 8 + Math.random() * 12;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 30;
  }

  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.05,
    transparent: true,
    opacity: 0.6,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  return new THREE.Points(geo, mat);
}

function createCloud(
  x: number,
  y: number,
  z: number,
  scl: number,
): THREE.Group {
  const group = new THREE.Group();
  const cloudMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.9,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
  });

  const parts = 5;
  for (let i = 0; i < parts; i++) {
    const r = 0.3 + Math.random() * 0.4;
    const geo = new THREE.SphereGeometry(r, 6, 4);
    const mesh = new THREE.Mesh(geo, cloudMat);
    mesh.position.set(
      (Math.random() - 0.5) * 1.5,
      (Math.random() - 0.5) * 0.3,
      (Math.random() - 0.5) * 0.8,
    );
    group.add(mesh);
  }

  group.position.set(x, y, z);
  group.scale.setScalar(scl);
  return group;
}

function createFarIsland(
  x: number,
  y: number,
  z: number,
  scl: number,
): THREE.Group {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: 0x3a4a70,
    roughness: 0.9,
    transparent: true,
    opacity: 0.4,
    depthWrite: false,
  });

  const topGeo = new THREE.CylinderGeometry(0.6, 0.4, 0.3, 12);
  const top = new THREE.Mesh(topGeo, mat);
  top.position.y = 0.15;
  group.add(top);

  const bottomGeo = new THREE.ConeGeometry(0.6, 0.8, 12);
  const bottom = new THREE.Mesh(bottomGeo, mat);
  bottom.position.y = -0.4;
  group.add(bottom);

  group.position.set(x, y, z);
  group.scale.setScalar(scl);
  return group;
}

function createFireflies(): {
  points: THREE.Points;
  update: () => void;
} {
  const count = 30;
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const basePositions: [number, number, number][] = [];

  for (let i = 0; i < count; i++) {
    const x = (Math.random() - 0.5) * ISLAND_SIZE * 1.5;
    const y = ISLAND_HEIGHT + Math.random() * 2;
    const z = (Math.random() - 0.5) * ISLAND_SIZE * 1.5;
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
    basePositions.push([x, y, z]);
  }

  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xfff8a0,
    size: 0.06,
    transparent: true,
    opacity: 0.7,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const points = new THREE.Points(geo, mat);

  return {
    points,
    update: () => {
      const pos = points.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < count; i++) {
        const [bx, by, bz] = basePositions[i];
        pos[i * 3 + 1] =
          by + Math.sin(Date.now() * 0.001 + i) * 0.5;
        pos[i * 3] =
          bx + Math.cos(Date.now() * 0.0007 + i * 1.3) * 0.3;
        pos[i * 3 + 2] =
          bz + Math.sin(Date.now() * 0.0009 + i * 0.7) * 0.3;
      }
      points.geometry.attributes.position.needsUpdate = true;
    },
  };
}

// ─── Component ─────────────────────────────────────

export function ForestCanvas({ graph, onNodeClick, selectedNodeId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const treesRef = useRef<TreeData[]>([]);
  const islandGroupRef = useRef<THREE.Group>(new THREE.Group());
  const animRef = useRef(0);
  const dragRef = useRef<{ prevX: number } | null>(null);
  const rotateRef = useRef(0);
  const viewSizeRef = useRef(DEFAULT_VIEW_SIZE);
  const targetViewSizeRef = useRef(DEFAULT_VIEW_SIZE);
  const fireflyRef = useRef<{
    points: THREE.Points;
    update: () => void;
  } | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  // ─── Init ────────────────────────────────────────

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (rendererRef.current) {
      rendererRef.current.dispose();
      if (container.contains(rendererRef.current.domElement)) {
        container.removeChild(rendererRef.current.domElement);
      }
    }
    cancelAnimationFrame(animRef.current);

    const rect = container.getBoundingClientRect();
    const w = rect.width || 800;
    const h = rect.height || 500;

    const scene = new THREE.Scene();
    scene.background = createSkyTexture();
    scene.fog = new THREE.Fog(0x5a7a80, 12, 35);
    sceneRef.current = scene;

    const aspect = w / h;
    const viewSize = DEFAULT_VIEW_SIZE;
    viewSizeRef.current = viewSize;
    targetViewSizeRef.current = viewSize;

    const camera = new THREE.OrthographicCamera(
      -viewSize * aspect,
      viewSize * aspect,
      viewSize,
      -viewSize,
      0.1,
      50,
    );
    camera.position.set(8, 10, 8);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.display = "block";
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Warm lighting
    scene.add(new THREE.AmbientLight(0x889966, 0.9));
    scene.add(new THREE.HemisphereLight(0xffeedd, 0x556644, 0.5));
    const dirLight = new THREE.DirectionalLight(0xfff0d0, 1.2);
    dirLight.position.set(10, 15, 5);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(2048, 2048);
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 50;
    dirLight.shadow.camera.left = -15;
    dirLight.shadow.camera.right = 15;
    dirLight.shadow.camera.top = 15;
    dirLight.shadow.camera.bottom = -15;
    dirLight.shadow.bias = -0.0001;
    dirLight.shadow.normalBias = 0.02;
    scene.add(dirLight);

    // Stars
    scene.add(createStars());

    // Clouds
    scene.add(createCloud(-6, 8, -4, 1.2));
    scene.add(createCloud(5, 9, -6, 1.0));
    scene.add(createCloud(-4, 10, 5, 0.8));

    // Far islands
    scene.add(createFarIsland(-10, 2, -8, 1.5));
    scene.add(createFarIsland(11, 1, -6, 1.0));
    scene.add(createFarIsland(-8, 3, 9, 1.2));

    // Fireflies
    const fireflies = createFireflies();
    scene.add(fireflies.points);
    fireflyRef.current = fireflies;

    // Compute tree layout with d3-force
    const layoutPositions = computeLayout(
      graph.nodes,
      graph.edges,
      ISLAND_SIZE * 0.8,
    );
    const treePositions: THREE.Vector3[] = [];
    for (const pos of layoutPositions.values()) {
      treePositions.push(pos);
    }

    // Island
    const islandGroup = new THREE.Group();
    islandGroupRef.current = islandGroup;
    scene.add(islandGroup);
    createIsland(islandGroup, treePositions);

    // Trees
    treesRef.current = [];
    for (const node of graph.nodes) {
      const pos =
        layoutPositions.get(node.id) ??
        new THREE.Vector3(
          (Math.random() - 0.5) * ISLAND_SIZE * 1.5,
          GROUND_Y,
          (Math.random() - 0.5) * ISLAND_SIZE * 1.5,
        );
      const mesh = createTreeMesh(node);
      mesh.position.copy(pos);
      islandGroup.add(mesh);
      treesRef.current.push({ node, mesh });
    }

    // Vines
    for (const edge of graph.edges) {
      const ft = treesRef.current.find((t) => t.node.id === edge.source);
      const tt = treesRef.current.find((t) => t.node.id === edge.target);
      if (ft && tt) {
        const fromPos = ft.mesh.position.clone();
        fromPos.y += treeCrownOffset(ft.node);
        const toPos = tt.mesh.position.clone();
        toPos.y += treeCrownOffset(tt.node);
        islandGroup.add(
          createVine(
            fromPos,
            toPos,
            edge.weight,
            ft.node.health,
            tt.node.health,
            ft.node.status,
            tt.node.status,
          ),
        );
      }
    }

    // Camera update helper
    function updateCamera(vs: number) {
      const c = cameraRef.current;
      if (!c) return;
      const aspect = w / h;
      c.left = -vs * aspect;
      c.right = vs * aspect;
      c.top = vs;
      c.bottom = -vs;
      c.updateProjectionMatrix();
    }

    // Zoom handler
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 1.1 : 0.9;
      const factor = e.ctrlKey ? 1 + e.deltaY * 0.01 : delta;
      targetViewSizeRef.current = Math.max(
        MIN_VIEW_SIZE,
        Math.min(
          MAX_VIEW_SIZE,
          targetViewSizeRef.current * factor,
        ),
      );
    };
    container.addEventListener("wheel", handleWheel, { passive: false });

    // Animate
    function animate() {
      animRef.current = requestAnimationFrame(animate);

      // Zoom easing
      const vs = viewSizeRef.current;
      const target = targetViewSizeRef.current;
      if (Math.abs(vs - target) > 0.01) {
        const newVs = vs + (target - vs) * ZOOM_SMOOTH;
        viewSizeRef.current = newVs;
        updateCamera(newVs);
      }

      // Firefly update
      if (fireflyRef.current) fireflyRef.current.update();

      renderer.render(scene, camera);
    }
    animate();

    return () => {
      cancelAnimationFrame(animRef.current);
      container.removeEventListener("wheel", handleWheel);
      renderer.dispose();
    };
  }, [graph]);

  // ─── Selection highlight ─────────────────────────

  useEffect(() => {
    for (const td of treesRef.current) {
      const isSel = td.node.id === selectedNodeId;
      td.mesh.children.forEach((c) => {
        if (c instanceof THREE.Mesh && c.material.emissive) {
          c.material.emissive.set(isSel ? 0x332200 : 0x000000);
        }
      });
    }
  }, [selectedNodeId]);

  // ─── Mouse ───────────────────────────────────────

  const hitTest = useCallback(
    (e: React.MouseEvent): TreeData | null => {
      const container = containerRef.current;
      const camera = cameraRef.current;
      if (!container || !camera) return null;
      const rect = container.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(
        treesRef.current.map((t) => t.mesh),
        true,
      );
      if (hits.length > 0) {
        let obj: THREE.Object3D | null = hits[0].object;
        while (obj && !obj.userData?.isTree) obj = obj.parent;
        return treesRef.current.find((t) => t.mesh === obj) ?? null;
      }
      return null;
    },
    [],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (dragRef.current) {
        const dx = e.clientX - dragRef.current.prevX;
        rotateRef.current += dx * ROTATE_SPEED;
        if (islandGroupRef.current)
          islandGroupRef.current.rotation.y = rotateRef.current;
        dragRef.current = { prevX: e.clientX };
        return;
      }
      const hit = hitTest(e);
      if (containerRef.current)
        containerRef.current.style.cursor = hit ? "pointer" : "grab";

      if (!tooltipRef.current) {
        tooltipRef.current = document.createElement("div");
        tooltipRef.current.className = "forest-tooltip";
        tooltipRef.current.style.cssText =
          "position:absolute;pointer-events:none;opacity:0;background:rgba(26,27,46,0.95);color:#e9ecef;border:1px solid rgba(255,255,255,0.15);border-radius:8px;padding:8px 12px;font-size:12px;box-shadow:0 4px 12px rgba(0,0,0,0.4);z-index:1000;";
        document.body.appendChild(tooltipRef.current);
      }
      const tip = tooltipRef.current;
      if (hit) {
        const n = hit.node;
        tip.style.opacity = "1";
        tip.innerHTML = `<strong>${n.label}</strong><br/>Notes: ${n.noteCount}<br/>Health: ${(n.health * 100).toFixed(0)}%<br/>Status: ${n.status}<br/>Reads (30d): ${n.readCount30d}<br/>Updates (30d): ${n.updateCount30d}`;
        tip.style.left = e.clientX + 16 + "px";
        tip.style.top = e.clientY - 10 + "px";
      } else {
        tip.style.opacity = "0";
      }
    },
    [hitTest],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!hitTest(e)) {
        dragRef.current = { prevX: e.clientX };
        if (containerRef.current)
          containerRef.current.style.cursor = "grabbing";
      }
    },
    [hitTest],
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (dragRef.current) {
        const moved = Math.abs(e.clientX - dragRef.current.prevX);
        dragRef.current = null;
        if (containerRef.current)
          containerRef.current.style.cursor = "grab";
        if (moved < 3) {
          const hit = hitTest(e);
          if (hit) {
            // Zoom to tree
            targetViewSizeRef.current = Math.max(
              6,
              viewSizeRef.current * 0.5,
            );
            onNodeClick(hit.node.id);
          }
        }
      }
    },
    [hitTest, onNodeClick],
  );

  const handleMouseLeave = useCallback(() => {
    dragRef.current = null;
    if (tooltipRef.current) tooltipRef.current.style.opacity = "0";
  }, []);

  // ─── Resize ──────────────────────────────────────

  useEffect(() => {
    const handleResize = () => {
      const c = containerRef.current;
      const cam = cameraRef.current;
      const r = rendererRef.current;
      if (!c || !cam || !r) return;
      const rect = c.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const aspect = rect.width / rect.height;
      const vs = viewSizeRef.current;
      cam.left = -vs * aspect;
      cam.right = vs * aspect;
      cam.top = vs;
      cam.bottom = -vs;
      cam.updateProjectionMatrix();
      r.setSize(rect.width, rect.height);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    return () => {
      if (tooltipRef.current) {
        tooltipRef.current.remove();
        tooltipRef.current = null;
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="forest-canvas-el"
      onMouseMove={handleMouseMove}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    />
  );
}
