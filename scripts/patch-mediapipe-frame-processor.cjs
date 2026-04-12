/**
 * Patches react-native-mediapipe Android native code.
 *
 * FIX 1 — FaceLandmarkDetectionModule.kt (detectOnImage)
 *   BUG: detectOnImage creates a new FaceLandmarkDetectorHelper (which loads the
 *   5 MB MediaPipe model into native memory) on every call and never releases it.
 *   After ~100 frames the process is OOM-killed.
 *   FIX: Call helper.clearFaceLandmarker() after each detection to free native memory.
 *
 * FIX 2 — FaceLandmarkDetectionFrameProcessorPlugin.kt (callback)
 *   BUG: `params!!["detectorHandle"] as Double` crashes with ClassCastException
 *   because react-native-worklets-core serializes JS integers as Java Int, not Double.
 *   FIX: Safe when-branch that handles Int / Double / Long / Float.
 *   (Not used with snapshot mode but kept for correctness.)
 */

const fs = require("fs");
const path = require("path");

// ─── FIX 1: detectOnImage memory leak ────────────────────────────────────────

const modulePath = path.resolve(
  __dirname,
  "../node_modules/react-native-mediapipe/android/src/main/java/com/reactnativemediapipe/facelandmarkdetection/FaceLandmarkDetectionModule.kt"
);

if (!fs.existsSync(modulePath)) {
  console.log("[patch-mediapipe] FaceLandmarkDetectionModule.kt not found — skipping fix 1");
} else {
  const src1 = fs.readFileSync(modulePath, "utf8");
  const BUG1 = `      val bundle = helper.detectImage(loadBitmapFromPath(imagePath))
      val resultArgs = convertResultBundleToWritableMap(bundle)

      promise.resolve(resultArgs)`;
  const FIX1 = `      val bundle = helper.detectImage(loadBitmapFromPath(imagePath))
      val resultArgs = convertResultBundleToWritableMap(bundle)
      // Release native ML model memory immediately — prevents OOM on long drives
      helper.clearFaceLandmarker()
      promise.resolve(resultArgs)`;

  if (src1.includes(FIX1)) {
    console.log("[patch-mediapipe] fix 1 already applied — skipping");
  } else if (!src1.includes(BUG1)) {
    console.log("[patch-mediapipe] fix 1 target not found — library may have changed, skipping");
  } else {
    fs.writeFileSync(modulePath, src1.replace(BUG1, FIX1), "utf8");
    console.log("[patch-mediapipe] ✔ fix 1: detectOnImage now calls clearFaceLandmarker()");
  }
}

// ─── FIX 2: FrameProcessorPlugin Int/Double cast ─────────────────────────────

const pluginPath = path.resolve(
  __dirname,
  "../node_modules/react-native-mediapipe/android/src/main/java/com/reactnativemediapipe/facelandmarkdetection/FaceLandmarkDetectionFrameProcessorPlugin.kt"
);

if (!fs.existsSync(pluginPath)) {
  console.log("[patch-mediapipe] FaceLandmarkDetectionFrameProcessorPlugin.kt not found — skipping fix 2");
} else {
  const src2 = fs.readFileSync(pluginPath, "utf8");
  const BUG2 = `    val detectorHandle: Double = params!!["detectorHandle"] as Double
    val detector = FaceLandmarkDetectorMap.detectorMap[detectorHandle.toInt()] ?: return false`;
  const FIX2 = `    // detectorHandle may arrive as Int or Double depending on how worklets serializes JS numbers
    val rawHandle = params?.get("detectorHandle") ?: return false
    val detectorHandleInt: Int = when (rawHandle) {
      is Double -> rawHandle.toInt()
      is Int -> rawHandle
      is Long -> rawHandle.toInt()
      is Float -> rawHandle.toInt()
      else -> return false
    }
    val detector = FaceLandmarkDetectorMap.detectorMap[detectorHandleInt] ?: return false`;

  if (src2.includes(FIX2)) {
    console.log("[patch-mediapipe] fix 2 already applied — skipping");
  } else if (!src2.includes(BUG2)) {
    console.log("[patch-mediapipe] fix 2 target not found — library may have changed, skipping");
  } else {
    fs.writeFileSync(pluginPath, src2.replace(BUG2, FIX2), "utf8");
    console.log("[patch-mediapipe] ✔ fix 2: FrameProcessorPlugin handles Int/Double detectorHandle");
  }
}
