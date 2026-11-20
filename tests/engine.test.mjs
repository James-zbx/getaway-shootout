import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, stepGame, makeSnapshot, interpolateSnapshots, MAPS, STEP, WIN_SCORE } from '../dist/engine.js';

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
  player.weapon = 'pulse';
  player.ammo = 3;
  for (const other of state.players.slice(1)) other.x = 3000;
  const firing = { left: false, right: false, weapon: true };
  stepGame(state, [firing], STEP);
  assert.equal(state.projectiles.length, 1);
  assert.equal(player.ammo, 2);
  stepGame(state, [firing], STEP);
  assert.equal(state.projectiles.length, 1);
  stepGame(state, [neutral], STEP);
  stepGame(state, [firing], STEP);
  assert.equal(state.projectiles.length, 2);
  assert.equal(player.ammo, 1);
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

test('snapshot interpolation smooths positions', () => {
  const before = makeSnapshot(racing());
  const after = makeSnapshot(racing());
  before.players[0].x = 0;
  after.players[0].x = 100;
  const mixed = interpolateSnapshots(before, after, 0.5);
  assert.equal(mixed.players[0].x, 50);
});
