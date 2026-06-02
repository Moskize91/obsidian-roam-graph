import { normalizePath, TFile, TFolder, type App } from "obsidian";
import type { CanvasData } from "./canvas-types";

export async function ensureGraphCanvasFile(app: App, canvasPath: string): Promise<TFile> {
  const existing = app.vault.getAbstractFileByPath(canvasPath);
  if (existing instanceof TFile) {
    if (existing.extension !== "canvas") {
      throw new Error(`Roam Graph path is not a canvas file: ${canvasPath}`);
    }
    return existing;
  }
  if (existing) {
    throw new Error(`Roam Graph path points to a folder: ${canvasPath}`);
  }

  const parentPath = canvasPath.split("/").slice(0, -1).join("/");
  if (parentPath) {
    await ensureFolder(app, parentPath);
  }
  return await app.vault.create(canvasPath, `${JSON.stringify({ nodes: [], edges: [] }, null, 2)}\n`);
}

export async function writeCanvasFile(app: App, file: TFile, canvas: CanvasData): Promise<void> {
  await app.vault.modify(file, `${JSON.stringify(canvas, null, 2)}\n`);
}

async function ensureFolder(app: App, path: string): Promise<void> {
  const parts = normalizePath(path).split("/");
  let current = "";
  for (const part of parts) {
    current = current ? `${current}/${part}` : part;
    const existing = app.vault.getAbstractFileByPath(current);
    if (existing instanceof TFolder) continue;
    if (existing) {
      throw new Error(`Roam Graph folder path points to a file: ${current}`);
    }
    try {
      await app.vault.createFolder(current);
    } catch (error) {
      if (!isAlreadyExistsError(error)) {
        throw error;
      }
    }
  }
}

function isAlreadyExistsError(error: unknown): boolean {
  return error instanceof Error && error.message.toLowerCase().includes("already exists");
}
