

const EFFECTIVE_DATE = "April 18, 2026";

const LEGAL_SECTIONS = [
  {
    num: "1",
    title: "Acceptance of Terms",
    content: [
      'By using SnoozeGuard ("the App"), you agree to these Terms of Service and Privacy Policy. If you do not agree, do not use the App. These terms apply to all users of the App.',
    ],
  },
  {
    num: "2",
    title: "Purpose of the App",
    content: [
      "SnoozeGuard is a research and thesis project designed to detect driver drowsiness in real time using your phone's front camera and motion sensors. The App is intended to assist — not replace — safe driving practices. It does not guarantee prevention of accidents.",
    ],
  },
  {
    num: "3",
    title: "Camera and Sensor Use",
    content: [
      "The App uses your front-facing camera during active driving sessions to monitor facial landmarks (eye openness, yawning, head position). Camera frames are processed locally on your device using Face Geometry Machine Learning; no video or images are transmitted to any server.",
      "Motion sensor data (accelerometer) is used to detect sudden braking events. This data is also processed locally and only aggregated statistics are stored.",
    ],
  },
  {
    num: "4",
    title: "Location Data",
    content: [
      "Location access is requested only when a critical drowsiness alert is triggered and goes unacknowledged for 2 minutes. At that point, your current GPS coordinates are sent to your designated emergency contact via the cloud database backend. Location is not continuously tracked or stored.",
    ],
  },
  {
    num: "5",
    title: "Data We Collect and Store",
    content: [
      "The following data is collected and stored:",
    ],
    bullets: [
      "Account information (email, display name) via cloud database authentication",
      "Driving session metadata (timestamps, device type)",
      "Drowsiness telemetry (aggregated event counts and levels per session)",
      "Emergency contact details (name, phone, email) you voluntarily provide",
      "Your mobile phone number (optional, used for emergency alerts)",
      "Push notification token (for in-app emergency alerts)",
    ],
    after: "No raw video, audio, or continuous GPS data is stored. All telemetry is tied to your account ID.",
  },
  {
    num: "6",
    title: "Emergency Contact Notifications",
    content: [
      "By setting an emergency contact, you authorize the App to automatically send your name, phone number, and current GPS location to that contact if a Level 9–10 drowsiness alert goes unacknowledged for 2 minutes. Your emergency contact will receive an SMS and/or in-app notification.",
      "You are responsible for informing your emergency contact that they may receive such alerts.",
    ],
  },
  {
    num: "7",
    title: "Data Storage and Security",
    content: [
      "Your data is stored on a cloud database and locally on your device via SQLite. Local data enables offline access to your history and emergency contact information. The cloud database applies industry-standard encryption in transit (TLS) and at rest.",
      "We do not sell, rent, or share your personal data with third parties, except as required for the emergency notification feature or by law.",
    ],
  },
  {
    num: "8",
    title: "Your Rights",
    content: ["You have the right to:"],
    bullets: [
      "Access and update your profile information via the Account screen",
      "Delete your account and associated data via the Account screen",
      "Update or remove your emergency contact at any time",
      "Revoke camera or location permissions via your device settings",
    ],
  },
  {
    num: "9",
    title: "Limitations of Liability",
    content: [
      "SnoozeGuard is a research prototype. It is provided \"as is\" without warranty of any kind. The developers are not liable for any accidents, injuries, or damages arising from reliance on the App's alerts or failure to detect drowsiness.",
      "Always prioritize safe driving. If you feel drowsy, pull over safely regardless of the App's alert level.",
    ],
    isQuote: true,
  },
  {
    num: "10",
    title: "Changes to These Terms",
    content: [
      "These terms may be updated as the project evolves. Continued use of the App after changes are posted constitutes your acceptance of the revised terms.",
    ],
  },
  {
    num: "11",
    title: "Contact",
    content: [
      "This App is a thesis project. For questions or data requests, contact the development team through your institution's research office.",
    ],
  },
];

export function TermsPage() {

  return (
    <div className="max-w-5xl mx-auto font-body text-on-surface space-y-12 pb-16">

      {/* ── Hero ── */}
      <section>
        <h1 className="font-headline font-extrabold text-4xl sm:text-5xl text-primary tracking-tight mb-4">
          Legal Framework
        </h1>
        <p className="text-on-surface-variant text-base sm:text-lg max-w-2xl leading-relaxed">
          Your safety is our priority. This document outlines how SnoozeGuard protects your data
          while keeping you alert on the road.{" "}
          <span className="text-on-surface font-medium">Last updated: {EFFECTIVE_DATE}.</span>
        </p>
      </section>

      {/* ── Bento highlight cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Camera & Monitoring — 8/12 */}
        <div className="md:col-span-8 bg-surface-container-low p-7 sm:p-8 rounded-3xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none select-none">
            <span className="material-symbols-outlined text-on-surface" style={{ fontSize: "8rem" }}>
              visibility
            </span>
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-5">
              <span className="material-symbols-outlined text-primary text-2xl">videocam</span>
              <h2 className="font-headline font-bold text-xl sm:text-2xl text-on-surface">
                Camera Usage & Monitoring
              </h2>
            </div>
            <p className="text-on-surface-variant mb-6 leading-relaxed text-sm">
              SnoozeGuard utilizes real-time camera monitoring to detect signs of driver drowsiness.
              By enabling Vigilant Mode, you consent to:
            </p>
            <ul className="space-y-3 text-on-surface text-sm">
              {[
                "Local on-device facial landmark processing (no raw video is uploaded to the cloud).",
                "Pupil dilation, blink frequency, and yawn analysis for micro-sleep prevention.",
                "Automatic termination of sensor streams when the Scanning Active session ends.",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-primary text-sm mt-0.5 shrink-0">
                    check_circle
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Thesis Foundation — 4/12 */}
        <div className="md:col-span-4 bg-surface-container-high p-7 sm:p-8 rounded-3xl flex flex-col justify-between gap-6">
          <div>
            <h3 className="font-headline font-bold text-xl text-secondary mb-3">Thesis Foundation</h3>
            <p className="text-on-surface-variant text-sm">
              Research-driven design with industry-standard ML and privacy-first architecture.
            </p>
          </div>
          <div className="flex flex-col gap-4">
            {[
              { icon: "psychology", label: "MediaPipe Face Landmarker" },
              { icon: "school", label: "Drowsiness Detection Research" },
            ].map((item) => (
              <div
                key={item.label}
                className="flex items-center gap-4 bg-surface-container-low p-4 rounded-2xl"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-primary text-xl">{item.icon}</span>
                </div>
                <span className="text-xs font-label font-semibold text-on-surface">{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Location Tracking — 6/12 */}
        <div className="md:col-span-6 bg-surface-container-low p-7 sm:p-8 rounded-3xl">
          <div className="flex items-center gap-3 mb-5">
            <span className="material-symbols-outlined text-primary text-2xl">location_on</span>
            <h2 className="font-headline font-bold text-xl sm:text-2xl text-on-surface">
              Location Tracking
            </h2>
          </div>
          <p className="text-on-surface-variant mb-6 leading-relaxed text-sm">
            Precise GPS data is required for emergency dispatch accuracy. SnoozeGuard logs location
            coordinates only when a Level 9–10 drowsiness alert is triggered and goes unacknowledged
            for 2 minutes.
          </p>
          <div className="bg-surface-container-highest p-5 rounded-2xl">
            <div className="flex justify-between items-center mb-4">
              <span className="text-[10px] uppercase tracking-widest font-label font-bold text-on-surface-variant">
                Data Usage Pattern
              </span>
              <span className="text-xs text-primary font-semibold">Event-only</span>
            </div>
            <div className="h-14 flex items-end gap-1">
              {[20, 45, 100, 60, 25, 70, 35].map((h, i) => (
                <div
                  key={i}
                  className="flex-1 bg-primary rounded-t-sm transition-all"
                  style={{ height: `${h}%`, opacity: 0.15 + (h / 100) * 0.85 }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Emergency Notification — 6/12 */}
        <div className="md:col-span-6 bg-tertiary-container p-7 sm:p-8 rounded-3xl">
          <div className="flex items-center gap-3 mb-5">
            <span className="material-symbols-outlined text-tertiary text-2xl">emergency</span>
            <h2 className="font-headline font-bold text-xl sm:text-2xl text-tertiary">
              Emergency Notification
            </h2>
          </div>
          <p className="text-on-surface-variant text-sm mb-6 leading-relaxed">
            In the event of a Level 9–10 drowsiness alert that goes unacknowledged for 2 minutes,
            SnoozeGuard will automatically send your name, GPS location, and phone number to your
            designated emergency contact via SMS.
          </p>
          <div className="space-y-0">
            {[
              { label: "Automatic SOS Trigger", status: "MANDATORY", statusColor: "text-tertiary" },
              { label: "Remote Log Access", status: "AUTHORIZED", statusColor: "text-tertiary" },
              { label: "Video Upload", status: "NEVER", statusColor: "text-emerald-500" },
            ].map((row, i, arr) => (
              <div
                key={row.label}
                className={`flex justify-between items-center py-3 ${i < arr.length - 1 ? "border-b border-on-tertiary-container/10" : ""}`}
              >
                <span className="text-sm font-medium text-on-surface">{row.label}</span>
                <span className={`text-xs font-bold ${row.statusColor}`}>{row.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Data Security highlight strip ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { icon: "lock", title: "Local Encryption", body: "All biometric data is processed on-device using MediaPipe. No raw video leaves your hardware." },
          { icon: "cloud_off", title: "Zero Cloud Video", body: "We do not store or transmit raw camera footage. Only aggregated telemetry events are synced." },
        ].map((item) => (
          <div key={item.title} className="bg-surface-container p-5 rounded-2xl flex gap-4 items-start">
            <span className="material-symbols-outlined text-primary text-2xl shrink-0 mt-0.5">{item.icon}</span>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-on-surface mb-1">{item.title}</p>
              <p className="text-xs text-on-surface-variant leading-relaxed">{item.body}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Full legal text ── */}
      <div className="bg-surface-container-low p-7 sm:p-10 rounded-3xl">
        <div className="max-w-3xl mx-auto space-y-10">
          {LEGAL_SECTIONS.map((sec) => (
            <div key={sec.num}>
              <h3 className="font-headline font-bold text-xl text-on-surface mb-4">
                {sec.num}. {sec.title}
              </h3>
              <div className="space-y-3 text-on-surface-variant text-sm leading-relaxed">
                {sec.content.map((para, i) => (
                  <p key={i} className={sec.isQuote && i === 0 ? "italic" : ""}>
                    {para}
                  </p>
                ))}
                {sec.bullets && (
                  <ul className="space-y-2 pl-1 pt-1">
                    {sec.bullets.map((b) => (
                      <li key={b} className="flex items-start gap-2">
                        <span className="material-symbols-outlined text-primary text-sm shrink-0 mt-0.5">
                          arrow_right
                        </span>
                        {b}
                      </li>
                    ))}
                  </ul>
                )}
                {sec.after && <p>{sec.after}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Footer ── */}
      <p className="text-center text-xs text-outline italic pb-2">
        SnoozeGuard · Thesis Build · {EFFECTIVE_DATE}
      </p>
    </div>
  );
}
