import type { ForestNode } from "../../db/client";
import { useAppStore } from "../../stores/appStore";

interface Props {
  node: ForestNode | null;
  onClose: () => void;
}

export function ForestDetailPanel({ node, onClose }: Props) {
  const setViewMode = useAppStore((s) => s.setViewMode);
  const setSearchQuery = useAppStore((s) => s.setSearchQuery);
  const setSearchTagFilter = useAppStore((s) => s.setSearchTagFilter);

  if (!node) {
    return (
      <aside className="forest-detail">
        <div className="forest-detail-header">
          <h3>Tag detail</h3>
        </div>
        <div className="forest-detail-empty">
          <p>Click a tree to see details.</p>
          <p className="forest-hint">
            Related notes and connected tags will appear here.
          </p>
        </div>
      </aside>
    );
  }

  const handleSearchByTag = () => {
    setSearchTagFilter(node.id);
    setSearchQuery("");
    setViewMode("notes");
  };

  return (
    <aside className="forest-detail">
      <div className="forest-detail-header">
        <h3>Tag detail</h3>
        <button className="forest-detail-close" onClick={onClose}>
          ✕
        </button>
      </div>

      <div className="forest-detail-body">
        {/* Tag name */}
        <h2 className="forest-detail-tag-name">
          <span
            className="forest-detail-status-dot"
            style={{ background: statusColor(node.status) }}
          />
          {node.label}
        </h2>

        <div className="forest-detail-stats">
          <div className="forest-detail-stat">
            <span className="forest-detail-stat-label">Notes</span>
            <span className="forest-detail-stat-value">{node.noteCount}</span>
          </div>
          <div className="forest-detail-stat">
            <span className="forest-detail-stat-label">Health</span>
            <span className="forest-detail-stat-value">
              {(node.health * 100).toFixed(0)}%
            </span>
          </div>
          <div className="forest-detail-stat">
            <span className="forest-detail-stat-label">Status</span>
            <span
              className="forest-detail-stat-value"
              style={{ color: statusColor(node.status) }}
            >
              {node.status}
            </span>
          </div>
        </div>

        <div className="detail-divider" />

        {/* Activity stats */}
        <div className="forest-detail-stats">
          <div className="forest-detail-stat">
            <span className="forest-detail-stat-label">Reads (30d)</span>
            <span className="forest-detail-stat-value">
              {node.readCount30d}
            </span>
          </div>
          <div className="forest-detail-stat">
            <span className="forest-detail-stat-label">Updates (30d)</span>
            <span className="forest-detail-stat-value">
              {node.updateCount30d}
            </span>
          </div>
          <div className="forest-detail-stat">
            <span className="forest-detail-stat-label">Stale days</span>
            <span className="forest-detail-stat-value">{node.staleDays}d</span>
          </div>
        </div>

        <div className="detail-divider" />

        {/* Actions */}
        <div className="forest-detail-actions">
          <button
            className="editor-btn editor-btn-primary"
            onClick={handleSearchByTag}
          >
            🔍 Search notes with this tag
          </button>
        </div>

        <div className="detail-divider" />

        {/* Related notes hint */}
        <div className="forest-detail-section">
          <h4>Related notes</h4>
          <p className="detail-section-hint">
            Switch to Notes view and search by this tag to see all related
            notes.
          </p>
        </div>
      </div>
    </aside>
  );
}

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
