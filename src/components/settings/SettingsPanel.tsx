import { useAppStore } from "../../stores/appStore";
import { openVaultDialog } from "../../features/vault/vaultApi";

export function SettingsPanel() {
  const vaultPath = useAppStore((s) => s.vaultPath);
  const vaultName = useAppStore((s) => s.vaultName);
  const vaultFiles = useAppStore((s) => s.vaultFiles);
  const scanVault = useAppStore((s) => s.scanVault);
  const rebuildIndex = useAppStore((s) => s.rebuildIndex);
  const isIndexing = useAppStore((s) => s.isIndexing);

  const handleOpenVault = async () => {
    const path = await openVaultDialog();
    if (path) {
      await scanVault(path);
    }
  };

  return (
    <div className="editor-panel">
      <div className="settings-panel">
        <h2>⚙️ Settings</h2>

        {/* Vault */}
        <section className="settings-section">
          <h3>Vault</h3>
          {vaultPath ? (
            <div className="settings-info">
              <div className="settings-field">
                <span className="settings-label">Current vault:</span>
                <span className="settings-value">
                  📁 {vaultName} ({vaultFiles.length} notes)
                </span>
              </div>
              <div className="settings-field">
                <span className="settings-label">Path:</span>
                <span className="settings-value settings-value-path">
                  {vaultPath}
                </span>
              </div>
              <div className="settings-actions">
                <button
                  className="editor-btn editor-btn-primary"
                  onClick={handleOpenVault}
                >
                  📂 Open Different Vault
                </button>
              </div>
            </div>
          ) : (
            <div className="settings-info">
              <p className="settings-hint">
                No vault opened yet. Open a local folder containing{" "}
                <code>.md</code> files to get started.
              </p>
              <button
                className="editor-btn editor-btn-primary"
                onClick={handleOpenVault}
              >
                📂 Open Vault
              </button>
            </div>
          )}
        </section>

        {/* Indexing */}
        {vaultPath && (
          <section className="settings-section">
            <h3>Indexing</h3>
            <p className="settings-hint">
              The search index is automatically built when you open a vault.
              You can manually rebuild it if data seems out of sync.
            </p>
            <button
              className="editor-btn"
              onClick={rebuildIndex}
              disabled={isIndexing}
            >
              {isIndexing ? "⏳ Rebuilding..." : "🔄 Rebuild Index"}
            </button>
          </section>
        )}

        {/* About */}
        <section className="settings-section">
          <h3>About ForestNotes</h3>
          <div className="settings-info">
            <div className="settings-field">
              <span className="settings-label">Version:</span>
              <span className="settings-value">0.1.0 (MVP)</span>
            </div>
            <div className="settings-field">
              <span className="settings-label">Tech:</span>
              <span className="settings-value">
                Tauri 2 / React / TypeScript / SQLite / D3.js / CodeMirror 6
              </span>
            </div>
          </div>
          <p className="settings-hint" style={{ marginTop: 12 }}>
            All your notes are stored as plain <code>.md</code> files.
            ForestNotes never uploads your data — your knowledge stays local.
          </p>
        </section>
      </div>
    </div>
  );
}
