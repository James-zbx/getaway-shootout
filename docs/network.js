const API_ROOT = '/functions/v1/app/api';

async function request(path, options = {}) {
  const response = await fetch(`${API_ROOT}${path}`, {
    credentials: 'same-origin',
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
    ...options
  });
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error('服务返回了无法识别的结果');
  }
  if (!response.ok || !result.ok) throw new Error(result.error || '连接服务暂时不可用');
  return result;
}

export function normalizeRoomCode(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z2-9]/g, '').replace(/[IO]/g, '').slice(0, 6);
}

export class OnlineSession {
  constructor({ onOpen, onMessage, onClose, onStatus }) {
    this.onOpen = onOpen;
    this.onMessage = onMessage;
    this.onClose = onClose;
    this.onStatus = onStatus;
    this.pc = null;
    this.channel = null;
    this.code = '';
    this.token = '';
    this.role = '';
    this.after = 0;
    this.pollTimer = 0;
    this.polling = false;
    this.closed = false;
    this.connected = false;
    this.remoteSet = false;
    this.pendingCandidates = [];
  }

  setupPeer() {
    this.pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    this.pc.onicecandidate = event => {
      this.sendSignal('ice', event.candidate ? event.candidate.toJSON() : null).catch(error => this.onStatus(error.message));
    };
    this.pc.onconnectionstatechange = () => {
      if (!this.pc) return;
      if (this.pc.connectionState === 'failed') {
        this.onStatus('连接失败，可能是当前网络限制了点对点连接');
        this.onClose(new Error('WebRTC connection failed'));
      }
      if (this.pc.connectionState === 'disconnected') this.onStatus('连接中断，正在尝试恢复');
    };
    this.pc.ondatachannel = event => {
      if (this.role === 'guest') this.bindChannel(event.channel);
    };
  }

  bindChannel(channel) {
    this.channel = channel;
    channel.onopen = () => {
      this.connected = true;
      this.onStatus('已连接');
      this.onOpen();
    };
    channel.onmessage = event => {
      if (typeof event.data !== 'string' || event.data.length > 262144) return;
      try {
        this.onMessage(JSON.parse(event.data));
      } catch {
        this.onStatus('收到无效的对局数据');
      }
    };
    channel.onclose = () => {
      const wasConnected = this.connected;
      this.connected = false;
      if (wasConnected && !this.closed) this.onClose(new Error('对手已断开连接'));
    };
    channel.onerror = () => this.onStatus('对局连接出现异常');
  }

  async createRoom() {
    this.closed = false;
    this.role = 'host';
    const room = await request('/rooms', { method: 'POST', body: '{}' });
    this.code = room.code;
    this.token = room.token;
    this.setupPeer();
    this.bindChannel(this.pc.createDataChannel('bounce-breakout', { ordered: true }));
    await this.pc.setLocalDescription(await this.pc.createOffer());
    await this.sendSignal('offer', this.pc.localDescription);
    this.poll();
    return this.code;
  }

  async joinRoom(code) {
    this.closed = false;
    this.role = 'guest';
    const room = await request(`/rooms/${encodeURIComponent(code)}/join`, { method: 'POST', body: '{}' });
    this.code = room.code;
    this.token = room.token;
    this.setupPeer();
    this.poll();
  }

  async sendSignal(kind, payload) {
    if (this.closed) return;
    await request(`/rooms/${encodeURIComponent(this.code)}/signals`, {
      method: 'POST',
      body: JSON.stringify({ token: this.token, kind, payload })
    });
  }

  async handleSignal(signal) {
    if (signal.kind === 'bye') {
      this.onClose(new Error('对手已离开房间'));
      return;
    }
    if (signal.kind === 'ice') {
      if (!this.remoteSet) {
        this.pendingCandidates.push(signal.payload);
        return;
      }
      if (signal.payload) await this.pc.addIceCandidate(signal.payload);
      return;
    }
    if (signal.kind === 'offer' && this.role === 'guest' && !this.remoteSet) {
      await this.pc.setRemoteDescription(signal.payload);
      this.remoteSet = true;
      await this.pc.setLocalDescription(await this.pc.createAnswer());
      await this.sendSignal('answer', this.pc.localDescription);
    } else if (signal.kind === 'answer' && this.role === 'host' && !this.remoteSet) {
      await this.pc.setRemoteDescription(signal.payload);
      this.remoteSet = true;
    }
    if (this.remoteSet && this.pendingCandidates.length) {
      const pending = this.pendingCandidates.splice(0);
      for (const candidate of pending) if (candidate) await this.pc.addIceCandidate(candidate);
    }
  }

  async poll() {
    if (this.closed || this.polling) return;
    this.polling = true;
    try {
      while (!this.closed) {
        const result = await request(`/rooms/${encodeURIComponent(this.code)}/signals?token=${encodeURIComponent(this.token)}&after=${this.after}`);
        for (const signal of result.signals) {
          this.after = Math.max(this.after, signal.id);
          await this.handleSignal(signal);
        }
        if (result.status === 'closed' && !this.connected) {
          this.onClose(new Error('房间已关闭'));
          break;
        }
        if (this.connected) break;
        await new Promise(resolve => {
          this.pollTimer = window.setTimeout(resolve, 750);
        });
      }
    } catch (error) {
      if (!this.closed) this.onStatus(error.message || '房间连接暂时中断');
      if (!this.connected && !this.closed) {
        await new Promise(resolve => {
          this.pollTimer = window.setTimeout(resolve, 1800);
        });
        this.polling = false;
        this.poll();
        return;
      }
    }
    this.polling = false;
  }

  send(message) {
    if (this.channel?.readyState === 'open') this.channel.send(JSON.stringify(message));
  }

  async close(notifyPeer = true) {
    if (this.closed) return;
    this.closed = true;
    window.clearTimeout(this.pollTimer);
    if (notifyPeer) {
      try {
        if (this.channel?.readyState === 'open') this.send({ type: 'bye' });
        else if (this.code && this.token) {
          await request(`/rooms/${encodeURIComponent(this.code)}/close`, {
            method: 'POST',
            body: JSON.stringify({ token: this.token }),
            keepalive: true
          });
        }
      } catch {}
    }
    if (this.channel) this.channel.close();
    if (this.pc) this.pc.close();
    this.channel = null;
    this.pc = null;
  }
}
