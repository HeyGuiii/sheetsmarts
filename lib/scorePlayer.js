// Direct Web Audio API player — piano-like sound with chord and two-hand support
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

function playPianoNote(ctx, frequency, startTime, duration, volume = 1) {
  const masterGain = ctx.createGain();
  masterGain.gain.value = volume;
  masterGain.connect(ctx.destination);

  // Low notes (bass clef, below ~260Hz/C4) need stronger upper harmonics
  // and a more percussive attack to sound like a piano, not a synth bass
  const isLow = frequency < 260;
  const isMid = frequency >= 260 && frequency < 520;

  const harmonics = isLow
    ? [
        // Bass piano: reduce fundamental, boost upper harmonics for clarity
        { ratio: 1, gain: 0.3 },
        { ratio: 2, gain: 0.35 },
        { ratio: 3, gain: 0.25 },
        { ratio: 4, gain: 0.15 },
        { ratio: 5, gain: 0.1 },
        { ratio: 6, gain: 0.06 },
        { ratio: 7, gain: 0.03 },
        { ratio: 8, gain: 0.015 },
      ]
    : isMid
      ? [
          { ratio: 1, gain: 0.45 },
          { ratio: 2, gain: 0.28 },
          { ratio: 3, gain: 0.15 },
          { ratio: 4, gain: 0.08 },
          { ratio: 5, gain: 0.04 },
          { ratio: 6, gain: 0.02 },
        ]
      : [
          // Treble: fundamental dominates
          { ratio: 1, gain: 0.5 },
          { ratio: 2, gain: 0.2 },
          { ratio: 3, gain: 0.08 },
          { ratio: 4, gain: 0.04 },
          { ratio: 5, gain: 0.02 },
        ];

  // Low notes: sharper attack, faster initial decay (more percussive)
  const attackTime = isLow ? 0.003 : 0.005;
  const decayTime = isLow ? 0.05 : 0.08;
  const sustainRatio = isLow ? 0.25 : 0.4;
  const releaseTime = isLow ? 0.5 : 0.3;

  harmonics.forEach(({ ratio, gain: harmonicGain }) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.value = frequency * ratio;

    const attackEnd = startTime + attackTime;
    const decayEnd = startTime + decayTime;

    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(harmonicGain, attackEnd);
    gain.gain.exponentialRampToValueAtTime(harmonicGain * sustainRatio, decayEnd);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration + releaseTime);

    osc.connect(gain);
    gain.connect(masterGain);

    osc.start(startTime);
    osc.stop(startTime + duration + releaseTime + 0.05);
  });

  // Hammer strike — more prominent on low notes
  const clickOsc = ctx.createOscillator();
  const clickGain = ctx.createGain();
  clickOsc.type = "square";
  clickOsc.frequency.value = isLow ? frequency * 6 : frequency * 8;
  const clickVol = isLow ? 0.025 : 0.015;
  clickGain.gain.setValueAtTime(0, startTime);
  clickGain.gain.linearRampToValueAtTime(clickVol, startTime + 0.001);
  clickGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.015);
  clickOsc.connect(clickGain);
  clickGain.connect(masterGain);
  clickOsc.start(startTime);
  clickOsc.stop(startTime + 0.02);
}

// Get pitches from a note — handles both old format (string) and new format (array)
function getPitches(note) {
  if (Array.isArray(note.pitch)) return note.pitch;
  return [note.pitch];
}

function isRest(note) {
  const pitches = getPitches(note);
  return pitches.length === 1 && pitches[0] === "REST";
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

  // Group notes by measure and beat so both hands play together
  const timeline = [];
  const scheduled = new Set();

  for (let i = 0; i < notes.length; i++) {
    const note = notes[i];
    const key = `${note.measure}-${note.beat}`;

    if (!scheduled.has(key)) {
      scheduled.add(key);
      // Find all notes at this measure/beat (both hands)
      const simultaneous = notes
        .map((n, idx) => ({ ...n, index: idx }))
        .filter((n) => n.measure === note.measure && n.beat === note.beat);
      timeline.push(simultaneous);
    }
  }

  // Play through the timeline sequentially
  let offset = 0;
  for (const group of timeline) {
    // Duration is the max of all notes in this beat group
    let maxDur = 0;

    for (const note of group) {
      const dur = durationToSeconds(note.duration, tempo);
      if (dur > maxDur) maxDur = dur;

      if (!isRest(note)) {
        const pitches = getPitches(note);
        // Scale volume down slightly for chords so they don't clip
        const vol = pitches.length > 1 ? 0.7 / Math.sqrt(pitches.length) : 0.7;

        for (const p of pitches) {
          const freq = NOTE_FREQS[p];
          if (freq) {
            playPianoNote(ctx, freq, ctx.currentTime + offset, dur, vol);
          }
        }
      }
    }

    // UI callback for the first note index in this group
    const firstIndex = group[0].index;
    const delay = offset * 1000;
    const tid = setTimeout(() => {
      if (!cancelled && onNotePlay) onNotePlay(firstIndex);
    }, delay);
    timeouts.push(tid);

    offset += maxDur;
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
