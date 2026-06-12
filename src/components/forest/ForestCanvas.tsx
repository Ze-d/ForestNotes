import { useEffect, useRef, useCallback } from "react";
import * as THREE from "three";
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

// ─── Constants ─────────────────────────────────────

const ISLAND_SIZE = 8;
const ISLAND_HEIGHT = 0.8;
const GRID_SPACING = 2;
const ROTATE_SPEED = 0.005;

// ─── Color ─────────────────────────────────────────

function statusColorHex(status: string): number {
  switch (status) {
    case "healthy": return 0x2f9e44;
    case "normal": return 0x74b816;
    case "stale": return 0xf59f00;
    case "dormant": return 0xadb5bd;
    default: return 0x868e96;
  }
}

// ─── Grid Positioner ───────────────────────────────

function assignGridPositions(nodes: ForestNode[]): Map<string, THREE.Vector3> {
  const positions = new Map<string, THREE.Vector3>();
  const cols = Math.ceil(Math.sqrt(nodes.length * 1.5));
  const rows = Math.ceil(nodes.length / cols);
  const offX = ((cols - 1) * GRID_SPACING) / 2;
  const offZ = ((rows - 1) * GRID_SPACING) / 2;
  const angle = Math.PI / 6; // 30 deg diamond rotation

  let i = 0;
  for (let row = 0; row < rows && i < nodes.length; row++) {
    for (let col = 0; col < cols && i < nodes.length; col++) {
      const gx = col * GRID_SPACING - offX;
      const gz = row * GRID_SPACING - offZ;
      const rx = gx * Math.cos(angle) - gz * Math.sin(angle);
      const rz = gx * Math.sin(angle) + gz * Math.cos(angle);
      positions.set(nodes[i].id, new THREE.Vector3(rx, ISLAND_HEIGHT * 0.35, rz));
      i++;
    }
  }
  return positions;
}

// ─── Builders ──────────────────────────────────────

function createIsland(group: THREE.Group): void {
  // Dirt base
  const dirtGeo = new THREE.BoxGeometry(ISLAND_SIZE * 2.2, ISLAND_HEIGHT * 1.8, ISLAND_SIZE * 2.2);
  const dirtMat = new THREE.MeshStandardMaterial({ color: 0x8B6B4A, roughness: 0.9 });
  const dirt = new THREE.Mesh(dirtGeo, dirtMat);
  dirt.position.y = -ISLAND_HEIGHT * 0.9;
  dirt.castShadow = true;
  dirt.receiveShadow = true;
  group.add(dirt);

  // Stone trim
  const stoneGeo = new THREE.BoxGeometry(ISLAND_SIZE * 2.15, ISLAND_HEIGHT * 0.2, ISLAND_SIZE * 2.15);
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0xa0896e, roughness: 0.8 });
  const stone = new THREE.Mesh(stoneGeo, stoneMat);
  stone.position.y = -ISLAND_HEIGHT * 0.05;
  group.add(stone);

  // Grass surface
  const grassGeo = new THREE.BoxGeometry(ISLAND_SIZE * 2.1, ISLAND_HEIGHT * 0.35, ISLAND_SIZE * 2.1);
  const grassMat = new THREE.MeshStandardMaterial({ color: 0x66bb6a, roughness: 0.6 });
  const grass = new THREE.Mesh(grassGeo, grassMat);
  grass.position.y = ISLAND_HEIGHT * 0.15;
  grass.receiveShadow = true;
  group.add(grass);

  // Grid lines on surface
  const y = ISLAND_HEIGHT * 0.35 + 0.02;
  const gHalf = ISLAND_SIZE * 1.5;
  const cnt = Math.floor(gHalf / GRID_SPACING) * 2 + 1;
  const off = Math.floor(cnt / 2) * GRID_SPACING;
  const gridMat = new THREE.LineBasicMaterial({ color: 0x81c784, transparent: true, opacity: 0.25 });

  for (let i = 0; i < cnt; i++) {
    const p = i * GRID_SPACING - off;
    const xGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-off, y, p), new THREE.Vector3(off, y, p),
    ]);
    group.add(new THREE.Line(xGeo, gridMat));
    const zGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(p, y, -off), new THREE.Vector3(p, y, off),
    ]);
    group.add(new THREE.Line(zGeo, gridMat));
  }
}

function createTreeMesh(node: ForestNode): THREE.Group {
  const group = new THREE.Group();
  group.userData = { nodeId: node.id, isTree: true };
  const color = statusColorHex(node.status);
  const scale = 0.6 + Math.log1p(node.noteCount) * 0.5;

  // Trunk
  const trunkH = 0.8 * scale;
  const trunkGeo = new THREE.CylinderGeometry(0.08, 0.12, trunkH, 6);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6d4c41, roughness: 0.8 });
  const trunk = new THREE.Mesh(trunkGeo, trunkMat);
  trunk.position.y = trunkH / 2;
  trunk.castShadow = true;
  group.add(trunk);

  // Canopy cones
  const layers = Math.min(3, Math.ceil(Math.log1p(node.noteCount)));
  for (let l = 0; l < layers; l++) {
    const coneH = 0.5 * scale;
    const coneR = 0.35 * scale * (1 - l * 0.2);
    const coneGeo = new THREE.ConeGeometry(coneR, coneH, 8);
    const coneMat = new THREE.MeshStandardMaterial({
      color, roughness: 0.5,
      opacity: node.status === "dormant" ? 0.4 : 0.7 + node.health * 0.3,
      transparent: true,
    });
    const cone = new THREE.Mesh(coneGeo, coneMat);
    cone.position.y = trunkH + l * coneH * 0.55;
    cone.castShadow = true;
    cone.receiveShadow = true;
    group.add(cone);
  }

  if (node.status === "dormant") {
    group.children.forEach((c) => {
      if (c instanceof THREE.Mesh && c.material.color) {
        c.material.color.set(0x9e9e9e);
      }
    });
  }

  return group;
}

function createVine(a: THREE.Vector3, b: THREE.Vector3, weight: number): THREE.Line {
  const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
  mid.y += 0.5 + weight * 0.1;
  const curve = new THREE.QuadraticBezierCurve3(a.clone(), mid, b.clone());
  const geo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(20));
  const mat = new THREE.LineBasicMaterial({
    color: 0x81c784,
    transparent: true,
    opacity: Math.min(0.5, 0.08 + weight / 20),
  });
  return new THREE.Line(geo, mat);
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
    scene.background = new THREE.Color(0x1a1b2e);
    scene.fog = new THREE.Fog(0x1a1b2e, 15, 40);
    sceneRef.current = scene;

    const aspect = w / h;
    const viewSize = 12;
    const camera = new THREE.OrthographicCamera(
      -viewSize * aspect, viewSize * aspect, viewSize, -viewSize, 0.1, 50,
    );
    camera.position.set(8, 10, 8);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.display = "block";
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lighting
    scene.add(new THREE.AmbientLight(0x668866, 0.8));
    scene.add(new THREE.HemisphereLight(0xffeedd, 0x445544, 0.6));
    const dirLight = new THREE.DirectionalLight(0xfff5e8, 1.3);
    dirLight.position.set(10, 15, 5);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(1024, 1024);
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 50;
    dirLight.shadow.camera.left = -15; dirLight.shadow.camera.right = 15;
    dirLight.shadow.camera.top = 15; dirLight.shadow.camera.bottom = -15;
    scene.add(dirLight);

    // Island
    const islandGroup = new THREE.Group();
    islandGroupRef.current = islandGroup;
    scene.add(islandGroup);
    createIsland(islandGroup);

    // Grid positions
    const gridPositions = assignGridPositions(graph.nodes);

    // Trees
    treesRef.current = [];
    for (const node of graph.nodes) {
      const pos = gridPositions.get(node.id) ?? new THREE.Vector3(
        (Math.random() - 0.5) * ISLAND_SIZE * 1.5, ISLAND_HEIGHT * 0.35,
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
        islandGroup.add(createVine(ft.mesh.position.clone(), tt.mesh.position.clone(), edge.weight));
      }
    }

    // Animate
    function animate() {
      animRef.current = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    }
    animate();

    return () => {
      cancelAnimationFrame(animRef.current);
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

  const hitTest = useCallback((e: React.MouseEvent): TreeData | null => {
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
      treesRef.current.map((t) => t.mesh), true,
    );
    if (hits.length > 0) {
      let obj: THREE.Object3D | null = hits[0].object;
      while (obj && !obj.userData?.isTree) obj = obj.parent;
      return treesRef.current.find((t) => t.mesh === obj) ?? null;
    }
    return null;
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (dragRef.current) {
      const dx = e.clientX - dragRef.current.prevX;
      rotateRef.current += dx * ROTATE_SPEED;
      if (islandGroupRef.current) islandGroupRef.current.rotation.y = rotateRef.current;
      dragRef.current = { prevX: e.clientX };
      return;
    }
    const hit = hitTest(e);
    if (containerRef.current) containerRef.current.style.cursor = hit ? "pointer" : "grab";

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
      tip.innerHTML = `<strong>${n.label}</strong><br/>Notes: ${n.noteCount}<br/>Health: ${(n.health*100).toFixed(0)}%<br/>Status: ${n.status}`;
      tip.style.left = e.clientX + 16 + "px";
      tip.style.top = e.clientY - 10 + "px";
    } else {
      tip.style.opacity = "0";
    }
  }, [hitTest]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!hitTest(e)) {
      dragRef.current = { prevX: e.clientX };
      if (containerRef.current) containerRef.current.style.cursor = "grabbing";
    }
  }, [hitTest]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (dragRef.current) {
      const moved = Math.abs(e.clientX - dragRef.current.prevX);
      dragRef.current = null;
      if (containerRef.current) containerRef.current.style.cursor = "grab";
      if (moved < 3) {
        const hit = hitTest(e);
        if (hit) onNodeClick(hit.node.id);
      }
    }
  }, [hitTest, onNodeClick]);

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
      const vs = 12;
      cam.left = -vs * aspect; cam.right = vs * aspect;
      cam.top = vs; cam.bottom = -vs;
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
