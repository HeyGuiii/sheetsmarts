"use client";

import { getNoteColor, getDurationWidth } from "../lib/noteUtils";

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
          const color = getNoteColor(note.pitch);
          const widthMultiplier = getDurationWidth(note.duration);
          const isRest = note.pitch === "REST";

          // Determine border/glow based on status
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
                rounded-xl px-1 py-2 text-white font-bold
                transition-all duration-200
                ${isActive ? "animate-bounce-note animate-glow scale-110 z-10" : ""}
                ${statusBorder}
              `}
              style={{
                backgroundColor: isRest ? "#d1d5db" : color,
                minWidth: `${Math.max(widthMultiplier * 20, 36)}px`,
                height: "56px",
              }}
            >
              {statusIcon && (
                <span className="absolute -top-2 -right-2 bg-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold"
                  style={{ color: status === "perfect" ? "#22C55E" : status === "close" ? "#EAB308" : "#EF4444" }}
                >
                  {statusIcon}
                </span>
              )}
              <span className="text-sm leading-none">
                {isRest ? "–" : note.pitch.replace(/(\d)/, "")}
              </span>
              <span className="text-[10px] opacity-70 leading-none mt-0.5">
                {isRest ? "rest" : note.pitch.match(/\d/)?.[0]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
