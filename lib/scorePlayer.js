import * as Tone from "tone";

function durationToSeconds(duration, tempo) {
  const beatDur = 60 / tempo;
  const map = {
    "1n": 4, "2n": 2, "2n.": 3, "4n": 1, "4n.": 1.5,
    "8n": 0.5, "8n.": 0.75, "16n": 0.25,
  };
  return (map[duration] || 1) * beatDur;
}

let currentStop = null;

export async function playScore(score, { onNotePlay, onFinish } = {}) {
  // Stop any existing playback
  if (currentStop) {
    currentStop();
    currentStop = null;
  }

  // Must be called from a user gesture — awaiting ensures AudioContext is resumed
  await Tone.start();

  const synth = new Tone.Synth({
    oscillator: { type: "triangle" },
    envelope: { attack: 0.02, decay: 0.1, sustain: 0.3, release: 0.5 },
    volume: -2,
  }).toDestination();

  // Use simple setTimeout chain instead of Transport (more reliable on mobile)
  const tempo = score.tempo || 100;
  const notes = score.notes || [];
  let cancelled = false;
  let timeoutId = null;

  function playNote(index) {
    if (cancelled || index >= notes.length) {
      synth.dispose();
      if (!cancelled && onFinish) onFinish();
      return;
    }

    const note = notes[index];
    const dur = durationToSeconds(note.duration, tempo);

    if (note.pitch !== "REST") {
      synth.triggerAttackRelease(note.pitch, note.duration);
    }

    if (onNotePlay) onNotePlay(index);

    timeoutId = setTimeout(() => playNote(index + 1), dur * 1000);
  }

  playNote(0);

  const stop = () => {
    cancelled = true;
    if (timeoutId) clearTimeout(timeoutId);
    try { synth.dispose(); } catch {}
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
