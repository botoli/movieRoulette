export function getRoomIdFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  const room = params.get("room")?.trim().toLowerCase();
  return room && /^[a-z0-9]{4,12}$/.test(room) ? room : null;
}

export function setRoomInUrl(roomId: string) {
  const url = new URL(window.location.href);
  url.searchParams.set("room", roomId);
  window.history.replaceState({}, "", url.toString());
}

export function buildShareUrl(roomId: string) {
  const url = new URL(window.location.origin + window.location.pathname);
  url.searchParams.set("room", roomId);
  return url.toString();
}
