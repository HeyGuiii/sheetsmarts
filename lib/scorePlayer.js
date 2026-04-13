// Piano player that renders to WAV and plays via <audio> element.
// This uses the iOS media channel (works with silent switch on)
// instead of the ringer channel (Web Audio API direct playback).

const NOTES_LIST = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const NOTE_FREQS = {};
for (let midi = 21; midi <= 108; midi++) {
  const octave = Math.floor(midi / 12) - 1;
  const note = NOTES_LIST[midi % 12];
  NOTE_FREQS[note + octave] = 440 * Math.pow(2, (midi - 69) / 12);
  const flatMap = { "C#": "Db", "D#": "Eb", "F#": "Gb", "G#": "Ab", "A#": "Bb" };
  if (flatMap[note]) NOTE_FREQS[flatMap[note] + octave] = NOTE_FREQS[note + octave];
}

function durationToSeconds(duration, tempo) {
  const beatDur = 60 / tempo;
  const map = { "1n": 4, "2n": 2, "2n.": 3, "4n": 1, "4n.": 1.5, "8n": 0.5, "8n.": 0.75, "16n": 0.25 };
  return (map[duration] || 1) * beatDur;
}

function getPitches(note) {
  return Array.isArray(note.pitch) ? note.pitch : [note.pitch];
}

function isRest(note) {
  const p = getPitches(note);
  return p.length === 1 && p[0] === "REST";
}

// Render a piano note directly into a sample buffer
function renderPianoNote(buffer, sampleRate, frequency, startSample, durationSamples, volume) {
  const isLow = frequency < 260;
  const isMid = frequency >= 260 && frequency < 520;

  const harmonics = isLow
    ? [
        { r: 1, g: 0.3 }, { r: 2, g: 0.35 }, { r: 3, g: 0.25 },
        { r: 4, g: 0.15 }, { r: 5, g: 0.1 }, { r: 6, g: 0.06 },
      ]
    : isMid
      ? [
          { r: 1, g: 0.45 }, { r: 2, g: 0.28 }, { r: 3, g: 0.15 },
          { r: 4, g: 0.08 }, { r: 5, g: 0.04 },
        ]
      : [
          { r: 1, g: 0.5 }, { r: 2, g: 0.2 }, { r: 3, g: 0.08 },
          { r: 4, g: 0.04 },
        ];

  const attackSamples = Math.floor(sampleRate * (isLow ? 0.003 : 0.005));
  const decaySamples = Math.floor(sampleRate * (isLow ? 0.05 : 0.08));
  const sustainRatio = isLow ? 0.25 : 0.4;
  const releaseSamples = Math.floor(sampleRate * (isLow ? 0.5 : 0.3));
  const totalSamples = durationSamples + releaseSamples;

  for (let i = 0; i < totalSamples && (startSample + i) < buffer.length; i++) {
    // Envelope
    let env;
    if (i < attackSamples) {
      env = i / attackSamples;
    } else if (i < attackSamples + decaySamples) {
      const t = (i - attackSamples) / decaySamples;
      env = 1 - t * (1 - sustainRatio);
    } else {
      const t = (i - attackSamples - decaySamples) / (totalSamples - attackSamples - decaySamples);
      env = sustainRatio * Math.pow(0.001 / sustainRatio, Math.min(t, 1));
    }

    // Sum harmonics
    let sample = 0;
    for (const { r, g } of harmonics) {
      sample += g * Math.sin(2 * Math.PI * frequency * r * i / sampleRate);
    }

    // Hammer click (first ~1ms)
    if (i < sampleRate * 0.01) {
      const clickEnv = i < sampleRate * 0.001
        ? (i / (sampleRate * 0.001)) * 0.03
        : 0.03 * Math.pow(0.001 / 0.03, (i - sampleRate * 0.001) / (sampleRate * 0.009));
      sample += clickEnv * Math.sin(2 * Math.PI * frequency * 6 * i / sampleRate);
    }

    buffer[startSample + i] += sample * env * volume;
  }
}

// Convert Float32Array to WAV blob
function float32ToWav(samples, sampleRate) {
  const numSamples = samples.length;
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  // WAV header
  const writeStr = (offset, str) => { for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i)); };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + numSamples * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, numSamples * 2, true);

  // Clamp and convert to 16-bit PCM
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s * 0x7FFF, true);
  }

  return new Blob([buffer], { type: "audio/wav" });
}

let currentStop = null;
let currentAudio = null;

export async function playScore(score, { onNotePlay, onFinish } = {}) {
  if (currentStop) {
    currentStop();
    currentStop = null;
  }

  const tempo = score.tempo || 100;
  const notes = score.notes || [];
  const sampleRate = 44100;

  // Group notes by measure/beat so both hands play together
  const timeline = [];
  const scheduled = new Set();

  for (let i = 0; i < notes.length; i++) {
    const note = notes[i];
    const key = `${note.measure}-${note.beat}`;
    if (!scheduled.has(key)) {
      scheduled.add(key);
      const simultaneous = notes
        .map((n, idx) => ({ ...n, index: idx }))
        .filter((n) => n.measure === note.measure && n.beat === note.beat);
      timeline.push(simultaneous);
    }
  }

  // Calculate total duration and note timing
  const noteTimings = []; // { offsetSec, durationSec, firstIndex }
  let offset = 0;
  for (const group of timeline) {
    let maxDur = 0;
    for (const note of group) {
      const dur = durationToSeconds(note.duration, tempo);
      if (dur > maxDur) maxDur = dur;
    }
    noteTimings.push({ offset, maxDur, group });
    offset += maxDur;
  }

  const totalDuration = offset + 1; // +1s for release tail
  const totalSamples = Math.ceil(totalDuration * sampleRate);
  const buffer = new Float32Array(totalSamples);

  // Render all notes into the buffer
  for (const { offset: noteOffset, maxDur, group } of noteTimings) {
    for (const note of group) {
      if (!isRest(note)) {
        const pitches = getPitches(note);
        const vol = pitches.length > 1 ? 0.5 / Math.sqrt(pitches.length) : 0.5;
        const dur = durationToSeconds(note.duration, tempo);

        for (const p of pitches) {
          const freq = NOTE_FREQS[p];
          if (freq) {
            const startSample = Math.floor(noteOffset * sampleRate);
            const durSamples = Math.floor(dur * sampleRate);
            renderPianoNote(buffer, sampleRate, freq, startSample, durSamples, vol);
          }
        }
      }
    }
  }

  // Convert to WAV and play via <audio> element
  const wav = float32ToWav(buffer, sampleRate);
  const url = URL.createObjectURL(wav);
  const audio = new Audio(url);
  audio.volume = 1.0;
  currentAudio = audio;

  let cancelled = false;
  const timeouts = [];

  // Schedule UI note highlighting
  for (const { offset: noteOffset, group } of noteTimings) {
    const tid = setTimeout(() => {
      if (!cancelled && onNotePlay) onNotePlay(group[0].index);
    }, noteOffset * 1000);
    timeouts.push(tid);
  }

  audio.onended = () => {
    URL.revokeObjectURL(url);
    if (!cancelled && onFinish) onFinish();
    currentStop = null;
    currentAudio = null;
  };

  const stop = () => {
    cancelled = true;
    timeouts.forEach(clearTimeout);
    audio.pause();
    URL.revokeObjectURL(url);
    currentStop = null;
    currentAudio = null;
  };

  currentStop = stop;

  try {
    await audio.play();
  } catch (err) {
    // Fallback: some browsers need user gesture. This shouldn't happen
    // since we're called from a click handler, but just in case.
    stop();
    if (onFinish) onFinish();
  }

  return stop;
}

export function stopPlayback() {
  if (currentStop) {
    currentStop();
    currentStop = null;
  }
}
