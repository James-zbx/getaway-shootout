const CAS_RETRIES = 16;
const CLEANUP_GRACE_MS = 24 * 60 * 60 * 1000;
const FALLBACK_EXPIRATION_MS = 25 * 60 * 60 * 1000;

function copyRoom(room) {
  return room ? { ...room } : null;
}

function roomKey(code) {
  return ['rooms', code];
}

function signalKey(code, sequence) {
  return ['signals', code, sequence];
}

// Keep records for a grace period after the core's fixed 60-minute TTL. Writes
// preserve the room's original cleanup deadline instead of extending its TTL.
function roomWriteOptions(room) {
  const cleanupAt = Date.parse(room.expires_at) + CLEANUP_GRACE_MS;
  const expireIn = Math.ceil(cleanupAt - Date.now());
  return {
    expireIn: Number.isFinite(expireIn) && expireIn > 0
      ? expireIn
      : FALLBACK_EXPIRATION_MS,
  };
}

export function createDenoKvStore({ kv, BackendError }) {
  if (!kv || !BackendError) throw new Error('Deno KV dependencies are required.');

  const unavailable = () => {
    throw new BackendError('database_unavailable', 503);
  };

  async function database(operation) {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof BackendError) throw error;
      unavailable();
    }
  }

  async function readRoom(code) {
    const entry = await kv.get(roomKey(code), { consistency: 'strong' });
    if (!entry || typeof entry !== 'object'
      || !Object.hasOwn(entry, 'value') || !Object.hasOwn(entry, 'versionstamp')) {
      unavailable();
    }
    return entry;
  }

  async function writeRoom(entry, room) {
    const result = await kv.atomic()
      .check({ key: entry.key, versionstamp: entry.versionstamp })
      .set(entry.key, room, roomWriteOptions(room))
      .commit();
    if (!result || typeof result.ok !== 'boolean') unavailable();
    return result.ok;
  }

  return {
    async createRoom(room) {
      return database(async () => {
        const key = roomKey(room.code);
        const result = await kv.atomic()
          .check({ key, versionstamp: null })
          .set(key, { ...room }, roomWriteOptions(room))
          .commit();
        if (!result || typeof result.ok !== 'boolean') unavailable();
        return result.ok;
      });
    },

    async getRoom(code) {
      return database(async () => copyRoom((await readRoom(code)).value));
    },

    async joinRoom({ code, token, joinedAt }) {
      return database(async () => {
        for (let attempt = 0; attempt < CAS_RETRIES; attempt += 1) {
          const entry = await readRoom(code);
          const room = entry.value;
          if (!room || room.status !== 'waiting') return false;
          const updated = {
            ...room,
            guest_token: token,
            guest_presence: joinedAt,
            guest_joined_at: joinedAt,
            status: 'joined',
          };
          if (await writeRoom(entry, updated)) return true;
        }
        return false;
      });
    },

    async touchPresence({ code, role, token, at }) {
      return database(async () => {
        for (let attempt = 0; attempt < CAS_RETRIES; attempt += 1) {
          const entry = await readRoom(code);
          const room = entry.value;
          if (!room || room[`${role}_token`] !== token) return false;
          const updated = { ...room, [`${role}_presence`]: at };
          if (await writeRoom(entry, updated)) return true;
        }
        return false;
      });
    },

    async listSignals({ code, recipient, after, limit }) {
      return database(async () => {
        const signals = [];
        const entries = kv.list({
          prefix: ['signals', code],
          consistency: 'strong',
        });
        for await (const entry of entries) {
          const sequence = entry?.key?.[2];
          const signal = entry?.value;
          // The room budget is 200, so scanning the prefix avoids applying the
          // page limit before own signals have been filtered out.
          if (typeof sequence !== 'number' || !signal
            || signal.sequence !== sequence || sequence <= after
            || signal.sender === recipient) continue;
          signals.push({
            id: sequence,
            kind: signal.kind,
            payload: signal.payload ?? null,
          });
          if (signals.length >= limit) break;
        }
        return signals;
      });
    },

    async allocateSignal({ code, expectedNextSignalId, expectedSignalCount, expectedStatus }) {
      return database(async () => {
        for (let attempt = 0; attempt < CAS_RETRIES; attempt += 1) {
          const entry = await readRoom(code);
          const room = entry.value;
          if (!room
            || room.next_signal_id !== expectedNextSignalId
            || room.signal_count !== expectedSignalCount
            || room.status !== expectedStatus) return null;

          const updated = {
            ...room,
            next_signal_id: expectedNextSignalId + 1,
            signal_count: expectedSignalCount + 1,
          };
          // A concurrent poll changes the versionstamp but not the allocator.
          // Retry that case; changed IDs/status still return a real conflict.
          if (await writeRoom(entry, updated)) return expectedNextSignalId;
        }
        return null;
      });
    },

    async insertSignal({ code, id, sender, kind, payload, createdAt }) {
      return database(async () => {
        const key = signalKey(code, id);
        const result = await kv.atomic()
          .check({ key, versionstamp: null })
          .set(key, {
            sequence: id,
            sender,
            kind,
            payload,
            created_at: createdAt,
          }, { expireIn: FALLBACK_EXPIRATION_MS })
          .commit();
        if (!result || typeof result.ok !== 'boolean' || !result.ok) unavailable();
      });
    },

    async closeRoom({ code, role, token, closedAt }) {
      return database(async () => {
        for (let attempt = 0; attempt < CAS_RETRIES; attempt += 1) {
          const entry = await readRoom(code);
          const room = entry.value;
          if (!room || room[`${role}_token`] !== token) return false;
          const updated = { ...room, status: 'closed', closed_at: closedAt };
          if (await writeRoom(entry, updated)) return true;
        }
        return false;
      });
    },
  };
}
