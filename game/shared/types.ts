export type MovieEntry = {
  title: string;
  posterUrl?: string;
  rutubeUrl?: string;
};

export type DesiredEntry = {
  id: string;
  name: string;
  title: string;
};

export type RoomData = {
  id: string;
  updatedAt: number;
  currentStep: "prep" | "pool" | "roulette" | "result";
  desired: DesiredEntry[];
  allMovies: MovieEntry[];
  activeMovies: MovieEntry[];
  eliminatedMovies: MovieEntry[];
  winner: MovieEntry | null;
  winners: MovieEntry[];
};

export const MEMBERS = ["Джебра", "Артём", "Миша", "Я"] as const;
export type MemberName = (typeof MEMBERS)[number];

export function normalizeMemberName(name: string): string {
  const n = name.trim().toLowerCase();
  if (n.includes("джебр") || n === "gebra") return "Джебра";
  if (n.includes("арт") || n === "artem" || n === "артем") return "Артём";
  if (n.includes("миш") || n === "misha") return "Миша";
  if (n === "я" || n === "me" || n === "ya") return "Я";
  return name.trim();
}

export function memberKey(name: string): MemberName | null {
  const normalized = normalizeMemberName(name);
  return (MEMBERS as readonly string[]).includes(normalized)
    ? (normalized as MemberName)
    : null;
}

export function emptyRoom(id: string): RoomData {
  return {
    id,
    updatedAt: Date.now(),
    currentStep: "prep",
    desired: [],
    allMovies: [],
    activeMovies: [],
    eliminatedMovies: [],
    winner: null,
    winners: [],
  };
}
