// Musik-Platzhalter. Trage später Dateien in TRACKS ein (z. B. 'assets/music/map.mp3'); null = stumm.
// Die Stimmungen (title, map, battle, winter, win, lose) werden von index.html an den passenden Stellen gewählt.
const Music = (function () {
  const TRACKS = { title: null, map: null, battle: null, winter: null, win: null, lose: null };
  let enabled = true, current = null, audio = null;
  try { enabled = localStorage.getItem('jc-music') !== 'off'; } catch (e) {}
  function play(mood) {
    if (mood === current) return;
    current = mood; if (audio) { audio.pause(); audio = null; }
    const src = TRACKS[mood];
    if (!enabled || !src) return;
    audio = new Audio(src); audio.loop = mood !== 'win' && mood !== 'lose'; audio.volume = 0.6;
    audio.play().catch(() => {});           // Autoplay kann bis zur ersten Interaktion blockiert sein
  }
  function setEnabled(on) {
    enabled = on; try { localStorage.setItem('jc-music', on ? 'on' : 'off'); } catch (e) {}
    const m = current; current = null; if (!on && audio) { audio.pause(); audio = null; } else play(m);
  }
  return { play, setEnabled, isEnabled: () => enabled, TRACKS };
})();
