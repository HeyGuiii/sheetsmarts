"use client";

import { useRef, useState, useCallback } from "react";

export default function CameraCapture({ onCapture }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [error, setError] = useState(null);

  const startCamera = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraActive(true);
    } catch (err) {
      setError("Could not access camera. Please allow camera access and try again.");
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0);

    // Get base64 without the data:image/jpeg;base64, prefix
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    const base64 = dataUrl.split(",")[1];

    stopCamera();
    onCapture(base64);
  }, [onCapture, stopCamera]);

  // Allow uploading a photo from gallery as fallback
  const handleFileUpload = useCallback(
    (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result.split(",")[1];
        onCapture(base64);
      };
      reader.readAsDataURL(file);
    },
    [onCapture]
  );

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 p-6">
        <p className="text-red-500 text-center">{error}</p>
        <label className="bg-blue-500 text-white rounded-full px-6 py-3 text-lg font-bold cursor-pointer active:scale-95 transition-transform">
          Upload a Photo Instead
          <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
        </label>
      </div>
    );
  }

  if (!cameraActive) {
    return (
      <div className="flex flex-col items-center gap-4 p-6">
        <button
          onClick={startCamera}
          className="bg-blue-500 hover:bg-blue-600 text-white rounded-full px-8 py-4 text-xl font-bold active:scale-95 transition-all shadow-lg"
        >
          📷 Open Camera
        </button>
        <label className="text-blue-500 underline cursor-pointer text-sm">
          Or upload a photo
          <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
        </label>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-full max-w-md rounded-2xl overflow-hidden shadow-lg">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="w-full"
        />
        <p className="absolute top-3 left-0 right-0 text-center text-white text-sm bg-black/40 py-1">
          Hold your phone flat above the music
        </p>
      </div>

      <div className="flex gap-4">
        <button
          onClick={capturePhoto}
          className="bg-blue-500 hover:bg-blue-600 text-white rounded-full w-20 h-20 text-3xl font-bold active:scale-90 transition-all shadow-lg border-4 border-white"
        >
          📷
        </button>
        <button
          onClick={stopCamera}
          className="bg-gray-400 hover:bg-gray-500 text-white rounded-full px-6 py-3 text-lg active:scale-95 transition-all"
        >
          Cancel
        </button>
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
