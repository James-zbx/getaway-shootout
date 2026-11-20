import { MAPS, WIN_SCORE } from './engine.js';

const WIDTH = 1280;
const HEIGHT = 720;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

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

export class GameRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.camera = { x: 480, zoom: 1, shake: 0 };
    this.particles = [];
    this.lastTime = performance.now();
  }

  pushEvents(events, state) {
    for (const event of events) {
      const color = event.player >= 0 ? state.players[event.player]?.color || '#fff' : '#fff';
      if (event.type === 'hit') this.camera.shake = event.weapon === 'launcher' ? 15 : 8;
      const counts = { jump: 8, land: 5, shot: 8, hit: 22, pickup: 16, respawn: 14, roundOver: 45 };
      const count = counts[event.type] || 0;
      for (let index = 0; index < count; index += 1) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 40 + Math.random() * (event.type === 'hit' ? 320 : 170);
        this.particles.push({
          x: event.x || 0,
          y: (event.y || 0) - (event.type === 'jump' || event.type === 'land' ? 4 : 35),
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 60,
          life: 0.35 + Math.random() * 0.55,
          maxLife: 0.9,
          size: 2 + Math.random() * 6,
          color: event.type === 'pickup' ? '#f7c948' : color
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
    ctx.shadowColor = pickup.type === 'launcher' ? '#ff9d4d' : '#b7ff5c';
    ctx.shadowBlur = 20;
    ctx.fillStyle = '#152b3c';
    ctx.beginPath();
    for (let side = 0; side < 6; side += 1) {
      const angle = Math.PI / 3 * side - Math.PI / 2;
      const x = Math.cos(angle) * 24;
      const py = Math.sin(angle) * 24;
      if (side === 0) ctx.moveTo(x, py); else ctx.lineTo(x, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = pickup.type === 'launcher' ? '#ff9d4d' : '#b7ff5c';
    ctx.lineWidth = 3;
    ctx.stroke();
    if (pickup.type === 'launcher') {
      ctx.fillStyle = '#ff9d4d';
      ctx.fillRect(-12, -5, 22, 10);
      ctx.beginPath();
      ctx.moveTo(10, -8);
      ctx.lineTo(18, 0);
      ctx.lineTo(10, 8);
      ctx.fill();
    } else {
      ctx.strokeStyle = '#b7ff5c';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(-11, 6);
      ctx.lineTo(1, -7);
      ctx.lineTo(12, 6);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawPlayer(ctx, player, isFocused, now) {
    ctx.save();
    ctx.translate(player.x, player.y - 42);
    ctx.rotate(player.angle);
    if (player.stun > 0 && Math.floor(now / 90) % 2 === 0) ctx.globalAlpha = 0.55;
    ctx.strokeStyle = '#152331';
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    const legSwing = clamp(player.vx / 700, -0.5, 0.5);
    ctx.beginPath();
    ctx.moveTo(-7, 14);
    ctx.lineTo(-12 - legSwing * 12, 39);
    ctx.moveTo(7, 14);
    ctx.lineTo(12 + legSwing * 12, 39);
    ctx.stroke();
    ctx.fillStyle = player.color;
    roundedRect(ctx, -18, -22, 36, 46, 13);
    ctx.fill();
    ctx.strokeStyle = player.accent;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(-13, -10);
    ctx.lineTo(-27, 5 + legSwing * 10);
    ctx.moveTo(13, -10);
    ctx.lineTo(27, 3 - legSwing * 10);
    ctx.stroke();
    ctx.fillStyle = player.accent;
    ctx.beginPath();
    ctx.arc(0, -38, 19, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#152331';
    ctx.fillRect(player.facing > 0 ? 2 : -14, -43, 12, 6);
    ctx.fillStyle = player.color;
    ctx.beginPath();
    ctx.arc(-7, -52, 8, Math.PI, Math.PI * 2);
    ctx.arc(7, -52, 8, Math.PI, Math.PI * 2);
    ctx.fill();
    if (player.weapon) {
      ctx.fillStyle = player.weapon === 'launcher' ? '#ff9d4d' : '#b7ff5c';
      ctx.save();
      ctx.scale(player.facing, 1);
      ctx.fillRect(17, -10, player.weapon === 'launcher' ? 37 : 29, player.weapon === 'launcher' ? 13 : 8);
      ctx.fillStyle = '#152331';
      ctx.fillRect(19, -4, 8, 13);
      ctx.restore();
    }
    ctx.restore();
    const label = `${player.id < 2 ? `P${player.id + 1}` : 'CPU'} · ${player.name}`;
    text(ctx, label, player.x, player.y - 112, 15, '#142434', 'center', 900);
    if (isFocused) {
      ctx.fillStyle = '#142434';
      ctx.beginPath();
      ctx.moveTo(player.x, player.y - 96);
      ctx.lineTo(player.x - 7, player.y - 106);
      ctx.lineTo(player.x + 7, player.y - 106);
      ctx.fill();
    }
    if (player.chargeDir !== 0) {
      const power = clamp(player.charge / 1.1, 0, 1);
      const degrees = Math.round(Math.abs(player.angle) * 180 / Math.PI);
      ctx.fillStyle = 'rgba(20,36,52,.82)';
      roundedRect(ctx, player.x - 48, player.y - 151, 96, 29, 8);
      ctx.fill();
      ctx.fillStyle = '#263e50';
      ctx.fillRect(player.x - 39, player.y - 140, 59, 7);
      ctx.fillStyle = power > 0.82 ? '#ff9d4d' : '#b7ff5c';
      ctx.fillRect(player.x - 39, player.y - 140, 59 * power, 7);
      text(ctx, `${degrees}°`, player.x + 33, player.y - 137, 13, '#fff', 'center', 900);
      ctx.strokeStyle = '#142434';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(player.x, player.y - 76);
      ctx.lineTo(player.x + player.chargeDir * (30 + power * 35), player.y - 86 - power * 25);
      ctx.stroke();
    }
  }

  drawProjectile(ctx, projectile) {
    ctx.save();
    ctx.translate(projectile.x, projectile.y);
    if (projectile.type === 'launcher') {
      ctx.rotate(Math.atan2(projectile.vy, projectile.vx));
      ctx.fillStyle = '#ff9d4d';
      ctx.fillRect(-15, -7, 26, 14);
      ctx.fillStyle = '#fff1cf';
      ctx.beginPath();
      ctx.moveTo(11, -8);
      ctx.lineTo(22, 0);
      ctx.lineTo(11, 8);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,107,99,.65)';
      ctx.beginPath();
      ctx.moveTo(-14, -6);
      ctx.lineTo(-31, 0);
      ctx.lineTo(-14, 6);
      ctx.fill();
    } else {
      ctx.shadowColor = '#b7ff5c';
      ctx.shadowBlur = 18;
      ctx.fillStyle = '#eaffc9';
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
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
      roundedRect(ctx, x, 16, 170, 64, 13);
      ctx.fill();
      ctx.fillStyle = player.color;
      roundedRect(ctx, x + 8, 24, 7, 48, 3);
      ctx.fill();
      text(ctx, `${player.id < 2 ? `P${player.id + 1}` : 'CPU'} ${player.name}`, x + 25, 34, 15, '#fff', 'left', 900);
      for (let score = 0; score < WIN_SCORE; score += 1) {
        ctx.fillStyle = score < player.score ? player.color : '#354b5c';
        roundedRect(ctx, x + 25 + score * 25, 53, 19, 12, 3);
        ctx.fill();
      }
    }
    text(ctx, `第 ${state.round} 轮 · ${map.name}`, 1258, 28, 17, '#142434', 'right', 900);
    const startX = 835;
    const width = 420;
    ctx.fillStyle = 'rgba(20,36,52,.22)';
    roundedRect(ctx, startX, 49, width, 12, 6);
    ctx.fill();
    for (const player of state.players) {
      const progress = clamp(player.x / map.finish, 0, 1);
      ctx.fillStyle = player.color;
      ctx.beginPath();
      ctx.arc(startX + progress * width, 55, player.id === focusIds[0] ? 8 : 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    const focused = state.players[focusIds[0]] || state.players[0];
    ctx.fillStyle = 'rgba(14,29,43,.86)';
    roundedRect(ctx, 18, 637, 440, 64, 14);
    ctx.fill();
    text(ctx, 'W / E  蓄力偏转 · 松开跳跃', 34, 657, 16, '#eaf4f7', 'left', 700);
    const weaponName = focused.weapon === 'launcher' ? `震荡炮 × ${focused.ammo}` : focused.weapon === 'pulse' ? `脉冲枪 × ${focused.ammo}` : '尚未拾取武器';
    text(ctx, `R  ${weaponName}`, 34, 683, 17, focused.weapon ? '#b7ff5c' : '#8fa8b7', 'left', 900);
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
    for (const pickup of state.pickups) this.drawPickup(ctx, pickup, now);
    for (const projectile of state.projectiles) this.drawProjectile(ctx, projectile);
    for (const player of state.players) this.drawPlayer(ctx, player, focusIds.includes(player.id), now);
    this.drawParticles(ctx);
    ctx.restore();
    this.drawHUD(ctx, state, map, focusIds);
    this.drawPhase(ctx, state, map);
  }
}
