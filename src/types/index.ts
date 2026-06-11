// ForestNotes Core Types

export type ViewMode = "notes" | "forest" | "settings";

export interface VaultInfo {
  id: string;
  path: string;
  name: string;
  createdAt: string;
  lastOpenedAt: string;
}

/** A single file entry returned from vault scanning */
export interface VaultFileEntry {
  path: string; // relative path from vault root
  name: string; // file name without extension
  size: number;
  is_dir: boolean;
}

/** Result of vault scanning from Rust */
export interface VaultScanResult {
  vault_path: string;
  vault_name: string;
  files: VaultFileEntry[];
  total_count: number;
}

export interface SearchResult {
  noteId: string;
  title: string;
  snippet: string;
  rank: number;
}

export interface NoteMeta {
  id: string;
  path: string;
  title: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  lastReadAt?: string;
  readCount: number;
  wordCount: number;
}

export interface TagInfo {
  id: string;
  name: string;
  noteCount: number;
  health: number;
  status: "healthy" | "normal" | "stale" | "dormant";
}

export type PanelVisibility = {
  sidebar: boolean;
  detail: boolean;
  search: boolean;
};

export type SortOrder = "updated" | "created" | "title" | "readCount";
