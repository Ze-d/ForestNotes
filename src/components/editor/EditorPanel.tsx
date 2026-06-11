import { useEffect } from "react";
import { useAppStore } from "../../stores/appStore";
import { MarkdownEditor } from "./MarkdownEditor";

export function EditorPanel() {
  const vaultPath = useAppStore((s) => s.vaultPath);
  const activeNotePath = useAppStore((s) => s.activeNotePath);
  const activeNoteContent = useAppStore((s) => s.activeNoteContent);
  const activeNoteLoading = useAppStore((s) => s.activeNoteLoading);
  const isDirty = useAppStore((s) => s.isDirty);
  const saveStatus = useAppStore((s) => s.saveStatus);
  const saveError = useAppStore((s) => s.saveError);
  const setEditorContent = useAppStore((s) => s.setEditorContent);
  const saveNote = useAppStore((s) => s.saveNote);
  const createNote = useAppStore((s) => s.createNote);
  const deleteNote = useAppStore((s) => s.deleteNote);

  // Ctrl+S from anywhere in the app
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (activeNotePath && isDirty) {
          saveNote();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeNotePath, isDirty, saveNote]);

  const handleSave = () => {
    if (activeNotePath) saveNote();
  };

  const handleCreateNote = async () => {
    const newPath = await createNote();
    if (newPath) {
      // Select the new note
      const { selectNote } = useAppStore.getState();
      await selectNote(newPath);
    }
  };

  const handleDeleteNote = async () => {
    if (!activeNotePath) return;
    const ok = await deleteNote(activeNotePath);
    if (!ok) return;
  };

  // Loading state
  if (activeNoteLoading) {
    return (
      <main className="editor-panel">
        <div className="editor-empty">
          <p>Loading note...</p>
        </div>
      </main>
    );
  }

  // Active note with editor
  if (activeNotePath && activeNoteContent !== null) {
    return (
      <main className="editor-panel editor-panel-with-toolbar">
        {/* Editor toolbar */}
        <div className="editor-toolbar">
          <div className="editor-toolbar-left">
            <span className="editor-toolbar-path" title={activeNotePath}>
              {activeNotePath}
            </span>
            {isDirty && <span className="editor-dirty-indicator">●</span>}
          </div>

          <div className="editor-toolbar-right">
            {/* Save status */}
            {saveStatus === "saving" && (
              <span className="editor-status saving">Saving...</span>
            )}
            {saveStatus === "saved" && (
              <span className="editor-status saved">✓ Saved</span>
            )}
            {saveStatus === "error" && (
              <span className="editor-status error" title={saveError ?? ""}>
                ✕ Save failed
              </span>
            )}

            <button
              className="editor-btn editor-btn-primary"
              onClick={handleSave}
              disabled={!isDirty || saveStatus === "saving"}
            >
              💾 Save
            </button>
            <button
              className="editor-btn"
              onClick={handleCreateNote}
            >
              ＋ New
            </button>
            <button
              className="editor-btn editor-btn-danger"
              onClick={handleDeleteNote}
            >
              🗑 Delete
            </button>
          </div>
        </div>

        {/* CodeMirror editor */}
        <div className="editor-content">
          <MarkdownEditor
            value={activeNoteContent}
            onChange={setEditorContent}
            onSave={handleSave}
          />
        </div>
      </main>
    );
  }

  // Vault open but no note selected
  if (vaultPath) {
    return (
      <main className="editor-panel">
        <div className="editor-empty">
          <div className="editor-empty-icon">📝</div>
          <h2>Select a note</h2>
          <p className="editor-hint">
            Choose a <code>.md</code> file from the sidebar, or create a new one.
          </p>
          <button className="editor-btn editor-btn-primary" onClick={handleCreateNote}>
            ＋ Create new note
          </button>
        </div>
      </main>
    );
  }

  // No vault open
  return (
    <main className="editor-panel">
      <div className="editor-empty">
        <div className="editor-empty-icon">📝</div>
        <h2>ForestNotes</h2>
        <p className="editor-empty-subtitle">
          A local-first Markdown note-taking app with a living Knowledge Forest.
        </p>
        <div className="editor-empty-actions">
          <div className="editor-empty-card">
            <span className="editor-empty-card-icon">📂</span>
            <strong>Open a vault</strong>
            <span>
              Click <strong>Open</strong> in the sidebar to select a local folder.
            </span>
          </div>
          <div className="editor-empty-card">
            <span className="editor-empty-card-icon">📝</span>
            <strong>Create notes</strong>
            <span>Create and edit Markdown notes with live preview.</span>
          </div>
          <div className="editor-empty-card">
            <span className="editor-empty-card-icon">🌲</span>
            <strong>Explore the forest</strong>
            <span>Switch to <strong>Forest</strong> view once notes have tags.</span>
          </div>
        </div>
        <p className="editor-hint">
          All data stays on your machine. Markdown files are the single source of truth.
        </p>
      </div>
    </main>
  );
}
