const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

// Map flat names to sharp equivalents
const FLAT_TO_SHARP = {
  Db: "C#", Eb: "D#", Fb: "E", Gb: "F#", Ab: "G#", Bb: "A#", Cb: "B",
};

// A4 = 440Hz, MIDI 69
const A4_FREQ = 440;
const A4_MIDI = 69;

export function frequencyToMidi(freq) {
  return Math.round(12 * Math.log2(freq / A4_FREQ) + A4_MIDI);
}

export function midiToNoteName(midi) {
  const octave = Math.floor(midi / 12) - 1;
  const noteIndex = midi % 12;
  return NOTE_NAMES[noteIndex] + octave;
}

export function frequencyToNote(freq) {
  return midiToNoteName(frequencyToMidi(freq));
}

export function noteNameToMidi(name) {
  // Handle flats by converting to sharps
  let normalized = name;
  for (const [flat, sharp] of Object.entries(FLAT_TO_SHARP)) {
    if (normalized.startsWith(flat)) {
      normalized = sharp + normalized.slice(flat.length);
      break;
    }
  }

  const match = normalized.match(/^([A-G]#?)(\d+)$/);
  if (!match) return null;

  const [, note, octave] = match;
  const noteIndex = NOTE_NAMES.indexOf(note);
  if (noteIndex === -1) return null;

  return (parseInt(octave) + 1) * 12 + noteIndex;
}

export function semitoneDifference(note1, note2) {
  const midi1 = noteNameToMidi(note1);
  const midi2 = noteNameToMidi(note2);
  if (midi1 === null || midi2 === null) return Infinity;
  return Math.abs(midi1 - midi2);
}

// Rainbow colors for notes (C=red through B=violet)
const NOTE_COLORS = {
  C: "#EF4444",  // red
  "C#": "#F97316", // orange-red
  D: "#F97316",  // orange
  "D#": "#EAB308", // yellow-orange
  E: "#EAB308",  // yellow
  F: "#22C55E",  // green
  "F#": "#14B8A6", // teal
  G: "#3B82F6",  // blue
  "G#": "#6366F1", // indigo-blue
  A: "#6366F1",  // indigo
  "A#": "#8B5CF6", // violet-indigo
  B: "#8B5CF6",  // violet
};

export function getNoteColor(noteName) {
  if (!noteName || noteName === "REST") return "#9CA3AF"; // gray for rests
  const note = noteName.replace(/\d+$/, "");
  // Convert flats to sharps for color lookup
  const normalized = FLAT_TO_SHARP[note] || note;
  return NOTE_COLORS[normalized] || "#9CA3AF";
}

// Duration labels for display
const DURATION_LABELS = {
  "1n": "whole",
  "2n": "half",
  "2n.": "dotted half",
  "4n": "quarter",
  "4n.": "dotted quarter",
  "8n": "eighth",
  "8n.": "dotted eighth",
  "16n": "sixteenth",
};

export function getDurationLabel(duration) {
  return DURATION_LABELS[duration] || duration;
}

// Width multiplier for note blocks based on duration
export function getDurationWidth(duration) {
  const widths = {
    "16n": 0.5,
    "8n": 1,
    "8n.": 1.5,
    "4n": 2,
    "4n.": 3,
    "2n": 4,
    "2n.": 6,
    "1n": 8,
  };
  return widths[duration] || 2;
}
