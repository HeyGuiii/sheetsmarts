"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import ScoreDisplay from "../../components/ScoreDisplay";
import PlaybackControls from "../../components/PlaybackControls";
import Recorder from "../../components/Recorder";
import FeedbackDisplay from "../../components/FeedbackDisplay";
import { ALL_DEMOS } from "../../lib/demoScores";

export default function PracticePage() {
  const [score, setScore] = useState(null);
  const [activeNote, setActiveNote] = useState(-1);
  const [recordedNotes, setRecordedNotes] = useState(null);
  const [phase, setPhase] = useState("select"); // select | ready | feedback

  // Check sessionStorage for a score from Snap & Play
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = sessionStorage.getItem("sheetsmarts-score");
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setScore(parsed);
          setPhase("ready");
          sessionStorage.removeItem("sheetsmarts-score");
        } catch {}
      }
    }
  }, []);

  const selectScore = useCallback((s) => {
    setScore(s);
    setPhase("ready");
    setRecordedNotes(null);
    setActiveNote(-1);
  }, []);

  const handleRecordingComplete = useCallback((notes) => {
    setRecordedNotes(notes);
    setPhase("feedback");
  }, []);

  const handleTryAgain = useCallback(() => {
    setRecordedNotes(null);
    setPhase("ready");
    setActiveNote(-1);
  }, []);

  const handleBack = useCallback(() => {
    setScore(null);
    setRecordedNotes(null);
    setPhase("select");
    setActiveNote(-1);
  }, []);

  return (
    <div className="flex flex-col flex-1 items-center p-6 gap-6">
      {/* Header */}
      <div className="flex items-center w-full max-w-md">
        <Link href="/" className="text-2xl mr-3">←</Link>
        <h1 className="text-2xl font-bold">Practice</h1>
      </div>

      {/* Phase: Select a song */}
      {phase === "select" && (
        <div className="flex flex-col items-center gap-4 w-full max-w-sm">
          <p className="text-gray-500 text-center">
            Pick a song to practice, or snap a photo of your sheet music first!
          </p>

          <div className="flex flex-col gap-3 w-full">
            {ALL_DEMOS.map((demo, i) => (
              <button
                key={i}
                onClick={() => selectScore(demo)}
                className="bg-white hover:bg-gray-50 border-2 border-gray-200 rounded-2xl p-4 text-left active:scale-[0.98] transition-all shadow-sm"
              >
                <div className="font-bold text-lg">{demo.title}</div>
                <div className="text-sm text-gray-500">
                  {demo.notes.length} notes | {demo.tempo} BPM
                </div>
              </button>
            ))}
          </div>

          <Link
            href="/snap"
            className="bg-blue-500 hover:bg-blue-600 text-white rounded-full px-6 py-3 font-bold active:scale-95 transition-all shadow-lg mt-2"
          >
            📷 Snap Sheet Music
          </Link>
        </div>
      )}

      {/* Phase: Ready to practice */}
      {phase === "ready" && score && (
        <div className="flex flex-col items-center gap-6 w-full">
          <ScoreDisplay score={score} activeNoteIndex={activeNote} />

          <PlaybackControls
            score={score}
            onNotePlay={(index) => setActiveNote(index)}
            onFinish={() => setActiveNote(-1)}
          />

          <div className="flex flex-col items-center gap-2 bg-white rounded-2xl p-6 shadow-md w-full max-w-sm">
            <p className="text-gray-600 text-center text-sm mb-2">
              Listen first, then record yourself playing!
            </p>
            <Recorder onRecordingComplete={handleRecordingComplete} />
          </div>

          <button
            onClick={handleBack}
            className="text-gray-500 underline text-sm"
          >
            ← Pick a different song
          </button>
        </div>
      )}

      {/* Phase: Feedback */}
      {phase === "feedback" && score && recordedNotes && (
        <div className="flex flex-col items-center gap-6 w-full">
          <FeedbackDisplay
            expectedNotes={score.notes}
            recordedNotes={recordedNotes}
            onTryAgain={handleTryAgain}
          />

          <button
            onClick={handleBack}
            className="text-gray-500 underline text-sm"
          >
            ← Pick a different song
          </button>
        </div>
      )}
    </div>
  );
}
