// Invitations must have a finite lifetime. This is checked by the API rather
// than a timer so it continues to work on serverless deployments while idle.
export const GAME_INVITATION_LIFETIME_MS = 60 * 60 * 1000;

export function gameInvitationExpiresAt(now = Date.now()) {
  return new Date(now + GAME_INVITATION_LIFETIME_MS).toISOString();
}

export function hasGameInvitationExpired(match, now = Date.now()) {
  if (match?.status !== 'INVITED') return false;
  const expiry = new Date(match.expiresAt || match.createdAt).getTime();
  return Number.isFinite(expiry) && expiry <= now;
}

// Mutates only the supplied match. The caller is responsible for persisting
// the enclosing database and mirroring this status onto the invitation message.
export function expireGameInvitation(match, now = Date.now()) {
  if (!hasGameInvitationExpired(match, now)) return false;
  const timestamp = new Date(now).toISOString();
  match.status = 'EXPIRED';
  match.activePlayerId = null;
  match.completedAt = timestamp;
  match.updatedAt = timestamp;
  match.revision = Number(match.revision || 0) + 1;
  return true;
}
