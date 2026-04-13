"use client";

import { useState, useRef, useCallback } from "react";
import { createPitchListener } from "../lib/pitchDetector";

export default function Recorder({ onRecordingComplete }) {
  const [isRecording, setIsRecording] = useState(false);
  const [currentPitch, setCurrentPitch] = useState(null);
  const [detectedNotes, setDetectedNotes] = useState([]);
  const [error, setError] = useState(null);
  const listenerRef = useRef(null);
  const streamRef = useRef(null);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      setDetectedNotes([]);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const listener = createPitchListener(
        stream,
        (note) => {
          setDetectedNotes((prev) => [...prev, note]);
        },
        (pitch) => {
          setCurrentPitch(pitch);
        }
      );

      listenerRef.current = listener;
      setIsRecording(true);
    } catch (err) {
      setError("Could not access microphone. Please allow mic access and try again.");
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (listenerRef.current) {
      const notes = listenerRef.current.stop();
      listenerRef.current = null;

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      setIsRecording(false);
      setCurrentPitch(null);
      onRecordingComplete(notes);
    }
  }, [onRecordingComplete]);

  if (error) {
    return (
      <div className="text-center p-4">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <button
        onClick={isRecording ? stopRecording : startRecording}
        className={`
          ${isRecording ? "bg-red-500 hover:bg-red-600" : "bg-red-500 hover:bg-red-600"}
          text-white rounded-full w-24 h-24 text-lg font-bold
          active:scale-90 transition-all shadow-lg
          flex flex-col items-center justify-center
          ${isRecording ? "animate-pulse-red" : ""}
        `}
      >
        {isRecording ? (
          <>
            <span className="text-3xl">⏹</span>
            <span className="text-xs mt-1">Stop</span>
          </>
        ) : (
          <>
            <span className="text-3xl">🎤</span>
            <span className="text-xs mt-1">Record</span>
          </>
        )}
      </button>

      {isRecording && (
        <div className="text-center">
          <div className="flex items-center gap-2 justify-center">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse-red" />
            <span className="text-sm text-gray-600">Listening...</span>
          </div>
          {currentPitch?.note && (
            <p className="text-2xl font-bold mt-2 text-blue-500">
              {currentPitch.note}
            </p>
          )}
          <p className="text-xs text-gray-400 mt-1">
            {detectedNotes.length} note{detectedNotes.length !== 1 ? "s" : ""} detected
          </p>
        </div>
      )}
    </div>
  );
}
