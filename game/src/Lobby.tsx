import { useState } from "react";
import { Clapperboard, Link2, Plus } from "lucide-react";

import { createRoom } from "./api";
import { getRoomIdFromUrl, setRoomInUrl } from "./roomUrl";

import "./Lobby.scss";

type LobbyProps = {
  onJoin: (roomId: string) => void;
};

export function Lobby({ onJoin }: LobbyProps) {
  const [code, setCode] = useState(getRoomIdFromUrl() ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const join = (roomId: string) => {
    const id = roomId.trim().toLowerCase();
    if (!/^[a-z0-9]{4,12}$/.test(id)) {
      setError("Код комнаты: 4–12 латинских букв или цифр");
      return;
    }
    setRoomInUrl(id);
    onJoin(id);
  };

  const handleCreate = async () => {
    setLoading(true);
    setError(null);
    try {
      const room = await createRoom();
      setRoomInUrl(room.id);
      onJoin(room.id);
    } catch {
      setError("Не удалось создать комнату. Запущен ли сервер?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="lobby">
      <div className="lobby__card">
        <div className="lobby__logo">
          <Clapperboard size={40} color="var(--accent)" />
        </div>
        <h1>Movie Roulette</h1>
        <p className="lobby__lead">
          Создайте комнату и отправьте ссылку друзьям. Все увидят фильмы Джебры,
          Артёма и Миши и смогут добавить их в рулетку.
        </p>

        <button
          type="button"
          className="lobby__primary"
          onClick={handleCreate}
          disabled={loading}
        >
          <Plus size={18} />
          {loading ? "Создаём..." : "Создать комнату"}
        </button>

        <div className="lobby__divider">
          <span>или войти по коду</span>
        </div>

        <div className="lobby__join">
          <input
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="код комнаты"
            onKeyDown={(event) => {
              if (event.key === "Enter") join(code);
            }}
          />
          <button
            type="button"
            onClick={() => join(code)}
            disabled={!code.trim()}
          >
            <Link2 size={18} />
            Войти
          </button>
        </div>

        {error && <p className="lobby__error">{error}</p>}
      </div>
    </div>
  );
}
