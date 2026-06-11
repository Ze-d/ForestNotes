import { useAppStore } from "../../stores/appStore";

export function DetailPanel() {
  const activeNotePath = useAppStore((s) => s.activeNotePath);
  const noteMeta = useAppStore((s) => s.noteMeta);
  const noteActivities = useAppStore((s) => s.noteActivities);
  const savedNoteContent = useAppStore((s) => s.savedNoteContent);

  if (!activeNotePath) {
    return (
      <aside className="detail-panel">
        <div className="detail-header">
          <h3>Info</h3>
        </div>
        <div className="detail-empty">
          <p>No note selected.</p>
          <p className="detail-hint">Select a note to see its details here.</p>
        </div>
      </aside>
    );
  }

  const title = activeNotePath.split(/[/\\]/).pop() ?? activeNotePath;

  return (
    <aside className="detail-panel">
      <div className="detail-header">
        <h3>Info</h3>
      </div>

      <div className="detail-body">
        {/* Basic fields */}
        <div className="detail-field">
          <label className="detail-label">Title</label>
          <span className="detail-value">
            {noteMeta?.title ?? title}
          </span>
        </div>
        <div className="detail-field">
          <label className="detail-label">Path</label>
          <span className="detail-value detail-value-mono">
            {activeNotePath}
          </span>
        </div>
        <div className="detail-field">
          <label className="detail-label">Word count</label>
          <span className="detail-value">
            {noteMeta?.word_count
              ? noteMeta.word_count.toLocaleString()
              : savedNoteContent
                ? savedNoteContent.trim().split(/\s+/).filter(Boolean).length.toLocaleString()
                : "—"}
          </span>
        </div>
        <div className="detail-field">
          <label className="detail-label">Read count</label>
          <span className="detail-value">
            {noteMeta?.read_count != null ? noteMeta.read_count : "—"}
          </span>
        </div>

        <div className="detail-divider" />

        {/* Dates */}
        <div className="detail-field">
          <label className="detail-label">Created</label>
          <span className="detail-value detail-value-date">
            {noteMeta?.created_at
              ? formatDate(noteMeta.created_at)
              : "—"}
          </span>
        </div>
        <div className="detail-field">
          <label className="detail-label">Updated</label>
          <span className="detail-value detail-value-date">
            {noteMeta?.updated_at
              ? formatDate(noteMeta.updated_at)
              : "—"}
          </span>
        </div>
        <div className="detail-field">
          <label className="detail-label">Last read</label>
          <span className="detail-value detail-value-date">
            {noteMeta?.last_read_at
              ? formatDate(noteMeta.last_read_at)
              : "—"}
          </span>
        </div>

        <div className="detail-divider" />

        {/* Tags */}
        <div className="detail-section">
          <h4 className="detail-section-title">Tags</h4>
          {noteMeta ? (
            <div className="detail-tags">
              {/* Tags will be populated from parsed data in later phases */}
              <span className="detail-tag-hint">
                Tags from indexing (Phase 9)
              </span>
            </div>
          ) : (
            <p className="detail-section-hint">
              Tags will appear after indexing.
            </p>
          )}
        </div>

        <div className="detail-divider" />

        {/* Recent activity */}
        <div className="detail-section">
          <h4 className="detail-section-title">Recent activity</h4>
          {noteActivities.length > 0 ? (
            <div className="detail-activity-list">
              {noteActivities.slice(0, 5).map((a) => (
                <div key={a.id} className="detail-activity-item">
                  <span className={`detail-activity-type ${a.type}`}>
                    {activityIcon(a.type)} {a.type}
                  </span>
                  <span className="detail-activity-time">
                    {formatRelativeTime(a.created_at)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="detail-section-hint">
              {noteMeta
                ? "Activity will be recorded as you read and edit this note."
                : "Open a note to see its activity history."}
            </p>
          )}
        </div>
      </div>
    </aside>
  );
}

function activityIcon(type: string): string {
  switch (type) {
    case "create":
      return "📝";
    case "read":
      return "👁️";
    case "update":
      return "✏️";
    case "delete":
      return "🗑";
    default:
      return "•";
  }
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso.slice(0, 16);
  }
}

function formatRelativeTime(iso: string): string {
  try {
    const d = new Date(iso);
    const now = Date.now();
    const diffMs = now - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 30) return `${diffDay}d ago`;
    return d.toLocaleDateString();
  } catch {
    return iso.slice(0, 10);
  }
}
