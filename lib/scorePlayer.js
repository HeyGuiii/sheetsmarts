// Direct Web Audio API player — piano-like sound using additive synthesis
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

function playPianoNote(ctx, frequency, startTime, duration) {
  const masterGain = ctx.createGain();
  masterGain.connect(ctx.destination);

  // Piano uses multiple harmonics with decreasing amplitude
  const harmonics = [
    { ratio: 1, gain: 0.5 },      // fundamental
    { ratio: 2, gain: 0.25 },     // 2nd harmonic
    { ratio: 3, gain: 0.12 },     // 3rd
    { ratio: 4, gain: 0.06 },     // 4th
    { ratio: 5, gain: 0.03 },     // 5th
    { ratio: 6, gain: 0.015 },    // 6th
  ];

  harmonics.forEach(({ ratio, gain: harmonicGain }) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.value = frequency * ratio;

    // Piano envelope: sharp attack, quick initial decay, slow sustain decay
    const attackEnd = startTime + 0.005;
    const decayEnd = startTime + 0.08;
    const peakGain = harmonicGain;
    const sustainGain = harmonicGain * 0.4;

    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(peakGain, attackEnd);
    gain.gain.exponentialRampToValueAtTime(sustainGain, decayEnd);
    // Slow decay through the note duration (piano strings ring out)
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration + 0.3);

    osc.connect(gain);
    gain.connect(masterGain);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.35);
  });

  // Add a subtle "hammer" click for realism
  const clickOsc = ctx.createOscillator();
  const clickGain = ctx.createGain();
  clickOsc.type = "square";
  clickOsc.frequency.value = frequency * 8;
  clickGain.gain.setValueAtTime(0, startTime);
  clickGain.gain.linearRampToValueAtTime(0.015, startTime + 0.001);
  clickGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.01);
  clickOsc.connect(clickGain);
  clickGain.connect(masterGain);
  clickOsc.start(startTime);
  clickOsc.stop(startTime + 0.02);
}

let currentStop = null;

export async function playScore(score, { onNotePlay, onFinish } = {}) {
  if (currentStop) {
    currentStop();
    currentStop = null;
  }

  const ctx = getAudioContext();

  if (ctx.state === "suspended") {
    await ctx.resume();
  }

  // Silent buffer to unlock iOS audio
  const silentBuffer = ctx.createBuffer(1, 1, ctx.sampleRate);
  const silentSource = ctx.createBufferSource();
  silentSource.buffer = silentBuffer;
  silentSource.connect(ctx.destination);
  silentSource.start(0);

  const tempo = score.tempo || 100;
  const notes = score.notes || [];
  let cancelled = false;
  const timeouts = [];

  let offset = 0;
  for (let i = 0; i < notes.length; i++) {
    const note = notes[i];
    const dur = durationToSeconds(note.duration, tempo);
    const freq = NOTE_FREQS[note.pitch];

    if (note.pitch !== "REST" && freq) {
      playPianoNote(ctx, freq, ctx.currentTime + offset, dur);
    }

    const noteIndex = i;
    const delay = offset * 1000;
    const tid = setTimeout(() => {
      if (!cancelled && onNotePlay) onNotePlay(noteIndex);
    }, delay);
    timeouts.push(tid);

    offset += dur;
  }

  const finishTid = setTimeout(() => {
    if (!cancelled && onFinish) onFinish();
    currentStop = null;
  }, offset * 1000 + 500);
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
