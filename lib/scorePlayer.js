import * as Tone from "tone";

// Convert measure/beat position to seconds
function noteToSeconds(note, tempo, timeSignature) {
  const [beatsPerMeasure] = timeSignature;
  const beatDuration = 60 / tempo;
  const measureOffset = (note.measure - 1) * beatsPerMeasure * beatDuration;
  const beatOffset = (note.beat - 1) * beatDuration;
  return measureOffset + beatOffset;
}

export async function playScore(score, { onNotePlay, onFinish } = {}) {
  await Tone.start();

  const synth = new Tone.Synth({
    oscillator: { type: "triangle" },
    envelope: { attack: 0.02, decay: 0.1, sustain: 0.3, release: 0.5 },
  }).toDestination();

  const transport = Tone.getTransport();
  transport.cancel();
  transport.stop();
  transport.position = 0;
  transport.bpm.value = score.tempo || 100;

  const events = score.notes.map((note, i) => {
    const time = noteToSeconds(note, score.tempo || 100, score.timeSignature || [4, 4]);
    return [time, { ...note, index: i }];
  });

  // Calculate total duration for auto-stop
  const lastNote = events[events.length - 1];
  const lastNoteTime = lastNote ? lastNote[0] : 0;
  // Rough duration of last note in seconds
  const lastNoteDur = durationToSeconds(
    score.notes[score.notes.length - 1]?.duration || "4n",
    score.tempo || 100
  );
  const totalDuration = lastNoteTime + lastNoteDur + 0.5;

  const part = new Tone.Part((time, note) => {
    if (note.pitch !== "REST") {
      synth.triggerAttackRelease(note.pitch, note.duration, time);
    }
    if (onNotePlay) {
      Tone.getDraw().schedule(() => onNotePlay(note.index), time);
    }
  }, events);

  part.start(0);
  transport.start();

  // Schedule auto-stop
  const stopId = transport.schedule(() => {
    transport.stop();
    part.dispose();
    if (onFinish) {
      Tone.getDraw().schedule(() => onFinish(), Tone.now());
    }
  }, totalDuration);

  // Return a stop function
  return () => {
    transport.stop();
    transport.cancel();
    part.dispose();
    synth.dispose();
  };
}

function durationToSeconds(duration, tempo) {
  const beatDur = 60 / tempo;
  const map = {
    "1n": 4, "2n": 2, "2n.": 3, "4n": 1, "4n.": 1.5,
    "8n": 0.5, "8n.": 0.75, "16n": 0.25,
  };
  return (map[duration] || 1) * beatDur;
}

export function stopPlayback() {
  const transport = Tone.getTransport();
  transport.stop();
  transport.cancel();
}
