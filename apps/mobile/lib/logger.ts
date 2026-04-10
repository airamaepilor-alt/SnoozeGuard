import * as FileSystem from "expo-file-system";
import { Paths } from "expo-file-system/next";

// expo-file-system v19: documentDirectory lives on Paths from the "next" sub-module.
const LOG_DIR = `${Paths.document.uri}logs`;
const LOG_FILE = `${LOG_DIR}/app.log`;
const MAX_LOG_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

interface LogEntry {
  timestamp: string;
  level: "INFO" | "WARN" | "ERROR" | "DEBUG";
  tag: string;
  message: string;
}

let logBuffer: LogEntry[] = [];
let logBufferSize = 0;
const BUFFER_SIZE_LIMIT = 1024 * 1024; // 1 MB buffer before flushing

export const logger = {
  async init() {
    try {
      const logDirInfo = await FileSystem.getInfoAsync(LOG_DIR);
      if (!logDirInfo.exists) {
        await FileSystem.makeDirectoryAsync(LOG_DIR, { intermediates: true });
      }
    } catch (error) {
      console.error("[Logger] Failed to initialize log directory:", error);
    }
  },

  async log(level: "INFO" | "WARN" | "ERROR" | "DEBUG", tag: string, message: string) {
    const timestamp = new Date().toISOString();
    const entry: LogEntry = { timestamp, level, tag, message };

    logBuffer.push(entry);
    logBufferSize += JSON.stringify(entry).length;

    const prefix = `[${level}] [${tag}]`;
    switch (level) {
      case "ERROR":
        console.error(prefix, message);
        break;
      case "WARN":
        console.warn(prefix, message);
        break;
      case "DEBUG":
        console.debug(prefix, message);
        break;
      default:
        console.log(prefix, message);
    }

    if (logBufferSize > BUFFER_SIZE_LIMIT) {
      await this.flushLogs();
    }
  },

  async flushLogs() {
    if (logBuffer.length === 0) return;
    try {
      const logText = logBuffer
        .map((e) => `${e.timestamp} ${e.level} [${e.tag}] ${e.message}`)
        .join("\n");

      const fileInfo = await FileSystem.getInfoAsync(LOG_FILE);
      let currentContent = "";
      if (fileInfo.exists && fileInfo.size) {
        currentContent = await FileSystem.readAsStringAsync(LOG_FILE);
      }

      const newContent = currentContent ? currentContent + "\n" + logText : logText;

      if (newContent.length > MAX_LOG_FILE_SIZE) {
        // Truncate rather than archive for simplicity
        await FileSystem.writeAsStringAsync(LOG_FILE, logText);
      } else {
        await FileSystem.writeAsStringAsync(LOG_FILE, newContent);
      }

      logBuffer = [];
      logBufferSize = 0;
    } catch (error) {
      console.error("[Logger] Failed to flush logs:", error);
    }
  },

  async getLogs(): Promise<string> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(LOG_FILE);
      if (!fileInfo.exists) return "No logs available";
      return await FileSystem.readAsStringAsync(LOG_FILE);
    } catch (error) {
      console.error("[Logger] Failed to read logs:", error);
      return "Error reading logs";
    }
  },

  async clearLogs() {
    try {
      await FileSystem.deleteAsync(LOG_FILE, { idempotent: true });
      logBuffer = [];
      logBufferSize = 0;
    } catch (error) {
      console.error("[Logger] Failed to clear logs:", error);
    }
  },

  info(tag: string, message: string) {
    void this.log("INFO", tag, message);
  },

  warn(tag: string, message: string) {
    void this.log("WARN", tag, message);
  },

  error(tag: string, message: string) {
    void this.log("ERROR", tag, message);
  },

  debug(tag: string, message: string) {
    void this.log("DEBUG", tag, message);
  },
};
