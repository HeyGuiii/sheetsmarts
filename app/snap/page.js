"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import CameraCapture from "../../components/CameraCapture";
import ScoreDisplay from "../../components/ScoreDisplay";
import PlaybackControls from "../../components/PlaybackControls";

export default function SnapPage() {
  const [score, setScore] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeNote, setActiveNote] = useState(-1);
  const [capturedImage, setCapturedImage] = useState(null);

  const handleCapture = useCallback(async (base64Image) => {
    setCapturedImage(base64Image);
    setLoading(true);
    setError(null);
    setScore(null);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      const res = await fetch("/api/read-music", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64Image }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        // Non-streaming error response
        const errData = await res.json().catch(() => null);
        setError(errData?.error || `Server error (${res.status})`);
      } else {
        // Read the streamed text response
        const text = await res.text();

        // Parse the JSON, handling possible code fences
        let cleaned = text.trim();
        if (cleaned.startsWith("```")) {
          cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
        }

        // Check if the response contains an error
        if (cleaned.includes('"error"')) {
          try {
            const errObj = JSON.parse(cleaned);
            if (errObj.error) {
              setError(errObj.error);
            } else {
              setScore(errObj);
            }
          } catch {
            setError("Could not read the music. Try a clearer photo.");
          }
        } else {
          const data = JSON.parse(cleaned);
          setScore(data);
        }
      }
    } catch (err) {
      if (err.name === "AbortError") {
        setError("It took too long — try a simpler photo with less music on the page.");
      } else {
        setError("Lost connection. Make sure you have good signal and try again.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const handleReset = useCallback(() => {
    setScore(null);
    setError(null);
    setCapturedImage(null);
    setActiveNote(-1);
  }, []);

  return (
    <div className="flex flex-col flex-1 items-center p-6 gap-6">
      {/* Header */}
      <div className="flex items-center w-full max-w-md">
        <Link href="/" className="text-2xl mr-3">←</Link>
        <h1 className="text-2xl font-bold">Snap & Play</h1>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center gap-3 py-12">
          <div className="text-5xl animate-bounce-note">🎵</div>
          <p className="text-lg text-gray-500">Reading your music...</p>
          <p className="text-sm text-gray-400">This takes a few seconds</p>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="flex flex-col items-center gap-4 py-8">
          <p className="text-red-500 text-center">{error}</p>
          <button
            onClick={handleReset}
            className="bg-blue-500 text-white rounded-full px-6 py-3 font-bold active:scale-95 transition-transform"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Camera (show when no score and not loading) */}
      {!score && !loading && !error && (
        <div className="flex flex-col items-center gap-4 py-4">
          <p className="text-gray-500 text-center">
            Take a photo of your sheet music and hear how it sounds!
          </p>
          <CameraCapture onCapture={handleCapture} />
        </div>
      )}

      {/* Score display and playback */}
      {score && (
        <div className="flex flex-col items-center gap-6 w-full">
          {/* Show captured image thumbnail */}
          {capturedImage && (
            <div className="w-full max-w-md">
              <img
                src={`data:image/jpeg;base64,${capturedImage}`}
                alt="Captured sheet music"
                className="w-full rounded-xl shadow-md"
              />
            </div>
          )}

          <ScoreDisplay score={score} activeNoteIndex={activeNote} />

          <PlaybackControls
            score={score}
            onNotePlay={(index) => setActiveNote(index)}
            onFinish={() => setActiveNote(-1)}
          />

          <div className="flex gap-3">
            <button
              onClick={handleReset}
              className="bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-full px-6 py-3 font-bold active:scale-95 transition-all"
            >
              📷 New Photo
            </button>
            <Link
              href="/practice"
              onClick={() => {
                // Store score in sessionStorage so Practice page can use it
                if (typeof window !== "undefined") {
                  sessionStorage.setItem("sheetsmarts-score", JSON.stringify(score));
                }
              }}
              className="bg-orange-500 hover:bg-orange-600 text-white rounded-full px-6 py-3 font-bold active:scale-95 transition-all"
            >
              🎹 Practice This
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
