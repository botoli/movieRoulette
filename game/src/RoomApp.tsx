import { useState } from "react";

import App from "./App";
import { Lobby } from "./Lobby";
import { getRoomIdFromUrl } from "./roomUrl";

export function RoomApp() {
  const [roomId, setRoomId] = useState<string | null>(() => getRoomIdFromUrl());

  if (!roomId) {
    return <Lobby onJoin={setRoomId} />;
  }

  const handleLeave = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("room");
    window.history.replaceState({}, "", url.toString());
    setRoomId(null);
  };

  return <App roomId={roomId} onLeave={handleLeave} />;
}
