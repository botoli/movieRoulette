import cors from "cors";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { emptyRoom, type RoomData } from "../shared/types.js";
import { createRoom, readRoom, writeRoom } from "./store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3001;
const ROOT = path.join(__dirname, "..");

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

function makeRoomId() {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < 8; i += 1) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

function sanitizeRoom(body: Partial<RoomData>, id: string): RoomData {
  const base = emptyRoom(id);
  return {
    id,
    updatedAt: typeof body.updatedAt === "number" ? body.updatedAt : Date.now(),
    desired: Array.isArray(body.desired) ? body.desired : base.desired,
    allMovies: Array.isArray(body.allMovies) ? body.allMovies : base.allMovies,
    activeMovies: Array.isArray(body.activeMovies)
      ? body.activeMovies
      : base.activeMovies,
    eliminatedMovies: Array.isArray(body.eliminatedMovies)
      ? body.eliminatedMovies
      : base.eliminatedMovies,
    winner: body.winner ?? null,
    winners: Array.isArray(body.winners) ? body.winners : base.winners,
  };
}

app.post("/api/rooms", async (_req, res) => {
  let id = makeRoomId();
  while (await readRoom(id)) {
    id = makeRoomId();
  }
  const room = await createRoom(id);
  res.json(room);
});

app.get("/api/rooms/:id", async (req, res) => {
  const id = String(req.params.id).toLowerCase();
  const room = await readRoom(id);
  if (!room) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  res.json(room);
});

app.put("/api/rooms/:id", async (req, res) => {
  const id = String(req.params.id).toLowerCase();
  let existing = await readRoom(id);
  if (!existing) {
    existing = await createRoom(id);
  }

  const incoming = sanitizeRoom(req.body, id);
  if (
    typeof req.body.updatedAt === "number" &&
    req.body.updatedAt < existing.updatedAt - 50
  ) {
    res.status(409).json({ error: "conflict", room: existing });
    return;
  }

  const room = await writeRoom(incoming);
  res.json(room);
});

if (process.env.NODE_ENV === "production") {
  const distPath = path.join(ROOT, "dist");
  app.use(express.static(distPath));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) {
      next();
      return;
    }
    res.sendFile(path.join(distPath, "index.html"));
  });
}

app.listen(PORT, () => {
  console.log(`Movie Roulette API: http://localhost:${PORT}`);
});
