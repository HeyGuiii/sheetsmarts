// Direct Web Audio API player — more reliable on iOS Safari than Tone.js
let audioCtx = null;

function getAudioContext() {
  if (!audioCtx || audioCtx.state === "closed") {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

// Note name to frequency lookup
const NOTE_FREQS = {};
const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
for (let midi = 21; midi <= 108; midi++) {
  const octave = Math.floor(midi / 12) - 1;
  const note = NOTES[midi % 12];
  const name = note + octave;
  NOTE_FREQS[name] = 440 * Math.pow(2, (midi - 69) / 12);
  // Add flat equivalents
  const flatMap = { "C#": "Db", "D#": "Eb", "F#": "Gb", "G#": "Ab", "A#": "Bb" };
  if (flatMap[note]) {
    NOTE_FREQS[flatMap[note] + octave] = NOTE_FREQS[name];
  }
}

function durationToSeconds(duration, tempo) {
  const beatDur = 60 / tempo;
  const map = {
    "1n": 4, "2n": 2, "2n.": 3, "4n": 1, "4n.": 1.5,
    "8n": 0.5, "8n.": 0.75, "16n": 0.25,
  };
  return (map[duration] || 1) * beatDur;
}

function playTone(ctx, frequency, startTime, duration) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "triangle";
  osc.frequency.value = frequency;

  // Envelope: quick attack, sustain, smooth release
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(0.4, startTime + 0.02);
  gain.gain.setValueAtTime(0.3, startTime + duration * 0.7);
  gain.gain.linearRampToValueAtTime(0, startTime + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(startTime);
  osc.stop(startTime + duration + 0.05);
}

let currentStop = null;

export async function playScore(score, { onNotePlay, onFinish } = {}) {
  if (currentStop) {
    currentStop();
    currentStop = null;
  }

  const ctx = getAudioContext();

  // Resume AudioContext (required by iOS Safari on user gesture)
  if (ctx.state === "suspended") {
    await ctx.resume();
  }

  // Play a silent buffer to unlock audio on iOS
  const silentBuffer = ctx.createBuffer(1, 1, ctx.sampleRate);
  const silentSource = ctx.createBufferSource();
  silentSource.buffer = silentBuffer;
  silentSource.connect(ctx.destination);
  silentSource.start(0);

  const tempo = score.tempo || 100;
  const notes = score.notes || [];
  let cancelled = false;
  const timeouts = [];

  // Schedule all notes relative to now
  let offset = 0;
  for (let i = 0; i < notes.length; i++) {
    const note = notes[i];
    const dur = durationToSeconds(note.duration, tempo);
    const freq = NOTE_FREQS[note.pitch];

    if (note.pitch !== "REST" && freq) {
      playTone(ctx, freq, ctx.currentTime + offset, dur * 0.9);
    }

    // Schedule UI callback
    const noteIndex = i;
    const delay = offset * 1000;
    const tid = setTimeout(() => {
      if (!cancelled && onNotePlay) onNotePlay(noteIndex);
    }, delay);
    timeouts.push(tid);

    offset += dur;
  }

  // Schedule finish callback
  const finishTid = setTimeout(() => {
    if (!cancelled && onFinish) onFinish();
    currentStop = null;
  }, offset * 1000);
  timeouts.push(finishTid);

  const stop = () => {
    cancelled = true;
    timeouts.forEach(clearTimeout);
    currentStop = null;
  };

  currentStop = stop;
  return stop;
}

export function stopPlayback() {
  if (currentStop) {
    currentStop();
    currentStop = null;
  }
}
