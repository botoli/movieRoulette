import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { emptyRoom, type RoomData } from "../shared/types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "data");

async function ensureDataDir() {
  await mkdir(DATA_DIR, { recursive: true });
}

function roomPath(id: string) {
  return path.join(DATA_DIR, `${id}.json`);
}

export async function createRoom(id: string): Promise<RoomData> {
  await ensureDataDir();
  const room = emptyRoom(id);
  await writeFile(roomPath(id), JSON.stringify(room, null, 2), "utf-8");
  return room;
}

export async function readRoom(id: string): Promise<RoomData | null> {
  await ensureDataDir();
  try {
    const raw = await readFile(roomPath(id), "utf-8");
    const parsed = JSON.parse(raw) as RoomData;
    if (!parsed || parsed.id !== id) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function writeRoom(room: RoomData): Promise<RoomData> {
  await ensureDataDir();
  const next = { ...room, updatedAt: Date.now() };
  await writeFile(roomPath(room.id), JSON.stringify(next, null, 2), "utf-8");
  return next;
}
