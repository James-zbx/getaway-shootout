export const STEP = 1 / 60;
export const WIN_SCORE = 5;
export const GRAVITY = 1850;
export const PERSON_HEIGHT = 100;
export const YARD = 52;
export const MAX_HP = 100;
export const PLAYER_WIDTH = 36;
export const VEHICLE_SIZE = { width: 110, height: 42, topOffset: -26, bottomOffset: 16 };
export const CRATE_SIZE = { width: 44, height: 30, topOffset: -15, bottomOffset: 15 };

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const approach = (value, target, amount) => value < target ? Math.min(value + amount, target) : Math.max(value - amount, target);

export const WEAPONS = {
  knife: { ammo: 2, speed: 1350, vertical: 180, gravity: 220, range: 10 * YARD, radius: 6, damage: 60, knockback: 20, cooldown: 0.4, fullFalloff: YARD, zeroFalloff: 10 * YARD },
  pistol: { ammo: 4, speed: 2600, range: 20 * YARD, radius: 5, damage: 40, knockback: 40, cooldown: 0.18, fullFalloff: YARD, zeroFalloff: 20 * YARD },
  smg: { ammo: 12, magazines: 4, roundsPerMagazine: 3, speed: 2800, range: 18 * YARD, radius: 4, damage: 15, knockback: 10, cooldown: 0.075, auto: true, fullFalloff: YARD, zeroFalloff: 18 * YARD },
  shotgun: { ammo: 3, speed: 2250, range: 10 * YARD, radius: 8, damage: 14, headDamage: 20, fullFalloff: YARD, zeroFalloff: 11 * YARD, knockback: 24, pellets: 5, spread: 0.075, cooldown: 0.7 },
  bomb: { ammo: 1, speed: 900, gravity: 1600, range: 12 * YARD, radius: 7 * YARD, center: 150, fullFalloff: YARD, zeroFalloff: 7 * YARD, knockback: 300, fuse: 2.5, cooldown: 0.8 },
  rocket: { ammo: 1, speed: 1200, gravity: 150, range: 25 * YARD, radius: 6 * YARD, center: 110, fullFalloff: YARD, zeroFalloff: 6 * YARD, knockback: 500, cooldown: 0.9 },
  akm: { ammo: 1, speed: 2900, range: 25 * YARD, radius: 6, damage: 500, knockback: 700, cooldown: 0.18, fullFalloff: YARD, zeroFalloff: 25 * YARD },
  swap: { ammo: 1, speed: 2200, range: 35 * YARD, radius: 7, knockback: 0, cooldown: 0.5 },
  shield: { ammo: 1, cooldown: 0.5 }
};

const CRATE_EXPLOSION = { center: 140, radius: 8.5 * YARD, fullFalloff: YARD, zeroFalloff: 8.5 * YARD, knockback: 500 };
const VEHICLE_EXPLOSION = { center: 200, radius: 16 * YARD, fullFalloff: 4 * YARD, zeroFalloff: 16 * YARD, knockback: 1100 };

const PICKUP_POOL = [
  ['knife', 8], ['pistol', 13], ['smg', 13], ['shotgun', 12], ['bomb', 10],
  ['rocket', 9], ['akm', 8], ['swap', 7], ['shield', 11], ['medkit', 9]
];

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
    pickupSpots: [
      { x: 930, y: 365 }, { x: 1760, y: 560 }, { x: 2740, y: 420 },
      { x: 3310, y: 350 }, { x: 4200, y: 550 }
    ],
    crates: [
      { x: 1300, y: 505 }, { x: 2900, y: 575 }, { x: 3800, y: 515 }
    ],
    vehicles: [
      { x: 2100, y: 594 }, { x: 3500, y: 574 }
    ],
    checkpoints: [100, 850, 1350, 1800, 2400, 2750, 3200, 3800, 4300]
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
    pickupSpots: [
      { x: 740, y: 380 }, { x: 1450, y: 400 }, { x: 1950, y: 350 },
      { x: 2800, y: 365 }, { x: 3520, y: 390 }, { x: 4380, y: 550 }
    ],
    crates: [
      { x: 1100, y: 525 }, { x: 2400, y: 485 }, { x: 3200, y: 505 }
    ],
    vehicles: [
      { x: 1800, y: 564 }, { x: 4000, y: 584 }
    ],
    checkpoints: [100, 750, 1100, 1450, 1800, 2400, 2800, 3200, 3550, 3950, 4400]
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
    pickupSpots: [
      { x: 880, y: 325 }, { x: 1390, y: 560 }, { x: 2070, y: 380 },
      { x: 2520, y: 350 }, { x: 3330, y: 370 }, { x: 3760, y: 330 },
      { x: 4550, y: 550 }
    ],
    crates: [
      { x: 1700, y: 495 }, { x: 2600, y: 565 }, { x: 3700, y: 545 }
    ],
    vehicles: [
      { x: 2200, y: 564 }, { x: 3900, y: 544 }
    ],
    checkpoints: [100, 800, 1300, 1700, 2100, 2500, 3000, 3350, 3750, 4150, 4600]
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

function randomPickupType(state) {
  const total = PICKUP_POOL.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = random(state) * total;
  for (const [type, weight] of PICKUP_POOL) {
    roll -= weight;
    if (roll <= 0) return type;
  }
  return 'pistol';
}

function createPlayers(scores = [], spawnOrder = [0, 1, 2, 3]) {
  const validOrder = spawnOrder.length === 4 && spawnOrder.every((id, index) => id >= 0 && id < 4 && spawnOrder.indexOf(id) === index)
    ? spawnOrder
    : [0, 1, 2, 3];
  return PLAYER_STYLE.map((style, id) => {
    const slot = validOrder.indexOf(id);
    const startX = 100 + slot * 62;
    return {
    id,
    name: style.name,
    color: style.color,
    accent: style.accent,
    x: startX,
    y: 620,
    vx: 0,
    vy: 0,
    angle: 0,
    av: 0,
    facing: 1,
    aimAngle: 0,
    targetId: -1,
    grounded: true,
    chargeDir: 0,
    charge: 0,
    weapon: null,
    ammo: 0,
    hp: MAX_HP,
    shield: 0,
    dead: false,
    respawnTimer: 0,
    stun: 0,
    blockTimer: 0,
    lastBlockCheckX: startX,
    lastBlockCheckTime: 0,
    score: scores[id] || 0,
    checkpointX: startX,
    fireCooldown: 0,
    prevWeapon: false,
    ai: { cooldown: 0.25 + id * 0.17, releaseIn: 0, fireCooldown: 0 }
    };
  });
}

function resetRound(state, preserveScores = true) {
  const scores = preserveScores ? state.players.map(player => player.score) : [];
  const map = MAPS[state.mapIndex];
  state.players = createPlayers(scores, state.spawnOrder);
  for (const player of state.players) player.checkpointX = map.checkpoints[0];
  state.projectiles = [];
  state.pickups = map.pickupSpots.map((spot, id) => ({ ...spot, id, type: randomPickupType(state), active: true, respawn: 0 }));
  state.crates = map.crates.map((crate, id) => ({ ...crate, id, hp: 100, dead: false }));
  state.vehicles = map.vehicles.map((vehicle, id) => ({ ...vehicle, id, hp: 140, dead: false }));
  state.pendingExplosions = [];
  state.phase = 'countdown';
  state.phaseTime = 3;
  state.roundWinner = -1;
  state.elapsed = 0;
}

export function createGame({ humanCount = 1, seed = Date.now() } = {}) {
  const state = {
    version: 2,
    humanCount,
    rngState: seed >>> 0,
    round: 1,
    mapIndex: 0,
    phase: 'countdown',
    phaseTime: 3,
    roundWinner: -1,
    spawnOrder: [0, 1, 2, 3],
    elapsed: 0,
    players: [],
    projectiles: [],
    pickups: [],
    crates: [],
    vehicles: [],
    pendingExplosions: [],
    events: [],
    nextProjectileId: 1
  };
  resetRound(state, false);
  return state;
}

function knockbackPlayer(player, direction, force) {
  player.vx = direction * force;
  player.vy = Math.min(player.vy, -force * 0.42);
  player.av = direction * clamp(force / 120, 2, 6);
  player.grounded = false;
  player.stun = Math.max(player.stun, clamp(force / 900, 0.25, 0.75));
  player.chargeDir = 0;
  player.charge = 0;
}

function killPlayer(state, player, reason) {
  if (player.dead) return;
  player.hp = 0;
  player.dead = true;
  player.respawnTimer = 1.5;
  player.weapon = null;
  player.ammo = 0;
  player.shield = 0;
  player.chargeDir = 0;
  player.charge = 0;
  player.stun = 0;
  player.blockTimer = 0;
  player.vy = -220;
  player.grounded = false;
  state.events.push({ type: 'death', player: player.id, reason, x: player.x, y: player.y - 50 });
}

function damagePlayer(state, player, amount, direction, force, weapon) {
  if (player.dead || player.shield > 0 || amount <= 0) return;
  player.hp = Math.max(0, player.hp - amount);
  knockbackPlayer(player, direction, force);
  state.events.push({ type: 'hit', player: player.id, amount: Math.round(amount), weapon, x: player.x, y: player.y - 50 });
  if (player.hp <= 0) killPlayer(state, player, weapon);
}

function linearFalloff(base, distance, fullDistance, zeroDistance) {
  if (!(distance > 0) || distance <= fullDistance) return Math.max(0, base);
  if (distance >= zeroDistance) return 0;
  return Math.max(0, base * (zeroDistance - distance) / (zeroDistance - fullDistance));
}

function shotgunDamage(distance, head) {
  const weapon = WEAPONS.shotgun;
  return linearFalloff(head ? weapon.headDamage : weapon.damage, distance, weapon.fullFalloff, weapon.zeroFalloff);
}

function explosionDamage(center, distance, fullDistance, zeroDistance) {
  return linearFalloff(center, distance, fullDistance, zeroDistance);
}

function explode(state, x, y, radius, center, fullDistance, zeroDistance, force, weapon, owner = -1) {
  state.events.push({ type: 'explosion', x, y, radius, weapon });
  for (const player of state.players) {
    if (player.id === owner) continue;
    const distance = Math.hypot(player.x - x, (player.y - 50) - y);
    const amount = explosionDamage(center, distance, fullDistance, zeroDistance);
    if (amount > 0) {
      const direction = Math.sign(player.x - x) || 1;
      damagePlayer(state, player, amount, direction, force * (zeroDistance - distance) / zeroDistance, weapon);
    }
  }
  for (const crate of state.crates) {
    if (crate.dead) continue;
    const distance = Math.hypot(crate.x - x, crate.y - y);
    crate.hp -= explosionDamage(center, distance, fullDistance, zeroDistance);
    if (crate.hp <= 0) {
      crate.dead = true;
      state.pendingExplosions.push({ x: crate.x, y: crate.y, type: 'crate', delay: 0.18 });
    }
  }
  for (const vehicle of state.vehicles) {
    if (vehicle.dead) continue;
    const distance = Math.hypot(vehicle.x - x, vehicle.y - y);
    vehicle.hp -= explosionDamage(center, distance, fullDistance, zeroDistance);
    if (vehicle.hp <= 0) {
      vehicle.dead = true;
      state.pendingExplosions.push({ x: vehicle.x, y: vehicle.y, type: 'vehicle', delay: 0.25 });
    }
  }
}

function addProjectile(state, player, weapon, angle, damageOverride) {
  const definition = WEAPONS[weapon];
  const speed = definition.speed;
  const velocityBonus = weapon === 'knife' ? clamp(Math.hypot(player.vx, player.vy) * 0.08, 0, 35) : 0;
  const projectile = {
    id: state.nextProjectileId++,
    owner: player.id,
    weapon,
    x: player.x + Math.cos(angle) * 38,
    y: player.y - 60 + Math.sin(angle) * 20,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    gravity: definition.gravity || 0,
    distance: 0,
    range: definition.range || 12 * YARD,
    radius: definition.radius || 6,
    damage: damageOverride ?? (definition.damage || 0) + velocityBonus,
    fullFalloff: definition.fullFalloff || 0,
    zeroFalloff: definition.zeroFalloff || definition.range || 12 * YARD,
    headDamage: definition.headDamage,
    knockback: definition.knockback || 0,
    fuse: definition.fuse || null,
    explosive: Boolean(definition.center),
    life: definition.fuse || (definition.range || 12 * YARD) / speed
  };
  state.projectiles.push(projectile);
  state.events.push({ type: 'shot', player: player.id, weapon, x: projectile.x, y: projectile.y });
}

function nearestTarget(state, player) {
  let target = null;
  let bestDistance = Infinity;
  for (const other of state.players) {
    if (other.id === player.id || other.dead) continue;
    const distance = Math.hypot(other.x - player.x, (other.y - 50) - (player.y - 50));
    if (distance < bestDistance) {
      bestDistance = distance;
      target = other;
    }
  }
  return target;
}

function updateAim(state, player) {
  const target = nearestTarget(state, player);
  player.targetId = target?.id ?? -1;
  if (!target) {
    player.aimAngle = player.facing > 0 ? 0 : Math.PI;
    return;
  }
  const muzzleX = player.x;
  const muzzleY = player.y - 60;
  const dx = target.x - muzzleX;
  const dy = (target.y - 50) - muzzleY;
  player.facing = Math.sign(dx) || player.facing;
  const definition = player.weapon ? WEAPONS[player.weapon] : null;
  const baseAngle = Math.atan2(dy, dx);
  if (!definition?.gravity) {
    player.aimAngle = baseAngle;
    return;
  }
  const flightTime = Math.max(0.08, Math.hypot(dx, dy) / definition.speed);
  const upwardCorrection = 0.5 * definition.gravity * flightTime * flightTime;
  player.aimAngle = Math.atan2(dy - upwardCorrection, dx);
}

function fireWeapon(state, player) {
  if (player.dead || !player.weapon || player.ammo <= 0 || player.stun > 0 || player.fireCooldown > 0) return;
  const definition = WEAPONS[player.weapon];
  if (player.weapon === 'shield') {
    player.shield = 5;
    player.ammo = 0;
    player.weapon = null;
    player.fireCooldown = definition.cooldown;
    state.events.push({ type: 'shield', player: player.id, x: player.x, y: player.y - 50 });
    return;
  }
  const aim = player.aimAngle ?? (player.facing > 0 ? 0 : Math.PI);
  if (player.weapon === 'shotgun') {
    for (let index = 0; index < definition.pellets; index += 1) {
      addProjectile(state, player, 'shotgun', aim + (index - (definition.pellets - 1) / 2) * definition.spread);
    }
  } else {
    addProjectile(state, player, player.weapon, aim);
  }
  player.ammo -= 1;
  if (player.ammo <= 0) player.weapon = null;
  player.fireCooldown = definition.cooldown;
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
  player.blockTimer = 0;
  state.events.push({ type: 'jump', player: player.id, power, x: player.x, y: player.y });
}

function updateControls(player, input, dt) {
  player.prevWeapon = input.weapon;
  if (player.dead || player.stun > 0) {
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
  if (player.dead || player.stun > 0) return input;
  if (player.weapon === 'shield') {
    if (player.hp < 55 && ai.fireCooldown <= 0) {
      input.weapon = true;
      ai.fireCooldown = 1;
    }
  } else if (player.weapon && ai.fireCooldown <= 0) {
    const definition = WEAPONS[player.weapon];
    const target = nearestTarget(state, player);
    const distance = target ? Math.hypot(target.x - player.x, (target.y - 50) - (player.y - 50)) : Infinity;
    if (target && distance < definition.range * 0.8 && random(state) < (definition.auto ? 0.55 : 0.12)) {
      input.weapon = true;
      ai.fireCooldown = definition.auto ? 0.05 : 1.1 + random(state) * 1.2;
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

function solidSurfaces(state) {
  const surfaces = MAPS[state.mapIndex].platforms.map(platform => ({
    x: platform.x,
    w: platform.w,
    top: platform.y,
    bottom: platform.y + platform.h
  }));
  for (const crate of state.crates) {
    if (crate.dead) continue;
    surfaces.push({
      x: crate.x - CRATE_SIZE.width / 2,
      w: CRATE_SIZE.width,
      top: crate.y + CRATE_SIZE.topOffset,
      bottom: crate.y + CRATE_SIZE.bottomOffset
    });
  }
  for (const vehicle of state.vehicles) {
    if (vehicle.dead) continue;
    surfaces.push({
      x: vehicle.x - VEHICLE_SIZE.width / 2,
      w: VEHICLE_SIZE.width,
      top: vehicle.y + VEHICLE_SIZE.topOffset,
      bottom: vehicle.y + VEHICLE_SIZE.bottomOffset
    });
  }
  return surfaces;
}

function playerBox(player) {
  const halfWidth = PLAYER_WIDTH / 2;
  return {
    left: player.x - halfWidth,
    right: player.x + halfWidth,
    top: player.y - PERSON_HEIGHT,
    bottom: player.y
  };
}

function boxOverlaps(box, surface) {
  return box.left < surface.x + surface.w && box.right > surface.x && box.top < surface.bottom && box.bottom > surface.top;
}

function movePlayerX(state, player, dx) {
  if (dx === 0) return;
  player.x += dx;
  const halfWidth = PLAYER_WIDTH / 2;
  for (const surface of solidSurfaces(state)) {
    if (!boxOverlaps(playerBox(player), surface)) continue;
    if (dx > 0) {
      player.x = surface.x - halfWidth;
      player.vx = Math.min(0, player.vx);
    } else {
      player.x = surface.x + surface.w + halfWidth;
      player.vx = Math.max(0, player.vx);
    }
  }
}

function movePlayerY(state, player, dy, previousY) {
  if (dy === 0) return null;
  player.y += dy;
  let landed = null;
  for (const surface of solidSurfaces(state)) {
    if (!boxOverlaps(playerBox(player), surface)) continue;
    if (dy > 0 && previousY <= surface.top + 4) {
      player.y = surface.top;
      player.vy = 0;
      if (!landed || surface.top < landed.top) landed = surface;
    } else if (dy < 0 && previousY - PERSON_HEIGHT >= surface.bottom - 4) {
      player.y = surface.bottom + PERSON_HEIGHT;
      player.vy = 0;
    } else {
      const upwardPenetration = player.y - surface.top;
      const downwardPenetration = surface.bottom - (player.y - PERSON_HEIGHT);
      if (upwardPenetration < downwardPenetration) {
        player.y = surface.top;
        player.vy = 0;
        if (!landed || surface.top < landed.top) landed = surface;
      } else {
        player.y = surface.bottom + PERSON_HEIGHT;
        player.vy = 0;
      }
    }
  }
  return landed;
}

function supportSurface(state, player) {
  const box = playerBox(player);
  return solidSurfaces(state).find(surface => Math.abs(box.bottom - surface.top) < 2 && box.right > surface.x && box.left < surface.x + surface.w);
}

function platformAt(state, x) {
  return MAPS[state.mapIndex].platforms.find(platform => x >= platform.x + 35 && x <= platform.x + platform.w - 35) || MAPS[state.mapIndex].platforms[0];
}

function respawnAtCheckpoint(state, player) {
  const platform = platformAt(state, player.checkpointX);
  player.x = clamp(player.checkpointX, platform.x + 35, platform.x + platform.w - 35);
  player.y = platform.y;
  player.vx = 0;
  player.vy = 0;
  player.av = 0;
  player.angle = 0;
  player.grounded = true;
  player.dead = false;
  player.respawnTimer = 0;
  player.hp = MAX_HP;
  player.shield = 0;
  player.chargeDir = 0;
  player.charge = 0;
  player.stun = 0.5;
  player.blockTimer = 0;
  state.events.push({ type: 'respawn', player: player.id, x: player.x, y: player.y });
}

function fallRespawn(state, player) {
  const platform = platformAt(state, player.checkpointX);
  player.x = clamp(player.checkpointX, platform.x + 35, platform.x + platform.w - 35);
  player.y = platform.y;
  player.vx = 0;
  player.vy = 0;
  player.av = 0;
  player.angle = 0;
  player.grounded = true;
  player.chargeDir = 0;
  player.charge = 0;
  player.stun = 0.8;
  player.blockTimer = 0;
  state.events.push({ type: 'respawn', player: player.id, x: player.x, y: player.y });
}

function advanceCheckpoint(state, player) {
  let latest = MAPS[state.mapIndex].checkpoints[0];
  for (const checkpoint of MAPS[state.mapIndex].checkpoints) {
    if (player.x < checkpoint) break;
    latest = checkpoint;
  }
  player.checkpointX = Math.max(player.checkpointX, latest);
}

function applyLeanSlide(state, player, dt) {
  const lean = Math.sign(player.angle) || player.chargeDir;
  if (!lean) return;
  const bodyEdge = player.x + lean * (PLAYER_WIDTH / 2 + Math.abs(player.angle) * PERSON_HEIGHT * 0.55);
  const playerTop = player.y - PERSON_HEIGHT;
  for (const surface of solidSurfaces(state)) {
    if (playerTop >= surface.bottom - 10 || player.y <= surface.top + 10) continue;
    const gap = lean > 0 ? surface.x - bodyEdge : bodyEdge - (surface.x + surface.w);
    if (gap < 28 && gap > -PLAYER_WIDTH) {
      const slideSpeed = Math.min(160, Math.max(0, (28 - gap) * 5));
      player.x -= lean * slideSpeed * dt;
    }
  }
}

function nearestBlockingSurface(state, player) {
  const halfWidth = PLAYER_WIDTH / 2;
  const box = playerBox(player);
  let nearest = null;
  let bestDistance = Infinity;
  for (const surface of solidSurfaces(state)) {
    if (box.top >= surface.bottom - 6 || box.bottom <= surface.top + 6) continue;
    const rightGap = surface.x - (player.x + halfWidth);
    const leftGap = (player.x - halfWidth) - (surface.x + surface.w);
    let distance;
    let direction;
    if (rightGap >= 0 && rightGap < 45) {
      distance = rightGap;
      direction = -1;
    } else if (leftGap >= 0 && leftGap < 45) {
      distance = leftGap;
      direction = 1;
    } else {
      continue;
    }
    if (distance < bestDistance) {
      bestDistance = distance;
      nearest = { direction, distance };
    }
  }
  return nearest;
}

function updateStuckDetection(state, player, input, dt) {
  const tryingToMove = Boolean(input.left || input.right) || Math.abs(player.vx) > 20;
  if (!player.grounded || !tryingToMove) {
    player.blockTimer = 0;
    player.lastBlockCheckX = player.x;
    return;
  }
  player.blockTimer += dt;
  if (player.blockTimer < 2) return;
  const escape = nearestBlockingSurface(state, player);
  if (escape) {
    player.x += escape.direction * Math.max(28, 45 - escape.distance);
    player.x = clamp(player.x, 20, MAPS[state.mapIndex].finish + 240);
    player.vx = 0;
    player.blockTimer = 0;
    state.events.push({ type: 'unstuck', player: player.id, x: player.x, y: player.y });
  }
  if (player.blockTimer > 0 && !escape && player.blockTimer > 4) {
    respawnAtCheckpoint(state, player);
    player.blockTimer = 0;
  }
}

function updatePlayer(state, player, input, dt) {
  player.fireCooldown = Math.max(0, player.fireCooldown - dt);
  player.shield = Math.max(0, player.shield - dt);
  if (player.dead) {
    player.respawnTimer -= dt;
    if (player.respawnTimer <= 0) respawnAtCheckpoint(state, player);
    return;
  }
  const wasGrounded = player.grounded;
  const previousY = player.y;
  player.stun = Math.max(0, player.stun - dt);
  updateAim(state, player);
  const definition = player.weapon ? WEAPONS[player.weapon] : null;
  const wantsFire = definition?.auto ? input.weapon : (input.weapon && !player.prevWeapon);
  if (wantsFire) fireWeapon(state, player);
  updateControls(player, input, dt);
  if (player.grounded && player.chargeDir !== 0) {
    const held = player.chargeDir < 0 ? input.left : input.right;
    if (!held) jump(state, player);
  }
  if (player.grounded) {
    applyLeanSlide(state, player, dt);
    player.vx = approach(player.vx, 0, 700 * dt);
    movePlayerX(state, player, player.vx * dt);
    player.vy = 0;
    const targetAngle = player.chargeDir === 0 ? 0 : player.chargeDir * (0.12 + player.charge * 0.72);
    const stiffness = player.chargeDir === 0 ? 22 : 45;
    const damping = player.chargeDir === 0 ? 5.5 : 9;
    player.av += ((targetAngle - player.angle) * stiffness - player.av * damping) * dt;
    player.angle = clamp(player.angle + player.av * dt, -1.2, 1.2);
    const support = supportSurface(state, player);
    if (!support) {
      player.grounded = false;
      player.vy = 1;
    } else {
      advanceCheckpoint(state, player);
    }
  } else {
    player.vy += GRAVITY * dt;
    movePlayerX(state, player, player.vx * dt);
    player.angle += player.av * dt;
    player.av *= Math.pow(0.985, dt * 60);
    const landing = movePlayerY(state, player, player.vy * dt, previousY);
    if (landing) {
      player.grounded = true;
      player.vx *= 0.48;
      player.angle = clamp(player.angle, -1.2, 1.2);
      player.av *= 0.45;
      if (Math.abs(player.angle) > 1) player.stun = Math.max(player.stun, 0.3);
      if (wasGrounded === false) state.events.push({ type: 'land', player: player.id, x: player.x, y: player.y });
      advanceCheckpoint(state, player);
    }
  }
  updateStuckDetection(state, player, input, dt);
  player.x = clamp(player.x, 20, MAPS[state.mapIndex].finish + 240);
  if (player.y > 850) fallRespawn(state, player);
}

function updatePickups(state, dt) {
  for (const pickup of state.pickups) {
    if (!pickup.active) {
      pickup.respawn -= dt;
      if (pickup.respawn <= 0) {
        pickup.active = true;
        pickup.type = randomPickupType(state);
      }
      continue;
    }
    for (const player of state.players) {
      if (player.dead || (pickup.type !== 'medkit' && (player.shield > 0 || player.weapon))) continue;
      if (Math.abs(player.x - pickup.x) < 38 && Math.abs((player.y - 50) - pickup.y) < 62) {
        if (pickup.type === 'medkit') {
          const before = player.hp;
          player.hp = Math.min(MAX_HP, player.hp * 2 + 90);
          state.events.push({ type: 'heal', player: player.id, amount: Math.round(player.hp - before), x: pickup.x, y: pickup.y });
        } else {
          player.weapon = pickup.type;
          player.ammo = WEAPONS[pickup.type].ammo;
          state.events.push({ type: 'pickup', player: player.id, weapon: pickup.type, x: pickup.x, y: pickup.y });
        }
        pickup.active = false;
        pickup.respawn = 12;
        break;
      }
    }
  }
}

function swapWeapons(state, shooter, target) {
  const shooterWeapon = shooter.weapon;
  const shooterAmmo = shooter.ammo;
  shooter.weapon = target.weapon;
  shooter.ammo = target.ammo;
  target.weapon = shooterWeapon;
  target.ammo = shooterAmmo;
  state.events.push({ type: 'swap', player: target.id, x: target.x, y: target.y - 50 });
}

function updateProjectiles(state, dt) {
  const platforms = MAPS[state.mapIndex].platforms;
  for (let index = state.projectiles.length - 1; index >= 0; index -= 1) {
    const projectile = state.projectiles[index];
    projectile.life -= dt;
    const stepX = projectile.vx * dt;
    const stepY = projectile.vy * dt;
    projectile.distance += Math.hypot(stepX, stepY);
    projectile.x += stepX;
    projectile.y += stepY;
    projectile.vy += projectile.gravity * dt;
    let remove = projectile.life <= 0 || projectile.distance > projectile.range || projectile.y > 800;
    if (!remove && projectile.explosive && projectile.fuse !== null) {
      projectile.fuse -= dt;
      if (projectile.fuse <= 0) {
        const definition = WEAPONS[projectile.weapon];
        explode(state, projectile.x, projectile.y, definition.radius, definition.center, definition.fullFalloff, definition.zeroFalloff, definition.knockback, projectile.weapon, projectile.owner);
        remove = true;
      }
    }
    if (!remove) {
      for (const player of state.players) {
        if (remove || player.id === projectile.owner || player.dead) continue;
        const headY = player.y - 88;
        const torsoY = player.y - 48;
        const headHit = Math.hypot(player.x - projectile.x, headY - projectile.y) < projectile.radius + 18;
        const torsoHit = Math.hypot(player.x - projectile.x, torsoY - projectile.y) < projectile.radius + 30;
        if (!headHit && !torsoHit) continue;
        if (projectile.weapon === 'swap') {
          swapWeapons(state, state.players[projectile.owner], player);
        } else if (projectile.explosive) {
          const definition = WEAPONS[projectile.weapon];
          explode(state, projectile.x, projectile.y, definition.radius, definition.center, definition.fullFalloff, definition.zeroFalloff, definition.knockback, projectile.weapon, projectile.owner);
        } else {
          const direction = Math.sign(projectile.vx) || 1;
          const amount = projectile.weapon === 'shotgun'
            ? shotgunDamage(projectile.distance, headHit)
            : linearFalloff(projectile.damage, projectile.distance, projectile.fullFalloff, projectile.zeroFalloff);
          damagePlayer(state, player, amount, direction, projectile.knockback, projectile.weapon);
        }
        remove = true;
      }
    }
    if (!remove) {
      for (const crate of state.crates) {
        if (crate.dead || Math.hypot(crate.x - projectile.x, crate.y - projectile.y) > 34) continue;
        crate.hp -= projectile.damage || 40;
        if (crate.hp <= 0) {
          crate.dead = true;
          state.pendingExplosions.push({ x: crate.x, y: crate.y, type: 'crate', delay: 0.12 });
        }
        remove = true;
      }
    }
    if (!remove) {
      for (const vehicle of state.vehicles) {
        if (vehicle.dead || Math.hypot(vehicle.x - projectile.x, vehicle.y - projectile.y) > 55) continue;
        vehicle.hp -= projectile.damage || 40;
        if (vehicle.hp <= 0) {
          vehicle.dead = true;
          state.pendingExplosions.push({ x: vehicle.x, y: vehicle.y, type: 'vehicle', delay: 0.12 });
        }
        remove = true;
      }
    }
    if (!remove) {
      remove = platforms.some(platform => projectile.x >= platform.x && projectile.x <= platform.x + platform.w && projectile.y >= platform.y && projectile.y <= platform.y + platform.h);
      if (remove && projectile.explosive) {
        const definition = WEAPONS[projectile.weapon];
        explode(state, projectile.x, projectile.y, definition.radius, definition.center, definition.fullFalloff, definition.zeroFalloff, definition.knockback, projectile.weapon, projectile.owner);
      }
    }
    if (remove) state.projectiles.splice(index, 1);
  }
}

function updatePendingExplosions(state, dt) {
  for (let index = state.pendingExplosions.length - 1; index >= 0; index -= 1) {
    const pending = state.pendingExplosions[index];
    pending.delay -= dt;
    if (pending.delay > 0) continue;
    state.pendingExplosions.splice(index, 1);
    if (pending.type === 'crate') explode(state, pending.x, pending.y, CRATE_EXPLOSION.radius, CRATE_EXPLOSION.center, CRATE_EXPLOSION.fullFalloff, CRATE_EXPLOSION.zeroFalloff, CRATE_EXPLOSION.knockback, 'crate');
    if (pending.type === 'vehicle') explode(state, pending.x, pending.y, VEHICLE_EXPLOSION.radius, VEHICLE_EXPLOSION.center, VEHICLE_EXPLOSION.fullFalloff, VEHICLE_EXPLOSION.zeroFalloff, VEHICLE_EXPLOSION.knockback, 'vehicle');
  }
}

function resolvePlayerCollisions(state) {
  const halfWidth = PLAYER_WIDTH / 2;
  for (let leftIndex = 0; leftIndex < state.players.length; leftIndex += 1) {
    const a = state.players[leftIndex];
    if (a.dead) continue;
    for (let rightIndex = leftIndex + 1; rightIndex < state.players.length; rightIndex += 1) {
      const b = state.players[rightIndex];
      if (b.dead) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      if (Math.abs(dx) >= PLAYER_WIDTH || Math.abs(dy) >= PERSON_HEIGHT * 0.72) continue;
      const direction = dx > 0 ? 1 : (dx < 0 ? -1 : (a.id < b.id ? -1 : 1));
      const overlap = PLAYER_WIDTH - Math.abs(dx);
      a.x -= direction * overlap / 2;
      b.x += direction * overlap / 2;
      const closingSpeed = (a.vx - b.vx) * direction;
      if (closingSpeed > 0) {
        const impulse = closingSpeed * 0.32;
        a.vx -= impulse * direction;
        b.vx += impulse * direction;
      }
      a.x = clamp(a.x, 20, MAPS[state.mapIndex].finish + 240);
      b.x = clamp(b.x, 20, MAPS[state.mapIndex].finish + 240);
    }
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
  resolvePlayerCollisions(state);
  updatePickups(state, dt);
  updateProjectiles(state, dt);
  updatePendingExplosions(state, dt);
  const finisher = state.players.find(player => !player.dead && player.x >= MAPS[state.mapIndex].finish);
  if (finisher) {
    finisher.score += 1;
    state.roundWinner = finisher.id;
    state.spawnOrder = state.players
      .map(player => player.id)
      .sort((a, b) => state.players[b].x - state.players[a].x)
      .reverse();
    state.phase = 'roundOver';
    state.phaseTime = 3;
    state.events.push({ type: 'roundOver', player: finisher.id, x: finisher.x, y: finisher.y });
  }
}

export { linearFalloff, shotgunDamage, explosionDamage };

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
    spawnOrder: [...state.spawnOrder],
    elapsed: state.elapsed,
    players: state.players.map(player => ({ ...player, ai: undefined })),
    projectiles: state.projectiles.map(projectile => ({ ...projectile })),
    pickups: state.pickups.map(pickup => ({ ...pickup })),
    crates: state.crates.map(crate => ({ ...crate })),
    vehicles: state.vehicles.map(vehicle => ({ ...vehicle })),
    pendingExplosions: state.pendingExplosions.map(pending => ({ ...pending })),
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
