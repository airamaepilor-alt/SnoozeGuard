// Injects presenter notes into each notesSlide XML file of the extracted pptx
// Run: node FINAL_THESIS/inject_notes.js

const fs = require("fs");
const path = require("path");

const notesDir = "c:/Thesis/SnoozeGuard/FINAL_THESIS/tmp_pptx/ppt/notesSlides/";

// Notes for each slide. Each entry is an array of paragraphs (strings).
const notes = {
  1: [
    "Start by greeting the panel and audience.",
    "Say: 'Good morning/afternoon. We are Cart Jeuiel Agno, Aira Mae Pilor, and Christian Eduard Ylagan, from BS Computer Engineering. Our study is called SnoozeGuard — a system that uses a smartphone camera to detect if a driver is getting sleepy, and alerts them before anything bad happens.'",
    "Keep your tone calm and confident. You may briefly mention your adviser, Engr. Jezer Ilao.",
    "Wait for the audience to settle before moving to the next slide.",
  ],
  2: [
    "This is your road map. Briefly tell the panel what you will cover.",
    "Say: 'We will start with the background and the problem we are solving, then walk through how the system works, explain our methodology, and end with the results and our conclusions.'",
    "You do not need to explain each item in detail here — just give them an idea of where the talk is going.",
    "This slide should take about 30 seconds.",
  ],
  3: [
    "This slide explains why the study is important. Start with the global problem, then bring it closer to home.",
    "Say: 'Drowsy driving is a serious problem. Studies show it causes about 20% of all highway accidents. The World Health Organization even lists road injuries as the 8th leading cause of death worldwide.'",
    "Then say: 'Here in the Philippines, the LTO has reported that driver inattention and fatigue are among the top causes of road accidents.'",
    "Point to the last bullet: 'The big gap is this — no affordable system combines real-time detection, a physical alert device, and emergency contact notification all in one. That is the gap SnoozeGuard fills.'",
    "Speak slowly and clearly on this slide. This is where you hook the audience.",
  ],
  4: [
    "These are the five specific questions the study answered. Read each one clearly.",
    "Question 1 is about detection — can a phone camera detect drowsiness accurately?",
    "Question 2 is about the scoring model — how do we measure HOW drowsy the driver is on a scale?",
    "Question 3 is about the IoT device — can a small physical device give extra alerts?",
    "Question 4 is about the emergency system — can the system still notify someone even without internet?",
    "Question 5 is about quality — does the system meet international software quality standards?",
    "You can say: 'These five questions guided everything we built.'",
  ],
  5: [
    "The general objective is at the top — develop and evaluate SnoozeGuard as a working prototype.",
    "For the specific objectives, you do not need to read them word for word. Instead, summarize them in plain language.",
    "Say: 'We had six specific goals. First, detect drowsiness from yawning, head nodding, tilting, and sudden braking. Second, build a 10-level scoring system for how sleepy the driver is. Third, create a physical IoT device that gives audio, vibration, and light alerts. Fourth, build an emergency notification system using push notifications and SMS. Fifth, make the app work even without internet. And sixth, test the whole system using the ISO standard for software quality.'",
  ],
  6: [
    "This is the big picture of how everything connects.",
    "Point to each part as you explain: 'The driver uses either the mobile app on Android or the web dashboard on a browser. The mobile app is the main one.'",
    "'The app sends commands to the IoT alert device — a small ESP32 gadget — through WiFi using a protocol called MQTT, or through Bluetooth if WiFi is not available.'",
    "'Everything is backed up to the cloud using Supabase, which stores the session data, handles logins, and sends real-time updates.'",
    "'SMS alerts go through PhilSMS, which is a Philippine SMS gateway — so emergency messages are delivered through local carriers.'",
    "Keep this explanation simple. The panel may ask about specific parts — be ready.",
  ],
  7: [
    "This slide explains how the phone detects drowsiness. Keep your explanation simple.",
    "Say: 'We use Google's MediaPipe, which is an AI model that reads 478 points on the face from the camera, 60 times per second on mobile.'",
    "For yawn detection: 'When the jawOpen value goes above 0.70, that means the mouth is wide open — a yawn. Once it closes again, we count it as one yawn event.'",
    "For head nodding: 'The model also tracks where the head is pointing. If the head drops forward or tilts sideways past a certain angle, that is counted as a head movement event.'",
    "For sustained tilt: 'If the driver tilts their head for more than 10 seconds continuously, the system automatically fires a level 8 alert — that is a serious sign of drowsiness.'",
    "For braking: 'The phone's accelerometer detects sudden braking — a sign of near-miss or panic stop, which is related to fatigue.'",
    "All four signals are combined to compute the drowsiness level from 0 to 10.",
  ],
  8: [
    "This slide shows how the alerts get stronger as the driver gets more drowsy.",
    "Say: 'Think of it like a warning scale. At levels 1 and 2, the app just says a voice reminder. At levels 3 to 5, it adds vibration and an alarm sound. At levels 6 to 8, the IoT device lights up, vibrates, and plays an audio track. At levels 9 and 10, the system also starts a 120-second countdown to notify the emergency contact.'",
    "Point out the dismiss guard at the bottom: 'Once the driver dismisses an alert at a certain level, the same level will not fire again in that session — it only escalates if the drowsiness gets worse.'",
    "This graduated approach means the driver is not suddenly hit with a loud alarm — it builds up, giving them a chance to respond early.",
  ],
  9: [
    "This is the physical IoT device we built. Describe it as a small gadget the driver can place on the dashboard.",
    "Say: 'The device is built around an ESP32 microcontroller — a small, affordable chip with built-in WiFi and Bluetooth. It costs roughly $5 to $10.'",
    "'Inside the device, there is a DFPlayer Mini module that plays MP3 audio files from a memory card. There is also a buzzer, two LED lights, and a physical dismiss button.'",
    "Walk through the table: 'At level 6, it plays a short audio and pulses the LED three times. As the level goes up, the pulses get longer and more intense. At levels 9 and 10, everything runs continuously until the driver presses the dismiss button.'",
    "Point to the dismiss button logic: 'When the driver presses the button on the device, it sends a signal through WiFi to the cloud, and the mobile app receives it instantly and stops the alert.'",
  ],
  10: [
    "This slide explains how the IoT device talks to the cloud and the phone.",
    "Say: 'The main connection is WiFi. The device subscribes to a topic on our MQTT broker — HiveMQ Cloud — and listens for commands. When the app sends an alert, the cloud pushes it to the device immediately.'",
    "'If WiFi is not available, the device switches to Bluetooth. The phone can send commands directly to the device via Bluetooth Low Energy, so alerts still work even without internet.'",
    "Point to the heartbeat: 'Every 5 seconds, the device sends a small ping to the server. This is how we know if the device is online or offline in real time.'",
    "Keep this simple — just say the device works through WiFi primarily, and Bluetooth as a backup.",
  ],
  11: [
    "This slide shows what happens when the driver reaches a critical drowsiness level and does not dismiss the alert.",
    "Walk through each step clearly:",
    "Step 1: Driver reaches level 9 or 10 — the alert modal opens on screen.",
    "Step 2: A 120-second countdown starts. On the web version, it is 30 seconds.",
    "Step 3: If the driver does not tap dismiss before the timer runs out, the emergency pipeline fires.",
    "Step 4: The app captures the driver's GPS location.",
    "Step 5: A push notification is sent to the emergency contact's phone.",
    "Step 6: If SMS is enabled in the admin settings, an SMS is also sent through PhilSMS.",
    "Step 7: The guardian can open the app, see the driver's location on a map, and respond.",
    "Say: 'This is the closed-loop feature that makes SnoozeGuard different from other apps — it does not just alert the driver, it also alerts someone who can help.'",
  ],
  12: [
    "This slide explains how the app keeps working even without internet — which is important in the Philippines where signal is not always reliable.",
    "Say: 'All session data is saved directly to the phone's local storage first — we call this SQLite. This happens instantly, no internet needed.'",
    "'When the phone gets internet back, the app automatically syncs everything to the cloud in the background. The user does not have to do anything.'",
    "Point to the auth fallback: 'Even login works offline. If the app cannot reach the server, it reads the saved login from local storage — so the driver can still start a session.'",
    "This is important for the panel — it shows the system was designed for real-world conditions, not just ideal internet environments.",
  ],
  13: [
    "This slide explains how the system was built and how it was evaluated.",
    "Say: 'We used an Iterative SDLC approach — which means we built the system step by step, testing each part before moving to the next. We had 8 phases from January to April 2025.'",
    "Walk through the phases briefly: 'Phase 1 was planning, Phase 2 and 3 were building the mobile app, Phase 4 was the web dashboard, Phase 5 was the IoT firmware, Phase 6 was integration testing, Phase 7 was the survey with respondents, and Phase 8 was documentation.'",
    "For the evaluation: 'We used ISO/IEC 25010 — an international standard for measuring software quality. It has 8 categories. We gave a 66-item questionnaire to 29 respondents.'",
    "Say: 'Respondents were active drivers who evaluated the system using our physical driving simulator.'",
  ],
  14: [
    "This slide shows the driving simulator the team built.",
    "Say: 'Because we could not use a real road for testing, we built our own driving simulator. It uses a real car seat, a Logitech steering wheel with force feedback, actual pedals, and a phone mount in front of the driver's face.'",
    "'Every respondent sat in this simulator, used the system, and then answered the questionnaire. This made sure their ratings were based on real experience, not just guessing.'",
    "You can mention: 'The phone mount is positioned 60 to 80 centimeters from the driver's face — the same distance as in a real car. This made sure MediaPipe could detect the face properly.'",
    "If the panel asks why you built this instead of testing in a real car, say: 'Safety and control — we needed a consistent, controlled environment for all 29 respondents.'",
  ],
  15: [
    "This is the main results table. Walk through it clearly.",
    "Say: 'We evaluated SnoozeGuard across all 8 quality characteristics of ISO/IEC 25010. All 8 got a Very Satisfactory rating.'",
    "Highlight the top scores: 'The highest score was Performance Efficiency at 4.11 — meaning the system responds quickly and smoothly. Portability also scored well at 4.07, meaning it works across different Android phones and browsers.'",
    "For the lower scores: 'Usability scored 3.90 and Reliability 3.91 — still Very Satisfactory, but these are areas we can improve. Some respondents found the drowsiness level display a bit hard to read at a glance, and face detection can be affected by lighting conditions.'",
    "End with: 'The Grand Mean is 4.01 — Very Satisfactory. This means the system met the quality standards expected of a working prototype.'",
  ],
  16: [
    "These are your six main conclusions. Speak confidently — these are the answers to your five research questions.",
    "Conclusion 1 answers question 1: Yes, a smartphone camera can reliably detect drowsiness using multiple signals.",
    "Conclusion 2 answers question 2: The 10-level model gives proportional alerts that avoid over-alarming the driver.",
    "Conclusion 3 answers question 3: The ESP32 IoT device works — it extends alerts beyond the phone screen using both WiFi and Bluetooth.",
    "Conclusion 4 answers question 4: The emergency pipeline works — push notification and SMS reach the guardian when the driver is unresponsive.",
    "Conclusion 5 is about offline mode — SQLite ensures the app works even in areas with no signal.",
    "Conclusion 6 answers question 5: Grand Mean 4.01, Very Satisfactory — the system meets software quality requirements.",
    "Speak slowly and clearly here. The panel will be listening carefully to your conclusions.",
  ],
  17: [
    "These are suggestions for future researchers or for the next version of SnoozeGuard.",
    "You do not need to go into deep detail here. Briefly mention each one:",
    "Field Validation — test the system in real driving conditions, not just the simulator.",
    "Eye Closure — add PERCLOS eye tracking as an extra signal for better accuracy.",
    "OBD-II — connect to the car's computer for speed and lane data.",
    "Certification — get the system certified as a proper safety tool.",
    "Multi-Language — add Filipino language alerts and interface.",
    "Fleet Dashboard — let companies monitor multiple drivers at once.",
    "Battery Optimization — reduce phone battery drain during long sessions.",
    "Say: 'These are areas we would like to see improved in future work.'",
  ],
  18: [
    "Thank the panel and audience for their time.",
    "Say: 'Thank you for listening. We are now open for any questions or clarifications.'",
    "Remind your teammates to be ready for their parts of the Q&A:",
    "- Agno: Ready to answer questions about the detection algorithm and IoT firmware.",
    "- Pilor: Ready to answer questions about the mobile app, emergency system, and evaluation results.",
    "- Ylagan: Ready to answer questions about the system architecture, web dashboard, and cloud backend.",
    "Stay calm during Q&A. If you are not sure about an answer, it is okay to say 'We will look into that further' or ask your teammates.",
    "If the panel asks about a specific slide, go back to it — do not try to answer everything from memory.",
  ],
};

// Build XML for multiple paragraphs of notes
function buildNotesXML(paragraphs) {
  const paras = paragraphs.map(p => {
    const escaped = p
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
    return `<a:p><a:r><a:rPr lang="en-US" dirty="0" sz="1200"/><a:t>${escaped}</a:t></a:r></a:p>`;
  }).join("");
  return paras;
}

// The notes body placeholder regex — replace its txBody content
const TXBODY_RE = /(<p:sp>[\s\S]*?<p:ph type="body" idx="1"[\s\S]*?<\/p:nvSpPr>[\s\S]*?<p:spPr\/>[\s\S]*?<p:txBody>)<a:bodyPr\/>(<a:lstStyle\/>)([\s\S]*?)(<\/p:txBody>)/;

let updated = 0;
for (const [slideNum, paragraphs] of Object.entries(notes)) {
  const notesFile = path.join(notesDir, `notesSlide${slideNum}.xml`);
  if (!fs.existsSync(notesFile)) {
    console.warn(`notesSlide${slideNum}.xml not found, skipping.`);
    continue;
  }

  let xml = fs.readFileSync(notesFile, "utf8");
  const notesXML = buildNotesXML(paragraphs);

  // Replace the txBody content of the body placeholder
  const newXml = xml.replace(TXBODY_RE, (match, p1, p2, p3, p4) => {
    return `${p1}<a:bodyPr/>${p2}${notesXML}${p4}`;
  });

  if (newXml === xml) {
    // Fallback: simpler replacement of empty <a:p> block
    const fallback = xml.replace(
      /<a:p><a:r><a:rPr lang="en-US" dirty="0"\/><a:t><\/a:t><\/a:r><a:endParaRPr lang="en-US" dirty="0"\/><\/a:p>/,
      buildNotesXML(paragraphs)
    );
    fs.writeFileSync(notesFile, fallback, "utf8");
    console.log(`Slide ${slideNum}: updated (fallback)`);
  } else {
    fs.writeFileSync(notesFile, newXml, "utf8");
    console.log(`Slide ${slideNum}: updated`);
  }
  updated++;
}

console.log(`\nDone. ${updated} slides updated.`);
