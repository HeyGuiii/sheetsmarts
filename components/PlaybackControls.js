"use client";

import { useState, useRef, useCallback } from "react";
import { playScore, stopPlayback } from "../lib/scorePlayer";

export default function PlaybackControls({ score, onNotePlay, onFinish }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [tempo, setTempo] = useState(score?.tempo || 100);
  const stopRef = useRef(null);

  const handlePlay = useCallback(async () => {
    if (isPlaying) {
      // Stop
      if (stopRef.current) stopRef.current();
      stopPlayback();
      setIsPlaying(false);
      if (onFinish) onFinish();
      return;
    }

    setIsPlaying(true);
    const scoreWithTempo = { ...score, tempo };
    stopRef.current = await playScore(scoreWithTempo, {
      onNotePlay,
      onFinish: () => {
        setIsPlaying(false);
        if (onFinish) onFinish();
      },
    });
  }, [isPlaying, score, tempo, onNotePlay, onFinish]);

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-sm">
      <button
        onClick={handlePlay}
        className={`
          ${isPlaying ? "bg-red-500 hover:bg-red-600" : "bg-green-500 hover:bg-green-600"}
          text-white rounded-full px-10 py-4 text-xl font-bold
          active:scale-95 transition-all shadow-lg
        `}
      >
        {isPlaying ? "⏹ Stop" : "▶ Listen"}
      </button>

      <div className="flex items-center gap-3 w-full">
        <span className="text-sm text-gray-500">🐢</span>
        <input
          type="range"
          min={40}
          max={200}
          value={tempo}
          onChange={(e) => setTempo(Number(e.target.value))}
          className="flex-1 accent-blue-500"
          disabled={isPlaying}
        />
        <span className="text-sm text-gray-500">🐇</span>
        <span className="text-sm font-mono text-gray-600 w-16 text-right">{tempo} BPM</span>
      </div>
    </div>
  );
}
