import { useState } from "react";
import { useAppStore } from "../../stores/appStore";
import { openVaultDialog, sortFiles } from "../../features/vault/vaultApi";
import type { VaultFileEntry } from "../../types";

export function Sidebar() {
  const vaultPath = useAppStore((s) => s.vaultPath);
  const vaultName = useAppStore((s) => s.vaultName);
  const vaultFiles = useAppStore((s) => s.vaultFiles);
  const isScanning = useAppStore((s) => s.isScanning);
  const isIndexing = useAppStore((s) => s.isIndexing);
  const scanError = useAppStore((s) => s.scanError);
  const indexProgress = useAppStore((s) => s.indexProgress);
  const indexErrors = useAppStore((s) => s.indexErrors);
  const scanVault = useAppStore((s) => s.scanVault);
  const rebuildIndex = useAppStore((s) => s.rebuildIndex);
  const explorerSort = useAppStore((s) => s.explorerSort);
  const setExplorerSort = useAppStore((s) => s.setExplorerSort);
  const activeNotePath = useAppStore((s) => s.activeNotePath);
  const selectNote = useAppStore((s) => s.selectNote);
  const createNote = useAppStore((s) => s.createNote);
  const renameNote = useAppStore((s) => s.renameNote);
  const deleteNote = useAppStore((s) => s.deleteNote);

  const [contextMenu, setContextMenu] = useState<{
    path: string;
    x: number;
    y: number;
  } | null>(null);

  const handleOpenVault = async () => {
    const path = await openVaultDialog();
    if (path) {
      await scanVault(path);
    }
  };

  const handleCreateNote = async () => {
    const newPath = await createNote();
    if (newPath) {
      const { selectNote } = useAppStore.getState();
      await selectNote(newPath);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, path: string) => {
    e.preventDefault();
    setContextMenu({ path, x: e.clientX, y: e.clientY });
  };

  const handleRename = async (oldPath: string) => {
    setContextMenu(null);
    const newName = window.prompt("Rename to:", oldPath);
    if (newName && newName !== oldPath) {
      // Ensure .md extension
      const finalName = newName.endsWith(".md") ? newName : `${newName}.md`;
      const dir = oldPath.split(/[/\\]/).slice(0, -1).join("/");
      const newPath = dir ? `${dir}/${finalName}` : finalName;
      await renameNote(oldPath, newPath);
    }
  };

  const handleDelete = async (path: string) => {
    setContextMenu(null);
    await deleteNote(path);
  };

  const sortedFiles = sortFiles(
    vaultFiles,
    explorerSort === "title" ? "title" : "updated",
  );

  return (
    <aside className="sidebar" onClick={() => setContextMenu(null)}>
      {/* Header */}
      <div className="sidebar-header">
        <h3>Files</h3>
        <button
          className="sidebar-btn sidebar-btn-primary"
          onClick={handleOpenVault}
          disabled={isScanning}
        >
          {isScanning ? "⏳" : "📂"} Open
        </button>
      </div>

      {/* Vault info */}
      {vaultPath && (
        <div className="sidebar-vault-info">
          <span className="sidebar-vault-name" title={vaultPath}>
            📁 {vaultName}
          </span>
          <span className="sidebar-vault-count">
            {vaultFiles.length} note{vaultFiles.length !== 1 ? "s" : ""}
          </span>
        </div>
      )}

      {/* Toolbar */}
      {vaultPath && (
        <>
          <div className="sidebar-toolbar">
            <button
              className="sidebar-btn sidebar-btn-primary"
              onClick={handleCreateNote}
            >
              ＋ New
            </button>
            <select
              className="sidebar-select"
              value={explorerSort}
              onChange={(e) =>
                setExplorerSort(e.target.value as typeof explorerSort)
              }
            >
              <option value="updated">Updated</option>
              <option value="created">Created</option>
              <option value="title">Title</option>
              <option value="readCount">Read count</option>
            </select>
          </div>

          {/* Rebuild index button */}
          <div className="sidebar-toolbar">
            <button
              className="sidebar-btn"
              onClick={rebuildIndex}
              disabled={isIndexing}
              title="Clear and rebuild the search index from scratch"
            >
              🔄 Rebuild Index
            </button>
          </div>

          {/* Indexing progress */}
          {isIndexing && indexProgress && (
            <div className="sidebar-index-progress">
              <div className="sidebar-progress-bar">
                <div
                  className="sidebar-progress-fill"
                  style={{
                    width: `${indexProgress.total > 0 ? (indexProgress.current / indexProgress.total) * 100 : 0}%`,
                  }}
                />
              </div>
              <span className="sidebar-progress-text">
                Indexing {indexProgress.current}/{indexProgress.total}
              </span>
            </div>
          )}

          {/* Index errors */}
          {indexErrors.length > 0 && !isIndexing && (
            <div className="sidebar-index-errors">
              <details>
                <summary>
                  ⚠️ {indexErrors.length} index error{indexErrors.length > 1 ? "s" : ""}
                </summary>
                <ul className="sidebar-error-list">
                  {indexErrors.slice(0, 10).map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                  {indexErrors.length > 10 && (
                    <li>...and {indexErrors.length - 10} more</li>
                  )}
                </ul>
              </details>
            </div>
          )}
        </>
      )}

      {/* Content */}
      {isScanning ? (
        <div className="sidebar-empty">
          <p>Scanning vault...</p>
        </div>
      ) : scanError ? (
        <div className="sidebar-error">
          <p>Failed to scan vault:</p>
          <p className="sidebar-error-msg">{scanError}</p>
          <button className="sidebar-btn" onClick={handleOpenVault}>
            Try again
          </button>
        </div>
      ) : !vaultPath ? (
        <div className="sidebar-empty">
          <div className="sidebar-empty-icon">📂</div>
          <p>No vault opened</p>
          <p className="sidebar-hint">
            Open a local folder containing <code>.md</code> files.
          </p>
        </div>
      ) : sortedFiles.length === 0 ? (
        <div className="sidebar-list">
          <div className="sidebar-list-empty">
            <p>No <code>.md</code> files found.</p>
            <p className="sidebar-hint">
              <button className="sidebar-btn sidebar-btn-primary" onClick={handleCreateNote}>
                ＋ Create your first note
              </button>
            </p>
          </div>
        </div>
      ) : (
        <div className="sidebar-list">
          {sortedFiles.map((file) => (
            <FileTreeItem
              key={file.path}
              file={file}
              isActive={activeNotePath === file.path}
              onClick={() => selectNote(file.path)}
              onContextMenu={(e) => handleContextMenu(e, file.path)}
            />
          ))}
        </div>
      )}

      {/* Tags section */}
      {vaultPath && (
        <div className="sidebar-section">
          <div className="sidebar-section-header">
            <h4>Tags</h4>
          </div>
          <div className="sidebar-tags-empty">
            <p className="sidebar-hint">
              Tags will appear here after indexing (Phase 4-5).
            </p>
          </div>
        </div>
      )}

      {/* Context menu */}
      {contextMenu && (
        <div
          className="context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="context-menu-item"
            onClick={() => handleRename(contextMenu.path)}
          >
            ✏️ Rename
          </button>
          <button
            className="context-menu-item context-menu-item-danger"
            onClick={() => handleDelete(contextMenu.path)}
          >
            🗑 Delete
          </button>
        </div>
      )}
    </aside>
  );
}

/** A single file tree item */
function FileTreeItem({
  file,
  isActive,
  onClick,
  onContextMenu,
}: {
  file: VaultFileEntry;
  isActive: boolean;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  const parts = file.path.split(/[/\\]/);
  const fileName = parts.pop() ?? file.name;
  const dirPath = parts.join("/");

  return (
    <button
      className={`file-item ${isActive ? "active" : ""}`}
      onClick={onClick}
      onContextMenu={onContextMenu}
      title={file.path}
    >
      <span className="file-item-icon">📄</span>
      <span className="file-item-body">
        {dirPath && <span className="file-item-dir">{dirPath}/</span>}
        <span className="file-item-name">{fileName}</span>
      </span>
      {file.size > 0 && (
        <span className="file-item-size">{formatBytes(file.size)}</span>
      )}
    </button>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
