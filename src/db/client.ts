/**
 * ForestNotes DB Client
 *
 * Thin wrappers around Tauri DB commands.
 * All SQL operations happen in the Rust backend via rusqlite.
 */
import { invoke } from "@tauri-apps/api/core";

// ─── Types ────────────────────────────────────────

export interface TagSourceEntry {
  name: string;
  normalized: string;
  source: "frontmatter" | "inline" | "both";
}

export interface IndexSingleInput {
  vault_id: string;
  path: string;
  title: string;
  tags: string[];
  content_hash: string;
  created_at: string | null;
  updated_at: string | null;
  word_count: number;
  body: string;
  source_tag_map: TagSourceEntry[];
}

export interface IndexResult {
  note_id: string;
  tags_indexed: number;
}

export interface TagRecord {
  id: string;
  vault_id: string;
  name: string;
  normalized_name: string;
  note_count: number;
}

// ─── Commands ──────────────────────────────────────

export async function initVault(
  vaultPath: string,
  vaultName: string,
): Promise<string> {
  return invoke<string>("init_vault_db", {
    vaultPath,
    vaultName,
  });
}

export async function indexSingleNote(
  input: IndexSingleInput,
): Promise<IndexResult> {
  return invoke<IndexResult>("index_single_note_db", { input });
}

export async function clearVaultIndex(vaultId: string): Promise<void> {
  return invoke<void>("clear_vault_index_db", { vaultId });
}

export async function getTags(vaultId: string): Promise<TagRecord[]> {
  return invoke<TagRecord[]>("get_tags_db", { vaultId });
}

export async function getLastVaultPath(): Promise<string | null> {
  return invoke<string | null>("get_last_vault_path_db");
}

export async function recordReadActivity(noteId: string): Promise<void> {
  return invoke<void>("record_read_activity_db", { noteId });
}

export async function recordUpdateActivity(noteId: string): Promise<void> {
  return invoke<void>("record_update_activity_db", { noteId });
}

export interface NoteHashEntry {
  path: string;
  content_hash: string;
}

export async function getNoteHashes(
  vaultId: string,
): Promise<NoteHashEntry[]> {
  return invoke<NoteHashEntry[]>("get_note_hashes_db", { vaultId });
}

export async function removeNoteFromDb(
  vaultId: string,
  path: string,
): Promise<void> {
  return invoke<void>("remove_note_db", { vaultId, path });
}

export interface SearchResult {
  note_id: string;
  path: string;
  title: string;
  title_highlight: string;
  body_snippet: string;
  rank: number;
  updated_at: string | null;
}

export async function searchNotes(
  vaultId: string,
  query: string,
  tagFilter?: string | null,
): Promise<SearchResult[]> {
  return invoke<SearchResult[]>("search_notes_db", {
    vaultId,
    query,
    tagFilter: tagFilter ?? null,
  });
}

export interface NoteRecord {
  id: string;
  vault_id: string;
  path: string;
  title: string;
  content_hash: string;
  created_at: string | null;
  updated_at: string | null;
  indexed_at: string;
  last_read_at: string | null;
  read_count: number;
  word_count: number;
}

export async function getNoteByPath(
  vaultId: string,
  path: string,
): Promise<NoteRecord | null> {
  return invoke<NoteRecord | null>("get_note_by_path_db", { vaultId, path });
}

export interface ActivityRecord {
  id: string;
  note_id: string;
  type: string;
  created_at: string;
}

export async function getNoteActivities(
  noteId: string,
): Promise<ActivityRecord[]> {
  return invoke<ActivityRecord[]>("get_note_activities_db", { noteId });
}

export interface ForestNode {
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

export interface ForestEdge {
  source: string;
  target: string;
  weight: number;
}

export interface ForestGraph {
  nodes: ForestNode[];
  edges: ForestEdge[];
  generatedAt: string;
}

export async function getForestGraph(
  vaultId: string,
): Promise<ForestGraph> {
  return invoke<ForestGraph>("get_forest_graph_cmd", { vaultId });
}
