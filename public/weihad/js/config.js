// Globale Konstanten – siehe PLAN.md, Abschnitt 3.2
export const WORLD_H = 720;

// Zeichenreihenfolge von hinten nach vorne
export const LAYERS = ['sky', 'far', 'mid', 'near'];
export const PARALLAX_LAYERS = ['far', 'mid', 'near'];

// Breite jeder Ebene in Welteinheiten (sky ist immer genau viewW breit)
export const LAYER_W = { far: 1800, mid: 2400, near: 3000 };

// Größenfaktor für Objekte (Adler, Geschenke) je Ebene
export const LAYER_SCALE = { sky: 0.3, far: 0.42, mid: 0.68, near: 1.0 };

export const ROUND_TIME = 90;
export const MAX_AMMO = 8;
export const RELOAD_TIME = 0.9;

// Breitere Bildschirme werden seitlich begrenzt (Pillarbox)
export const MAX_ASPECT = 2.4;
export const MAX_DPR = 2;
// Obergrenze Pixelfläche je vorgerenderter Ebene (iOS-Canvas-Limit ~16.7 MP)
export const MAX_LAYER_PIXELS = 9e6;

// Kameraschwenk in near-Welteinheiten pro Sekunde
export const PAN_SPEED = 1500;
export const EDGE_PAN_ZONE = 0.1; // Anteil der Bildschirmbreite (Desktop-Maus)

export const API_BASE = '/api/weihad/scores';
export const ASSET_BASE = '/weihad/';
