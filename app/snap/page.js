"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import CameraCapture from "../../components/CameraCapture";
// ScoreDisplay removed — SheetMusicView replaces it
import PlaybackControls from "../../components/PlaybackControls";
import SheetMusicView from "../../components/SheetMusicView";
import { getSavedSongs, saveSong, deleteSong } from "../../lib/songLibrary";

export default function SnapPage() {
  const [score, setScore] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeNote, setActiveNote] = useState(-1);
  const [savedSongs, setSavedSongs] = useState([]);
  const [justSaved, setJustSaved] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    setSavedSongs(getSavedSongs());
  }, []);

  const handleCapture = useCallback(async (base64Image) => {
    setLoading(true);
    setError(null);
    setScore(null);
    setJustSaved(false);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 180000);

      const res = await fetch("https://three-pianos-decide.loca.lt/recognize", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Bypass-Tunnel-Reminder": "true" },
        body: JSON.stringify({ image: base64Image }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        setError(errData?.detail || `OMR service error (${res.status}). Try again.`);
      } else {
        const data = await res.json();
        if (data.error) {
          setError(data.error);
        } else {
          setScore(data);
          await saveSong(data, null);
          setSavedSongs(getSavedSongs());
          setJustSaved(true);
        }
      }
    } catch (err) {
      if (err.name === "AbortError") {
        setError("It took too long — try a clearer photo.");
      } else {
        setError("Lost connection. Make sure your PC is running the OMR server.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const handleReset = useCallback(() => {
    setScore(null);
    setError(null);
    setActiveNote(-1);
    setJustSaved(false);
  }, []);

  const handleLoadSong = useCallback((song) => {
    setScore(song.score);
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
      <div className="flex items-center w-full max-w-md">
        <Link href="/" className="text-2xl mr-3">←</Link>
        <h1 className="text-2xl font-bold">Snap & Play</h1>
      </div>

      {loading && (
        <div className="flex flex-col items-center gap-3 py-12">
          <div className="text-5xl animate-bounce-note">🎵</div>
          <p className="text-lg text-gray-500">Reading sheet music...</p>
          <p className="text-sm text-gray-400">This may take 30-90 seconds</p>
        </div>
      )}

      {error && (
        <div className="flex flex-col items-center gap-4 py-8 w-full max-w-md">
          <p className="text-red-500 text-center">{error}</p>
          <button
            onClick={handleReset}
            className="bg-blue-500 text-white rounded-full px-6 py-3 font-bold active:scale-95 transition-transform"
          >
            Try Again
          </button>
        </div>
      )}

      {!score && !loading && !error && (
        <div className="flex flex-col items-center gap-4 py-4 w-full max-w-md">
          <p className="text-gray-500 text-center">
            Take a photo of your sheet music and hear how it sounds!
          </p>

          <CameraCapture onCapture={handleCapture} />

          {savedSongs.length > 0 && (
            <div className="w-full mt-4">
              <h2 className="font-bold text-lg mb-2">Your Songs</h2>
              {savedSongs.length > 3 && (
                <input
                  type="text"
                  placeholder="Search songs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-2"
                />
              )}
              <div className="flex flex-col gap-2">
                {savedSongs
                  .filter((song) => !searchQuery || song.title.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map((song) => (
                  <button
                    key={song.id}
                    onClick={() => handleLoadSong(song)}
                    className="bg-white border-2 border-gray-200 rounded-2xl p-3 text-left active:scale-[0.98] transition-all shadow-sm flex items-center gap-3"
                  >
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

      {score && (
        <div className="flex flex-col items-center gap-6 w-full">
          {justSaved && (
            <div className="bg-green-100 text-green-700 rounded-xl px-4 py-2 text-sm">
              Saved to your library!
            </div>
          )}

          <div className="w-full max-w-md">
            <h3 className="text-sm font-bold text-gray-500 uppercase mb-2 text-center">
              What I Read <span className="text-xs font-normal text-gray-400">(tap a note to edit)</span>
            </h3>
            <SheetMusicView
              score={score}
              activeNoteIndex={activeNote}
              editable={true}
              onScoreChange={(newScore) => {
                setScore(newScore);
                // Update in library too
                saveSong(newScore, null).then(() => setSavedSongs(getSavedSongs()));
              }}
            />
          </div>

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
              📷 New Song
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
