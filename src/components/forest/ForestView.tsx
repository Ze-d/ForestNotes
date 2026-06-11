import { useEffect, useState } from "react";
import { useAppStore } from "../../stores/appStore";
import { ForestCanvas } from "./ForestCanvas";
import { ForestDetailPanel } from "./ForestDetailPanel";
import type { ForestNode } from "../../db/client";

export function ForestView() {
  const vaultPath = useAppStore((s) => s.vaultPath);
  const vaultId = useAppStore((s) => s.vaultId);
  const forestGraph = useAppStore((s) => s.forestGraph);
  const isForestLoading = useAppStore((s) => s.isForestLoading);
  const loadForestGraph = useAppStore((s) => s.loadForestGraph);
  const forestFilter = useAppStore((s) => s.forestFilter);
  const setForestFilter = useAppStore((s) => s.setForestFilter);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Load forest graph when vault is open
  useEffect(() => {
    if (vaultId) {
      loadForestGraph();
    }
  }, [vaultId, loadForestGraph]);

  // Apply client-side filter
  const filteredGraph = forestGraph
    ? {
        ...forestGraph,
        nodes:
          forestFilter === "all"
            ? forestGraph.nodes
            : forestGraph.nodes.filter((n) => n.status === forestFilter),
        edges: forestGraph.edges,
      }
    : null;

  // Find selected node details
  const selectedNode: ForestNode | null =
    forestGraph?.nodes.find((n) => n.id === selectedNodeId) ?? null;

  if (!vaultPath) {
    return (
      <div className="forest-view">
        <div className="forest-canvas forest-canvas-empty">
          <div className="forest-empty-icon">🌲</div>
          <h2>Knowledge Forest</h2>
          <p>
            Each tag becomes a tree. Active tags grow lush. Neglected tags
            fade.
          </p>
          <div className="forest-legend">
            <span className="forest-legend-item">
              <span className="forest-legend-dot healthy" /> Healthy
            </span>
            <span className="forest-legend-item">
              <span className="forest-legend-dot normal" /> Normal
            </span>
            <span className="forest-legend-item">
              <span className="forest-legend-dot stale" /> Stale
            </span>
            <span className="forest-legend-item">
              <span className="forest-legend-dot dormant" /> Dormant
            </span>
          </div>
          <p className="forest-hint">
            Open a vault with tagged notes to see your forest.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="forest-view">
      {/* Toolbar */}
      <div className="forest-toolbar">
        <div className="forest-toolbar-group">
          <label className="forest-toolbar-label">Status:</label>
          <select
            className="forest-select"
            value={forestFilter}
            onChange={(e) =>
              setForestFilter(
                e.target.value as typeof forestFilter,
              )
            }
          >
            <option value="all">All trees</option>
            <option value="healthy">Healthy</option>
            <option value="normal">Normal</option>
            <option value="stale">Stale</option>
            <option value="dormant">Dormant</option>
          </select>
        </div>
        <div className="forest-toolbar-group">
          <button
            className="editor-btn"
            onClick={loadForestGraph}
            disabled={isForestLoading}
          >
            {isForestLoading ? "⏳" : "🔄"} Refresh
          </button>
        </div>
        {forestGraph && (
          <div className="forest-toolbar-group">
            <span className="forest-toolbar-label">
              {forestGraph.nodes.length} trees, {forestGraph.edges.length}{" "}
              connections
            </span>
          </div>
        )}
      </div>

      {/* Main canvas + detail panel */}
      <div className="forest-content">
        <div className="forest-canvas">
          {isForestLoading ? (
            <div className="forest-placeholder">
              <p>🌲 Generating forest...</p>
            </div>
          ) : forestGraph && forestGraph.nodes.length === 0 ? (
            <div className="forest-placeholder">
              <p>🌲 No tags found. Add tags to your notes to grow the forest.</p>
            </div>
          ) : (
            <ForestCanvas
              graph={filteredGraph}
              onNodeClick={setSelectedNodeId}
              selectedNodeId={selectedNodeId}
            />
          )}
        </div>
        <ForestDetailPanel
          node={selectedNode}
          onClose={() => setSelectedNodeId(null)}
        />
      </div>
    </div>
  );
}
