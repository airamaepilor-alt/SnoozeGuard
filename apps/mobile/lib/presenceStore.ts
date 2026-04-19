// Shared store for driver online presence — App.tsx populates, ConnectionTab reads.
// Avoids creating duplicate Supabase channels on the same client.

let _onlineIds: Set<string> = new Set();
const _listeners = new Set<() => void>();

export function setPresenceIds(ids: Set<string>): void {
  _onlineIds = ids;
  _listeners.forEach((fn) => fn());
}

export function getPresenceIds(): Set<string> {
  return _onlineIds;
}

export function subscribePresence(fn: () => void): () => void {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}
