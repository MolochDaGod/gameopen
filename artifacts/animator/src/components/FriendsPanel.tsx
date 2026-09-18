/**
 * Steam-style friends rail — Treaty (Railway /api/treaty) is the account SSOT.
 * Chat chrome is the Nexus Nemesis dock (friends-widget.js popout).
 * Party characters stay a loadout list — they are not friends.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { MessageCircle, UserPlus, Users } from "lucide-react";
import type { GrudgeAccount, GrudgeCharacter } from "../lib/grudgeAuth";
import { loginWithGrudgeId } from "../lib/grudgeAuth";
import type { AppMode } from "../lib/openRoutes";
import {
  fetchTreatySocial,
  fetchTreatyUnread,
  respondTreatyFriendRequest,
  sendTreatyFriendRequest,
  type TreatyFriendProfile,
  type TreatySocial,
} from "../lib/accountShared";

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

function friendLabel(f: TreatyFriendProfile): string {
  return f.displayName || f.grudgeId || "Warlord";
}

function openNexusFriends() {
  const w = window as Window & { openGrudgeFriends?: () => void };
  if (typeof w.openGrudgeFriends === "function") {
    w.openGrudgeFriends();
    return;
  }
  const token =
    localStorage.getItem("grudge.open.token") ||
    localStorage.getItem("grudge_auth_token") ||
    localStorage.getItem("sso_token") ||
    "";
  const url = new URL("https://nemesis.grudge-studio.com/friends");
  url.searchParams.set("popout", "1");
  url.searchParams.set("app", "gameopen");
  if (token) url.hash = `token=${encodeURIComponent(token)}`;
  window.open(
    url.toString(),
    "nexus-friends",
    "popup=yes,width=360,height=820,menubar=no,toolbar=no,location=no,status=no,resizable=yes",
  );
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
  const [social, setSocial] = useState<TreatySocial | null>(null);
  const [unread, setUnread] = useState(0);
  const [addQuery, setAddQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!account) {
      setSocial(null);
      setUnread(0);
      return;
    }
    const [next, count] = await Promise.all([fetchTreatySocial(), fetchTreatyUnread()]);
    setSocial(next);
    setUnread(count);
  }, [account]);

  useEffect(() => {
    void refresh();
    if (!account) return;
    const t = window.setInterval(() => void refresh(), 20000);
    return () => window.clearInterval(t);
  }, [account, refresh]);

  const you: FriendRow = account
    ? {
        id: `you:${account.grudgeId || "self"}`,
        name: account.displayName || account.grudgeId || "You",
        status: "ingame",
        detail: currentTitle ? `Playing ${currentTitle}` : "In Grudge Open",
        tone: "#66c0f4",
        isYou: true,
      }
    : {
        id: "you:guest",
        name: "Guest",
        status: "online",
        detail: "Not signed in",
        tone: "#8f98a0",
        isYou: true,
      };

  const friendRows: FriendRow[] = useMemo(() => {
    const friends = social?.friends ?? [];
    return friends.map((f, i) => ({
      id: f.accountId || f.id,
      name: friendLabel(f),
      status: "online" as FriendPresence,
      detail: f.grudgeId || "Treaty ally",
      tone: charTone(i),
    }));
  }, [social]);

  const incoming = social?.pendingIncoming ?? [];
  const outgoing = social?.pendingOutgoing ?? [];
  const online = 1 + friendRows.length;

  const sendAdd = async () => {
    const q = addQuery.trim();
    if (!q) return;
    setBusy(true);
    setHint(null);
    const res = await sendTreatyFriendRequest(q);
    setBusy(false);
    if (!res.ok) {
      setHint(res.error || "Could not send request");
      return;
    }
    setAddQuery("");
    setHint("Request sent");
    void refresh();
  };

  return (
    <aside className={`steam-friends ${compact ? "steam-friends--compact" : ""}`} aria-label="Friends">
      <div className="steam-friends-head">
        <Users size={14} />
        <span>Friends</span>
        <span className="steam-friends-count">{online}</span>
        {unread > 0 ? <span className="steam-friends-count">{unread}</span> : null}
      </div>

      <div className="steam-friends-list">
        <button type="button" className="steam-friend is-you" title={you.detail}>
          <span className="steam-friend-avatar" style={{ background: `${you.tone}22`, color: you.tone }}>
            {initials(you.name)}
            <i className={`steam-friend-dot steam-friend-dot--${you.status}`} />
          </span>
          <span className="steam-friend-meta">
            <span className="steam-friend-name">
              {you.name}
              <em>you</em>
            </span>
            <span className="steam-friend-status">
              <span className={`steam-friend-status-label steam-friend-status-label--${you.status}`}>
                {statusLabel(you.status)}
              </span>
              <span className="steam-friend-detail">{you.detail}</span>
            </span>
          </span>
        </button>

        {incoming.map((req) => (
          <div key={req.id} className="steam-friend" title="Incoming Treaty request">
            <span className="steam-friend-avatar" style={{ background: "#ffb24d22", color: "#ffb24d" }}>
              {initials(friendLabel(req))}
            </span>
            <span className="steam-friend-meta">
              <span className="steam-friend-name">{friendLabel(req)}</span>
              <span className="steam-friend-status">
                <span className="steam-friend-detail">Incoming request</span>
              </span>
              <span style={{ display: "flex", gap: 6, marginTop: 4 }}>
                <button
                  type="button"
                  className="steam-friends-cta"
                  onClick={() => void respondTreatyFriendRequest(req.id, true).then(() => refresh())}
                >
                  Accept
                </button>
                <button
                  type="button"
                  className="steam-friends-cta"
                  onClick={() => void respondTreatyFriendRequest(req.id, false).then(() => refresh())}
                >
                  Decline
                </button>
              </span>
            </span>
          </div>
        ))}

        {friendRows.map((row) => (
          <button key={row.id} type="button" className="steam-friend" onClick={openNexusFriends} title={row.detail}>
            <span className="steam-friend-avatar" style={{ background: `${row.tone}22`, color: row.tone }}>
              {initials(row.name)}
              <i className={`steam-friend-dot steam-friend-dot--${row.status}`} />
            </span>
            <span className="steam-friend-meta">
              <span className="steam-friend-name">{row.name}</span>
              <span className="steam-friend-status">
                <span className={`steam-friend-status-label steam-friend-status-label--${row.status}`}>
                  {statusLabel(row.status)}
                </span>
                <span className="steam-friend-detail">{row.detail}</span>
              </span>
            </span>
          </button>
        ))}

        {account && friendRows.length === 0 && incoming.length === 0 ? (
          <p className="steam-friend-detail" style={{ padding: "8px 10px", margin: 0 }}>
            No Treaty friends yet. Add a Grudge ID below — same list as Nexus, Warlords, and Account.
          </p>
        ) : null}

        {outgoing.length > 0 ? (
          <p className="steam-friend-detail" style={{ padding: "4px 10px", margin: 0 }}>
            {outgoing.length} outgoing request{outgoing.length === 1 ? "" : "s"}
          </p>
        ) : null}

        {characters.length > 0 ? (
          <>
            <div className="steam-friends-head" style={{ marginTop: 8 }}>
              <span>Loadout</span>
            </div>
            {characters.slice(0, 4).map((ch, i) => {
              const selected = ch.id === selectedCharacterId;
              const name = ch.name || ch.raceId || `Character ${i + 1}`;
              return (
                <button
                  key={ch.id}
                  type="button"
                  className="steam-friend"
                  onClick={() => onSelectCharacter?.(ch.id)}
                  title="Set active character"
                >
                  <span
                    className="steam-friend-avatar"
                    style={{ background: `${charTone(i)}22`, color: charTone(i) }}
                  >
                    {initials(name)}
                  </span>
                  <span className="steam-friend-meta">
                    <span className="steam-friend-name">{name}</span>
                    <span className="steam-friend-status">
                      <span className="steam-friend-detail">
                        {selected ? "Active hero" : [ch.raceId, ch.classId].filter(Boolean).join(" · ") || "Hero"}
                      </span>
                    </span>
                  </span>
                </button>
              );
            })}
          </>
        ) : null}
      </div>

      <div className="steam-friends-actions">
        {!account ? (
          <button type="button" className="steam-friends-cta" onClick={() => void loginWithGrudgeId(false)}>
            <UserPlus size={14} />
            Sign in for friends
          </button>
        ) : (
          <>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void sendAdd();
              }}
              style={{ display: "flex", gap: 6, width: "100%" }}
            >
              <input
                value={addQuery}
                onChange={(e) => setAddQuery(e.target.value)}
                placeholder="Grudge ID or name"
                aria-label="Add friend by Grudge ID"
                style={{
                  flex: 1,
                  minWidth: 0,
                  background: "#1b2838",
                  border: "1px solid #2a475e",
                  color: "#c7d5e0",
                  fontSize: 12,
                  padding: "6px 8px",
                  borderRadius: 3,
                }}
              />
              <button type="submit" className="steam-friends-cta" disabled={busy || addQuery.trim().length < 2}>
                Add
              </button>
            </form>
            {hint ? <span className="steam-friend-detail">{hint}</span> : null}
            <button type="button" className="steam-friends-cta" onClick={openNexusFriends}>
              <MessageCircle size={14} />
              Chat &amp; presence
            </button>
            <button type="button" className="steam-friends-cta" onClick={onOpenLobby}>
              Find multiplayer rooms
            </button>
          </>
        )}
      </div>
    </aside>
  );
}

export function friendsSummary(mode: AppMode, rows: FriendRow[]): string {
  const online = rows.filter((r) => r.status !== "offline").length;
  return `${online} online · ${mode === "doors" ? "Library" : "In session"}`;
}

export function buildFriendRows(
  account: GrudgeAccount | null,
  _characters: GrudgeCharacter[],
  _selectedCharacterId: string | null,
  currentTitle?: string,
): FriendRow[] {
  if (!account) {
    return [{ id: "you:guest", name: "Guest", status: "online", detail: "Not signed in", tone: "#8f98a0", isYou: true }];
  }
  return [
    {
      id: `you:${account.grudgeId || "self"}`,
      name: account.displayName || account.grudgeId || "You",
      status: "ingame",
      detail: currentTitle ? `Playing ${currentTitle}` : "In Grudge Open",
      tone: "#66c0f4",
      isYou: true,
    },
  ];
}
