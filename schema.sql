CREATE TABLE app.signaling_rooms (
 code text PRIMARY KEY,
 host_token uuid NOT NULL,
 guest_token uuid NULL,
 status text NOT NULL DEFAULT 'waiting',
 created_at timestamptz NOT NULL,
 expires_at timestamptz NOT NULL,
 closed_at timestamptz NULL,
 host_presence timestamptz NOT NULL,
 guest_presence timestamptz NULL,
 guest_joined_at timestamptz NULL,
 next_signal_id integer NOT NULL DEFAULT 1,
 signal_count integer NOT NULL DEFAULT 0
);

CREATE INDEX signaling_rooms_expires_at_idx ON app.signaling_rooms (expires_at);

CREATE TABLE app.signaling_signals (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 room_code text NOT NULL REFERENCES app.signaling_rooms (code),
 sequence integer NOT NULL,
 sender text NOT NULL,
 kind text NOT NULL,
 payload jsonb NULL,
 created_at timestamptz NOT NULL,
 UNIQUE (room_code, sequence)
);

CREATE INDEX signaling_signals_room_sequence_idx ON app.signaling_signals (room_code, sequence);
