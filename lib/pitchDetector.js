import { PitchDetector } from "pitchy";
import { frequencyToNote } from "./noteUtils";

export function createPitchListener(stream, onNote, onPitchUpdate) {
  const audioContext = new AudioContext();
  const source = audioContext.createMediaStreamSource(stream);
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 2048;
  source.connect(analyser);

  const detector = PitchDetector.forFloat32Array(analyser.fftSize);
  const buffer = new Float32Array(analyser.fftSize);

  let currentNote = null;
  let noteStart = null;
  let running = true;
  const recordedNotes = [];

  function detect() {
    if (!running) return;

    analyser.getFloatTimeDomainData(buffer);
    const [frequency, clarity] = detector.findPitch(buffer, audioContext.sampleRate);

    if (onPitchUpdate) {
      onPitchUpdate({ frequency, clarity, note: clarity > 0.85 ? frequencyToNote(frequency) : null });
    }

    if (clarity > 0.85 && frequency > 60 && frequency < 2000) {
      const noteName = frequencyToNote(frequency);
      if (noteName !== currentNote) {
        // End previous note
        if (currentNote) {
          const endTime = audioContext.currentTime;
          const noteData = { pitch: currentNote, startTime: noteStart, endTime };
          recordedNotes.push(noteData);
          if (onNote) onNote(noteData);
        }
        // Start new note
        currentNote = noteName;
        noteStart = audioContext.currentTime;
      }
    } else {
      // Silence — end current note if any
      if (currentNote) {
        const endTime = audioContext.currentTime;
        const noteData = { pitch: currentNote, startTime: noteStart, endTime };
        recordedNotes.push(noteData);
        if (onNote) onNote(noteData);
        currentNote = null;
        noteStart = null;
      }
    }

    requestAnimationFrame(detect);
  }

  detect();

  // Return cleanup + results
  return {
    stop() {
      running = false;
      // Finalize last note
      if (currentNote) {
        const noteData = {
          pitch: currentNote,
          startTime: noteStart,
          endTime: audioContext.currentTime,
        };
        recordedNotes.push(noteData);
        if (onNote) onNote(noteData);
      }
      source.disconnect();
      audioContext.close();
      return recordedNotes;
    },
    getRecordedNotes() {
      return [...recordedNotes];
    },
  };
}
