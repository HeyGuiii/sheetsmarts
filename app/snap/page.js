"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import CameraCapture from "../../components/CameraCapture";
import ScoreDisplay from "../../components/ScoreDisplay";
import PlaybackControls from "../../components/PlaybackControls";
import { getSavedSongs, saveSong, deleteSong } from "../../lib/songLibrary";

export default function SnapPage() {
  const [score, setScore] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeNote, setActiveNote] = useState(-1);
  const [capturedImage, setCapturedImage] = useState(null);
  const [savedSongs, setSavedSongs] = useState([]);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    setSavedSongs(getSavedSongs());
  }, []);

  const handleCapture = useCallback(async (base64Image) => {
    setCapturedImage(base64Image);
    setLoading(true);
    setError(null);
    setScore(null);
    setJustSaved(false);

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
        const errData = await res.json().catch(() => null);
        setError(errData?.error || `Server error (${res.status})`);
      } else {
        const text = await res.text();

        let cleaned = text.trim();
        if (cleaned.startsWith("```")) {
          cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
        }

        if (cleaned.includes('"error"')) {
          try {
            const errObj = JSON.parse(cleaned);
            if (errObj.error) {
              setError(errObj.error);
            } else {
              setScore(errObj);
              // Auto-save to library
              await saveSong(errObj, base64Image);
              setSavedSongs(getSavedSongs());
              setJustSaved(true);
            }
          } catch {
            setError("Could not read the music. Try a clearer photo.");
          }
        } else {
          const data = JSON.parse(cleaned);
          setScore(data);
          // Auto-save to library
          await saveSong(data, base64Image);
          setSavedSongs(getSavedSongs());
          setJustSaved(true);
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
    setJustSaved(false);
  }, []);

  const handleLoadSong = useCallback((song) => {
    setScore(song.score);
    setCapturedImage(song.image);
    setActiveNote(-1);
    setError(null);
    setJustSaved(false);
  }, []);

  const handleDeleteSong = useCallback((id, e) => {
    e.stopPropagation();
    deleteSong(id);
    setSavedSongs(getSavedSongs());
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
        <div className="flex flex-col items-center gap-4 py-4 w-full max-w-md">
          <p className="text-gray-500 text-center">
            Take a photo of your sheet music and hear how it sounds!
          </p>
          <CameraCapture onCapture={handleCapture} />

          {/* Saved songs library */}
          {savedSongs.length > 0 && (
            <div className="w-full mt-4">
              <h2 className="font-bold text-lg mb-2">Your Songs</h2>
              <div className="flex flex-col gap-2">
                {savedSongs.map((song) => (
                  <button
                    key={song.id}
                    onClick={() => handleLoadSong(song)}
                    className="bg-white border-2 border-gray-200 rounded-2xl p-3 text-left active:scale-[0.98] transition-all shadow-sm flex items-center gap-3"
                  >
                    {song.image && (
                      <img
                        src={`data:image/jpeg;base64,${song.image}`}
                        alt=""
                        className="w-14 h-14 rounded-lg object-cover flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-bold truncate">{song.title}</div>
                      <div className="text-xs text-gray-500">
                        {song.score.notes?.length || 0} notes | {new Date(song.savedAt).toLocaleDateString()}
                      </div>
                    </div>
                    <span
                      onClick={(e) => handleDeleteSong(song.id, e)}
                      className="text-gray-400 hover:text-red-500 text-lg px-2 flex-shrink-0"
                    >
                      ✕
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Score display and playback */}
      {score && (
        <div className="flex flex-col items-center gap-6 w-full">
          {justSaved && (
            <div className="bg-green-100 text-green-700 rounded-xl px-4 py-2 text-sm">
              Saved to your library!
            </div>
          )}

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
