export const STEP = 1 / 60;
export const WIN_SCORE = 5;
export const GRAVITY = 1850;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const approach = (value, target, amount) => value < target ? Math.min(value + amount, target) : Math.max(value - amount, target);

export const MAPS = [
  {
    name: '霓虹屋顶',
    finish: 4750,
    theme: 'city',
    platforms: [
      { x: -200, y: 620, w: 820, h: 140 },
      { x: 700, y: 580, w: 430, h: 180 },
      { x: 1210, y: 520, w: 310, h: 240 },
      { x: 1600, y: 610, w: 540, h: 150 },
      { x: 2240, y: 550, w: 280, h: 210 },
      { x: 2610, y: 470, w: 300, h: 290 },
      { x: 3000, y: 590, w: 570, h: 170 },
      { x: 3670, y: 530, w: 300, h: 230 },
      { x: 4070, y: 600, w: 900, h: 160 },
      { x: 890, y: 405, w: 150, h: 24, type: 'steel' },
      { x: 1800, y: 430, w: 170, h: 24, type: 'steel' },
      { x: 3230, y: 390, w: 170, h: 24, type: 'steel' }
    ],
    pickups: [
      { x: 930, y: 365, type: 'pulse' },
      { x: 1760, y: 560, type: 'launcher' },
      { x: 2740, y: 420, type: 'pulse' },
      { x: 3310, y: 350, type: 'launcher' },
      { x: 4200, y: 550, type: 'pulse' }
    ]
  },
  {
    name: '云端工地',
    finish: 4950,
    theme: 'construction',
    platforms: [
      { x: -200, y: 620, w: 700, h: 140 },
      { x: 590, y: 620, w: 300, h: 140 },
      { x: 980, y: 540, w: 280, h: 220 },
      { x: 1350, y: 450, w: 230, h: 310 },
      { x: 1680, y: 580, w: 510, h: 180 },
      { x: 2290, y: 500, w: 250, h: 260 },
      { x: 2640, y: 610, w: 360, h: 150 },
      { x: 3100, y: 520, w: 240, h: 240 },
      { x: 3440, y: 440, w: 240, h: 320 },
      { x: 3780, y: 570, w: 380, h: 190 },
      { x: 4260, y: 600, w: 930, h: 160 },
      { x: 700, y: 420, w: 130, h: 24, type: 'steel' },
      { x: 1880, y: 390, w: 160, h: 24, type: 'steel' },
      { x: 2750, y: 405, w: 140, h: 24, type: 'steel' },
      { x: 3890, y: 380, w: 150, h: 24, type: 'steel' }
    ],
    pickups: [
      { x: 740, y: 380, type: 'pulse' },
      { x: 1450, y: 400, type: 'launcher' },
      { x: 1950, y: 350, type: 'pulse' },
      { x: 2800, y: 365, type: 'launcher' },
      { x: 3520, y: 390, type: 'pulse' },
      { x: 4380, y: 550, type: 'launcher' }
    ]
  },
  {
    name: '空港快线',
    finish: 5100,
    theme: 'skyport',
    platforms: [
      { x: -200, y: 620, w: 760, h: 140 },
      { x: 650, y: 550, w: 500, h: 210 },
      { x: 1240, y: 610, w: 280, h: 150 },
      { x: 1610, y: 510, w: 270, h: 250 },
      { x: 1970, y: 430, w: 250, h: 330 },
      { x: 2320, y: 580, w: 490, h: 180 },
      { x: 2910, y: 500, w: 230, h: 260 },
      { x: 3240, y: 420, w: 230, h: 340 },
      { x: 3570, y: 560, w: 400, h: 200 },
      { x: 4070, y: 490, w: 250, h: 270 },
      { x: 4420, y: 600, w: 920, h: 160 },
      { x: 810, y: 365, w: 160, h: 24, type: 'steel' },
      { x: 2450, y: 390, w: 160, h: 24, type: 'steel' },
      { x: 3690, y: 370, w: 160, h: 24, type: 'steel' }
    ],
    pickups: [
      { x: 880, y: 325, type: 'launcher' },
      { x: 1390, y: 560, type: 'pulse' },
      { x: 2070, y: 380, type: 'pulse' },
      { x: 2520, y: 350, type: 'launcher' },
      { x: 3330, y: 370, type: 'pulse' },
      { x: 3760, y: 330, type: 'launcher' },
      { x: 4550, y: 550, type: 'pulse' }
    ]
  }
];

const PLAYER_STYLE = [
  { name: '珊瑚', color: '#ff6b63', accent: '#ffe0d8' },
  { name: '闪电', color: '#46d9e8', accent: '#d9fbff' },
  { name: '柠檬', color: '#f7c948', accent: '#fff3bd' },
  { name: '葡萄', color: '#ad7df0', accent: '#eadfff' }
];

function random(state) {
  state.rngState = (Math.imul(state.rngState, 1664525) + 1013904223) >>> 0;
  return state.rngState / 4294967296;
}

function createPlayers(scores = []) {
  return PLAYER_STYLE.map((style, id) => ({
    id,
    name: style.name,
    color: style.color,
    accent: style.accent,
    x: 100 + id * 62,
    y: 620,
    vx: 0,
    vy: 0,
    angle: 0,
    av: 0,
    facing: 1,
    grounded: true,
    chargeDir: 0,
    charge: 0,
    weapon: null,
    ammo: 0,
    stun: 0,
    score: scores[id] || 0,
    respawnX: 100 + id * 62,
    prevWeapon: false,
    ai: { cooldown: 0.25 + id * 0.17, releaseIn: 0, fireCooldown: 0 }
  }));
}

function resetRound(state, preserveScores = true) {
  const scores = preserveScores ? state.players.map(player => player.score) : [];
  state.players = createPlayers(scores);
  state.projectiles = [];
  state.pickups = MAPS[state.mapIndex].pickups.map((pickup, id) => ({ ...pickup, id, active: true, respawn: 0 }));
  state.phase = 'countdown';
  state.phaseTime = 3;
  state.roundWinner = -1;
  state.elapsed = 0;
}

export function createGame({ humanCount = 1, seed = Date.now() } = {}) {
  const state = {
    version: 1,
    humanCount,
    rngState: seed >>> 0,
    round: 1,
    mapIndex: 0,
    phase: 'countdown',
    phaseTime: 3,
    roundWinner: -1,
    elapsed: 0,
    players: [],
    projectiles: [],
    pickups: [],
    events: [],
    nextProjectileId: 1
  };
  resetRound(state, false);
  return state;
}

function fireWeapon(state, player) {
  if (!player.weapon || player.ammo <= 0 || player.stun > 0) return;
  const launcher = player.weapon === 'launcher';
  const type = player.weapon;
  const direction = player.facing || 1;
  state.projectiles.push({
    id: state.nextProjectileId++,
    owner: player.id,
    type,
    x: player.x + direction * 34,
    y: player.y - 48,
    vx: direction * (launcher ? 650 : 980) + player.vx * 0.2,
    vy: launcher ? -80 : 0,
    radius: launcher ? 13 : 7,
    life: launcher ? 2.4 : 1.35
  });
  player.ammo -= 1;
  if (player.ammo <= 0) player.weapon = null;
  state.events.push({ type: 'shot', player: player.id, weapon: type, x: player.x, y: player.y - 48 });
}

function jump(state, player) {
  if (!player.grounded || player.chargeDir === 0 || player.stun > 0) {
    player.chargeDir = 0;
    player.charge = 0;
    return;
  }
  const direction = player.chargeDir;
  const power = clamp(player.charge / 1.1, 0.08, 1);
  player.vx = direction * (250 + 430 * power);
  player.vy = -(570 + 320 * power);
  player.av = direction * (2.3 + 4 * power);
  player.grounded = false;
  player.y -= 2;
  player.chargeDir = 0;
  player.charge = 0;
  state.events.push({ type: 'jump', player: player.id, power, x: player.x, y: player.y });
}

function updateControls(player, input, dt) {
  player.prevWeapon = input.weapon;
  if (player.stun > 0) {
    player.chargeDir = 0;
    player.charge = 0;
    return;
  }
  if (!player.grounded) return;
  const left = Boolean(input.left);
  const right = Boolean(input.right);
  if (player.chargeDir === 0) {
    if (left !== right) {
      player.chargeDir = left ? -1 : 1;
      player.facing = player.chargeDir;
      player.charge = 0;
    }
    return;
  }
  const held = player.chargeDir < 0 ? left : right;
  if (held) {
    player.charge = Math.min(1.15, player.charge + dt);
    player.facing = player.chargeDir;
  }
}

function updateAI(state, player, dt) {
  const input = { left: false, right: false, weapon: false };
  const ai = player.ai;
  ai.fireCooldown = Math.max(0, ai.fireCooldown - dt);
  if (player.stun > 0) return input;
  if (player.weapon && ai.fireCooldown <= 0) {
    const target = state.players.find(other => other.id !== player.id && Math.sign(other.x - player.x) === player.facing && Math.abs(other.x - player.x) < 650 && Math.abs(other.y - player.y) < 150);
    if (target && random(state) < 0.09) {
      input.weapon = true;
      ai.fireCooldown = 1.1 + random(state) * 1.2;
    }
  }
  if (!player.grounded) return input;
  if (player.chargeDir !== 0) {
    ai.releaseIn -= dt;
    if (ai.releaseIn > 0) {
      input.left = player.chargeDir < 0;
      input.right = player.chargeDir > 0;
    }
    return input;
  }
  ai.cooldown -= dt;
  if (ai.cooldown <= 0) {
    const direction = player.x < 70 ? 1 : (random(state) < 0.035 ? -1 : 1);
    input.left = direction < 0;
    input.right = direction > 0;
    player.facing = direction;
    ai.releaseIn = 0.32 + random(state) * (player.id === 2 ? 0.58 : 0.82);
    ai.cooldown = 0.18 + random(state) * 0.36;
  }
  return input;
}

function landingPlatform(state, player, previousY) {
  if (player.vy < 0) return null;
  const platforms = MAPS[state.mapIndex].platforms;
  let landing = null;
  for (const platform of platforms) {
    const withinX = player.x >= platform.x - 10 && player.x <= platform.x + platform.w + 10;
    const crossed = previousY <= platform.y && player.y >= platform.y;
    if (withinX && crossed && (!landing || platform.y < landing.y)) landing = platform;
  }
  return landing;
}

function respawn(state, player) {
  const platforms = MAPS[state.mapIndex].platforms.filter(platform => platform.w >= 220 && platform.x + platform.w > 0 && platform.x < player.x + 100);
  const platform = platforms.sort((a, b) => Math.abs((a.x + a.w / 2) - (player.x - 220)) - Math.abs((b.x + b.w / 2) - (player.x - 220)))[0] || MAPS[state.mapIndex].platforms[0];
  player.x = clamp(player.x - 260, platform.x + 35, platform.x + platform.w - 35);
  player.y = platform.y;
  player.vx = 0;
  player.vy = 0;
  player.av = 0;
  player.angle = 0;
  player.grounded = true;
  player.chargeDir = 0;
  player.charge = 0;
  player.stun = 0.8;
  state.events.push({ type: 'respawn', player: player.id, x: player.x, y: player.y });
}

function updatePlayer(state, player, input, dt) {
  const wasGrounded = player.grounded;
  player.stun = Math.max(0, player.stun - dt);
  if (input.weapon && !player.prevWeapon) fireWeapon(state, player);
  updateControls(player, input, dt);
  if (player.grounded && player.chargeDir !== 0) {
    const held = player.chargeDir < 0 ? input.left : input.right;
    if (!held) jump(state, player);
  }
  if (player.grounded) {
    player.vx = approach(player.vx, 0, 700 * dt);
    player.x += player.vx * dt;
    player.vy = 0;
    const targetAngle = player.chargeDir === 0 ? 0 : player.chargeDir * (0.12 + player.charge * 0.72);
    player.angle = approach(player.angle, targetAngle, 4.5 * dt);
    player.av = 0;
  } else {
    const previousY = player.y;
    player.vy += GRAVITY * dt;
    player.x += player.vx * dt;
    player.y += player.vy * dt;
    player.angle += player.av * dt;
    player.av *= Math.pow(0.985, dt * 60);
    const landing = landingPlatform(state, player, previousY);
    if (landing) {
      player.y = landing.y;
      player.vy = 0;
      player.grounded = true;
      player.vx *= 0.48;
      player.angle = clamp(Math.atan2(Math.sin(player.angle), Math.cos(player.angle)), -1.1, 1.1);
      player.av = 0;
      if (wasGrounded === false) state.events.push({ type: 'land', player: player.id, x: player.x, y: player.y });
      if (landing.w >= 220 && player.x > player.respawnX + 250) player.respawnX = player.x;
    }
  }
  player.x = clamp(player.x, 20, MAPS[state.mapIndex].finish + 240);
  if (player.y > 850) respawn(state, player);
}

function updatePickups(state, dt) {
  for (const pickup of state.pickups) {
    if (!pickup.active) {
      pickup.respawn -= dt;
      if (pickup.respawn <= 0) pickup.active = true;
      continue;
    }
    for (const player of state.players) {
      if (Math.abs(player.x - pickup.x) < 38 && Math.abs((player.y - 45) - pickup.y) < 58) {
        player.weapon = pickup.type;
        player.ammo = pickup.type === 'launcher' ? 1 : 3;
        pickup.active = false;
        pickup.respawn = 12;
        state.events.push({ type: 'pickup', player: player.id, weapon: pickup.type, x: pickup.x, y: pickup.y });
        break;
      }
    }
  }
}

function updateProjectiles(state, dt) {
  const platforms = MAPS[state.mapIndex].platforms;
  for (let index = state.projectiles.length - 1; index >= 0; index -= 1) {
    const projectile = state.projectiles[index];
    projectile.life -= dt;
    projectile.x += projectile.vx * dt;
    projectile.y += projectile.vy * dt;
    if (projectile.type === 'launcher') projectile.vy += 260 * dt;
    let remove = projectile.life <= 0 || projectile.y > 800;
    for (const player of state.players) {
      if (remove || player.id === projectile.owner) continue;
      const distance = Math.hypot(player.x - projectile.x, (player.y - 42) - projectile.y);
      if (distance < projectile.radius + 29) {
        const direction = Math.sign(projectile.vx) || 1;
        const force = projectile.type === 'launcher' ? 930 : 590;
        player.vx = direction * force;
        player.vy = -force * 0.55;
        player.av = direction * 5;
        player.grounded = false;
        player.stun = projectile.type === 'launcher' ? 0.75 : 0.4;
        player.chargeDir = 0;
        player.charge = 0;
        state.events.push({ type: 'hit', player: player.id, x: projectile.x, y: projectile.y, weapon: projectile.type });
        remove = true;
      }
    }
    if (!remove) {
      remove = platforms.some(platform => projectile.x >= platform.x && projectile.x <= platform.x + platform.w && projectile.y >= platform.y && projectile.y <= platform.y + platform.h);
    }
    if (remove) state.projectiles.splice(index, 1);
  }
}

export function stepGame(state, inputs, dt = STEP) {
  state.events = [];
  if (state.phase === 'matchOver') return;
  if (state.phase === 'countdown') {
    state.phaseTime -= dt;
    if (state.phaseTime <= 0) {
      state.phase = 'racing';
      state.phaseTime = 0;
      state.events.push({ type: 'start' });
    }
    return;
  }
  if (state.phase === 'roundOver') {
    state.phaseTime -= dt;
    if (state.phaseTime <= 0) {
      if (state.players.some(player => player.score >= WIN_SCORE)) {
        state.phase = 'matchOver';
        state.events.push({ type: 'matchOver', player: state.players.find(player => player.score >= WIN_SCORE).id });
      } else {
        state.round += 1;
        state.mapIndex = (state.round - 1) % MAPS.length;
        resetRound(state);
      }
    }
    return;
  }
  state.elapsed += dt;
  for (const player of state.players) {
    const input = player.id < state.humanCount ? (inputs[player.id] || { left: false, right: false, weapon: false }) : updateAI(state, player, dt);
    updatePlayer(state, player, input, dt);
  }
  updatePickups(state, dt);
  updateProjectiles(state, dt);
  const finisher = state.players.find(player => player.x >= MAPS[state.mapIndex].finish);
  if (finisher) {
    finisher.score += 1;
    state.roundWinner = finisher.id;
    state.phase = 'roundOver';
    state.phaseTime = 3;
    state.events.push({ type: 'roundOver', player: finisher.id, x: finisher.x, y: finisher.y });
  }
}

export function makeSnapshot(state) {
  return {
    version: state.version,
    humanCount: state.humanCount,
    rngState: state.rngState,
    round: state.round,
    mapIndex: state.mapIndex,
    phase: state.phase,
    phaseTime: state.phaseTime,
    roundWinner: state.roundWinner,
    elapsed: state.elapsed,
    players: state.players.map(player => ({ ...player, ai: undefined })),
    projectiles: state.projectiles.map(projectile => ({ ...projectile })),
    pickups: state.pickups.map(pickup => ({ ...pickup })),
    events: [],
    nextProjectileId: state.nextProjectileId
  };
}

export function interpolateSnapshots(before, after, amount) {
  const t = clamp(amount, 0, 1);
  const mix = (a, b) => a + (b - a) * t;
  return {
    ...after,
    players: after.players.map((player, id) => {
      const previous = before.players[id] || player;
      return { ...player, x: mix(previous.x, player.x), y: mix(previous.y, player.y), angle: mix(previous.angle, player.angle) };
    }),
    projectiles: after.projectiles.map(projectile => {
      const previous = before.projectiles.find(item => item.id === projectile.id);
      return previous ? { ...projectile, x: mix(previous.x, projectile.x), y: mix(previous.y, projectile.y) } : projectile;
    })
  };
}
