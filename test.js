/* ============================================================
   MorseBox — Test Suite
   Testa le funzioni core: mappa Morse, normalizzazione,
   conversione, generazione timeline.
   Da eseguire con: node test.js
   ============================================================ */

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

function normalizeText(text) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

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
  }

  return result;
}

function generateTimeline(text, wpm) {
  const unitMs = 1200 / wpm;
  const timeline = [];
  let timeOffset = 0;
  const chars = normalizeText(text).split('');

  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];

    if (char === ' ') {
      timeOffset += unitMs * 7;
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

      if (j < code.length - 1) {
        timeOffset += unitMs;
      }
    }

    if (i < chars.length - 1 && chars[i + 1] !== ' ') {
      timeOffset += unitMs * 3;
    }
  }

  return { timeline, totalDuration: timeOffset };
}

/* ============ Test Runner ============ */
let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log('  \x1b[32m✓\x1b[0m ' + message);
    passed++;
  } else {
    console.log('  \x1b[31m✗\x1b[0m ' + message);
    failed++;
  }
}

function section(title) {
  console.log('\n' + title);
}

/* ============ Tests ============ */

section('1. Normalize Italian text');
{
  assert(normalizeText('città') === 'CITTA', 'città → CITTA');
  assert(normalizeText('è') === 'E', 'è → E');
  assert(normalizeText('perché') === 'PERCHE', 'perché → PERCHE');
  assert(normalizeText('CIAO') === 'CIAO', 'CIAO → CIAO (no change)');
  assert(normalizeText('') === '', 'empty string stays empty');
}

section('2. Convert text to Morse (display array)');
{
  const r1 = convertToMorse('CIAO');
  assert(r1.length === 4, 'CIAO → 4 chars');
  assert(r1[0].char === 'C' && r1[0].morse === '-.-.', 'C → -.-.');
  assert(r1[1].char === 'I' && r1[1].morse === '..', 'I → ..');
  assert(r1[2].char === 'A' && r1[2].morse === '.-', 'A → .-');
  assert(r1[3].char === 'O' && r1[3].morse === '---', 'O → ---');
}

section('3. Handle spaces in display');
{
  const r2 = convertToMorse('A B');
  assert(r2.length === 3, '"A B" → 3 items');
  assert(r2[0].char === 'A' && r2[0].morse === '.-', 'A → .-');
  assert(r2[1].char === ' ' && r2[1].morse === '/', 'space → /');
  assert(r2[2].char === 'B' && r2[2].morse === '-...', 'B → -...');
}

section('4. Handle unsupported characters');
{
  const r3 = convertToMorse('A%B');
  assert(r3.length === 2, '"A%B" → 2 items (skips %)');
  assert(r3[0].char === 'A', 'first is A');
  assert(r3[1].char === 'B', 'second is B');
}

section('5. Numbers');
{
  const r4 = convertToMorse('123');
  assert(r4[0].morse === '.----', '1 → .----');
  assert(r4[1].morse === '..---', '2 → ..---');
  assert(r4[2].morse === '...--', '3 → ...--');
}

section('6. Punctuation');
{
  const r5 = convertToMorse('?');
  assert(r5[0].morse === '..--..', '? → ..--..');
  const r6 = convertToMorse('.');
  assert(r6[0].morse === '.-.-.-', '. → .-.-.-');
}

section('7. Generate timeline — basic');
{
  const unitMs = 1200 / 12;  // 100 ms at 12 WPM
  const { timeline, totalDuration } = generateTimeline('E', 12);
  assert(timeline.length === 1, '"E" → 1 event (single dot)');
  assert(timeline[0].type === 'dot', 'E is a dot');
  assert(timeline[0].duration === unitMs, 'dot duration = 1 unit = ' + unitMs + ' ms');
  assert(timeline[0].startTime === 0, 'first event starts at 0');
  assert(totalDuration === unitMs, 'total duration = 1 unit');
}

section('8. Generate timeline — dash');
{
  const unitMs = 1200 / 12;
  const { timeline, totalDuration } = generateTimeline('T', 12);
  assert(timeline.length === 1, '"T" → 1 event (single dash)');
  assert(timeline[0].type === 'dash', 'T is a dash');
  assert(timeline[0].duration === unitMs * 3, 'dash duration = 3 units');
  assert(totalDuration === unitMs * 3, 'total duration = 3 units');
}

section('9. Generate timeline — letter I (two dots)');
{
  const unitMs = 1200 / 12;
  const { timeline, totalDuration } = generateTimeline('I', 12);
  assert(timeline.length === 2, '"I" → 2 events (..)');
  assert(timeline[0].type === 'dot' && timeline[1].type === 'dot', 'both are dots');
  assert(timeline[0].startTime === 0, 'first dot at 0');
  assert(timeline[1].startTime === unitMs * 2, 'second dot at 2 units (dot 1 + gap 1)');
  // I = dot + gap + dot = 1 + 1 + 1 = 3 units
  assert(totalDuration === unitMs * 3, 'total duration = 3 units');
}

section('10. Generate timeline — SOS');
{
  const unitMs = 1200 / 12;
  const { timeline, totalDuration } = generateTimeline('SOS', 12);
  // S = ... = 3 dots + 2 gaps = 5 units, then inter-letter 3 units = 8
  // O = --- = 3 dashes + 2 gaps = 3*3 + 2*1 = 11, then inter-letter 3 = 14
  // S = 5 units
  // total = 8 + 14 + 5 = 27 units
  assert(timeline.length === 9, 'SOS → 9 symbol events (3+3+3)');
  assert(totalDuration === unitMs * 27, 'total SOS duration = 27 units');
}

section('11. Generate timeline — inter-word spacing');
{
  const unitMs = 1200 / 12;
  const { totalDuration } = generateTimeline('A B', 12);
  // A = .- = dot(1) + gap(1) + dash(3) = 5 units
  //   (no inter-letter gap: next char is space, word gap replaces it)
  // space = 7 units
  // B = -... = dash(3)+gap(1)+dot(1)+gap(1)+dot(1)+gap(1)+dot(1) = 9 units
  // total = 5 + 7 + 9 = 21 units
  assert(totalDuration === unitMs * 21, 'A B total = 21 units (word gap replaces letter gap)');
}

section('12. Generate timeline — different WPM');
{
  const { totalDuration: d5 } = generateTimeline('E', 5);
  const { totalDuration: d20 } = generateTimeline('E', 20);
  assert(d5 > d20, '5 WPM is slower than 20 WPM');
  assert(d5 === 1200 / 5, 'at 5 WPM, dot = 240 ms');
  assert(d20 === 1200 / 20, 'at 20 WPM, dot = 60 ms');
}

section('13. Known Morse alphabet — spot checks');
{
  assert(MORSE_MAP['S'] === '...', 'S = ...');
  assert(MORSE_MAP['O'] === '---', 'O = ---');
  assert(MORSE_MAP['Q'] === '--.-', 'Q = --.-');
  assert(MORSE_MAP['7'] === '--...', '7 = --...');
  assert(MORSE_MAP['?'] === '..--..', '? = ..--..');
}

/* ============ Results ============ */
console.log('\n' + '='.repeat(50));
console.log('  Passed: ' + passed + '  |  Failed: ' + failed);
console.log('='.repeat(50));

if (failed > 0) {
  process.exit(1);
}
