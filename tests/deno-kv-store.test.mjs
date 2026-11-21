import assert from 'node:assert/strict';
import test from 'node:test';
import { createDenoKvStore } from '../functions/deno-kv-store.mjs';

class TestBackendError extends Error {
  constructor(code, status) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

function sameComponent(left, right) {
  return typeof left === typeof right && left === right;
}

function compareKeys(left, right) {
  for (let index = 0; index < Math.min(left.length, right.length); index += 1) {
    if (sameComponent(left[index], right[index])) continue;
    if (typeof left[index] === 'number' && typeof right[index] === 'number') {
      return left[index] - right[index];
    }
    return String(left[index]).localeCompare(String(right[index]));
  }
  return left.length - right.length;
}

// A small strict-CAS fake: commits yield before checking versionstamps, which
// deliberately makes concurrent callers read the same old room version.
class FakeKv {
  #records = new Map();
  #version = 0;

  constructor() {
    this.writeOptions = [];
  }

  #id(key) {
    return JSON.stringify(key);
  }

  #clone(value) {
    return value === null ? null : structuredClone(value);
  }

  async get(key) {
    const record = this.#records.get(this.#id(key));
    return {
      key: [...key],
      value: record ? this.#clone(record.value) : null,
      versionstamp: record?.versionstamp ?? null,
    };
  }

  async *list({ prefix }) {
    const records = [...this.#records.values()]
      .filter(record => prefix.length <= record.key.length
        && prefix.every((component, index) => sameComponent(component, record.key[index])))
      .sort((left, right) => compareKeys(left.key, right.key));
    for (const record of records) {
      yield {
        key: [...record.key],
        value: this.#clone(record.value),
        versionstamp: record.versionstamp,
      };
    }
  }

  atomic() {
    const checks = [];
    const sets = [];
    const kv = this;
    return {
      check(check) {
        checks.push(check);
        return this;
      },
      set(key, value, options) {
        sets.push({ key, value, options });
        return this;
      },
      async commit() {
        await Promise.resolve();
        for (const check of checks) {
          const current = kv.#records.get(kv.#id(check.key));
          if ((current?.versionstamp ?? null) !== check.versionstamp) return { ok: false };
        }
        for (const set of sets) {
          kv.#version += 1;
          const versionstamp = String(kv.#version).padStart(20, '0');
          kv.#records.set(kv.#id(set.key), {
            key: [...set.key],
            value: kv.#clone(set.value),
            versionstamp,
          });
          kv.writeOptions.push({ key: [...set.key], options: set.options });
        }
        return { ok: true, versionstamp: String(kv.#version).padStart(20, '0') };
      },
    };
  }
}

function setup() {
  const kv = new FakeKv();
  const store = createDenoKvStore({ kv, BackendError: TestBackendError });
  return { kv, store };
}

function room(code = 'AAAAAA', hostToken = 'host-token') {
  return {
    code,
    host_token: hostToken,
    guest_token: null,
    status: 'waiting',
    created_at: '2026-01-01T00:00:00.000Z',
    expires_at: '2026-01-01T01:00:00.000Z',
    closed_at: null,
    host_presence: '2026-01-01T00:00:00.000Z',
    guest_presence: null,
    next_signal_id: 1,
    signal_count: 0,
  };
}

test('createRoom is insert-if-absent and joinRoom has exactly one winner', async () => {
  const { store } = setup();
  const creations = await Promise.all([
    store.createRoom(room()),
    store.createRoom(room()),
  ]);
  assert.deepEqual(creations.sort(), [false, true]);

  const joins = await Promise.all(Array.from({ length: 8 }, (_, index) => store.joinRoom({
    code: 'AAAAAA',
    token: `guest-${index}`,
    joinedAt: `2026-01-01T00:00:0${index + 1}.000Z`,
  })));
  assert.equal(joins.filter(Boolean).length, 1);

  const joined = await store.getRoom('AAAAAA');
  assert.equal(joined.status, 'joined');
  assert.match(joined.guest_token, /^guest-[0-7]$/);
  assert.equal(joined.guest_presence, joined.guest_joined_at);
  assert.equal(await store.joinRoom({
    code: 'AAAAAA', token: 'late-guest', joinedAt: '2026-01-01T00:01:00.000Z',
  }), false);
  assert.equal(await store.getRoom('MISSING'), null);
});

test('signal allocation retries presence CAS conflicts without reusing IDs', async () => {
  const { store } = setup();
  await store.createRoom(room());
  await store.joinRoom({
    code: 'AAAAAA', token: 'guest-token', joinedAt: '2026-01-01T00:00:01.000Z',
  });

  const [id, touched] = await Promise.all([
    store.allocateSignal({
      code: 'AAAAAA',
      expectedNextSignalId: 1,
      expectedSignalCount: 0,
      expectedStatus: 'joined',
    }),
    store.touchPresence({
      code: 'AAAAAA', role: 'host', token: 'host-token', at: '2026-01-01T00:00:02.000Z',
    }),
  ]);
  assert.equal(id, 1);
  assert.equal(touched, true);

  const updated = await store.getRoom('AAAAAA');
  assert.equal(updated.host_presence, '2026-01-01T00:00:02.000Z');
  assert.equal(updated.next_signal_id, 2);
  assert.equal(updated.signal_count, 1);
  assert.equal(await store.allocateSignal({
    code: 'AAAAAA',
    expectedNextSignalId: 1,
    expectedSignalCount: 0,
    expectedStatus: 'joined',
  }), null);
  assert.equal(await store.allocateSignal({
    code: 'AAAAAA',
    expectedNextSignalId: 2,
    expectedSignalCount: 1,
    expectedStatus: 'waiting',
  }), null);
});

test('signals use numeric ordered sequences, filter recipients and reject duplicates', async () => {
  const { store } = setup();
  await store.createRoom(room());
  const inserted = [
    { id: 2, sender: 'guest', kind: 'answer', payload: { sdp: 'answer' } },
    { id: 1, sender: 'host', kind: 'offer', payload: { sdp: 'offer' } },
    { id: 3, sender: 'host', kind: 'ice', payload: null },
  ];
  for (const signal of inserted) {
    await store.insertSignal({
      code: 'AAAAAA',
      ...signal,
      createdAt: '2026-01-01T00:00:03.000Z',
    });
  }

  assert.deepEqual(await store.listSignals({
    code: 'AAAAAA', recipient: 'guest', after: 0, limit: 100,
  }), [
    { id: 1, kind: 'offer', payload: { sdp: 'offer' } },
    { id: 3, kind: 'ice', payload: null },
  ]);
  assert.deepEqual(await store.listSignals({
    code: 'AAAAAA', recipient: 'host', after: 0, limit: 100,
  }), [{ id: 2, kind: 'answer', payload: { sdp: 'answer' } }]);
  assert.deepEqual(await store.listSignals({
    code: 'AAAAAA', recipient: 'guest', after: 1, limit: 1,
  }), [{ id: 3, kind: 'ice', payload: null }]);

  await assert.rejects(store.insertSignal({
    code: 'AAAAAA', id: 1, sender: 'host', kind: 'ice', payload: null,
    createdAt: '2026-01-01T00:00:04.000Z',
  }), error => error instanceof TestBackendError
    && error.code === 'database_unavailable' && error.status === 503);
});

test('closeRoom validates the capability token and survives polling conflicts', async () => {
  const { store } = setup();
  await store.createRoom(room());
  assert.equal(await store.closeRoom({
    code: 'AAAAAA', role: 'host', token: 'wrong', closedAt: '2026-01-01T00:10:00.000Z',
  }), false);

  const [closed, touched] = await Promise.all([
    store.closeRoom({
      code: 'AAAAAA', role: 'host', token: 'host-token', closedAt: '2026-01-01T00:10:00.000Z',
    }),
    store.touchPresence({
      code: 'AAAAAA', role: 'host', token: 'host-token', at: '2026-01-01T00:09:59.000Z',
    }),
  ]);
  assert.equal(closed, true);
  assert.equal(touched, true);
  const roomAfterClose = await store.getRoom('AAAAAA');
  assert.equal(roomAfterClose.status, 'closed');
  assert.equal(roomAfterClose.closed_at, '2026-01-01T00:10:00.000Z');
  assert.equal(roomAfterClose.host_presence, '2026-01-01T00:09:59.000Z');

  assert.equal(await store.closeRoom({
    code: 'AAAAAA', role: 'host', token: 'host-token', closedAt: '2026-01-01T00:11:00.000Z',
  }), true);
  assert.equal((await store.getRoom('AAAAAA')).closed_at, '2026-01-01T00:11:00.000Z');
});

test('KV failures become stable database_unavailable errors and expiration is safe', async () => {
  const { kv, store } = setup();
  kv.get = async () => { throw new Error('private backend details'); };
  await assert.rejects(store.getRoom('AAAAAA'), error => {
    assert.equal(error instanceof TestBackendError, true);
    assert.equal(error.code, 'database_unavailable');
    assert.equal(error.status, 503);
    assert.doesNotMatch(error.message, /private backend details/);
    return true;
  });

  const healthy = setup();
  await healthy.store.createRoom(room());
  const expiration = healthy.kv.writeOptions[0].options.expireIn;
  assert.equal(Number.isSafeInteger(expiration), true);
  assert.ok(expiration >= 60 * 60 * 1000);
  assert.ok(expiration <= 25 * 60 * 60 * 1000);
});
