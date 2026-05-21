import type { RoomData } from "../shared/types";

const API = "/api";

export async function createRoom(): Promise<RoomData> {
  const response = await fetch(`${API}/rooms`, { method: "POST" });
  if (!response.ok) throw new Error("create_failed");
  return response.json() as Promise<RoomData>;
}

export async function fetchRoom(roomId: string): Promise<RoomData> {
  const response = await fetch(`${API}/rooms/${encodeURIComponent(roomId)}`);
  if (!response.ok) throw new Error("not_found");
  return response.json() as Promise<RoomData>;
}

export async function saveRoom(
  roomId: string,
  data: Omit<RoomData, "id">,
): Promise<RoomData> {
  const response = await fetch(`${API}/rooms/${encodeURIComponent(roomId)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...data, id: roomId }),
  });
  if (!response.ok) throw new Error("save_failed");
  return response.json() as Promise<RoomData>;
}
