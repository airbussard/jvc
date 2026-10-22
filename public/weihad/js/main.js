import { Stage } from './core/stage.js';
import { View } from './core/view.js';
import { Input } from './core/input.js';
import { SceneRenderer } from './core/scene-renderer.js';
import { createRng, hashString } from './core/rng.js';
import { AIRPORTS, getAirport } from './airports/index.js';
import { TrafficSystem } from './traffic/traffic.js';
import { Round } from './game/round.js';
import { createUI } from './ui/ui.js';
import { audio } from './ui/audio.js';
import { LAYERS, PAN_SPEED, EDGE_PAN_ZONE } from './config.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');
const SEED = params.has('seed') ? Number(params.get('seed')) : (Math.random() * 1e9) | 0;
const FREEZE = params.has('freeze') ? Number(params.get('freeze')) : 0;
const BOT = params.get('bot') === '1';

// Gameplay-Events → Sound-Namen (siehe PLAN.md 3.3)
const EVENT_SOUNDS = {
  throw: 'throw', hit: 'hit', miss: 'miss', empty: 'empty', 'reload-start': 'reload', 'reload-done': 'reload-done',
  screech: 'screech', bonus: 'bonus', penalty: 'penalty', combo: 'combo', countdown: 'countdown',
  special: 'jingle', over: 'over',
};

// Fehler eines Subsystems sollen nie das ganze Spiel anhalten – nur einmal loggen
const reported = new Set();
function safe(name, fn) {
  try {
    return fn();
  } catch (err) {
    if (!reported.has(name)) {
      reported.add(name);
      console.error(`[weihad] Fehler in ${name}:`, err);
    }
    return undefined;
  }
}

class Game {
  constructor() {
    const container = document.getElementById('stage');
    const canvas = document.getElementById('game');
    this.canvas = canvas;
    this.stage = new Stage(container, canvas);
    this.view = new View(this.stage);
    this.input = new Input(canvas, { forceTouch: params.get('touch') === '1' });
    this.scene = new SceneRenderer(this.stage, this.view);
    this.rng = createRng(SEED);
    this.state = 'menu'; // 'menu' | 'playing' | 'paused' | 'over'
    this.airport = null;
    this.traffic = null;
    this.round = null;
    this.time = 0;
    this.frozen = false;
    this.taps = []; // Touch-Feedback
    this.fps = 60;
    this.frameAvg = 16;
    this.botTimer = 0;
    this.nextQualityCheck = 0;
    this.view.quality = this.input.isTouch ? 0.6 : 1;

    this.ui = createUI({
      onStart: (id) => this.startRound(id),
      onPreview: (id) => this.preview(id),
      onPause: () => this.pause(),
      onResume: () => this.resume(),
      onQuit: () => this.toMenu(),
      onRestart: () => this.startRound(this.airport?.id),
      onReload: () => this.state === 'playing' && this.round?.reload(),
      onPanHold: (dir) => { this.input.holdPan = dir; },
      onToggleMute: () => this.toggleMute(),
      onUserGesture: () => audio.unlock(),
    });
    this.ui.setAirports(AIRPORTS);
    this.ui.setTouchMode(this.input.isTouch);
    this.ui.setMuted(audio.muted);

    this._bindInput();

    let resizeTimer = 0;
    this.stage.onResize(() => {
      this.scene.rebuildSky();
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => this.scene.rebuild(), 250);
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'playing') this.pause();
    });

    // Start-Szene
    const startId = (params.get('airport') || '').toUpperCase();
    this.loadAirport(getAirport(startId) ? startId : this.rng.pick(AIRPORTS).id);
    if (params.has('pan')) this.view.pan = Math.max(0, Math.min(1, Number(params.get('pan'))));

    if (params.get('play') === '1') {
      this.startRound(this.airport.id);
      if (params.has('pan')) this.view.pan = Math.max(0, Math.min(1, Number(params.get('pan'))));
    } else {
      this.toMenu();
      const screen = params.get('screen');
      if (screen === 'over') this.ui.showGameOver(this._fakeStats());
      else if (screen) this.ui.show(screen);
    }

    if (FREEZE > 0) {
      // Für Screenshots: Simulation vorspulen, danach nur noch zeichnen
      const steps = Math.round(FREEZE * 60);
      for (let i = 0; i < steps; i++) this.update(1 / 60);
      this.frozen = true;
    }

    this.last = performance.now();
    requestAnimationFrame((t) => this.frame(t));
  }

  _bindInput() {
    const inp = this.input;
    inp.on('shoot', (sx, sy, type) => {
      if (this.state !== 'playing') return;
      if (type === 'touch') this.taps.push({ x: sx, y: sy, age: 0 });
      safe('round.shoot', () => this.round.shoot(sx, sy));
    });
    inp.on('reload', () => this.state === 'playing' && safe('round.reload', () => this.round.reload()));
    inp.on('pause', () => (this.state === 'playing' ? this.pause() : this.state === 'paused' && this.resume()));
    inp.on('mute', () => this.toggleMute());
    inp.on('gesture', () => audio.unlock());
    inp.on('touchmode', (isTouch) => {
      this.ui.setTouchMode(isTouch);
      this.view.quality = isTouch ? Math.min(this.view.quality, 0.6) : 1;
    });
  }

  loadAirport(id) {
    const airport = getAirport(id) || AIRPORTS[0];
    this.airport = airport;
    this.scene.setAirport(airport);
    safe('ui.setAirport', () => this.ui.setAirport?.(airport.id));
    const rng = createRng(SEED ^ hashString(airport.id));
    this.traffic = safe('traffic.new', () => new TrafficSystem(airport.traffic || {}, {
      rng,
      onSound: (name, opts) => this.state !== 'paused' && audio.play(name, opts),
    })) || null;
    safe('traffic.prewarm', () => this.traffic?.prewarm(45));
  }

  newRound(mode) {
    this.round = new Round({
      airport: this.airport,
      view: this.view,
      traffic: this.traffic,
      rng: createRng(SEED ^ 0xadd1e),
      mode,
      isTouch: this.input.isTouch,
      onEvent: (type, data) => this.onRoundEvent(type, data),
    });
  }

  onRoundEvent(type, data = {}) {
    safe('ui.event', () => this.ui.event(type, data));
    const sound = EVENT_SOUNDS[type];
    if (sound && this.round?.mode !== 'attract') {
      const pan = data.sx != null ? (data.sx / this.view.cssW) * 2 - 1 : (data.pan ?? 0);
      audio.play(sound, { ...data, pan });
    }
    if (type === 'over') this.gameOver();
  }

  toMenu() {
    this.state = 'menu';
    this.input.enabled = false;
    this.input.holdPan = 0;
    this.newRound('attract');
    this.ui.show('title');
    audio.startAmbience(this.airport.id);
  }

  preview(id) {
    if (this.state !== 'menu' || !id || id === this.airport?.id || !getAirport(id)) return;
    this.loadAirport(id);
    this.newRound('attract');
    audio.startAmbience(id);
  }

  startRound(id) {
    if (id === 'RND' || !getAirport(id)) id = this.rng.pick(AIRPORTS).id;
    if (id !== this.airport?.id) this.loadAirport(id);
    audio.unlock();
    this.view.pan = 0.5;
    this.newRound('play');
    this.state = 'playing';
    this.input.enabled = true;
    this.ui.show('hud');
    audio.startAmbience(id);
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.input.enabled = false;
    this.input.holdPan = 0;
    this.ui.show('pause');
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.input.enabled = true;
    this.ui.show('hud');
    this.last = performance.now();
  }

  gameOver() {
    if (this.state !== 'playing') return;
    this.state = 'over';
    this.input.enabled = false;
    this.input.holdPan = 0;
    const stats = safe('round.getStats', () => this.round.getStats()) || this._fakeStats();
    // kurze Pause, damit der letzte Treffer noch sichtbar fällt
    setTimeout(() => this.ui.showGameOver(stats), 900);
  }

  toggleMute() {
    audio.setMuted(!audio.muted);
    this.ui.setMuted(audio.muted);
  }

  _fakeStats() {
    return { score: 4275, hits: 38, shots: 51, accuracy: 38 / 51, bestCombo: 12, airport: this.airport.id, eagles: 34, bonuses: 4, penalties: 1 };
  }

  // --- Simulation -------------------------------------------------------------

  updatePan(dt) {
    const inp = this.input;
    let dir = 0;
    if (this.state === 'playing') {
      dir = inp.panDir;
      const p = inp.pointer;
      if (!dir && p.inside && p.type === 'mouse' && !inp.isTouch) {
        const fx = p.x / this.view.cssW;
        if (fx < EDGE_PAN_ZONE) dir = -(1 - fx / EDGE_PAN_ZONE);
        else if (fx > 1 - EDGE_PAN_ZONE) dir = (fx - (1 - EDGE_PAN_ZONE)) / EDGE_PAN_ZONE;
      }
      // Auf Touch etwas langsamer, damit man mit den Halteleisten fein zielen kann
      if (dir) this.view.panBy(dir * PAN_SPEED * (inp.isTouch ? 0.7 : 1) * dt);
    } else if (this.state === 'menu' && !params.has('pan')) {
      // Langsamer Kameraschwenk im Hintergrund der Menüs
      this.view.pan = 0.5 + 0.48 * Math.sin(this.time * 0.035);
    }
  }

  update(dt) {
    this.time += dt;
    this.view.t = this.time;
    if (this.state === 'paused') return;
    this.updatePan(dt);
    safe('traffic.update', () => this.traffic?.update(dt, this.view));
    safe('round.update', () => this.round?.update(dt));
    if (this.state === 'playing') {
      safe('ui.updateHud', () => this.ui.updateHud(this.round.getHud()));
      if (BOT) this.runBot(dt);
    }
    for (const tp of this.taps) tp.age += dt;
    this.taps = this.taps.filter((tp) => tp.age < 0.35);
  }

  // Test-Bot: schießt regelmäßig auf sichtbare Ziele
  runBot(dt) {
    this.botTimer -= dt;
    if (this.botTimer > 0) return;
    this.botTimer = 0.4;
    const hud = this.round.getHud();
    if (hud.ammo <= 0) { this.round.reload(); return; }
    const targets = safe('round.getTargets', () => this.round.getTargets?.(this.view)) || [];
    const visible = targets.filter((t) => t.sx > 0 && t.sx < this.view.cssW && t.sy > 0 && t.sy < this.view.cssH);
    if (visible.length) {
      const t = visible[0];
      this.round.shoot(t.sx, t.sy);
    } else {
      this.view.panBy((this.time % 20 < 10 ? 1 : -1) * 300);
    }
  }

  // --- Rendering --------------------------------------------------------------

  render() {
    const { ctx } = this.stage;
    const v = this.view;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#05070d';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    for (const id of LAYERS) {
      v.apply(ctx, id);
      this.scene.drawStatic(ctx, id);
      if (this.airport.drawDynamic) {
        safe(`airport.drawDynamic.${id}`, () => this.airport.drawDynamic(ctx, id, { t: v.t, view: v }));
        v.apply(ctx, id);
      }
      if (this.traffic) {
        safe(`traffic.draw.${id}`, () => this.traffic.draw(ctx, id, v));
        v.apply(ctx, id);
      }
      safe(`round.drawLayer.${id}`, () => this.round.drawLayer(ctx, id, v));
      if (DEBUG) {
        safe(`round.debugDraw.${id}`, () => this.round.debugDraw?.(ctx, id, v));
        v.apply(ctx, id);
        safe(`traffic.debugDraw.${id}`, () => this.traffic?.debugDraw?.(ctx, id, v));
      }
    }

    v.applyScreen(ctx);
    safe('round.drawOverlay', () => this.round.drawOverlay(ctx, v));
    v.applyScreen(ctx);
    this.drawPointer(ctx);
    if (DEBUG) this.drawDebug(ctx);
  }

  drawPointer(ctx) {
    // Touch: kurzer Ring an der Tipp-Stelle
    for (const tp of this.taps) {
      const k = tp.age / 0.35;
      ctx.save();
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(tp.x, tp.y, 10 + k * 26, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    const p = this.input.pointer;
    if (this.state !== 'playing' || !p.inside || p.type !== 'mouse' || this.input.isTouch) return;
    const hud = safe('round.getHud', () => this.round.getHud()) || {};
    const empty = hud.ammo === 0 || hud.reloading;
    const r = 18;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.arc(0, 0, r + 1, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.strokeStyle = empty ? '#ff6b6b' : '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
    // Fadenkreuz-Striche
    ctx.beginPath();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      ctx.moveTo(dx * (r - 7), dy * (r - 7));
      ctx.lineTo(dx * (r + 7), dy * (r + 7));
    }
    ctx.stroke();
    // Stechpalmen-Beeren als weihnachtlicher Akzent
    ctx.fillStyle = '#e3263b';
    for (const a of [0.8, 2.35, 3.9, 5.5]) {
      ctx.beginPath();
      ctx.arc(Math.cos(a) * r, Math.sin(a) * r, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = empty ? '#ff6b6b' : '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawDebug(ctx) {
    ctx.save();
    ctx.font = '12px ui-monospace, monospace';
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(8, 8, 300, 56);
    ctx.fillStyle = '#9f9';
    ctx.fillText(`FPS ${this.fps.toFixed(0)}  state ${this.state}  ${this.airport.id}  seed ${SEED}`, 14, 24);
    ctx.fillText(`pan ${this.view.pan.toFixed(3)}  viewW ${this.view.viewW.toFixed(0)}  scale ${this.view.scale.toFixed(3)}`, 14, 40);
    ctx.fillText(`quality ${this.view.quality}  touch ${this.input.isTouch}`, 14, 56);
    ctx.restore();
  }

  frame(now) {
    const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    this.frameAvg += (dt * 1000 - this.frameAvg) * 0.05;
    this.fps = 1000 / Math.max(1, this.frameAvg);
    // Schwache Geräte: Partikel-Qualität reduzieren
    if (this.time > 3 && this.time > this.nextQualityCheck && this.frameAvg > 24 && this.view.quality > 0.35) {
      this.view.quality = Math.max(0.35, this.view.quality - 0.1);
      this.nextQualityCheck = this.time + 2;
    }
    if (!this.frozen) this.update(dt);
    this.render();
    requestAnimationFrame((t) => this.frame(t));
  }
}

window.weihad = new Game();
