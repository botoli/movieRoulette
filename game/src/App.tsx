import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Clapperboard,
  Copy,
  Film,
  Heart,
  Home,
  Link2,
  ListFilter,
  PlusCircle,
  RefreshCw,
  Shuffle,
  Trophy,
  Users,
} from "lucide-react";

import "./App.scss";
import { buildShareUrl } from "./roomUrl";
import { useRoomSync } from "./useRoomSync";
import {
  MEMBERS,
  normalizeMemberName,
  type DesiredEntry,
  type MovieEntry,
  type RoomData,
} from "../shared/types";

type AppProps = {
  roomId: string;
  onLeave: () => void;
};

type RoomSnapshot = Omit<RoomData, "id">;

type Suggestion = {
  id: string;
  title: string;
  subtitle: string;
  posterUrl?: string;
};

type PoiskkinoPoster = {
  previewUrl?: string;
  url?: string;
};

type PoiskkinoDoc = {
  name?: string;
  alternativeName?: string;
  year?: number;
  type?: string;
  poster?: PoiskkinoPoster | string | null;
};

type PoiskkinoResponse = {
  docs?: PoiskkinoDoc[];
};

const UI_TRANSITION_MS = 200;
const SPIN_DURATION_MS = 3200;
const SPIN_EASING = "cubic-bezier(0.09, 0.85, 0.18, 1)";
const MAX_MOVIES = 100;
const POISKKINO_BASE_URL = "https://api.poiskkino.dev/v1.4/movie/search";
const START_ANGLE = -90;

const normalizeTitle = (value: string) => value.trim().toLowerCase();

const truncateTitle = (title: string, maxLength: number) =>
  title.length <= maxLength ? title : `${title.slice(0, maxLength - 1)}…`;

const buildWheelGradient = (count: number) => {
  if (count <= 1) {
    return "conic-gradient(from -90deg, rgba(209, 180, 122, 0.2) 0deg 360deg)";
  }

  const step = 360 / count;
  const gap = Math.max(1, step * 0.08); // минимальный зазор 1°

  const slices = Array.from({ length: count }, (_, index) => {
    const start = index * step;
    const end = start + step - gap;
    const nextStart = start + step;
    return `rgba(209, 180, 122, 0.15) ${start}deg ${end}deg, transparent ${end}deg ${nextStart}deg`;
  });

  return `conic-gradient(from -90deg, ${slices.join(", ")})`;
};

const makeDesiredId = () => {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
};

function App({ roomId, onLeave }: AppProps) {
  const [allMovies, setAllMovies] = useState<MovieEntry[]>([]);
  const [activeMovies, setActiveMovies] = useState<MovieEntry[]>([]);
  const [eliminatedMovies, setEliminatedMovies] = useState<MovieEntry[]>([]);
  const [desired, setDesired] = useState<DesiredEntry[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [rutubeValue, setRutubeValue] = useState("");
  const [nameValue, setNameValue] = useState("");
  const [desiredInputValue, setDesiredInputValue] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [desiredSuggestions, setDesiredSuggestions] = useState<Suggestion[]>(
    [],
  );
  const [currentSpin, setCurrentSpin] = useState<MovieEntry | null>(null);
  const [winner, setWinner] = useState<MovieEntry | null>(null);
  const [winners, setWinners] = useState<MovieEntry[]>([]);
  const [isSpinning, setIsSpinning] = useState(false);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [wheelTransition, setWheelTransition] = useState("none");
  const [eliminatingTitle, setEliminatingTitle] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<
    "roulette" | "desired" | "winners"
  >("roulette");
  const [toast, setToast] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const spinTimeoutRef = useRef<number | null>(null);
  const poiskkinoToken = import.meta.env.VITE_POISKKINO_TOKEN as
    | string
    | undefined;

  const shareUrl = useMemo(() => buildShareUrl(roomId), [roomId]);
  const wheelGradient = useMemo(
    () => buildWheelGradient(activeMovies.length),
    [activeMovies.length],
  );


  const wheelDisplayMode = useMemo(() => {
    if (activeMovies.length <= 8) return "full" as const;
    if (activeMovies.length <= 14) return "compact" as const;
    return "minimal" as const;
  }, [activeMovies.length]);

  const wheelStateClass = `${isSpinning ? " is-spinning" : ""}${eliminatingTitle ? " is-eliminating" : ""}${winner ? " is-winner" : ""}`;

  const movieSet = useMemo(
    () => new Set(allMovies.map((movie) => normalizeTitle(movie.title))),
    [allMovies],
  );
  const canAddMore = allMovies.length < MAX_MOVIES;
  const showReset =
    allMovies.length >= MAX_MOVIES || eliminatedMovies.length > 0 || !!winner;

  const desiredGroups = useMemo(() => {
    const groups = new Map<string, DesiredEntry[]>();
    for (const entry of desired) {
      const normalized = normalizeMemberName(entry.name || "Без имени");
      const name = normalized || "Без имени";
      const list = groups.get(name) ?? [];
      list.push({ ...entry, name });
      groups.set(name, list);
    }
    return Array.from(groups.entries()).sort(([a], [b]) =>
      a.localeCompare(b, "ru"),
    );
  }, [desired]);

  const labelType = (value?: string) => {
    switch (value) {
      case "movie":
        return "Фильм";
      case "tv-series":
        return "Сериал";
      case "cartoon":
        return "Мультфильм";
      case "anime":
        return "Аниме";
      case "tv-show":
        return "ТВ-шоу";
      default:
        return "Проект";
    }
  };

  const getSnapshot = useCallback(
    (): RoomSnapshot => ({
      updatedAt: Date.now(),
      desired,
      allMovies,
      activeMovies,
      eliminatedMovies,
      winner,
      winners,
    }),
    [desired, allMovies, activeMovies, eliminatedMovies, winner, winners],
  );

  const handleRemote = useCallback((room: RoomData) => {
    if (spinTimeoutRef.current) {
      window.clearTimeout(spinTimeoutRef.current);
      spinTimeoutRef.current = null;
    }
    setDesired(room.desired);
    setAllMovies(room.allMovies);
    setActiveMovies(room.activeMovies);
    setEliminatedMovies(room.eliminatedMovies);
    setWinner(room.winner);
    setWinners(room.winners);
    setCurrentSpin(null);
    setIsSpinning(false);
    setWheelRotation(0);
    setWheelTransition("none");
    setEliminatingTitle(null);
    setIsReady(true);
  }, []);

  const { scheduleSave } = useRoomSync({
    roomId,
    getSnapshot,
    onRemote: handleRemote,
  });

  useEffect(() => {
    setIsReady(false);
    const timer = window.setTimeout(() => setIsReady(true), 800);
    return () => window.clearTimeout(timer);
  }, [roomId]);

  useEffect(() => {
    if (!isReady) return;
    scheduleSave();
  }, [
    isReady,
    desired,
    allMovies,
    activeMovies,
    eliminatedMovies,
    winner,
    winners,
    scheduleSave,
  ]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (inputValue.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    if (!poiskkinoToken) {
      setSuggestions([]);
      return;
    }

    const controller = new AbortController();
    const handle = window.setTimeout(async () => {
      try {
        const query = encodeURIComponent(inputValue.trim());
        const response = await fetch(`${POISKKINO_BASE_URL}?query=${query}`, {
          signal: controller.signal,
          headers: {
            "X-API-KEY": poiskkinoToken,
          },
        });
        if (!response.ok) throw new Error("Suggestions request failed");
        const data: PoiskkinoResponse = await response.json();
        const items = (data.docs ?? [])
          .map((item, index) => {
            const baseName = item.name ?? item.alternativeName;
            if (!baseName) return null;
            const posterUrl =
              typeof item.poster === "string"
                ? item.poster
                : (item.poster?.previewUrl ?? item.poster?.url);
            const title = item.year ? `${baseName} (${item.year})` : baseName;
            return {
              id: `${baseName}-${item.year ?? index}`,
              title,
              subtitle: labelType(item.type),
              posterUrl,
            } as Suggestion;
          })
          .filter((item): item is Suggestion => item !== null)
          .filter((item) => !movieSet.has(normalizeTitle(item.title)))
          .slice(0, 6);
        setSuggestions(items);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setSuggestions([]);
        }
      }
    }, 320);

    return () => {
      controller.abort();
      window.clearTimeout(handle);
    };
  }, [inputValue, movieSet, poiskkinoToken]);

  useEffect(() => {
    if (desiredInputValue.trim().length < 2) {
      setDesiredSuggestions([]);
      return;
    }

    if (!poiskkinoToken) {
      setDesiredSuggestions([]);
      return;
    }

    const controller = new AbortController();
    const handle = window.setTimeout(async () => {
      try {
        const query = encodeURIComponent(desiredInputValue.trim());
        const response = await fetch(`${POISKKINO_BASE_URL}?query=${query}`, {
          signal: controller.signal,
          headers: {
            "X-API-KEY": poiskkinoToken,
          },
        });
        if (!response.ok) throw new Error("Suggestions request failed");
        const data: PoiskkinoResponse = await response.json();
        const items = (data.docs ?? [])
          .map((item, index) => {
            const baseName = item.name ?? item.alternativeName;
            if (!baseName) return null;
            const posterUrl =
              typeof item.poster === "string"
                ? item.poster
                : (item.poster?.previewUrl ?? item.poster?.url);
            const title = item.year ? `${baseName} (${item.year})` : baseName;
            return {
              id: `${baseName}-${item.year ?? index}`,
              title,
              subtitle: labelType(item.type),
              posterUrl,
            } as Suggestion;
          })
          .filter((item): item is Suggestion => item !== null)
          .filter((item) => !movieSet.has(normalizeTitle(item.title)))
          .slice(0, 6);
        setDesiredSuggestions(items);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setDesiredSuggestions([]);
        }
      }
    }, 320);

    return () => {
      controller.abort();
      window.clearTimeout(handle);
    };
  }, [desiredInputValue, movieSet, poiskkinoToken]);

  useEffect(() => {
    if (!isSpinning) {
      setWheelRotation(0);
      setWheelTransition("none");
    }
  }, [activeMovies, isSpinning]);

  useEffect(() => {
    return () => {
      if (spinTimeoutRef.current) {
        window.clearTimeout(spinTimeoutRef.current);
      }
    };
  }, []);

  const addMovies = useCallback((entries: MovieEntry[]) => {
    if (entries.length === 0) return;
    setAllMovies((prev) => {
      const existing = new Set(
        prev.map((movie) => normalizeTitle(movie.title)),
      );
      const available = Math.max(0, MAX_MOVIES - prev.length);
      const filtered = entries
        .filter((movie) => !existing.has(normalizeTitle(movie.title)))
        .slice(0, available);
      if (filtered.length === 0) return prev;
      setActiveMovies((active) => {
        const activeSet = new Set(
          active.map((movie) => normalizeTitle(movie.title)),
        );
        const toAdd = filtered.filter(
          (movie) => !activeSet.has(normalizeTitle(movie.title)),
        );
        return toAdd.length ? [...active, ...toAdd] : active;
      });
      return [...prev, ...filtered];
    });
  }, []);

  const addMovie = (value: string, posterUrl?: string, rutubeUrl?: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (movieSet.has(normalizeTitle(trimmed))) return;
    if (allMovies.length >= MAX_MOVIES) return;
    const trimmedRutube = rutubeUrl?.trim();
    const entry: MovieEntry = {
      title: trimmed,
      posterUrl,
      rutubeUrl: trimmedRutube ? trimmedRutube : undefined,
    };
    addMovies([entry]);
    setInputValue("");
    setRutubeValue("");
    setSuggestions([]);
    scheduleSave();
  };

  const removeMovie = (title: string) => {
    setAllMovies((prev) => prev.filter((item) => item.title !== title));
    setActiveMovies((prev) => prev.filter((item) => item.title !== title));
    setEliminatedMovies((prev) => prev.filter((item) => item.title !== title));
    setWinners((prev) => prev.filter((item) => item.title !== title));
    if (currentSpin?.title === title) setCurrentSpin(null);
    if (winner?.title === title) setWinner(null);
    scheduleSave();
  };

  const addDesiredFromInput = (value: string) => {
    const normalizedName = normalizeMemberName(nameValue || "Без имени");
    const titles = value
      .split(/[\n,]+/)
      .map((value) => value.trim())
      .filter(Boolean);
    if (titles.length === 0) return;
    const entries = titles.map((title) => ({
      id: makeDesiredId(),
      name: normalizedName || "Без имени",
      title,
    }));
    setDesired((prev) => [...entries, ...prev]);
    setDesiredInputValue("");
    setDesiredSuggestions([]);
    scheduleSave();
  };

  const addDesired = () => addDesiredFromInput(desiredInputValue);

  const removeDesired = (id: string) => {
    setDesired((prev) => prev.filter((entry) => entry.id !== id));
    scheduleSave();
  };

  const addDesiredToRoulette = (entries?: DesiredEntry[]) => {
    const list = entries ?? desired;
    if (list.length === 0) return;
    const available = Math.max(0, MAX_MOVIES - allMovies.length);
    const toAdd = list
      .filter((entry) => !movieSet.has(normalizeTitle(entry.title)))
      .slice(0, available);
    if (toAdd.length === 0) return;
    addMovies(toAdd.map((entry) => ({ title: entry.title })));
    const ids = new Set(toAdd.map((entry) => entry.id));
    setDesired((prev) => prev.filter((entry) => !ids.has(entry.id)));
    scheduleSave();
  };

  const spin = () => {
    if (isSpinning || activeMovies.length <= 1) return;
    const pool = [...activeMovies];
    const targetIndex = Math.floor(Math.random() * pool.length);
    const target = pool[targetIndex];
    const step = 360 / pool.length;
    const spins = 4;
    const rotation = -(spins * 360 + targetIndex * step);

    setCurrentSpin(null);
    setIsSpinning(true);
    setWheelTransition("none");
    setWheelRotation(0);

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        setWheelTransition(
          `transform ${SPIN_DURATION_MS}ms ${SPIN_EASING}`,
        );
        setWheelRotation(rotation);
      });
    });

    if (spinTimeoutRef.current) {
      window.clearTimeout(spinTimeoutRef.current);
    }

    spinTimeoutRef.current = window.setTimeout(() => {
      setCurrentSpin(target);
      setEliminatingTitle(target.title);
      window.setTimeout(() => {
        setEliminatedMovies((prev) => [target, ...prev]);
        setActiveMovies((prev) => {
          const next = prev.filter((item) => item.title !== target.title);
          if (next.length === 1) {
            const finalWinner = next[0];
            setWinner(finalWinner);
            setWinners((prevWinners) => [finalWinner, ...prevWinners]);
          }
          return next;
        });
        setEliminatingTitle(null);
      }, UI_TRANSITION_MS);
      setIsSpinning(false);
    }, SPIN_DURATION_MS);
  };

  const resetRound = () => {
    setActiveMovies(allMovies);
    setEliminatedMovies([]);
    setWinner(null);
    setCurrentSpin(null);
    setIsSpinning(false);
    setWheelRotation(0);
    setWheelTransition("none");
    setEliminatingTitle(null);
    scheduleSave();
  };

  const clearWinners = () => setWinners([]);

  const copyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setToast("Ссылка скопирована");
    } catch {
      setToast("Не удалось скопировать ссылку");
    }
  };

  return (
    <div className="layout-wrapper">
      <aside className="sidebar">
        <div className="sidebar__logo">
          <Clapperboard color="var(--accent)" size={28} />
        </div>
        <nav className="sidebar__nav">
          {[
            { id: "roulette", label: "Рулетка", icon: Home },
            { id: "desired", label: "Желаемые", icon: Heart },
            { id: "winners", label: "Победители", icon: Trophy },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={`sidebar__item${activeView === id ? " active" : ""}`}
              onClick={() => setActiveView(id as typeof activeView)}
            >
              <Icon size={20} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar__bottom" />
      </aside>

      <div className="main-content">
        <header className="hero">
          <div>
            <p className="hero__kicker">Комната: {roomId}</p>
            <h1 className="hero__title">Movie Roulette</h1>
          </div>
          <div className="hero__stats">
            <div className="hero__stat">
              <Users size={18} color="var(--muted)" />
              <div>
                <span>В РУЛЕТКЕ</span>
                <strong>{activeMovies.length}</strong>
              </div>
            </div>
            <div className="hero__stat">
              <Heart size={18} color="var(--muted)" />
              <div>
                <span>ЖЕЛАЕМЫЕ</span>
                <strong>{desired.length}</strong>
              </div>
            </div>
            <div className="hero__stat">
              <Trophy size={18} color="var(--muted)" />
              <div>
                <span>ПОБЕДИТЕЛИ</span>
                <strong>{winners.length}</strong>
              </div>
            </div>
          </div>
          <div className="hero__actions">
            <div className="room-badge">
              <Link2 size={14} />
              <span>{shareUrl}</span>
            </div>
            <button
              type="button"
              className="share-button"
              onClick={copyShareLink}
            >
              <Copy size={16} />
              Скопировать ссылку
            </button>
            <button
              type="button"
              className="share-button share-button--ghost"
              onClick={onLeave}
            >
              Выйти
            </button>
          </div>
        </header>

        {toast && <p className="toast">{toast}</p>}

        {activeView === "roulette" && (
          <main className="layout">
            <div className="layout__col">
              <section className="panel">
                <div className="panel__header">
                  <PlusCircle size={20} className="panel__icon" />
                  <div>
                    <h2 className="panel__title">Добавить фильм</h2>
                    <p className="panel__subtitle">
                      Внеси название фильма в общий список
                    </p>
                  </div>
                </div>
                <div className="input-row">
                  <input
                    value={inputValue}
                    onChange={(event) => setInputValue(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        addMovie(inputValue, undefined, rutubeValue);
                      }
                    }}
                    placeholder="Напиши название фильма..."
                    aria-label="Название фильма"
                  />
                  <button
                    type="button"
                    onClick={() => addMovie(inputValue, undefined, rutubeValue)}
                    disabled={!canAddMore}
                  >
                    Добавить
                  </button>
                </div>
                <p className="input-hint">
                  Подсказки появляются при вводе названия. Enter добавляет в
                  список.
                </p>
                {!poiskkinoToken && (
                  <p className="input-hint input-hint--warn">
                    Подсказки по базе фильмов включаются, когда задан
                    VITE_POISKKINO_TOKEN.
                  </p>
                )}
                <input
                  className="input-row__link"
                  value={rutubeValue}
                  onChange={(event) => setRutubeValue(event.target.value)}
                  placeholder="Ссылка на Rutube (необязательно)"
                  aria-label="Ссылка на Rutube"
                />
                {suggestions.length > 0 && (
                  <div className="suggestions">
                    <div className="suggestions__list">
                      {suggestions.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => addMovie(item.title, item.posterUrl)}
                          className="suggestion-card"
                        >
                          <div className="suggestion-card__poster">
                            {item.posterUrl ? (
                              <img src={item.posterUrl} alt={item.title} />
                            ) : (
                              <Film size={18} />
                            )}
                          </div>
                          <div className="suggestion-card__info">
                            <span className="suggestion-card__title">
                              {item.title}
                            </span>
                            <span className="suggestion-card__meta">
                              {item.subtitle}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </section>

              <section className="panel empty-panel">
                <div className="panel__header panel__header--between">
                  <div className="panel__header-left">
                    <ListFilter size={20} className="panel__icon" />
                    <div>
                      <h2 className="panel__title">Список на прокрутку</h2>
                      <p className="panel__subtitle">
                        Здесь появятся добавленные фильмы
                      </p>
                    </div>
                  </div>
                  <div className="panel__header-actions">
                    <div className="badge">{activeMovies.length} шт.</div>
                    {showReset && (
                      <button
                        type="button"
                        className="reset-button"
                        onClick={resetRound}
                      >
                        <RefreshCw size={14} /> Заново
                      </button>
                    )}
                  </div>
                </div>

                {activeMovies.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-state__icon">
                      <Clapperboard size={32} />
                    </div>
                    <h3>Пока пусто</h3>
                    <p>Добавь пару фильмов, чтобы начать рулетку</p>
                  </div>
                ) : (
                  <ul className="movie-list">
                    {activeMovies.map((movie) => (
                      <li key={movie.title}>
                        <span>{movie.title}</span>
                        <button
                          type="button"
                          onClick={() => removeMovie(movie.title)}
                        >
                          Убрать
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="panel desired-panel">
                <div className="panel__header panel__header--between">
                  <div className="panel__header-left">
                    <Heart size={20} className="panel__icon" />
                    <div>
                      <h2 className="panel__title">Фильмы друзей</h2>
                      <p className="panel__subtitle">
                        Выбирай чьи фильмы отправить в рулетку
                      </p>
                    </div>
                  </div>
                  {desired.length > 0 && (
                    <button
                      type="button"
                      className="reset-button"
                      onClick={() => addDesiredToRoulette()}
                    >
                      В рулетку все ({desired.length})
                    </button>
                  )}
                </div>
                {desiredGroups.length === 0 ? (
                  <p className="desired-empty">
                    Пока нет желаемых фильмов. Добавь их во вкладке "Желаемые".
                  </p>
                ) : (
                  <div className="desired-quick">
                    {desiredGroups.map(([name, entries]) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => addDesiredToRoulette(entries)}
                      >
                        В рулетку: {name} ({entries.length})
                      </button>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  className="reset-button desired-panel__open"
                  onClick={() => setActiveView("desired")}
                >
                  Открыть желаемые
                </button>
              </section>
            </div>

            <div className="layout__col">
              <section className="panel">
                <div className="panel__header">
                  <Shuffle size={20} className="panel__icon" />
                  <div>
                    <h2 className="panel__title">Круговая рулетка</h2>
                    <p className="panel__subtitle">
                      Нажми кнопку, чтобы выбрать случайный фильм
                    </p>
                  </div>
                </div>
                <div className="roulette__container">
                  <div className="roulette__circle">
                    {activeMovies.length > 0 ? (
                      <>
                        {!isSpinning && (
                          <div className="roulette__preview">Предпросмотр</div>
                        )}
                        <div className="roulette__pointer" />
                        <div
                          className={`roulette__wheel${wheelStateClass}`}
                          style={{
                            transform: `rotate(${wheelRotation}deg)`,
                            transition: wheelTransition,
                          }}
                        >
                          <div className="roulette__wheel-bg">
                            <div
                              className="roulette__segments"
                              style={{ background: wheelGradient }}
                            />
                          </div>
                          <div className="roulette__wheel-dividers">
                            {activeMovies.map((_, index) => {
                              const step = 360 / activeMovies.length;
                              const dividerAngle = START_ANGLE + step * index;
                              return (
                                <div
                                  key={`divider-${index}`}
                                  className="roulette__divider"
                                  style={{
                                    transform: `translate(-50%, -100%) rotate(${dividerAngle}deg)`,
                                  }}
                                />
                              );
                            })}
                          </div>
                          <div className="roulette__wheel-content">
                            {activeMovies.map((item, index) => {
                              const step = 360 / activeMovies.length;
                              const centerAngle = START_ANGLE + step * index + step / 2;
                              const hasPoster = wheelDisplayMode !== "minimal";
                              const title =
                                wheelDisplayMode === "full"
                                  ? item.title
                                  : wheelDisplayMode === "compact"
                                    ? truncateTitle(item.title, 22)
                                    : truncateTitle(item.title, 14);

                              return (
                                <div
                                  className={`roulette__node roulette__node--${wheelDisplayMode}`}
                                  key={`${item.title}-${index}`}
                                  style={{
                                    transform: `translate(-50%, -50%) rotate(${centerAngle}deg) translateY(calc(var(--roulette-radius) * -1))`,
                                  }}
                                >
                                  <div
                                    className={`roulette__node-card${eliminatingTitle === item.title ? " is-eliminating" : ""}${winner?.title === item.title ? " is-winner" : ""}`}
                                    style={{ transform: `rotate(${-centerAngle}deg)` }}
                                    title={item.title}
                                  >
                                    {hasPoster && (
                                      <div className="roulette__node-poster">
                                        {item.posterUrl ? (
                                          <img src={item.posterUrl} alt={item.title} />
                                        ) : (
                                          <Film size={wheelDisplayMode === "compact" ? 14 : 18} />
                                        )}
                                      </div>
                                    )}
                                    <div className="roulette__node-title">{title}</div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        <div className="roulette__center">
                          <Film size={18} color="var(--accent)" />
                          <span>
                            {winner
                              ? `Победитель: ${winner.title}`
                              : currentSpin
                                ? `Выбыл: ${currentSpin.title}`
                                : "Готовы к запуску"}
                          </span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="roulette__instructions">
                          <span>Добавь фильмы</span>
                          <span>Потом нажми крутить</span>
                        </div>
                      </>
                    )}
                  </div>
                  <p className="roulette__current">
                    {winner
                      ? `Победитель: ${winner.title}`
                      : currentSpin
                        ? `Выбыл: ${currentSpin.title}`
                        : "Выбор: никто"}
                  </p>
                  <button
                    className="roulette__button"
                    type="button"
                    onClick={spin}
                    disabled={activeMovies.length <= 1 || isSpinning}
                  >
                    <Shuffle size={18} />
                    КРУТИТЬ РУЛЕТКУ
                  </button>
                  {winner && (
                    <div className="winner-card">
                      <div className="winner-card__poster">
                        {winner.posterUrl ? (
                          <img src={winner.posterUrl} alt={winner.title} />
                        ) : (
                          <Film size={32} />
                        )}
                      </div>
                      <div className="winner-card__info">
                        <span>Победитель</span>
                        <strong>{winner.title}</strong>
                        {winner.rutubeUrl && (
                          <a
                            href={winner.rutubeUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Смотреть на Rutube
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </section>
            </div>
          </main>
        )}

        {activeView === "desired" && (
          <main className="layout layout--single">
            <section className="panel desired-panel">
              <div className="panel__header panel__header--between">
                <div className="panel__header-left">
                  <Heart size={20} className="panel__icon" />
                  <div>
                    <h2 className="panel__title">Желаемые фильмы</h2>
                    <p className="panel__subtitle">
                      Добавляйте любые варианты, чтобы собрать список
                    </p>
                  </div>
                </div>
                {desired.length > 0 && (
                  <button
                    type="button"
                    className="reset-button"
                    onClick={() => {
                      addDesiredToRoulette();
                      setActiveView("roulette");
                    }}
                  >
                    В рулетку все ({desired.length})
                  </button>
                )}
              </div>

              <div className="desired-form">
                <input
                  className="desired-form__name"
                  value={nameValue}
                  onChange={(event) => setNameValue(event.target.value)}
                  placeholder="Ник или имя (Артём, Джебра, Миша...)"
                  aria-label="Ник или имя"
                />
                <p className="input-hint">
                  Можно выбрать друга ниже или ввести своё имя. Сохраняем
                  автоматически.
                </p>
                <div className="member-chips">
                  {MEMBERS.filter((member) => member !== "Я").map((member) => {
                    const active = normalizeMemberName(nameValue) === member;
                    return (
                      <button
                        key={member}
                        type="button"
                        className={`member-chip${active ? " active" : ""}`}
                        onClick={() => setNameValue(member)}
                      >
                        {member}
                      </button>
                    );
                  })}
                </div>
                <div className="input-row">
                  <input
                    className="desired-form__input"
                    value={desiredInputValue}
                    onChange={(event) =>
                      setDesiredInputValue(event.target.value)
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        addDesiredFromInput(desiredInputValue);
                      }
                    }}
                    placeholder="Напиши название фильма..."
                    aria-label="Желаемые фильмы"
                  />
                  <button
                    type="button"
                    onClick={() => addDesiredFromInput(desiredInputValue)}
                    disabled={!desiredInputValue.trim()}
                  >
                    Добавить
                  </button>
                </div>
                <p className="input-hint">
                  Можно добавлять по одному или списком через запятую.
                </p>
                {!poiskkinoToken && (
                  <p className="input-hint input-hint--warn">
                    Подсказки по базе фильмов включаются, когда задан
                    VITE_POISKKINO_TOKEN.
                  </p>
                )}
                {desiredSuggestions.length > 0 && (
                  <div className="suggestions">
                    <div className="suggestions__list">
                      {desiredSuggestions.map((item) => (
                        <button
                          key={`desired-${item.id}`}
                          type="button"
                          onClick={() => addDesiredFromInput(item.title)}
                          className="suggestion-card"
                        >
                          <div className="suggestion-card__poster">
                            {item.posterUrl ? (
                              <img src={item.posterUrl} alt={item.title} />
                            ) : (
                              <Film size={18} />
                            )}
                          </div>
                          <div className="suggestion-card__info">
                            <span className="suggestion-card__title">
                              {item.title}
                            </span>
                            <span className="suggestion-card__meta">
                              {item.subtitle}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="desired-form__actions">
                  <button
                    type="button"
                    onClick={addDesired}
                    disabled={!desiredInputValue.trim()}
                  >
                    Добавить в желаемые
                  </button>
                  {desired.length > 0 && (
                    <button
                      type="button"
                      className="desired-form__add-all"
                      onClick={() => {
                        addDesiredToRoulette();
                        setActiveView("roulette");
                      }}
                    >
                      В рулетку все ({desired.length})
                    </button>
                  )}
                </div>
              </div>

              {desiredGroups.length === 0 ? (
                <p className="desired-empty">
                  Пока никто не добавил фильмы. Скинь ссылку друзьям и пусть
                  каждый добавит свои варианты.
                </p>
              ) : (
                <div className="desired-groups">
                  {desiredGroups.map(([name, entries]) => (
                    <div key={name} className="desired-group">
                      <div className="desired-group__header">
                        <span className="desired-group__name">{name}</span>
                        <span className="desired-group__count">
                          {entries.length} шт.
                        </span>
                        <button
                          type="button"
                          onClick={() => addDesiredToRoulette(entries)}
                        >
                          В рулетку
                        </button>
                      </div>
                      <ul className="desired-list">
                        {entries.map((entry) => (
                          <li key={entry.id} className="desired-item">
                            <span className="desired-item__title">
                              {entry.title}
                            </span>
                            <div className="desired-item__actions">
                              <button
                                type="button"
                                onClick={() => addDesiredToRoulette([entry])}
                              >
                                →
                              </button>
                              <button
                                type="button"
                                onClick={() => removeDesired(entry.id)}
                              >
                                ✕
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </main>
        )}

        {activeView === "winners" && (
          <main className="layout layout--single">
            <section className="panel history-panel">
              <div className="panel__header panel__header--between">
                <div className="panel__header-left">
                  <Trophy size={20} className="panel__icon" />
                  <div>
                    <h2 className="panel__title">История победителей</h2>
                    <p className="panel__subtitle">
                      Что смотрели на прошлых вечерах
                    </p>
                  </div>
                </div>
                {winners.length > 0 && (
                  <button className="reset-button" onClick={clearWinners}>
                    <RefreshCw size={14} /> Сбросить
                  </button>
                )}
              </div>
              {winners.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state__icon">
                    <Trophy size={32} />
                  </div>
                  <h3>Пока пусто</h3>
                  <p>Победители появятся после первой рулетки</p>
                </div>
              ) : (
                <ul className="history-list">
                  {winners.map((winnerItem, index) => (
                    <li key={`${winnerItem.title}-${index}`}>
                      <div className="history-list__left">
                        <Trophy
                          size={16}
                          color="#F0B90B"
                          className="gold-icon"
                        />
                        <span>{winnerItem.title}</span>
                      </div>
                      <span className="history-list__date">
                        {new Date().toLocaleString("ru-RU", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </main>
        )}
      </div>
    </div>
  );
}

export default App;
