import { useEffect, useRef, useCallback } from "react";
import * as d3 from "d3";
import type { ForestGraph } from "../../db/client";

/** D3 requires x, y, fx, fy; extend the base type */
interface SimNode extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  noteCount: number;
  health: number;
  status: string;
  size: number;
  readCount30d: number;
  updateCount30d: number;
  lastActiveAt: string | null;
  staleDays: number;
}

interface SimEdge extends d3.SimulationLinkDatum<SimNode> {
  source: string;
  target: string;
  weight: number;
}

interface Props {
  graph: ForestGraph | null;
  onNodeClick: (nodeId: string) => void;
  selectedNodeId: string | null;
}

/** Map tree status to fill color */
function statusColor(status: string): string {
  switch (status) {
    case "healthy":
      return "#2f9e44";
    case "normal":
      return "#74b816";
    case "stale":
      return "#f59f00";
    case "dormant":
      return "#adb5bd";
    default:
      return "#868e96";
  }
}

/** Map noteCount to pixel radius */
function nodeRadius(noteCount: number): number {
  const minR = 16;
  const maxR = 72;
  const size = Math.log1p(noteCount);
  const maxSize = Math.log1p(100);
  return minR + (size / maxSize) * (maxR - minR);
}

export function ForestCanvas({ graph, onNodeClick, selectedNodeId }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);

  const renderForest = useCallback(() => {
    const svgEl = svgRef.current;
    if (!svgEl || !graph || graph.nodes.length === 0) {
      // Clear SVG
      if (svgEl) {
        d3.select(svgEl).selectAll("*").remove();
      }
      return;
    }

    const svg = d3.select(svgEl);
    svg.selectAll("*").remove();

    const container = svgEl.parentElement!;
    const width = container.clientWidth;
    const height = container.clientHeight;

    svg.attr("viewBox", [0, 0, width, height]);

    // Prepare data — cast to SimNode/SimEdge for D3
    const nodes: SimNode[] = graph.nodes.map((n) => ({ ...n }));
    const edges: SimEdge[] = graph.edges.map((e) => ({
      source: e.source,
      target: e.target,
      weight: e.weight,
    }));

    // Edge color
    const edgeColor = (weight: number) => {
      const alpha = Math.min(0.6, 0.1 + weight / 20);
      return `rgba(107, 114, 128, ${alpha})`;
    };

    // Create simulation
    const simulation = d3
      .forceSimulation<SimNode>(nodes)
      .force(
        "link",
        d3
          .forceLink<SimNode, SimEdge>(edges)
          .id((d) => d.id)
          .distance((d) => Math.max(40, 220 - d.weight * 12)),
      )
      .force("charge", d3.forceManyBody<SimNode>().strength(-300))
      .force(
        "collision",
        d3.forceCollide<SimNode>().radius((d) => nodeRadius(d.noteCount) + 4),
      )
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("x", d3.forceX<SimNode>(width / 2).strength(0.05))
      .force("y", d3.forceY<SimNode>(height / 2).strength(0.05));

    // Draw edges (vines)
    const linkGroup = svg.append("g").attr("class", "links");

    const link = linkGroup
      .selectAll<SVGLineElement, SimEdge>("line")
      .data(edges)
      .join("line")
      .attr("stroke", (d) => edgeColor(d.weight))
      .attr("stroke-width", (d) => 1 + Math.log1p(d.weight))
      .attr("stroke-linecap", "round");

    // Draw nodes (trees)
    const nodeGroup = svg.append("g").attr("class", "nodes");

    const node = nodeGroup
      .selectAll<SVGGElement, SimNode>("g")
      .data(nodes)
      .join("g")
      .attr("cursor", "pointer")
      .call(
        d3
          .drag<SVGGElement, SimNode>()
          .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          }),
      )
      .on("click", (_event, d) => onNodeClick(d.id));

    // Node circle
    node
      .append("circle")
      .attr("r", (d) => nodeRadius(d.noteCount))
      .attr("fill", (d) => statusColor(d.status))
      .attr("opacity", (d) => 0.5 + 0.5 * d.health)
      .attr("stroke", (d) =>
        d.id === selectedNodeId ? "#212529" : statusColor(d.status),
      )
      .attr("stroke-width", (d) => (d.id === selectedNodeId ? 3 : 1.5));

    // Node label
    node
      .append("text")
      .text((d) => d.label.length > 12 ? d.label.slice(0, 12) + "…" : d.label)
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em")
      .attr("font-size", (d) => Math.max(9, nodeRadius(d.noteCount) * 0.55))
      .attr("fill", "#fff")
      .attr("font-weight", "600")
      .attr("pointer-events", "none")
      .attr("font-family", "system-ui, sans-serif");

    // Tooltip
    const tooltip = d3
      .select("body")
      .append("div")
      .attr("class", "forest-tooltip")
      .style("position", "absolute")
      .style("pointer-events", "none")
      .style("opacity", "0")
      .style("background", "var(--color-bg)")
      .style("border", "1px solid var(--color-border)")
      .style("border-radius", "6px")
      .style("padding", "8px 12px")
      .style("font-size", "12px")
      .style("box-shadow", "0 4px 12px rgba(0,0,0,0.15)")
      .style("z-index", "1000");

    node
      .on("mouseenter", (_event, d) => {
        tooltip
          .style("opacity", "1")
          .html(
            `<strong>${d.label}</strong><br/>` +
              `Notes: ${d.noteCount}<br/>` +
              `Health: ${(d.health * 100).toFixed(0)}%<br/>` +
              `Status: ${d.status}<br/>` +
              `Reads (30d): ${d.readCount30d}<br/>` +
              `Updates (30d): ${d.updateCount30d}`,
          );
      })
      .on("mousemove", (event) => {
        tooltip
          .style("left", event.pageX + 12 + "px")
          .style("top", event.pageY - 10 + "px");
      })
      .on("mouseleave", () => {
        tooltip.style("opacity", "0");
      });

    // Update positions on simulation tick
    simulation.on("tick", () => {
      link
        .attr("x1", (d) => (d.source as unknown as SimNode).x ?? 0)
        .attr("y1", (d) => (d.source as unknown as SimNode).y ?? 0)
        .attr("x2", (d) => (d.target as unknown as SimNode).x ?? 0)
        .attr("y2", (d) => (d.target as unknown as SimNode).y ?? 0);

      node.attr("transform", (d) => `translate(${d.x},${d.y})`);
    });

    // Cleanup on unmount
    return () => {
      simulation.stop();
      tooltip.remove();
    };
  }, [graph, onNodeClick, selectedNodeId]);

  useEffect(() => {
    const cleanup = renderForest();
    return () => cleanup?.();
  }, [renderForest]);

  // Handle resize
  useEffect(() => {
    const handleResize = () => renderForest();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [renderForest]);

  return <svg ref={svgRef} className="forest-svg" />;
}
