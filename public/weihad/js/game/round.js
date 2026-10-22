// Eine Spielrunde (oder die dekorative Menü-Szene im Modus 'attract'):
// Spawns & Schwierigkeit, Hitscan beim Wurf, Punkte/Combo/Strafen, Nachladen, Countdown, Events.
import { ROUND_TIME, MAX_AMMO, RELOAD_TIME, LAYER_SCALE } from '../config.js';
import { Particles, particleWarmTasks, uiRects } from './particles.js';
import { HatThrows, getHatSprite, HAT_FLIGHT } from './hats.js';
import { Flock, HAT_ON_HEAD, HAT_ON_PEEK, PEEK_HEAD, SPECIES, eagleWarmTasks, spriteRes, setSceneTint } from './eagles.js';
import { Gift, Sleigh, bonusWarmTasks } from './bonus.js';
import { Snow } from './weather.js';

const HIT_ORDER = ['near', 'mid', 'far', 'sky'];
const LAYER_POINTS = { near: 25, mid: 50, far: 100, sky: 100 };
const TOUCH_HIT = 1.35;
// Mindest-Trefferradius in CSS-Pixeln (kleine, ferne Ziele bleiben mit dem Finger treffbar)
const MIN_HIT_PX = { mouse: 9, touch: 17 };
const PENALTY = 50;
const RUSH = 10;
const POINTS = { gold: 500, peek: 250, gift: 150, followup: 25 };
const KIND = { stein: 'steinadler', weisskopf: 'weisskopfseeadler', gold: 'goldadler' };
const PENALTY_REASON = 'Tower: Bitte keine Mützen auf Flugzeuge!';

// Sprites, die im Hintergrund nach und nach vorgerendert werden (häufigste zuerst)
const WARM = [
  ['stein', 'far'], ['stein', 'mid'], ['weisskopf', 'far'], ['weisskopf', 'mid'], ['stein', 'near'],
  ['weisskopf', 'near'], ['gold', 'mid'], ['gold', 'far'],
];

const comboMultiplier = (c) => (c >= 10 ? 4 : c >= 6 ? 3 : c >= 3 ? 2 : 1);
// Nachschuss: höchstens 2 je Adler (beim Wurf reserviert) und nur, wenn er beim Landen der Mütze noch im Bild ist
const canFollowup = (e) => e.state === 'fall' && e.followups < 2 && e.y < 700 && e.y + e.vy * HAT_FLIGHT < 760;
// Bedienelemente über dem Canvas, die Taps abfangen (Halteleisten, Nachlade-Button, HUD-Knöpfe)
const CONTROLS = '.scr-hud button';

// Zuletzt benutzter Zeigertyp (Capture-Phase, also vor dem Schuss-Handler), damit die größeren
// Touch-Trefferzonen auch nach einem Wechsel Maus ↔ Finger mitten in der Runde stimmen
let lastPointerTouch = null;
try {
  globalThis.addEventListener?.('pointerdown', (e) => { lastPointerTouch = e.pointerType === 'touch'; }, { capture: true, passive: true });
} catch { /* ohne DOM (Tests) */ }
const round5 = (v) => Math.round(v / 5) * 5;

export class Round {
  constructor({ airport, view, traffic, rng, mode = 'play', onEvent = () => {}, isTouch = false }) {
    this.airport = airport;
    this.view = view;
    this.traffic = traffic;
    this.rng = rng;
    this.mode = mode === 'attract' ? 'attract' : 'play';
    this.onEvent = onEvent;
    this.isTouch = !!isTouch;
    setSceneTint(airport);

    this.fx = new Particles(view);
    this.hats = new HatThrows(view);
    this.flock = new Flock({ airport, view, rng, fx: this.fx });
    this.gifts = [];
    this.sleighs = [];
    this.snow = new Snow(view, airport.weather?.snow ?? 0);

    this.timeLeft = ROUND_TIME;
    this.elapsed = 0;
    this.score = 0;
    this.ammo = MAX_AMMO;
    this.reloadT = 0;
    this.shots = 0;
    this.hits = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.multiplier = 1;
    this.eaglesHit = 0;
    this.bonusCount = 0;
    this.penalties = 0;
    this._over = false;
    const peekLayers = [...new Set((airport.hideSpots || []).map((h) => h.layer).filter((l) => LAYER_SCALE[l]))];
    const feathers = Object.values(SPECIES).flatMap((p) => p.feathers);
    this.warmTasks = [
      ...particleWarmTasks(feathers),
      ...eagleWarmTasks(view, WARM.slice(0, 2), []),
      ...eagleWarmTasks(view, [], peekLayers),
      ...eagleWarmTasks(view, WARM.slice(2), []),
      ...bonusWarmTasks(view),
    ];
    this.warmIdx = 0;
    this.warmRes = spriteRes(view);
    this.lastCountdown = RUSH + 1;
    this.screechCooldown = 0;

    this.spawnT = 0.6;
    this.peekT = rng.range(5, 8);
    this.giftT = rng.range(9, 14);
    this.goldTimes = [rng.range(18, 34)];
    if (rng.chance(0.65)) this.goldTimes.push(rng.range(52, 72));
    this.sleighTimes = [rng.range(26, 42)];
    if (rng.chance(0.5)) this.sleighTimes.push(rng.range(60, 74));
    if (this.mode === 'attract') {
      this.spawnT = 1.2;
      this.peekT = rng.range(4, 9);
      this.sleighT = rng.range(8, 22);
    }

    // Gleich zu Beginn ein paar Adler im Bild
    const first = this.mode === 'play' ? ['far', 'mid', 'far'] : ['far', 'mid', 'near'];
    for (const layer of first) this._spawnEagle({ layer, inView: true, quiet: true });
    this._testHook();
  }

  // Nur für Screenshots/Tests: ?gptest=sleigh,gift,gold,peek,peekall,near erzwingt diese Spawns sofort,
  // ?gpshoot=1.2,1.25 wirft zu diesen Rundenzeiten (s) automatisch auf das wertvollste sichtbare Ziel
  _testHook() {
    let list = [];
    try {
      const q = new URLSearchParams(globalThis.location?.search || '');
      list = (q.get('gptest') || '').split(',');
      const shots = (q.get('gpshoot') || '').split(',').map(Number).filter((n) => n > 0);
      if (shots.length) this._autoShots = shots.sort((a, b) => a - b);
    } catch {
      return;
    }
    for (const k of list) {
      if (k === 'sleigh') {
        this._spawnSleigh(this.mode === 'play');
        const s = this.sleighs[this.sleighs.length - 1];
        s.x = this.view.viewW * (s.dir > 0 ? 0.25 : 0.75);
      } else if (k === 'gift') {
        this._spawnGift();
        this.gifts[this.gifts.length - 1].y = 240;
      } else if (k === 'gold') this.flock.spawn({ species: 'gold', layer: 'mid', path: 'wave', inView: true });
      else if (k === 'peek') this._spawnPeek();
      else if (k === 'peekall') for (const sp of this.airport.hideSpots || []) if (LAYER_SCALE[sp.layer]) this.flock.spawnPeeker('stein', [sp]);
      else if (k === 'near') this._spawnEagle({ layer: 'near', inView: true, quiet: true });
    }
  }

  get over() {
    return this._over;
  }

  _emit(type, data = {}) {
    if (this.mode === 'play') this.onEvent(type, data);
  }

  // --- Simulation ----------------------------------------------------------------

  update(dt) {
    if (!(dt > 0)) return;
    dt = Math.min(dt, 0.1);
    this.elapsed += dt;
    if (this.mode === 'play') {
      if (!this._over) {
        this.timeLeft = Math.max(0, this.timeLeft - dt);
        if (this.timeLeft <= RUSH && this.timeLeft > 0) {
          const s = Math.ceil(this.timeLeft);
          if (s < this.lastCountdown) {
            this.lastCountdown = s;
            this._emit('countdown', { seconds: s });
          }
        }
        if (this.reloadT > 0) {
          this.reloadT -= dt;
          if (this.reloadT <= 0) {
            this.reloadT = 0;
            this.ammo = MAX_AMMO;
            this._emit('reload-done');
          }
        }
        this._spawnPlay(dt);
        if (this.timeLeft <= 0) this._finish();
      }
    } else {
      this._spawnAttract(dt);
    }

    this.hats.update(dt);
    this.flock.update(dt);
    for (const g of this.gifts) g.update(dt);
    for (const s of this.sleighs) s.update(dt, this.fx);
    if (this.gifts.some((g) => g.dead)) this.gifts = this.gifts.filter((g) => !g.dead);
    if (this.sleighs.some((s) => s.dead)) this.sleighs = this.sleighs.filter((s) => !s.dead);
    this.fx.update(dt);
    this.snow.update(dt);
    // pro Frame eine Vorwärm-Aufgabe (Sprites werden nur einmal je Auflösung gemalt; nach Resize erneut)
    const res = spriteRes(this.view);
    if (res !== this.warmRes) {
      this.warmRes = res;
      this.warmIdx = 0;
    }
    if (this.warmIdx < this.warmTasks.length) this.warmTasks[this.warmIdx++]();
    if (this._autoShots?.length && this.elapsed >= this._autoShots[0]) {
      this._autoShots.shift();
      const v = this.view;
      const t = this.getTargets(v).find((p) => p.sx > 0 && p.sx < v.cssW && p.sy > 0 && p.sy < v.cssH);
      this.shoot(t ? t.sx : v.cssW * 0.5, t ? t.sy : v.cssH * 0.3);
    }
  }

  _finish() {
    if (this._over) return;
    // noch fliegende Mützen zählen noch
    this.hats.flush();
    this._over = true;
    this.reloadT = 0;
    this._emit('over', { stats: this.getStats() });
  }

  _difficulty() {
    return Math.min(1, this.elapsed / ROUND_TIME);
  }

  _spawnPlay(dt) {
    const rng = this.rng;
    const d = this._difficulty();
    const rush = this.timeLeft <= RUSH;
    this.screechCooldown -= dt;

    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      const maxAlive = rush ? 12 : Math.round(5 + 5 * d);
      if (this.flock.countActive() < maxAlive) this._spawnEagle({});
      const iv = rush ? 0.45 : 1.45 - 0.7 * d;
      this.spawnT = iv * rng.range(0.6, 1.4);
    }
    if (this.goldTimes.length && this.elapsed >= this.goldTimes[0]) {
      this.goldTimes.shift();
      this._spawnGold();
    }
    this.peekT -= dt;
    if (this.peekT <= 0) {
      this.peekT = rng.range(7, 12) * (rush ? 0.6 : 1);
      if (!this.flock.peekers.length) this._spawnPeek();
    }
    this.giftT -= dt;
    if (this.giftT <= 0) {
      this.giftT = rng.range(12, 19);
      this._spawnGift();
    }
    if (this.sleighTimes.length && this.elapsed >= this.sleighTimes[0]) {
      this.sleighTimes.shift();
      this._spawnSleigh(true);
    }
  }

  _spawnAttract(dt) {
    const rng = this.rng;
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      if (this.flock.countActive() < 4) this._spawnEagle({ quiet: true });
      this.spawnT = rng.range(1.6, 2.8);
    }
    this.peekT -= dt;
    if (this.peekT <= 0) {
      this.peekT = rng.range(9, 15);
      if (!this.flock.peekers.length) this._spawnPeek();
    }
    this.sleighT -= dt;
    if (this.sleighT <= 0) {
      this.sleighT = rng.range(35, 60);
      this._spawnSleigh(false);
    }
  }

  _spawnEagle({ layer, inView = false, quiet = false, species }) {
    const rng = this.rng;
    const d = this._difficulty();
    const rush = this.mode === 'play' && this.timeLeft <= RUSH;
    layer ||= rng.weighted({ far: 0.4, mid: 0.37, near: 0.23 });
    species ||= rng.chance(0.25 + 0.2 * d) ? 'weisskopf' : 'stein';
    let path;
    if (species === 'weisskopf') path = rng.weighted({ zigzag: 0.6, wave: 0.25, dive: 0.15 });
    else path = rng.weighted({ wave: 0.35, glide: 0.25, dive: 0.2, circle: 0.2 });
    const speedMul = this.mode === 'play' ? 1 + 0.35 * d + (rush ? 0.2 : 0) : 0.9;
    const fromEdge = !inView && rng.chance(0.25);
    const e = this.flock.spawn({ species, layer, path, speedMul, fromEdge, inView });
    if (!quiet && !fromEdge && this.screechCooldown <= 0 && (layer !== 'far' || rng.chance(0.3))) {
      this.screechCooldown = rng.range(2.5, 4.5);
      this._emit('screech', { pan: this._pan(layer, e.x) });
    }
    return e;
  }

  _spawnGold() {
    const layer = this.rng.chance(0.6) ? 'mid' : 'far';
    const e = this.flock.spawn({ species: 'gold', layer, path: 'wave', speedMul: 1 + 0.15 * this._difficulty() });
    e.amp *= 1.4;
    this._emit('special', { kind: 'goldadler', label: 'Goldadler!' });
    this._emit('screech', { pan: this._pan(layer, e.x) });
  }

  _spawnPeek() {
    const spots = (this.airport.hideSpots || []).filter((s) => s && LAYER_SCALE[s.layer] && s.layer !== 'sky');
    if (!spots.length) return;
    // nicht unter Halteleisten/Nachlade-Button auftauchen (dort wäre er verdeckt bzw. ein Tipp schwenkt/lädt nach)
    const blocked = uiRects(this.view, CONTROLS);
    const free = blocked.length ? spots.filter((s) => !this._peekBlocked(s, blocked)) : spots;
    const visible = free.filter((s) => this.view.isVisible(s.layer, s.x, -30));
    const pool = visible.length && this.rng.chance(0.8) ? visible : free.length ? free : spots;
    this.flock.spawnPeeker(this.rng.chance(0.5) ? 'stein' : 'weisskopf', pool);
  }

  // Liegt die Trefferzone eines Versteck-Adlers an dieser Kante (bei aktuellem Schwenk) unter einem Bedienelement?
  _peekBlocked(spot, rects) {
    const v = this.view;
    const s = LAYER_SCALE[spot.layer];
    const w = spot.w || 40;
    const [k, minR] = this._hitParams();
    // Kopfmitte wie in Flock.spawnPeeker/Peeker.hitDist; Radius + Streuung der Spawn-Position in CSS-px
    const c = v.toScreen(spot.layer, spot.x + w / 4, spot.y + (PEEK_HEAD.y + 4) * s);
    const pad = (Math.max(30 * s * k, minR) + 0.2 * w) * v.scale;
    return rects.some((r) => c.x > r.left - pad && c.x < r.right + pad && c.y > r.top - pad && c.y < r.bottom + pad);
  }

  _spawnGift() {
    const layer = this.rng.chance(0.7) ? 'mid' : 'near';
    const x = this.view.layerOffset(layer) + this.view.viewW * this.rng.range(0.15, 0.85);
    this.gifts.push(new Gift({ layer, x, y: -40, rng: this.rng, vy: 20 }));
  }

  _spawnSleigh(hittable) {
    this.sleighs.push(new Sleigh({ view: this.view, rng: this.rng, hittable }));
    if (hittable) this._emit('special', { kind: 'schlitten', label: 'Rentierschlitten!' });
  }

  _pan(layer, x) {
    return this.view.stereo(layer, Math.max(this.view.layerOffset(layer), Math.min(this.view.layerOffset(layer) + this.view.viewW, x)));
  }

  // --- Werfen ----------------------------------------------------------------------

  shoot(sx, sy) {
    if (this.mode !== 'play' || this._over) return;
    if (this.reloadT > 0) {
      // Klick-Feedback, solange das leere Magazin nachgeladen wird
      if (this.ammo <= 0) this._emit('empty', { sx, sy });
      return;
    }
    if (this.ammo <= 0) {
      this._emit('empty', { sx, sy });
      this.reload();
      return;
    }
    this.ammo--;
    this.shots++;
    this._emit('throw', { sx, sy });
    const tgt = this._pick(sx, sy);
    if (tgt) this._throwAt(tgt, sx, sy);
    else {
      const plane = this._pickPlane(sx, sy);
      if (plane) this._throwPenalty(plane, sx, sy);
      else this._throwMiss(sx, sy);
    }
  }

  _touch() {
    return lastPointerTouch ?? this.isTouch;
  }

  // Trefferzonen-Faktor und Mindestradius (Ebenen-Einheiten)
  _hitParams(view = this.view) {
    const touch = this._touch();
    return [touch ? TOUCH_HIT : 1, (touch ? MIN_HIT_PX.touch : MIN_HIT_PX.mouse) / Math.max(0.1, view.scale)];
  }

  // Vorderste Ebene zuerst; innerhalb der Ebene gewinnt das Ziel, das am mittigsten getroffen ist
  _pick(sx, sy) {
    const [k, minR] = this._hitParams();
    for (const L of HIT_ORDER) {
      const p = this.view.toLayer(L, sx, sy);
      let best = null;
      let bd = Infinity;
      const consider = (obj, type, d, bias = 0) => {
        if (d <= 1 && d + bias < bd) {
          bd = d + bias;
          best = { obj, type, L, x: p.x, y: p.y };
        }
      };
      for (const e of this.flock.eagles) {
        if (e.layer !== L) continue;
        if (e.state === 'fly') consider(e, 'eagle', e.hitDist(p.x, p.y, k, minR));
        else if (canFollowup(e)) consider(e, 'followup', e.hitDist(p.x, p.y, k, minR), 0.3);
      }
      for (const pk of this.flock.peekers) if (pk.layer === L && pk.alive) consider(pk, 'peek', pk.hitDist(p.x, p.y, k, minR));
      for (const g of this.gifts) if (g.layer === L && g.alive) consider(g, 'gift', g.hitDist(p.x, p.y, k, minR));
      if (L === 'sky') for (const s of this.sleighs) if (s.alive) consider(s, 'sleigh', s.hitDist(p.x, p.y, k, minR));
      if (best) return best;
    }
    return null;
  }

  _pickPlane(sx, sy) {
    if (!this.traffic?.hitTest) return null;
    for (const L of HIT_ORDER) {
      const p = this.view.toLayer(L, sx, sy);
      let r = null;
      try {
        r = this.traffic.hitTest(L, p.x, p.y);
      } catch {
        r = null;
      }
      if (r) return { L, x: p.x, y: p.y, hit: r };
    }
    return null;
  }

  _screen(L, x, y) {
    const s = this.view.toScreen(L, x, y);
    return { sx: s.x, sy: s.y };
  }

  _hatWorldSize(brimW) {
    return brimW / getHatSprite().brim;
  }

  _throwAt(tgt, sx, sy) {
    const v = this.view;
    const { obj, type, L } = tgt;
    let track, endW, endRot = -0.3, flip = false, onLand;
    if (type === 'eagle') {
      obj.startHit();
      track = () => obj.hatAnchor();
      endW = HAT_ON_HEAD.w * obj.s * v.scale;
      endRot = obj.hatRot();
      flip = obj.facing < 0;
      onLand = () => {
        obj.hatLanded(this.fx);
        const gold = obj.species === 'gold';
        const base = gold ? POINTS.gold : round5(LAYER_POINTS[L] * (obj.species === 'weisskopf' ? 1.5 : 1));
        const [hx, hy] = obj.hatAnchor();
        this._scoreHit({
          base, useMult: true, eagle: true, kind: KIND[obj.species], label: obj.pal.name, L, x: hx, y: hy - 54 * obj.s - 14,
          tag: gold ? 'Goldadler!' : null, color: gold ? '#ffd34d' : '#ffffff', big: gold,
        });
        if (gold) this.fx.sparkles(L, hx, hy, obj.s, 14, { color: '#ffe066' });
      };
    } else if (type === 'followup') {
      obj.followups++; // sofort reservieren: Schnellklicks während des Mützenflugs zählen sonst alle
      track = () => obj.hitCenter();
      endW = HAT_ON_HEAD.w * obj.s * v.scale;
      onLand = () => {
        const [cx, cy] = obj.hitCenter();
        obj.bump(this.fx);
        this.fx.fallingHat(L, cx, cy, this._hatWorldSize(HAT_ON_HEAD.w * obj.s), Math.random() * 6, obj.vx * 0.3, -180);
        this._scoreHit({ base: POINTS.followup, useMult: false, kind: 'nachschuss', label: 'Nachschuss', L, x: cx, y: cy - 62 * obj.s - 10, tag: 'Nachschuss' });
      };
    } else if (type === 'peek') {
      obj.startHit();
      track = () => obj.hatAnchor();
      endW = HAT_ON_PEEK.w * obj.s * v.scale;
      endRot = HAT_ON_PEEK.rot;
      onLand = () => {
        obj.hatLanded(this.fx);
        const [hx, hy] = obj.hatAnchor();
        this._scoreHit({
          base: POINTS.peek, useMult: true, eagle: true, kind: 'versteckadler', label: 'Versteck-Adler', L, x: hx, y: hy - 56 * obj.s - 14,
          tag: 'Erwischt!', color: '#9ff0ff',
        });
      };
    } else if (type === 'gift') {
      obj.startHit();
      track = () => [obj.x, obj.y];
      endW = 30 * obj.s * v.scale;
      onLand = () => {
        obj.pop(this.fx);
        this.fx.fallingHat(L, obj.x, obj.y, this._hatWorldSize(30 * obj.s), 0.4, 40, -220);
        this._scoreHit({ base: POINTS.gift, useMult: false, bonus: true, kind: 'geschenk', label: 'Geschenk', L, x: obj.x, y: obj.y - 50 * obj.s, tag: 'Geschenk!', color: '#8dffb0' });
      };
    } else if (type === 'sleigh') {
      obj.startHit();
      track = () => obj.center();
      endW = 34 * obj.s * v.scale;
      onLand = () => {
        const [cx, cy] = obj.center();
        this.fx.sparkles('sky', cx, cy, 0.8, 18, { color: '#fff0a0' });
        this.fx.confetti('sky', cx, cy, 0.7, 20);
        this._scoreHit({ base: 0, useMult: false, bonus: true, quietBonus: true, kind: 'schlitten', label: 'Rentierschlitten', L, x: cx, y: cy - 30, tag: null, text: 'Geschenkregen!', color: '#ffd34d', big: true });
        this._emit('special', { kind: 'schlitten-treffer', label: 'Geschenkregen!', ...this._screen('sky', cx, cy) });
        // drei Geschenke regnen in der mittleren Ebene herab
        const mx = this.view.toLayer('mid', this.view.toScreen('sky', cx, cy).x, 0).x;
        for (let i = 0; i < 3; i++) {
          this.gifts.push(new Gift({ layer: 'mid', x: mx + (i - 1) * 70, y: cy + 20 + i * 12, rng: this.rng, vx: (i - 1) * 50, vy: -40 }));
        }
      };
    }
    this.hats.throw({ sx, sy, L, x: tgt.x, y: tgt.y, track, endW, endRot, flip, onLand });
  }

  _throwMiss(sx, sy) {
    const v = this.view;
    const L = 'mid';
    const p = v.toLayer(L, sx, sy);
    const brim = HAT_ON_HEAD.w * LAYER_SCALE[L];
    this.hats.throw({
      sx, sy, L, x: p.x, y: p.y, endW: brim * v.scale, endRot: (Math.random() - 0.5) * 0.8,
      onLand: () => {
        this.fx.puff(L, p.x, p.y, 0.9, 8, { ov: true });
        this.fx.fallingHat(L, p.x, p.y, this._hatWorldSize(brim), (Math.random() - 0.5) * 0.8, 0, -90);
        this._resetCombo();
        this._emit('miss', { sx, sy });
      },
    });
  }

  _throwPenalty(plane, sx, sy) {
    const v = this.view;
    const { L, x, y } = plane;
    const brim = HAT_ON_HEAD.w * LAYER_SCALE[L === 'sky' ? 'far' : L];
    this.hats.throw({
      sx, sy, L, x, y, endW: brim * v.scale, endRot: 0.3,
      onLand: () => {
        this.penalties++;
        this.score = Math.max(0, this.score - PENALTY);
        this._resetCombo();
        this.fx.puff(L, x, y, 0.6, 5, { ov: true });
        // Flugzeug blinkt und trägt die Mütze fortan am Leitwerk; sonst (auch beim Hubschrauber) fällt sie herunter
        let stuck = false, heli = false;
        try {
          heli = this.traffic?.getAircraft?.(plane.hit.id)?.kind === 'heli';
          stuck = !!this.traffic?.markHit?.(plane.hit.id, { hat: !heli }) && !heli;
        } catch { stuck = false; }
        if (!stuck) this.fx.fallingHat(L, x, y, this._hatWorldSize(brim), 0.3, (Math.random() - 0.5) * 200, -320);
        this.fx.popup(L, x, y - 20, `−${PENALTY}`, { color: '#ff5d5d', sub: heli ? 'Hubschrauber!' : 'Flugzeug!', subColor: '#ffd0d0' });
        this._emit('penalty', { points: -PENALTY, sx, sy, reason: PENALTY_REASON });
      },
    });
  }

  _resetCombo() {
    this.combo = 0;
    this.multiplier = 1;
  }

  _scoreHit({ base, useMult, eagle = false, bonus = false, quietBonus = false, kind, label, L, x, y, tag = null, color = '#ffffff', big = false, text = null }) {
    this.hits++;
    this.combo++;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    const m = comboMultiplier(this.combo);
    const up = m > this.multiplier;
    this.multiplier = m;
    const points = useMult ? base * m : base;
    this.score += points;
    if (eagle) this.eaglesHit++;
    const { sx, sy } = this._screen(L, x, y);
    if (bonus) {
      this.bonusCount++;
      if (!quietBonus) this._emit('bonus', { points, kind, label, sx, sy });
    } else {
      this._emit('hit', { points, kind, label, layer: L, sx, sy, multiplier: useMult ? m : 1 });
    }
    if (up) this._emit('combo', { multiplier: m });
    let sub = tag;
    if (useMult && m > 1) sub = (tag ? tag + ' ' : '') + `×${m}`;
    this.fx.popup(L, x, y, text || `+${points}`, { color, sub, big: big || (up && m > 1) });
  }

  reload() {
    if (this.mode !== 'play' || this._over) return;
    if (this.reloadT > 0 || this.ammo >= MAX_AMMO) return;
    this.reloadT = RELOAD_TIME;
    this._emit('reload-start');
  }

  // --- Abfragen ----------------------------------------------------------------------

  getHud() {
    return {
      score: this.score,
      timeLeft: this.timeLeft,
      ammo: this.ammo,
      maxAmmo: MAX_AMMO,
      reloading: this.reloadT > 0 ? Math.max(0.001, 1 - this.reloadT / RELOAD_TIME) : false,
      combo: this.combo,
      multiplier: this.multiplier,
    };
  }

  getStats() {
    return {
      score: this.score,
      hits: this.hits,
      shots: this.shots,
      accuracy: this.shots ? this.hits / this.shots : 0,
      bestCombo: this.bestCombo,
      airport: this.airport.id,
      eagles: this.eaglesHit,
      bonuses: this.bonusCount,
      penalties: this.penalties,
    };
  }

  // Bildschirmpositionen schießbarer Ziele (für den Test-Bot), wertvollste zuerst
  getTargets(view = this.view) {
    const out = [];
    const add = (L, x, y, prio) => {
      const s = view.toScreen(L, x, y);
      out.push({ sx: s.x, sy: s.y, prio });
    };
    for (const g of this.gifts) if (g.alive) add(g.layer, g.x, g.y - 34 * g.s, 0);
    for (const s of this.sleighs) if (s.alive) add('sky', ...s.center(), 0);
    for (const p of this.flock.peekers) if (p.alive) add(p.layer, ...p.headPos(), 1);
    for (const e of this.flock.eagles) {
      if (e.state === 'fly') add(e.layer, ...e.hitCenter(), e.species === 'gold' ? 1 : e.layer === 'far' ? 2 : 3);
      else if (canFollowup(e) && e.y < 650) add(e.layer, ...e.hitCenter(), 5);
    }
    out.sort((a, b) => a.prio - b.prio);
    return out;
  }

  // --- Zeichnen -------------------------------------------------------------------------

  // Zeichenzustand absichern, falls ein anderes Modul globalAlpha o. Ä. nicht zurückgesetzt hat
  _clean(ctx) {
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.filter = 'none';
  }

  drawLayer(ctx, L, view = this.view) {
    ctx.save();
    this._clean(ctx);
    if (L === 'sky') for (const s of this.sleighs) s.draw(ctx, view);
    this.flock.drawLayer(ctx, L);
    for (const g of this.gifts) if (g.layer === L) g.draw(ctx, view);
    this.fx.drawLayer(ctx, L);
    ctx.restore();
  }

  drawOverlay(ctx) {
    ctx.save();
    this._clean(ctx);
    this.snow.draw(ctx);
    this.fx.drawOverlay(ctx);
    this.hats.drawOverlay(ctx);
    this.fx.drawPopups(ctx, this.mode === 'play' ? this.multiplier : 0);
    ctx.restore();
  }

  debugDraw(ctx, L, view = this.view) {
    const [k, minR] = this._hitParams(view);
    ctx.save();
    ctx.lineWidth = 1.5 / view.scale;
    ctx.strokeStyle = 'rgba(80,255,140,0.9)';
    for (const e of this.flock.eagles) if (e.layer === L) e.debugDraw(ctx, k, minR);
    for (const p of this.flock.peekers) if (p.layer === L) p.debugDraw(ctx, k, minR);
    for (const g of this.gifts) if (g.layer === L) g.debugDraw(ctx, k, minR);
    if (L === 'sky') for (const s of this.sleighs) s.debugDraw(ctx, k, minR);
    if (L !== 'sky') {
      const off = view.layerOffset(L);
      const z = this.flock.zone(L);
      ctx.setLineDash([8 / view.scale, 6 / view.scale]);
      ctx.strokeStyle = L === 'far' ? 'rgba(120,180,255,0.6)' : L === 'mid' ? 'rgba(255,220,120,0.6)' : 'rgba(255,140,200,0.6)';
      ctx.beginPath();
      for (const y of z) {
        ctx.moveTo(off, y);
        ctx.lineTo(off + view.viewW, y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = 'rgba(255,60,60,0.95)';
      ctx.lineWidth = 3 / view.scale;
      for (const s of this.airport.hideSpots || []) {
        if (s.layer !== L) continue;
        const w = s.w || 40;
        ctx.globalAlpha = 0.35;
        ctx.beginPath();
        ctx.moveTo(s.x - w / 2, s.y);
        ctx.lineTo(s.x + w, s.y);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x + w / 2, s.y);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
}
