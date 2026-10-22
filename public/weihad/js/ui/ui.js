// PLATZHALTER – wird vom UI-Agent ersetzt
export function createUI(handlers) {
  const root = document.getElementById('ui-root');
  let screen = 'title';
  const render = () => {
    root.innerHTML = screen === 'title'
      ? '<div style="position:absolute;inset:auto 0 40% 0;text-align:center"><button id="stub-start" style="font-size:24px;padding:12px 24px">Spielen</button></div>'
      : '';
    root.querySelector('#stub-start')?.addEventListener('click', () => { handlers.onUserGesture(); handlers.onStart('RND'); });
  };
  return {
    setAirports() {},
    show(s) { screen = s; render(); },
    updateHud() {},
    showGameOver() { screen = 'title'; render(); },
    setTouchMode() {},
    setMuted() {},
    event() {},
  };
}
