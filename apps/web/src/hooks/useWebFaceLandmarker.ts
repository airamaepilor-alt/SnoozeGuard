import { useCallback, useEffect, useRef } from "react";
import type { FaceLandmarker } from "@mediapipe/tasks-vision";
import { parseFaceLandmarkerResult, type FaceFrameScores } from "../lib/ml/faceMetrics";

const WASM_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.17/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

const DETECT_INTERVAL_MS = 130;

/**
 * Loads MediaPipe Face Landmarker in the browser (WASM + .task from Google CDN).
 * FR-2 / FR-3: jaw opening proxy for yawning; head pose from transformation matrix.
 */
export function useWebFaceLandmarker() {
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const runningRef = useRef(false);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    return () => {
      runningRef.current = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      void landmarkerRef.current?.close();
      landmarkerRef.current = null;
    };
  }, []);

  const stop = useCallback(() => {
    runningRef.current = false;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
  }, []);

  const start = useCallback(
    async (video: HTMLVideoElement, onScores: (s: FaceFrameScores) => void): Promise<string | null> => {
      stop();
      runningRef.current = true;
      try {
        const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
        if (!landmarkerRef.current) {
          const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
          landmarkerRef.current = await FaceLandmarker.createFromOptions(fileset, {
            baseOptions: {
              modelAssetPath: MODEL_URL,
              delegate: "CPU",
            },
            runningMode: "VIDEO",
            numFaces: 1,
            outputFaceBlendshapes: true,
            outputFacialTransformationMatrixes: true,
            minFaceDetectionConfidence: 0.4,
            minFacePresenceConfidence: 0.4,
            minTrackingConfidence: 0.4,
          });
        }
        const lm = landmarkerRef.current;
        let lastDetect = 0;
        const loop = () => {
          if (!runningRef.current) return;
          if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
            const now = performance.now();
            if (now - lastDetect >= DETECT_INTERVAL_MS) {
              lastDetect = now;
              const result = lm.detectForVideo(video, now);
              onScores(parseFaceLandmarkerResult(result));
            }
          }
          rafRef.current = requestAnimationFrame(loop);
        };
        rafRef.current = requestAnimationFrame(loop);
        return null;
      } catch (e) {
        runningRef.current = false;
        return e instanceof Error ? e.message : "Face Landmarker failed to start";
      }
    },
    [stop],
  );

  return { start, stop };
}
