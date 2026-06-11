import { create } from "zustand";
import type {
  PanelVisibility,
  SortOrder,
  VaultFileEntry,
  ViewMode,
} from "../types";
import {
  createNoteFile,
  deleteNoteFile,
  generateNewNotePath,
  readNoteContent,
  renameNoteFile,
  saveNoteContent,
  scanVaultFiles,
} from "../features/vault/vaultApi";
import {
  clearVaultIndex,
  getNoteActivities,
  getNoteByPath,
  getNoteHashes,
  indexSingleNote,
  initVault,
  recordReadActivity,
  recordUpdateActivity,
  removeNoteFromDb,
  searchNotes,
  getForestGraph,
  type ActivityRecord,
  type ForestGraph,
  type NoteRecord,
  type SearchResult,
  type TagSourceEntry,
} from "../db/client";
import { parseNote } from "../core/markdown";

interface IndexProgress {
  current: number;
  total: number;
}

interface AppStore {
  // View
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;

  // Vault
  vaultPath: string | null;
  vaultName: string | null;
  vaultId: string | null;
  vaultFiles: VaultFileEntry[];
  isScanning: boolean;
  isIndexing: boolean;
  scanError: string | null;
  indexProgress: IndexProgress | null;
  indexErrors: string[];
  scanVault: (path: string) => Promise<void>;
  rebuildIndex: () => Promise<void>;
  refreshVault: () => Promise<void>;
  clearVault: () => void;

  // Active note
  activeNotePath: string | null;
  activeNoteContent: string | null;
  savedNoteContent: string | null;
  activeNoteLoading: boolean;
  isDirty: boolean;
  noteDbId: string | null;
  noteMeta: NoteRecord | null;
  noteActivities: ActivityRecord[];
  selectNote: (path: string) => Promise<void>;
  setEditorContent: (content: string) => void;
  clearActiveNote: () => void;

  // Note actions
  saveNote: () => Promise<boolean>;
  createNote: () => Promise<string | null>;
  renameNote: (oldPath: string, newPath: string) => Promise<boolean>;
  deleteNote: (path: string) => Promise<boolean>;

  // Save status
  saveStatus: "idle" | "saving" | "saved" | "error";
  saveError: string | null;

  // Search
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  searchTagFilter: string | null;
  setSearchTagFilter: (tag: string | null) => void;
  searchResults: SearchResult[];
  isSearching: boolean;
  hasSearched: boolean;
  performSearch: () => Promise<void>;

  // Panels
  panelVisibility: PanelVisibility;
  toggleSidebar: () => void;
  toggleDetail: () => void;
  toggleSearch: () => void;

  // File explorer
  explorerSort: SortOrder;
  setExplorerSort: (order: SortOrder) => void;
  explorerFilter: string;
  setExplorerFilter: (f: string) => void;

  // Forest
  forestFilter: "all" | "healthy" | "stale" | "dormant";
  setForestFilter: (f: "all" | "healthy" | "stale" | "dormant") => void;
  forestTimeRange: "all" | "7d" | "30d" | "90d";
  setForestTimeRange: (r: "all" | "7d" | "30d" | "90d") => void;
  forestGraph: ForestGraph | null;
  isForestLoading: boolean;
  loadForestGraph: () => Promise<void>;
}

/** Build TagSourceEntry array from parsed note data */
function buildTagSourceMap(parsed: ReturnType<typeof parseNote>): TagSourceEntry[] {
  return parsed.tags.map((tag) => {
    const fromFm = parsed.frontmatterTags.some(
      (t) => t.toLowerCase() === tag,
    );
    const fromInline = parsed.inlineTags.includes(tag);
    return {
      name: parsed.frontmatterTags.find((t) => t.toLowerCase() === tag) ?? tag,
      normalized: tag,
      source: (fromFm && fromInline
        ? "both"
        : fromFm
          ? "frontmatter"
          : "inline") as "frontmatter" | "inline" | "both",
    };
  });
}

export const useAppStore = create<AppStore>((set, get) => ({
  // View
  viewMode: "notes",
  setViewMode: (mode) => set({ viewMode: mode }),

  // ─── Vault ─────────────────────────────────────

  vaultPath: null,
  vaultName: null,
  vaultId: null,
  vaultFiles: [],
  isScanning: false,
  isIndexing: false,
  scanError: null,
  indexProgress: null,
  indexErrors: [],

  scanVault: async (path: string) => {
    set({
      isScanning: true,
      isIndexing: false,
      scanError: null,
      indexProgress: null,
      indexErrors: [],
    });

    try {
      // 1. Scan filesystem
      const result = await scanVaultFiles(path);
      set({
        vaultPath: result.vault_path,
        vaultName: result.vault_name,
        vaultFiles: result.files,
        isScanning: false,
        activeNotePath: null,
        activeNoteContent: null,
        savedNoteContent: null,
        isDirty: false,
      });

      // 2. Init vault in DB
      const vaultId = await initVault(result.vault_path, result.vault_name);
      set({ vaultId });

      // 3. Get existing note hashes for incremental comparison
      const existingHashes: Map<string, string> = new Map();
      try {
        const hashes = await getNoteHashes(vaultId);
        for (const h of hashes) {
          existingHashes.set(h.path, h.content_hash);
        }
      } catch {
        // If we can't get hashes, do full rebuild
        await clearVaultIndex(vaultId);
      }

      // 4. Index notes with incremental logic
      const currentPaths = new Set(result.files.map((f) => f.path));
      const errors: string[] = [];
      let indexedCount = 0;
      const total = result.files.length;
      set({ isIndexing: true, indexProgress: { current: 0, total } });

      for (const file of result.files) {
        set({ indexProgress: { current: indexedCount, total } });
        try {
          const content = await readNoteContent(result.vault_path, file.path);
          const parsed = parseNote(content);

          // Check if this file needs reindexing
          const prevHash = existingHashes.get(file.path);
          if (prevHash === parsed.contentHash && prevHash !== undefined) {
            // Hash unchanged — skip
            indexedCount++;
            continue;
          }

          await indexSingleNote({
            vault_id: vaultId,
            path: file.path,
            title: parsed.title,
            tags: parsed.tags,
            content_hash: parsed.contentHash,
            created_at: parsed.createdAt,
            updated_at: parsed.updatedAt,
            word_count: parsed.wordCount,
            body: parsed.body,
            source_tag_map: buildTagSourceMap(parsed),
          });
          indexedCount++;
        } catch (err) {
          errors.push(`${file.path}: ${String(err)}`);
          indexedCount++;
        }
      }

      // 5. Remove notes that no longer exist on disk
      for (const [existingPath] of existingHashes) {
        if (!currentPaths.has(existingPath)) {
          try {
            await removeNoteFromDb(vaultId, existingPath);
          } catch {
            // Best-effort cleanup
          }
        }
      }

      set({
        isIndexing: false,
        indexProgress: { current: total, total },
        indexErrors: errors,
      });
    } catch (err) {
      set({
        isScanning: false,
        isIndexing: false,
        scanError: String(err),
        indexProgress: null,
      });
    }
  },

  rebuildIndex: async () => {
    const { vaultPath, vaultId } = get();
    if (!vaultPath || !vaultId) return;

    set({
      isIndexing: true,
      indexProgress: null,
      indexErrors: [],
    });

    try {
      // Clear and full rebuild
      await clearVaultIndex(vaultId);

      const result = await scanVaultFiles(vaultPath);
      set({ vaultFiles: result.files });

      const errors: string[] = [];
      const total = result.files.length;
      set({ indexProgress: { current: 0, total } });

      for (let i = 0; i < result.files.length; i++) {
        const file = result.files[i];
        set({ indexProgress: { current: i, total } });
        try {
          const content = await readNoteContent(vaultPath, file.path);
          const parsed = parseNote(content);
          await indexSingleNote({
            vault_id: vaultId,
            path: file.path,
            title: parsed.title,
            tags: parsed.tags,
            content_hash: parsed.contentHash,
            created_at: parsed.createdAt,
            updated_at: parsed.updatedAt,
            word_count: parsed.wordCount,
            body: parsed.body,
            source_tag_map: buildTagSourceMap(parsed),
          });
        } catch (err) {
          errors.push(`${file.path}: ${String(err)}`);
        }
      }

      set({
        isIndexing: false,
        indexProgress: { current: total, total },
        indexErrors: errors,
      });
    } catch (err) {
      set({
        isIndexing: false,
        scanError: String(err),
      });
    }
  },

  refreshVault: async () => {
    const { vaultPath } = get();
    if (!vaultPath) return;
    try {
      const result = await scanVaultFiles(vaultPath);
      set({ vaultFiles: result.files, vaultName: result.vault_name });
    } catch {
      // Silently fail
    }
  },

  clearVault: () =>
    set({
      vaultPath: null,
      vaultName: null,
      vaultId: null,
      vaultFiles: [],
      activeNotePath: null,
      activeNoteContent: null,
      savedNoteContent: null,
      isDirty: false,
      noteDbId: null,
      indexProgress: null,
      indexErrors: [],
    }),

  // ─── Active Note ────────────────────────────────

  activeNotePath: null,
  activeNoteContent: null,
  savedNoteContent: null,
  activeNoteLoading: false,
  isDirty: false,
  noteDbId: null,
  noteMeta: null,
  noteActivities: [],

  selectNote: async (path: string) => {
    const { vaultPath, isDirty, vaultId } = get();
    if (isDirty) {
      const confirmed = window.confirm(
        "You have unsaved changes. Discard changes and switch note?",
      );
      if (!confirmed) return;
    }
    if (!vaultPath) return;
    set({
      activeNotePath: path,
      activeNoteContent: null,
      savedNoteContent: null,
      activeNoteLoading: true,
      isDirty: false,
      saveStatus: "idle",
      noteDbId: null,
      noteMeta: null,
      noteActivities: [],
    });
    try {
      const content = await readNoteContent(vaultPath, path);
      set({
        activeNoteContent: content,
        savedNoteContent: content,
        activeNoteLoading: false,
      });

      // Load note metadata and record read activity (fire-and-forget)
      if (vaultId) {
        getNoteByPath(vaultId, path).then((note) => {
          if (note) {
            set({ noteDbId: note.id, noteMeta: note });
            // Record read activity
            recordReadActivity(note.id).catch(() => {});
            // Load activities
            getNoteActivities(note.id)
              .then((activities) => set({ noteActivities: activities }))
              .catch(() => {});
          }
        }).catch(() => {});
      }
    } catch (err) {
      set({
        activeNoteContent: `Error loading file:\n${err}`,
        activeNoteLoading: false,
      });
    }
  },

  setEditorContent: (content: string) => {
    const { savedNoteContent } = get();
    set({
      activeNoteContent: content,
      isDirty: content !== savedNoteContent,
    });
  },

  clearActiveNote: () =>
    set({
      activeNotePath: null,
      activeNoteContent: null,
      savedNoteContent: null,
      isDirty: false,
      saveStatus: "idle",
      noteDbId: null,
    }),

  // ─── Note Actions ───────────────────────────────

  saveNote: async () => {
    const { vaultPath, activeNotePath, activeNoteContent, vaultId } = get();
    if (!vaultPath || !activeNotePath || activeNoteContent === null) return false;

    set({ saveStatus: "saving", saveError: null });
    try {
      await saveNoteContent(vaultPath, activeNotePath, activeNoteContent);

      if (vaultId) {
        const parsed = parseNote(activeNoteContent);
        try {
          const result = await indexSingleNote({
            vault_id: vaultId,
            path: activeNotePath,
            title: parsed.title,
            tags: parsed.tags,
            content_hash: parsed.contentHash,
            created_at: parsed.createdAt,
            updated_at: parsed.updatedAt,
            word_count: parsed.wordCount,
            body: parsed.body,
            source_tag_map: buildTagSourceMap(parsed),
          });
          set({ noteDbId: result.note_id });
          await recordUpdateActivity(result.note_id);
        } catch {
          // DB indexing is best-effort
        }
      }

      set({
        savedNoteContent: activeNoteContent,
        isDirty: false,
        saveStatus: "saved",
      });
      setTimeout(() => {
        const { saveStatus } = get();
        if (saveStatus === "saved") set({ saveStatus: "idle" });
      }, 2000);
      return true;
    } catch (err) {
      set({ saveStatus: "error", saveError: String(err) });
      return false;
    }
  },

  createNote: async () => {
    const { vaultPath, vaultFiles } = get();
    if (!vaultPath) return null;
    const relPath = generateNewNotePath(vaultFiles);
    try {
      const title = relPath.replace(/\.md$/, "");
      await createNoteFile(vaultPath, relPath, title);
      await get().refreshVault();
      return relPath;
    } catch (err) {
      console.error("Failed to create note:", err);
      return null;
    }
  },

  renameNote: async (oldPath: string, newPath: string) => {
    const { vaultPath } = get();
    if (!vaultPath) return false;
    try {
      await renameNoteFile(vaultPath, oldPath, newPath);
      const { activeNotePath } = get();
      if (activeNotePath === oldPath) {
        set({ activeNotePath: newPath });
      }
      await get().refreshVault();
      return true;
    } catch (err) {
      console.error("Failed to rename note:", err);
      return false;
    }
  },

  deleteNote: async (path: string) => {
    const { vaultPath } = get();
    if (!vaultPath) return false;
    const confirmed = window.confirm(
      `Delete "${path}"?\n\nThis will permanently delete the file from disk.`,
    );
    if (!confirmed) return false;
    try {
      await deleteNoteFile(vaultPath, path);
      const { activeNotePath } = get();
      if (activeNotePath === path) {
        set({
          activeNotePath: null,
          activeNoteContent: null,
          savedNoteContent: null,
          isDirty: false,
          noteDbId: null,
        });
      }
      await get().refreshVault();
      return true;
    } catch (err) {
      console.error("Failed to delete note:", err);
      return false;
    }
  },

  // ─── Save Status ────────────────────────────────

  saveStatus: "idle",
  saveError: null,

  // ─── Search ─────────────────────────────────────

  searchQuery: "",
  setSearchQuery: (q) => set({ searchQuery: q }),
  searchTagFilter: null,
  setSearchTagFilter: (tag) => set({ searchTagFilter: tag }),
  searchResults: [],
  isSearching: false,
  hasSearched: false,

  performSearch: async () => {
    const { vaultId, searchQuery, searchTagFilter } = get();
    if (!vaultId || !searchQuery.trim()) {
      set({ searchResults: [], hasSearched: false });
      return;
    }
    set({ isSearching: true, hasSearched: true });
    try {
      const results = await searchNotes(vaultId, searchQuery, searchTagFilter);
      set({ searchResults: results, isSearching: false });
    } catch {
      set({ searchResults: [], isSearching: false });
    }
  },

  // ─── Panels ─────────────────────────────────────

  panelVisibility: { sidebar: true, detail: true, search: false },
  toggleSidebar: () =>
    set((s) => ({
      panelVisibility: { ...s.panelVisibility, sidebar: !s.panelVisibility.sidebar },
    })),
  toggleDetail: () =>
    set((s) => ({
      panelVisibility: { ...s.panelVisibility, detail: !s.panelVisibility.detail },
    })),
  toggleSearch: () =>
    set((s) => ({
      panelVisibility: { ...s.panelVisibility, search: !s.panelVisibility.search },
    })),

  // ─── File Explorer ──────────────────────────────

  explorerSort: "updated",
  setExplorerSort: (order) => set({ explorerSort: order }),
  explorerFilter: "",
  setExplorerFilter: (f) => set({ explorerFilter: f }),

  // ─── Forest ─────────────────────────────────────

  forestFilter: "all",
  setForestFilter: (f) => set({ forestFilter: f }),
  forestTimeRange: "all",
  setForestTimeRange: (r) => set({ forestTimeRange: r }),
  forestGraph: null,
  isForestLoading: false,

  loadForestGraph: async () => {
    const { vaultId } = get();
    if (!vaultId) return;
    set({ isForestLoading: true });
    try {
      const graph = await getForestGraph(vaultId);
      set({ forestGraph: graph, isForestLoading: false });
    } catch {
      set({ isForestLoading: false });
    }
  },
}));
