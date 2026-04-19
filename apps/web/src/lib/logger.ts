type LogLevel = "debug" | "info" | "warn" | "error";

type LogEntry = {
  ts: string;
  level: LogLevel;
  tag: string;
  message: string;
  data?: unknown;
};

const MAX_ENTRIES = 1000;
const STORAGE_KEY = "sg_logs";

let entries: LogEntry[] = [];

try {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) entries = JSON.parse(raw) as LogEntry[];
} catch {}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)));
  } catch {}
}

function write(level: LogLevel, tag: string, message: string, data?: unknown) {
  const entry: LogEntry = {
    ts: new Date().toISOString(),
    level,
    tag,
    message,
    ...(data !== undefined ? { data } : {}),
  };
  entries.push(entry);
  if (entries.length > MAX_ENTRIES) entries.shift();
  persist();

  const prefix = `[SG:${tag}]`;
  const fn = level === "error" ? console.error
    : level === "warn" ? console.warn
    : level === "info" ? console.info
    : console.log;
  data !== undefined ? fn(prefix, message, data) : fn(prefix, message);
}

export const logger = {
  debug: (tag: string, msg: string, data?: unknown) => write("debug", tag, msg, data),
  info:  (tag: string, msg: string, data?: unknown) => write("info",  tag, msg, data),
  warn:  (tag: string, msg: string, data?: unknown) => write("warn",  tag, msg, data),
  error: (tag: string, msg: string, data?: unknown) => write("error", tag, msg, data),

  /** Download all captured log entries as a .json file. */
  download() {
    const blob = new Blob([JSON.stringify(entries, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sg-log-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  clear() {
    entries = [];
    localStorage.removeItem(STORAGE_KEY);
  },

  getEntries: () => [...entries],
};

// Expose on window so DevTools console can call window.__sgLog.download() etc.
if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__sgLog = logger;
}
