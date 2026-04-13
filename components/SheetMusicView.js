"use client";

import { useRef, useEffect, useState, useCallback } from "react";

const TREBLE_POSITIONS = {
  "C4": -6, "D4": -5, "E4": -4, "F4": -3, "G4": -2,
  "A4": -1, "B4": 0, "C5": 1, "D5": 2, "E5": 3,
  "F5": 4, "G5": 5, "A5": 6, "B5": 7, "C6": 8, "D6": 9, "E6": 10,
};

const BASS_POSITIONS = {
  "C2": -6, "D2": -5, "E2": -4, "F2": -3, "G2": -2,
  "A2": -1, "B2": 0, "C3": 1, "D3": 2, "E3": 3,
  "F3": 4, "G3": 5, "A3": 6, "B3": 7, "C4": 8,
};

const ALL_NOTES_TREBLE = ["C4","D4","E4","F4","G4","A4","B4","C5","D5","E5","F5","G5","A5","B5","C6"];
const ALL_NOTES_BASS = ["C2","D2","E2","F2","G2","A2","B2","C3","D3","E3","F3","G3","A3","B3","C4"];
const DURATIONS = [
  { label: "𝅝", value: "1n" },
  { label: "𝅗𝅥", value: "2n" },
  { label: "♩", value: "4n" },
  { label: "♪", value: "8n" },
];

function getNotePosition(noteName, hand) {
  const natural = noteName.replace(/#|b/g, "");
  return (hand === "left" ? BASS_POSITIONS : TREBLE_POSITIONS)[natural] ?? 0;
}

function hasAccidental(n) { return n.includes("#") ? "#" : n.includes("b") ? "b" : null; }
function getPitches(note) { return Array.isArray(note.pitch) ? note.pitch : [note.pitch]; }
function isRest(note) { const p = getPitches(note); return p.length === 1 && p[0] === "REST"; }
function getDurationWidth(d) { return ({ "16n":30,"8n":35,"8n.":40,"4n":50,"4n.":60,"2n":70,"2n.":80,"1n":90 })[d] || 50; }
function isFilledNote(d) { return ["4n","4n.","8n","8n.","16n"].includes(d); }
function hasStem(d) { return d !== "1n"; }
function hasFlag(d) { return ["8n","8n."].includes(d); }
function hasDot(d) { return d.includes("."); }

export default function SheetMusicView({ score, activeNoteIndex = -1, editable = false, onScoreChange }) {
  const canvasRef = useRef(null);
  const scrollRef = useRef(null);
  const noteXPositions = useRef({});
  const noteHitAreas = useRef([]); // [{x, y, w, h, noteIndex}]
  const [selectedNote, setSelectedNote] = useState(null); // index into score.notes
  const [editorPos, setEditorPos] = useState(null); // {x, y} for editor popup

  // Handle tap on canvas to select a note
  const handleCanvasTap = useCallback((e) => {
    if (!editable) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const tapX = (e.clientX - rect.left) * scaleX / 2; // /2 for retina scale
    const tapY = (e.clientY - rect.top) * scaleX / 2;

    // Find closest note to tap
    let closest = null;
    let closestDist = 25; // max tap distance
    for (const hit of noteHitAreas.current) {
      const dx = tapX - hit.x;
      const dy = tapY - hit.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < closestDist) {
        closestDist = dist;
        closest = hit;
      }
    }

    if (closest) {
      setSelectedNote(closest.noteIndex);
      // Position editor near the tapped note
      const edX = closest.x * 2 / scaleX + rect.left - scrollRef.current.getBoundingClientRect().left + scrollRef.current.scrollLeft;
      setEditorPos({ x: edX, noteIndex: closest.noteIndex });
    } else {
      setSelectedNote(null);
      setEditorPos(null);
    }
  }, [editable]);

  const handleNoteChange = useCallback((noteIndex, field, value) => {
    if (!onScoreChange || !score) return;
    const newNotes = [...score.notes];
    const note = { ...newNotes[noteIndex] };

    if (field === "pitch") {
      note.pitch = [value];
    } else if (field === "duration") {
      note.duration = value;
    } else if (field === "delete") {
      newNotes.splice(noteIndex, 1);
      onScoreChange({ ...score, notes: newNotes });
      setSelectedNote(null);
      setEditorPos(null);
      return;
    }

    newNotes[noteIndex] = note;
    onScoreChange({ ...score, notes: newNotes });
  }, [score, onScoreChange]);

  useEffect(() => {
    if (!score || !score.notes || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const notes = score.notes;

    const rightNotes = notes.filter((n) => n.hand !== "left");
    const leftNotes = notes.filter((n) => n.hand === "left");
    const hasBass = leftNotes.length > 0;

    const SP = 12;
    const LEFT_MARGIN = 55;
    const RIGHT_MARGIN = 30;
    const TOP_MARGIN = 45;
    const GAP = 8;
    const BRACE_GAP = hasBass ? 45 : 0;

    const trebleTop = TOP_MARGIN;
    const trebleBot = trebleTop + SP * 4;
    const bassTop = hasBass ? trebleBot + BRACE_GAP : 0;
    const bassBot = hasBass ? bassTop + SP * 4 : 0;
    const systemHeight = hasBass ? bassBot + 50 : trebleBot + 50;

    // Build unified timeline
    const timeline = [];
    const visited = new Set();
    for (const note of notes) {
      const key = `${note.measure}-${note.beat}`;
      if (!visited.has(key)) {
        visited.add(key);
        const atBeat = notes.filter((n) => n.measure === note.measure && n.beat === note.beat);
        const width = Math.max(...atBeat.map((n) => getDurationWidth(n.duration)));
        timeline.push({ key, notes: atBeat, width });
      }
    }

    let totalWidth = LEFT_MARGIN + 35;
    let cm = 0;
    for (const slot of timeline) {
      if (slot.notes[0].measure > cm && cm > 0) totalWidth += 12;
      cm = slot.notes[0].measure;
      totalWidth += slot.width + GAP;
    }
    totalWidth += RIGHT_MARGIN;
    totalWidth = Math.max(totalWidth, 400);

    const scale = 2;
    canvas.width = totalWidth * scale;
    canvas.height = systemHeight * scale;
    canvas.style.width = totalWidth + "px";
    canvas.style.height = systemHeight + "px";
    ctx.scale(scale, scale);

    ctx.fillStyle = "#FFFDF7";
    ctx.fillRect(0, 0, totalWidth, systemHeight);

    if (score.title) {
      ctx.fillStyle = "#1a1a2e";
      ctx.font = "bold 14px Arial";
      ctx.textAlign = "center";
      ctx.fillText(score.title, totalWidth / 2, 18);
    }

    ctx.fillStyle = "#888";
    ctx.font = "10px Arial";
    ctx.textAlign = "center";
    ctx.fillText(
      `Key: ${score.keySignature || "C"}  |  Time: ${(score.timeSignature || [4, 4]).join("/")}  |  BPM: ${score.tempo || 100}`,
      totalWidth / 2, 32
    );

    function drawStaff(y, clef) {
      ctx.strokeStyle = "#555";
      ctx.lineWidth = 0.7;
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.moveTo(LEFT_MARGIN - 10, y + i * SP);
        ctx.lineTo(totalWidth - RIGHT_MARGIN, y + i * SP);
        ctx.stroke();
      }
      ctx.fillStyle = "#333";
      ctx.textAlign = "left";
      if (clef === "treble") {
        ctx.font = "40px serif";
        ctx.fillText("𝄞", LEFT_MARGIN - 8, y + 36);
      } else {
        ctx.font = "26px serif";
        ctx.fillText("𝄢", LEFT_MARGIN - 6, y + 22);
      }
    }

    function drawNote(note, x, staffTop, hand, isActive, isSelected) {
      const pitches = getPitches(note);
      const activeColor = "#3B82F6";
      const selectedColor = "#F97316";
      const normalColor = "#1a1a2e";
      const color = isSelected ? selectedColor : isActive ? activeColor : normalColor;

      // Glow
      if (isActive || isSelected) {
        const midY = staffTop + 2 * SP;
        const firstPos = isRest(note) ? 0 : getNotePosition(pitches[0], hand);
        const glowY = isRest(note) ? midY : midY - firstPos * (SP / 2);
        ctx.beginPath();
        ctx.arc(x, glowY, 14, 0, Math.PI * 2);
        ctx.fillStyle = isSelected ? "rgba(249, 115, 22, 0.2)" : "rgba(59, 130, 246, 0.18)";
        ctx.fill();
      }

      if (isRest(note)) {
        ctx.fillStyle = isSelected ? selectedColor : isActive ? activeColor : "#555";
        ctx.font = "18px Arial";
        ctx.textAlign = "center";
        ctx.fillText("𝄾", x, staffTop + SP * 2 + 5);
        return;
      }

      const filled = isFilledNote(note.duration);
      const stem = hasStem(note.duration);
      const flag = hasFlag(note.duration);
      const dot = hasDot(note.duration);

      for (const pitch of pitches) {
        const pos = getNotePosition(pitch, hand);
        const midY = staffTop + 2 * SP;
        const noteY = midY - pos * (SP / 2);
        const acc = hasAccidental(pitch);

        ctx.strokeStyle = color;
        ctx.lineWidth = 0.8;
        if (noteY < staffTop - 1) {
          for (let ly = staffTop - SP; ly >= noteY - 1; ly -= SP) {
            ctx.beginPath(); ctx.moveTo(x - 9, ly); ctx.lineTo(x + 9, ly); ctx.stroke();
          }
        }
        if (noteY > staffTop + 4 * SP + 1) {
          for (let ly = staffTop + 5 * SP; ly <= noteY + 1; ly += SP) {
            ctx.beginPath(); ctx.moveTo(x - 9, ly); ctx.lineTo(x + 9, ly); ctx.stroke();
          }
        }

        if (acc) {
          ctx.fillStyle = color;
          ctx.font = "13px Arial";
          ctx.textAlign = "right";
          ctx.fillText(acc === "#" ? "♯" : "♭", x - 8, noteY + 4);
        }

        ctx.beginPath();
        ctx.ellipse(x, noteY, 6, 4.5, -0.2, 0, Math.PI * 2);
        ctx.fillStyle = filled ? color : "#FFFDF7";
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.3;
        ctx.stroke();

        if (dot) {
          ctx.beginPath();
          ctx.arc(x + 9, noteY, 1.5, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();
        }
      }

      if (stem && pitches.length > 0) {
        const positions = pitches.map((p) => getNotePosition(p, hand));
        const midY = staffTop + 2 * SP;
        const avgPos = positions.reduce((a, b) => a + b, 0) / positions.length;
        const stemUp = avgPos <= 0;
        const topPos = Math.max(...positions);
        const botPos = Math.min(...positions);

        ctx.strokeStyle = color;
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        if (stemUp) {
          const ny = midY - botPos * (SP / 2);
          ctx.moveTo(x + 5.5, ny); ctx.lineTo(x + 5.5, ny - 30);
          if (flag) { ctx.moveTo(x + 5.5, ny - 30); ctx.quadraticCurveTo(x + 13, ny - 22, x + 9, ny - 15); }
        } else {
          const ny = midY - topPos * (SP / 2);
          ctx.moveTo(x - 5.5, ny); ctx.lineTo(x - 5.5, ny + 30);
          if (flag) { ctx.moveTo(x - 5.5, ny + 30); ctx.quadraticCurveTo(x - 13, ny + 22, x - 9, ny + 15); }
        }
        ctx.stroke();
      }
    }

    drawStaff(trebleTop, "treble");
    if (hasBass) {
      drawStaff(bassTop, "bass");
      ctx.strokeStyle = "#555";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(LEFT_MARGIN - 10, trebleTop);
      ctx.lineTo(LEFT_MARGIN - 10, bassBot);
      ctx.stroke();
    }

    const xPositions = {};
    const hitAreas = [];
    let x = LEFT_MARGIN + 35;
    cm = 0;

    for (const slot of timeline) {
      const m = slot.notes[0].measure;
      if (m > cm && cm > 0) {
        ctx.strokeStyle = "#bbb";
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(x - 3, trebleTop);
        ctx.lineTo(x - 3, trebleBot);
        if (hasBass) {
          ctx.moveTo(x - 3, bassTop);
          ctx.lineTo(x - 3, bassBot);
        }
        ctx.stroke();
        x += 12;
      }
      cm = m;

      for (const note of slot.notes) {
        const origIndex = notes.indexOf(note);
        const isActive = origIndex === activeNoteIndex;
        const isSelected = origIndex === selectedNote;
        xPositions[origIndex] = x;

        const hand = note.hand || "right";
        const staffTop = hand === "left" ? bassTop : trebleTop;
        drawNote(note, x, staffTop, hand, isActive, isSelected);

        // Store hit area for tap detection
        const pitches = getPitches(note);
        const midY = staffTop + 2 * SP;
        const firstPos = isRest(note) ? 0 : getNotePosition(pitches[0], hand);
        const noteY = isRest(note) ? midY : midY - firstPos * (SP / 2);
        hitAreas.push({ x, y: noteY, noteIndex: origIndex });
      }

      x += slot.width + GAP;
    }

    noteXPositions.current = xPositions;
    noteHitAreas.current = hitAreas;

  }, [score, activeNoteIndex, selectedNote]);

  // Auto-scroll to active note
  useEffect(() => {
    if (activeNoteIndex >= 0 && scrollRef.current && noteXPositions.current[activeNoteIndex]) {
      const x = noteXPositions.current[activeNoteIndex];
      const container = scrollRef.current;
      const targetScroll = x - container.clientWidth / 3;
      container.scrollTo({ left: targetScroll, behavior: "smooth" });
    }
  }, [activeNoteIndex]);

  if (!score || !score.notes) return null;

  const selectedNoteData = selectedNote !== null ? score.notes[selectedNote] : null;
  const selectedHand = selectedNoteData?.hand || "right";
  const noteOptions = selectedHand === "left" ? ALL_NOTES_BASS : ALL_NOTES_TREBLE;

  return (
    <div className="relative w-full">
      <div
        ref={scrollRef}
        className="w-full overflow-x-auto rounded-xl shadow-md bg-[#FFFDF7]"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <canvas
          ref={canvasRef}
          onClick={handleCanvasTap}
          className={editable ? "cursor-pointer" : ""}
        />
      </div>

      {/* Inline note editor */}
      {editable && selectedNote !== null && selectedNoteData && (
        <div className="mt-2 bg-white border-2 border-orange-300 rounded-xl p-3 shadow-lg flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase">
              Edit Note (M{selectedNoteData.measure} B{selectedNoteData.beat} {selectedHand === "left" ? "L" : "R"})
            </span>
            <button
              onClick={() => { setSelectedNote(null); setEditorPos(null); }}
              className="text-gray-400 text-lg px-1"
            >
              ✕
            </button>
          </div>

          {/* Pitch selector */}
          <div>
            <label className="text-xs text-gray-500">Pitch</label>
            <div className="flex flex-wrap gap-1 mt-1">
              {noteOptions.map((n) => (
                <button
                  key={n}
                  onClick={() => handleNoteChange(selectedNote, "pitch", n)}
                  className={`px-2 py-1 text-xs rounded-lg font-bold transition-all ${
                    getPitches(selectedNoteData)[0] === n
                      ? "bg-orange-500 text-white"
                      : "bg-gray-100 text-gray-700 active:bg-gray-200"
                  }`}
                >
                  {n}
                </button>
              ))}
              <button
                onClick={() => handleNoteChange(selectedNote, "pitch", "REST")}
                className={`px-2 py-1 text-xs rounded-lg font-bold transition-all ${
                  isRest(selectedNoteData)
                    ? "bg-orange-500 text-white"
                    : "bg-gray-100 text-gray-700"
                }`}
              >
                Rest
              </button>
            </div>
          </div>

          {/* Duration selector */}
          <div>
            <label className="text-xs text-gray-500">Duration</label>
            <div className="flex gap-2 mt-1">
              {DURATIONS.map((d) => (
                <button
                  key={d.value}
                  onClick={() => handleNoteChange(selectedNote, "duration", d.value)}
                  className={`px-3 py-1 text-lg rounded-lg transition-all ${
                    selectedNoteData.duration === d.value || selectedNoteData.duration === d.value + "."
                      ? "bg-orange-500 text-white"
                      : "bg-gray-100 text-gray-700"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Delete note */}
          <button
            onClick={() => handleNoteChange(selectedNote, "delete")}
            className="text-red-500 text-xs font-bold mt-1 self-start"
          >
            Delete this note
          </button>
        </div>
      )}
    </div>
  );
}
