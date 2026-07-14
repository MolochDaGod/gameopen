/**
 * Steam-style friends / party panel.
 * Uses fleet account + character roster as your local party;
 * multiplayer CTA routes into The Lobby.
 */
import { useMemo } from "react";
import { MessageCircle, UserPlus, Users } from "lucide-react";
import type { GrudgeAccount, GrudgeCharacter } from "../lib/grudgeAuth";
import { loginWithGrudgeId } from "../lib/grudgeAuth";
import type { AppMode } from "../lib/openRoutes";

export type FriendPresence = "online" | "ingame" | "away" | "offline";

export interface FriendRow {
  id: string;
  name: string;
  status: FriendPresence;
  detail: string;
  tone: string;
  isYou?: boolean;
  isCharacter?: boolean;
}

interface Props {
  account: GrudgeAccount | null;
  characters: GrudgeCharacter[];
  selectedCharacterId: string | null;
  /** Current hub surface for "In game" detail */
  currentTitle?: string;
  compact?: boolean;
  onOpenLobby: () => void;
  onSelectCharacter?: (id: string) => void;
}

function charTone(i: number): string {
  const tones = ["#66c0f4", "#a4d007", "#ffb24d", "#9d8bff", "#ff7a7a", "#5fe0ff"];
  return tones[i % tones.length]!;
}

function initials(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (p.length === 0) return "?";
  if (p.length === 1) return p[0]!.slice(0, 2).toUpperCase();
  return `${p[0]![0] ?? ""}${p[1]![0] ?? ""}`.toUpperCase();
}

function statusLabel(s: FriendPresence): string {
  if (s === "ingame") return "In game";
  if (s === "online") return "Online";
  if (s === "away") return "Away";
  return "Offline";
}

export function buildFriendRows(
  account: GrudgeAccount | null,
  characters: GrudgeCharacter[],
  selectedCharacterId: string | null,
  currentTitle?: string,
): FriendRow[] {
  const rows: FriendRow[] = [];

  if (account) {
    const name = account.displayName || account.grudgeId || "You";
    rows.push({
      id: `you:${account.grudgeId || "self"}`,
      name,
      status: "ingame",
      detail: currentTitle ? `Playing ${currentTitle}` : "In Grudge Open",
      tone: "#66c0f4",
      isYou: true,
    });
  } else {
    rows.push({
      id: "you:guest",
      name: "Guest",
      status: "online",
      detail: "Not signed in",
      tone: "#8f98a0",
      isYou: true,
    });
  }

  characters.forEach((ch, i) => {
    const selected = ch.id === selectedCharacterId;
    const name = ch.name || ch.raceId || `Character ${i + 1}`;
    rows.push({
      id: ch.id,
      name,
      status: selected ? "ingame" : "online",
      detail: selected
        ? "Active loadout"
        : [ch.raceId, ch.classId, ch.level != null ? `Lv ${ch.level}` : null]
            .filter(Boolean)
            .join(" · ") || "Fleet character",
      tone: charTone(i),
      isCharacter: true,
    });
  });

  return rows;
}

export function FriendsPanel({
  account,
  characters,
  selectedCharacterId,
  currentTitle,
  compact,
  onOpenLobby,
  onSelectCharacter,
}: Props) {
  const rows = useMemo(
    () => buildFriendRows(account, characters, selectedCharacterId, currentTitle),
    [account, characters, selectedCharacterId, currentTitle],
  );

  const online = rows.filter((r) => r.status !== "offline").length;

  return (
    <aside className={`steam-friends ${compact ? "steam-friends--compact" : ""}`} aria-label="Friends">
      <div className="steam-friends-head">
        <Users size={14} />
        <span>Friends</span>
        <span className="steam-friends-count">{online}</span>
      </div>

      <div className="steam-friends-list">
        {rows.map((row) => (
          <button
            key={row.id}
            type="button"
            className={`steam-friend ${row.isYou ? "is-you" : ""}`}
            onClick={() => {
              if (row.isCharacter && onSelectCharacter) onSelectCharacter(row.id);
            }}
            title={row.isCharacter ? "Set active character" : row.detail}
          >
            <span className="steam-friend-avatar" style={{ background: `${row.tone}22`, color: row.tone }}>
              {initials(row.name)}
              <i className={`steam-friend-dot steam-friend-dot--${row.status}`} />
            </span>
            <span className="steam-friend-meta">
              <span className="steam-friend-name">
                {row.name}
                {row.isYou && <em>you</em>}
              </span>
              <span className="steam-friend-status">
                <span className={`steam-friend-status-label steam-friend-status-label--${row.status}`}>
                  {statusLabel(row.status)}
                </span>
                <span className="steam-friend-detail">{row.detail}</span>
              </span>
            </span>
          </button>
        ))}
      </div>

      <div className="steam-friends-actions">
        {!account ? (
          <button type="button" className="steam-friends-cta" onClick={() => void loginWithGrudgeId(false)}>
            <UserPlus size={14} />
            Sign in for party roster
          </button>
        ) : characters.length === 0 ? (
          <a
            className="steam-friends-cta"
            href="https://character.grudge-studio.com?era=warlords&from=gameopen"
            target="_blank"
            rel="noreferrer"
          >
            <UserPlus size={14} />
            Create a character
          </a>
        ) : (
          <button type="button" className="steam-friends-cta" onClick={onOpenLobby}>
            <MessageCircle size={14} />
            Find multiplayer rooms
          </button>
        )}
      </div>
    </aside>
  );
}

/** Optional helper for status strip */
export function friendsSummary(mode: AppMode, rows: FriendRow[]): string {
  const online = rows.filter((r) => r.status !== "offline").length;
  return `${online} online · ${mode === "doors" ? "Library" : "In session"}`;
}
