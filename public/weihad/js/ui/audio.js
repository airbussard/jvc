// PLATZHALTER – wird vom UI-Agent ersetzt
let muted = false;
export const audio = {
  unlock() {},
  play() {},
  setMuted(b) { muted = b; },
  get muted() { return muted; },
  startAmbience() {},
  stopAmbience() {},
};
