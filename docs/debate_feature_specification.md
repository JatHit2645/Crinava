# Crinava Debate Feature Specification

> [!IMPORTANT]
> **RESUME KEYWORD:** `CRINAVA_DEBATE_SYSTEM`
> Use this keyword in future sessions to reload this debate design spec and begin implementation.

---

## 📋 1. Core Feature Overview
The Debate Feature is a premium, real-time community engagement platform where cricket fans argue hot topics (Claims) in a gamified, self-policing environment. 

---

## 🎨 2. Front-End User Experience (UX)

### A. The "Battleground" Debate Page
* **Unified Debate Feed:** A single chat timeline where both opposing sides talk directly to each other.
* **Stance Badges:** Every message is clearly marked with the user's stance (e.g., a green border/badge for "AGREE" and a red border/badge for "DISAGREE").
* **Live Tug-of-War Meter:** An SVG progress bar at the top of the chat featuring two animated cricket players holding a rope. As the vote percentages shift, the rope moves, and the characters animate (the winning side pulls back, the losing side struggles).
* **The "Mind-Blower" Vote Flip:**
  * Users can only flip their vote **once** per debate.
  * When flipping, users have the option to tag/mention the specific comment that convinced them to change their mind.
  * The author of the tagged comment receives bonus reputation points.
* **Tactical Pin (Admin Spotlight):** Outstanding comments chosen by the admin are pinned to the very top of the debate feed to showcase high-quality, smart analysis.

### B. The Debate Archives
* **Ended Debates:** A separate section on the website showing closed debates. The chat is frozen/read-only, and the final results (the winning percentage and the most "clapped" key arguments) are prominently displayed.
* **Template-Based Verdict Wrap-Up:** A visual summary block dynamically generated using variables from the database (e.g., *"62% of fans voted YES. The most clapped comment defending the stance was by @user1, and the most clapped countering comment was by @user2."*).
* **Trending Badges:** Active debates with high volume receive a custom animated text gradient with a flickering flame animation.

---

## 🛡️ 3. Multi-Layered Moderation System (Anti-Abuse)
Since a single moderation method can be bypassed, the platform uses three complementary systems that do **not** rely on slow AI APIs or easily bypassed "bad-word lists":

### Layer A: Stance-Balanced Moderation (Peer Review)
* **Rules:** A comment is only automatically hidden if it receives **2 reports from members of the author's own team**.
* **Rationale:** Opponents will always report each other out of bias, but if your own team reports you, you have crossed a line.
* **Visual:** The message is instantly blurred out in the chat and replaced with: *"Hidden by the author's teammates."*

### Layer B: Volume Anomaly Scanner (Raid Protection)
* **Rules:** The system monitors the speed of incoming reports on a single user.
* **Action:** If a specific user receives a massive spike of reports (e.g., 20 reports in 60 seconds), the system flags the user as "Under Attack." The user is automatically blocked immediately, and their case is sent to the Admin Panel. 
  * The Admin can view all of that user's recent comments and impose a custom, temporary platform-wide ban.
  * If the Admin finds the user **not guilty** and lifts the block, all users who participated in reporting them will receive a penalty decrease in their own reputation score (preventing targeted harassment raids).

### Layer C: Algorithmic Spam Filtering
* **Rules:** Automatically flags messages that fit technical spam profiles:
  * **Link Hijacking:** Any comment containing an external URL is instantly blocked (no report required) and sent directly to the Admin moderation queue.
  * **Mathematical Duplicate Check:** If a user tries to copy-paste the exact same comment multiple times, they are instantly hit with a rate-limit lockout (temporarily blocked from posting).
  * **Caps Lock / Entropy Check:** Flagging messages composed of 90%+ CAPITAL LETTERS or random keyboard mashes.

---

## 🏆 4. Gamification & Badges
* **Modular Badges Framework:** A clean, backend-driven profile badges section. When the debate system is built, we will drop in 2 new badges (e.g., "Debate Champion" for participating in 10 debates, and "Mind-Blower" for converting 5 players to their side) using a reusable badge schema.
* **Top Debaters Leaderboard:** Displays users ranked by comment "Claps" and "Mind-Blower" conversions.

---

## ⚙️ 5. Admin Control Center Portal
* **Debate Launcher:** Create a debate claim, add starter facts for both sides, set the Trending flag, and **set a custom timer** (e.g. 15 minutes for flash match debates, 24 hours, or indefinite).
* **Moderator Trash Can Queue:** Review teammate-hidden and auto-flagged comments with two options:
  * **Restore:** Approve and unhide the comment.
  * **Banish (Delete):** Permanently delete it. 3 Banished comments equals an automatic 7-day lockout for the user.
* **Tactical Pin Control:** Admin can select and pin/unpin comments directly from the moderator view.
* **End Debate:** Freeze the debate state and move it to the Archive.

---

## ✍️ 6. User-Suggested Debates (Gatekept)
* **Rule:** Users can suggest and post their own debate topics.
* **Gated Access:** This feature is locked behind user statistics: **only users with a Reputation Score of 90 or higher** can submit/launch their own debate suggestions to the community feed.

---

## ⚔️ 7. Future Roadmap / Post-Launch Mode: User-vs-User 1v1 Duels
* **Concept:** A limited-time high-intensity mode introduced after launch.
* **Duels:** User A challenges User B. Only these two users can speak in the debate room (limited to a set number of messages and character counts). The rest of the community spectates, claps, and votes to crown the winner of the duel.
