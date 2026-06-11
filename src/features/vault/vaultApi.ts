import { invoke } from "@tauri-apps/api/core";
import type { VaultFileEntry, VaultScanResult } from "../../types";

// ─── Vault Scanning ────────────────────────────────────────

export async function scanVaultFiles(
  vaultPath: string,
): Promise<VaultScanResult> {
  return invoke<VaultScanResult>("scan_vault_cmd", { vaultPath });
}

export async function readNoteContent(
  vaultPath: string,
  relativePath: string,
): Promise<string> {
  return invoke<string>("read_note_file_cmd", { vaultPath, relativePath });
}

// ─── File Operations ───────────────────────────────────────

export async function saveNoteContent(
  vaultPath: string,
  relativePath: string,
  content: string,
): Promise<void> {
  return invoke<void>("save_note_file_cmd", {
    vaultPath,
    relativePath,
    content,
  });
}

export async function createNoteFile(
  vaultPath: string,
  relativePath: string,
  title: string,
): Promise<string> {
  return invoke<string>("create_note_file_cmd", {
    vaultPath,
    relativePath,
    title,
  });
}

export async function renameNoteFile(
  vaultPath: string,
  oldRelativePath: string,
  newRelativePath: string,
): Promise<string> {
  return invoke<string>("rename_note_file_cmd", {
    vaultPath,
    oldRelativePath,
    newRelativePath,
  });
}

export async function deleteNoteFile(
  vaultPath: string,
  relativePath: string,
): Promise<void> {
  return invoke<void>("delete_note_file_cmd", { vaultPath, relativePath });
}

// ─── Dialog ─────────────────────────────────────────────────

export async function openVaultDialog(): Promise<string | null> {
  const { open } = await import("@tauri-apps/plugin-dialog");
  const selected = await open({
    directory: true,
    multiple: false,
    title: "Select Vault Folder",
  });
  return (selected as string) ?? null;
}

// ─── Utilities ──────────────────────────────────────────────

export function sortFiles(
  files: VaultFileEntry[],
  order: "updated" | "created" | "title",
): VaultFileEntry[] {
  return [...files].sort((a, b) => {
    switch (order) {
      case "title":
        return a.name.localeCompare(b.name);
      default:
        return a.path.localeCompare(b.path);
    }
  });
}

/** Generate a unique filename for a new note */
export function generateNewNotePath(
  existingFiles: VaultFileEntry[],
  baseName = "Untitled",
): string {
  const existing = new Set(existingFiles.map((f) => f.name.toLowerCase()));
  if (!existing.has(baseName.toLowerCase())) {
    return `${baseName}.md`;
  }
  for (let i = 1; i < 1000; i++) {
    const candidate = `${baseName} ${i}`;
    if (!existing.has(candidate.toLowerCase())) {
      return `${candidate}.md`;
    }
  }
  return `${baseName} ${Date.now()}.md`;
}
