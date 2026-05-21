import { useCallback, useEffect, useRef } from "react";

import { fetchRoom, saveRoom } from "./api";
import type { RoomData } from "../shared/types";

export type RoomSnapshot = Omit<RoomData, "id">;

type UseRoomSyncOptions = {
  roomId: string;
  getSnapshot: () => RoomSnapshot;
  onRemote: (room: RoomData) => void;
  enabled?: boolean;
};

export function useRoomSync({
  roomId,
  getSnapshot,
  onRemote,
  enabled = true,
}: UseRoomSyncOptions) {
  const lastServerAt = useRef(0);
  const saveTimer = useRef<number | null>(null);
  const applyingRemote = useRef(false);
  const getSnapshotRef = useRef(getSnapshot);
  const onRemoteRef = useRef(onRemote);

  getSnapshotRef.current = getSnapshot;
  onRemoteRef.current = onRemote;

  const pull = useCallback(async () => {
    try {
      const room = await fetchRoom(roomId);
      if (room.updatedAt <= lastServerAt.current) return;
      applyingRemote.current = true;
      lastServerAt.current = room.updatedAt;
      onRemoteRef.current(room);
      window.setTimeout(() => {
        applyingRemote.current = false;
      }, 0);
    } catch {
      /* ignore poll errors */
    }
  }, [roomId]);

  const scheduleSave = useCallback(() => {
    if (!enabled || applyingRemote.current) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      try {
        const snapshot = getSnapshotRef.current();
        const room = await saveRoom(roomId, {
          ...snapshot,
          updatedAt: Date.now(),
        });
        lastServerAt.current = room.updatedAt;
      } catch {
        /* retry on next change */
      }
    }, 450);
  }, [roomId, enabled]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const load = async () => {
      try {
        const room = await fetchRoom(roomId);
        if (cancelled) return;
        applyingRemote.current = true;
        lastServerAt.current = room.updatedAt;
        onRemoteRef.current(room);
        window.setTimeout(() => {
          applyingRemote.current = false;
        }, 0);
      } catch {
        /* room may not exist yet */
      }
    };

    void load();
    const poll = window.setInterval(() => void pull(), 2000);

    return () => {
      cancelled = true;
      window.clearInterval(poll);
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [roomId, enabled, pull]);

  return { scheduleSave, pull };
}
