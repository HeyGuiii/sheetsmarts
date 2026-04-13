"use client";

import { useRef, useEffect, useState } from "react";

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

function getNotePosition(noteName, hand) {
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
  const map = { "16n": 30, "8n": 35, "8n.": 40, "4n": 50, "4n.": 60, "2n": 70, "2n.": 80, "1n": 90 };
  return map[duration] || 50;
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
  const scrollRef = useRef(null);
  const noteXPositions = useRef([]); // store x positions for scrolling

  useEffect(() => {
    if (!score || !score.notes || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const notes = score.notes;

    const rightNotes = notes.filter((n) => n.hand !== "left");
    const leftNotes = notes.filter((n) => n.hand === "left");
    const hasBass = leftNotes.length > 0;

    const STAFF_SPACING = 12;
    const LEFT_MARGIN = 55;
    const RIGHT_MARGIN = 30;
    const TOP_MARGIN = 45;
    const NOTE_GAP = 8;

    // Calculate total width
    let totalWidth = LEFT_MARGIN + 35;
    const mainNotes = rightNotes.length > 0 ? rightNotes : notes;
    for (const note of mainNotes) {
      totalWidth += getDurationWidth(note.duration) + NOTE_GAP;
    }
    totalWidth += RIGHT_MARGIN;
    totalWidth = Math.max(totalWidth, 400);

    const trebleStaffTop = TOP_MARGIN;
    const bassStaffTop = hasBass ? trebleStaffTop + STAFF_SPACING * 4 + 55 : 0;
    const totalHeight = hasBass ? bassStaffTop + STAFF_SPACING * 4 + 65 : trebleStaffTop + STAFF_SPACING * 4 + 65;

    const scale = 2;
    canvas.width = totalWidth * scale;
    canvas.height = totalHeight * scale;
    canvas.style.width = totalWidth + "px";
    canvas.style.height = totalHeight + "px";
    ctx.scale(scale, scale);

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

    // Info line
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
        ctx.moveTo(LEFT_MARGIN - 10, y + i * STAFF_SPACING);
        ctx.lineTo(totalWidth - RIGHT_MARGIN, y + i * STAFF_SPACING);
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

    function drawNote(note, x, staffTop, hand, isActive) {
      const pitches = getPitches(note);
      const activeColor = "#3B82F6";
      const normalColor = "#1a1a2e";
      const color = isActive ? activeColor : normalColor;

      // Active highlight glow
      if (isActive) {
        const middleLineY = staffTop + 2 * STAFF_SPACING;
        const firstPos = isRest(note) ? 0 : getNotePosition(pitches[0], hand);
        const glowY = isRest(note) ? middleLineY : middleLineY - firstPos * (STAFF_SPACING / 2);
        ctx.beginPath();
        ctx.arc(x, glowY, 14, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(59, 130, 246, 0.15)";
        ctx.fill();
      }

      if (isRest(note)) {
        ctx.fillStyle = isActive ? activeColor : "#555";
        ctx.font = "18px Arial";
        ctx.textAlign = "center";
        ctx.fillText("𝄾", x, staffTop + STAFF_SPACING * 2 + 5);
        return;
      }

      const filled = isFilledNote(note.duration);
      const stem = hasStem(note.duration);
      const flag = hasFlag(note.duration);
      const dot = hasDot(note.duration);

      for (const pitch of pitches) {
        const pos = getNotePosition(pitch, hand);
        const middleLineY = staffTop + 2 * STAFF_SPACING;
        const noteY = middleLineY - pos * (STAFF_SPACING / 2);

        const accidental = hasAccidental(pitch);

        // Ledger lines
        ctx.strokeStyle = color;
        ctx.lineWidth = 0.8;
        if (noteY < staffTop - 1) {
          for (let ly = staffTop - STAFF_SPACING; ly >= noteY - 1; ly -= STAFF_SPACING) {
            ctx.beginPath();
            ctx.moveTo(x - 9, ly);
            ctx.lineTo(x + 9, ly);
            ctx.stroke();
          }
        }
        if (noteY > staffTop + 4 * STAFF_SPACING + 1) {
          for (let ly = staffTop + 5 * STAFF_SPACING; ly <= noteY + 1; ly += STAFF_SPACING) {
            ctx.beginPath();
            ctx.moveTo(x - 9, ly);
            ctx.lineTo(x + 9, ly);
            ctx.stroke();
          }
        }

        // Accidental
        if (accidental) {
          ctx.fillStyle = color;
          ctx.font = "13px Arial";
          ctx.textAlign = "right";
          ctx.fillText(accidental === "#" ? "♯" : "♭", x - 8, noteY + 4);
        }

        // Note head
        ctx.beginPath();
        ctx.ellipse(x, noteY, 6, 4.5, -0.2, 0, Math.PI * 2);
        ctx.fillStyle = filled ? color : "#FFFDF7";
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.3;
        ctx.stroke();

        // Dot
        if (dot) {
          ctx.beginPath();
          ctx.arc(x + 9, noteY, 1.5, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();
        }
      }

      // Stem
      if (stem && pitches.length > 0) {
        const positions = pitches.map((p) => getNotePosition(p, hand));
        const middleLineY = staffTop + 2 * STAFF_SPACING;
        const avgPos = positions.reduce((a, b) => a + b, 0) / positions.length;
        const stemUp = avgPos <= 0;
        const topPos = Math.max(...positions);
        const botPos = Math.min(...positions);

        ctx.strokeStyle = color;
        ctx.lineWidth = 1.1;
        ctx.beginPath();

        if (stemUp) {
          const bottomNoteY = middleLineY - botPos * (STAFF_SPACING / 2);
          ctx.moveTo(x + 5.5, bottomNoteY);
          ctx.lineTo(x + 5.5, bottomNoteY - 30);
          if (flag) {
            ctx.moveTo(x + 5.5, bottomNoteY - 30);
            ctx.quadraticCurveTo(x + 13, bottomNoteY - 22, x + 9, bottomNoteY - 15);
          }
        } else {
          const topNoteY = middleLineY - topPos * (STAFF_SPACING / 2);
          ctx.moveTo(x - 5.5, topNoteY);
          ctx.lineTo(x - 5.5, topNoteY + 30);
          if (flag) {
            ctx.moveTo(x - 5.5, topNoteY + 30);
            ctx.quadraticCurveTo(x - 13, topNoteY + 22, x - 9, topNoteY + 15);
          }
        }
        ctx.stroke();
      }
    }

    // Build a map from original note index to x position
    const xPositions = {};

    // Draw treble staff and notes
    drawStaff(trebleStaffTop, "treble");
    let x = LEFT_MARGIN + 35;
    let currentMeasure = 0;
    for (let i = 0; i < rightNotes.length; i++) {
      const note = rightNotes[i];

      if (note.measure > currentMeasure && currentMeasure > 0) {
        ctx.strokeStyle = "#bbb";
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(x - 5, trebleStaffTop);
        ctx.lineTo(x - 5, trebleStaffTop + 4 * STAFF_SPACING);
        if (hasBass) {
          ctx.moveTo(x - 5, bassStaffTop);
          ctx.lineTo(x - 5, bassStaffTop + 4 * STAFF_SPACING);
        }
        ctx.stroke();
        x += 8;
      }
      currentMeasure = note.measure;

      // Find original index in score.notes
      const origIndex = notes.indexOf(note);
      const isActive = origIndex === activeNoteIndex;
      xPositions[origIndex] = x;

      drawNote(note, x, trebleStaffTop, "right", isActive);
      x += getDurationWidth(note.duration) + NOTE_GAP;
    }

    // Draw bass staff and notes
    if (hasBass) {
      drawStaff(bassStaffTop, "bass");
      x = LEFT_MARGIN + 35;
      currentMeasure = 0;
      for (let i = 0; i < leftNotes.length; i++) {
        const note = leftNotes[i];
        if (note.measure > currentMeasure && currentMeasure > 0) {
          x += 8;
        }
        currentMeasure = note.measure;

        const origIndex = notes.indexOf(note);
        const isActive = origIndex === activeNoteIndex;
        xPositions[origIndex] = x;

        drawNote(note, x, bassStaffTop, "left", isActive);
        x += getDurationWidth(note.duration) + NOTE_GAP;
      }
    }

    noteXPositions.current = xPositions;

  }, [score, activeNoteIndex]);

  // Auto-scroll to active note
  useEffect(() => {
    if (activeNoteIndex >= 0 && scrollRef.current && noteXPositions.current[activeNoteIndex]) {
      const x = noteXPositions.current[activeNoteIndex];
      const container = scrollRef.current;
      const containerWidth = container.clientWidth;
      // Scroll so the active note is roughly 1/3 from the left
      const targetScroll = x - containerWidth / 3;
      container.scrollTo({ left: targetScroll, behavior: "smooth" });
    }
  }, [activeNoteIndex]);

  if (!score || !score.notes) return null;

  return (
    <div
      ref={scrollRef}
      className="w-full overflow-x-auto rounded-xl shadow-md bg-[#FFFDF7]"
      style={{ WebkitOverflowScrolling: "touch" }}
    >
      <canvas ref={canvasRef} />
    </div>
  );
}
