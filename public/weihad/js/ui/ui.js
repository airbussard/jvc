// Oberfläche: Menüs, HUD, Game-Over und Bestenliste im Stil einer Flughafen-Fallblattanzeige.
// Alle Nutzerdaten (Namen) werden ausschließlich per textContent eingefügt.
import { audio } from './audio.js';
import { fetchScores, submitScore } from './api.js';

const NAME_KEY = 'weihad.name';
// Gleiche Zeichenregel wie die Server-Route (sonst lehnt sie mit 400 ab)
const NAME_OK = /^[\p{L}\p{N} ._\-!?'&+#]+$/u;
// Screenshot-/Testmodus (Headless-Chrome mit virtueller Zeit, ?screen=, ?freeze=): Endzustände statt Einblend-Animationen
const QUERY = new URLSearchParams(location.search);
const STILL = /HeadlessChrome/.test(navigator.userAgent) || QUERY.has('freeze') || QUERY.has('screen');
const PREVIEW_DELAY = 250;
const FLAP_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜ0123456789';
const BACK_TO_TITLE = new Set(['select', 'scores', 'help']);

const TICKER = [
  'Willkommen an Bord der Weihnachts-Adler-Jagd',
  'Erhöhtes Adleraufkommen über allen Pisten',
  'Tower: Bitte keine Mützen auf Flugzeuge werfen',
  'Gate W24: Mützenausgabe geöffnet',
  'Goldadler gesichtet – 500 Punkte Finderlohn',
  'Rentierschlitten hat Landeerlaubnis',
  'Enteisung der Tragflächen läuft',
  'Rush Hour in den letzten 10 Sekunden',
];

const RANDOM_CARD = {
  id: 'RND', iata: '???', city: 'Zufallsziel', name: 'Überraschungsflug', subtitle: 'Der Tower entscheidet',
  theme: { accent: '#ffc61a', skyTop: '#161a26', skyBottom: '#7a1424' },
};

const STATUS_POOL = [
  ['GELANDET', 's-white'], ['PÜNKTLICH', 's-green'], ['GATE OFFEN', 's-green'], ['IM ANFLUG', 's-amber'],
  ['ENTEISUNG', 's-blue'], ['VERSPÄTET', 's-red'], ['ANSCHLUSS', 's-amber'], ['WARTESCHLEIFE', 's-amber'],
];

// --- SVG-Symbole (statisch, eigene Pfade) ------------------------------------------------
const SPRITE = `
<svg class="sprite" aria-hidden="true" focusable="false" width="0" height="0">
  <symbol id="i-hat" viewBox="0 0 64 64">
    <path d="M9 47C10 30 20 15 37 10c9-2.6 17 1 20 9 .8 2.2-1.3 3.4-2.8 2.2-3-2.4-6.2-2.4-8.4.4C48 31 51 39 53 47z" fill="#d8293d"/>
    <path d="M37 10c9-2.6 17 1 20 9 .8 2.2-1.3 3.4-2.8 2.2-3-2.4-6.2-2.4-8.4.4-1.6-4.4-4.6-8.2-8.8-11.6z" fill="#a0162a"/>
    <path d="M15 44c2.5-11 8-21 18-28" fill="none" stroke="#ff7d89" stroke-width="2.6" stroke-linecap="round" opacity=".55"/>
    <rect x="5" y="42" width="54" height="15" rx="7.5" fill="#f6f8fc"/>
    <path d="M5 50h54a7.5 7.5 0 0 1-7.5 7H12.5A7.5 7.5 0 0 1 5 50z" fill="#d3dbe7"/>
    <circle cx="56" cy="24" r="6.6" fill="#eef2f8"/>
    <circle cx="54.4" cy="22.4" r="2.6" fill="#fff"/>
  </symbol>
  <symbol id="i-plane" viewBox="0 0 24 24"><path d="M12 1.6c.9 0 1.5.9 1.5 2.1v5.2l8.5 5v2l-8.5-2.6v5l2.6 2v1.6L12 21l-4.1 1.1v-1.6l2.6-2v-5L2 16.1v-2l8.5-5V3.7c0-1.2.6-2.1 1.5-2.1z" fill="currentColor"/></symbol>
  <symbol id="i-depart" viewBox="0 0 24 24"><path d="M2 21.2h20v1.6H2z" fill="currentColor"/><g transform="rotate(58 12 11) scale(.86) translate(2 1)"><path d="M12 1.6c.9 0 1.5.9 1.5 2.1v5.2l8.5 5v2l-8.5-2.6v5l2.6 2v1.6L12 21l-4.1 1.1v-1.6l2.6-2v-5L2 16.1v-2l8.5-5V3.7c0-1.2.6-2.1 1.5-2.1z" fill="currentColor"/></g></symbol>
  <symbol id="i-arrive" viewBox="0 0 24 24"><path d="M2 21.2h20v1.6H2z" fill="currentColor"/><g transform="rotate(122 12 11) scale(.86) translate(2 1)"><path d="M12 1.6c.9 0 1.5.9 1.5 2.1v5.2l8.5 5v2l-8.5-2.6v5l2.6 2v1.6L12 21l-4.1 1.1v-1.6l2.6-2v-5L2 16.1v-2l8.5-5V3.7c0-1.2.6-2.1 1.5-2.1z" fill="currentColor"/></g></symbol>
  <symbol id="i-eagle" viewBox="0 0 24 24"><path fill="currentColor" d="M12 9.3c-1.4 0-2.4.8-3.4 1.4L1 6.4l1.4 3-1 .2 1.9 2-.9.4 2.6 1.4-.5.6 4.2.3 1.4 1.3-.9 3.6 2.8-1.5 2.8 1.5-.9-3.6 1.4-1.3 4.2-.3-.5-.6 2.6-1.4-.9-.4 1.9-2-1-.2 1.4-3-7.6 4.3c-1-.6-2-1.4-3.4-1.4z"/><circle cx="12" cy="7.2" r="2.1" fill="currentColor"/><path d="M12.6 7.6l2 .6-2 .9z" fill="currentColor"/></symbol>
  <symbol id="i-sound" viewBox="0 0 24 24"><path d="M3 9h4l5-4v14l-5-4H3z" fill="currentColor"/><path d="M15.5 8.6a4.8 4.8 0 0 1 0 6.8M18.2 6a8.4 8.4 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></symbol>
  <symbol id="i-mute" viewBox="0 0 24 24"><path d="M3 9h4l5-4v14l-5-4H3z" fill="currentColor"/><path d="M15.5 9.2l5 5.6M20.5 9.2l-5 5.6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></symbol>
  <symbol id="i-pause" viewBox="0 0 24 24"><rect x="5.5" y="4" width="4.6" height="16" rx="1" fill="currentColor"/><rect x="13.9" y="4" width="4.6" height="16" rx="1" fill="currentColor"/></symbol>
  <symbol id="i-play" viewBox="0 0 24 24"><path d="M7 4.5l13 7.5-13 7.5z" fill="currentColor"/></symbol>
  <symbol id="i-restart" viewBox="0 0 24 24"><path d="M12 4a8 8 0 1 0 7.7 10h-2.1A6 6 0 1 1 12 6c1.7 0 3.1.7 4.2 1.8L13 11h7V4l-2.4 2.4A8 8 0 0 0 12 4z" fill="currentColor"/></symbol>
  <symbol id="i-home" viewBox="0 0 24 24"><path d="M12 3l9 8h-2.6v9h-4.8v-6H10.4v6H5.6v-9H3z" fill="currentColor"/></symbol>
  <symbol id="i-fs" viewBox="0 0 24 24"><path d="M3.5 9V3.5H9M15 3.5h5.5V9M20.5 15v5.5H15M9 20.5H3.5V15" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="square"/></symbol>
  <symbol id="i-board" viewBox="0 0 24 24"><path fill="currentColor" fill-rule="evenodd" d="M2 4h20v16H2zM4 7v2.2h4V7zm6 0v2.2h10V7zM4 11v2.2h4V11zm6 0v2.2h10V11zM4 15v2.2h4V15zm6 0v2.2h10V15z"/></symbol>
  <symbol id="i-info" viewBox="0 0 24 24"><path fill="currentColor" fill-rule="evenodd" d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm-1.3 8v8h2.6v-8zM12 5.4a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2z"/></symbol>
  <symbol id="i-back" viewBox="0 0 24 24"><path d="M20 10.8H8.9l4.5-4.5L12 4.9 4.9 12l7.1 7.1 1.4-1.4-4.5-4.5H20z" fill="currentColor"/></symbol>
  <symbol id="i-arrow" viewBox="0 0 24 24"><path d="M4 10.8h11.1l-4.5-4.5L12 4.9l7.1 7.1-7.1 7.1-1.4-1.4 4.5-4.5H4z" fill="currentColor"/></symbol>
  <symbol id="i-chev-l" viewBox="0 0 24 24"><path d="M11.5 5l-7 7 7 7M19.5 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></symbol>
  <symbol id="i-chev-r" viewBox="0 0 24 24"><path d="M12.5 5l7 7-7 7M4.5 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></symbol>
  <symbol id="i-snow" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7"/><path d="M9.5 3.6L12 6l2.5-2.4M9.5 20.4L12 18l2.5 2.4M4.1 10.4l3.3-1-.8-3.3M19.9 13.6l-3.3 1 .8 3.3M4.1 13.6l3.3 1-.8 3.3M19.9 10.4l-3.3-1 .8-3.3"/></g></symbol>
  <symbol id="i-gift" viewBox="0 0 24 24"><path fill="currentColor" d="M3 9h8v4H3zM13 9h8v4h-8zM4 14h7v7H4zM13 14h7v7h-7zM12 8.6C10.2 4.4 6.2 4.6 6.6 7c.3 1.6 3 1.8 5.4 1.6zm0 0c1.8-4.2 5.8-4 5.4-1.6-.3 1.6-3 1.8-5.4 1.6z"/></symbol>
  <symbol id="i-tower" viewBox="0 0 24 24"><path fill="currentColor" d="M11.3 1h1.4v3.4h-1.4zM4.6 5h14.8l-2.2 5.4H6.8zM9.2 11.4h5.6l-.8 9.6H10zM7 21h10v2H7z"/></symbol>
  <symbol id="i-star" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7L12 17.3 5.8 21l1.6-7L2 9.2l7.1-.6z"/></symbol>
  <symbol id="i-sleigh" viewBox="0 0 24 24"><path fill="currentColor" d="M2.4 17.2c1.6 1.8 3.4 2.3 5.6 2.3h11.6a2.6 2.6 0 0 0 2.6-2.6h-1.6c0 .6-.5 1-1 1H8c-1.7 0-2.9-.4-4.1-1.7zM6 16h12.4l1.2-5.4-4.2 1.4c-1.2-2.6-3.4-4.2-7-4.4L6 8z"/></symbol>
  <symbol id="i-phone" viewBox="0 0 24 24"><rect x="6.5" y="2" width="11" height="20" rx="2.4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M10 18.6h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></symbol>
  <symbol id="i-target" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="7"/><path d="M12 1.5v6M12 16.5v6M1.5 12h6M16.5 12h6"/></g><circle cx="12" cy="12" r="1.6" fill="currentColor"/></symbol>
</svg>`;

const ico = (name, cls = '') => `<svg class="ico ${cls}" aria-hidden="true" focusable="false"><use href="#i-${name}"/></svg>`;

// --- Bildschirm-Vorlagen (rein statisch, keine Nutzerdaten) ----------------------------------
const TEMPLATE = `${SPRITE}
<section class="scr menu scr-title" data-scr="title" hidden aria-label="Hauptmenü">
  <div class="corner">
    <button class="sq js-mute" type="button" data-act="mute" title="Ton an/aus (M)" aria-label="Ton ausschalten">${ico('sound')}</button>
    <button class="sq js-fs" type="button" data-act="fs" title="Vollbild" aria-label="Vollbild">${ico('fs')}</button>
  </div>
  <div class="title-main">
    <h1 class="logo" aria-label="WEIHAD">
      <span class="lt" style="--i:0" aria-hidden="true"><b>W</b><svg class="logo-hat" aria-hidden="true"><use href="#i-hat"/></svg></span><span class="lt" style="--i:1" aria-hidden="true"><b>E</b></span><span class="lt" style="--i:2" aria-hidden="true"><b>I</b></span><span class="lt" style="--i:3" aria-hidden="true"><b>H</b></span><span class="lt" style="--i:4" aria-hidden="true"><b>A</b></span><span class="lt" style="--i:5" aria-hidden="true"><b>D</b></span>
    </h1>
    <p class="sign sub"><span class="pict">${ico('eagle')}</span><span class="sign-txt">Die Weihnachts-Adler-Jagd</span><span class="sign-arr">${ico('arrow')}</span></p>
    <nav class="title-nav nav-group" aria-label="Menü">
      <button class="btn btn-go btn-lg js-first" type="button" data-act="play"><span class="pict">${ico('depart')}</span><span class="lbl">Spielen</span><span class="gate">Gate<b>W24</b></span></button>
      <div class="btn-row">
        <button class="btn btn-ink" type="button" data-act="scores"><span class="pict">${ico('board')}</span><span class="lbl">Bestenliste</span></button>
        <button class="btn btn-ink" type="button" data-act="help"><span class="pict">${ico('info')}</span><span class="lbl">Anleitung</span></button>
      </div>
    </nav>
  </div>
  <div class="ticker" aria-hidden="true"><div class="ticker-tag">${ico('tower')}<span>Info</span></div><div class="ticker-win"><div class="ticker-track"><span class="ticker-txt"></span><span class="ticker-txt"></span></div></div></div>
</section>

<section class="scr menu scr-select" data-scr="select" hidden aria-label="Flughafen wählen">
  <header class="head">
    <button class="btn btn-ink btn-sm" type="button" data-act="back"><span class="pict">${ico('back')}</span><span class="lbl">Zurück</span></button>
    <h2 class="sign head-sign"><span class="pict">${ico('depart')}</span><span class="sign-txt">Wähle dein Ziel</span></h2>
    <div class="dest" aria-hidden="true"><span class="hud-tag">Nächster Abflug</span><span class="flaps dest-flaps"></span></div>
  </header>
  <div class="passes nav-group"></div>
  <p class="select-hint"><span class="hint-mouse">Bordkarte überfahren für eine Vorschau – Klick startet den Flug.</span><span class="hint-touch">Bordkarte antippen – und los geht der Flug.</span></p>
</section>

<section class="scr scr-hud" data-scr="hud" hidden aria-label="Spiel">
  <div class="hud-top">
    <div class="hud-score">
      <span class="hud-tag">Punkte</span>
      <span class="flaps score-flaps" role="img" aria-label="Punkte"></span>
      <div class="combo" hidden><b class="combo-x"></b><span class="combo-txt">Combo<b class="combo-n"></b></span></div>
    </div>
    <div class="hud-clock">
      <span class="hud-tag">Restzeit</span>
      <span class="flaps clock-flaps" role="img" aria-label="Restzeit"></span>
      <span class="rush">Rush Hour</span>
    </div>
    <div class="hud-right">
      <span class="ap-badge" hidden><b class="ap-code"></b><span class="ap-city"></span></span>
      <button class="sq js-mute hud-btn" type="button" data-act="mute" title="Ton an/aus (M)" aria-label="Ton ausschalten">${ico('sound')}</button>
      <button class="sq hud-btn" type="button" data-act="pause" title="Pause (P)" aria-label="Pause">${ico('pause')}</button>
    </div>
  </div>
  <div class="hud-fx" aria-live="polite">
    <div class="toast" hidden><span class="toast-tag">${ico('tower')}Tower</span><span class="toast-msg"></span><b class="toast-pts"></b></div>
    <div class="banner" hidden><b class="banner-main"></b><span class="banner-sub"></span></div>
    <div class="pill" hidden></div>
  </div>
  <div class="hud-bottom">
    <div class="reload-hint" hidden><b>Nachladen!</b><span class="reload-how"></span></div>
    <div class="ammo" aria-label="Mützen"><span class="ammo-hats"></span><span class="reload-bar"><i></i></span></div>
  </div>
  <div class="touch-ctl">
    <button class="hold hold-l" type="button" data-dir="-1" aria-label="Nach links schwenken">${ico('chev-l')}</button>
    <button class="hold hold-r" type="button" data-dir="1" aria-label="Nach rechts schwenken">${ico('chev-r')}</button>
    <button class="reload-btn" type="button" aria-label="Nachladen">
      <svg class="rb-ring" viewBox="0 0 100 100" aria-hidden="true"><circle class="rb-bg" cx="50" cy="50" r="45"/><circle class="rb-fg" cx="50" cy="50" r="45"/></svg>
      <span class="rb-stack" aria-hidden="true"><svg class="h2"><use href="#i-hat"/></svg><svg class="h1"><use href="#i-hat"/></svg></span>
      <span class="rb-lbl" aria-hidden="true">Nachladen</span>
      <span class="rb-count">8</span>
    </button>
  </div>
</section>

<section class="scr menu scr-pause" data-scr="pause" hidden aria-label="Pause">
  <div class="panel pause-panel">
    <div class="flapword" aria-hidden="true"><span class="lt"><b>P</b></span><span class="lt"><b>A</b></span><span class="lt"><b>U</b></span><span class="lt"><b>S</b></span><span class="lt"><b>E</b></span></div>
    <h2 class="sign sub small"><span class="pict">${ico('tower')}</span><span class="sign-txt">Gate vorübergehend geschlossen</span></h2>
    <p class="pause-info"></p>
    <nav class="stack nav-group" aria-label="Pausenmenü">
      <button class="btn btn-go js-first" type="button" data-act="resume"><span class="pict">${ico('play')}</span><span class="lbl">Weiter</span></button>
      <button class="btn btn-ink" type="button" data-act="restart"><span class="pict">${ico('restart')}</span><span class="lbl">Neu starten</span></button>
      <button class="btn btn-ink" type="button" data-act="quit"><span class="pict">${ico('home')}</span><span class="lbl">Hauptmenü</span></button>
      <div class="btn-row">
        <button class="btn btn-ink js-mute" type="button" data-act="mute" aria-label="Ton ausschalten"><span class="pict">${ico('sound')}</span><span class="lbl js-mute-lbl">Ton: an</span></button>
        <button class="btn btn-ink js-fs" type="button" data-act="fs" aria-label="Vollbild"><span class="pict">${ico('fs')}</span><span class="lbl">Vollbild</span></button>
      </div>
    </nav>
  </div>
</section>

<section class="scr menu scr-over" data-scr="over" hidden aria-label="Ergebnis">
  <div class="over-wrap">
    <article class="ticket">
      <header class="ticket-top">
        <span class="tt-kicker">Landekarte · Arrival</span>
        <span class="tt-route"><b>XMS</b>${ico('plane', 'tt-plane')}<b class="o-ap"></b></span>
      </header>
      <div class="ticket-body">
        <p class="o-head">Gelandet in <b class="o-city"></b></p>
        <div class="o-score"><small>Ergebnis · Punkte</small><span class="flaps o-flaps" role="img" aria-label="Ergebnis"></span>
          <div class="stamp" hidden aria-live="polite"><small>Rang</small><b class="stamp-n"></b><small class="stamp-sub"></small></div>
        </div>
        <dl class="o-stats">
          <div><dt>Treffer</dt><dd class="o-hits"></dd></div>
          <div><dt>Würfe</dt><dd class="o-shots"></dd></div>
          <div><dt>Quote</dt><dd class="o-acc"></dd></div>
          <div><dt>Beste Combo</dt><dd class="o-combo"></dd></div>
        </dl>
        <p class="o-extra"></p>
        <form class="entry" novalidate autocomplete="on">
          <label class="entry-lbl" for="weihad-name">Passagier · Name für die Bestenliste</label>
          <div class="entry-row">
            <input id="weihad-name" class="entry-in" name="nickname" type="text" maxlength="16" autocomplete="nickname" autocapitalize="words" autocorrect="off" spellcheck="false" enterkeyhint="send" placeholder="Dein Name" required>
            <button class="btn btn-red btn-sm entry-btn" type="submit"><span class="lbl">Eintragen</span></button>
          </div>
          <p class="entry-msg" aria-live="polite"></p>
        </form>
      </div>
    </article>
    <section class="board board-mini" aria-label="Bestenliste">
      <header class="board-head"><span class="pict">${ico('board')}</span><h3>Bestenliste<span> · Top 10</span></h3><span class="board-clock"></span></header>
      <div class="board-cols"></div>
      <div class="board-rows"></div>
      <p class="board-note"></p>
    </section>
  </div>
  <nav class="foot-nav nav-group" aria-label="Wie geht es weiter?">
    <button class="btn btn-go btn-sm js-first" type="button" data-act="again"><span class="pict">${ico('restart')}</span><span class="lbl">Nochmal</span></button>
    <button class="btn btn-ink btn-sm" type="button" data-act="other"><span class="pict">${ico('depart')}</span><span class="lbl">Anderer Flughafen</span></button>
    <button class="btn btn-ink btn-sm" type="button" data-act="quit"><span class="pict">${ico('home')}</span><span class="lbl">Menü</span></button>
  </nav>
</section>

<section class="scr menu scr-scores" data-scr="scores" hidden aria-label="Bestenliste">
  <div class="board board-full">
    <header class="board-head"><span class="pict">${ico('depart')}</span><h2>Abflug<span> · Departures</span></h2><span class="board-clock"></span></header>
    <div class="tabs nav-group" role="tablist" aria-label="Flughafen"></div>
    <div class="board-cols"></div>
    <div class="board-rows"></div>
    <footer class="board-foot"><span class="board-note"></span><span class="board-legend">${ico('snow')}Bestenliste · WEIHAD</span></footer>
  </div>
  <nav class="foot-nav nav-group">
    <button class="btn btn-ink btn-sm" type="button" data-act="back"><span class="pict">${ico('back')}</span><span class="lbl">Zurück</span></button>
    <button class="btn btn-go btn-sm js-first" type="button" data-act="play"><span class="pict">${ico('depart')}</span><span class="lbl">Spielen</span></button>
  </nav>
</section>

<section class="scr menu scr-help" data-scr="help" hidden aria-label="Anleitung">
  <article class="safety">
    <header class="safety-top">
      <span class="safety-badge">${ico('info')}</span>
      <h2>Sicherheitshinweise<span>Bitte vor dem Abflug lesen</span></h2>
      <span class="safety-seat">Sitz<b>24C</b></span>
    </header>
    <div class="safety-grid">
      <section class="sc">
        <h3><i>1</i>Steuerung</h3>
        <div class="ctl ctl-mouse">
          <h4>${ico('target')}Maus &amp; Tastatur</h4>
          <ul>
            <li><span class="keys"><kbd>Klick</kbd></span>Zielen &amp; Mütze werfen</li>
            <li><span class="keys"><kbd>Rechtsklick</kbd><kbd>Leertaste</kbd><kbd>R</kbd></span>Nachladen</li>
            <li><span class="keys"><kbd>Maus an den Rand</kbd><kbd>A</kbd><kbd>D</kbd><kbd>←</kbd><kbd>→</kbd></span>Schwenken</li>
            <li><span class="keys"><kbd>P</kbd><kbd>Esc</kbd></span>Pause<span class="keys keys-inline"><kbd>M</kbd></span>Ton</li>
          </ul>
        </div>
        <div class="ctl ctl-touch">
          <h4>${ico('phone')}Touch</h4>
          <ul>
            <li><span class="keys"><kbd>Tippen</kbd></span>Mütze werfen</li>
            <li><span class="keys"><kbd>Leisten links/rechts halten</kbd></span>Schwenken</li>
            <li><span class="keys"><kbd>Mützen-Button</kbd></span>Nachladen (unten rechts)</li>
          </ul>
        </div>
        <p class="note">8 Mützen pro Magazin. Leeres Magazin + Wurf = automatisch nachladen. Eine Runde dauert 90 Sekunden.</p>
      </section>
      <section class="sc">
        <h3><i>2</i>Punkte</h3>
        <table class="pts">
          <thead><tr><th></th><th>nah</th><th>mittel</th><th>fern</th></tr></thead>
          <tbody>
            <tr><th>${ico('eagle')}Steinadler</th><td>25</td><td>50</td><td>100</td></tr>
            <tr><th>${ico('eagle')}Weißkopfseeadler</th><td colspan="3">×1,5<span class="pts-x"> – schnell &amp; im Zickzack</span></td></tr>
          </tbody>
        </table>
        <p class="pts-hint">Je weiter weg, desto kleiner – und desto mehr Punkte.</p>
        <ul class="bonus">
          <li><span class="b-ico gold">${ico('star')}</span><span>Goldadler<small>selten &amp; flink</small></span><b>500</b></li>
          <li><span class="b-ico">${ico('eagle')}</span><span>Versteck-Adler<small>lugt hinter Dachkanten hervor</small></span><b>250</b></li>
          <li><span class="b-ico red">${ico('gift')}</span><span>Geschenk am Fallschirm</span><b>+150</b></li>
          <li><span class="b-ico red">${ico('sleigh')}</span><span>Rentierschlitten<small>Treffer: es regnet 3 Geschenke</small></span><b>3×${ico('gift', 'mini')}</b></li>
          <li><span class="b-ico">${ico('target')}</span><span>Nachschuss<small>auf einen fallenden Adler</small></span><b>+25</b></li>
        </ul>
      </section>
      <section class="sc">
        <h3><i>3</i>Combo &amp; Strafe</h3>
        <div class="combo-steps">
          <div><b>×2</b><span>ab 3 in Folge</span></div>
          <div><b>×3</b><span>ab 6</span></div>
          <div><b>×4</b><span>ab 10</span></div>
        </div>
        <p class="note">Ein Fehlwurf setzt die Serie zurück.</p>
        <div class="penalty">
          <span class="pen-ico">${ico('plane')}</span>
          <p><b>−50</b> Mütze auf ein Flugzeug<small>„Tower: Bitte keine Mützen auf Flugzeuge!“</small></p>
        </div>
        <div class="rushinfo"><b>Rush Hour</b> In den letzten 10 Sekunden wird es hektisch – der Countdown piept.</div>
      </section>
    </div>
  </article>
  <nav class="foot-nav nav-group">
    <button class="btn btn-ink btn-sm" type="button" data-act="back"><span class="pict">${ico('back')}</span><span class="lbl">Zurück</span></button>
    <button class="btn btn-go btn-sm js-first" type="button" data-act="play"><span class="pict">${ico('depart')}</span><span class="lbl">Spielen</span></button>
  </nav>
</section>

<div class="rotate" hidden role="dialog" aria-modal="true" aria-label="Bitte quer halten">
  <div class="rotate-box">
    <div class="rotate-anim" aria-hidden="true"><span class="rotate-phone">${ico('phone')}</span><span class="rotate-arc"></span></div>
    <p class="rotate-title">Bitte quer halten</p>
    <p class="rotate-txt">Die Adler-Jagd macht im Querformat am meisten Spaß – mehr Himmel, mehr Adler.</p>
    <button class="btn btn-ink btn-sm" type="button" data-act="rotate-ok"><span class="lbl">Trotzdem spielen</span></button>
  </div>
</div>`;

const PASS_TEMPLATE = `<span class="pass-card">
<span class="pass-top"><span class="pass-kicker">Bordkarte</span>${ico('snow', 'pass-snow')}</span>
<span class="pass-body">
  <span class="pass-route">
    <span class="pass-from"><small>Von</small><b>XMS</b><em>Nordpol</em></span>
    ${ico('plane', 'pass-plane')}
    <span class="pass-to"><small>Nach</small><b class="pass-iata"></b></span>
  </span>
  <span class="pass-city"></span>
  <span class="pass-name"></span>
  <span class="pass-sub"></span>
  <span class="pass-fields">
    <span><small>Flug</small><b class="f-flight"></b></span>
    <span><small>Gate</small><b class="f-gate"></b></span>
    <span><small>Sitz</small><b class="f-seat"></b></span>
  </span>
</span>
<span class="pass-stub"><span class="pass-barcode"></span><span class="pass-cta">Einsteigen${ico('arrow')}</span></span>
</span>`;

// --- Hilfsfunktionen ---------------------------------------------------------------------

function hash(str) {
  let h = 2166136261;
  for (const ch of String(str)) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function fmt(n) {
  return Math.round(Number(n) || 0).toLocaleString('de-DE');
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function anim(node, keyframes, opts) {
  if (STILL || !node || typeof node.animate !== 'function') return null;
  try { return node.animate(keyframes, opts); } catch { return null; }
}

const FLIP_KF = [{ transform: 'scaleY(.08)', opacity: 0.35 }, { transform: 'scaleY(1)', opacity: 1 }];
const FLIP_OPT = { duration: 150, easing: 'cubic-bezier(.3,1.5,.6,1)' };

// Einzelne Fallblatt-Kacheln für Punkte und Uhr
function makeFlaps(container, n, extra = '') {
  container.textContent = '';
  const chars = [];
  for (let i = 0; i < n; i++) {
    const t = el('span', `flap ${extra}`);
    const c = el('span', 'flap-ch', ' ');
    t.append(c);
    container.append(t);
    chars.push(c);
  }
  return chars;
}

function setFlap(c, ch, flip) {
  if (c.textContent === ch) return;
  c.textContent = ch;
  if (flip) anim(c, FLIP_KF, FLIP_OPT);
}

// Zahl in Kacheln, führende Nullen gedimmt
function writeNumber(chars, value) {
  const n = chars.length;
  const neg = value < 0;
  const digits = String(Math.min(Math.abs(Math.round(value)), 10 ** (n - (neg ? 1 : 0)) - 1));
  const body = (neg ? '-' : '') + digits;
  const lead = n - body.length;
  for (let i = 0; i < n; i++) {
    const isLead = i < lead;
    setFlap(chars[i], isLead ? (neg ? ' ' : '0') : body[i - lead], false);
    const tile = chars[i].parentNode;
    if (tile._lead !== isLead) {
      tile._lead = isLead;
      tile.classList.toggle('lead', isLead);
    }
  }
}

// --- Fallblatt-Tafel (Bestenliste) --------------------------------------------------------

class FlapBoard {
  constructor(root, cols, minRows = 0) {
    this.rowsEl = root.querySelector('.board-rows');
    this.cols = cols;
    this.minRows = minRows;
    this.spin = [];
    this.timer = 0;
    const head = root.querySelector('.board-cols');
    head.textContent = '';
    for (const c of cols) {
      const s = el('span', `bcol ${c.cls}`, c.label);
      s.style.setProperty('--n', c.len);
      head.append(s);
    }
  }

  _cells(text, len, align) {
    let chars = Array.from(String(text ?? '').toUpperCase()).slice(0, len);
    const pad = Array(len - chars.length).fill(' ');
    chars = align === 'right' ? pad.concat(chars) : chars.concat(pad);
    return chars;
  }

  render(rows) {
    this.stop();
    // Leere Zeilen auffüllen, damit die Tafel ihre Größe behält
    rows = rows.slice();
    while (rows.length < this.minRows) rows.push({ blank: true });
    const frag = document.createDocumentFragment();
    const now = performance.now();
    rows.forEach((r, ri) => {
      const row = el('div', `brow${r.own ? ' own' : ''}${r.sep ? ' sep' : ''}${r.msg ? ' msg' : ''}${r.blank ? ' blank' : ''}`);
      let ci = 0;
      const groups = r.msg ? [{ cls: 'c-msg', len: this.cols.reduce((s, c) => s + c.len, 0), text: r.msg, align: 'center' }]
        : this.cols.map((c) => ({ ...c, text: r[c.key], extra: c.key === 'status' ? r.statusCls : '' }));
      for (const g of groups) {
        const span = el('span', `bcol ${g.cls}${g.extra ? ` ${g.extra}` : ''}`);
        span.style.setProperty('--n', g.len);
        let cells;
        if (g.align === 'center') {
          const t = Array.from(String(g.text).toUpperCase()).slice(0, g.len);
          const left = Math.floor((g.len - t.length) / 2);
          cells = Array(left).fill(' ').concat(t, Array(g.len - left - t.length).fill(' '));
        } else {
          cells = this._cells(g.text, g.len, g.align);
        }
        for (const ch of cells) {
          const t = el('span', 't');
          if (ch === ' ' || r.sep || STILL) {
            t.textContent = ch;
          } else {
            t.textContent = ' ';
            const start = now + ri * 55 + ci * 11 + Math.random() * 90;
            this.spin.push({ el: t, target: ch, start, end: start + 220 + Math.random() * 300, on: false });
          }
          span.append(t);
          ci++;
        }
        row.append(span);
      }
      frag.append(row);
    });
    this.rowsEl.textContent = '';
    this.rowsEl.append(frag);
    // Eigenen Eintrag in den sichtbaren Bereich holen
    const own = this.rowsEl.querySelector('.own');
    this.rowsEl.scrollTop = own ? Math.max(0, own.offsetTop - this.rowsEl.clientHeight / 2) : 0;
    if (this.spin.length) this.timer = setInterval(() => this.tick(), 50);
  }

  message(text) {
    this.render([{ msg: text }]);
  }

  tick() {
    const now = performance.now();
    let active = 0;
    for (const s of this.spin) {
      if (s.done) continue;
      if (now < s.start) {
        active++;
        continue;
      }
      if (now >= s.end) {
        s.el.textContent = s.target;
        s.el.classList.remove('spin');
        s.done = true;
        continue;
      }
      active++;
      if (!s.on) {
        s.on = true;
        s.el.classList.add('spin');
      }
      s.el.textContent = FLAP_CHARS[(Math.random() * FLAP_CHARS.length) | 0];
    }
    if (active) audio.play('flap', { vol: 0.8 });
    else this.stop();
  }

  stop() {
    clearInterval(this.timer);
    this.timer = 0;
    for (const s of this.spin) {
      if (!s.done) {
        s.el.textContent = s.target;
        s.el.classList.remove('spin');
      }
    }
    this.spin = [];
  }
}

function statusFor(entry, rank, own) {
  if (own) return ['DAS BIST DU', 's-own'];
  if (rank === 1) return ['ERSTE KLASSE', 's-gold'];
  if (rank <= 3) return ['BOARDING', 's-green s-blink'];
  return STATUS_POOL[hash(`${entry.id}|${entry.name}`) % STATUS_POOL.length];
}

function boardRows(scores, { ownId = null, own = null } = {}) {
  // Rang = Position (der Server sortiert Gleichstände nach Eintragszeit und zählt genauso)
  const rows = scores.map((s, i) => {
    const isOwn = ownId != null && String(s.id) === String(ownId);
    const pts = Math.max(0, Math.round(Number(s.score) || 0));
    const [status, statusCls] = statusFor(s, i + 1, isOwn);
    return { rank: String(i + 1), name: s.name, ap: s.airport, pts: String(pts), status, statusCls, own: isOwn };
  });
  // Eigener Eintrag außerhalb der Liste: hinten anhängen
  if (own && ownId != null && !rows.some((r) => r.own)) {
    rows.push({ sep: true, rank: '·', name: '· · ·', ap: '', pts: '', status: '' });
    rows.push({ rank: String(own.rank ?? ''), name: own.name, ap: own.airport, pts: String(own.score), status: 'DAS BIST DU', statusCls: 's-own', own: true });
  }
  return rows;
}

// --- Oberfläche ----------------------------------------------------------------------------

export function createUI(handlers = {}) {
  const noop = () => {};
  const h = {
    onStart: noop, onPreview: noop, onPause: noop, onResume: noop, onQuit: noop, onRestart: noop,
    onReload: noop, onPanHold: noop, onToggleMute: noop, onUserGesture: noop, ...handlers,
  };
  const root = document.getElementById('ui-root');
  const stageEl = root.parentElement;
  root.classList.add('ui');
  root.classList.toggle('still', STILL);
  root.innerHTML = TEMPLATE;

  const $ = (sel, scope = root) => scope.querySelector(sel);
  const $$ = (sel, scope = root) => Array.from(scope.querySelectorAll(sel));
  const screens = {};
  for (const s of $$('.scr')) screens[s.dataset.scr] = s;

  let current = null;
  let airports = [];
  let touch = false;
  let muted = false;
  let hudAirport = null;
  let guessAirport = null;
  let previewTimer = 0;
  let rotateDismissed = false;
  let lastOwn = null;

  const canFs = !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
  for (const b of $$('.js-fs')) b.hidden = !canFs;

  // Laufschrift
  const tickerText = TICKER.map((t) => `+++ ${t} `).join('') + '+++';
  for (const t of $$('.ticker-txt')) t.textContent = `${tickerText}  `;

  // --- HUD-Elemente
  const hud = {
    score: makeFlaps($('.score-flaps'), 6, 'num'),
    clock: makeFlaps($('.clock-flaps'), 4, 'num'),
    clockBox: $('.hud-clock'),
    scoreBox: $('.hud-score'),
    combo: $('.combo'),
    comboX: $('.combo-x'),
    comboN: $('.combo-n'),
    badge: $('.ap-badge'),
    badgeCode: $('.ap-code'),
    badgeCity: $('.ap-city'),
    hats: [],
    hatsBox: $('.ammo-hats'),
    ammo: $('.ammo'),
    bar: $('.reload-bar i'),
    hint: $('.reload-hint'),
    hintHow: $('.reload-how'),
    rbtn: $('.reload-btn'),
    rring: $('.rb-fg'),
    rcount: $('.rb-count'),
    toast: $('.toast'),
    toastMsg: $('.toast-msg'),
    toastPts: $('.toast-pts'),
    banner: $('.banner'),
    bannerMain: $('.banner-main'),
    bannerSub: $('.banner-sub'),
    pill: $('.pill'),
  };
  hud.clock[1].parentNode.classList.add('colon');
  const RING = 2 * Math.PI * 45;
  hud.rring.style.strokeDasharray = `${RING}`;
  hud.rring.style.strokeDashoffset = `${RING}`;
  let hs = null;
  const anims = {};

  function resetHud() {
    hs = { disp: 0, secs: -1, time: Infinity, ammo: -1, max: -1, reloading: null, rp: -1, empty: null, hintUntil: 0, mult: -1, combo: -1, urgent: null };
    writeNumber(hud.score, 0);
    for (const k of ['banner', 'toast', 'pill']) {
      anims[k]?.cancel();
      hud[k].hidden = true;
    }
    hud.combo.hidden = true;
    hudAirport = null;
    hud.badge.hidden = true;
  }
  resetHud();

  function buildHats(n) {
    hud.hatsBox.textContent = '';
    hud.hats = [];
    for (let i = 0; i < n; i++) {
      const s = el('span', 'hat');
      s.innerHTML = '<svg aria-hidden="true"><use href="#i-hat"/></svg>';
      hud.hatsBox.append(s);
      hud.hats.push(s);
    }
  }

  function setBadge(id) {
    const a = airports.find((x) => x.id === id);
    if (!a) return false;
    hudAirport = id;
    hud.badgeCode.textContent = a.iata || a.id;
    hud.badgeCity.textContent = a.city || a.name || '';
    hud.badge.hidden = false;
    return true;
  }

  function renderClock(secs) {
    const s = clamp(secs, 0, 599);
    const m = Math.floor(s / 60);
    const r = s % 60;
    const str = `${m}:${String(r).padStart(2, '0')}`;
    for (let i = 0; i < 4; i++) setFlap(hud.clock[i], str[i], i !== 1);
  }

  function updateHud(d) {
    if (!d || !hs) return;
    const tl = Math.max(0, Number(d.timeLeft) || 0);
    if (tl > hs.time + 1.5) resetHud();
    hs.time = tl;

    if (!hudAirport) {
      const id = window.weihad?.airport?.id || guessAirport;
      if (id) setBadge(id);
    }

    // Punkte mit Zähl-Animation
    const target = Math.round(Number(d.score) || 0);
    if (hs.disp !== target) {
      const diff = target - hs.disp;
      let step = diff * 0.2;
      if (Math.abs(step) < 1) step = Math.sign(diff);
      hs.disp = Math.abs(diff) <= 1 ? target : Math.round(hs.disp + step);
      writeNumber(hud.score, hs.disp);
    }

    // Uhr
    const secs = Math.ceil(tl - 1e-6);
    if (secs !== hs.secs) {
      hs.secs = secs;
      renderClock(secs);
      const urgent = secs <= 10 && secs > 0;
      if (urgent !== hs.urgent) {
        hs.urgent = urgent;
        hud.clockBox.classList.toggle('urgent', urgent);
      }
    }

    // Munition
    const max = Math.max(1, Number(d.maxAmmo) || 8);
    const ammo = clamp(Number(d.ammo) || 0, 0, max);
    if (max !== hs.max) {
      hs.max = max;
      hs.ammo = -1;
      buildHats(max);
    }
    if (ammo !== hs.ammo) {
      hud.hats.forEach((s, i) => s.classList.toggle('empty', i >= ammo));
      if (hs.ammo > ammo) {
        for (let i = ammo; i < hs.ammo; i++) {
          anim(hud.hats[i].firstChild, [
            { transform: 'translateY(0) rotate(0) scale(1)', opacity: 1 },
            { transform: 'translateY(-22px) rotate(-30deg) scale(1.25)', opacity: 0 },
          ], { duration: 260, easing: 'ease-out' });
        }
      } else if (hs.ammo >= 0 && ammo > hs.ammo) {
        for (let i = hs.ammo; i < ammo; i++) {
          anim(hud.hats[i].firstChild, [
            { transform: 'translateY(10px) scale(.4)', opacity: 0 },
            { transform: 'translateY(-4px) scale(1.15)', opacity: 1, offset: 0.7 },
            { transform: 'translateY(0) scale(1)', opacity: 1 },
          ], { duration: 260, delay: (i - hs.ammo) * 32, easing: 'ease-out', fill: 'backwards' });
        }
      }
      hs.ammo = ammo;
      hud.rcount.textContent = String(ammo);
      hud.rbtn.classList.toggle('low', ammo <= 2);
      hud.rbtn.classList.toggle('empty', ammo <= 0);
    }

    // Nachladen
    const rl = d.reloading;
    const reloading = rl !== false && rl != null;
    if (reloading !== hs.reloading) {
      hs.reloading = reloading;
      hud.ammo.classList.toggle('is-reloading', reloading);
      hud.rbtn.classList.toggle('is-reloading', reloading);
      hs.rp = -1;
      if (!reloading) {
        hud.bar.style.transform = 'scaleX(0)';
        hud.rring.style.strokeDashoffset = `${RING}`;
      }
    }
    if (reloading) {
      const p = clamp(Number(rl) || 0, 0, 1);
      if (Math.abs(p - hs.rp) > 0.012) {
        hs.rp = p;
        hud.bar.style.transform = `scaleX(${p.toFixed(3)})`;
        hud.rring.style.strokeDashoffset = `${(RING * (1 - p)).toFixed(1)}`;
      }
    }

    // „NACHLADEN!“ bei leerem Magazin – nach einem Leer-Klick kurz nachleuchten
    const showHint = ammo <= 0 && (!reloading || performance.now() < hs.hintUntil);
    if (showHint !== hs.empty) {
      hs.empty = showHint;
      hud.hint.hidden = !showHint;
    }

    // Combo
    const mult = Number(d.multiplier) || 1;
    const combo = Number(d.combo) || 0;
    if (mult !== hs.mult || combo !== hs.combo) {
      const grew = mult > hs.mult && hs.mult > 0;
      hs.mult = mult;
      hs.combo = combo;
      hud.combo.hidden = mult <= 1;
      if (mult > 1) {
        hud.comboX.textContent = `×${mult}`;
        hud.comboN.textContent = String(combo);
        if (grew) anim(hud.combo, [{ transform: 'scale(1.5) rotate(-6deg)' }, { transform: 'scale(1) rotate(-2deg)' }], { duration: 320, easing: 'cubic-bezier(.2,1.6,.5,1)' });
      }
    }
  }

  function flash(key, node, keyframes, duration) {
    anims[key]?.cancel();
    node.hidden = false;
    const a = anim(node, keyframes, { duration, easing: 'ease-out', fill: 'forwards' });
    anims[key] = a;
    if (a) a.onfinish = () => { node.hidden = true; };
    else setTimeout(() => { node.hidden = true; }, duration);
  }

  function banner(main, sub, variant) {
    hud.banner.className = `banner banner-${variant}`;
    hud.bannerMain.textContent = main;
    hud.bannerSub.textContent = sub || '';
    hud.bannerSub.hidden = !sub;
    flash('banner', hud.banner, [
      { opacity: 0, transform: 'scale(1.8) rotate(-6deg)' },
      { opacity: 1, transform: 'scale(.94) rotate(-2deg)', offset: 0.1 },
      { opacity: 1, transform: 'scale(1) rotate(-2deg)', offset: 0.16 },
      { opacity: 1, transform: 'scale(1) rotate(-2deg)', offset: 0.82 },
      { opacity: 0, transform: 'translateY(-24px) scale(.96) rotate(-2deg)' },
    ], variant === 'combo' ? 1300 : 2100);
  }

  function toast(msg, points) {
    hud.toastMsg.textContent = msg;
    const p = Number(points);
    hud.toastPts.textContent = Number.isFinite(p) && p !== 0 ? `−${Math.abs(p)}` : '';
    flash('toast', hud.toast, [
      { opacity: 0, transform: 'translateY(-16px)' },
      { opacity: 1, transform: 'translateY(0)', offset: 0.08 },
      { opacity: 1, transform: 'translateX(-4px)', offset: 0.12 },
      { opacity: 1, transform: 'translateX(4px)', offset: 0.16 },
      { opacity: 1, transform: 'translateX(0)', offset: 0.2 },
      { opacity: 1, transform: 'translateY(0)', offset: 0.86 },
      { opacity: 0, transform: 'translateY(-10px)' },
    ], 2600);
  }

  function pill(text) {
    hud.pill.textContent = text;
    flash('pill', hud.pill, [
      { opacity: 0, transform: 'translateY(12px) scale(.8)' },
      { opacity: 1, transform: 'translateY(0) scale(1.06)', offset: 0.15 },
      { opacity: 1, transform: 'translateY(0) scale(1)', offset: 0.75 },
      { opacity: 0, transform: 'translateY(-14px) scale(1)' },
    ], 1200);
  }

  function bump(node, k = 1.12) {
    anim(node, [{ transform: `scale(${k})` }, { transform: 'scale(1)' }], { duration: 220, easing: 'ease-out' });
  }

  function specialInfo(kind, label) {
    const k = String(kind || '').toLowerCase();
    if (/gold/.test(k)) return ['GOLDADLER!', '500 Punkte – schnell, bevor er weg ist!', 'gold'];
    if (/treffer|hit|regen|rain/.test(k)) return [String(label || 'Geschenkregen!').toUpperCase(), 'Drei Geschenke im Anflug', 'sleigh'];
    if (/sleigh|schlitten|rentier|reindeer|santa/.test(k)) return ['RENTIERSCHLITTEN!', 'Treffer = Geschenkregen', 'sleigh'];
    if (/hid|peek|versteck/.test(k)) return ['VERSTECK-ADLER!', 'Lugt hinter der Dachkante hervor', 'gold'];
    if (/gift|geschenk|present/.test(k)) return ['GESCHENK!', 'Am Fallschirm – +150', 'sleigh'];
    return [String(label || kind || 'Bonus!').toUpperCase(), '', 'gold'];
  }

  function bonusLabel(kind) {
    const k = String(kind || '').toLowerCase();
    if (/gold/.test(k)) return 'Goldadler';
    if (/gift|geschenk|present/.test(k)) return 'Geschenk';
    if (/hid|peek|versteck/.test(k)) return 'Versteck-Adler';
    if (/sleigh|schlitten|rentier/.test(k)) return 'Schlitten';
    if (/follow|nach|falling|rebound|extra/.test(k)) return 'Nachschuss';
    return 'Bonus';
  }

  // --- Flughafen-Bordkarten
  const passesEl = $('.passes');

  function buildPasses() {
    passesEl.textContent = '';
    const list = [...airports, RANDOM_CARD];
    list.forEach((a, i) => {
      const b = el('button', `pass${a.id === 'RND' ? ' pass-rnd' : ''}`);
      b.type = 'button';
      b.dataset.id = a.id;
      b.style.setProperty('--i', i);
      const th = a.theme || {};
      if (th.accent) b.style.setProperty('--accent', th.accent);
      if (th.skyTop) b.style.setProperty('--sky1', th.skyTop);
      if (th.skyBottom) b.style.setProperty('--sky2', th.skyBottom);
      b.innerHTML = PASS_TEMPLATE;
      const hsh = hash(a.id);
      $('.pass-iata', b).textContent = a.iata || a.id;
      $('.pass-city', b).textContent = a.city || '';
      $('.pass-name', b).textContent = a.name || '';
      $('.pass-sub', b).textContent = a.subtitle || '';
      $('.f-flight', b).textContent = `WH ${String(1200 + (hsh % 800)).padStart(4, '0')}`;
      $('.f-gate', b).textContent = `${'ABCDE'[hsh % 5]}${((hsh >>> 4) % 40) + 1}`;
      $('.f-seat', b).textContent = `${((hsh >>> 9) % 38) + 1}${'ACDF'[(hsh >>> 3) % 4]}`;
      $('.pass-barcode', b).style.setProperty('--bc', `${hsh % 97}px`);
      b.setAttribute('aria-label', a.id === 'RND'
        ? 'Zufallsziel – der Tower entscheidet'
        : `${a.city || a.name} – ${a.name}${a.subtitle ? `: ${a.subtitle}` : ''}`);
      b.addEventListener('pointerenter', (e) => {
        if (e.pointerType !== 'mouse') return;
        // Fokus folgt der Maus, damit immer nur eine Karte hervorgehoben ist
        if (document.activeElement !== b) b.focus({ preventScroll: true });
        else schedulePreview(a.id);
      });
      b.addEventListener('focus', () => schedulePreview(a.id));
      b.addEventListener('click', () => {
        clearTimeout(previewTimer);
        audio.play('click');
        if (a.id !== 'RND') guessAirport = a.id;
        h.onStart(a.id);
      });
      passesEl.append(b);
    });
  }

  // Fallblatt „Nächster Abflug“ über den Bordkarten
  const destFlaps = makeFlaps($('.dest-flaps'), 12, 'dest');
  let destText = '';
  const destTimers = [];
  function setDest(id) {
    const a = id === 'RND' ? RANDOM_CARD : airports.find((x) => x.id === id);
    const text = String(a?.city || '').toUpperCase().slice(0, 12).padEnd(12, ' ');
    if (text === destText) return;
    destText = text;
    while (destTimers.length) clearTimeout(destTimers.pop());
    destFlaps.forEach((c, i) => {
      if (STILL) setFlap(c, text[i], false);
      else destTimers.push(setTimeout(() => setFlap(c, text[i], true), i * 28));
    });
    audio.play('flap');
  }

  function schedulePreview(id) {
    clearTimeout(previewTimer);
    setDest(id);
    if (id === 'RND') return;
    previewTimer = setTimeout(() => {
      if (current === 'select') {
        guessAirport = id;
        h.onPreview(id);
      }
    }, PREVIEW_DELAY);
  }

  // --- Bestenliste
  const scoresScr = screens.scores;
  const FULL_COLS = [
    { key: 'rank', cls: 'c-rank', len: 3, align: 'right', label: 'Nr.' },
    { key: 'name', cls: 'c-name', len: 16, label: 'Passagier' },
    { key: 'ap', cls: 'c-ap', len: 3, label: 'Ziel' },
    { key: 'pts', cls: 'c-pts', len: 6, align: 'right', label: 'Punkte' },
    { key: 'status', cls: 'c-status', len: 13, label: 'Status' },
  ];
  const MINI_COLS = [
    { key: 'rank', cls: 'c-rank', len: 3, align: 'right', label: 'Nr.' },
    { key: 'name', cls: 'c-name', len: 12, label: 'Passagier' },
    { key: 'ap', cls: 'c-ap', len: 3, label: 'Ziel' },
    { key: 'pts', cls: 'c-pts', len: 6, align: 'right', label: 'Punkte' },
  ];
  const fullBoard = new FlapBoard($('.board-full', scoresScr), FULL_COLS, 10);
  const miniBoard = new FlapBoard($('.board-mini'), MINI_COLS, 10);
  const tabsEl = $('.tabs', scoresScr);
  const scoresNote = $('.board-note', scoresScr);
  let scoreTab = 'ALL';
  let scoreToken = 0;
  let clockTimer = 0;

  function buildTabs() {
    tabsEl.textContent = '';
    for (const id of ['ALL', ...airports.map((a) => a.id)]) {
      const b = el('button', 'tab', id === 'ALL' ? 'Alle' : id);
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.dataset.tab = id;
      b.setAttribute('aria-selected', String(id === scoreTab));
      b.addEventListener('click', () => {
        audio.play('click');
        loadScores(id);
      });
      tabsEl.append(b);
    }
  }

  async function loadScores(tab) {
    scoreTab = tab;
    for (const b of $$('.tab', tabsEl)) b.setAttribute('aria-selected', String(b.dataset.tab === tab));
    const token = ++scoreToken;
    fullBoard.message('Bitte warten');
    scoresNote.textContent = 'Anzeige wird aktualisiert …';
    scoresNote.className = 'board-note';
    try {
      const { scores, online } = await fetchScores({ airport: tab, limit: 20 });
      if (token !== scoreToken) return;
      if (scores.length) fullBoard.render(boardRows(scores, { ownId: lastOwn?.id }));
      else fullBoard.message(tab === 'ALL' ? 'Noch keine Flüge' : `Noch keine Flüge nach ${tab}`);
      scoresNote.textContent = online ? `${scores.length} ${scores.length === 1 ? 'Eintrag' : 'Einträge'}` : 'Offline – lokale Bestenliste';
      scoresNote.classList.toggle('offline', !online);
    } catch (err) {
      if (token !== scoreToken) return;
      fullBoard.message('Störung');
      scoresNote.textContent = err?.message || 'Bestenliste nicht erreichbar.';
      scoresNote.classList.add('offline');
    }
  }

  function tickClock() {
    const d = new Date();
    const str = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    for (const c of $$('.board-clock')) c.textContent = str;
  }

  // --- Game Over
  const over = {
    scr: screens.over,
    flaps: makeFlaps($('.o-flaps'), 6, 'num big'),
    ap: $('.o-ap'),
    city: $('.o-city'),
    hits: $('.o-hits'),
    shots: $('.o-shots'),
    acc: $('.o-acc'),
    combo: $('.o-combo'),
    extra: $('.o-extra'),
    form: $('.entry'),
    input: $('.entry-in'),
    btn: $('.entry-btn'),
    msg: $('.entry-msg'),
    stamp: $('.stamp'),
    stampN: $('.stamp-n'),
    stampSub: $('.stamp-sub'),
    note: $('.board-mini .board-note'),
    stats: null,
    busy: false,
    done: false,
    raf: 0,
    token: 0,
  };

  function overMsg(text, kind = '') {
    over.msg.textContent = text;
    over.msg.className = `entry-msg ${kind}`;
  }

  function countUp(target) {
    cancelAnimationFrame(over.raf);
    const t0 = performance.now();
    const dur = clamp(Math.abs(target) / 4, 500, 1400);
    const step = (now) => {
      const k = Math.min(1, (now - t0) / dur);
      writeNumber(over.flaps, Math.round(target * (1 - Math.pow(1 - k, 3))));
      if (k < 1) over.raf = requestAnimationFrame(step);
    };
    if (STILL) {
      writeNumber(over.flaps, target);
      return;
    }
    writeNumber(over.flaps, 0);
    over.raf = requestAnimationFrame(step);
  }

  async function loadMini(own) {
    const token = ++over.token;
    miniBoard.message('Bitte warten');
    over.note.textContent = '';
    try {
      const { scores, online } = await fetchScores({ airport: 'ALL', limit: 10 });
      if (token !== over.token) return;
      if (scores.length || own) miniBoard.render(boardRows(scores, { ownId: own?.id, own }));
      else miniBoard.message('Noch keine Flüge');
      over.note.textContent = online ? 'Alle Flughäfen' : 'Offline – lokale Bestenliste';
      over.note.classList.toggle('offline', !online);
    } catch (err) {
      if (token !== over.token) return;
      miniBoard.message('Störung');
      over.note.textContent = err?.message || 'Bestenliste nicht erreichbar.';
    }
  }

  function showGameOver(stats = {}) {
    const s = {
      score: Math.round(Number(stats.score) || 0),
      hits: Math.max(0, Number(stats.hits) || 0),
      shots: Math.max(0, Number(stats.shots) || 0),
      bestCombo: Math.max(0, Number(stats.bestCombo) || 0),
      airport: String(stats.airport || hudAirport || guessAirport || airports[0]?.id || 'FRA').toUpperCase(),
    };
    s.accuracy = Number.isFinite(stats.accuracy) ? stats.accuracy : (s.shots ? s.hits / s.shots : 0);
    over.stats = s;
    over.done = false;
    over.busy = false;
    const a = airports.find((x) => x.id === s.airport);
    over.ap.textContent = a?.iata || s.airport;
    over.city.textContent = a?.city || a?.name || s.airport;
    $('.o-flaps').setAttribute('aria-label', `Ergebnis: ${fmt(s.score)} Punkte`);
    over.hits.textContent = fmt(s.hits);
    over.shots.textContent = fmt(s.shots);
    over.acc.textContent = `${Math.round(clamp(s.accuracy, 0, 1) * 100)} %`;
    over.combo.textContent = s.bestCombo ? fmt(s.bestCombo) : '–';
    const extras = [];
    if (Number.isFinite(stats.eagles)) extras.push(`${fmt(stats.eagles)} Adler`);
    if (Number.isFinite(stats.bonuses)) extras.push(`${fmt(stats.bonuses)} ${stats.bonuses === 1 ? 'Bonus' : 'Boni'}`);
    if (Number.isFinite(stats.penalties)) extras.push(`${fmt(stats.penalties)} ${stats.penalties === 1 ? 'Strafe' : 'Strafen'}`);
    over.extra.textContent = extras.join(' · ');
    over.extra.hidden = !extras.length;
    over.form.classList.remove('done');
    over.input.disabled = false;
    over.btn.disabled = false;
    $('.lbl', over.btn).textContent = 'Eintragen';
    try { over.input.value = localStorage.getItem(NAME_KEY) || ''; } catch { over.input.value = ''; }
    overMsg(s.score > 0 ? 'Enter drückt den Abflugknopf.' : 'Keine Punkte diesmal – Eintragen ist freiwillig.');
    over.stamp.hidden = true;
    over.scr.classList.toggle('zero', s.score <= 0);
    show('over');
    countUp(s.score);
    loadMini(null);
    if (!touch && s.score > 0) setTimeout(() => { if (current === 'over' && !over.done) over.input.focus({ preventScroll: true }); }, 450);
  }

  async function submit(e) {
    e?.preventDefault();
    if (over.busy || over.done || !over.stats) return;
    const name = over.input.value.normalize('NFC').replace(/\s+/g, ' ').trim();
    const bad = !name || Array.from(name).length > 16 ? 'Bitte einen Namen mit 1–16 Zeichen eingeben.'
      : !NAME_OK.test(name) ? 'Erlaubt sind Buchstaben, Ziffern, Leerzeichen und . _ - ! ? \' & + #' : '';
    if (bad) {
      overMsg(bad, 'err');
      anim(over.input, [{ transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(0)' }], { duration: 200 });
      over.input.focus();
      return;
    }
    try { localStorage.setItem(NAME_KEY, name); } catch { /* privat */ }
    over.busy = true;
    over.btn.disabled = true;
    overMsg('Übermittle an den Tower …');
    const s = over.stats;
    try {
      const res = await submitScore({ name, score: s.score, airport: s.airport, hits: s.hits, shots: s.shots, bestCombo: s.bestCombo });
      over.done = true;
      over.form.classList.add('done');
      over.input.disabled = true;
      $('.lbl', over.btn).textContent = 'Eingetragen';
      lastOwn = { id: res.id, rank: res.rank, name, airport: s.airport, score: s.score };
      if (res.rank) {
        const rk = String(res.rank);
        over.stampN.textContent = rk;
        // Lange Ränge (z. B. 1234) kleiner setzen, damit sie in den Stempel passen
        over.stamp.style.setProperty('--k', rk.length <= 2 ? '1' : rk.length === 3 ? '.74' : '.56');
        over.stampSub.textContent = res.online ? 'weltweit' : 'lokal';
        over.stamp.hidden = false;
        anim(over.stamp, [
          { opacity: 0, transform: 'scale(2.4) rotate(-24deg)' },
          { opacity: 1, transform: 'scale(.92) rotate(-12deg)', offset: 0.6 },
          { opacity: 1, transform: 'scale(1) rotate(-12deg)' },
        ], { duration: 420, easing: 'cubic-bezier(.2,.8,.3,1)' });
      }
      const parts = [];
      if (res.rank) parts.push(`Platz ${res.rank} ${res.online ? 'weltweit' : 'auf diesem Gerät'}`);
      if (res.airportRank) parts.push(`Platz ${res.airportRank} in ${s.airport}`);
      overMsg(res.online ? `${parts.join(' · ')}. Guten Flug!` : `Offline – lokal gespeichert. ${parts.join(' · ')}`, res.online ? 'ok' : 'warn');
      audio.play('bonus');
      loadMini(lastOwn);
      over.scr.querySelector('.js-first')?.focus({ preventScroll: true });
    } catch (err) {
      over.btn.disabled = false;
      overMsg(err?.message || 'Eintragen fehlgeschlagen – bitte erneut versuchen.', 'err');
    } finally {
      over.busy = false;
    }
  }
  over.form.addEventListener('submit', submit);

  // --- Touch-Steuerung
  const held = { '-1': false, 1: false };
  function updateHold() {
    const dir = (held[1] ? 1 : 0) - (held['-1'] ? 1 : 0);
    h.onPanHold(dir);
  }
  for (const b of $$('.hold')) {
    const dir = b.dataset.dir;
    const down = (e) => {
      e.preventDefault();
      try { b.setPointerCapture(e.pointerId); } catch { /* egal */ }
      held[dir] = true;
      b.classList.add('active');
      updateHold();
    };
    const up = () => {
      if (!held[dir]) return;
      held[dir] = false;
      b.classList.remove('active');
      updateHold();
    };
    b.addEventListener('pointerdown', down);
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture', 'pointerleave']) b.addEventListener(ev, up);
    b.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  function releaseHolds() {
    held['-1'] = false;
    held[1] = false;
    for (const b of $$('.hold')) b.classList.remove('active');
  }

  let rbSkipClick = false;
  hud.rbtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    rbSkipClick = true;
    h.onReload();
    bump(hud.rbtn, 0.9);
  });
  hud.rbtn.addEventListener('click', () => {
    if (rbSkipClick) {
      rbSkipClick = false;
      return;
    }
    h.onReload();
  });
  hud.rbtn.addEventListener('contextmenu', (e) => e.preventDefault());
  // HUD-Knöpfe sollen keinen Fokus behalten (sonst löst Leertaste/Enter sie aus)
  for (const b of $$('.hud-btn')) b.addEventListener('mousedown', (e) => e.preventDefault());

  // --- Vollbild
  function toggleFs() {
    const d = document;
    const isFs = d.fullscreenElement || d.webkitFullscreenElement;
    try {
      if (isFs) {
        (d.exitFullscreen || d.webkitExitFullscreen)?.call(d);
      } else {
        const de = d.documentElement;
        const req = de.requestFullscreen || de.webkitRequestFullscreen;
        const p = req?.call(de, { navigationUI: 'hide' });
        if (p && typeof p.then === 'function') {
          p.then(() => screen.orientation?.lock?.('landscape')).catch(() => {});
        }
      }
    } catch { /* nicht unterstützt */ }
  }
  const onFsChange = () => {
    const on = !!(document.fullscreenElement || document.webkitFullscreenElement);
    for (const b of $$('.js-fs')) b.classList.toggle('on', on);
  };
  document.addEventListener('fullscreenchange', onFsChange);
  document.addEventListener('webkitfullscreenchange', onFsChange);

  // --- Hochformat-Hinweis
  const rotateEl = $('.rotate');
  function updateRotate() {
    const portrait = window.innerHeight > window.innerWidth * 1.05;
    const showIt = touch && portrait && !rotateDismissed && current !== 'none';
    if (rotateEl.hidden !== !showIt) rotateEl.hidden = !showIt;
    // Laufende Runde anhalten, solange der Hinweis das Spielfeld verdeckt
    if (showIt && current === 'hud') {
      setTimeout(() => { if (current === 'hud' && !rotateEl.hidden) h.onPause(); }, 0);
    }
  }
  window.addEventListener('resize', updateRotate);
  window.addEventListener('orientationchange', () => setTimeout(updateRotate, 150));

  // --- Aktionen
  const ACTIONS = {
    play: () => show('select'),
    scores: () => show('scores'),
    help: () => show('help'),
    back: () => show('title'),
    mute: () => h.onToggleMute(),
    fs: () => toggleFs(),
    pause: () => h.onPause(),
    resume: () => h.onResume(),
    restart: () => h.onRestart(),
    quit: () => h.onQuit(),
    again: () => h.onRestart(),
    other: () => {
      h.onQuit();
      show('select');
    },
    'rotate-ok': () => {
      rotateDismissed = true;
      updateRotate();
    },
  };

  root.addEventListener('click', (e) => {
    const b = e.target.closest?.('[data-act]');
    if (!b || b.disabled || !root.contains(b)) return;
    const act = b.dataset.act;
    if (act !== 'mute') audio.play('click');
    ACTIONS[act]?.(b, e);
    if (act === 'mute') audio.play('click');
  });

  // Audio-Freischaltung bei jeder Nutzergeste (iOS verlangt resume() im Gesten-Handler)
  const gesture = () => h.onUserGesture();
  for (const ev of ['pointerdown', 'pointerup', 'touchend', 'keydown']) window.addEventListener(ev, gesture, { capture: true, passive: true });

  // Tastatur: Pfeiltasten in Menügruppen, Esc zurück
  window.addEventListener('keydown', (e) => {
    const tag = e.target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (e.key === 'Escape' && BACK_TO_TITLE.has(current)) {
      show('title');
      return;
    }
    const dirs = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 };
    if (!(e.key in dirs) || current === 'hud' || current === 'none' || !current) return;
    const scr = screens[current];
    let group = e.target?.closest?.('.nav-group');
    if (!group || !scr.contains(group)) {
      const first = scr.querySelector('.js-first') || scr.querySelector('button:not([disabled])');
      if (first && !scr.contains(document.activeElement)) {
        e.preventDefault();
        first.focus();
      }
      return;
    }
    const items = $$('button:not([disabled]):not([hidden])', group).filter((b) => b.offsetParent !== null);
    const i = items.indexOf(e.target);
    if (i < 0) return;
    e.preventDefault();
    const next = items[(i + dirs[e.key] + items.length) % items.length];
    next.focus();
    if (group === tabsEl) next.click();
  });

  // --- Bildschirmwechsel
  function show(s) {
    const prev = current;
    current = s;
    root.dataset.screen = s;
    stageEl.dataset.screen = s;
    for (const [name, node] of Object.entries(screens)) node.hidden = name !== s;
    clearTimeout(previewTimer);
    if (s !== 'hud' && s !== 'pause') {
      releaseHolds();
    }
    if (s === 'pause' && hs) {
      const left = Math.max(0, hs.secs);
      $('.pause-info').textContent = `${fmt(hs.disp)} Punkte · noch ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')} min`;
      $('.pause-info').hidden = hs.secs < 0;
    }
    if (s === 'hud' && prev !== 'pause') {
      resetHud();
      // Flughafen-Badge auch dann setzen, wenn die Simulation eingefroren ist (?freeze)
      setTimeout(() => { if (!hudAirport && (current === 'hud' || current === 'pause')) setBadge(window.weihad?.airport?.id || guessAirport); }, 0);
    }
    if (s === 'hud') {
      if (document.activeElement && root.contains(document.activeElement)) document.activeElement.blur();
    }
    if (s !== 'over') cancelAnimationFrame(over.raf);
    if (s === 'scores') loadScores(scoreTab);
    else fullBoard.stop();
    if (s !== 'over') miniBoard.stop();
    clearInterval(clockTimer);
    if (s === 'scores' || s === 'over') {
      tickClock();
      clockTimer = setInterval(tickClock, 10000);
    }
    if (s === 'select') {
      // Vorauswahl = Flughafen, der gerade im Hintergrund läuft (kein unerwarteter Szenenwechsel)
      const curId = window.weihad?.airport?.id || guessAirport || (QUERY.get('airport') || '').toUpperCase() || airports[0]?.id;
      setDest(curId);
      const sel = passesEl.querySelector(`[data-id="${CSS.escape(curId || '')}"]`) || passesEl.querySelector('.pass');
      if (sel && !touch) sel.focus({ preventScroll: true });
      if (sel && touch) passesEl.scrollLeft = Math.max(0, sel.offsetLeft - (passesEl.clientWidth - sel.offsetWidth) / 2);
    } else if (s !== 'hud' && s !== 'over' && screens[s] && !touch) {
      screens[s].querySelector('.js-first')?.focus({ preventScroll: true });
    }
    updateRotate();
  }

  const ui = {
    setAirports(list) {
      airports = Array.isArray(list) ? list.filter((a) => a && a.id) : [];
      buildPasses();
      buildTabs();
    },
    show,
    updateHud,
    showGameOver,
    setTouchMode(b) {
      touch = !!b;
      root.classList.toggle('is-touch', touch);
      hud.hintHow.textContent = touch ? 'Mützen-Button tippen' : 'Rechtsklick · Leertaste';
      updateRotate();
    },
    setMuted(b) {
      muted = !!b;
      for (const btn of $$('.js-mute')) {
        btn.querySelector('use')?.setAttribute('href', muted ? '#i-mute' : '#i-sound');
        btn.setAttribute('aria-pressed', String(muted));
        btn.setAttribute('aria-label', muted ? 'Ton einschalten' : 'Ton ausschalten');
        btn.classList.toggle('off', muted);
      }
      for (const l of $$('.js-mute-lbl')) l.textContent = muted ? 'Ton: aus' : 'Ton: an';
    },
    // Optional: Lead kann den aktiven Flughafen explizit setzen
    setAirport(id) {
      guessAirport = id;
      if (current === 'hud' || current === 'pause') setBadge(id);
    },
    event(type, data = {}) {
      if (current !== 'hud') return;
      switch (type) {
        case 'combo':
          if ((Number(data.multiplier) || 0) > 1) banner(`×${data.multiplier}`, 'Combo!', 'combo');
          break;
        case 'penalty': {
          const reason = String(data.reason || 'Bitte keine Mützen auf Flugzeuge!').replace(/^\s*tower\s*:\s*/i, '');
          toast(reason, data.points ?? -50);
          anim(hud.scoreBox, [{ transform: 'translateX(-5px)' }, { transform: 'translateX(5px)' }, { transform: 'translateX(0)' }], { duration: 180, iterations: 2 });
          break;
        }
        case 'special': {
          const [main, sub, variant] = specialInfo(data.kind, data.label);
          banner(main, sub, variant);
          break;
        }
        case 'bonus':
          if (Number(data.points) > 0) pill(`${String(data.label || bonusLabel(data.kind)).replace(/!+$/, '')} +${fmt(data.points)}`);
          bump(hud.scoreBox, 1.1);
          break;
        case 'hit':
          bump(hud.scoreBox, data.multiplier > 1 ? 1.1 : 1.06);
          break;
        case 'countdown':
          bump(hud.clockBox, 1.14);
          break;
        case 'empty':
          hs.hintUntil = performance.now() + 900;
          hs.empty = true;
          hud.hint.hidden = false;
          anim(hud.hint, [{ transform: 'scale(1.25)' }, { transform: 'scale(1)' }], { duration: 260, easing: 'ease-out' });
          anim(hud.ammo, [{ transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(0)' }], { duration: 160, iterations: 2 });
          break;
        default:
          break;
      }
    },
  };

  ui.setTouchMode(false);
  ui.setMuted(audio.muted);
  return ui;
}
