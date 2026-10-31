# Games architecture audit and first-release design

## Repository audit

| Area | Existing implementation | Reuse strategy | Required changes |
|---|---|---|---|
| Authentication | JWT credentials and Google ID-token verification in Express | Derive every game actor from the existing `Auth` middleware | None to authenticate game actions |
| Messaging | Express message API, chat-bound messages, optional Socket.IO hints | Store one compact invitation/status card in the existing chat | Add `game_invite` message rendering |
| Database | Supabase `public.app_state` JSONB record with optimistic compare-and-swap | Keep match snapshots and accepted actions in that record | Add `games` and `gameActions` collections |
| Realtime | Socket.IO for active message notifications plus 30-second adaptive refresh | Reuse the existing chat refresh; poll only an opened game screen | No game-specific persistent connection |
| Notifications | In-app admin alerts | Future turn alerts can use the existing alert system | Not needed for Tic-Tac-Toe correctness |
| Frontend | Create React App, Redux Toolkit, Tailwind-style utility classes | Lazy-load game runtime from the chat screen | Add Games launcher, invitation card, game overlay |
| Backend | Express services deployed through Vercel services | Add a small authenticated games router | Add state-machine/action validation |
| Hosting | Vercel + Supabase | Keep both providers | No new managed service |

## Cost-conscious design

One accepted action performs one authenticated request and one conditional Supabase state write. A game screen performs one initial read and, only while open, one reconciliation read every 30 seconds. The app never sends positions, animations, aim previews, or frames over the network.

The current `app_state` record uses optimistic compare-and-swap. The game action ID is idempotent: retrying a completed request returns the prior saved result instead of applying a move twice. This is sufficient for the initial low-traffic deployment, but a larger release should migrate matches/actions to dedicated Supabase tables and an RPC transaction so that record size and write contention do not grow with all chat data.

## Current implementation status

- **Implemented:** shared game-session shape, invitation lifecycle, participant checks, revision checks, idempotency, server-authoritative Tic-Tac-Toe moves, draw/win determination, direct-chat game launcher, invitation card, resumable match overlay, forfeit, and unit tests for the core board rules.
- **Tested locally:** all four Tic-Tac-Toe rules unit tests passed; server syntax checks and the Create React App production build passed.
- **Partially implemented:** chat notification delivery uses existing refresh rather than a game-specific event.
- **Not implemented:** Mini Golf and 8-Ball Pool. They remain labelled as upcoming in the launcher until their deterministic physics, authoritative validators, test fixtures, and rules adjudicators are complete.

## Match lifecycle

```text
INVITED --accept--> ACTIVE --legal action--> ACTIVE
   |                    |                     |
decline              forfeit              win/draw
   v                    v                     v
CANCELLED          FORFEITED        COMPLETED / DRAW
```

Only the two direct-chat participants can read or change a match. The server ignores any client-provided actor identity and calculates the player mark, active player, winner, and revision itself.

## Routes

- `POST /api/games/matches` creates a Tic-Tac-Toe invitation in a direct conversation.
- `GET /api/games/matches/:matchId` reads an authorized match.
- `POST /api/games/matches/:matchId/accept` and `/decline` answer an invitation.
- `POST /api/games/matches/:matchId/actions` accepts one revision-checked move.
- `POST /api/games/matches/:matchId/forfeit` ends an active match.
- `GET /api/games/conversations/:conversationId/matches` lists authorized conversation matches.
