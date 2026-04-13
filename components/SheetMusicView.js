"use client";

import { useRef, useEffect } from "react";

// Note positions on staff (semitones from C, with staff position)
// Staff position: 0 = middle line, positive = up, negative = down
// Each step is half a staff space (line to space = 1 step)
const TREBLE_POSITIONS = {
  "C4": -6, "D4": -5, "E4": -4, "F4": -3, "G4": -2,
  "A4": -1, "B4": 0, "C5": 1, "D5": 2, "E5": 3,
  "F5": 4, "G5": 5, "A5": 6, "B5": 7, "C6": 8,
  "D6": 9, "E6": 10,
};

const BASS_POSITIONS = {
  "C2": -6, "D2": -5, "E2": -4, "F2": -3, "G2": -2,
  "A2": -1, "B2": 0, "C3": 1, "D3": 2, "E3": 3,
  "F3": 4, "G3": 5, "A3": 6, "B3": 7, "C4": 8,
};

function getNotePosition(noteName, hand) {
  // Strip accidentals for position lookup
  const natural = noteName.replace(/#|b/g, "");
  const positions = hand === "left" ? BASS_POSITIONS : TREBLE_POSITIONS;
  return positions[natural] ?? 0;
}

function hasAccidental(noteName) {
  if (noteName.includes("#")) return "#";
  if (noteName.includes("b")) return "b";
  return null;
}

function getPitches(note) {
  return Array.isArray(note.pitch) ? note.pitch : [note.pitch];
}

function isRest(note) {
  const p = getPitches(note);
  return p.length === 1 && p[0] === "REST";
}

function getDurationWidth(duration) {
  const map = { "16n": 25, "8n": 30, "8n.": 35, "4n": 40, "4n.": 50, "2n": 55, "2n.": 65, "1n": 75 };
  return map[duration] || 40;
}

function isFilledNote(duration) {
  return ["4n", "4n.", "8n", "8n.", "16n"].includes(duration);
}

function hasStem(duration) {
  return duration !== "1n";
}

function hasFlag(duration) {
  return ["8n", "8n."].includes(duration);
}

function hasDot(duration) {
  return duration.includes(".");
}

export default function SheetMusicView({ score, activeNoteIndex = -1 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!score || !score.notes || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const notes = score.notes;

    // Separate into right hand and left hand
    const rightNotes = notes.filter((n) => n.hand !== "left");
    const leftNotes = notes.filter((n) => n.hand === "left");
    const hasBass = leftNotes.length > 0;

    // Calculate canvas size
    const STAFF_SPACING = 10; // pixels between staff lines
    const LEFT_MARGIN = 50;
    const RIGHT_MARGIN = 20;
    const TOP_MARGIN = 40;

    // Calculate width needed
    let totalWidth = LEFT_MARGIN;
    const allNotes = rightNotes.length > 0 ? rightNotes : notes;
    for (const note of allNotes) {
      totalWidth += getDurationWidth(note.duration) + 5;
    }
    totalWidth += RIGHT_MARGIN;
    totalWidth = Math.max(totalWidth, 350);

    const trebleStaffTop = TOP_MARGIN;
    const trebleStaffHeight = STAFF_SPACING * 4;
    const bassStaffTop = hasBass ? trebleStaffTop + trebleStaffHeight + 50 : 0;
    const totalHeight = hasBass ? bassStaffTop + trebleStaffHeight + 60 : trebleStaffTop + trebleStaffHeight + 60;

    canvas.width = totalWidth * 2; // 2x for retina
    canvas.height = totalHeight * 2;
    canvas.style.width = totalWidth + "px";
    canvas.style.height = totalHeight + "px";
    ctx.scale(2, 2);

    // Background
    ctx.fillStyle = "#FFFDF7";
    ctx.fillRect(0, 0, totalWidth, totalHeight);

    // Title
    if (score.title) {
      ctx.fillStyle = "#1a1a2e";
      ctx.font = "bold 14px Arial";
      ctx.textAlign = "center";
      ctx.fillText(score.title, totalWidth / 2, 18);
    }

    // Key/time info
    ctx.fillStyle = "#888";
    ctx.font = "10px Arial";
    ctx.textAlign = "center";
    ctx.fillText(
      `Key: ${score.keySignature || "C"}  |  Time: ${(score.timeSignature || [4, 4]).join("/")}  |  BPM: ${score.tempo || 100}`,
      totalWidth / 2, 32
    );

    // Draw staff function
    function drawStaff(y, clef) {
      ctx.strokeStyle = "#333";
      ctx.lineWidth = 0.8;
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.moveTo(LEFT_MARGIN - 10, y + i * STAFF_SPACING);
        ctx.lineTo(totalWidth - RIGHT_MARGIN, y + i * STAFF_SPACING);
        ctx.stroke();
      }

      // Clef
      ctx.fillStyle = "#333";
      ctx.font = "bold 16px serif";
      ctx.textAlign = "left";
      if (clef === "treble") {
        ctx.font = "36px serif";
        ctx.fillText("𝄞", LEFT_MARGIN - 8, y + 32);
      } else {
        ctx.font = "24px serif";
        ctx.fillText("𝄢", LEFT_MARGIN - 6, y + 20);
      }
    }

    // Draw a note on the staff
    function drawNote(note, x, staffTop, hand) {
      const pitches = getPitches(note);

      if (isRest(note)) {
        // Draw rest symbol
        ctx.fillStyle = "#555";
        ctx.font = "16px Arial";
        ctx.textAlign = "center";
        const restY = staffTop + STAFF_SPACING * 2;
        ctx.fillText("𝄾", x, restY + 5);
        return;
      }

      const isActive = false; // We'll handle highlighting separately
      const filled = isFilledNote(note.duration);
      const stem = hasStem(note.duration);
      const flag = hasFlag(note.duration);
      const dot = hasDot(note.duration);

      for (const pitch of pitches) {
        const pos = getNotePosition(pitch, hand);
        // Middle line of staff = index 2 (3rd line from top), position 0 maps differently
        // For treble: B4 = middle line = position 0 → y = staffTop + 2 * STAFF_SPACING
        // Each position step = half a STAFF_SPACING
        const middleLineY = staffTop + 2 * STAFF_SPACING;
        const noteY = middleLineY - pos * (STAFF_SPACING / 2);

        const accidental = hasAccidental(pitch);

        // Ledger lines
        if (noteY < staffTop - 1) {
          ctx.strokeStyle = "#333";
          ctx.lineWidth = 0.8;
          for (let ly = staffTop - STAFF_SPACING; ly >= noteY - 1; ly -= STAFF_SPACING) {
            ctx.beginPath();
            ctx.moveTo(x - 8, ly);
            ctx.lineTo(x + 8, ly);
            ctx.stroke();
          }
        }
        if (noteY > staffTop + 4 * STAFF_SPACING + 1) {
          ctx.strokeStyle = "#333";
          ctx.lineWidth = 0.8;
          for (let ly = staffTop + 5 * STAFF_SPACING; ly <= noteY + 1; ly += STAFF_SPACING) {
            ctx.beginPath();
            ctx.moveTo(x - 8, ly);
            ctx.lineTo(x + 8, ly);
            ctx.stroke();
          }
        }

        // Accidental
        if (accidental) {
          ctx.fillStyle = "#333";
          ctx.font = "12px Arial";
          ctx.textAlign = "right";
          ctx.fillText(accidental === "#" ? "♯" : "♭", x - 7, noteY + 4);
        }

        // Note head
        ctx.beginPath();
        ctx.ellipse(x, noteY, 5, 4, -0.2, 0, Math.PI * 2);
        ctx.fillStyle = filled ? "#1a1a2e" : "#FFFDF7";
        ctx.fill();
        ctx.strokeStyle = "#1a1a2e";
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // Dot
        if (dot) {
          ctx.beginPath();
          ctx.arc(x + 8, noteY, 1.5, 0, Math.PI * 2);
          ctx.fillStyle = "#1a1a2e";
          ctx.fill();
        }
      }

      // Stem (draw once for chord, from highest/lowest note)
      if (stem && pitches.length > 0) {
        const positions = pitches.map((p) => getNotePosition(p, hand));
        const middleLineY = staffTop + 2 * STAFF_SPACING;

        // Stem goes up if note is below middle line, down if above
        const avgPos = positions.reduce((a, b) => a + b, 0) / positions.length;
        const stemUp = avgPos <= 0;

        const topPos = Math.max(...positions);
        const botPos = Math.min(...positions);

        ctx.strokeStyle = "#1a1a2e";
        ctx.lineWidth = 1;
        ctx.beginPath();

        if (stemUp) {
          const bottomNoteY = middleLineY - botPos * (STAFF_SPACING / 2);
          ctx.moveTo(x + 5, bottomNoteY);
          ctx.lineTo(x + 5, bottomNoteY - 28);
          // Flag
          if (flag) {
            ctx.moveTo(x + 5, bottomNoteY - 28);
            ctx.quadraticCurveTo(x + 12, bottomNoteY - 20, x + 8, bottomNoteY - 14);
          }
        } else {
          const topNoteY = middleLineY - topPos * (STAFF_SPACING / 2);
          ctx.moveTo(x - 5, topNoteY);
          ctx.lineTo(x - 5, topNoteY + 28);
          if (flag) {
            ctx.moveTo(x - 5, topNoteY + 28);
            ctx.quadraticCurveTo(x - 12, topNoteY + 20, x - 8, topNoteY + 14);
          }
        }
        ctx.stroke();
      }
    }

    // Draw treble staff and notes
    drawStaff(trebleStaffTop, "treble");
    let x = LEFT_MARGIN + 30;
    let currentMeasure = 0;
    for (let i = 0; i < rightNotes.length; i++) {
      const note = rightNotes[i];

      // Measure bar line
      if (note.measure > currentMeasure && currentMeasure > 0) {
        ctx.strokeStyle = "#999";
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(x - 5, trebleStaffTop);
        ctx.lineTo(x - 5, trebleStaffTop + 4 * STAFF_SPACING);
        ctx.stroke();
        x += 5;
      }
      currentMeasure = note.measure;

      drawNote(note, x, trebleStaffTop, "right");
      x += getDurationWidth(note.duration) + 5;
    }

    // Draw bass staff and notes
    if (hasBass) {
      drawStaff(bassStaffTop, "bass");
      x = LEFT_MARGIN + 30;
      currentMeasure = 0;
      for (let i = 0; i < leftNotes.length; i++) {
        const note = leftNotes[i];
        if (note.measure > currentMeasure && currentMeasure > 0) {
          ctx.strokeStyle = "#999";
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(x - 5, bassStaffTop);
          ctx.lineTo(x - 5, bassStaffTop + 4 * STAFF_SPACING);
          ctx.stroke();
          x += 5;
        }
        currentMeasure = note.measure;

        drawNote(note, x, bassStaffTop, "left");
        x += getDurationWidth(note.duration) + 5;
      }
    }

  }, [score, activeNoteIndex]);

  if (!score || !score.notes) return null;

  return (
    <div className="w-full overflow-x-auto">
      <canvas
        ref={canvasRef}
        className="rounded-xl shadow-md"
      />
    </div>
  );
}
