import { createGame, makeSnapshot, stepGame, interpolateSnapshots, STEP, WIN_SCORE } from './engine.js';
import { GameRenderer } from './renderer.js';
import { OnlineSession, normalizeRoomCode } from './network.js';

const $ = selector => document.querySelector(selector);
const canvas = $('#gameCanvas');
const renderer = new GameRenderer(canvas);
const panels = ['#mainMenu', '#onlinePanel', '#lobbyPanel', '#pausePanel', '#resultPanel'];
const emptyInput = () => ({ left: false, right: false, weapon: false });
const keys = new Set();

let mode = 'demo';
let screen = 'menu';
let game = createGame({ humanCount: 0 });
game.phase = 'racing';
let localPlayerIds = [];
let session = null;
let onlineRole = null;
let remoteInput = emptyInput();
let paused = false;
let onlineMenuOpen = false;
let resultShown = false;
let accumulator = 0;
let lastSimulation = performance.now();
let lastSnapshotSent = 0;
let lastInputSent = 0;
let snapshotBuffer = [];
let pendingNetworkEvents = [];
let toastTimer = 0;
let audioContext = null;
let muted = false;

function showPanel(selector) {
  for (const panel of panels) $(panel).classList.toggle('hidden', panel !== selector);
}

function hidePanels() {
  for (const panel of panels) $(panel).classList.add('hidden');
}

function toast(message, duration = 2600) {
  clearTimeout(toastTimer);
  $('#toast').textContent = message;
  $('#toast').classList.remove('hidden');
  toastTimer = setTimeout(() => $('#toast').classList.add('hidden'), duration);
}

function ensureAudio() {
  if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
  if (audioContext.state === 'suspended') audioContext.resume();
}

function tone(frequency, duration, type = 'square', volume = 0.035, endFrequency = frequency) {
  if (muted || !audioContext) return;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const now = audioContext.currentTime;
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, now);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), now + duration);
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + duration);
}

function playEvents(events) {
  for (const event of events) {
    if (event.type === 'jump') tone(150 + event.power * 100, 0.1, 'square', 0.025, 260 + event.power * 160);
    if (event.type === 'land') tone(90, 0.05, 'triangle', 0.018, 55);
    if (event.type === 'pickup') tone(520, 0.14, 'sine', 0.04, 900);
    if (event.type === 'shot') tone(event.weapon === 'launcher' ? 110 : 280, 0.12, 'sawtooth', 0.035, 55);
    if (event.type === 'hit') tone(80, 0.18, 'square', 0.045, 35);
    if (event.type === 'respawn') tone(230, 0.18, 'sine', 0.025, 90);
    if (event.type === 'roundOver') {
      tone(440, 0.2, 'square', 0.035, 660);
      setTimeout(() => tone(660, 0.25, 'square', 0.03, 880), 130);
    }
  }
}

function newAttractGame() {
  game = createGame({ humanCount: 0 });
  game.phase = 'racing';
  localPlayerIds = [];
  accumulator = 0;
}

async function closeSession() {
  const current = session;
  session = null;
  onlineRole = null;
  if (current) await current.close();
}

function showMenu() {
  closeSession();
  mode = 'demo';
  screen = 'menu';
  paused = false;
  onlineMenuOpen = false;
  resultShown = false;
  keys.clear();
  newAttractGame();
  showPanel('#mainMenu');
  $('#modeBadge').textContent = '演示模式';
  window.history.replaceState({}, '', window.location.pathname);
}

function showOnline(errorMessage = '') {
  if (mode !== 'demo') newAttractGame();
  mode = 'demo';
  screen = 'online';
  localPlayerIds = [];
  showPanel('#onlinePanel');
  $('#onlineStatus').textContent = errorMessage;
  $('#modeBadge').textContent = '在线双人';
  $('#createRoomButton').disabled = false;
  $('#joinRoomButton').disabled = false;
}

function startLocal(localMode) {
  closeSession();
  ensureAudio();
  mode = localMode;
  screen = 'game';
  game = createGame({ humanCount: localMode === 'single' ? 1 : 2 });
  localPlayerIds = localMode === 'single' ? [0] : [0, 1];
  paused = false;
  onlineMenuOpen = false;
  resultShown = false;
  accumulator = 0;
  keys.clear();
  hidePanels();
  $('#modeBadge').textContent = localMode === 'single' ? '单人 · 3 名人机' : '本地双人 · 2 名人机';
  $('#p2Controls').classList.toggle('hidden', localMode === 'single');
}

function resetOnlineGame(isHost) {
  mode = 'online';
  screen = 'game';
  onlineRole = isHost ? 'host' : 'guest';
  localPlayerIds = [isHost ? 0 : 1];
  paused = false;
  onlineMenuOpen = false;
  resultShown = false;
  snapshotBuffer = [];
  pendingNetworkEvents = [];
  remoteInput = emptyInput();
  accumulator = 0;
  keys.clear();
  hidePanels();
  $('#modeBadge').textContent = isHost ? '在线 · 你是 P1' : '在线 · 你是 P2';
  $('#p2Controls').classList.remove('hidden');
}

function startOnlineHost() {
  resetOnlineGame(true);
  game = createGame({ humanCount: 2 });
  session?.send({ type: 'start', state: makeSnapshot(game) });
}

function receiveOnlineMessage(message) {
  if (!message || typeof message !== 'object') return;
  if (message.type === 'bye') {
    handleOnlineClose(new Error('对手已离开对局'));
    return;
  }
  if (onlineRole === 'host' && message.type === 'input') {
    remoteInput = {
      left: Boolean(message.input?.left),
      right: Boolean(message.input?.right),
      weapon: Boolean(message.input?.weapon)
    };
    return;
  }
  if (onlineRole !== 'guest') return;
  if (message.type === 'start' && message.state) {
    resetOnlineGame(false);
    game = message.state;
    snapshotBuffer = [{ received: performance.now(), state: game }];
    return;
  }
  if (message.type === 'snapshot' && message.state) {
    if (screen !== 'game') resetOnlineGame(false);
    game = message.state;
    snapshotBuffer.push({ received: performance.now(), state: message.state });
    if (snapshotBuffer.length > 12) snapshotBuffer.shift();
    if (message.events?.length) {
      renderer.pushEvents(message.events, game);
      playEvents(message.events);
    }
  }
}

function handleOnlineClose(error) {
  if (!session) return;
  const message = error?.message || '对手已断开连接';
  const current = session;
  session = null;
  onlineRole = null;
  current.close(false);
  keys.clear();
  newAttractGame();
  showOnline(message);
}

function createOnlineSession() {
  const current = new OnlineSession({
    onOpen: () => {
      if (session !== current) return;
      if (current.role === 'host') startOnlineHost();
      else $('#lobbyStatus').textContent = '已连接，正在同步比赛…';
    },
    onMessage: message => {
      if (session === current) receiveOnlineMessage(message);
    },
    onClose: error => {
      if (session === current) handleOnlineClose(error);
    },
    onStatus: status => {
      if (session !== current) return;
      if (screen === 'game') $('#modeBadge').textContent = status;
      else $('#lobbyStatus').textContent = status;
    }
  });
  session = current;
  return current;
}

async function createRoom() {
  ensureAudio();
  await closeSession();
  const current = createOnlineSession();
  onlineRole = 'host';
  $('#createRoomButton').disabled = true;
  $('#joinRoomButton').disabled = true;
  showPanel('#lobbyPanel');
  $('#lobbyTitle').textContent = '等待另一名玩家';
  $('#lobbyHint').textContent = '把房间码或邀请链接发给朋友。';
  $('#roomCodeButton').textContent = '------';
  $('#copyInviteButton').classList.remove('hidden');
  $('#lobbyStatus').textContent = '正在创建房间…';
  try {
    const code = await current.createRoom();
    $('#roomCodeButton').textContent = code;
    $('#lobbyStatus').textContent = '房间已创建，等待朋友加入…';
  } catch (error) {
    if (session === current) await closeSession();
    showOnline(error.message || '创建房间失败，请稍后重试');
  }
}

async function joinRoom() {
  ensureAudio();
  const code = normalizeRoomCode($('#roomInput').value);
  if (code.length !== 6) {
    $('#onlineStatus').textContent = '请输入完整的六位房间码';
    return;
  }
  await closeSession();
  const current = createOnlineSession();
  onlineRole = 'guest';
  $('#createRoomButton').disabled = true;
  $('#joinRoomButton').disabled = true;
  showPanel('#lobbyPanel');
  $('#lobbyTitle').textContent = '正在加入房间';
  $('#lobbyHint').textContent = `房间码 ${code}`;
  $('#roomCodeButton').textContent = code;
  $('#copyInviteButton').classList.add('hidden');
  $('#lobbyStatus').textContent = '正在建立点对点连接…';
  try {
    await current.joinRoom(code);
  } catch (error) {
    if (session === current) await closeSession();
    showOnline(error.message || '加入房间失败，请检查房间码');
  }
}

async function cancelLobby() {
  await closeSession();
  showOnline();
}

function inviteLink() {
  const code = $('#roomCodeButton').textContent.trim();
  return `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(code)}`;
}

async function copyText(value, successMessage) {
  try {
    await navigator.clipboard.writeText(value);
    toast(successMessage);
  } catch {
    toast(`请手动复制：${value}`, 5000);
  }
}

function keyboardInput(playerId) {
  if (paused || onlineMenuOpen || screen !== 'game') return emptyInput();
  const secondLocal = mode === 'double' && playerId === 1;
  return {
    left: keys.has(secondLocal ? 'KeyI' : 'KeyW'),
    right: keys.has(secondLocal ? 'KeyO' : 'KeyE'),
    weapon: keys.has(secondLocal ? 'KeyP' : 'KeyR')
  };
}

function gameInputs() {
  if (mode === 'online') return [keyboardInput(0), remoteInput];
  return [keyboardInput(0), keyboardInput(1)];
}

function guestRenderState(now) {
  if (!snapshotBuffer.length) return game;
  const renderTime = now - 80;
  if (snapshotBuffer.length === 1 || renderTime <= snapshotBuffer[0].received) return snapshotBuffer[0].state;
  for (let index = 0; index < snapshotBuffer.length - 1; index += 1) {
    const before = snapshotBuffer[index];
    const after = snapshotBuffer[index + 1];
    if (renderTime >= before.received && renderTime <= after.received) {
      return interpolateSnapshots(before.state, after.state, (renderTime - before.received) / Math.max(1, after.received - before.received));
    }
  }
  return snapshotBuffer[snapshotBuffer.length - 1].state;
}

function showResult() {
  if (resultShown || mode === 'demo') return;
  resultShown = true;
  const winner = game.players.find(player => player.score >= WIN_SCORE) || game.players[game.roundWinner] || game.players[0];
  $('#resultTitle').textContent = localPlayerIds.includes(winner.id) ? '你赢了！' : `${winner.name} 获胜`;
  $('#resultScores').textContent = game.players.map(player => `${player.id < 2 ? `P${player.id + 1}` : 'CPU'} · ${player.name}    ${player.score} / ${WIN_SCORE}`).join('\n');
  $('#playAgainButton').classList.toggle('hidden', mode === 'online' && onlineRole === 'guest');
  showPanel('#resultPanel');
}

function restartGame() {
  resultShown = false;
  hidePanels();
  keys.clear();
  accumulator = 0;
  if (mode === 'single' || mode === 'double') {
    game = createGame({ humanCount: mode === 'single' ? 1 : 2 });
  } else if (mode === 'online' && onlineRole === 'host') {
    game = createGame({ humanCount: 2 });
    pendingNetworkEvents = [];
    remoteInput = emptyInput();
    session?.send({ type: 'start', state: makeSnapshot(game) });
  }
}

function togglePause() {
  if (screen !== 'game' || resultShown) return;
  keys.clear();
  if (mode === 'online') {
    onlineMenuOpen = !onlineMenuOpen;
    if (onlineMenuOpen) {
      $('#pauseTitle').textContent = '比赛仍在继续';
      $('#restartButton').classList.add('hidden');
      showPanel('#pausePanel');
    } else hidePanels();
    return;
  }
  paused = !paused;
  if (paused) {
    $('#pauseTitle').textContent = '喘口气';
    $('#restartButton').classList.remove('hidden');
    showPanel('#pausePanel');
  } else hidePanels();
}

function advanceGame() {
  const now = performance.now();
  const dt = Math.min(1, (now - lastSimulation) / 1000);
  lastSimulation = now;
  const simulating = mode === 'demo' || mode === 'single' || mode === 'double' || (mode === 'online' && onlineRole === 'host');
  if (simulating && !paused) {
    accumulator += dt;
    let steps = 0;
    while (accumulator >= STEP && steps < 65) {
      stepGame(game, gameInputs(), STEP);
      if (game.events.length) {
        renderer.pushEvents(game.events, game);
        playEvents(game.events);
        if (mode === 'online' && onlineRole === 'host') pendingNetworkEvents.push(...game.events);
      }
      accumulator -= STEP;
      steps += 1;
    }
    if (mode === 'demo' && game.phase === 'matchOver') newAttractGame();
    if (mode === 'online' && onlineRole === 'host' && now - lastSnapshotSent >= 50) {
      session?.send({ type: 'snapshot', state: makeSnapshot(game), events: pendingNetworkEvents });
      pendingNetworkEvents = [];
      lastSnapshotSent = now;
    }
  } else if (mode === 'online' && onlineRole === 'guest' && now - lastInputSent >= 33) {
    session?.send({ type: 'input', input: keyboardInput(1) });
    lastInputSent = now;
  }
}

function frame(now) {
  requestAnimationFrame(frame);
  const renderState = mode === 'online' && onlineRole === 'guest' ? guestRenderState(now) : game;
  renderer.render(renderState, localPlayerIds, now);
  if (screen === 'game' && game.phase === 'matchOver') showResult();
}

for (const button of document.querySelectorAll('[data-start]')) button.addEventListener('click', () => startLocal(button.dataset.start));
for (const button of document.querySelectorAll('[data-menu]')) button.addEventListener('click', showMenu);
for (const button of document.querySelectorAll('[data-back]')) button.addEventListener('click', showMenu);
$('#onlineButton').addEventListener('click', () => showOnline());
$('#createRoomButton').addEventListener('click', createRoom);
$('#joinRoomButton').addEventListener('click', joinRoom);
$('#roomInput').addEventListener('input', event => { event.target.value = normalizeRoomCode(event.target.value); });
$('#roomInput').addEventListener('keydown', event => { if (event.key === 'Enter') joinRoom(); });
$('#cancelLobbyButton').addEventListener('click', cancelLobby);
$('#copyInviteButton').addEventListener('click', () => copyText(inviteLink(), '邀请链接已复制'));
$('#roomCodeButton').addEventListener('click', () => copyText($('#roomCodeButton').textContent.trim(), '房间码已复制'));
$('#resumeButton').addEventListener('click', togglePause);
$('#restartButton').addEventListener('click', restartGame);
$('#playAgainButton').addEventListener('click', restartGame);
$('#muteButton').addEventListener('click', () => {
  ensureAudio();
  muted = !muted;
  $('#muteButton').textContent = muted ? '声音 关' : '声音 开';
  $('#muteButton').setAttribute('aria-label', muted ? '打开声音' : '关闭声音');
});
$('#fullscreenButton').addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await $('#gameFrame').requestFullscreen();
  } catch {
    toast('当前浏览器无法进入全屏');
  }
});

document.addEventListener('pointerdown', ensureAudio, { once: true });
document.addEventListener('keydown', event => {
  if (event.code === 'Escape') {
    event.preventDefault();
    togglePause();
    return;
  }
  if (['KeyW', 'KeyE', 'KeyR', 'KeyI', 'KeyO', 'KeyP'].includes(event.code) && screen === 'game') {
    event.preventDefault();
    keys.add(event.code);
  }
});
document.addEventListener('keyup', event => {
  if (['KeyW', 'KeyE', 'KeyR', 'KeyI', 'KeyO', 'KeyP'].includes(event.code)) {
    if (screen === 'game') event.preventDefault();
    keys.delete(event.code);
  }
});
window.addEventListener('blur', () => keys.clear());
window.addEventListener('beforeunload', () => { session?.close(); });

const invitedRoom = normalizeRoomCode(new URLSearchParams(window.location.search).get('room'));
if (invitedRoom) {
  $('#roomInput').value = invitedRoom;
  showOnline('已填入邀请房间码，点击“加入”开始连接');
}
setInterval(advanceGame, 16);
requestAnimationFrame(frame);
