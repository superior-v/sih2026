// LiveScanner.tsx (or paste above/below OCRScanner in same file)
import React, { useEffect, useRef, useState } from "react";

type Props = {
  onFrameBlob: (blob: Blob) => Promise<void>;
};

const LiveScanner: React.FC<Props> = ({ onFrameBlob }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const [active, setActive] = useState(false);
  const [intervalMs, setIntervalMs] = useState<number>(1500); // capture frequency
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function start() {
    if (active) return;
    try {
      const constraints: MediaStreamConstraints = {
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      };
      const s = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = s;
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        await videoRef.current.play();
      }
      setActive(true);
      timerRef.current = window.setInterval(capture, intervalMs);
    } catch (err: any) {
      console.error("camera error", err);
      alert("Cannot access camera: " + (err?.message || err));
    }
  }

  function stop() {
    if (timerRef.current != null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setActive(false);
    setBusy(false);
  }

  async function capture() {
    if (!videoRef.current || busy) return;
    if ((videoRef.current as any).readyState < 2) return;
    setBusy(true);
    try {
      const v = videoRef.current!;
      const canvas = document.createElement("canvas");
      canvas.width = v.videoWidth || 1280;
      canvas.height = v.videoHeight || 720;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas unsupported");
      ctx.drawImage(v, 0, 0, canvas.width, canvas.height);

      // Optional: downscale to reduce payload
      const MAX_W = 1200;
      let outCanvas = canvas;
      if (canvas.width > MAX_W) {
        const scale = MAX_W / canvas.width;
        outCanvas = document.createElement("canvas");
        outCanvas.width = Math.round(canvas.width * scale);
        outCanvas.height = Math.round(canvas.height * scale);
        outCanvas.getContext("2d")!.drawImage(canvas, 0, 0, outCanvas.width, outCanvas.height);
      }

      const blob: Blob = await new Promise((res) =>
        outCanvas.toBlob((b) => res(b as Blob), "image/jpeg", 0.85)
      );

      await onFrameBlob(blob);
    } catch (e) {
      console.error("capture error", e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-white rounded-xl p-4 border border-gray-100 mt-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="font-semibold text-sm">Live scanner</h4>
          <p className="text-xs text-gray-600">Use device camera to capture frames</p>
        </div>
        <div className="space-x-2">
          <button
            onClick={() => (active ? stop() : start())}
            className={`px-3 py-1 rounded ${active ? "bg-red-500 text-white" : "bg-green-600 text-white"}`}
          >
            {active ? "Stop" : "Start"}
          </button>
          <button
            onClick={() => setFacingMode((m) => (m === "environment" ? "user" : "environment"))}
            className="px-2 py-1 border rounded"
          >
            Toggle
          </button>
        </div>
      </div>

      <div className="flex gap-4">
        <video ref={videoRef} playsInline muted className="bg-black rounded" style={{ width: 240, height: 160 }} />
        <div className="flex-1">
          <label className="text-xs text-gray-600">Capture interval (ms)</label>
          <input
            type="number"
            value={intervalMs}
            onChange={(e) => {
              const v = Math.max(500, Number(e.target.value) || 1500);
              setIntervalMs(v);
              if (timerRef.current != null) {
                clearInterval(timerRef.current);
                timerRef.current = window.setInterval(capture, v);
              }
            }}
            className="border rounded px-2 py-1 w-32"
          />
          <div className="text-xs text-gray-500 mt-2">{busy ? "Sending frame…" : "Idle"}</div>
        </div>
      </div>
    </div>
  );
};

export default LiveScanner;
