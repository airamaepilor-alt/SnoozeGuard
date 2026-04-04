import type { FaceLandmarkerResult } from "@mediapipe/tasks-vision";

export type FaceFrameScores = {
  jawOpen: number;
  yawDeg: number;
  pitchDeg: number;
  rollDeg: number;
  faceDetected: boolean;
};

/** Row-major 4×4 `facialTransformationMatrixes[0].data` → degrees (approximate). */
export function eulerDegreesFromMatrix(data: Float32Array | readonly number[]): { yaw: number; pitch: number; roll: number } {
  if (data.length < 16) return { yaw: 0, pitch: 0, roll: 0 };
  const r00 = data[0];
  const r10 = data[4];
  const r20 = data[8];
  const r21 = data[9];
  const r22 = data[10];
  const sy = Math.hypot(r00, r10);
  if (sy > 1e-6) {
    const roll = Math.atan2(r21, r22);
    const pitch = Math.atan2(-r20, sy);
    const yaw = Math.atan2(r10, r00);
    const toDeg = 180 / Math.PI;
    return { yaw: yaw * toDeg, pitch: pitch * toDeg, roll: roll * toDeg };
  }
  return { yaw: 0, pitch: 0, roll: 0 };
}

export function parseFaceLandmarkerResult(r: FaceLandmarkerResult): FaceFrameScores {
  const faceDetected = (r.faceLandmarks?.length ?? 0) > 0;
  let jawOpen = 0;
  const cats = r.faceBlendshapes?.[0]?.categories;
  if (cats) {
    const jaw = cats.find((c) => c.categoryName === "jawOpen");
    jawOpen = jaw?.score ?? 0;
  }
  const m = r.facialTransformationMatrixes?.[0];
  const e = m?.data ? eulerDegreesFromMatrix(m.data) : { yaw: 0, pitch: 0, roll: 0 };
  return {
    jawOpen,
    yawDeg: e.yaw,
    pitchDeg: e.pitch,
    rollDeg: e.roll,
    faceDetected,
  };
}
