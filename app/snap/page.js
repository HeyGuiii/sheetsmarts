"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import CameraCapture from "../../components/CameraCapture";
import ScoreDisplay from "../../components/ScoreDisplay";
import PlaybackControls from "../../components/PlaybackControls";
import SheetMusicView from "../../components/SheetMusicView";
import { getSavedSongs, saveSong, deleteSong } from "../../lib/songLibrary";

const CONTEXT_STORAGE_KEY = "sheetsmarts-context";

function loadContext() {
  if (typeof window === "undefined") return { book: "", songTitle: "", notes: "" };
  try {
    const raw = localStorage.getItem(CONTEXT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : { book: "", songTitle: "", notes: "" };
  } catch { return { book: "", songTitle: "", notes: "" }; }
}

function saveContextToStorage(ctx) {
  try { localStorage.setItem(CONTEXT_STORAGE_KEY, JSON.stringify(ctx)); } catch {}
}

async function parseStreamedResponse(res) {
  const text = await res.text();
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }
  return JSON.parse(cleaned);
}

export default function SnapPage() {
  const [score, setScore] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [error, setError] = useState(null);
  const [activeNote, setActiveNote] = useState(-1);
  const [capturedImage, setCapturedImage] = useState(null);
  const [savedSongs, setSavedSongs] = useState([]);
  const [justSaved, setJustSaved] = useState(false);
  const [context, setContext] = useState({ book: "", songTitle: "", notes: "" });
  const [sourceMethod, setSourceMethod] = useState(null); // "lookup" or "photo"

  useEffect(() => {
    setSavedSongs(getSavedSongs());
    setContext(loadContext());
  }, []);

  const updateContext = useCallback((field, value) => {
    setContext((prev) => {
      const next = { ...prev, [field]: value };
      saveContextToStorage(next);
      return next;
    });
  }, []);

  // Try to look up the song by name first (cheap, fast, accurate)
  const handleLookup = useCallback(async () => {
    if (!context.songTitle.trim()) return;

    setLoading(true);
    setLoadingMessage("Looking up the song...");
    setError(null);
    setScore(null);
    setCapturedImage(null);
    setJustSaved(false);
    setSourceMethod(null);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      const res = await fetch("/api/lookup-song", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          book: context.book,
          songTitle: context.songTitle,
          notes: context.notes,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await parseStreamedResponse(res);

        if (data.found && data.notes?.length > 0) {
          setScore(data);
          setSourceMethod("lookup");
          await saveSong(data, null);
          setSavedSongs(getSavedSongs());
          setJustSaved(true);
          setLoading(false);
          return;
        }
      }

      // Song not found — tell user to take a photo
      setLoading(false);
      setError("I don't know that piece by name. Take a photo and I'll read it from the sheet music!");
    } catch (err) {
      setLoading(false);
      if (err.name === "AbortError") {
        setError("Took too long. Try again.");
      } else {
        setError("Could not look up the song. Try taking a photo instead.");
      }
    }
  }, [context]);

  // Fall back to reading from photo
  const handleCapture = useCallback(async (base64Image) => {
    setCapturedImage(base64Image);
    setLoading(true);
    setLoadingMessage("Reading the sheet music...");
    setError(null);
    setScore(null);
    setJustSaved(false);
    setSourceMethod(null);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 90000);

      const res = await fetch("/api/read-music", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: base64Image,
          book: context.book,
          songTitle: context.songTitle,
          notes: context.notes,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        setError(errData?.error || `Server error (${res.status})`);
      } else {
        const data = await parseStreamedResponse(res);

        if (data.error) {
          setError(data.error);
        } else {
          setScore(data);
          setSourceMethod("photo");
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
  }, [context]);

  const handleReset = useCallback(() => {
    setScore(null);
    setError(null);
    setCapturedImage(null);
    setActiveNote(-1);
    setJustSaved(false);
    setSourceMethod(null);
  }, []);

  const handleLoadSong = useCallback((song) => {
    setScore(song.score);
    setCapturedImage(song.image);
    setActiveNote(-1);
    setError(null);
    setJustSaved(false);
    setSourceMethod(null);
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
          <p className="text-lg text-gray-500">{loadingMessage}</p>
          <p className="text-sm text-gray-400">This may take 20-30 seconds</p>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="flex flex-col items-center gap-4 py-8 w-full max-w-md">
          <p className="text-red-500 text-center">{error}</p>
          <div className="flex gap-3">
            <button
              onClick={handleReset}
              className="bg-gray-200 text-gray-700 rounded-full px-6 py-3 font-bold active:scale-95 transition-transform"
            >
              Start Over
            </button>
          </div>

          {/* Show camera option if lookup failed */}
          {!capturedImage && (
            <div className="w-full mt-4">
              <p className="text-gray-500 text-center text-sm mb-3">Or take a photo:</p>
              <CameraCapture onCapture={handleCapture} />
            </div>
          )}
        </div>
      )}

      {/* Input (show when no score and not loading and no error) */}
      {!score && !loading && !error && (
        <div className="flex flex-col items-center gap-4 py-4 w-full max-w-md">
          {/* Context fields */}
          <div className="w-full bg-white rounded-2xl p-4 shadow-sm border border-gray-200 flex flex-col gap-3">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase">Book</label>
              <input
                type="text"
                value={context.book}
                onChange={(e) => updateContext("book", e.target.value)}
                placeholder='e.g. "Piano Adventures Level 1"'
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase">Song Title</label>
              <input
                type="text"
                value={context.songTitle}
                onChange={(e) => updateContext("songTitle", e.target.value)}
                placeholder='e.g. "Ode to Joy"'
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase">Extra Notes</label>
              <input
                type="text"
                value={context.notes}
                onChange={(e) => updateContext("notes", e.target.value)}
                placeholder='e.g. "page 42, key of G"'
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1"
              />
            </div>
          </div>

          {/* Primary action: Look up by name */}
          {context.songTitle.trim() && (
            <button
              onClick={handleLookup}
              className="bg-blue-500 hover:bg-blue-600 text-white rounded-full px-8 py-4 text-lg font-bold active:scale-95 transition-all shadow-lg w-full"
            >
              🔍 Find "{context.songTitle.trim()}"
            </button>
          )}

          {/* Divider */}
          <div className="flex items-center gap-3 w-full">
            <div className="flex-1 border-t border-gray-200" />
            <span className="text-sm text-gray-400">or take a photo</span>
            <div className="flex-1 border-t border-gray-200" />
          </div>

          {/* Secondary action: Camera */}
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
              {sourceMethod === "lookup"
                ? "Found it! Saved to your library."
                : "Read from photo! Saved to your library."}
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

          <div className="w-full max-w-md">
            <h3 className="text-sm font-bold text-gray-500 uppercase mb-2 text-center">
              {sourceMethod === "lookup" ? "From Memory" : "What I Read"}
            </h3>
            <SheetMusicView score={score} activeNoteIndex={activeNote} />
          </div>

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
