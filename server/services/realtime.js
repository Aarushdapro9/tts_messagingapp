let realtimeServer = null;

export function setRealtimeServer(server) { realtimeServer = server; }

// Server-generated events only. Clients cannot choose another user's room or
// fabricate a receipt through this path.
export function emitToUser(userId, event, payload) {
  if (userId) realtimeServer?.to(userId).emit(event, payload);
}
