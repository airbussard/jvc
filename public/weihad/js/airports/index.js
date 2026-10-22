import FRA from './fra.js';
import JFK from './jfk.js';
import DXB from './dxb.js';
import SXM from './sxm.js';
import HND from './hnd.js';

// Reihenfolge = Reihenfolge in der Flughafen-Auswahl
export const AIRPORTS = [FRA, JFK, DXB, SXM, HND];

export function getAirport(id) {
  return AIRPORTS.find((a) => a.id === id) || null;
}
