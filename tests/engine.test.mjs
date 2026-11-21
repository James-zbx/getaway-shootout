import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame,
  stepGame,
  makeSnapshot,
  interpolateSnapshots,
  shotgunDamage,
  explosionDamage,
  linearFalloff,
  MAPS,
  STEP,
  WIN_SCORE,
  WEAPONS,
  YARD,
  MAX_HP,
  PLAYER_WIDTH,
  PERSON_HEIGHT,
  CRATE_SIZE,
  VEHICLE_SIZE
} from '../docs/engine.js';

const neutral = { left: false, right: false, weapon: false };
const racing = () => {
  const state = createGame({ humanCount: 1, seed: 42 });
  state.phase = 'racing';
  return state;
};

test('creates four racers and starts with a countdown', () => {
  const state = createGame({ humanCount: 2 });
  assert.equal(state.players.length, 4);
  assert.equal(state.humanCount, 2);
  assert.equal(state.phase, 'countdown');
  stepGame(state, [], STEP);
  assert.ok(state.phaseTime < 3);
});

test('W charges a leftward angle and release jumps left', () => {
  const state = racing();
  for (let index = 0; index < 60; index += 1) stepGame(state, [{ left: true, right: false, weapon: false }], STEP);
  const player = state.players[0];
  assert.equal(player.chargeDir, -1);
  assert.ok(player.angle < 0);
  assert.ok(player.charge > 0.9);
  stepGame(state, [neutral], STEP);
  assert.equal(player.grounded, false);
  assert.ok(player.vx < 0);
  assert.ok(player.vy < 0);
  assert.equal(player.charge, 0);
});

test('E charges and release jumps right', () => {
  const state = racing();
  for (let index = 0; index < 30; index += 1) stepGame(state, [{ left: false, right: true, weapon: false }], STEP);
  const player = state.players[0];
  assert.equal(player.chargeDir, 1);
  assert.ok(player.angle > 0);
  stepGame(state, [neutral], STEP);
  assert.ok(player.vx > 0);
  assert.ok(player.vy < 0);
});

test('R fires only on a new press and consumes ammunition', () => {
  const state = racing();
  const player = state.players[0];
  player.weapon = 'pistol';
  player.ammo = WEAPONS.pistol.ammo;
  for (const other of state.players.slice(1)) {
    other.x = 3000;
    other.checkpointX = 3000;
  }
  const firing = { left: false, right: false, weapon: true };
  stepGame(state, [firing], STEP);
  player.fireCooldown = 0;
  stepGame(state, [firing], STEP);
  assert.equal(state.projectiles.length, 1);
  stepGame(state, [neutral], STEP);
  stepGame(state, [firing], STEP);
  assert.equal(state.projectiles.length, 2);
  assert.equal(player.ammo, WEAPONS.pistol.ammo - 2);
});

test('shotgun damage is full inside one yard and linearly reaches zero at eleven yards', () => {
  assert.equal(shotgunDamage(0.5 * YARD, false), 14);
  assert.equal(shotgunDamage(1 * YARD, true), 20);
  assert.equal(shotgunDamage(6 * YARD, false), 7);
  assert.equal(shotgunDamage(11 * YARD, false), 0);
});

test('explosions use their full-damage plateau and linear zero-distance falloff', () => {
  assert.equal(explosionDamage(150, 0, YARD, 7 * YARD), 150);
  assert.equal(explosionDamage(150, YARD, YARD, 7 * YARD), 150);
  assert.equal(explosionDamage(150, 4 * YARD, YARD, 7 * YARD), 75);
  assert.equal(explosionDamage(150, 7 * YARD, YARD, 7 * YARD), 0);
  assert.equal(explosionDamage(200, 4 * YARD, 4 * YARD, 16 * YARD), 200);
  assert.equal(explosionDamage(200, 10 * YARD, 4 * YARD, 16 * YARD), 100);
  assert.equal(explosionDamage(200, 16 * YARD, 4 * YARD, 16 * YARD), 0);
});

test('damage falloff never becomes negative beyond its zero-distance boundary', () => {
  assert.equal(linearFalloff(150, 8 * YARD, YARD, 7 * YARD), 0);
  assert.equal(linearFalloff(40, 30 * YARD, YARD, 20 * YARD), 0);
  assert.equal(linearFalloff(200, 20 * YARD, 4 * YARD, 16 * YARD), 0);
  assert.equal(linearFalloff(40, -10, YARD, 20 * YARD), 40);
});

test('direct-fire weapons use the same linear falloff model', () => {
  assert.equal(linearFalloff(40, 0, YARD, 20 * YARD), 40);
  assert.equal(linearFalloff(40, 10.5 * YARD, YARD, 20 * YARD), 20);
  assert.equal(linearFalloff(40, 20 * YARD, YARD, 20 * YARD), 0);
  assert.equal(linearFalloff(500, 13 * YARD, YARD, 25 * YARD), 250);
});

test('medkits use the current-health doubling formula without exceeding maximum health', () => {
  const state = racing();
  const player = state.players[0];
  player.hp = 20;
  state.pickups[0].active = true;
  state.pickups[0].type = 'medkit';
  state.pickups[0].x = player.x;
  state.pickups[0].y = player.y - 50;
  stepGame(state, [neutral], STEP);
  assert.equal(player.hp, MAX_HP);
});

test('a shield prevents weapon damage while it is active', () => {
  const state = racing();
  const shooter = state.players[0];
  const target = state.players[1];
  shooter.weapon = 'pistol';
  shooter.ammo = WEAPONS.pistol.ammo;
  shooter.facing = 1;
  for (const other of state.players.slice(1)) {
    other.x = 3000;
    other.checkpointX = 3000;
    other.ai = { cooldown: 100, releaseIn: 0, fireCooldown: 100 };
  }
  target.x = shooter.x + 300;
  target.checkpointX = target.x;
  target.shield = 5;
  stepGame(state, [{ left: false, right: false, weapon: true }], STEP);
  for (let index = 0; index < 20; index += 1) stepGame(state, [neutral], STEP);
  assert.equal(target.hp, MAX_HP);
});

test('a weapon kill returns the player to the latest checkpoint', () => {
  const state = racing();
  const shooter = state.players[0];
  const target = state.players[1];
  shooter.weapon = 'pistol';
  shooter.ammo = WEAPONS.pistol.ammo;
  shooter.facing = 1;
  for (const other of state.players.slice(1)) {
    other.x = 3000;
    other.checkpointX = 3000;
    other.ai = { cooldown: 100, releaseIn: 0, fireCooldown: 100 };
  }
  target.x = shooter.x + 300;
  target.checkpointX = shooter.x + 120;
  target.hp = 1;
  stepGame(state, [{ left: false, right: false, weapon: true }], STEP);
  for (let index = 0; index < 20; index += 1) stepGame(state, [neutral], STEP);
  assert.equal(target.dead, true);
  assert.equal(target.hp, 0);
  target.respawnTimer = 0.01;
  stepGame(state, [neutral], STEP);
  assert.equal(target.dead, false);
  assert.equal(target.hp, MAX_HP);
  assert.equal(Math.round(target.x), Math.round(target.checkpointX));
});

test('pickup points receive a deterministic random weapon each round', () => {
  const first = createGame({ seed: 123 });
  const second = createGame({ seed: 123 });
  const allowed = new Set(['knife', 'pistol', 'smg', 'shotgun', 'bomb', 'rocket', 'akm', 'swap', 'shield', 'medkit']);
  assert.deepEqual(first.pickups.map(pickup => pickup.type), second.pickups.map(pickup => pickup.type));
  for (const pickup of first.pickups) assert.ok(allowed.has(pickup.type));
});

test('two human slots leave two active AI racers', () => {
  const state = createGame({ humanCount: 2, seed: 7 });
  state.phase = 'racing';
  const starts = state.players.slice(2).map(player => player.x);
  for (let index = 0; index < 360; index += 1) stepGame(state, [neutral, neutral], STEP);
  for (const id of [2, 3]) {
    const player = state.players[id];
    assert.ok(player.x !== starts[id - 2] || !player.grounded || player.chargeDir !== 0);
  }
});

test('reaching extraction scores a round and starts the next map', () => {
  const state = racing();
  state.players[0].x = MAPS[0].finish;
  stepGame(state, [neutral], STEP);
  assert.equal(state.phase, 'roundOver');
  assert.equal(state.roundWinner, 0);
  assert.equal(state.players[0].score, 1);
  state.phaseTime = 0.001;
  stepGame(state, [neutral], STEP);
  assert.equal(state.round, 2);
  assert.equal(state.mapIndex, 1);
  assert.equal(state.phase, 'countdown');
  assert.equal(state.players[0].score, 1);
});

test('winning the fifth round ends the match', () => {
  const state = racing();
  state.players[0].score = WIN_SCORE - 1;
  state.players[0].x = MAPS[0].finish;
  stepGame(state, [neutral], STEP);
  state.phaseTime = 0.001;
  stepGame(state, [neutral], STEP);
  assert.equal(state.phase, 'matchOver');
  assert.equal(state.players[0].score, WIN_SCORE);
});

test('falling off the course respawns the racer', () => {
  const state = racing();
  const player = state.players[0];
  player.grounded = false;
  player.y = 900;
  player.vy = 100;
  stepGame(state, [neutral], STEP);
  assert.ok(player.y <= 620);
  assert.equal(player.grounded, true);
  assert.ok(player.stun > 0);
});

test('players fall when their whole body leaves a platform edge', () => {
  const state = racing();
  const player = state.players[0];
  player.x = 639;
  player.y = 620;
  player.grounded = true;
  player.vx = 300;
  stepGame(state, [neutral], STEP);
  assert.equal(player.grounded, false);
});

test('vehicles support players and block their side movement', () => {
  const state = racing();
  const player = state.players[0];
  const vehicle = state.vehicles[0];
  player.x = vehicle.x;
  player.y = vehicle.y + VEHICLE_SIZE.topOffset;
  player.grounded = true;
  stepGame(state, [neutral], STEP);
  assert.equal(player.grounded, true);
  assert.equal(player.y, vehicle.y + VEHICLE_SIZE.topOffset);

  player.x = vehicle.x - VEHICLE_SIZE.width / 2 - PLAYER_WIDTH / 2 - 20;
  player.y = vehicle.y - 20;
  player.grounded = false;
  player.vx = 800;
  player.vy = 0;
  for (let index = 0; index < 20; index += 1) stepGame(state, [neutral], STEP);
  assert.ok(player.x <= vehicle.x - VEHICLE_SIZE.width / 2);
});

test('the AKM is a one-shot rifle within its twenty-five yard range', () => {
  const state = racing();
  const shooter = state.players[0];
  const target = state.players[1];
  shooter.weapon = 'akm';
  shooter.ammo = WEAPONS.akm.ammo;
  shooter.facing = 1;
  for (const other of state.players.slice(1)) {
    other.x = 3000;
    other.checkpointX = 3000;
    other.ai = { cooldown: 100, releaseIn: 0, fireCooldown: 100 };
  }
  target.x = shooter.x + 5 * YARD;
  target.checkpointX = target.x;
  target.ai = { cooldown: 100, releaseIn: 0, fireCooldown: 100 };
  stepGame(state, [{ left: false, right: false, weapon: true }], STEP);
  for (let index = 0; index < 60; index += 1) stepGame(state, [neutral], STEP);
  assert.equal(target.dead, true);
  assert.equal(target.hp, 0);
});

test('players have collision bodies and cannot pass through each other', () => {
  const state = racing();
  const a = state.players[0];
  const b = state.players[1];
  for (const other of state.players.slice(2)) other.x = 3000;
  a.x = 500;
  a.y = 620;
  a.grounded = true;
  a.vx = 300;
  b.x = 520;
  b.y = 620;
  b.grounded = true;
  b.vx = 0;
  b.ai = { cooldown: 100, releaseIn: 0, fireCooldown: 100 };
  stepGame(state, [neutral], STEP);
  assert.ok(Math.abs(b.x - a.x) >= PLAYER_WIDTH - 0.01);
});

test('checkpoints follow the latest safe checkpoint node', () => {
  const state = racing();
  const player = state.players[0];
  player.x = 100;
  player.checkpointX = 100;
  player.y = 620;
  player.grounded = true;
  for (const other of state.players.slice(1)) {
    other.x = 3000;
    other.checkpointX = 3000;
    other.ai = { cooldown: 100, releaseIn: 0, fireCooldown: 100 };
  }
  player.x = 900;
  player.y = 580;
  stepGame(state, [neutral], STEP);
  assert.equal(player.checkpointX, 850);
});

test('a thrown bomb does not damage its owner', () => {
  const state = racing();
  const thrower = state.players[0];
  thrower.x = 300;
  thrower.y = 620;
  thrower.grounded = true;
  thrower.facing = 1;
  thrower.weapon = 'bomb';
  thrower.ammo = 1;
  for (const other of state.players.slice(1)) {
    other.x = 3000;
    other.checkpointX = 3000;
    other.ai = { cooldown: 100, releaseIn: 0, fireCooldown: 100 };
  }
  stepGame(state, [{ left: false, right: false, weapon: true }], STEP);
  for (let index = 0; index < 180; index += 1) stepGame(state, [neutral], STEP);
  assert.equal(thrower.hp, MAX_HP);
});

test('explosive crates are low enough to jump over', () => {
  assert.ok(CRATE_SIZE.height <= 34);
  assert.ok(CRATE_SIZE.height < PERSON_HEIGHT / 2);
});

test('the whole player body is blocked by the side of a platform', () => {
  const state = racing();
  const player = state.players[0];
  player.x = 650;
  player.y = 600;
  player.grounded = false;
  player.vx = 900;
  player.vy = 0;
  for (const other of state.players.slice(1)) {
    other.x = 3000;
    other.checkpointX = 3000;
    other.ai = { cooldown: 100, releaseIn: 0, fireCooldown: 100 };
  }
  for (let index = 0; index < 30; index += 1) stepGame(state, [neutral], STEP);
  assert.ok(player.x <= 700 + PLAYER_WIDTH / 2);
});

test('jumping upward collides with a platform underside', () => {
  const state = racing();
  const player = state.players[0];
  player.x = 950;
  player.y = 530;
  player.grounded = false;
  player.vx = 0;
  player.vy = -900;
  for (const other of state.players.slice(1)) {
    other.x = 3000;
    other.checkpointX = 3000;
    other.ai = { cooldown: 100, releaseIn: 0, fireCooldown: 100 };
  }
  for (let index = 0; index < 30; index += 1) stepGame(state, [neutral], STEP);
  assert.ok(player.y >= 529);
});

test('an angled landing preserves tilt and gradually restores upright', () => {
  const state = racing();
  const player = state.players[0];
  for (const other of state.players.slice(1)) {
    other.x = 3000;
    other.checkpointX = 3000;
    other.ai = { cooldown: 100, releaseIn: 0, fireCooldown: 100 };
  }
  player.x = 300;
  player.y = 540;
  player.grounded = false;
  player.vx = 0;
  player.vy = 500;
  player.angle = 0.75;
  player.av = 1.2;
  for (let index = 0; index < 12; index += 1) stepGame(state, [neutral], STEP);
  assert.equal(player.grounded, true);
  assert.ok(Math.abs(player.angle) > 0.05);
  const landedAngle = Math.abs(player.angle);
  for (let index = 0; index < 45; index += 1) stepGame(state, [neutral], STEP);
  assert.ok(Math.abs(player.angle) < landedAngle);
});

test('weapons automatically aim at the closest living character', () => {
  const state = racing();
  const shooter = state.players[0];
  shooter.x = 500;
  shooter.y = 620;
  shooter.grounded = true;
  shooter.weapon = 'pistol';
  shooter.ammo = WEAPONS.pistol.ammo;
  const left = state.players[1];
  const right = state.players[2];
  const far = state.players[3];
  left.x = 400;
  left.y = 620;
  right.x = 700;
  right.y = 620;
  far.x = 3000;
  far.y = 620;
  for (const other of [left, right, far]) other.ai = { cooldown: 100, releaseIn: 0, fireCooldown: 100 };
  stepGame(state, [{ left: false, right: false, weapon: true }], STEP);
  assert.equal(shooter.targetId, left.id);
  assert.ok(shooter.aimAngle < -2.5 || shooter.aimAngle > 2.5);
  assert.equal(left.hp, MAX_HP - WEAPONS.pistol.damage);
});

test('rocket projectiles use the slower adjusted launch speed', () => {
  assert.ok(WEAPONS.rocket.speed < 1500);
});

test('shield pickups are stored and only activate when R is pressed', () => {
  const state = racing();
  const player = state.players[0];
  state.pickups[0].active = true;
  state.pickups[0].type = 'shield';
  state.pickups[0].x = player.x;
  state.pickups[0].y = player.y - 50;
  stepGame(state, [neutral], STEP);
  assert.equal(player.weapon, 'shield');
  assert.equal(player.shield, 0);
  stepGame(state, [{ left: false, right: false, weapon: true }], STEP);
  assert.equal(player.shield, 5);
  assert.equal(player.weapon, null);
});

test('an equipped item blocks picking another held item', () => {
  const state = racing();
  const player = state.players[0];
  player.weapon = 'pistol';
  player.ammo = 4;
  state.pickups[0].active = true;
  state.pickups[0].type = 'shield';
  state.pickups[0].x = player.x;
  state.pickups[0].y = player.y - 50;
  stepGame(state, [neutral], STEP);
  assert.equal(player.weapon, 'pistol');
  assert.equal(state.pickups[0].active, true);
});

test('death clears held items and active shields', () => {
  const state = createGame({ humanCount: 2, seed: 42 });
  state.phase = 'racing';
  const player = state.players[0];
  player.weapon = 'shield';
  player.ammo = 1;
  player.shield = 4;
  player.hp = 1;
  for (let index = 0; index < 260; index += 1) stepGame(state, [neutral, neutral], STEP);
  const killer = state.players[1];
  killer.x = player.x + 100;
  killer.y = player.y;
  killer.weapon = 'pistol';
  killer.ammo = 4;
  killer.facing = 1;
  killer.ai = { cooldown: 100, releaseIn: 0, fireCooldown: 100 };
  for (const other of state.players.slice(2)) {
    other.x = 3000;
    other.ai = { cooldown: 100, releaseIn: 0, fireCooldown: 100 };
  }
  stepGame(state, [neutral, { left: false, right: false, weapon: true }], STEP);
  for (let index = 0; index < 20; index += 1) stepGame(state, [neutral, neutral], STEP);
  assert.equal(player.dead, true);
  assert.equal(player.weapon, null);
  assert.equal(player.shield, 0);
});

test('explicit checkpoints use the latest passed checkpoint node', () => {
  const state = racing();
  const player = state.players[0];
  player.x = 900;
  player.y = 580;
  player.grounded = true;
  stepGame(state, [neutral], STEP);
  assert.equal(player.checkpointX, 850);
});

test('leaning toward an obstacle gently slides the player away', () => {
  const state = racing();
  const player = state.players[0];
  player.x = 1245;
  player.y = 520;
  player.grounded = true;
  player.angle = 0.55;
  player.chargeDir = 1;
  player.vx = 0;
  for (const other of state.players.slice(1)) {
    other.x = 3000;
    other.ai = { cooldown: 100, releaseIn: 0, fireCooldown: 100 };
  }
  const before = player.x;
  stepGame(state, [{ left: false, right: true, weapon: false }], STEP);
  assert.ok(player.x < before);
  assert.ok(before - player.x < 5);
});

test('vehicles are low enough to leave clearance under overhead platforms', () => {
  assert.ok(VEHICLE_SIZE.height < PERSON_HEIGHT / 2);
});

test('a player trapped against an obstacle is pushed clear instead of remaining stuck', () => {
  const state = racing();
  const player = state.players[0];
  const vehicle = state.vehicles[0];
  for (const other of state.players.slice(1)) {
    other.x = 3000;
    other.ai = { cooldown: 100, releaseIn: 0, fireCooldown: 100 };
  }
  player.x = vehicle.x - VEHICLE_SIZE.width / 2 - PLAYER_WIDTH / 2 - 10;
  player.y = vehicle.y - 10;
  player.grounded = true;
  player.vx = 0;
  const before = player.x;
  const holdingRight = { left: false, right: true, weapon: false };
  for (let index = 0; index < 140; index += 1) stepGame(state, [holdingRight], STEP);
  assert.ok(player.x < before);
});

test('snapshot interpolation smooths positions', () => {
  const before = makeSnapshot(racing());
  const after = makeSnapshot(racing());
  before.players[0].x = 0;
  after.players[0].x = 100;
  const mixed = interpolateSnapshots(before, after, 0.5);
  assert.equal(mixed.players[0].x, 50);
});
