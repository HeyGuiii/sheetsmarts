"use client";

import { useRef, useState, useCallback, useEffect } from "react";

// Resize image to max dimension and compress as JPEG
function resizeImage(base64, maxDim = 800) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        const ratio = Math.min(maxDim / width, maxDim / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
      resolve(dataUrl.split(",")[1]);
    };
    img.src = `data:image/jpeg;base64,${base64}`;
  });
}

export default function CameraCapture({ onCapture }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [error, setError] = useState(null);

  // Once cameraActive becomes true and the video element renders, attach the stream
  useEffect(() => {
    if (cameraActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [cameraActive]);

  const startCamera = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
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
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

  const capturePhoto = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
    const rawBase64 = dataUrl.split(",")[1];

    stopCamera();

    // Resize to keep payload small
    const compressed = await resizeImage(rawBase64);
    onCapture(compressed);
  }, [onCapture, stopCamera]);

  // Resize uploaded photos too
  const handleFileUpload = useCallback(
    async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async () => {
        const rawBase64 = reader.result.split(",")[1];
        const compressed = await resizeImage(rawBase64);
        onCapture(compressed);
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
          <input type="file" accept="image/*"
            className="hidden" onChange={handleFileUpload} />
        </label>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-full max-w-md rounded-2xl overflow-hidden shadow-lg bg-black">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
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
