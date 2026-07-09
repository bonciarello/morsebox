/* ============================================================
   MorseBox — Logica applicativa
   Conversione testo → Morse, riproduzione audio (Web Audio API)
   e lampada sincronizzata. Self-contained, nessuna API esterna.
   ============================================================ */

/* === Morse Code Map (International / ITU-R M.1677) === */
const MORSE_MAP = {
  'A': '.-',   'B': '-...', 'C': '-.-.', 'D': '-..',  'E': '.',
  'F': '..-.', 'G': '--.',  'H': '....', 'I': '..',   'J': '.---',
  'K': '-.-',  'L': '.-..', 'M': '--',   'N': '-.',   'O': '---',
  'P': '.--.', 'Q': '--.-', 'R': '.-.',  'S': '...',  'T': '-',
  'U': '..-',  'V': '...-', 'W': '.--',  'X': '-..-', 'Y': '-.--',
  'Z': '--..',
  '0': '-----', '1': '.----', '2': '..---', '3': '...--', '4': '....-',
  '5': '.....', '6': '-....', '7': '--...', '8': '---..', '9': '----.',
  '.': '.-.-.-', ',': '--..--', '?': '..--..', "'": '.----.',
  '!': '-.-.--', '/': '-..-.',  '(': '-.--.',  ')': '-.--.-',
  '&': '.-...',  ':': '---...', ';': '-.-.-.', '=': '-...-',
  '+': '.-.-.',  '-': '-....-', '_': '..--.-', '"': '.-..-.',
  '$': '...-..-', '@': '.--.-.'
};

/* === DOM References === */
const textInput   = document.getElementById('message-input');
const playBtn     = document.getElementById('play-btn');
const stopBtn     = document.getElementById('stop-btn');
const speedSlider = document.getElementById('speed-slider');
const speedValue  = document.getElementById('speed-value');
const signalLamp  = document.getElementById('signal-lamp');
const morseDisplay = document.getElementById('morse-display');

/* === State === */
let audioCtx        = null;
let isPlaying       = false;
let playbackTimers  = [];
let currentTimeline = null;

/* === Normalize Italian Text (strip accents) === */
function normalizeText(text) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // strip combining diacritics (à→a, è→e, etc.)
    .toUpperCase();
}

/* === Convert Text to Display-ready Morse Array === */
function convertToMorse(text) {
  const normalized = normalizeText(text);
  const result = [];

  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i];

    if (char === ' ') {
      result.push({ char: ' ', morse: '/' });
    } else if (MORSE_MAP[char]) {
      result.push({ char, morse: MORSE_MAP[char] });
    }
    // unsupported characters are silently skipped in display
  }

  return result;
}

/* === Generate Playback Timeline (absolute start times in ms) === */
function generateTimeline(text, wpm) {
  const unitMs = 1200 / wpm;   // Paris standard: dot = 1200 / WPM ms
  const timeline = [];
  let timeOffset = 0;
  const chars = normalizeText(text).split('');

  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];

    if (char === ' ') {
      timeOffset += unitMs * 7;   // inter-word gap
      continue;
    }

    const code = MORSE_MAP[char];
    if (!code) continue;

    for (let j = 0; j < code.length; j++) {
      const symbol  = code[j];
      const isDot   = symbol === '.';
      const duration = isDot ? unitMs : unitMs * 3;

      timeline.push({
        type:        isDot ? 'dot' : 'dash',
        startTime:   timeOffset,
        duration:    duration,
        char:        char,
        symbolIndex: j,
      });

      timeOffset += duration;

      // inter-symbol gap (1 unit), except after last symbol of a letter
      if (j < code.length - 1) {
        timeOffset += unitMs;
      }
    }

    // inter-letter gap (3 units), only if next char exists and is not a space
    if (i < chars.length - 1 && chars[i + 1] !== ' ') {
      timeOffset += unitMs * 3;
    }
  }

  return { timeline, totalDuration: timeOffset };
}

/* === Audio: Get or Create AudioContext === */
function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

/* === Audio: Schedule a Single Tone === */
function scheduleTone(startTimeSec, durationSec, frequency) {
  frequency = frequency || 750;
  const ctx  = getAudioContext();
  const osc  = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.value = frequency;

  // smooth envelope: 3 ms attack, 3 ms release — avoids clicks
  const attackMs  = 0.003;
  const releaseMs = 0.003;

  const absAttack  = startTimeSec + attackMs;
  const absRelease = startTimeSec + durationSec - releaseMs;
  const absEnd     = startTimeSec + durationSec;

  gain.gain.setValueAtTime(0, startTimeSec);
  gain.gain.linearRampToValueAtTime(0.35, absAttack);
  gain.gain.setValueAtTime(0.35, absRelease);
  gain.gain.linearRampToValueAtTime(0, absEnd);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(startTimeSec);
  osc.stop(absEnd + 0.005);
}

/* === Visual: Lamp Control === */
function lampOn() {
  signalLamp.classList.add('on');
}

function lampOff() {
  signalLamp.classList.remove('on');
}

/* === Visual: Highlight Current Character in Morse Display === */
function highlightChar(char, symbolIndex) {
  const groups = morseDisplay.querySelectorAll('.morse-char-group');

  groups.forEach(function (g) { g.classList.remove('highlight'); });

  for (var i = 0; i < groups.length; i++) {
    var group = groups[i];
    if (group.dataset.char === char) {
      group.classList.add('highlight');

      var symbols = group.querySelectorAll('.morse-symbol');
      for (var j = 0; j < symbols.length; j++) {
        symbols[j].style.opacity = (j === symbolIndex) ? '1' : '0.4';
      }
      break;
    }
  }
}

function clearHighlights() {
  var groups = morseDisplay.querySelectorAll('.morse-char-group');
  for (var i = 0; i < groups.length; i++) {
    groups[i].classList.remove('highlight');
    var symbols = groups[i].querySelectorAll('.morse-symbol');
    for (var j = 0; j < symbols.length; j++) {
      symbols[j].style.opacity = '1';
    }
  }
}

/* === Playback: Start === */
function startPlayback() {
  if (isPlaying) return;

  var text = textInput.value.trim();
  if (!text) return;

  var wpm = parseInt(speedSlider.value, 10);
  var result = generateTimeline(text, wpm);
  var timeline = result.timeline;
  var totalDuration = result.totalDuration;

  if (timeline.length === 0) return;

  currentTimeline = timeline;
  isPlaying = true;
  updatePlayState();

  /* --- Schedule all audio events (sample-accurate) --- */
  var ctx = getAudioContext();
  var now = ctx.currentTime;

  timeline.forEach(function (evt) {
    scheduleTone(
      now + evt.startTime / 1000,
      evt.duration / 1000,
      750
    );
  });

  /* --- Schedule all visual events (setTimeout-based) --- */
  var visualStart = performance.now();

  timeline.forEach(function (evt) {
    // Lamp ON
    var onDelay = evt.startTime - (performance.now() - visualStart);
    if (onDelay < 0) onDelay = 0;

    var timerOn = setTimeout(function () {
      if (!isPlaying) return;
      lampOn();
      highlightChar(evt.char, evt.symbolIndex);

      // Lamp OFF after duration
      var timerOff = setTimeout(function () {
        if (!isPlaying) return;
        lampOff();
      }, evt.duration);
      playbackTimers.push(timerOff);
    }, onDelay);
    playbackTimers.push(timerOn);
  });

  // Schedule end of playback
  var endDelay = totalDuration - (performance.now() - visualStart);
  if (endDelay < 0) endDelay = 0;
  var endTimer = setTimeout(function () {
    stopPlayback();
  }, endDelay);
  playbackTimers.push(endTimer);
}

/* === Playback: Stop === */
function stopPlayback() {
  isPlaying = false;

  // Clear all pending setTimeout handles
  playbackTimers.forEach(function (t) { clearTimeout(t); });
  playbackTimers = [];

  // Reset visual state
  lampOff();
  clearHighlights();

  // Close AudioContext to immediately stop scheduled tones
  if (audioCtx) {
    audioCtx.close();
    audioCtx = null;
  }

  currentTimeline = null;
  updatePlayState();
}

/* === UI State Update (enable/disable controls) === */
function updatePlayState() {
  if (isPlaying) {
    playBtn.disabled = true;
    stopBtn.disabled = false;
    textInput.disabled = true;
    speedSlider.disabled = true;
    return;
  }

  // Not playing — enable based on content
  stopBtn.disabled = true;
  textInput.disabled = false;
  speedSlider.disabled = false;

  var text = textInput.value;
  var normalized = normalizeText(text);
  var hasConvertibleChar = false;

  for (var i = 0; i < normalized.length; i++) {
    if (normalized[i] !== ' ' && MORSE_MAP[normalized[i]]) {
      hasConvertibleChar = true;
      break;
    }
  }

  playBtn.disabled = !hasConvertibleChar;
}

/* === Display Morse Code in Output Area === */
function updateMorseDisplay() {
  var text = textInput.value;
  var converted = convertToMorse(text);

  if (converted.length === 0) {
    morseDisplay.innerHTML =
      '<p class="morse-placeholder">Inserisci del testo per vedere il codice Morse corrispondente</p>';
    updatePlayState();
    return;
  }

  // Build DOM
  var html = '';
  converted.forEach(function (item) {
    var letterDisplay = item.char === ' ' ? '\u2423' : item.char; // ␣ for space
    var codeHtml = '';

    if (item.morse === '/') {
      codeHtml = '/';
    } else {
      codeHtml = item.morse.split('').map(function (s) {
        return '<span class="morse-symbol">' + s + '</span>';
      }).join('');
    }

    html +=
      '<div class="morse-char-group" data-char="' + item.char + '">' +
        '<span class="morse-char-letter">' + letterDisplay + '</span>' +
        '<span class="morse-char-code">' + codeHtml + '</span>' +
      '</div>';
  });

  morseDisplay.innerHTML = html;
  updatePlayState();
}

/* === Event Listeners === */

textInput.addEventListener('input', function () {
  updateMorseDisplay();
});

playBtn.addEventListener('click', function () {
  startPlayback();
});

stopBtn.addEventListener('click', function () {
  stopPlayback();
});

speedSlider.addEventListener('input', function () {
  speedValue.textContent = speedSlider.value;
});

/* === Keyboard Shortcuts === */
document.addEventListener('keydown', function (e) {
  // Ctrl+Enter / Cmd+Enter → Play
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    if (!isPlaying && textInput.value.trim()) {
      startPlayback();
    }
    return;
  }

  // Escape → Stop
  if (e.key === 'Escape' && isPlaying) {
    e.preventDefault();
    stopPlayback();
  }
});

/* === Init === */
updateMorseDisplay();
