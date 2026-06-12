// src/components/forest/ForestCanvas.tsx
import { useEffect, useRef, useCallback } from "react";
import * as d3 from "d3";
import type { ForestGraph, ForestNode } from "../../db/client";
import {
  drawTree,
  drawVine,
  drawGround,
  drawSky,
  crownRadius,
  hitTest,
  hashSeed,
} from "./treeRenderer";

interface SimNode extends d3.SimulationNodeDatum, ForestNode {}

interface SimEdge extends d3.SimulationLinkDatum<SimNode> {
  weight: number;
}

interface Props {
  graph: ForestGraph;
  onNodeClick: (nodeId: string) => void;
  selectedNodeId: string | null;
}

const GROUND_RATIO = 0.85;

export function ForestCanvas({ graph, onNodeClick, selectedNodeId }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simRef = useRef<d3.Simulation<SimNode, SimEdge> | null>(null);
  const nodesRef = useRef<SimNode[]>([]);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef<SimNode | null>(null);

  // Main render + simulation setup
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (simRef.current) {
      simRef.current.stop();
      simRef.current = null;
    }

    const ctx = canvas.getContext("2d")!;
    const container = canvas.parentElement!;
    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + "px";
    canvas.style.height = rect.height + "px";
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const groundY = h * GROUND_RATIO;

    const nodes: SimNode[] = graph.nodes.map((n) => ({
      ...n,
      x: w / 2 + (Math.random() - 0.5) * 100,
      y: groundY - crownRadius(n.noteCount) - Math.random() * 200,
    }));
    nodesRef.current = nodes;

    const edges: SimEdge[] = graph.edges.map((e) => ({
      source: e.source,
      target: e.target,
      weight: e.weight,
    }));

    const simulation = d3
      .forceSimulation<SimNode>(nodes)
      .force(
        "link",
        d3
          .forceLink<SimNode, SimEdge>(edges)
          .id((d) => d.id)
          .distance((d) => Math.max(60, 250 - d.weight * 15)),
      )
      .force("charge", d3.forceManyBody<SimNode>().strength(-400))
      .force(
        "collision",
        d3
          .forceCollide<SimNode>()
          .radius((d) => crownRadius(d.noteCount) + 12),
      )
      .force("y", d3.forceY<SimNode>(groundY - 120).strength(0.08))
      .force("x", d3.forceX<SimNode>(w / 2).strength(0.05))
      .on("tick", () => {
        for (const n of nodes) {
          const cr = crownRadius(n.noteCount);
          n.x = Math.max(cr, Math.min(w - cr, n.x ?? w / 2));
          n.y = Math.min(groundY - cr, n.y ?? groundY - 100);
        }
        renderFrame();
      });

    const sim = simulation;
    simRef.current = sim;

    function renderFrame() {
      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      drawSky(ctx, w, groundY);
      drawGround(ctx, w, h, groundY);

      // Vines
      for (const e of edges) {
        const s = e.source as SimNode;
        const t = e.target as SimNode;
        const sx = s.x ?? 0;
        const sy = s.y ?? 0;
        const tx = t.x ?? 0;
        const ty = t.y ?? 0;
        const sr = crownRadius(s.noteCount);
        const tr = crownRadius(t.noteCount);
        drawVine(ctx, sx, sy, sr, tx, ty, tr, e.weight, s.health, t.health);
      }

      // Trees
      for (const n of nodes) {
        const nx = n.x ?? 0;
        const ny = n.y ?? 0;
        const seed = hashSeed(n.id);

        // Ground shadow
        ctx.fillStyle = "rgba(0,0,0,0.1)";
        ctx.beginPath();
        ctx.ellipse(
          nx,
          ny + crownRadius(n.noteCount) * 0.3,
          crownRadius(n.noteCount) * 0.5,
          4,
          0,
          0,
          Math.PI * 2,
        );
        ctx.fill();

        drawTree(ctx, nx, ny, n.noteCount, n.health, n.status, seed, n.id === selectedNodeId);
      }

      // Labels
      ctx.fillStyle = "#333";
      ctx.font = "10px system-ui, sans-serif";
      ctx.textAlign = "center";
      for (const n of nodes) {
        const nx = n.x ?? 0;
        const ny = n.y ?? 0;
        const cr = crownRadius(n.noteCount);
        const label = n.label.length > 10 ? n.label.slice(0, 10) + "…" : n.label;
        ctx.fillText(label, nx, ny + cr + 14);
      }

      ctx.restore();
    }

    // Warm up simulation
    simulation.alpha(1).restart();
    for (let i = 0; i < 100; i++) simulation.tick();

    return () => {
      simulation.stop();
      simRef.current = null;
    };
  }, [graph, selectedNodeId]);

  // Mouse position helper
  const getCanvasPos = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>): { x: number; y: number } => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    },
    [],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const { x, y } = getCanvasPos(e);
      const idx = hitTest(x, y, nodesRef.current);

      if (draggingRef.current) {
        const sim = simRef.current;
        draggingRef.current.fx = x;
        draggingRef.current.fy = y;
        if (sim) sim.alpha(0.1).restart();
        return;
      }

      const canvas = canvasRef.current;
      if (canvas) {
        canvas.style.cursor = idx >= 0 ? "pointer" : "default";
      }

      if (!tooltipRef.current) {
        tooltipRef.current = document.createElement("div");
        tooltipRef.current.className = "forest-tooltip";
        tooltipRef.current.style.cssText =
          "position:absolute;pointer-events:none;opacity:0;background:var(--color-bg,#fff);border:1px solid var(--color-border,#ddd);border-radius:6px;padding:8px 12px;font-size:12px;box-shadow:0 4px 12px rgba(0,0,0,0.15);z-index:1000;";
        document.body.appendChild(tooltipRef.current);
      }

      const tip = tooltipRef.current;
      if (idx >= 0) {
        const n = nodesRef.current[idx];
        tip.style.opacity = "1";
        tip.innerHTML = `<strong>${n.label}</strong><br/>Notes: ${n.noteCount}<br/>Health: ${(n.health * 100).toFixed(0)}%<br/>Status: ${n.status}<br/>Reads (30d): ${n.readCount30d}<br/>Updates (30d): ${n.updateCount30d}`;
        tip.style.left = e.clientX + 12 + "px";
        tip.style.top = e.clientY - 10 + "px";
      } else {
        tip.style.opacity = "0";
      }
    },
    [getCanvasPos],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const { x, y } = getCanvasPos(e);
      const idx = hitTest(x, y, nodesRef.current);
      if (idx >= 0) {
        draggingRef.current = nodesRef.current[idx];
        draggingRef.current.fx = x;
        draggingRef.current.fy = y;
        const sim = simRef.current;
        if (sim) sim.alphaTarget(0.3).restart();
      }
    },
    [getCanvasPos],
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (draggingRef.current) {
        const { x, y } = getCanvasPos(e);
        const startX = draggingRef.current.fx ?? 0;
        const startY = draggingRef.current.fy ?? 0;
        const dist = Math.sqrt((x - startX) ** 2 + (y - startY) ** 2);

        if (dist < 4) {
          onNodeClick(draggingRef.current.id);
        }

        draggingRef.current.fx = null;
        draggingRef.current.fy = null;
        draggingRef.current = null;

        const sim = simRef.current;
        if (sim) sim.alphaTarget(0);
      }
    },
    [getCanvasPos, onNodeClick],
  );

  const handleMouseLeave = useCallback(() => {
    if (tooltipRef.current) {
      tooltipRef.current.style.opacity = "0";
    }
    if (draggingRef.current) {
      draggingRef.current.fx = null;
      draggingRef.current.fy = null;
      draggingRef.current = null;
      const sim = simRef.current;
      if (sim) sim.alphaTarget(0);
    }
  }, []);

  // Cleanup tooltip on unmount
  useEffect(() => {
    return () => {
      if (tooltipRef.current) {
        tooltipRef.current.remove();
        tooltipRef.current = null;
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="forest-canvas-el"
      onMouseMove={handleMouseMove}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    />
  );
}
