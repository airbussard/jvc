// Verkehrssimulation: Landungen, Starts, Rollverkehr, Gates, Überflüge, Tiefflüge, Hubschrauber
import { LAYER_W } from '../config.js';
import { createRng } from '../core/rng.js';
import { AIRPORTS } from '../airports/index.js';
import { drawAircraft, drawHelicopter, prepareAircraft, DEFAULT_LIVERIES, HELI_LIVERIES, AIRCRAFT_TYPES } from './aircraft.js';
import { fx } from './fx.js';

const GROUND = ['far', 'mid', 'near'];
const DEF_SCALE = { sky: 0.07, far: 0.38, mid: 1, near: 2.2 };
const DEF_FLEET = { narrow: 5, wide: 3, jumbo: 1, a380: 0.5, regional: 2, prop: 1 };
const OVER_FLEET = { narrow: 4, wide: 4, jumbo: 1.5, a380: 1, regional: 0.6 };
const LOW_FLEET = { narrow: 3, wide: 3, jumbo: 2, a380: 1.2, regional: 1, prop: 0.5 };
const LAYER_VOL = { sky: 0.15, far: 0.35, mid: 0.7, near: 1 };
const SOUND_GAP = 2.5;
const PRIO = { 'jet-flyby': 4, 'jet-takeoff': 3, 'jet-landing': 2, heli: 1 };
const EMPTY = [];

// Startleistung je Typ (Welteinheiten/s bei planeScale 1); climb = Steigwinkel in Radiant
const PERF = {
  regional: { acc: 32, vr: 126, climb: 0.27 },
  prop: { acc: 28, vr: 110, climb: 0.25 },
  narrow: { acc: 30, vr: 138, climb: 0.26 },
  wide: { acc: 24, vr: 146, climb: 0.23 },
  jumbo: { acc: 22, vr: 150, climb: 0.21 },
  a380: { acc: 21, vr: 148, climb: 0.2 },
};
const TAXI_V = 34;
// Gleitpfad-Form: Anteil linear (Rest quadratisch, d. h. weit draußen etwas steiler)
const GLIDE_A = 0.75;

// Lichtstimmung je Flughafen, falls die Konfiguration nichts vorgibt
const MOODS = {
  FRA: { lights: true, tint: 'rgba(22,30,72,0.30)', spray: true, trailAlpha: 0.4 },
  JFK: { lights: true, tint: 'rgba(10,18,52,0.38)', spray: true, trailAlpha: 0.32 },
  DXB: { lights: true, tint: 'rgba(120,56,40,0.16)', spray: false, trailAlpha: 0.7, glow: 0.75 },
  SXM: { lights: false, tint: null, spray: false, trailAlpha: 0.85 },
  HND: { lights: true, tint: 'rgba(72,60,112,0.2)', spray: true, trailAlpha: 0.6, glow: 0.85 },
};
const NIGHT = { lights: true, tint: 'rgba(20,28,64,0.3)', spray: false, trailAlpha: 0.4 };
const DAY = { lights: false, tint: null, spray: false, trailAlpha: 0.85 };

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, k) => a + (b - a) * k;
const smooth = (u) => u * u * (3 - 2 * u);
const num = (v, d) => (Number.isFinite(v) ? v : d);
const byDepth = (a, b) => a.zy - b.zy || a.y - b.y;

function resolveMood(config) {
  let ap = null;
  try {
    ap = AIRPORTS.find((a) => a && a.traffic === config) || null;
  } catch {
    ap = null;
  }
  let base = ap && MOODS[ap.id];
  if (!base) {
    const lowFly = Array.isArray(config.runways) && config.runways.some((r) => r?.approach?.lowFlyLayer);
    base = lowFly ? DAY : NIGHT;
    if (ap?.weather?.snow > 0.2) base = { ...base, spray: true };
  }
  const m = { glow: 1, ...base };
  if (typeof config.lights === 'boolean') m.lights = config.lights;
  if (config.tint !== undefined) m.tint = config.tint || null;
  if (typeof config.spray === 'boolean') m.spray = config.spray;
  if (Number.isFinite(config.contrailAlpha)) m.trailAlpha = config.contrailAlpha;
  return m;
}

function validFleet(f) {
  if (!f || typeof f !== 'object') return null;
  const out = {};
  let any = false;
  for (const k of Object.keys(AIRCRAFT_TYPES)) {
    const w = Number(f[k]);
    if (w > 0) {
      out[k] = w;
      any = true;
    }
  }
  return any ? out : null;
}

function validLivery(l) {
  return l && typeof l === 'object' && typeof l.body === 'string';
}

// Konfiguration mit Standardwerten auffüllen (fehlende Felder dürfen nichts kaputt machen)
function normalize(c) {
  const planeScale = { ...DEF_SCALE };
  for (const k of Object.keys(DEF_SCALE)) {
    const v = Number(c.planeScale?.[k]);
    if (v > 0) planeScale[k] = v;
  }
  const rawRw = Array.isArray(c.runways) ? c.runways : [{}];
  const runways = rawRw.filter((r) => r && typeof r === 'object').map((r) => {
    const layer = GROUND.includes(r.layer) ? r.layer : 'mid';
    const W = LAYER_W[layer];
    let x1 = num(r.x1, W * 0.06);
    let x2 = num(r.x2, W * 0.94);
    if (x2 < x1) [x1, x2] = [x2, x1];
    if (x2 - x1 < 400) x2 = Math.min(W, x1 + 400);
    const ap = r.approach || {};
    return {
      id: String(r.id ?? ''), layer, y: num(r.y, 600), x1, x2,
      dir: (r.dir ?? -1) < 0 ? -1 : 1,
      use: ['arrivals', 'departures', 'mixed'].includes(r.use) ? r.use : 'mixed',
      arrRate: Math.max(0, num(r.arrivalsPerMin, 2.5)),
      depRate: Math.max(0, num(r.departuresPerMin, 2)),
      startY: num(ap.startY, 140),
      lowFly: GROUND.includes(ap.lowFlyLayer) ? ap.lowFlyLayer : null,
      lowFlyY: num(ap.lowFlyY, null),
      lowRate: Math.max(0.3, num(ap.lowFlyPerMin, 2.4)),
    };
  });
  const taxiways = (Array.isArray(c.taxiways)
    ? c.taxiways.filter((t) => t && Number.isFinite(t.y)).map((t) => ({ layer: GROUND.includes(t.layer) ? t.layer : 'mid', y: t.y }))
    : runways.map((r) => ({ layer: r.layer, y: r.y - 44 * planeScale[r.layer] })));
  const gates = (Array.isArray(c.gates) ? c.gates : [])
    .filter((g) => g && Number.isFinite(g.x))
    .map((g) => ({ layer: GROUND.includes(g.layer) ? g.layer : 'mid', x: g.x, y: num(g.y, 522), dir: g.dir < 0 ? -1 : 1, door: num(g.door, 48) }));
  const overflights = (Array.isArray(c.overflights) ? c.overflights : [{ layer: 'far', yMin: 40, yMax: 200, perMin: 4, contrails: true }])
    .filter((o) => o && typeof o === 'object')
    .map((o) => {
      const layer = o.layer === 'sky' || GROUND.includes(o.layer) ? o.layer : 'far';
      const yMin = num(o.yMin, 40);
      return { layer, yMin, yMax: Math.max(yMin, num(o.yMax, yMin + 140)), perMin: Math.max(0, num(o.perMin, 3)), contrails: o.contrails !== false };
    });
  const liveries = Array.isArray(c.liveries) && c.liveries.filter(validLivery).length ? c.liveries.filter(validLivery) : DEFAULT_LIVERIES.filter((l) => !l.rare);
  return {
    planeScale, runways, taxiways, gates, overflights, liveries,
    helicopters: Math.max(0, num(c.helicopters, 0.3)),
    fleet: validFleet(c.fleet) || DEF_FLEET,
    skyTraffic: Math.max(0, num(c.skyTraffic, 2.4)),
  };
}

export class TrafficSystem {
  constructor(config, { rng, onSound } = {}) {
    const c = config && typeof config === 'object' ? config : {};
    this.rng = rng || createRng(0x7a11c);
    this.onSound = typeof onSound === 'function' ? onSound : null;
    this.cfg = normalize(c);
    this.mood = resolveMood(c);
    this.xmas = DEFAULT_LIVERIES.find((l) => l.rare) || null;
    this.t = 0;
    this.frame = 0;
    this.sorted = -1;
    this.nextId = 1;
    this.planes = [];
    this.parts = [];
    this.lists = { sky: [], far: [], mid: [], near: [] };
    this.view = null;
    this.viewW = 1280;
    this.quality = 1;
    this.silent = false;
    this.lastSound = -99;
    this.pending = null;
    this.seeded = false;
    this.refY = {};
    for (const r of this.cfg.runways) if (this.refY[r.layer] == null) this.refY[r.layer] = r.y;
    this.gates = this.cfg.gates.map((g) => ({ ...g, plane: null, cool: 0 }));
    this.rws = this.cfg.runways.map((r) => this._initRunway(r));
    this.overs = this.cfg.overflights.map((o) => ({ ...o, next: o.perMin > 0 ? this.rng.range(1, 60 / o.perMin) : Infinity }));
    this.nextHeli = this.cfg.helicopters > 0 ? this.rng.range(10, 60 / this.cfg.helicopters) : Infinity;
    this.nextDot = this.cfg.skyTraffic > 0 ? this.rng.range(3, 14) : Infinity;
    const heliRw = this.rws.find((r) => r.layer === 'mid') || this.rws[0];
    this.heliLayer = heliRw ? heliRw.layer : 'mid';
  }

  _initRunway(r) {
    const s = this.cfg.planeScale[r.layer];
    const d = r.dir;
    const W = LAYER_W[r.layer];
    const start = d > 0 ? r.x1 : r.x2;
    const len = r.x2 - r.x1;
    const tws = this.cfg.taxiways.filter((t) => t.layer === r.layer && t.y < r.y - 4).sort((a, b) => b.y - a.y);
    const depLane = tws[0] ? tws[0].y : r.y - 44 * s;
    // Nur ein Rollweg: Ankünfte etwas weiter hinten, damit Gegenverkehr nicht ineinander fährt
    const arrLane = tws[1] ? tws[1].y : depLane - 9 * s;
    // Aufsetzen knapp hinter der Ebenenmitte: bei mittlerem Schwenk quert der Anflug den Bildschirm
    // schräg von oben, Aufsetzen und Ausrollen bleiben sichtbar (Ausrollen braucht ~700·s Piste)
    const tdWant = W / 2 + d * W * 0.085;
    const tdDist = clamp((tdWant - start) * d, len * 0.25, Math.max(len * 0.25, len - 700 * s));
    const rw = {
      ...r, s, d, W, start, len, depLane, arrLane,
      end: d > 0 ? r.x2 : r.x1,
      td: start + d * tdDist,
      // Rollhalt an einer Kreuzung kurz vor dem Bildrand (bei mittlerem Schwenk): Startlauf und Rotation sichtbar
      hpX: start + d * clamp((W / 2 - d * W * 0.26 - start) * d, 75 * s, Math.max(75 * s, len - 900 * s)),
      occupant: null,
      lastRelease: -9,
      allowArr: r.use !== 'departures' && r.arrRate > 0,
      allowDep: r.use !== 'arrivals' && r.depRate > 0,
      nextArr: this.rng.range(1, 6),
      nextDep: this.rng.range(2, 10),
      low: r.lowFly ? { layer: r.lowFly, next: this.rng.range(3, 10), rate: r.lowRate, y: r.lowFlyY } : null,
    };
    // Anflug: Start außerhalb der Ebene, Höhe am Ebenenrand ≈ startY, fast gerader Gleitpfad mit Abfangbogen
    const edge = d > 0 ? 0 : W;
    rw.x0 = edge - d * 240 * s;
    rw.D = Math.max(200 * s, Math.abs(rw.td - rw.x0));
    const ue = clamp(Math.abs(rw.td - edge) / rw.D, 0.05, 1);
    const ge = GLIDE_A * ue + (1 - GLIDE_A) * ue * ue;
    // Steigung am Ebenenrand höchstens ~32°, sonst wirkt der Anflug wie ein Sturzflug
    const hMax = (0.62 * rw.D) / (GLIDE_A + 2 * (1 - GLIDE_A) * ue);
    rw.H = clamp(Math.min((r.y - r.startY) / ge, hMax), 80 * s, r.y + 220);
    rw.F = Math.min(0.25, (75 * s) / rw.D);
    rw.flightT = rw.D / (145 * s);
    rw.preT = 4;
    return rw;
  }

  // --- Öffentliche API ---------------------------------------------------------

  prewarm(seconds = 30) {
    this.silent = true;
    if (!this.seeded) this._seed();
    const dt = 0.1;
    const n = Math.max(0, Math.round(num(seconds, 0) / dt));
    for (let i = 0; i < n; i++) this.update(dt);
    this._ensureLively();
    this.silent = false;
  }

  update(dt, view) {
    if (!(dt > 0)) return;
    dt = Math.min(dt, 0.25);
    if (view) {
      this.view = view;
      this.viewW = view.viewW || this.viewW;
      this.quality = view.quality ?? 1;
    }
    if (!this.seeded) this._seed();
    this.t += dt;
    this.frame++;
    for (const rw of this.rws) this._updateRunway(rw, dt);
    this._updateAmbient(dt);
    for (const p of this.planes) this._updatePlane(p, dt);
    let j = 0;
    for (const p of this.planes) {
      if (p.dead) this._retire(p);
      else this.planes[j++] = p;
    }
    this.planes.length = j;
    this._updateParticles(dt);
    if (view) this._warmSprites(view);
    if (this.pending && this.t - this.lastSound >= SOUND_GAP) {
      if (this.t <= this.pending.until) this._emit(this.pending);
      this.pending = null;
    }
  }

  draw(ctx, layerId, view) {
    if (view) this.view = view;
    const v = this.view;
    const list = this._layerList(layerId);
    if (!list.length && !this.parts.length) return;
    const res = v ? v.scale * v.dpr : 1;
    const F = fx();
    const off = v ? v.layerOffset(layerId) : 0;
    const vw = v ? v.viewW : 1e9;
    ctx.save();
    for (const p of list) if (p.contrail && !p.hidden) this._drawTrail(ctx, p, F, off, vw);
    for (const p of list) if (!p.hidden) this._drawGround(ctx, p, F, v);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    for (const p of list) {
      if (p.hidden) continue;
      if (v && !v.isVisible(layerId, p.x, p.margin || 200)) continue;
      this._drawPlane(ctx, p, res);
    }
    this._drawParticles(ctx, layerId, F, v);
    ctx.restore();
  }

  hitTest(layerId, x, y) {
    const list = this._layerList(layerId);
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      if (!p.hidden && this._hit(p, x, y)) return { kind: 'aircraft', id: p.id };
    }
    return null;
  }

  // Optional für das Gameplay: Treffer-Reaktion (kurzes Aufblitzen + Mütze auf dem Leitwerk)
  markHit(id, { hat = true } = {}) {
    const p = this.planes.find((q) => q.id === id);
    if (!p) return false;
    p.hitT = this.t;
    if (hat && p.kind !== 'heli') p.hat = true;
    return true;
  }

  getAircraft(id) {
    const p = this.planes.find((q) => q.id === id);
    return p ? { id: p.id, layer: p.layer, x: p.x, y: p.y, type: p.type, kind: p.kind, state: p.state } : null;
  }

  debugDraw(ctx, layerId) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,80,200,0.9)';
    ctx.lineWidth = 1;
    for (const p of this._layerList(layerId)) {
      if (p.hidden) continue;
      const b = this._box(p);
      ctx.strokeRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
    }
    ctx.restore();
  }

  // --- Erzeugen -----------------------------------------------------------------

  _plane(kind, layer, type) {
    return {
      id: this.nextId++, kind, layer, type,
      livery: kind === 'heli' ? this.rng.pick(HELI_LIVERIES) : this._pickLivery(),
      x: 0, y: 0, zy: 0, groundY: null, s: this.cfg.planeScale[layer] ?? 1, k: 1,
      dir: 1, face: 1, mdir: 0, pitch: 0, gear: 1, v: 0, gam: 0,
      state: '', st: 0, u: 0, landing: 0, beacon: true, strobe: false, throttle: 0.3,
      route: null, man: null, rw: null, gate: null, role: '',
      phase: this.rng.range(0, 5), hat: false, hitT: -99, trail: 0, trailMax: 0, contrail: false,
      hidden: false, dead: false, sounded: false, tug: 0, block: 0, ghost: 0, margin: 200,
    };
  }

  _pickLivery() {
    if (this.xmas && this.rng.chance(0.045)) return this.xmas;
    return this.rng.pick(this.cfg.liveries);
  }

  _pickType(weights = this.cfg.fleet) {
    return this.rng.weighted(weights) || 'narrow';
  }

  _fleetMix(base) {
    // Nur Typen, die der Flughafen überhaupt kennt
    const out = {};
    for (const k of Object.keys(base)) if ((this.cfg.fleet[k] || 0) > 0) out[k] = base[k];
    return Object.keys(out).length ? out : this.cfg.fleet;
  }

  _margin(p) {
    const S = AIRCRAFT_TYPES[p.type] || AIRCRAFT_TYPES.narrow;
    const len = (S.nose - S.tail) * p.s * p.k;
    p.margin = len * 0.6 + (this.mood.lights && p.landing > 0.5 ? len * 1.6 : 30);
  }

  _seed() {
    this.seeded = true;
    for (const g of this.gates) if (this.rng.chance(0.75)) this._parkNew(g, this.rng.range(2, 50));
    for (const o of this.overs) {
      const n = Math.max(o.perMin > 0 ? 1 : 0, Math.round(o.perMin * 0.45));
      for (let i = 0; i < n; i++) this._spawnOver(o, this.rng.range(0.1, 0.9));
    }
    for (let i = 0; i < 2 && this.cfg.skyTraffic > 0; i++) this._spawnDot(this.rng.range(0.15, 0.85));
  }

  _ensureLively() {
    for (const rw of this.rws) {
      if (!rw.allowArr || rw.occupant) continue;
      const any = this.planes.some((p) => p.rw === rw && (p.state === 'approach' || p.state === 'inbound'));
      if (!any) this._spawnArrival(rw, 0.6);
    }
    const busy = this.planes.some((p) => p.kind === 'jet' && ['taxi', 'push', 'hold', 'lineup', 'lined'].includes(p.state));
    const rw = this.rws.find((r) => r.allowDep);
    if (!busy && rw) this._startDeparture(rw, true);
  }

  _parkNew(g, dwell) {
    for (let i = 0; i < 6; i++) {
      const type = this._pickType();
      if (!this._gateFits(g, type)) continue;
      const p = this._plane('jet', g.layer, type);
      p.state = 'parked';
      p.face = p.dir = g.dir;
      p.k = this._depthK(g.layer, g.y);
      p.x = this._gateAnchor(p, g);
      p.y = p.zy = p.groundY = g.y;
      p.dwell = dwell;
      p.beacon = false;
      p.throttle = 0;
      p.gate = g;
      g.plane = p;
      this._margin(p);
      this.planes.push(p);
      return p;
    }
    return null;
  }

  _spawnArrival(rw, u0 = 1) {
    const p = this._plane('jet', rw.layer, this._pickType());
    p.rw = rw;
    p.role = 'arr';
    p.face = p.dir = rw.d;
    p.u = u0;
    p.state = u0 >= 1 ? 'inbound' : 'approach';
    p.st = u0 >= 1 ? rw.preT : 0;
    p.hidden = u0 >= 1;
    p.strobe = true;
    p.landing = 1;
    p.throttle = 0.7;
    this._approachPose(p, rw);
    this.planes.push(p);
    return p;
  }

  _spawnDeparture(rw) {
    // Kommt von einer Außenposition jenseits des Ebenenrands
    const side = rw.hpX < rw.W / 2 ? -1 : 1;
    const p = this._plane('jet', rw.layer, this._pickType());
    p.rw = rw;
    p.role = 'dep';
    p.x = side < 0 ? -150 * rw.s : rw.W + 150 * rw.s;
    p.y = p.zy = p.groundY = rw.depLane;
    p.face = p.dir = -side;
    p.state = 'taxi';
    p.v = TAXI_V * rw.s;
    p.route = [{ x: rw.hpX, y: rw.depLane, hold: true }];
    p.k = this._depthK(rw.layer, p.y);
    p.landing = 0.35;
    this.planes.push(p);
    return p;
  }

  _spawnOver(o, prog = 0) {
    const W = o.layer === 'sky' ? this.viewW : LAYER_W[o.layer];
    const p = this._plane('over', o.layer, this._pickType(this._fleetMix(OVER_FLEET)));
    const base = this.cfg.planeScale[o.layer] ?? 0.4;
    p.s = base * (o.contrails ? this.rng.range(0.3, 0.42) : this.rng.range(0.42, 0.58));
    p.dir = p.face = this.rng.sign();
    p.v = this.rng.range(42, 70) * (o.contrails ? 1 : 1.5) * (o.layer === 'far' ? 1 : 1.25);
    p.y = this.rng.range(o.yMin, o.yMax);
    p.zy = -2000 + p.y;
    const span = W + 400;
    p.x = p.dir > 0 ? -200 + prog * span : W + 200 - prog * span;
    p.contrail = o.contrails;
    p.trail = prog * span;
    p.trailMax = this.rng.range(380, 760);
    p.gear = 0;
    p.strobe = true;
    p.state = 'cruise';
    p.W = W;
    this._margin(p);
    this.planes.push(p);
  }

  _spawnDot(prog = 0) {
    const W = this.viewW;
    const p = this._plane('dot', 'sky', this._pickType(this._fleetMix(OVER_FLEET)));
    p.s = this.rng.range(0.045, 0.07);
    p.dir = p.face = this.rng.sign();
    p.v = this.rng.range(10, 22);
    p.y = this.rng.range(25, 170);
    p.zy = p.y;
    const span = W + 100;
    p.x = p.dir > 0 ? -50 + prog * span : W + 50 - prog * span;
    p.contrail = true;
    p.trail = prog * span;
    p.trailMax = this.rng.range(160, 420);
    p.gear = 0;
    p.strobe = true;
    p.state = 'cruise';
    p.margin = 20;
    this.planes.push(p);
  }

  _spawnHeli() {
    const L = this.heliLayer;
    const W = LAYER_W[L];
    const p = this._plane('heli', L, 'heli');
    p.s = (this.cfg.planeScale[L] ?? 1) * 0.95;
    p.dir = p.face = this.rng.sign();
    p.x = p.dir > 0 ? -90 * p.s : W + 90 * p.s;
    const ref = this.refY[L] ?? 600;
    p.y0 = ref - this.rng.range(230, 360) * (p.s > 0.6 ? 1 : 0.6);
    p.y = p.y0;
    p.zy = ref - 60;
    p.v = this.rng.range(55, 78) * p.s;
    p.state = 'heli';
    p.margin = 60 * p.s;
    this.planes.push(p);
  }

  _spawnLow(rw) {
    const L = rw.low.layer;
    const W = LAYER_W[L];
    const s = this.cfg.planeScale[L] ?? 2.2;
    const p = this._plane('low', L, this._pickType(this._fleetMix(LOW_FLEET)));
    p.s = s;
    p.dir = p.face = rw.d;
    p.xA = rw.d > 0 ? -260 * s : W + 260 * s;
    p.xB = rw.d > 0 ? W + 260 * s : -260 * s;
    p.x = p.xA;
    // Sinkflug durch die Ebene: hoch herein, flacht über dem Strand ab
    const yc = rw.low.y ?? 520;
    p.yA = yc - 160;
    p.yB = yc + 10;
    p.y = p.yA;
    p.v = this.rng.range(300, 350) * (s / 2.2);
    p.gear = 1;
    p.landing = 1;
    p.strobe = true;
    p.pitch = 0.055;
    p.throttle = 0.7;
    p.state = 'low';
    p.zy = 5000;
    p.groundY = 706;
    this._margin(p);
    this.planes.push(p);
  }

  // --- Pisten-Steuerung -------------------------------------------------------

  _interval(rate) {
    return rate > 0 ? (60 / rate) * this.rng.range(0.65, 1.35) : Infinity;
  }

  _updateRunway(rw, dt) {
    if (rw.allowArr) {
      rw.nextArr -= dt;
      if (rw.nextArr <= 0) {
        if (this._canSpawnArrival(rw)) {
          this._spawnArrival(rw);
          rw.nextArr = this._interval(rw.arrRate);
        } else rw.nextArr = 0.8;
      }
    }
    if (rw.allowDep) {
      rw.nextDep -= dt;
      if (rw.nextDep <= 0) rw.nextDep = this._startDeparture(rw) ? this._interval(rw.depRate) : 1.5;
      this._clearForTakeoff(rw);
    }
    if (rw.low) {
      rw.low.next -= dt;
      if (rw.low.next <= 0) {
        this._spawnLow(rw);
        rw.low.next = this._interval(rw.low.rate);
      }
    }
  }

  _eta(p) {
    const rw = p.rw;
    if (p.state === 'inbound') return p.st + rw.flightT;
    if (p.state === 'approach') return (p.u * rw.D) / Math.max(1, p.v);
    return 0;
  }

  _minArrivalEta(rw) {
    let m = Infinity;
    for (const p of this.planes) {
      if (p.rw === rw && (p.state === 'inbound' || p.state === 'approach')) m = Math.min(m, this._eta(p));
    }
    return m;
  }

  _rollTime(p) {
    const f = PERF[p.type] || PERF.narrow;
    return f.vr / f.acc + 1.2;
  }

  _depRemaining(p) {
    if (p.state === 'lineup' && p.man) return (1 - p.man.u) * p.man.dur + 1 + this._rollTime(p);
    if (p.state === 'lined') return p.st + this._rollTime(p);
    if (p.state === 'roll') {
      const f = PERF[p.type] || PERF.narrow;
      return Math.max(0, (f.vr * p.s - p.v) / (f.acc * p.s)) + 2.2;
    }
    return 1.5;
  }

  _holder(rw) {
    let h = null;
    for (const p of this.planes) if (p.rw === rw && p.state === 'hold' && (!h || p.holdT < h.holdT)) h = p;
    return h;
  }

  _canSpawnArrival(rw) {
    const eta = rw.preT + rw.flightT;
    let n = 0;
    for (const p of this.planes) {
      if (p.rw !== rw || p.role !== 'arr') continue;
      if (p.state === 'inbound' || p.state === 'approach') {
        n++;
        if (Math.abs(this._eta(p) - eta) < 15) return false;
      }
      if (p.state === 'rollout' && eta < 8) return false;
    }
    if (n >= 2) return false;
    const o = rw.occupant;
    if (o && o.role === 'dep' && this._depRemaining(o) > eta - 4) return false;
    // wartende Abflüge sollen nicht ewig stehen
    const h = this._holder(rw);
    if (h && this.t - h.holdT > 16) return false;
    return true;
  }

  _clearForTakeoff(rw) {
    if (rw.occupant || this.t - rw.lastRelease < 1.2) return;
    const h = this._holder(rw);
    if (!h) return;
    const need = (h.face === rw.d ? 2.6 : 3.4) + 0.9 + this._rollTime(h) + 2.8;
    if (this._minArrivalEta(rw) < need) return;
    this._lineup(h);
  }

  _startDeparture(rw, force = false) {
    let queued = 0;
    for (const p of this.planes) if (p.rw === rw && p.role === 'dep' && (p.state === 'taxi' || p.state === 'hold' || p.state === 'push')) queued++;
    if (queued >= 3 && !force) return false;
    const ready = this.gates.filter((g) => g.layer === rw.layer && g.plane && g.plane.state === 'parked' && g.plane.dwell <= 0 && this._pushClear(g));
    if (ready.length) {
      this._pushback(this.rng.pick(ready).plane, rw);
      return true;
    }
    // Gate-Flugzeug kurz vor Abflug vorziehen, sonst von einer Außenposition kommen lassen
    const soon = this.gates.find((g) => g.layer === rw.layer && g.plane && g.plane.state === 'parked' && g.plane.dwell < 15);
    if (soon && !force) {
      soon.plane.dwell = 0;
      return false;
    }
    this._spawnDeparture(rw);
    return true;
  }

  _pushClear(g) {
    const rw = this.rws.find((r) => r.layer === g.layer);
    if (!rw) return false;
    const x1 = g.plane.x - g.dir * 60 * g.plane.s;
    for (const p of this.planes) {
      if (p === g.plane || p.layer !== g.layer || p.kind !== 'jet') continue;
      if (p.state === 'push' && Math.abs(p.x - x1) < 420 * p.s) return false;
      if ((p.state === 'taxi' || p.state === 'hold') && Math.abs(p.y - rw.depLane) < 14 * p.s && Math.abs(p.x - x1) < 200 * p.s) return false;
    }
    return true;
  }

  _pushback(p, rw) {
    const g = p.gate;
    p.role = 'dep';
    p.rw = rw;
    const x1 = p.x - g.dir * 60 * p.s;
    const want = Math.sign(rw.hpX - x1) || -rw.d;
    p.state = 'push';
    p.man = { kind: 'push', u: 0, dur: 8.5, x0: p.x, y0: p.y, x1, y1: rw.depLane, f0: g.dir, rot: want !== g.dir };
    p.beacon = true;
    p.throttle = 0.15;
    p.tug = 1;
  }

  _lineup(p) {
    const rw = p.rw;
    rw.occupant = p;
    const uturn = p.face !== rw.d;
    const x1 = p.x + rw.d * (uturn ? 12 : 60) * rw.s;
    p.state = 'lineup';
    p.man = { kind: 'lineup', u: 0, dur: uturn ? 3.4 : 2.6, x0: p.x, y0: p.y, x1, y1: rw.y, f0: p.face, uturn, R: 26 * rw.s, away: false };
    p.strobe = true;
    p.landing = 0.45;
    p.throttle = 0.35;
  }

  _goAround(p) {
    p.state = 'goaround';
    p.gam = 0.03;
    p.st = 0;
    p.role = '';
  }

  _release(rw) {
    rw.occupant = null;
    rw.lastRelease = this.t;
  }

  _retire(p) {
    for (const rw of this.rws) if (rw.occupant === p) this._release(rw);
    if (p.gate && p.gate.plane === p) p.gate.plane = null;
  }

  // --- Gates ---------------------------------------------------------------------

  _depthK(layer, y) {
    return clamp(1 + (y - (this.refY[layer] ?? 600)) * 0.0008, 0.86, 1.1);
  }

  _frontDoor(type) {
    const S = AIRCRAFT_TYPES[type] || AIRCRAFT_TYPES.narrow;
    let x = -Infinity;
    for (const d of S.doors) if (!d.small && (d.y == null || d.y < 0.5)) x = Math.max(x, d.x);
    return Number.isFinite(x) ? x : S.nose * 0.75;
  }

  // Hauptfahrwerk so, dass die vordere Tür an der Fluggastbrücke (gate.x + dir·door) liegt
  _gateAnchor(p, g) {
    const k = this._depthK(g.layer, g.y);
    return g.x + g.dir * (g.door - this._frontDoor(p.type) * p.s * k);
  }

  _gateSpan(g, type) {
    const S = AIRCRAFT_TYPES[type] || AIRCRAFT_TYPES.narrow;
    const s = (this.cfg.planeScale[g.layer] ?? 1) * this._depthK(g.layer, g.y);
    const ax = g.x + g.dir * (g.door - this._frontDoor(type) * s);
    const a = ax + g.dir * S.nose * s;
    const b = ax + g.dir * S.tail * s;
    return [Math.min(a, b), Math.max(a, b)];
  }

  _gateFits(g, type) {
    const [a, b] = this._gateSpan(g, type);
    for (const o of this.gates) {
      if (o === g || o.layer !== g.layer || !o.plane || Math.abs(o.y - g.y) > 30) continue;
      const [c, d] = this._gateSpan(o, o.plane.type);
      if (a < d + 8 && c < b + 8) return false;
    }
    return true;
  }

  _pickGate(p) {
    const free = this.gates.filter((g) => g.layer === p.layer && !g.plane && this.t > g.cool && this._gateFits(g, p.type));
    if (!free.length) return null;
    free.sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x));
    return free[Math.min(free.length - 1, Math.floor(this.rng.next() * Math.min(3, free.length)))];
  }

  _gateRoute(p, g, lane) {
    const ax = this._gateAnchor(p, g);
    return [{ x: ax - g.dir * 95 * p.s, y: lane }, { x: ax, y: g.y, face: g.dir, park: true, v: 16 }];
  }

  _edgeX(layer, side, s) {
    return side > 0 ? LAYER_W[layer] + 220 * s : -220 * s;
  }

  // --- Bewegung ------------------------------------------------------------------

  _approachPose(p, rw) {
    const u = clamp(p.u, 0, 1);
    const alt = this._alt(rw, u);
    p.x = rw.td - rw.d * rw.D * u;
    p.y = rw.y - alt;
    p.zy = rw.y;
    p.groundY = rw.y;
    p.k = 0.62 + 0.38 * smooth(clamp((1 - u) / 0.65, 0, 1));
    const slope = (this._alt(rw, Math.min(1, u + 0.02)) - alt) / (rw.D * 0.02);
    const flare = u < rw.F ? 1 - u / rw.F : 0;
    p.pitch = clamp(0.05 - 0.32 * Math.max(0, slope - 0.18), -0.1, 0.05) + 0.055 * smooth(flare);
    p.gear = clamp((0.86 - u) / 0.14, 0, 1);
    p.v = lerp(128, 158, u) * rw.s;
    this._margin(p);
  }

  _alt(rw, u) {
    const g = (v) => GLIDE_A * v + (1 - GLIDE_A) * v * v;
    const F = rw.F;
    if (u >= F) return rw.H * g(u);
    // Abfangbogen (Hermite): flach aufsetzen
    const v = u / F;
    const a1 = rw.H * g(F);
    const m1 = rw.H * (GLIDE_A + 2 * (1 - GLIDE_A) * F) * F;
    const m0 = rw.H * 0.02 * F;
    const v2 = v * v;
    const v3 = v2 * v;
    return (v3 - 2 * v2 + v) * m0 + (-2 * v3 + 3 * v2) * a1 + (v3 - v2) * m1;
  }

  _updatePlane(p, dt) {
    if (p.ghost > 0) p.ghost -= dt;
    switch (p.state) {
      case 'parked':
        p.dwell -= dt;
        break;
      case 'inbound':
        p.st -= dt;
        if (p.st <= 0) {
          p.state = 'approach';
          p.hidden = false;
        }
        break;
      case 'approach': this._approach(p, dt); break;
      case 'rollout': this._rollout(p, dt); break;
      case 'push':
      case 'taxi':
      case 'lineup':
        if (p.man) this._runMan(p, dt);
        else if (p.state === 'taxi') this._taxi(p, dt);
        if (p.state === 'taxi' || p.state === 'push') this._groundPose(p);
        break;
      case 'hold':
        this._groundPose(p);
        break;
      case 'lined':
        p.st -= dt;
        if (p.st <= 0) {
          p.state = 'roll';
          p.v = 0;
          p.st = 0;
          p.landing = 1;
          p.throttle = 1;
          this._sound('jet-takeoff', p.layer, p.x);
        }
        break;
      case 'roll':
      case 'rotate':
        this._takeoff(p, dt);
        break;
      case 'climb':
      case 'goaround':
        this._climb(p, dt);
        break;
      case 'cruise': this._cruise(p, dt); break;
      case 'low': this._low(p, dt); break;
      case 'heli': this._heli(p, dt); break;
      default: break;
    }
  }

  _groundPose(p) {
    p.k = this._depthK(p.layer, p.y);
    p.zy = p.y;
    p.groundY = p.y;
    this._margin(p);
  }

  _approach(p, dt) {
    const rw = p.rw;
    p.u -= (p.v * dt) / rw.D;
    if (p.u <= 0) {
      p.u = 0;
      this._approachPose(p, rw);
      this._touchdown(p);
      return;
    }
    this._approachPose(p, rw);
    if (rw.occupant && rw.occupant !== p && this._eta(p) < 1.8) this._goAround(p);
  }

  _touchdown(p) {
    const rw = p.rw;
    p.state = 'rollout';
    p.st = 0;
    p.y = rw.y;
    p.k = 1;
    p.gear = 1;
    p.pitch0 = p.pitch;
    rw.occupant = p;
    const q = this.quality;
    const n = Math.round(4 + 6 * q);
    const S = AIRCRAFT_TYPES[p.type];
    for (let i = 0; i < n; i++) {
      const mx = S.main[i % S.main.length];
      this._puff(p.layer, p.x + rw.d * mx * p.s + this.rng.range(-3, 3) * p.s, rw.y - 2 * p.s,
        rw.d * this.rng.range(8, 34) * p.s, -this.rng.range(3, 10) * p.s,
        2.5 * p.s, this.rng.range(11, 20) * p.s, this.rng.range(1.1, 2), 0.7, 'smoke');
    }
    this._sound('jet-landing', p.layer, p.x);
  }

  _rollout(p, dt) {
    const rw = p.rw;
    const s = p.s;
    p.st += dt;
    p.pitch = p.pitch0 * Math.max(0, 1 - p.st / 1.5);
    if (p.st > 0.7) p.v = Math.max(TAXI_V * s, p.v - 17 * s * dt);
    p.x += rw.d * p.v * dt;
    p.landing = p.v > 70 * s ? 1 : 0.4;
    p.throttle = 0.5;
    this._margin(p);
    // Umkehrschub wirbelt Schnee auf
    if (this.mood.spray && p.st > 0.6 && p.st < 3.4 && this.rng.chance(dt * 14 * this.quality)) {
      const S = AIRCRAFT_TYPES[p.type];
      const e = S.engines[0];
      if (!e.rear && !e.prop) {
        this._puff(p.layer, p.x + rw.d * (e.x - e.len * 0.2) * s, rw.y - 3 * s, rw.d * this.rng.range(30, 70) * s, -this.rng.range(6, 16) * s,
          4 * s, this.rng.range(16, 26) * s, this.rng.range(0.9, 1.5), 0.5, 'puff');
      }
    }
    const remain = (rw.end - p.x) * rw.d;
    if ((p.v <= TAXI_V * s + 0.5 && p.st > 2) || remain < 150 * s) this._vacate(p);
  }

  _vacate(p) {
    const rw = p.rw;
    p.state = 'taxi';
    p.strobe = false;
    p.landing = 0.35;
    p.throttle = 0.3;
    p.route = [{ x: p.x + rw.d * 100 * rw.s, y: rw.arrLane }];
    const g = this._pickGate(p);
    if (g) {
      g.plane = p;
      p.gate = g;
      p.route.push(...this._gateRoute(p, g, rw.arrLane));
    } else {
      p.route.push({ x: this._edgeX(rw.layer, rw.d, rw.s), y: rw.arrLane, exit: true });
    }
  }

  _gapAhead(p, mdir) {
    const S = AIRCRAFT_TYPES[p.type];
    const sc = p.s * p.k;
    const a0 = p.x + p.face * S.nose * sc;
    const b0 = p.x + p.face * S.tail * sc;
    const lead = mdir > 0 ? Math.max(a0, b0) : Math.min(a0, b0);
    let best = Infinity;
    for (const o of this.planes) {
      if (o === p || o.layer !== p.layer || o.kind !== 'jet' || o.hidden) continue;
      if (o.state !== 'taxi' && o.state !== 'hold' && o.state !== 'push' && o.state !== 'lineup') continue;
      if (Math.abs(o.y - p.y) > 7 * p.s) continue;
      if (o.state === 'taxi' && o.mdir && o.mdir !== mdir && o.v > 3 * o.s) continue; // Gegenverkehr
      const So = AIRCRAFT_TYPES[o.type];
      const so = o.s * o.k;
      const a = o.x + o.face * So.nose * so;
      const b = o.x + o.face * So.tail * so;
      const near = mdir > 0 ? Math.min(a, b) : Math.max(a, b);
      const gap = (near - lead) * mdir;
      if (gap > -12 * p.s && gap < best) best = gap;
    }
    return best;
  }

  _taxi(p, dt) {
    const wp = p.route && p.route[0];
    if (!wp) {
      p.state = 'hold';
      p.holdT = this.t;
      return;
    }
    const dx = wp.x - p.x;
    const dy = wp.y - p.y;
    const dist = Math.hypot(dx, dy);
    const mdir = Math.abs(dx) > 1 ? Math.sign(dx) : p.face;
    if (Math.abs(dx) > 1 && mdir !== p.face) {
      this._turn(p);
      return;
    }
    p.mdir = mdir;
    let vmax = (wp.v ?? TAXI_V) * p.s;
    if (!(p.ghost > 0)) {
      const gap = this._gapAhead(p, mdir);
      if (gap < Infinity) vmax = Math.min(vmax, Math.max(0, (gap - 24 * p.s) * 0.8));
    }
    if (wp.park || wp.hold) vmax = Math.min(vmax, Math.max(5 * p.s, dist * 0.9));
    p.v += clamp(vmax - p.v, -45 * p.s * dt, 14 * p.s * dt);
    if (p.v < 1 * p.s) {
      p.block += dt;
      if (p.block > 14) {
        p.ghost = 5;
        p.block = 0;
      }
    } else p.block = 0;
    const step = p.v * dt;
    if (step >= dist) {
      p.x = wp.x;
      p.y = wp.y;
      p.route.shift();
      if (wp.exit) {
        p.dead = true;
        return;
      }
      if (wp.park) {
        p.state = 'parked';
        p.dwell = this.rng.range(28, 75);
        p.v = 0;
        p.beacon = false;
        p.landing = 0;
        p.throttle = 0;
        p.rw = null;
        p.role = '';
        p.face = p.dir = wp.face;
        this._groundPose(p);
        return;
      }
      if (wp.hold) {
        p.state = 'hold';
        p.holdT = this.t;
        p.v = 0;
        return;
      }
      if (wp.face && wp.face !== p.face) this._turn(p);
    } else if (dist > 0) {
      p.x += (dx / dist) * step;
      p.y += (dy / dist) * step;
    }
    p.dir = p.face;
    // Piste frei, sobald das Flugzeug sie verlassen hat
    const rw = p.rw;
    if (rw && rw.occupant === p && p.y < rw.y - 14 * rw.s) this._release(rw);
  }

  _turn(p) {
    p.v = 0;
    p.man = { kind: 'turn', u: 0, dur: 2.8, x0: p.x, y0: p.y, f0: p.face, R: 20 * p.s, dy: -8 * p.s };
  }

  _runMan(p, dt) {
    const m = p.man;
    m.u = Math.min(1, m.u + dt / m.dur);
    const e = smooth(m.u);
    switch (m.kind) {
      case 'turn':
        p.x = m.x0 + m.f0 * m.R * Math.sin(Math.PI * e);
        p.y = m.y0 + (m.dy * (1 - Math.cos(Math.PI * e))) / 2;
        p.dir = m.f0 * Math.cos(Math.PI * e);
        break;
      case 'push':
        p.x = lerp(m.x0, m.x1, e);
        p.y = lerp(m.y0, m.y1, e);
        p.dir = m.rot ? m.f0 * Math.cos(Math.PI * e) : m.f0;
        break;
      case 'lineup':
        if (m.uturn) {
          p.x = lerp(m.x0, m.x1, e) + m.f0 * m.R * Math.sin(Math.PI * e);
          p.y = lerp(m.y0, m.y1, (1 - Math.cos(Math.PI * e)) / 2);
          p.dir = m.f0 * Math.cos(Math.PI * e);
        } else {
          p.x = lerp(m.x0, m.x1, e);
          p.y = lerp(m.y0, m.y1, e);
        }
        p.k = this._depthK(p.layer, p.y);
        p.zy = p.groundY = p.y;
        break;
      default:
        break;
    }
    if (m.u >= 1) {
      p.man = null;
      this._manDone(p, m);
    }
  }

  _manDone(p, m) {
    if (m.kind === 'turn') {
      p.face = p.dir = -m.f0;
    } else if (m.kind === 'push') {
      p.face = p.dir = m.rot ? -m.f0 : m.f0;
      p.man = { kind: 'wait', u: 0, dur: 2.6 };
      p.state = 'taxi';
      p.throttle = 0.3;
      p.landing = 0.35;
      if (p.gate) {
        p.gate.plane = null;
        p.gate.cool = this.t + 8;
        p.gate = null;
      }
      p.route = [{ x: p.rw.hpX, y: p.rw.depLane, hold: true }];
    } else if (m.kind === 'wait') {
      p.tug = 0;
    } else if (m.kind === 'lineup') {
      p.face = p.dir = p.rw.d;
      p.state = 'lined';
      p.st = this.rng.range(0.4, 0.9);
    }
  }

  _takeoff(p, dt) {
    const rw = p.rw;
    const f = PERF[p.type] || PERF.narrow;
    const s = p.s;
    p.st += dt;
    p.v += f.acc * s * dt;
    p.x += rw.d * p.v * dt;
    p.landing = 1;
    if (p.state === 'roll' && p.v >= f.vr * s) p.state = 'rotate';
    if (p.state === 'rotate') {
      p.pitch = Math.min(0.2, p.pitch + 0.13 * dt);
      if (p.pitch >= 0.12) {
        p.state = 'climb';
        p.gam = 0;
        p.st = 0;
      }
    }
    // Triebwerksstrahl wirbelt Schnee auf
    if (this.mood.spray && p.st < 4.5 && this.rng.chance(dt * 10 * this.quality)) {
      const S = AIRCRAFT_TYPES[p.type];
      const e = S.engines[0];
      const ex = e.rear || e.prop ? S.tail : e.x - e.len;
      this._puff(p.layer, p.x + rw.d * (ex - 12) * s, rw.y - 3 * s, -rw.d * this.rng.range(20, 60) * s, -this.rng.range(4, 12) * s,
        4 * s, this.rng.range(14, 24) * s, this.rng.range(0.8, 1.4), 0.4, 'puff');
    }
    this._margin(p);
  }

  _climb(p, dt) {
    const rw = p.rw;
    const f = PERF[p.type] || PERF.narrow;
    const s = p.s;
    const ga = p.state === 'goaround';
    p.st += dt;
    p.v = Math.min(205 * s, p.v + f.acc * 0.45 * s * dt);
    p.gam = Math.min(f.climb * (ga ? 0.85 : 1), p.gam + 0.22 * dt);
    p.x += rw.d * p.v * Math.cos(p.gam) * dt * p.k;
    p.y -= p.v * Math.sin(p.gam) * dt * p.k;
    p.pitch += (p.gam + 0.05 - p.pitch) * Math.min(1, dt * 2);
    if (p.st > (ga ? 1.4 : 1.8)) p.gear = Math.max(0, p.gear - dt / 2.4);
    const alt = rw.y - p.y;
    p.k = Math.max(ga ? 0.6 : 0.5, Math.min(p.k, 1 - alt / 820));
    p.zy = rw.y;
    p.groundY = rw.y;
    p.landing = alt < 260 ? 1 : 0.6;
    p.throttle = 1;
    if (rw.occupant === p && (alt > 16 * s || (p.x - rw.end) * rw.d > 0)) this._release(rw);
    if (p.x < -320 * s || p.x > rw.W + 320 * s || p.y < -160) p.dead = true;
    this._margin(p);
  }

  _cruise(p, dt) {
    if (p.layer === 'sky') p.W = this.viewW;
    const W = p.W ?? LAYER_W[p.layer];
    p.x += p.dir * p.v * dt;
    p.trail += p.v * dt;
    const tl = p.contrail ? Math.min(p.trail, p.trailMax) : 0;
    if (p.dir > 0 ? p.x - tl > W + 160 : p.x + tl < -160) p.dead = true;
  }

  _low(p, dt) {
    p.x += p.dir * p.v * dt;
    const u = clamp((p.x - p.xA) / (p.xB - p.xA), 0, 1);
    p.y = lerp(p.yA, p.yB, 1 - Math.pow(1 - u, 1.6));
    p.pitch = 0.06 - u * 0.025;
    if (!p.sounded && this.view && this.view.isVisible(p.layer, p.x, 450)) {
      p.sounded = true;
      this._sound('jet-flyby', p.layer, p.x, 0.9);
    }
    if (u >= 1) p.dead = true;
  }

  _heli(p, dt) {
    const W = LAYER_W[p.layer];
    p.x += p.dir * p.v * dt;
    p.y = p.y0 + Math.sin(this.t * 0.55 + p.phase) * 12 * p.s;
    p.pitch = -0.1 + Math.sin(this.t * 0.9 + p.phase) * 0.025;
    if (!p.sounded && this.view && this.view.isVisible(p.layer, p.x, 120)) {
      p.sounded = true;
      this._sound('heli', p.layer, p.x);
    }
    if (p.dir > 0 ? p.x > W + 120 * p.s : p.x < -120 * p.s) p.dead = true;
  }

  _updateAmbient(dt) {
    for (const o of this.overs) {
      o.next -= dt;
      if (o.next <= 0) {
        o.next = this._interval(o.perMin);
        let n = 0;
        for (const p of this.planes) if (p.kind === 'over' && p.layer === o.layer) n++;
        if (n < 6) this._spawnOver(o, 0);
      }
    }
    this.nextHeli -= dt;
    if (this.nextHeli <= 0) {
      this.nextHeli = this._interval(this.cfg.helicopters);
      if (!this.planes.some((p) => p.kind === 'heli')) this._spawnHeli();
    }
    this.nextDot -= dt;
    if (this.nextDot <= 0) {
      this.nextDot = this._interval(this.cfg.skyTraffic);
      let n = 0;
      for (const p of this.planes) if (p.kind === 'dot') n++;
      if (n < 3) this._spawnDot(0);
    }
  }

  // Höchstens ein neues Sprite pro Frame vorab rendern – verhindert Ruckler beim Erscheinen/Wenden
  _warmSprites(view) {
    const res = view.scale * view.dpr;
    if (!(res > 0)) return;
    for (const p of this.planes) {
      if (p.kind === 'heli' || p.warmed === res) continue;
      const o = { type: p.type, livery: p.livery, scale: p.s, res, lights: this.mood.lights, tint: this.mood.tint, side: p.face };
      if (prepareAircraft(o)) return;
      // Bodenverkehr wendet: auch die Gegenseite bereithalten
      if (p.kind === 'jet' && p.state !== 'approach' && p.state !== 'climb') {
        o.side = -p.face;
        if (prepareAircraft(o)) return;
      }
      p.warmed = res;
    }
  }

  // --- Partikel & Sound --------------------------------------------------------

  _puff(layer, x, y, vx, vy, r0, r1, life, a, img) {
    if (this.parts.length > 60 + 120 * this.quality) return;
    this.parts.push({ layer, x, y, vx, vy, r0, r1, life, a, img, age: 0 });
  }

  _updateParticles(dt) {
    let j = 0;
    for (const q of this.parts) {
      q.age += dt;
      if (q.age >= q.life) continue;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.vx *= 1 - Math.min(1, 1.6 * dt);
      q.vy *= 1 - Math.min(1, 0.9 * dt);
      this.parts[j++] = q;
    }
    this.parts.length = j;
  }

  _drawParticles(ctx, layerId, F, v) {
    const dim = this.mood.lights ? 0.6 : 1;
    for (const q of this.parts) {
      if (q.layer !== layerId) continue;
      if (v && !v.isVisible(layerId, q.x, q.r1)) continue;
      const k = q.age / q.life;
      const r = q.r0 + (q.r1 - q.r0) * (1 - (1 - k) * (1 - k));
      ctx.globalAlpha = q.a * dim * Math.pow(1 - k, 1.4);
      ctx.drawImage(q.img === 'smoke' ? F.smoke : F.puff, q.x - r, q.y - r * 0.8, r * 2, r * 1.6);
    }
    ctx.globalAlpha = 1;
  }

  _sound(name, layer, x, minVol = 0) {
    if (this.silent || !this.onSound || !this.view) return;
    const v = this.view;
    let vis = 0;
    if (layer === 'sky' || v.isVisible(layer, x, 0)) vis = 1;
    else if (v.isVisible(layer, x, 600)) vis = 0.4;
    if (!vis) return;
    const req = { name, pan: v.stereo(layer, x), vol: Math.max(minVol, (LAYER_VOL[layer] ?? 0.5) * vis), prio: PRIO[name] || 0, until: this.t + 1.6 };
    if (this.t - this.lastSound >= SOUND_GAP) this._emit(req);
    else if (!this.pending || this.pending.prio <= req.prio) this.pending = req;
  }

  _emit(req) {
    this.lastSound = this.t;
    try {
      this.onSound(req.name, { pan: req.pan, vol: req.vol });
    } catch {
      // Audio-Fehler dürfen den Verkehr nicht stören
    }
  }

  // --- Zeichnen ------------------------------------------------------------------

  _layerList(id) {
    if (this.sorted !== this.frame) {
      for (const k of Object.keys(this.lists)) this.lists[k].length = 0;
      for (const p of this.planes) if (!p.dead && this.lists[p.layer]) this.lists[p.layer].push(p);
      for (const k of Object.keys(this.lists)) this.lists[k].sort(byDepth);
      this.sorted = this.frame;
    }
    return this.lists[id] || EMPTY;
  }

  _drawTrail(ctx, p, F, off, vw) {
    const len = Math.min(p.trail, p.trailMax);
    if (len < 4) return;
    const S = AIRCRAFT_TYPES[p.type] || AIRCRAFT_TYPES.narrow;
    const sc = p.s * p.k;
    const tx = p.x + p.dir * (S.tail - 2) * sc;
    const x0 = Math.min(tx, tx - p.dir * len);
    if (x0 > off + vw + 20 || x0 + len < off - 20) return;
    const ty = p.y - (S.gearH + S.d * 0.3) * sc;
    const w = Math.max(p.kind === 'dot' ? 3 : 6, 64 * sc);
    ctx.globalAlpha = this.mood.trailAlpha * (p.kind === 'dot' ? 0.75 : 1);
    ctx.save();
    ctx.translate(tx, ty);
    ctx.scale(p.dir, 1);
    ctx.drawImage(F.contrail, -len, -w / 2, len, w);
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  _drawGround(ctx, p, F, v) {
    if (p.kind === 'over' || p.kind === 'dot' || p.groundY == null) return;
    const S = AIRCRAFT_TYPES[p.type];
    if (!S) return;
    if (v && !v.isVisible(p.layer, p.x, p.margin || 200)) return;
    const gy = p.groundY;
    const alt = gy - p.y;
    const sc = p.s * p.k;
    const maxAlt = 230 * p.s;
    if (alt < maxAlt) {
      const len = (S.nose - S.tail) * sc * Math.max(0.35, Math.abs(p.dir));
      const cx = p.x + p.dir * ((S.nose + S.tail) / 2) * sc;
      ctx.globalAlpha = (this.mood.lights ? 0.3 : 0.5) * (1 - alt / maxAlt);
      ctx.drawImage(F.shadow, cx - len * 0.56, gy - 5 * p.s * p.k, len * 1.12, 10 * p.s * p.k);
    }
    if (this.mood.lights && p.landing > 0.2 && alt < 150 * p.s && Math.abs(p.dir) > 0.6) {
      const px = p.x + p.dir * (S.nose + 75) * sc;
      const w = 190 * sc;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.55 * Math.min(1, p.landing) * (1 - alt / (150 * p.s)) * (this.mood.glow ?? 1);
      ctx.drawImage(F.pool, px - w / 2, gy - 8 * p.s, w, 16 * p.s);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalAlpha = 1;
  }

  _drawPlane(ctx, p, res) {
    const age = this.t - p.hitT;
    const hit = age < 0.7 ? 1 - age / 0.7 : 0;
    // Laufzeit der Ansicht: Blinklichter und Rotoren laufen auch in der Pause weiter
    const t = (this.view && Number.isFinite(this.view.t) ? this.view.t : this.t) + p.phase;
    if (p.kind === 'heli') {
      drawHelicopter(ctx, { x: p.x, y: p.y, scale: p.s * p.k, dir: p.dir, pitch: p.pitch, t, lights: this.mood.lights, livery: p.livery, res, tint: this.mood.tint });
      return;
    }
    drawAircraft(ctx, {
      type: p.type, livery: p.livery, x: p.x, y: p.y, scale: p.s * p.k, spriteScale: p.s, dir: p.dir,
      pitch: p.pitch + (hit ? Math.sin(age * 38) * 0.04 * hit : 0),
      gear: p.gear, lights: this.mood.lights, t, res, tint: this.mood.tint, glow: this.mood.glow,
      landing: p.landing, beacon: p.beacon, strobe: p.strobe, throttle: p.throttle,
      hat: p.hat, flash: hit, glowMin: p.kind === 'dot' ? 3 : p.kind === 'over' ? 2 : 0,
      away: !(p.man && p.man.away === false),
    });
    if (p.tug) this._drawTug(ctx, p);
  }

  // Schlepper am Bugrad (Pushback), löst sich danach und fährt weg
  _drawTug(ctx, p) {
    const S = AIRCRAFT_TYPES[p.type];
    const sc = p.s * p.k;
    const side = p.dir < 0 ? -1 : 1;
    const ad = Math.max(0.05, Math.abs(p.dir));
    let away = 0;
    let alpha = 1;
    if (p.state === 'taxi' && p.man && p.man.kind === 'wait') {
      away = p.man.u * 40;
      alpha = 1 - p.man.u;
    }
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(p.x, p.y);
    ctx.scale(side * ad * sc, sc);
    const x0 = S.noseGear + 6 + away;
    // Schleppstange
    if (!away) {
      ctx.fillStyle = '#3a3e45';
      ctx.fillRect(S.noseGear, -2.2, 7, 0.9);
    }
    ctx.fillStyle = '#e6b43a';
    ctx.beginPath();
    ctx.moveTo(x0, -1.2);
    ctx.lineTo(x0, -5.5);
    ctx.lineTo(x0 + 10, -5.5);
    ctx.lineTo(x0 + 14, -3.2);
    ctx.lineTo(x0 + 14, -1.2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#2b3038';
    ctx.fillRect(x0 + 2.5, -8.6, 5, 3.2);
    ctx.fillStyle = '#9fc4e0';
    ctx.fillRect(x0 + 3.2, -8.1, 3.6, 2.2);
    ctx.fillStyle = '#16181c';
    ctx.beginPath();
    ctx.arc(x0 + 3, -1.3, 1.3, 0, Math.PI * 2);
    ctx.arc(x0 + 11, -1.3, 1.3, 0, Math.PI * 2);
    ctx.fill();
    // Rundumleuchte
    if (((this.t * 2.2) % 1) < 0.5) {
      ctx.fillStyle = '#ffb02e';
      ctx.fillRect(x0 + 4.4, -9.6, 1.4, 1);
    }
    ctx.restore();
  }

  // --- Treffertest --------------------------------------------------------------

  _box(p) {
    if (p.kind === 'heli') {
      const sc = p.s * p.k;
      return { x0: p.x - 27 * sc, x1: p.x + 17 * sc, y0: p.y - 18 * sc, y1: p.y + 1 * sc };
    }
    const S = AIRCRAFT_TYPES[p.type] || AIRCRAFT_TYPES.narrow;
    const sc = p.s * p.k;
    const a = p.x + p.dir * S.nose * sc;
    const b = p.x + p.dir * S.tail * sc;
    const lift = Math.abs(Math.sin(p.pitch)) * (S.nose - S.tail) * 0.5 * sc;
    return { x0: Math.min(a, b), x1: Math.max(a, b), y0: p.y - S.h * sc - lift, y1: p.y + lift + 1 };
  }

  _hit(p, x, y) {
    const sc = p.s * p.k;
    const pad = 2 / sc;
    let lx = (x - p.x) / sc;
    let ly = (y - p.y) / sc;
    if (p.kind === 'heli') {
      lx /= p.dir < 0 ? -1 : 1;
      return lx > -27 - pad && lx < 17 + pad && ly > -18 - pad && ly < 1 + pad;
    }
    const S = AIRCRAFT_TYPES[p.type] || AIRCRAFT_TYPES.narrow;
    const side = p.dir < 0 ? -1 : 1;
    lx /= side * Math.max(0.3, Math.abs(p.dir));
    if (p.pitch) {
      const c = Math.cos(p.pitch);
      const s = Math.sin(p.pitch);
      const rx = lx * c - ly * s;
      ly = lx * s + ly * c;
      lx = rx;
    }
    const topBody = -(S.gearH + S.d + (S.hump ? S.hump.h : 0));
    if (lx > S.tail - pad && lx < S.nose + pad && ly > topBody - pad && ly < 1 + pad) return true;
    // Seitenleitwerk
    return lx > S.fin.tb - pad && lx < S.fin.rf + pad && ly > -S.fin.top - pad && ly <= topBody;
  }
}
