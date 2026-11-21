import { MAPS, WIN_SCORE, WEAPONS, YARD, MAX_HP } from './engine.js';

const WIDTH = 1280;
const HEIGHT = 720;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const WEAPON_LABELS = {
  knife: '飞刀', pistol: '手枪', smg: '冲锋枪', shotgun: '霰弹枪', bomb: '定时炸弹',
  rocket: '火箭筒', akm: 'AKM', swap: '交换枪', shield: '无敌盾', medkit: '医疗包',
  crate: '炸药箱', vehicle: '车辆'
};

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, r);
}

function text(ctx, value, x, y, size = 20, color = '#fff', align = 'left', weight = 700) {
  ctx.font = `${weight} ${size}px "Microsoft YaHei", Arial, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(value, x, y);
}

function drawWeaponIcon(ctx, type, x, y, size, color = '#f4f8fb') {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 32, size / 32);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (type === 'knife') {
    ctx.beginPath();
    ctx.moveTo(-12, 10);
    ctx.lineTo(10, -10);
    ctx.lineTo(13, -13);
    ctx.lineTo(11, -7);
    ctx.lineTo(-7, 12);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-13, 13);
    ctx.lineTo(-7, 7);
    ctx.stroke();
  } else if (type === 'pistol') {
    ctx.beginPath();
    ctx.moveTo(-13, -7);
    ctx.lineTo(10, -7);
    ctx.lineTo(10, -1);
    ctx.lineTo(-1, -1);
    ctx.lineTo(-4, 11);
    ctx.lineTo(-11, 11);
    ctx.lineTo(-8, -1);
    ctx.lineTo(-13, -1);
    ctx.closePath();
    ctx.fill();
  } else if (type === 'smg') {
    ctx.fillRect(-14, -7, 27, 7);
    ctx.fillRect(-6, 0, 5, 12);
    ctx.fillRect(7, -10, 8, 4);
    ctx.fillRect(-14, -2, 6, 5);
  } else if (type === 'shotgun') {
    ctx.fillRect(-15, -7, 30, 4);
    ctx.fillRect(-15, -1, 30, 4);
    ctx.beginPath();
    ctx.moveTo(-15, 3);
    ctx.lineTo(-6, 12);
    ctx.lineTo(-1, 12);
    ctx.lineTo(-8, 3);
    ctx.fill();
  } else if (type === 'bomb') {
    ctx.beginPath();
    ctx.arc(0, 3, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(4, -7);
    ctx.quadraticCurveTo(13, -14, 10, -22);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(10, -23, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#ffb84d';
    ctx.fill();
  } else if (type === 'rocket') {
    ctx.beginPath();
    ctx.moveTo(-14, 0);
    ctx.lineTo(4, -7);
    ctx.lineTo(14, 0);
    ctx.lineTo(4, 7);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ff6b63';
    ctx.beginPath();
    ctx.moveTo(-14, -5);
    ctx.lineTo(-20, 0);
    ctx.lineTo(-14, 5);
    ctx.fill();
  } else if (type === 'akm') {
    ctx.fillRect(-16, -6, 30, 6);
    ctx.fillRect(-18, -1, 13, 5);
    ctx.beginPath();
    ctx.moveTo(-4, 1);
    ctx.quadraticCurveTo(-1, 12, 7, 15);
    ctx.lineTo(12, 13);
    ctx.quadraticCurveTo(4, 8, 3, 1);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(7, -10, 10, 5);
    ctx.fillRect(15, -13, 3, 8);
  } else if (type === 'swap') {
    ctx.beginPath();
    ctx.moveTo(-12, -6);
    ctx.lineTo(9, -6);
    ctx.lineTo(4, -12);
    ctx.moveTo(12, 6);
    ctx.lineTo(-9, 6);
    ctx.lineTo(-4, 12);
    ctx.stroke();
  } else if (type === 'shield') {
    ctx.beginPath();
    ctx.moveTo(0, -14);
    ctx.lineTo(13, -8);
    ctx.lineTo(10, 9);
    ctx.lineTo(0, 16);
    ctx.lineTo(-10, 9);
    ctx.lineTo(-13, -8);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-5, 0);
    ctx.lineTo(0, 6);
    ctx.lineTo(7, -7);
    ctx.stroke();
  } else if (type === 'medkit') {
    ctx.fillRect(-13, -10, 26, 20);
    ctx.fillStyle = '#ff6b63';
    ctx.fillRect(-3, -7, 6, 14);
    ctx.fillRect(-8, -1, 16, 6);
  } else if (type === 'crate') {
    ctx.strokeRect(-12, -12, 24, 24);
    ctx.beginPath();
    ctx.moveTo(-12, -12);
    ctx.lineTo(12, 12);
    ctx.moveTo(12, -12);
    ctx.lineTo(-12, 12);
    ctx.stroke();
  } else if (type === 'vehicle') {
    ctx.beginPath();
    ctx.moveTo(-14, 6);
    ctx.lineTo(-11, -4);
    ctx.lineTo(4, -4);
    ctx.lineTo(9, 2);
    ctx.lineTo(14, 3);
    ctx.lineTo(14, 6);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-7, 8, 4, 0, Math.PI * 2);
    ctx.arc(8, 8, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export class GameRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.camera = { x: 480, zoom: 1, shake: 0 };
    this.particles = [];
    this.effects = [];
    this.lastTime = performance.now();
  }

  pushEvents(events, state) {
    for (const event of events) {
      const color = event.player >= 0 ? state.players[event.player]?.color || '#fff' : '#fff';
      if (event.type === 'hit') this.camera.shake = Math.max(this.camera.shake, event.amount > 100 ? 16 : 7);
      if (event.type === 'explosion') {
        this.camera.shake = Math.max(this.camera.shake, 24);
        this.effects.push({ x: event.x, y: event.y, radius: event.radius, age: 0, life: 0.45, weapon: event.weapon });
      }
      const counts = { jump: 8, land: 5, shot: 6, hit: 18, pickup: 16, respawn: 14, death: 30, heal: 20, shield: 20, swap: 18, explosion: 42, roundOver: 45 };
      const count = counts[event.type] || 0;
      for (let index = 0; index < count; index += 1) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 40 + Math.random() * (event.type === 'explosion' ? 420 : event.type === 'hit' ? 320 : 170);
        this.particles.push({
          x: event.x || 0,
          y: (event.y || 0) - (event.type === 'jump' || event.type === 'land' ? 4 : 0),
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 60,
          life: 0.35 + Math.random() * 0.55,
          maxLife: 0.9,
          size: 2 + Math.random() * 6,
          color: event.type === 'heal' ? '#72ef9a' : event.type === 'shield' ? '#79b9ff' : event.type === 'pickup' ? '#f7c948' : event.type === 'explosion' ? '#ffb84d' : color
        });
      }
    }
  }

  updateParticles(dt) {
    for (let index = this.particles.length - 1; index >= 0; index -= 1) {
      const particle = this.particles[index];
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += 500 * dt;
      if (particle.life <= 0) this.particles.splice(index, 1);
    }
    for (let index = this.effects.length - 1; index >= 0; index -= 1) {
      const effect = this.effects[index];
      effect.age += dt;
      if (effect.age > effect.life) this.effects.splice(index, 1);
    }
  }

  drawBackground(ctx, map, cameraX) {
    const gradients = {
      city: ['#82e4ef', '#d9f8ef'],
      construction: ['#ffc98a', '#fff0c7'],
      skyport: ['#92b8ff', '#e2edff']
    };
    const colors = gradients[map.theme];
    const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    gradient.addColorStop(0, colors[0]);
    gradient.addColorStop(1, colors[1]);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = 'rgba(255,255,255,.65)';
    for (let index = 0; index < 7; index += 1) {
      const x = ((index * 263 - cameraX * 0.08) % 1600 + 1600) % 1600 - 150;
      const y = 85 + (index % 3) * 58;
      ctx.beginPath();
      ctx.ellipse(x, y, 75, 22, 0, 0, Math.PI * 2);
      ctx.ellipse(x + 55, y + 5, 55, 18, 0, 0, Math.PI * 2);
      ctx.ellipse(x - 45, y + 8, 42, 15, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    if (map.theme === 'city') this.drawCity(ctx, cameraX);
    if (map.theme === 'construction') this.drawConstruction(ctx, cameraX);
    if (map.theme === 'skyport') this.drawSkyport(ctx, cameraX);
  }

  drawCity(ctx, cameraX) {
    for (let layer = 0; layer < 2; layer += 1) {
      const speed = layer === 0 ? 0.14 : 0.28;
      const baseY = layer === 0 ? 545 : 610;
      ctx.fillStyle = layer === 0 ? 'rgba(71,148,164,.18)' : 'rgba(41,103,124,.2)';
      for (let index = 0; index < 16; index += 1) {
        const width = 90 + (index * 37) % 100;
        const height = 110 + (index * 83) % 260;
        const x = ((index * 173 - cameraX * speed) % 2200 + 2200) % 2200 - 250;
        ctx.fillRect(x, baseY - height, width, height);
        ctx.fillStyle = 'rgba(255,255,255,.18)';
        for (let row = 0; row < 4; row += 1) ctx.fillRect(x + 16, baseY - height + 24 + row * 42, width - 32, 8);
        ctx.fillStyle = layer === 0 ? 'rgba(71,148,164,.18)' : 'rgba(41,103,124,.2)';
      }
    }
  }

  drawConstruction(ctx, cameraX) {
    ctx.strokeStyle = 'rgba(122,86,49,.22)';
    ctx.lineWidth = 10;
    for (let index = 0; index < 6; index += 1) {
      const x = ((index * 360 - cameraX * 0.2) % 2200 + 2200) % 2200 - 200;
      const height = 250 + (index % 3) * 80;
      ctx.beginPath();
      ctx.moveTo(x, 610);
      ctx.lineTo(x, 610 - height);
      ctx.lineTo(x + 240, 610 - height);
      ctx.stroke();
      ctx.lineWidth = 3;
      for (let y = 610 - height; y < 610; y += 45) {
        ctx.beginPath();
        ctx.moveTo(x - 12, y);
        ctx.lineTo(x + 12, y + 35);
        ctx.moveTo(x + 12, y);
        ctx.lineTo(x - 12, y + 35);
        ctx.stroke();
      }
      ctx.lineWidth = 10;
    }
  }

  drawSkyport(ctx, cameraX) {
    ctx.fillStyle = 'rgba(65,95,157,.13)';
    for (let index = 0; index < 8; index += 1) {
      const x = ((index * 290 - cameraX * 0.18) % 2200 + 2200) % 2200 - 220;
      const height = 130 + (index * 57) % 220;
      ctx.beginPath();
      ctx.moveTo(x, 600);
      ctx.lineTo(x + 45, 600 - height);
      ctx.lineTo(x + 95, 600);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(255,255,255,.35)';
    ctx.lineWidth = 4;
    ctx.setLineDash([28, 22]);
    ctx.beginPath();
    ctx.moveTo(0, 540);
    ctx.lineTo(WIDTH, 540);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  drawPlatforms(ctx, map) {
    for (const platform of map.platforms) {
      const steel = platform.type === 'steel';
      ctx.fillStyle = steel ? '#35556a' : '#273b4d';
      roundedRect(ctx, platform.x, platform.y, platform.w, platform.h, steel ? 6 : 10);
      ctx.fill();
      ctx.fillStyle = steel ? '#8eaabd' : '#4f7082';
      ctx.fillRect(platform.x + 3, platform.y, platform.w - 6, 9);
      ctx.fillStyle = 'rgba(255,255,255,.09)';
      for (let x = platform.x + 24; x < platform.x + platform.w - 10; x += 70) ctx.fillRect(x, platform.y + 24, 32, 6);
      if (!steel) {
        ctx.fillStyle = 'rgba(0,0,0,.15)';
        ctx.fillRect(platform.x + 12, platform.y + 46, platform.w - 24, 5);
      }
    }
  }

  drawFinish(ctx, map, now) {
    const x = map.finish;
    ctx.fillStyle = '#182635';
    ctx.fillRect(x, 260, 12, 360);
    ctx.fillStyle = '#b7ff5c';
    ctx.fillRect(x - 12, 250, 36, 16);
    const wave = Math.sin(now / 250) * 5;
    for (let row = 0; row < 4; row += 1) {
      for (let column = 0; column < 6; column += 1) {
        ctx.fillStyle = (row + column) % 2 ? '#f4f8fb' : '#182635';
        ctx.fillRect(x + 12 + column * 20, 278 + row * 20 + wave * column / 6, 20, 20);
      }
    }
    text(ctx, '撤离点', x + 60, 230, 20, '#182635', 'center', 900);
  }

  drawPickup(ctx, pickup, now) {
    if (!pickup.active) return;
    const y = pickup.y + Math.sin(now / 280 + pickup.id) * 7;
    ctx.save();
    ctx.translate(pickup.x, y);
    ctx.shadowColor = pickup.type === 'medkit' ? '#72ef9a' : pickup.type === 'shield' ? '#79b9ff' : '#f7c948';
    ctx.shadowBlur = 20;
    ctx.fillStyle = '#152b3c';
    ctx.beginPath();
    for (let side = 0; side < 6; side += 1) {
      const angle = Math.PI / 3 * side - Math.PI / 2;
      const x = Math.cos(angle) * 26;
      const py = Math.sin(angle) * 26;
      if (side === 0) ctx.moveTo(x, py); else ctx.lineTo(x, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = pickup.type === 'medkit' ? '#72ef9a' : pickup.type === 'shield' ? '#79b9ff' : '#b7ff5c';
    ctx.lineWidth = 3;
    ctx.stroke();
    drawWeaponIcon(ctx, pickup.type, 0, 0, 28, ctx.strokeStyle);
    ctx.restore();
  }

  drawCrate(ctx, crate) {
    if (crate.dead) return;
    ctx.save();
    ctx.translate(crate.x, crate.y);
    ctx.fillStyle = '#6b4b2a';
    ctx.strokeStyle = '#2d1d10';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(-22, -15, 44, 30, 4);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#ffca55';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-16, -10);
    ctx.lineTo(16, 10);
    ctx.moveTo(16, -10);
    ctx.lineTo(-16, 10);
    ctx.stroke();
    ctx.restore();
  }

  drawVehicle(ctx, vehicle) {
    if (vehicle.dead) return;
    ctx.save();
    ctx.translate(vehicle.x, vehicle.y);
    ctx.fillStyle = '#355e75';
    ctx.beginPath();
    ctx.roundRect(-55, -32, 110, 32, 8);
    ctx.fill();
    ctx.fillStyle = '#76b8d5';
    ctx.beginPath();
    ctx.moveTo(-28, -32);
    ctx.lineTo(-18, -52);
    ctx.lineTo(18, -52);
    ctx.lineTo(28, -32);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#182635';
    ctx.beginPath();
    ctx.arc(-30, 3, 13, 0, Math.PI * 2);
    ctx.arc(32, 3, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawPlayer(ctx, player, isFocused, now) {
    if (player.dead) ctx.globalAlpha = 0.35;
    ctx.save();
    ctx.translate(player.x, player.y - 50);
    ctx.rotate(player.angle);
    if (player.stun > 0 && !player.dead && Math.floor(now / 90) % 2 === 0) ctx.globalAlpha *= 0.55;
    ctx.strokeStyle = '#152331';
    ctx.lineWidth = 11;
    ctx.lineCap = 'round';
    const legSwing = clamp(player.vx / 700, -0.5, 0.5);
    ctx.beginPath();
    ctx.moveTo(-8, 17);
    ctx.lineTo(-14 - legSwing * 14, 47);
    ctx.moveTo(8, 17);
    ctx.lineTo(14 + legSwing * 14, 47);
    ctx.stroke();
    ctx.fillStyle = player.color;
    roundedRect(ctx, -21, -25, 42, 52, 15);
    ctx.fill();
    ctx.strokeStyle = player.accent;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(-15, -12);
    ctx.lineTo(-31, 6 + legSwing * 12);
    ctx.moveTo(15, -12);
    ctx.lineTo(31, 4 - legSwing * 12);
    ctx.stroke();
    ctx.fillStyle = player.accent;
    ctx.beginPath();
    ctx.arc(0, -45, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#152331';
    ctx.fillRect(player.facing > 0 ? 2 : -16, -51, 14, 7);
    ctx.fillStyle = player.color;
    ctx.beginPath();
    ctx.arc(-8, -61, 9, Math.PI, Math.PI * 2);
    ctx.arc(8, -61, 9, Math.PI, Math.PI * 2);
    ctx.fill();
    if (player.weapon) {
      const aim = player.aimAngle ?? (player.facing > 0 ? 0 : Math.PI);
      ctx.save();
      ctx.translate(14, -8);
      ctx.rotate(aim - player.angle);
      drawWeaponIcon(ctx, player.weapon, 18, 0, 34, player.weapon === 'shotgun' ? '#d8e8f2' : '#b7ff5c');
      ctx.restore();
    }
    ctx.restore();
    if (player.shield > 0) {
      ctx.strokeStyle = '#79b9ff';
      ctx.lineWidth = 4;
      ctx.globalAlpha = 0.55 + Math.sin(now / 90) * 0.15;
      ctx.beginPath();
      ctx.arc(player.x, player.y - 52, 62, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    const label = `${player.id < 2 ? `P${player.id + 1}` : 'CPU'} · ${player.name}`;
    text(ctx, label, player.x, player.y - 132, 15, '#142434', 'center', 900);
    ctx.fillStyle = 'rgba(20,36,52,.72)';
    ctx.fillRect(player.x - 32, player.y - 122, 64, 6);
    ctx.fillStyle = player.hp > 55 ? '#72ef9a' : player.hp > 25 ? '#f7c948' : '#ff6b63';
    ctx.fillRect(player.x - 32, player.y - 122, 64 * (player.hp / MAX_HP), 6);
    if (isFocused) {
      ctx.fillStyle = '#142434';
      ctx.beginPath();
      ctx.moveTo(player.x, player.y - 115);
      ctx.lineTo(player.x - 7, player.y - 125);
      ctx.lineTo(player.x + 7, player.y - 125);
      ctx.fill();
    }
    if (player.dead) {
      text(ctx, `复活 ${Math.max(0, player.respawnTimer).toFixed(1)}`, player.x, player.y - 90, 18, '#142434', 'center', 900);
    } else if (player.chargeDir !== 0) {
      const power = clamp(player.charge / 1.1, 0, 1);
      const degrees = Math.round(Math.abs(player.angle) * 180 / Math.PI);
      ctx.fillStyle = 'rgba(20,36,52,.82)';
      roundedRect(ctx, player.x - 48, player.y - 178, 96, 29, 8);
      ctx.fill();
      ctx.fillStyle = '#263e50';
      ctx.fillRect(player.x - 39, player.y - 167, 59, 7);
      ctx.fillStyle = power > 0.82 ? '#ff9d4d' : '#b7ff5c';
      ctx.fillRect(player.x - 39, player.y - 167, 59 * power, 7);
      text(ctx, `${degrees}°`, player.x + 33, player.y - 164, 13, '#fff', 'center', 900);
      ctx.strokeStyle = '#142434';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(player.x, player.y - 103);
      ctx.lineTo(player.x + player.chargeDir * (30 + power * 35), player.y - 113 - power * 25);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  drawProjectile(ctx, projectile) {
    const angle = Math.atan2(projectile.vy, projectile.vx);
    ctx.save();
    ctx.translate(projectile.x, projectile.y);
    ctx.rotate(angle);
    if (projectile.weapon === 'knife') drawWeaponIcon(ctx, 'knife', 0, 0, 22, '#dcecff');
    else if (projectile.weapon === 'shotgun') {
      ctx.fillStyle = '#ffe2a8';
      ctx.fillRect(-7, -2, 14, 4);
    } else if (projectile.weapon === 'swap') {
      ctx.strokeStyle = '#46d9e8';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-11, -5);
      ctx.lineTo(8, -5);
      ctx.moveTo(11, 5);
      ctx.lineTo(-8, 5);
      ctx.stroke();
    } else if (projectile.weapon === 'bomb') {
      ctx.fillStyle = '#ff6b63';
      ctx.beginPath();
      ctx.arc(0, 0, projectile.radius, 0, Math.PI * 2);
      ctx.fill();
    } else if (projectile.weapon === 'akm') {
      ctx.shadowColor = '#ffca55';
      ctx.shadowBlur = 18;
      ctx.fillStyle = '#fff2bd';
      ctx.fillRect(-12, -3, 24, 6);
    } else if (projectile.weapon === 'rocket') {
      drawWeaponIcon(ctx, 'rocket', 0, 0, 24, '#ffca55');
    } else {
      ctx.shadowColor = projectile.weapon === 'smg' ? '#46d9e8' : '#b7ff5c';
      ctx.shadowBlur = 14;
      ctx.fillStyle = '#eaffc9';
      ctx.fillRect(-8, -3, 16, 6);
    }
    ctx.restore();
  }

  drawEffects(ctx) {
    for (const effect of this.effects) {
      const progress = effect.age / effect.life;
      ctx.strokeStyle = effect.weapon === 'vehicle' ? '#ffca55' : '#ff9d4d';
      ctx.globalAlpha = 1 - progress;
      ctx.lineWidth = 8 * (1 - progress);
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, effect.radius * (0.25 + progress * 0.75), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  drawParticles(ctx) {
    for (const particle of this.particles) {
      ctx.globalAlpha = clamp(particle.life / particle.maxLife, 0, 1);
      ctx.fillStyle = particle.color;
      ctx.fillRect(particle.x - particle.size / 2, particle.y - particle.size / 2, particle.size, particle.size);
    }
    ctx.globalAlpha = 1;
  }

  drawHUD(ctx, state, map, focusIds) {
    for (const player of state.players) {
      const x = 18 + player.id * 184;
      ctx.fillStyle = 'rgba(14,29,43,.88)';
      roundedRect(ctx, x, 16, 170, 86, 13);
      ctx.fill();
      ctx.fillStyle = player.color;
      roundedRect(ctx, x + 8, 24, 7, 70, 3);
      ctx.fill();
      text(ctx, `${player.id < 2 ? `P${player.id + 1}` : 'CPU'} ${player.name}`, x + 25, 34, 15, '#fff', 'left', 900);
      for (let score = 0; score < WIN_SCORE; score += 1) {
        ctx.fillStyle = score < player.score ? player.color : '#354b5c';
        roundedRect(ctx, x + 25 + score * 25, 53, 19, 12, 3);
        ctx.fill();
      }
      ctx.fillStyle = '#263e50';
      ctx.fillRect(x + 25, 76, 132, 10);
      ctx.fillStyle = player.hp > 55 ? '#72ef9a' : player.hp > 25 ? '#f7c948' : '#ff6b63';
      ctx.fillRect(x + 25, 76, 132 * (player.hp / MAX_HP), 10);
      if (player.shield > 0) {
        ctx.fillStyle = '#79b9ff';
        ctx.fillRect(x + 150, 76, 12, 10);
        text(ctx, player.shield.toFixed(1), x + 145, 81, 10, '#fff', 'right', 900);
      }
    }
    text(ctx, `第 ${state.round} 轮 · ${map.name}`, 1258, 28, 17, '#142434', 'right', 900);
    const startX = 835;
    const width = 420;
    ctx.fillStyle = 'rgba(20,36,52,.22)';
    roundedRect(ctx, startX, 61, width, 12, 6);
    ctx.fill();
    for (const player of state.players) {
      const progress = clamp(player.x / map.finish, 0, 1);
      ctx.fillStyle = player.color;
      ctx.beginPath();
      ctx.arc(startX + progress * width, 67, player.id === focusIds[0] ? 8 : 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    const focused = state.players[focusIds[0]] || state.players[0];
    ctx.fillStyle = 'rgba(14,29,43,.88)';
    roundedRect(ctx, 18, 610, 470, 90, 14);
    ctx.fill();
    text(ctx, 'W / E  蓄力偏转 · 松开跳跃', 34, 634, 16, '#eaf4f7', 'left', 700);
    text(ctx, 'R  使用武器', 34, 660, 16, '#eaf4f7', 'left', 700);
    if (focused.weapon) {
      drawWeaponIcon(ctx, focused.weapon, 418, 655, 50, '#b7ff5c');
      text(ctx, WEAPON_LABELS[focused.weapon] || focused.weapon, 388, 625, 15, '#fff', 'right', 900);
      text(ctx, `× ${focused.ammo}`, 388, 678, 16, '#f7c948', 'right', 900);
    } else {
      text(ctx, '尚未拾取武器', 458, 655, 16, '#8fa8b7', 'right', 700);
    }
  }

  drawPhase(ctx, state, map) {
    if (state.phase === 'countdown') {
      ctx.fillStyle = 'rgba(12,28,42,.25)';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      const count = Math.max(1, Math.ceil(state.phaseTime));
      text(ctx, String(count), WIDTH / 2, 278, 112, '#fff', 'center', 900);
      text(ctx, map.name, WIDTH / 2, 367, 30, '#142434', 'center', 900);
      text(ctx, '按住 W / E 调整角度，松开立即跳跃', WIDTH / 2, 414, 21, '#142434', 'center', 700);
    }
    if (state.phase === 'roundOver') {
      const winner = state.players[state.roundWinner];
      ctx.fillStyle = 'rgba(12,28,42,.72)';
      roundedRect(ctx, WIDTH / 2 - 250, 244, 500, 146, 24);
      ctx.fill();
      text(ctx, `${winner.name} 抵达撤离点！`, WIDTH / 2, 290, 34, winner.color, 'center', 900);
      text(ctx, '下一轮即将开始', WIDTH / 2, 346, 20, '#fff', 'center', 700);
    }
    if (state.phase === 'matchOver') {
      const winner = state.players.find(player => player.score >= WIN_SCORE) || state.players[0];
      text(ctx, `${winner.name} 赢得比赛`, WIDTH / 2, 230, 42, '#142434', 'center', 900);
    }
  }

  drawAimReticle(ctx, player, target, now) {
    if (!target || target.dead) return;
    const pulse = 1 + Math.sin(now / 140) * 0.08;
    ctx.save();
    ctx.strokeStyle = player.color;
    ctx.globalAlpha = 0.78;
    ctx.lineWidth = 2;
    ctx.translate(target.x, target.y - 50);
    ctx.scale(pulse, pulse);
    ctx.beginPath();
    ctx.arc(0, 0, 34, 0, Math.PI * 2);
    ctx.moveTo(-44, 0);
    ctx.lineTo(-28, 0);
    ctx.moveTo(28, 0);
    ctx.lineTo(44, 0);
    ctx.moveTo(0, -44);
    ctx.lineTo(0, -28);
    ctx.moveTo(0, 28);
    ctx.lineTo(0, 44);
    ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  render(state, focusIds = [0], now = performance.now()) {
    const ctx = this.ctx;
    const dt = Math.min(0.05, (now - this.lastTime) / 1000);
    this.lastTime = now;
    this.updateParticles(dt);
    const map = MAPS[state.mapIndex] || MAPS[0];
    const focused = focusIds.map(id => state.players[id]).filter(Boolean);
    const leader = state.players.reduce((best, player) => player.x > best.x ? player : best, state.players[0]);
    const targets = focused.length ? focused : [leader];
    const center = targets.reduce((sum, player) => sum + player.x, 0) / targets.length;
    const spread = Math.max(...targets.map(player => Math.abs(player.x - center))) * 2;
    const targetZoom = clamp(1050 / (spread + 850), 0.66, 1);
    this.camera.x += (center + 170 - this.camera.x) * Math.min(1, dt * 5.5);
    this.camera.x = clamp(this.camera.x, 480, map.finish - 250);
    this.camera.zoom += (targetZoom - this.camera.zoom) * Math.min(1, dt * 3);
    this.camera.shake = Math.max(0, this.camera.shake - dt * 45);
    const shakeX = (Math.random() - 0.5) * this.camera.shake;
    const shakeY = (Math.random() - 0.5) * this.camera.shake;
    this.drawBackground(ctx, map, this.camera.x);
    ctx.save();
    ctx.translate(WIDTH / 2 + shakeX, HEIGHT / 2 + shakeY);
    ctx.scale(this.camera.zoom, this.camera.zoom);
    ctx.translate(-this.camera.x, -HEIGHT / 2);
    this.drawPlatforms(ctx, map);
    this.drawFinish(ctx, map, now);
    for (const vehicle of state.vehicles || []) this.drawVehicle(ctx, vehicle);
    for (const crate of state.crates || []) this.drawCrate(ctx, crate);
    for (const pickup of state.pickups) this.drawPickup(ctx, pickup, now);
    for (const projectile of state.projectiles) this.drawProjectile(ctx, projectile);
    for (const player of state.players) this.drawPlayer(ctx, player, focusIds.includes(player.id), now);
    for (const player of state.players) {
      if (focusIds.includes(player.id) && player.weapon && player.targetId >= 0) {
        this.drawAimReticle(ctx, player, state.players[player.targetId], now);
      }
    }
    this.drawEffects(ctx);
    this.drawParticles(ctx);
    ctx.restore();
    this.drawHUD(ctx, state, map, focusIds);
    this.drawPhase(ctx, state, map);
  }
}
