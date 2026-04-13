"use client";

import { getNoteColor, getDurationWidth } from "../lib/noteUtils";

// Handle both old format (string) and new format (array) for pitch
function getPitches(note) {
  if (Array.isArray(note.pitch)) return note.pitch;
  return [note.pitch];
}

function isRest(note) {
  const pitches = getPitches(note);
  return pitches.length === 1 && pitches[0] === "REST";
}

export default function ScoreDisplay({ score, activeNoteIndex = -1, noteStatuses = null }) {
  if (!score || !score.notes || score.notes.length === 0) {
    return null;
  }

  return (
    <div className="w-full">
      {score.title && (
        <h2 className="text-xl font-bold text-center mb-3">{score.title}</h2>
      )}
      <div className="flex items-center gap-1 text-xs text-gray-500 justify-center mb-3">
        <span>Key: {score.keySignature || "C"}</span>
        <span>|</span>
        <span>Time: {(score.timeSignature || [4, 4]).join("/")}</span>
        <span>|</span>
        <span>BPM: {score.tempo || 100}</span>
      </div>
      <div className="flex flex-wrap gap-1.5 justify-center px-2">
        {score.notes.map((note, i) => {
          const isActive = i === activeNoteIndex;
          const status = noteStatuses ? noteStatuses[i] : null;
          const pitches = getPitches(note);
          const rest = isRest(note);
          const color = getNoteColor(pitches[0]);
          const widthMultiplier = getDurationWidth(note.duration);
          const isChord = pitches.length > 1;
          const hand = note.hand;

          let statusBorder = "";
          let statusIcon = "";
          if (status === "perfect") {
            statusBorder = "ring-2 ring-green-400";
            statusIcon = "✓";
          } else if (status === "close") {
            statusBorder = "ring-2 ring-yellow-400";
            statusIcon = "~";
          } else if (status === "wrong") {
            statusBorder = "ring-2 ring-red-400";
            statusIcon = "✗";
          } else if (status === "missed") {
            statusBorder = "ring-2 ring-red-400 opacity-50";
            statusIcon = "?";
          }

          return (
            <div
              key={i}
              className={`
                relative flex flex-col items-center justify-center
                rounded-xl px-1 text-white font-bold
                transition-all duration-200
                ${isActive ? "animate-bounce-note animate-glow scale-110 z-10" : ""}
                ${statusBorder}
                ${hand === "left" ? "border-b-4 border-white/30" : ""}
              `}
              style={{
                backgroundColor: rest ? "#d1d5db" : color,
                minWidth: `${Math.max(widthMultiplier * 20, 36)}px`,
                minHeight: isChord ? "68px" : "56px",
                padding: "4px 4px",
              }}
            >
              {statusIcon && (
                <span className="absolute -top-2 -right-2 bg-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold"
                  style={{ color: status === "perfect" ? "#22C55E" : status === "close" ? "#EAB308" : "#EF4444" }}
                >
                  {statusIcon}
                </span>
              )}

              {rest ? (
                <>
                  <span className="text-sm leading-none">–</span>
                  <span className="text-[10px] opacity-70 leading-none mt-0.5">rest</span>
                </>
              ) : isChord ? (
                <div className="flex flex-col items-center gap-0">
                  {pitches.map((p, j) => (
                    <span key={j} className="text-[11px] leading-tight">
                      {p.replace(/(\d)/, "")}
                      <span className="text-[8px] opacity-70">{p.match(/\d/)?.[0]}</span>
                    </span>
                  ))}
                </div>
              ) : (
                <>
                  <span className="text-sm leading-none">
                    {pitches[0].replace(/(\d)/, "")}
                  </span>
                  <span className="text-[10px] opacity-70 leading-none mt-0.5">
                    {pitches[0].match(/\d/)?.[0]}
                  </span>
                </>
              )}

              {hand && (
                <span className="text-[8px] opacity-50 leading-none mt-0.5">
                  {hand === "left" ? "L" : "R"}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
