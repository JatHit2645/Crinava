# 🏟️ CRINAVA DEBATE BATTLEGROUND — Progress Report

> **TRIGGER KEYWORD:** `CRINAVA_DEBATE_SYSTEM_V2`
> Paste this keyword at the start of any new conversation to instantly resume work on the Debate feature.

---

## 🟢 COMPLETED — What's Built & Working

### Frontend (src/App.tsx)

| Feature | Status | Notes |
|---|---|---|
| Debate Room tab in bottom nav | ✅ Done | `activeTab === "debate"` |
| Debate card grid (2-col responsive) | ✅ Done | Maps `debates` state array |
| "The Case For / Against" display | ✅ Done | Reads `d.argument_for`, `d.argument_against` |
| Tug-of-War rope meter with animated characters | ✅ Done | Emoji players with emotions at each end, DOMINATING/LEADING/STRUGGLING/LOSING labels, rope texture, ⚡ VS knot |
| 🔥 Trending badge (fire flicker) | ✅ Done | `animate-pulse` + orange glow shadow |
| Vote For / Vote Against buttons | ✅ Done | Calls `handleVote()` |
| Mind-Blower vote flip (1 allowed) | ✅ Done | First flip allowed, second blocked with 403 |
| "You Voted" lock indicator | ✅ Done | Shows once `d.userVote` is set |
| Vote-to-Chat gate | ✅ Done | Chat input hidden behind "View-Only Mode" until `userVote` exists |
| Chat bubble stance colors | ✅ Done | Blue bubble for "for", Red bubble for "against" |
| Chat username stance colors | ✅ Done | Blue name for "for", Red name for "against" |
| Chat message rendering | ✅ Done | Uses `msg.username`, `msg.stance`, `msg.created_at` |
| Debate data auto-refresh | ✅ Done | `useCallback` + `setInterval(5s)` with `?username=` param |
| `fetchDebates()` with userVote hydration | ✅ Done | Passes `username` query param, server maps `userVote` |

### Backend (server.ts)

| Feature | Status | Notes |
|---|---|---|
| `GET /api/debates?username=X` | ✅ Done | Returns debates with `userVote` mapped from in-memory `voteTracker` |
| `POST /api/debates/:id/vote` | ✅ Done | First vote + one flip allowed, second flip returns 403 "Mind-Blower limit" |
| `GET /api/debates/:id/messages` | ✅ Done | Fetches chat messages from `debate_messages` table |
| `POST /api/debates/:id/messages` | ✅ Done | Inserts new chat message with `username`, `text`, `stance` |
| In-memory `voteTracker` | ✅ Done | `Record<"debateId::username", {stance, hasFlipped}>` — primary vote state |
| `POST /api/admin/debate` | ✅ Done | Create new debate (topic, args, trending, timer) |
| `PUT /api/admin/debate/:id` | ✅ Done | Edit any field (claim, args, trending, status, votes, end_time) |
| `DELETE /api/admin/debate/:id` | ✅ Done | Delete debate + clear voteTracker entries |
| `POST /api/admin/debate/:id/reset-votes` | ✅ Done | Reset votes to 0 + clear voteTracker + clear debate_votes table |

### Admin Panel (src/pages/AdminControlCenter.tsx)

| Feature | Status | Notes |
|---|---|---|
| Debate Publisher (Create New) | ✅ Done | Topic, For/Against args, Timer selector, Trending toggle, Broadcast button |
| Debate Manager (Live Debates List) | ✅ Done | Lists all debates with vote counts, status, trending badges |
| Inline Debate Editor | ✅ Done | Edit claim, args, votes, status, trending for any debate |
| Reset Votes button | ✅ Done | Resets vote counts to 0 with confirmation |
| Delete Debate button | ✅ Done | Permanently removes debate with confirmation |
| Auto-refresh every 5s | ✅ Done | Polls `/api/debates` when debate tab is active |

### Database Schema (src/scripts/debate_schema.sql)

| Table | Status | Key Columns |
|---|---|---|
| `debates` | ✅ Created | `id`, `claim`, `argument_for`, `argument_against`, `votes_for`, `votes_against`, `status`, `trending`, `end_time`, `creator_id` |
| `debate_messages` | ✅ Created | `id`, `debate_id`, `username`, `text`, `stance`, `claps`, `is_pinned`, `is_hidden` |
| `debate_votes` | ✅ Created | `id`, `debate_id`, `username`, `stance`, `has_flipped`, `convinced_by_message_id` |

### TypeScript Interface (App.tsx)

```typescript
interface Debate {
  id: string;
  claim: string;
  argument_for: string;
  argument_against: string;
  votes_for: number;
  votes_against: number;
  userVote?: "for" | "against"; // injected by server from voteTracker
  status: "open" | "closed";
  created_at: string;
  end_time?: string;
  trending?: boolean;
}
```

### Environment & Database

| Setting | Value |
|---|---|
| Active Supabase Project | `efxumodpgomszqpgdauk` (blog database) |
| Env vars used | `BLOG_SUPABASE_URL`, `BLOG_SUPABASE_KEY` |
| Server client file | `src/lib/supabaseServer.ts` — prioritizes `BLOG_SUPABASE_*` |
| Old DB (LOCKED) | `eoulupnfbcpmeywietvu` — exceeded quota, do NOT use |

---

## 🟡 PARTIALLY DONE — Needs Finishing

| Feature | What's Done | What's Left |
|---|---|---|
| Tactical Pin (Admin Spotlight) | `is_pinned` column exists in `debate_messages` | Need admin UI button to pin/unpin + render pinned messages at top |
| Debate Archives | `status` column supports `"closed"` | Need archive view page, freeze chat when closed |
| Template Verdict Wrap-Up | DB has all needed fields | Need auto-generated verdict block |
| Custom Timer (Admin) | `end_time` column exists | Need countdown timer UI + auto-close logic |

---

## 🔴 NOT STARTED — From Specification

| Feature | Spec Section | Priority |
|---|---|---|
| **Stance-Balanced Moderation (Peer Review)** | §3 Layer A | High |
| **Volume Anomaly Scanner (Raid Protection)** | §3 Layer B | Medium |
| **Algorithmic Spam Filtering** | §3 Layer C | Medium |
| **Claps system** | §2A + §4 | Medium |
| **Gamification Badges** | §4 | Low |
| **Top Debaters Leaderboard** | §4 | Low |
| **User-Suggested Debates (90+ rep gate)** | §6 | Low |
| **1v1 Duels (Post-Launch)** | §7 | Future |

---

## 🔧 Architecture Decisions

### Why In-Memory Vote Tracking?
The `debate_votes` table in Supabase was silently failing queries. Votes are tracked in a server-side `Record`. DB writes are non-blocking fire-and-forget. **Trade-off:** Votes lost on server restart.

### Mind-Blower Vote Flip
Users get exactly 1 flip. First vote: permanent. One change allowed (the "Mind-Blower"). After flipping once, `hasFlipped` is set to `true` and all further changes return 403.

### Session Identity
Unauthenticated users vote as `"GuestUser"`. When auth is wired, `session?.user?.email?.split("@")[0]` will be used.

---

## 📁 Key File Locations

| File | Purpose |
|---|---|
| `src/App.tsx` | All debate UI — cards, chat, vote, gate |
| `server.ts` | All debate API endpoints + voteTracker |
| `src/pages/AdminControlCenter.tsx` | Admin debate editor panel |
| `src/lib/supabaseServer.ts` | Backend Supabase client |
| `src/scripts/debate_schema.sql` | SQL to create debate tables |
| `docs/debate_feature_specification.md` | Full feature specification |
| `docs/CRINAVA_DEBATE_PROGRESS.md` | THIS FILE |

---

*Last updated: 2026-07-13*
*Trigger keyword: `CRINAVA_DEBATE_SYSTEM_V2`*
