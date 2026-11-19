// The app shell and the entry point of the shipped file. Owner: T12 (plans/T12-app-shell.md).
//
// Builds the whole page from nothing (the container hands over a document with only <body>), boots
// the engine and every layer in the required order, then wires keys, touch buttons and the
// first-gesture audio start. Page state lives in classes on <body>: g (started, card gone),
// z (idle: touch bar and cursor hidden), h (interface hidden). Unknown one-letter tags are
// unstyled hooks that cost one character each: w (interface), c (card), n (touch bar), b (button),
// k (key hints), t (toast), m (failure message).
import { boot, quality, run, setMood, setQuality } from './engine';
import { init as backdrop } from './backdrop/index';
import { init as buildings } from './buildings/index';
import { init as street } from './street/index';
import { init as air } from './air/index';
import { init as lights } from './lights/index';
import { init as post } from './post/index';
import { cameraInit, cameraMode } from './camera/index';
import { audioHidden, audioMute, audioStart, audioStation } from './audio/index';

document.documentElement.innerHTML =
  '<title>Synthwave City</title>' +
  '<meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover">' +
  '<style>' +
  'body{margin:0;overflow:hidden;background:#0a0414;color:#dff4ff;font:600 14px system-ui,sans-serif;' +
  'touch-action:none;-webkit-user-select:none;user-select:none}' +
  'canvas{position:fixed;inset:0;width:100%;height:100%}' +
  'c,n,t,m{position:fixed;transition:opacity .6s}' +
  'c,t{background:#0a0414c0;border:1px solid #ff2bd6;border-radius:10px}' +
  'c{left:50%;top:40%;transform:translate(-50%,-50%);width:max-content;max-width:88%;box-sizing:border-box;' +
  'padding:20px 26px;text-align:center;line-height:1.7;pointer-events:none}' +
  'c b{display:block;font-size:24px;letter-spacing:.2em;color:#19f0ff;text-shadow:0 0 12px}' +
  'k{display:block;opacity:.7;font-size:12px}' +
  '@media(pointer:coarse){k{display:none}}' +
  'n{left:0;right:0;bottom:max(10px,env(safe-area-inset-bottom));display:flex;justify-content:center;gap:8px}' +
  'n b{width:48px;height:44px;line-height:44px;text-align:center;font-size:18px;cursor:pointer;' +
  'background:#1a0a3acc;border:1px solid #19f0ff88;border-radius:8px}' +
  'n b:active{background:#ff2bd6aa}' +
  't{left:50%;top:12%;transform:translateX(-50%);opacity:0;padding:8px 16px}' +
  'm{inset:0;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center;' +
  'font-size:18px;line-height:1.5;background:#0a0414}' +
  'm:empty{display:none}' +
  '.g c,.z n{opacity:0}.z n{pointer-events:none}.z{cursor:none}.h w{display:none}' +
  '</style><canvas></canvas><w>' +
  '<c><b>SYNTHWAVE CITY</b>Tap or press a key for sound' +
  '<k>M mute · R station · N mood · F fullscreen · Space fly · 1 2 3 quality · H hide</k></c>' +
  '<n><b>♪</b><b>♫</b><b>◐</b><b>▲</b><b>HD</b><b>□</b></n>' +
  '<t></t></w><m></m>';

const canvas = document.querySelector('canvas')!;
const body = document.body;
const toastBox = document.querySelector<HTMLElement>('t')!;
const notice = document.querySelector<HTMLElement>('m')!;
let mood = 0;
let started = 0;
let asleep = 0;
let idle = 0;
let fade = 0;

function sleep(): void {
  body.classList.add('z');
}

function wake(): void {
  body.classList.remove('z');
  clearTimeout(idle);
  idle = setTimeout(sleep, 3500);
}

function dim(): void {
  toastBox.style.opacity = '0';
}

function toast(text: string): void {
  toastBox.textContent = text;
  toastBox.style.opacity = '1';
  clearTimeout(fade);
  fade = setTimeout(dim, 1400);
}

// The first gesture. audioStart must run synchronously inside the handler.
function start(): void {
  if (!started) {
    started = 1;
    audioStart();
    body.classList.add('g');
  }
}

// One behaviour per key; the touch buttons call it with the key they stand for.
function act(k: string): void {
  switch (k) {
    case 'm':
      toast(audioMute() ? 'Muted' : 'Sound on');
      break;
    case 'r':
      toast('Station ' + (audioStation() + 1));
      break;
    case 'n':
      setMood(mood = (mood + 1) % 3);
      toast(['Sunset', 'Midnight', 'Miami'][mood]!);
      break;
    case ' ':
      toast(cameraMode() ? 'Free flight' : 'Tour');
      break;
    case 'f':
      document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
      break;
    case 'h':
      body.classList.toggle('h');
      break;
    case '0': // the quality button: the next one of 1, 2, 3
      k = (quality + 1) % 3 + 1 + '';
    // falls through
    case '1':
    case '2':
    case '3':
      setQuality(+k - 1);
      toast('Quality ' + k);
  }
}

if (boot(canvas)) {
  backdrop();
  buildings();
  street();
  air();
  lights();
  post();
  cameraInit(canvas);
  addEventListener('keydown', (e) => {
    wake();
    if (e.key.length < 2) start();
    if (!e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey) act(e.key.toLowerCase());
  });
  addEventListener('pointermove', wake);
  addEventListener('pointerdown', () => {
    // A tap that finds the bar faded only wakes it; its click must not press the invisible button.
    asleep = body.classList.contains('z') ? 1 : 0;
    wake();
  });
  addEventListener('pointerup', start);
  addEventListener('contextmenu', (e) => e.preventDefault());
  addEventListener('visibilitychange', () => audioHidden(document.hidden));
  document.querySelectorAll('n b').forEach((b, i) => b.addEventListener('click', () => asleep || act('mrn 0f'[i]!)));
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    notice.textContent = 'Graphics context lost. Waiting for the browser to restore it.';
  });
  canvas.addEventListener('webglcontextrestored', () => location.reload());
  wake();
  run();
} else {
  notice.textContent = 'This device does not offer WebGL 2, which the city needs.';
}
