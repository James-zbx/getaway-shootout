const ROOM_COLUMNS = [
  'code',
  'host_token',
  'guest_token',
  'status',
  'created_at',
  'expires_at',
  'closed_at',
  'host_presence',
  'guest_presence',
  'next_signal_id',
  'signal_count',
].join(',');

// This is the only production module that talks to the injected Function DB.
// Values and column names are fixed or validated by signaling-core.mjs.
export function createDatabaseStore({ db, BackendError }) {
  const fail = (code, status) => {
    throw new BackendError(code, status);
  };

  async function rows(query) {
    let result;
    try {
      result = await query;
    } catch {
      // A failed or unknown database result is never automatically replayed.
      fail('database_unavailable', 503);
    }
    if (result?.error) fail('database_unavailable', 503);
    return Array.isArray(result?.data) ? result.data : [];
  }

  return {
    async createRoom(room) {
      const inserted = await rows(db.from('signaling_rooms')
        .insertIfAbsent(room, { onConflict: 'code' })
        .select('code'));
      return inserted.length === 1;
    },

    async getRoom(code) {
      const found = await rows(db.from('signaling_rooms')
        .select(ROOM_COLUMNS)
        .eq('code', code)
        .limit(1));
      return found[0] ?? null;
    },

    async joinRoom({ code, token, joinedAt }) {
      // Waiting is the compare-and-set predicate: exactly one join can win.
      const updated = await rows(db.from('signaling_rooms')
        .update({
          guest_token: token,
          guest_presence: joinedAt,
          guest_joined_at: joinedAt,
          status: 'joined',
        })
        .eq('code', code)
        .eq('status', 'waiting')
        .select('code'));
      return updated.length === 1;
    },

    async touchPresence({ code, role, token, at }) {
      const presenceColumn = role === 'host' ? 'host_presence' : 'guest_presence';
      const tokenColumn = role === 'host' ? 'host_token' : 'guest_token';
      const updated = await rows(db.from('signaling_rooms')
        .update({ [presenceColumn]: at })
        .eq('code', code)
        .eq(tokenColumn, token)
        .select('code'));
      return updated.length === 1;
    },

    async listSignals({ code, recipient, after, limit }) {
      const found = await rows(db.from('signaling_signals')
        .select('sequence,kind,payload')
        .eq('room_code', code)
        .neq('sender', recipient)
        .gt('sequence', after)
        .order('sequence', { ascending: true })
        .limit(limit));
      return found.map(row => ({
        id: row.sequence,
        kind: row.kind,
        payload: row.payload ?? null,
      }));
    },

    async allocateSignal({ code, expectedNextSignalId, expectedSignalCount, expectedStatus }) {
      // Updating the allocator and the 200-signal budget in one row is atomic.
      // A later insert failure can burn an ID, but can never duplicate one.
      const updated = await rows(db.from('signaling_rooms')
        .update({
          next_signal_id: expectedNextSignalId + 1,
          signal_count: expectedSignalCount + 1,
        })
        .eq('code', code)
        .eq('next_signal_id', expectedNextSignalId)
        .eq('signal_count', expectedSignalCount)
        .eq('status', expectedStatus)
        .select('next_signal_id'));
      return updated.length === 1 ? expectedNextSignalId : null;
    },

    async insertSignal({ code, id, sender, kind, payload, createdAt }) {
      await rows(db.from('signaling_signals')
        .insert({
          id: crypto.randomUUID(),
          room_code: code,
          sequence: id,
          sender,
          kind,
          payload,
          created_at: createdAt,
        })
        .select('id'));
    },

    async closeRoom({ code, role, token, closedAt }) {
      const tokenColumn = role === 'host' ? 'host_token' : 'guest_token';
      const updated = await rows(db.from('signaling_rooms')
        .update({ status: 'closed', closed_at: closedAt })
        .eq('code', code)
        .eq(tokenColumn, token)
        .select('code'));
      return updated.length === 1;
    },
  };
}
