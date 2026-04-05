/**
 * Windows NDK + lld sometimes omits -lc++_shared from the link line for prefab CMake
 * targets, causing undefined std::__ndk1::* symbols. Append an explicit c++_shared link.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");

const edits = [
  {
    file: "node_modules/react-native-worklets-core/android/CMakeLists.txt",
    needle: "target_link_libraries(${PACKAGE_NAME} c++_shared)",
  },
  {
    file: "node_modules/react-native-worklets/android/CMakeLists.txt",
    needle: "target_link_libraries(worklets c++_shared)",
  },
  {
    file: "node_modules/expo-modules-core/android/CMakeLists.txt",
    needle: "target_link_libraries(${PACKAGE_NAME} c++_shared)",
  },
];

for (const { file, needle } of edits) {
  const abs = path.join(root, file);
  if (!fs.existsSync(abs)) continue;
  let s = fs.readFileSync(abs, "utf8");
  if (s.includes(needle)) continue;
  if (!s.endsWith("\n")) s += "\n";
  s += `\n${needle}\n`;
  fs.writeFileSync(abs, s);
}
