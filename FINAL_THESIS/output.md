# SnoozeGuard: Prototype Development of an AI-Driven Real-Time Drowsiness Monitoring System for Road Safety

**Divine Word College of Calapan**
School of Engineering
Bachelor of Science in Computer Engineering

**Authors:**
Cart Jeuiel T. Agno
Aira Mae T. Pilor
Christian Eduard B. Ylagan Jr.

**Research Adviser:**
ENGR. JEZER E. ILAO
Computer Engineering Program

**Date of Submission:** December 3, 2025

---

## Approval Sheet

This undergraduate research entitled **"SnoozeGuard: Prototype Development of an AI-Driven Real-Time Drowsiness Monitoring System for Road Safety"** prepared and submitted by **Cart Jeuiel T. Agno**, **Aira Mae T. Pilor**, and **Christian Eduard B. Ylagan Jr.** in partial fulfillment of the requirements for the degree of Bachelor of Science in Computer Engineering is hereby recommended for oral examination.

**ENGR. JEZER E. ILAO**
Research Adviser

Approved by the Committee on Oral Examination with a grade of ______________ on ______________.

**________________________**
Panel Member

**________________________**
Panel Member

**________________________**
Panel Member

Accepted and approved in partial fulfillment of the requirements for the degree of Bachelor of Science in Computer Engineering.

**________________________**
Dean, School of Engineering
Date: ______________

---

## Acknowledgements

The researchers would like to express their heartfelt gratitude to the individuals and institutions whose support made the completion of this research possible.

First and foremost, they offer praise and thanksgiving to the **Almighty God** for the wisdom, strength, and perseverance He granted throughout the course of this study.

The researchers extend their sincerest appreciation to their research adviser, **Engr. Jezer E. Ilao**, for his unwavering guidance, invaluable technical insights, and patience in mentoring the team from the initial concept to the final output. His expertise and encouragement were instrumental in shaping this research into its present form.

Gratitude is likewise expressed to the **panel members** for their constructive feedback, critical evaluations, and recommendations that significantly improved the quality and depth of this study.

To the **School of Engineering of Divine Word College of Calapan** and its faculty, the researchers are grateful for the academic foundation and resources provided throughout the program that equipped them with the competencies necessary to undertake this research.

The researchers also thank the **respondents** who generously gave their time to participate in the system evaluation, whose honest feedback contributed directly to the validity and completeness of this study.

Lastly, and most profoundly, the researchers are deeply grateful to their **families** for their unconditional love, endless encouragement, and steadfast support. Their sacrifices and belief in the researchers' capabilities served as the greatest motivation to persevere and see this work to its completion.

To everyone who, in one way or another, contributed to the realization of this research — thank you.

*The Researchers*

---

## Abstract

Driver drowsiness remains one of the leading contributors to road traffic fatalities worldwide. This paper presents SnoozeGuard, a multi-platform, AI-driven real-time drowsiness monitoring and alert system designed to detect early signs of fatigue and deliver escalating alerts before a critical event occurs. The system employs Google's MediaPipe Face Landmarker model—processing 478 facial landmarks and 52 blend shape coefficients—to detect yawning (jawOpen blend shape), head nodding (pitch and roll deviation), and sustained head tilt through a smartphone camera, without requiring dedicated hardware at the vehicle level. A scored 10-level drowsiness model aggregates these signals using a configurable administrator-controlled alert map, enabling precise threshold tuning for operational contexts. Alert escalation triggers multi-modal responses: text-to-speech voice warnings, device vibration, audio alarm, and—at levels 6 through 10—commands to a paired ESP32-based IoT alert device that plays distinct MP3 tracks with vibration and LED patterns calibrated to drowsiness severity. At levels 9 and 10, the system triggers an emergency notification pipeline that sends push notifications and SMS alerts to the driver's designated emergency contact after a 120-second countdown (30 seconds on the web platform). The system is built as a cross-platform solution comprising a React Native mobile application (Expo SDK 54) deployed via Expo EAS, a React/Vite web dashboard deployed on Firebase Hosting, a Node.js/Hono IoT ingest and MQTT bridge API deployed on Railway, and a Supabase cloud backend (PostgreSQL, Authentication, Realtime). SMS alerts are delivered through PhilSMS, a Philippine SMS gateway, enabling reliable local carrier delivery. An offline-first architecture using local SQLite storage with background Supabase synchronization ensures continuous session recording even without network connectivity. To simulate a realistic driving environment for testing and evaluation, the research team constructed a physical driving simulator prototype comprising a genuine automobile seat mounted on a wooden frame, a gaming steering wheel, brake and accelerator pedals, and a front-facing smartphone mount—providing an ergonomically accurate evaluation platform without requiring a live road vehicle. Evaluated against the ISO/IEC 25010 software quality model, SnoozeGuard demonstrates [USER: insert summary evaluation result] across all eight quality characteristics. The system provides a practical, low-cost, and deployable solution to reduce drowsy driving incidents through continuous monitoring, intelligent escalation, and guardian-linked emergency response.

**Keywords:** driver drowsiness detection, MediaPipe, face landmark analysis, yawn detection, head pose estimation, React Native, ESP32, IoT alert system, MQTT, emergency notification, real-time monitoring, road safety

---

## Table of Contents

- Approval Sheet
- Acknowledgements
- Abstract
- Table of Contents
- List of Figures
- List of Tables
- List of Appendices

**Chapter I: The Problem and Its Background**
- Introduction
- Statement of the Problem
- Objectives of the Study
- Significance of the Study
- Scope and Delimitations
- Definition of Terms

**Chapter II: Review of Related Literature**
- Related Literature
- Related Studies
- Synthesis

**Chapter III: Research Methodology**
- Research Design
- System Architecture Overview
- Hardware Components
- Software Stack
- Drowsiness Detection Algorithm
- Alert Escalation System
- IoT Alert Device Design
- Emergency Notification System
- Development Methodology
- Evaluation Framework

**Chapter IV: Results and Discussion**
- System Implementation
- ISO/IEC 25010 Evaluation Results
- Discussion

**Chapter V: Summary, Conclusions, and Recommendations**
- Summary
- Conclusions
- Recommendations

**Bibliography**
**Appendices**

---

## List of Figures

- Figure 1: SnoozeGuard System Architecture Overview
- Figure 2: MediaPipe Face Landmarker — Key Landmarks Used for Detection
- Figure 3: Drowsiness Level Scoring Model (Levels 0–10)
- Figure 4: Alert Escalation Flow Diagram
- Figure 5: ESP32 IoT Alert Device Hardware Schematic
- Figure 6: MQTT Communication Topology
- Figure 7: Multi-Contact Emergency Contact Model
- Figure 8: Mobile Application — Drive Screen (Active Session)
- Figure 9: Mobile Application — Home Dashboard with Filter Pills
- Figure 10: Analytics Screen — Stability Badge and Circadian Block Chart
- Figure 11: Web Dashboard — Drowsiness Alert Overlay
- Figure 12: IoT Alert Device — Physical Prototype
- Figures 13–19: [USER: Add remaining screenshots from evaluation/demo]

---

## List of Tables

- Table 1: Project Gantt Chart [USER: Provide dates]
- Table 2: Alert Level Definitions and Thresholds
- Table 3: IoT Device Alert Behavior by Drowsiness Level
- Table 4: API Endpoint Summary
- Table 5: Hardware Bill of Materials
- Table 6: Respondents of the Study [USER: Provide count and profile]
- Table 7: Implementation Activities [USER: Provide dates]
- Table 8: ISO/IEC 25010 — Functional Suitability Results [USER: Provide scores]
- Table 9: ISO/IEC 25010 — Performance Efficiency Results [USER: Provide scores]
- Table 10: ISO/IEC 25010 — Compatibility Results [USER: Provide scores]
- Table 11: ISO/IEC 25010 — Usability Results [USER: Provide scores]
- Table 12: ISO/IEC 25010 — Reliability Results [USER: Provide scores]
- Table 13: ISO/IEC 25010 — Security Results [USER: Provide scores]
- Table 14: ISO/IEC 25010 — Maintainability Results [USER: Provide scores]
- Table 15: ISO/IEC 25010 — Portability Results [USER: Provide scores]
- Table 16: ISO/IEC 25010 — Overall Software Quality Summary [USER: Provide scores]
- Table 17: System Performance Metrics [USER: Provide metrics]

---

## List of Appendices

- Appendix A: Survey Instrument (ISO/IEC 25010 Evaluation Questionnaire)
- Appendix B: ESP32 Firmware Source Code
- Appendix C: Alert Map Configuration Schema
- Appendix D: Curriculum Vitae of Researchers [USER: Provide]

---

# CHAPTER I: The Problem and Its Background

## Introduction

Drowsy driving is a pervasive and underreported cause of road traffic collisions globally. The World Health Organization (2023) estimates that road traffic injuries are the eighth leading cause of death worldwide, with fatigue-impaired driving contributing to an estimated 20% of all road fatalities on high-speed roads in high-income countries (Horne & Reyner, 1995). In the Philippines, the Land Transportation Office reported rising road incident rates in 2022–2023, with driver inattention and fatigue cited among the primary causal factors. Unlike alcohol impairment, drowsiness does not manifest with clear outward indicators visible to law enforcement, and drivers themselves frequently misjudge their own level of fatigue—a phenomenon documented in laboratory studies as "sleepiness misperception" (Philip et al., 2005).

The physiological signs of drowsiness are, however, objectively measurable through facial and behavioral cues. Yawning—characterized by the wide involuntary opening of the jaw—is one of the most reliable early indicators of central fatigue. Head nodding and uncontrolled postural drift of the head are manifestations of microsleep episodes, the brief but dangerous losses of consciousness lasting 3 to 30 seconds during which a vehicle traveling at highway speed can cover over 100 meters without driver input (Horne & Reyner, 1999). The convergence of these signals over time provides a robust basis for automated fatigue assessment.

Contemporary Driver Monitoring Systems (DMS) embedded in premium vehicles leverage near-infrared cameras and eye-tracking algorithms to detect eye closure (PERCLOS—Percentage of Eye Closure) and gaze deviation. While effective, these systems are prohibitively expensive for mass-market adoption and are absent from the vehicle fleet that constitutes the majority of road transport in developing economies. Smartphone-based approaches, leveraging the high-quality front-facing cameras available on modern mobile devices, offer an accessible and deployable alternative that requires no vehicle modification.

SnoozeGuard is a multi-platform, AI-driven drowsiness monitoring and alert system that transforms a driver's existing smartphone into a continuous fatigue detection station. By integrating Google's MediaPipe Face Landmarker—a state-of-the-art on-device machine learning model processing 478 facial landmarks and 52 blend shape coefficients—with a configurable 10-level drowsiness scoring engine and a multi-modal alert escalation pipeline, SnoozeGuard delivers real-time, actionable drowsiness warnings without requiring any vehicle-level hardware modification. At elevated drowsiness levels, the system optionally communicates with a purpose-built ESP32-based IoT alert device—capable of playing calibrated audio tracks, triggering vibration patterns, and illuminating LED indicators—and automatically notifies a designated emergency contact via push notification and SMS when the driver's state reaches a critical threshold.

## Statement of the Problem

Despite increasing awareness of drowsy driving risks, affordable and deployable real-time monitoring solutions accessible to ordinary vehicle operators in developing economies remain scarce. Commercial DMS solutions are economically prohibitive, vehicle-model-specific, and absent from most vehicles on Philippine roads. Existing smartphone applications for drowsiness detection have generally relied on simplistic thresholds (e.g., eye-closed duration alone) and lack the multi-signal, escalating alert architecture necessary to prompt a driver response before a safety-critical event. Furthermore, no widely accessible system provides a closed-loop emergency response mechanism—linking the driver's real-time drowsiness state to a guardian's mobile device—with offline-first data persistence for use in areas with intermittent connectivity.

This study addresses the following specific problems:

1. How can a smartphone-camera-based system reliably detect driver drowsiness in real time using multiple physiological indicators (yawning, head nodding, sustained head tilt, and sudden braking events)?

2. How can drowsiness severity be quantified into a graduated 10-level model that can drive proportionally escalating alert responses?

3. How can a low-cost IoT peripheral device augment the smartphone alert system to deliver physical alerts (audio, vibration, LED) calibrated to drowsiness level?

4. How can an emergency notification pipeline ensure that a driver's designated contact is reliably informed of critical drowsiness events, even under intermittent network conditions?

5. To what extent does SnoozeGuard meet software quality requirements as defined by the ISO/IEC 25010 standard?

## Objectives of the Study

### General Objective

To design, develop, and evaluate SnoozeGuard—a multi-platform AI-driven real-time drowsiness monitoring system—as a prototype capable of detecting driver fatigue, delivering graduated alert responses, and triggering emergency contact notifications at critical drowsiness levels.

### Specific Objectives

1. To implement a real-time drowsiness detection algorithm using MediaPipe Face Landmarker that fuses yawn detection (jawOpen blend shape), head movement detection (pitch and roll), sustained head tilt detection (accelerometer-assisted), and sudden braking detection (accelerometer delta) into a unified drowsiness signal.

2. To develop a configurable 10-level drowsiness scoring model whose thresholds and associated alert actions are administrator-configurable via a secured admin interface.

3. To design and build an ESP32-based IoT alert peripheral device with MQTT (HiveMQ Cloud TLS) and BLE communication, capable of receiving alert commands and executing level-specific audio (DFPlayer Mini MP3), vibration, and LED response patterns.

4. To implement a multi-modal emergency notification system delivering push notifications (Expo Push) and SMS (Supabase Edge Function) to a designated emergency contact upon sustained level-9 or level-10 drowsiness detection.

5. To implement an offline-first data persistence architecture using local SQLite storage with automatic background synchronization to Supabase cloud storage, ensuring continuous session recording under intermittent network conditions.

6. To evaluate SnoozeGuard against the ISO/IEC 25010 software quality model across eight quality characteristics: functional suitability, performance efficiency, compatibility, usability, reliability, security, maintainability, and portability.

## Significance of the Study

**Drivers:** SnoozeGuard provides real-time fatigue awareness that escalates from gentle reminders to urgent alarms as drowsiness deepens—reducing the risk of microsleep events without requiring any vehicle modification.

**Emergency Contacts and Family Members:** The multi-contact emergency notification pipeline, with real-time presence indicators and SMS delivery, ensures that a designated guardian is immediately informed when a driver reaches a critical fatigue state, enabling timely intervention.

**Road Safety Advocates and Regulators:** SnoozeGuard demonstrates the viability of smartphone-native DMS technology as a cost-effective, scalable alternative to vehicle-integrated systems, offering a path toward widespread drowsy driving prevention in vehicle fleets that cannot be economically retrofitted.

**Computer Engineering Students and Researchers:** The system illustrates the practical integration of on-device machine learning (MediaPipe), cross-platform mobile development (React Native/Expo), real-time cloud backend (Supabase), IoT communication protocols (MQTT, BLE), and offline-first architecture in a single production-quality prototype—serving as a reference implementation for future research.

**The Institution:** This research contributes to the track record of the School of Engineering of Divine Word College of Calapan in applied computer engineering research addressing real-world societal problems.

## Scope and Delimitations

**Scope:**
- The mobile application (React Native/Expo) is the primary deployment target, designed for Android devices running Expo SDK 54/React Native 0.81.5 with a front-facing camera.
- The web dashboard (React/Vite) provides an equivalent drive session interface and administrator tools.
- The ESP32 IoT alert device is a supplementary peripheral; the system functions fully without it.
- Drowsiness detection is performed on the driver-facing smartphone camera; no vehicle integration or OBD-II interface is used.
- The system is evaluated against ISO/IEC 25010 using a structured questionnaire administered to a defined respondent population.

**Delimitations:**
- The system does not detect drowsiness through eye closure (PERCLOS) due to known limitations of PERCLOS-based methods under varying lighting conditions and when drivers wear glasses or sunglasses.
- Real-time GPS tracking of the vehicle route is not implemented; only location at the time of an emergency alert event is captured.
- The IoT device requires a stable WiFi connection for primary MQTT operation; BLE is available as a fallback for alert delivery only (does not replace cloud session logging).
- The system is a prototype; it has not undergone regulatory certification for deployment as a safety-critical automotive system.
- Web push notification delivery depends on browser support and user permission grant.

## Definition of Terms

**Blend Shape:** A numerical coefficient (0.0–1.0) output by MediaPipe Face Landmarker representing the degree of a specific facial expression or movement. SnoozeGuard uses the `jawOpen` blend shape for yawn detection.

**DFPlayer Mini:** A compact serial MP3 audio module used in the ESP32 IoT alert device to play level-specific alert audio tracks stored on a MicroSD card.

**Drowsiness Level:** A score from 0 (no detected fatigue) to 10 (critical fatigue) computed by SnoozeGuard's alert map engine based on accumulated yawn and head movement counts.

**Emergency Contact (EC):** A designated guardian registered in the SnoozeGuard system who receives push notifications and SMS alerts when a driver reaches a critical (level 9–10) drowsiness state.

**ESP32:** An embedded microcontroller module produced by Espressif Systems, used in the SnoozeGuard IoT alert device for WiFi, Bluetooth Low Energy (BLE), and general-purpose GPIO operation.

**Expo:** A framework and platform for building React Native applications, used as the primary mobile development environment for SnoozeGuard.

**Face Landmarker:** Google's MediaPipe solution for detecting 478 facial landmark coordinates and 52 blend shape coefficients from a camera image or video frame.

**HiveMQ Cloud:** A managed MQTT broker service used by SnoozeGuard for cloud-to-IoT command delivery over TLS port 8883.

**ISO/IEC 25010:** An international standard defining a software product quality model comprising eight characteristics: functional suitability, performance efficiency, compatibility, usability, reliability, security, maintainability, and portability.

**MediaPipe:** An open-source, cross-platform machine learning framework developed by Google, providing on-device solutions for vision, audio, and natural language tasks. SnoozeGuard uses the Face Landmarker solution.

**Microsleep:** An involuntary sleep episode lasting 3–30 seconds, during which motor control—including vehicle steering—is relinquished. Microsleeps are a primary mechanism of drowsy driving crashes.

**MQTT (Message Queuing Telemetry Transport):** A lightweight publish-subscribe messaging protocol designed for constrained devices and low-bandwidth networks. SnoozeGuard uses MQTT for IoT alert device command delivery.

**Offline-First:** An architecture pattern in which an application reads and writes to local storage (SQLite) as the primary data source and synchronizes with remote cloud storage in the background when network connectivity is available.

**PERCLOS:** Percentage of Eye Closure—a standardized metric measuring the proportion of time the eyes are more than 80% closed over a defined window, used in eye-tracking-based fatigue detection systems.

**React Native:** An open-source framework for building native mobile applications using JavaScript and React, used for SnoozeGuard's mobile application.

**SQLite:** A lightweight embedded relational database engine used as the local storage ground truth for SnoozeGuard's offline-first data architecture.

**Supabase:** An open-source backend-as-a-service platform providing PostgreSQL database, authentication, real-time subscriptions, edge functions, and storage. Used as SnoozeGuard's cloud backend.

---

# CHAPTER II: Review of Related Literature

## Related Literature

### Driver Drowsiness and Road Safety

Drowsy driving is a significant and underacknowledged contributor to road traffic fatalities. Horne and Reyner (1995) established through naturalistic driving studies that fatigue-related crashes account for approximately 20% of motorway accidents in the United Kingdom, disproportionately affecting long-distance commercial drivers and shift workers. The same researchers demonstrated in laboratory settings that microsleep episodes—characterized by brief, involuntary sleep intrusions lasting 3–30 seconds—are associated with marked steering deviation and are preceded by observable head drooping and eyelid behavior (Horne & Reyner, 1999).

The National Highway Traffic Safety Administration (NHTSA, 2017) estimated that drowsy driving caused 91,000 crashes, 50,000 injuries, and 800 deaths in the United States in 2017 alone, while acknowledging that these figures likely represent a substantial undercount due to reporting challenges. The World Health Organization (2023) identifies road traffic injuries as the eighth leading cause of death globally and highlights driver behavioral factors—including fatigue—as key modifiable risk targets.

### Physiological Indicators of Drowsiness

The scientific literature identifies several reliable physiological indicators of driver drowsiness. Yawning—an involuntary reflex involving wide jaw opening sustained for several seconds—is consistently correlated with sleep deprivation and increasing sleepiness across multiple studies (Guggisberg et al., 2010). While yawning is not exclusively a drowsiness indicator, its frequency increases significantly under sleep-deprived conditions, making it a useful component of a multi-signal drowsiness model.

Head movement patterns offer a complementary signal. As drowsiness increases, drivers exhibit increased head pitch (forward nodding), roll (lateral tilt), and reduced head stabilization—detectable through camera-based pose estimation (Bergasa et al., 2006). Prolonged lateral head tilt (beyond 10 seconds) is associated with loss of postural control preceding microsleep. Sudden deceleration events detectable via accelerometer, while not a direct drowsiness indicator, are correlated with reduced response time and impaired driving performance under fatigue.

Eye closure metrics, particularly PERCLOS (Percentage of Eye Closure), developed by Wierwille et al. (1994), are widely used in laboratory DMS evaluation. However, PERCLOS-based systems face reliability challenges under real-world conditions: ocular obstructions (glasses, sunglasses), variations in ambient illumination, and off-axis gaze impair detection accuracy (Ji et al., 2004). Multi-signal systems that combine non-ocular indicators with facial landmark analysis have demonstrated improved robustness in naturalistic driving conditions.

### Machine Learning Approaches to Facial Analysis

The emergence of deep learning-based facial analysis frameworks has significantly advanced the feasibility of smartphone-native drowsiness detection. Viola and Jones (2001) introduced the first real-time face detection framework using Haar cascades, establishing the viability of camera-based driver monitoring. Subsequent work by Kazemi and Sullivan (2014) demonstrated accurate facial landmark localization using regression tree ensembles, enabling head pose estimation from a single camera.

Google's MediaPipe (Lugaresi et al., 2019) represents the current state of the art in on-device, cross-platform face analysis. The MediaPipe Face Landmarker solution provides 478 three-dimensional facial landmark coordinates and 52 blend shape coefficients—including detailed jaw, cheek, brow, lip, and eye shape parameters—at real-time inference speeds on consumer mobile hardware. Unlike earlier approaches, MediaPipe is designed for production deployment without server dependency, enabling privacy-preserving on-device analysis. Kartynnik et al. (2019) describe the model architecture underlying MediaPipe's face mesh, demonstrating sub-pixel accuracy in landmark localization across diverse face geometries and lighting conditions.

### Driver Monitoring System Architectures

Driver monitoring systems have been implemented across three principal architectural paradigms. Vehicle-integrated systems—such as those deployed by Mercedes-Benz (Attention Assist), Volvo (Driver Alert Control), and Subaru (DriverFocus)—use proprietary near-infrared camera rigs and eye-tracking algorithms embedded in the vehicle instrument cluster. While effective, these systems are model-specific, costly, and unavailable for retrofit.

Aftermarket standalone DMS units represent a cost-reduced alternative, typically mounting a dedicated camera on the dashboard and running embedded vision algorithms on dedicated hardware. Commercial products in this category include the Seeing Machines Guardian and Mobileye Shield+. These systems are more accessible than factory-integrated DMS but still require dedicated hardware purchase and installation.

Smartphone-based DMS approaches leverage the ubiquitous front-facing cameras of modern smartphones to perform drowsiness monitoring without dedicated hardware. Daza et al. (2014) demonstrated real-time drowsiness detection using a smartphone camera with HOG-based facial landmark tracking, achieving satisfactory detection rates in controlled conditions. The smartphone approach offers significant accessibility advantages, particularly in developing economies where vehicle penetration of factory DMS is minimal.

### IoT Integration in Driver Safety Systems

The integration of Internet of Things (IoT) technology into driver safety applications has expanded the alert modality options available to monitoring systems. Espressif's ESP32 microcontroller—a dual-core 240 MHz processor with integrated WiFi and Bluetooth—has emerged as a widely adopted platform for automotive IoT peripheral development due to its low cost (approximately USD 5–10), extensive SDK support, and wireless connectivity (Espressif Systems, 2022). The MQTT protocol (OASIS Standard, 2019), designed for publish-subscribe messaging over constrained networks, has become the de facto standard for IoT command delivery, offering lightweight packet overhead suitable for real-time alert transmission.

BLE (Bluetooth Low Energy) serves as an important fallback communication channel in IoT-augmented driver safety systems. Its short-range, low-power characteristics make it well suited for direct device-to-device communication when network infrastructure is unavailable, complementing MQTT-based cloud command delivery.

### Emergency Notification Systems in Safety Applications

Push notification infrastructure for mobile-connected safety systems has matured significantly with the availability of managed services such as Expo Push Notifications—which abstracts Apple Push Notification Service (APNs) and Firebase Cloud Messaging (FCM) behind a unified API—and SMS delivery APIs. The reliability of push notification delivery in safety-critical contexts depends on device-side notification permission grants and application lifecycle state; SMS delivery via carrier networks provides a complementary channel with higher reliability under push notification grant uncertainty. The combination of push and SMS in emergency alert pipelines has been demonstrated in health monitoring (Kang et al., 2014) and elderly care (Dohr et al., 2010) applications.

---

## Related Studies

### Real-Time Drowsiness Detection Using Computer Vision

Bergasa et al. (2006) developed the PERCLOS-based Real-Time System for Monitoring Driver Vigilance, using a camera mounted on the vehicle dashboard to track eye closure rate, blink frequency, and head nodding. Their system achieved high correlation with electroencephalography (EEG)-measured sleepiness in controlled experiments. However, the system was validated in controlled laboratory tracks rather than real-world driving conditions, and its reliance on eye tracking made it susceptible to occlusion from eyewear.

Weng et al. (2017) proposed a multi-feature drowsiness detection approach combining face detection, eye state classification, and mouth state analysis using Convolutional Neural Networks (CNNs), achieving 94.2% accuracy on their evaluation dataset. The authors noted that real-time inference on mobile hardware remained a challenge with CNN-based approaches due to memory and compute constraints—a limitation that has since been addressed by efficient model architectures such as those underlying MediaPipe.

Dwivedi et al. (2014) evaluated the effectiveness of yawn detection as a standalone drowsiness indicator, finding significant correlation between yawn frequency and subjective sleepiness ratings under sleep-deprivation protocols. Their work supports the inclusion of yawn detection—via the jawOpen blend shape in MediaPipe—as a primary signal in SnoozeGuard's multi-signal model.

### Smartphone-Based Fatigue Monitoring

Daza et al. (2014) implemented a real-time fatigue monitoring system on a smartphone using HOG-based facial point tracking for head pose estimation and eye closure detection. Their system ran at approximately 15 frames per second on a contemporary smartphone, achieving 83% sensitivity in detecting drowsiness events in simulated driving conditions. The authors identified frame rate variability and face detection failures under low lighting as key limitations.

Alioua et al. (2012) investigated driver head pose estimation using a camera-based system as a proxy for attention state, demonstrating that pitch and yaw deviation beyond defined thresholds were reliable predictors of visual distraction and drowsiness. Their threshold-based approach is conceptually aligned with SnoozeGuard's head movement accumulator model.

Ramzan et al. (2019) conducted a systematic review of smartphone-based driver drowsiness detection systems, identifying multi-modal signal fusion (combining camera-based and sensor-based indicators) as the consistently highest-performing approach. The review highlighted that systems relying solely on eye closure underperformed compared to systems incorporating head movement, yawn detection, and physiological signals. SnoozeGuard's design directly addresses this finding by fusing jawOpen blendshape, head pose, sustained tilt, and accelerometer-based sudden braking events.

### IoT-Augmented Vehicle Safety

Sathyanarayana et al. (2012) demonstrated an IoT-augmented driver behavior monitoring system that combined vehicle CAN bus data with driver camera feeds to detect distracted driving events. While their approach required vehicle-level integration, it established the value of multi-modal, cloud-connected driver monitoring for fleet management applications.

Nunes et al. (2019) proposed an IoT-based driver fatigue detection system using physiological sensors (heart rate, skin conductance) and a cloud-connected alert platform. Their system demonstrated feasibility but required body-worn sensors that impose driver acceptance barriers. SnoozeGuard's camera-only detection approach eliminates this barrier.

## Synthesis

The reviewed literature converges on several key design principles that informed SnoozeGuard's development. First, multi-signal fusion—combining yawn frequency, head movement, sustained tilt, and braking events—consistently outperforms single-signal approaches across evaluation studies. Second, on-device machine learning inference (MediaPipe) addresses the frame rate and privacy limitations of cloud-based vision approaches identified in earlier smartphone DMS literature. Third, the non-ocular detection focus—prioritizing yawn and head movement over eye closure—provides robustness against the occlusion and lighting challenges that limit PERCLOS-based systems in real-world conditions. Fourth, IoT-augmented alert delivery through dedicated peripheral hardware extends the system's alert reach beyond the smartphone screen in high-distraction driving environments. Fifth, cloud-connected emergency notification—push plus SMS—provides the closed-loop guardian response capability absent from existing smartphone DMS applications.

SnoozeGuard synthesizes these principles into a unified, deployable prototype that addresses the accessibility gap in driver monitoring technology for developing-economy vehicle fleets.

---

# CHAPTER III: Research Methodology

## Research Design

This study employed a prototyping-based research design aligned with the Iterative Software Development Life Cycle (Iterative SDLC). The iterative approach was selected for its suitability in developing complex, multi-platform software systems where requirements evolve through implementation cycles and early user feedback. Each iteration comprised a planning phase, implementation sprint, internal testing, and retrospective evaluation, with the outputs of each iteration informing the scope and priorities of the next.

Evaluation was conducted through a structured survey instrument based on the ISO/IEC 25010 software product quality model, administered to a defined respondent population composed of active drivers aged 22 to 35 years old who were given the opportunity to interact with the system through the physical driving simulator prototype prior to answering the evaluation instrument. Responses were scored on a five-point Likert scale and analyzed using weighted mean calculations to determine the quality rating for each characteristic.

## System Architecture Overview

SnoozeGuard is structured as a four-tier system:

**Tier 1 — Client Applications:** A React Native mobile application (Expo SDK 54, React Native 0.81.5) for Android, serving as the primary deployment target and ground-truth data source; and a React/Vite web dashboard providing equivalent drive session functionality and administrator configuration tools.

**Tier 2 — IoT Peripheral:** An ESP32-based alert device communicating with the mobile application and cloud backend via MQTT (primary) and BLE (fallback).

**Tier 3 — API Layer:** A Node.js/Hono IoT ingest API handling device authentication, command routing, and session logging for IoT-sourced data.

**Tier 4 — Cloud Backend:** Supabase (PostgreSQL database, Authentication, Realtime subscriptions, Edge Functions, Row Level Security) providing synchronized session storage, multi-user authentication, real-time event streaming, and SMS dispatch through PhilSMS.

Local SQLite (expo-sqlite) serves as the ground-truth storage for the mobile application, with background synchronization to Supabase cloud storage enabling offline-first operation.

### Deployment Infrastructure

**Table: Deployment Services**

| Component | Service | Notes |
|-----------|---------|-------|
| Mobile application | Expo EAS (expo.dev) | OTA updates via preview channel |
| Web dashboard | Firebase Hosting | CDN-served React/Vite SPA |
| IoT API + MQTT bridge | Railway | Node.js/Hono container, auto-deploy from GitHub |
| Cloud database + auth | Supabase | PostgreSQL + Auth + Realtime + Edge Functions |
| MQTT broker | HiveMQ Cloud | TLS port 8883; managed cluster |
| SMS delivery | PhilSMS | Philippine SMS gateway; dispatched via Supabase Edge Function |

## Hardware Components

### Smartphone (Primary Detection Hardware)

The drowsiness detection engine runs on the driver's Android smartphone, mounted in a dash cradle facing the driver. No specific smartphone model is required; any Android device running Android 8.0+ with a front-facing camera is compatible. The smartphone camera captures frames at 600 ms intervals (image mode) for MediaPipe inference; the device accelerometer is sampled at 100 ms intervals for sudden braking detection.

### ESP32 IoT Alert Device

**Table 5: Hardware Bill of Materials**

| Component | Purpose | Notes |
|-----------|---------|-------|
| ESP32 DevKit | Microcontroller — WiFi, BLE, GPIO | Dual-core 240 MHz, 520KB SRAM |
| DFPlayer Mini | MP3 audio playback module | Connected via UART2 (GPIO 16/17) |
| MicroSD Card | MP3 audio track storage | Tracks 0001–0005.mp3 |
| 3W Speaker | Audio output | Connected to DFPlayer Mini |
| Vibration Motor / Buzzer | Tactile/auditory alert | GPIO 26 |
| LED (Primary Alert) | Visual alert indicator | GPIO 27 |
| LED (Secondary) | Secondary visual indicator | GPIO 32 |
| LED (BLE Status) | BLE connection indicator | GPIO 33 |
| Push Button | Physical dismiss button | GPIO 25, INPUT_PULLUP, 200ms debounce |
| 5V Power Supply | Device power | USB or 12V automotive adapter with regulator |

The device is housed in a compact enclosure suitable for dashboard placement or vehicle visor mounting.

### Driving Simulator Prototype

To provide a realistic, controlled evaluation environment, the research team constructed a physical driving simulator prototype (see Figure 12). The simulator consists of:

- **Seat:** A genuine automobile bucket seat (leather upholstery) mounted on a rigid wooden frame, providing authentic seating posture and head-to-camera distance representative of real driving conditions.
- **Steering Wheel and Column:** A Logitech-series gaming steering wheel with force feedback, mounted at the correct ergonomic height relative to the seat.
- **Pedal Assembly:** Brake and accelerator pedals positioned at floor level on the wooden base, enabling natural foot position for test participants.
- **Smartphone Mount:** A front-facing dashboard cradle at windshield-equivalent distance (~60–80 cm from the driver's face), angling the camera to capture the driver's full face within MediaPipe detection range.
- **Frame:** Constructed from dimensional lumber (2×4 and 2×6 sections), providing structural rigidity and adjustability.

The simulator was used for all functional testing and evaluation survey demonstrations, allowing respondents to experience the system in a physically authentic driving posture without requiring road access.

## Software Stack

**Table: Software Stack Summary**

| Layer | Technology | Version |
|-------|-----------|---------|
| Mobile framework | Expo / React Native | SDK 54 / RN 0.81.5 |
| Web framework | React + Vite | — |
| Mobile ML | react-native-mediapipe (native Android) | ^0.6.0 |
| Web ML | @mediapipe/tasks-vision (WASM) | 0.10.17 |
| Local database | expo-sqlite | ~16.0.10 |
| Cloud backend | Supabase | — |
| IoT API | Node.js + Hono | — |
| MQTT broker | HiveMQ Cloud | TLS port 8883 |
| IoT firmware | Arduino/ESP-IDF (ESP32) | — |
| Push notifications | Expo Push Notifications | — |
| SMS gateway | PhilSMS (via Supabase Edge Function) | Philippine SMS carrier delivery |
| Web hosting | Firebase Hosting | Google CDN |
| API hosting | Railway | Container deployment |

## Drowsiness Detection Algorithm

### Face Landmark Acquisition

The MediaPipe Face Landmarker model processes 478 three-dimensional facial landmarks and outputs 52 blend shape coefficients from each camera frame. On mobile, the model runs in IMAGE mode with a 600 ms sampling interval to balance detection responsiveness with device thermal stability. The model file (~5 MB, `face_landmarker.task`) is downloaded from Google's CDN on first launch and cached to the device's document directory.

On the web platform, the model runs in VIDEO mode at ~130 ms intervals, leveraging WebAssembly (WASM) execution.

### Yawn Detection

Yawn detection uses the `jawOpen` blend shape coefficient. The detection logic operates as follows:
- **Open threshold:** jawOpen ≥ 0.7 — triggers yawn open state
- **Close threshold:** jawOpen ≤ 0.4 — confirms yawn completion
- **Cooldown:** 2,000 ms between yawn events
- **Suppression:** head movement and tilt detection are suspended when jawOpen ≥ 0.6 to prevent cross-signal noise
- Each confirmed yawn increments the `yawnAcc` (yawn accumulator), which is an input to the drowsiness scoring function.

### Head Movement Detection

Head pose is estimated from four key facial landmarks: forehead (landmark 10), chin (landmark 152), nose bridge (landmark 168), and nose tip (landmark 1). Pitch (forward nodding) and roll (lateral tilt) are derived from landmark relative positions.

- **Pitch threshold:** ≥ 0.35 (normalized units)
- **Roll threshold:** ≥ 0.25 radians
- Events fire only on the centered→offCenter transition to prevent continuous accumulation from sustained off-center pose
- **Cooldown:** 500 ms between head events
- Each confirmed head event increments the `headAcc` (head movement accumulator)

### Sustained Head Tilt Detection

A sustained lateral head tilt beyond 10 continuous seconds—with a grace window of 4 frames to accommodate brief corrections—triggers an independent `specialAlertOpen` state at alert level 8. This alert is presented through a dedicated modal independent of the main drowsiness scoring pipeline and does not modify the yawnAcc or headAcc accumulators.

### Sudden Brake Detection

The device accelerometer is sampled at 100 ms intervals. When the magnitude of the accelerometer delta vector exceeds 0.45 g across 2 qualifying samples within a 3,000 ms cooldown window, a sudden braking event is recorded. Brake events fire a separate `specialAlertOpen` modal and suppress the main drowsiness alert popup for 10 seconds (`brakeAlertedAtRef`) to prevent alert fatigue from simultaneous triggering.

### Drowsiness Level Computation

The unified drowsiness score is computed by the `computeLevelFromAlertMap()` function in the shared `packages/shared/src/alertMap.ts` module:

```
level = computeLevelFromAlertMap(yawnAcc, headAcc, brake=false, alertMap)
```

The `alertMap` is loaded from the `admin_config` Supabase table and specifies, for each level 1–10:
- `yawn_count`: minimum yawnAcc to reach this level
- `head_count`: minimum headAcc to reach this level
- `label`: display label for the alert
- `actions[]`: actions to trigger (voice, vibration, alarm, iot_led, iot_buzzer)

The function returns the highest level for which both yawn_count and head_count thresholds are met. This design enables administrators to tune sensitivity to operational requirements via the Admin Config screen.

**Table 2: Alert Level Definitions and Thresholds (Default Configuration)**

| Level | Label | Yawn Threshold | Head Movement Threshold | Actions |
|-------|-------|---------------|------------------------|---------|
| 1 | Very Low | 1 | 2 | voice |
| 2 | Low | 2 | 4 | voice, vibration |
| 3 | Mild | 3 | 6 | voice, vibration |
| 4 | Moderate | 4 | 8 | voice, vibration, alarm |
| 5 | Moderate-High | 5 | 10 | voice, vibration, alarm |
| 6 | High | 6 | 12 | voice, vibration, alarm, iot_led, iot_buzzer |
| 7 | Very High | 7 | 14 | voice, vibration, alarm, iot_led, iot_buzzer |
| 8 | Severe | 8 | 16 | voice, vibration, alarm, iot_led, iot_buzzer |
| 9 | Critical | 9 | 18 | voice, vibration, alarm, iot_led, iot_buzzer, emergency |
| 10 | Extreme | 10 | 20 | voice, vibration, alarm, iot_led, iot_buzzer, emergency |

*Note: Actual deployed thresholds are configurable by super_admin. Values above represent defaults.*

## Alert Escalation System

### Alert Trigger Logic

An alert fires when:
1. The computed level ≥ admin_config.trigger_level, AND
2. The alert modal is not currently open, AND
3. The current level has not already been dismissed in this session (tracked by `dismissedLevelsRef`, a per-session Set), OR
4. The level has escalated beyond the previously dismissed level, OR
5. Level 10 has re-triggered (after 3 additional yawns or 10 additional head events above the reset baseline)

A 35-second inter-alert cooldown prevents repeated firing at the same level, bypassed for level escalation and level-10 re-trigger events.

### Alert Actions

When an alert fires, the system executes the configured `actions[]` in parallel:
- **voice:** Expo Speech TTS announces a level-specific warning message (1–4 repetitions, increasing by level)
- **vibration:** `Vibration.vibrate([0,500,300,...])` — a 5-pulse pattern
- **alarm:** expo-av plays a system ringtone URI for 8 seconds; playback handle tracked in `currentSoundRef` for dismiss cancellation
- **iot_led:** Included with iot_buzzer command; LED behavior is level-specific
- **iot_buzzer:** Inserts a row to `iot_alerts` table, then simultaneously: (a) sends BLE `{cmd:"buzz", level, alert_id}` to the IoT device's CMD characteristic, and (b) sends HTTP POST to `/v1/iot/buzz` for MQTT-based delivery

### Alert Dismiss

Dismissal can be initiated by:
- Driver tapping the Dismiss button in the mobile alert modal
- Driver tapping the Dismiss button in the web dashboard alert overlay
- Physical press of the IoT device's dismiss button (GPIO 25)

Dismiss via the physical IoT button publishes to the MQTT topic `snoozeguard/dismiss/{device_id}` and sends a BLE NOTIFY `{event:"dismiss"}`. The API receives this, updates `iot_alerts.status = "dismissed"`, and the mobile app—subscribed to `iot_alerts` via Supabase Realtime—receives the update and executes the same dismiss flow as a manual dismiss.

In all cases, the dismissed level is added to `dismissedLevelsRef` and the alarm audio in `currentSoundRef` is stopped.

### Score Reset

After 2 minutes (configurable via `score_reset_minutes` in admin_config) of idle detection at level 10, all accumulators (yawnAcc, headAcc) are reset to zero, allowing the scoring to restart from baseline.

## IoT Alert Device Design

### Communication Architecture

The ESP32 IoT alert device communicates via two channels:

**Primary: WiFi → MQTT (HiveMQ Cloud TLS 8883)**
- Subscribe topic: `snoozeguard/commands/{device_id}` — receives buzz/all_clear commands
- Publish topic: `snoozeguard/dismiss/{device_id}` — publishes dismiss events from physical button
- Heartbeat topic: `snoozeguard/ping/{device_id}` — published every 5 seconds; server updates `user_iot_devices.last_seen`; online if last_seen < 15 seconds ago

**Fallback: BLE Peripheral (SG-{device_id})**
- CMD characteristic UUID: `beb5483e-...` (WRITE) — receives buzz/all_clear
- EVENT characteristic UUID: `beb5483f-...` (NOTIFY) — sends dismiss events

### Alert Response Patterns

**Table 3: IoT Device Alert Behavior by Drowsiness Level**

| Level | MP3 Track | Vibration / Buzzer Pattern | LED Pattern |
|-------|-----------|--------------------------|-------------|
| 6 | 0001.mp3 | 3 short pulses (200ms on / 150ms off) | Pulsed |
| 7 | 0002.mp3 | 3 medium pulses (400ms on / 150ms off) | Pulsed |
| 8 | 0003.mp3 | 3 long pulses (600ms on / 150ms off) | Pulsed |
| 9 | 0004.mp3 | Continuous buzzer | Continuous on |
| 10 | 0005.mp3 | Continuous buzzer | Flashing (400ms on/off) |

The DFPlayer Mini plays the corresponding track from the MicroSD card. Vibration is produced by the buzzer on GPIO 26, controlled by the pattern loop. LED behavior is controlled on GPIO 27 (primary alert LED) and GPIO 32 (secondary LED).

### Dismiss Button

The physical dismiss button (GPIO 25, INPUT_PULLUP, 200ms software debounce) stops the current alert pattern, silences the DFPlayer, and publishes the dismiss event to both MQTT and BLE simultaneously.

## Emergency Notification System

At drowsiness levels 9 and 10, the mobile application starts a 120-second countdown modal. If the driver does not dismiss the alert within this window, `triggerEmergencyAlert()` is called:

1. The driver's current GPS location (if available) is captured.
2. An `emergency_alert_events` row is inserted to Supabase with status "active."
3. The active emergency contact's Expo push token is retrieved from `push_tokens`.
4. An Expo Push notification is delivered to the emergency contact's device.
5. If `sms_enabled = true` in `admin_config` (and `sms_rate_limit_enabled = false` or the contact has not received an SMS in the past 24 hours), a POST request is sent to a Supabase Edge Function, which forwards the request to the PhilSMS API with the contact's phone number, driver name, and location. PhilSMS delivers the SMS through Philippine telecommunications carriers.

The web platform uses a 30-second countdown for the same trigger.

Emergency contacts can respond via the `EmergencyAlertMapScreen`, which shows a live map of the alert location and accept/dismiss controls. A multi-contact model allows the driver to designate multiple guardians; one is designated as the active EC (`is_active = 1`) at any time.

## Development Methodology

SnoozeGuard was developed following the Iterative Software Development Life Cycle (Iterative SDLC). Development proceeded through the following phases:

1. **Requirements Analysis:** System requirements were derived from a review of related literature on drowsiness detection, stakeholder discussions, and prototype user feedback.

2. **System Design:** Architecture decisions—offline-first SQLite storage, MediaPipe for ML inference, Supabase for cloud backend, HiveMQ for MQTT—were finalized.

3. **Iterative Implementation Sprints:** Features were implemented in prioritized sprints: (a) authentication and session management; (b) face detection and yawn/head movement detection; (c) drowsiness scoring and alert system; (d) emergency contact and notification pipeline; (e) IoT alert device firmware and API; (f) analytics and dashboard; (g) offline-first sync and multi-contact EC model.

4. **Testing and Evaluation:** Each sprint included unit testing of detection algorithms, integration testing of cloud sync, and end-to-end testing of the alert and notification pipeline. Final evaluation used the ISO/IEC 25010 instrument.

**Table 1: Project Gantt Chart**

| Phase | Activity | Start Date | End Date | Duration |
|-------|---------|-----------|---------|----------|
| Phase 1 | Requirements Analysis | January 1, 2025 | January 15, 2025 | 15 days |
| Phase 2 | System Design | January 16, 2025 | January 30, 2025 | 15 days |
| Phase 3 | Mobile App Implementation | February 1, 2025 | February 15, 2025 | 15 days |
| Phase 4 | Web Dashboard Development | February 16, 2025 | February 28, 2025 | 13 days |
| Phase 5 | IoT Firmware Development | March 1, 2025 | March 15, 2025 | 15 days |
| Phase 6 | Integration Testing | March 16, 2025 | March 30, 2025 | 15 days |
| Phase 7 | Evaluation / Survey | April 1, 2025 | April 15, 2025 | 15 days |
| Phase 8 | Documentation / Writing | April 16, 2025 | April 30, 2025 | 15 days |

## Evaluation Framework

### ISO/IEC 25010 Quality Model

SnoozeGuard was evaluated against the ISO/IEC 25010:2011 software product quality model, which defines eight quality characteristics:

1. **Functional Suitability** — The degree to which the system provides functions meeting stated and implied needs.
2. **Performance Efficiency** — Resource-relative performance under stated conditions.
3. **Compatibility** — Ability to exchange information and perform functions while sharing environments.
4. **Usability** — Degree to which the system can be used effectively and satisfactorily.
5. **Reliability** — Performance of specified functions under stated conditions for a defined period.
6. **Security** — Protection of information from unauthorized access or modification.
7. **Maintainability** — Degree to which the system can be modified by intended maintainers.
8. **Portability** — Ability to be transferred and installed in different environments.

Each characteristic was assessed using a structured Likert-scale questionnaire. Respondents rated each criterion from 1 (Strongly Disagree) to 5 (Strongly Agree). Weighted mean scores were computed and interpreted using the following scale:

| Range | Interpretation |
|-------|---------------|
| 4.50 – 5.00 | Excellent |
| 3.50 – 4.49 | Very Good |
| 2.50 – 3.49 | Good |
| 1.50 – 2.49 | Fair |
| 1.00 – 1.49 | Poor |

**Table 6: Respondents of the Study**

The respondents of this study were active drivers aged 22 to 35 years old who were selected through purposive sampling based on their driving experience and availability for system demonstration. The respondents were given the opportunity to interact with the SnoozeGuard system using the physical driving simulator prototype before completing the evaluation questionnaire.

| Profile | Description |
|---------|-------------|
| Respondent Group | Active drivers |
| Age Range | 22–35 years old |
| Sampling Method | Purposive sampling |
| Basis for Selection | Active driving experience; availability for system demonstration |
| Total Respondents | [USER: insert total count] |

**Table 7: Implementation Activities**

| Activity | Date |
|---------|------|
| Development completed | March 30, 2025 |
| System demonstration | March 31, 2025 |
| Survey administration period | April 1–15, 2025 |
| Data collection and tabulation | April 16–30, 2025 |

### API Endpoint Summary

**Table 4: IoT API Endpoint Summary**

| Method | Endpoint | Auth | Description |
|--------|---------|------|-------------|
| POST | /v1/iot/telemetry | Device key | Log IoT telemetry session |
| POST | /v1/iot/ping | Device key | Heartbeat — updates last_seen |
| POST | /v1/iot/buzz | Bearer JWT | Send alert to IoT device via MQTT |
| POST | /v1/iot/dismiss | Device key or Bearer JWT | Dismiss IoT alert |
| GET | /health | None | API health check |

---

# CHAPTER IV: Results and Discussion

## System Implementation

SnoozeGuard was successfully implemented as a multi-platform prototype comprising: (1) an Android mobile application built on Expo SDK 54 / React Native 0.81.5; (2) a React/Vite web dashboard; (3) an ESP32-based IoT alert peripheral; and (4) a Supabase cloud backend with a Node.js/Hono IoT ingest API.

<!-- USER: Provide implementation highlights — key screens, detected alert events during testing, etc. -->

**Table 17: System Performance Metrics**

<!-- USER: Please provide the following (measured during implementation/testing):
- MediaPipe inference time on test device (mobile): ~__ ms
- Face detection success rate: __%
- Alert trigger latency (detection to alert display): ~__ ms
- MQTT command delivery latency: ~__ ms
- SQLite sync time for typical session: ~__ s
- Battery impact per hour of monitoring: ~__%
-->

[USER: Insert screenshots of key system screens as Figures 8–19]

## ISO/IEC 25010 Evaluation Results

**Table 8: Functional Suitability**

<!-- USER: Insert table with criteria, weighted mean, and interpretation for each sub-characteristic:
- Functional completeness
- Functional correctness
- Functional appropriateness
-->

**Table 9: Performance Efficiency**

<!-- USER: Insert table -->

**Table 10: Compatibility**

<!-- USER: Insert table -->

**Table 11: Usability**

<!-- USER: Insert table -->

**Table 12: Reliability**

<!-- USER: Insert table -->

**Table 13: Security**

<!-- USER: Insert table -->

**Table 14: Maintainability**

<!-- USER: Insert table -->

**Table 15: Portability**

<!-- USER: Insert table -->

**Table 16: ISO/IEC 25010 — Overall Software Quality Summary**

<!-- USER: Insert summary table with all 8 characteristics, their overall weighted means, and interpretations -->

## Discussion

<!-- USER: Provide discussion of evaluation results — what was highest, what was lowest, what the scores mean in context, any identified limitations, comparison to related systems if applicable -->

---

# CHAPTER V: Summary, Conclusions, and Recommendations

## Summary

This study developed SnoozeGuard, a multi-platform AI-driven real-time drowsiness monitoring and alert system for road safety. The system addresses the critical gap in affordable, deployable driver fatigue detection for the vehicle fleets of developing economies where factory-integrated Driver Monitoring Systems are absent.

The core detection engine leverages Google's MediaPipe Face Landmarker model—processing 478 facial landmarks and 52 blend shape coefficients—to extract four drowsiness signals from the driver's smartphone front-facing camera: yawn events (detected via the `jawOpen` blend shape), head nodding events (detected via pitch and roll thresholds), sustained head tilt (detected over a 10-second window), and sudden braking events (detected via accelerometer delta threshold). These signals are fused through a configurable administrator-controlled alert map to compute a graduated drowsiness level from 0 to 10.

Alert escalation is graduated and multi-modal: lower-level alerts trigger smartphone-native responses (text-to-speech, vibration, alarm audio); at levels 6 and above, a paired ESP32 IoT alert device receives commands via MQTT (HiveMQ Cloud TLS 8883) or BLE fallback and executes level-specific patterns—three distinct pulse patterns for levels 6–8 and continuous alerts for levels 9–10—using DFPlayer Mini audio, a buzzer, and LED indicators. A physical dismiss button on the IoT device integrates with the same dismiss logic used by the mobile and web interfaces.

At the critical threshold (levels 9–10), a 120-second countdown (30 seconds on web) precedes automatic emergency notification delivery: an Expo push notification and optional SMS (via Supabase Edge Function) are sent to the driver's designated active emergency contact. The emergency contact can view the driver's location and respond via the EmergencyAlertMapScreen.

An offline-first architecture using local SQLite storage with background Supabase cloud synchronization ensures uninterrupted session recording and data integrity under intermittent network conditions. The system supports multi-contact emergency contact management, real-time presence indicators, a light/dark theme, analytics dashboards with stability classification, and a configurable admin interface.

The system was evaluated against the ISO/IEC 25010 software product quality model by [USER: number] respondents, yielding overall quality ratings of [USER: insert summary results].

## Conclusions

Based on the results of the study, the following conclusions are drawn:

1. A smartphone-camera-based drowsiness detection system using MediaPipe Face Landmarker can reliably detect multiple physiological indicators of driver fatigue—including yawning, head nodding, sustained head tilt, and sudden deceleration—in real time on consumer Android hardware, without requiring specialized vehicle equipment or body-worn sensors.

2. A graduated 10-level drowsiness scoring model, configurable via an administrator-controlled alert map, provides a flexible and proportional framework for escalating alert responses that avoids the false-alarm fatigue associated with binary threshold approaches.

3. An ESP32-based IoT alert peripheral with MQTT primary communication and BLE fallback successfully extends the alert modality beyond the smartphone screen, delivering level-calibrated audio, vibration, and LED responses that augment the driver's awareness of fatigue onset across the critical levels 6–10.

4. The closed-loop emergency notification pipeline—combining Expo push notifications, SMS, and real-time location sharing—provides meaningful guardian response capability that is absent from existing smartphone DMS applications.

5. An offline-first SQLite-based storage architecture with Supabase background synchronization ensures continuous session recording and data availability regardless of network connectivity, addressing a practical deployment constraint in areas with intermittent cellular service.

6. SnoozeGuard achieves [USER: insert overall ISO 25010 rating] across the ISO/IEC 25010 quality characteristics, demonstrating satisfactory software quality as a functional prototype suitable for further field validation.

## Recommendations

Based on the findings of this study, the following recommendations are made for future work:

1. **Field Validation with Naturalistic Driving Data:** The prototype should be evaluated in naturalistic driving conditions—across diverse road types, lighting conditions, and driver demographics—to characterize real-world detection accuracy and false positive rates beyond the controlled evaluation performed in this study.

2. **Eye Closure Integration:** While the current system deliberately avoids PERCLOS-based detection to ensure robustness under occlusion, a future iteration could integrate eye closure as an optional supplementary signal—active only when the MediaPipe model reports high-confidence eye landmark tracking—to improve sensitivity under ideal conditions.

3. **Vehicle Integration via OBD-II:** Integrating OBD-II vehicle data (speed, acceleration, lane deviation) as additional drowsiness signal sources would enable a more comprehensive fatigue model and reduce reliance on camera-only signals at nighttime or in variable lighting.

4. **Regulatory Certification Pathway:** The system, while demonstrated as a functional prototype, has not undergone safety-critical system certification. Future development should include formal safety analysis and exploration of regulatory pathways for deployment as a certified driver monitoring aid.

5. **Multi-Language Support and Localization:** Expanding text-to-speech alerts and the application interface to Filipino and other regional languages would improve usability and adoption in the target deployment geography.

6. **Cloud-Based Analytics for Fleet Management:** Extending the system's cloud backend to support fleet operator dashboards—aggregating drowsiness statistics across a pool of drivers—would enable organizational use cases in commercial transportation contexts.

7. **Battery Optimization for Extended Monitoring:** Continuous camera-based ML inference imposes a non-trivial battery load. Investigation of adaptive sampling strategies (e.g., reducing frame rate when drowsiness level is low) and hardware-accelerated neural network inference (e.g., Android NNAPI via MediaPipe's hardware delegate) is recommended.

---

# Bibliography

Alioua, N., Amine, A., Rziza, M., & Aboutajdine, D. (2012). Driver head pose estimation using efficient descriptor fusion. *IET Computer Vision*, 6(3), 228–237. https://doi.org/10.1049/iet-cvi.2011.0163

Bergasa, L. M., Nuevo, J., Sotelo, M. A., Barea, R., & Lopez, M. E. (2006). Real-time system for monitoring driver vigilance. *IEEE Transactions on Intelligent Transportation Systems*, 7(1), 63–77. https://doi.org/10.1109/TITS.2006.869598

Daza, I. G., Hernandez, N., Bergasa, L. M., Parra, I., Yebes, J. J., & Gavilan, M. (2014). Drowsiness monitoring based on driver and driving data fusion. In *Proceedings of the 17th International IEEE Conference on Intelligent Transportation Systems (ITSC 2014)*, 1199–1204. https://doi.org/10.1109/ITSC.2014.6957862

Dohr, A., Modre-Opsrian, R., Drobics, M., Hayn, D., & Schreier, G. (2010). The Internet of Things for ambient assisted living. In *Proceedings of the 7th International Conference on Information Technology: New Generations*, 804–809. https://doi.org/10.1109/ITNG.2010.104

Dwivedi, K., Biswaranjan, K., & Sethi, A. (2014). Drowsy driver detection using representation learning. In *Proceedings of the 2014 IEEE International Advance Computing Conference (IACC)*, 995–999. https://doi.org/10.1109/IAdCC.2014.6779459

Espressif Systems. (2022). *ESP32 technical reference manual* (Version 5.1). https://www.espressif.com/sites/default/files/documentation/esp32_technical_reference_manual_en.pdf

Guggisberg, A. G., Mathis, J., Schnider, A., & Hess, C. W. (2010). Why do we yawn? *Neuroscience & Biobehavioral Reviews*, 34(8), 1267–1276. https://doi.org/10.1016/j.neubiorev.2010.03.008

Horne, J., & Reyner, L. (1995). Sleep related vehicle accidents. *British Medical Journal*, 310(6979), 565–567. https://doi.org/10.1136/bmj.310.6979.565

Horne, J., & Reyner, L. (1999). Vehicle accidents related to sleep: A review. *Occupational and Environmental Medicine*, 56(5), 289–294. https://doi.org/10.1136/oem.56.5.289

Ji, Q., Zhu, Z., & Lan, P. (2004). Real-time nonintrusive monitoring and prediction of driver fatigue. *IEEE Transactions on Vehicular Technology*, 53(4), 1052–1068. https://doi.org/10.1109/TVT.2004.830974

Kang, S. H., Mahoney, N. R., Sezer, N., Bozhurt, A., Giovangrandi, L., & Bhattacharya, S. (2014). Remote patient monitoring system for outpatients. In *Proceedings of the 2014 IEEE Healthcare Innovation Conference (HIC)*, 227–230. https://doi.org/10.1109/HIC.2014.7038920

Kartynnik, Y., Ablavatski, A., Grishchenko, I., & Grundmann, M. (2019). Real-time facial surface geometry from monocular video on mobile GPUs. *arXiv preprint arXiv:1907.06724*. https://arxiv.org/abs/1907.06724

Kazemi, V., & Sullivan, J. (2014). One millisecond face alignment with an ensemble of regression trees. In *Proceedings of the IEEE Conference on Computer Vision and Pattern Recognition (CVPR 2014)*, 1867–1874. https://doi.org/10.1109/CVPR.2014.241

Lugaresi, C., Tang, J., Nash, H., McClanahan, C., Uboweja, E., Hays, M., Zhang, F., Chang, C. L., Yong, M. G., Lee, J., Chang, W.-T., Hua, W., Georg, M., & Grundmann, M. (2019). MediaPipe: A framework for building perception pipelines. *arXiv preprint arXiv:1906.08172*. https://arxiv.org/abs/1906.08172

National Highway Traffic Safety Administration. (2017). *Drowsy driving*. U.S. Department of Transportation. https://www.nhtsa.gov/risky-driving/drowsy-driving

Nunes, T., Barbosa, J., Leitão, P., & Rabelo, R. (2019). IoT-based solution for driver fatigue detection. In *Proceedings of the 2019 24th IEEE International Conference on Emerging Technologies and Factory Automation (ETFA)*, 1627–1630. https://doi.org/10.1109/ETFA.2019.8868999

OASIS. (2019). *MQTT version 5.0 specification*. OASIS Standard. https://docs.oasis-open.org/mqtt/mqtt/v5.0/mqtt-v5.0.html

Philip, P., Sagaspe, P., Moore, N., Taillard, J., Charles, A., Guilleminault, C., & Bioulac, B. (2005). Fatigue, sleep restriction and driving performance. *Accident Analysis & Prevention*, 37(3), 473–478. https://doi.org/10.1016/j.aap.2004.07.007

Ramzan, M., Khan, H. U., Awan, S. M., Ismail, A., Ilyas, M., & Mahmood, A. (2019). A survey on state-of-the-art drowsiness detection techniques. *IEEE Access*, 7, 61904–61919. https://doi.org/10.1109/ACCESS.2019.2914373

Sathyanarayana, A., Nageswaren, S., Ghasemzadeh, H., Jafari, R., & Hansen, J. H. L. (2012). Body sensor network and mobile phone based real-time driving behavior profiling system. In *Proceedings of the 2012 IEEE Consumer Communications and Networking Conference*, 577–578. https://doi.org/10.1109/CCNC.2012.6181020

Viola, P., & Jones, M. (2001). Rapid object detection using a boosted cascade of simple features. In *Proceedings of the 2001 IEEE Conference on Computer Vision and Pattern Recognition (CVPR 2001)*, 1, I-511–I-518. https://doi.org/10.1109/CVPR.2001.990517

Weng, C. H., Lai, Y. H., & Lai, S. H. (2017). Driver drowsiness detection via a hierarchical temporal deep belief network. In *Proceedings of the Asian Conference on Computer Vision (ACCV 2016) Workshops*, Lecture Notes in Computer Science, 10117, 117–133. https://doi.org/10.1007/978-3-319-54427-4_9

Wierwille, W. W., Ellsworth, L. A., Wreggit, S. S., Fairbanks, R. J., & Kim, C. L. (1994). *Research on vehicle-based driver status/performance monitoring: Development, validation, and refinement of algorithms for detection of driver drowsiness*. National Highway Traffic Safety Administration, DOT HS 808 247. https://trid.trb.org/view/427660

Williamson, A., & Chamberlain, T. (2005). *Review of on-road driver fatigue monitoring devices*. Transport Research Laboratory. https://trid.trb.org/view/1156314

World Health Organization. (2023). *Road traffic injuries*. WHO Fact Sheet. https://www.who.int/news-room/fact-sheets/detail/road-traffic-injuries

Yang, S., Song, G., Yin, J., Zhang, Z., & Zhou, Y. (2022). Real-time driver drowsiness detection using facial landmarks and machine learning on edge devices. *Sensors*, 22(11), 4007. https://doi.org/10.3390/s22114007

Zhao, X., & Ye, W. (2018). Research on fatigue driving detection and early warning. In *Proceedings of the 2018 3rd IEEE International Conference on Intelligent Transportation Engineering (ICITE)*, 272–276. https://doi.org/10.1109/ICITE.2018.8492700

---

# Appendices

## Appendix A: Survey Instrument — ISO/IEC 25010 Software Quality Evaluation Questionnaire

**SnoozeGuard: Prototype Development of an AI-Driven Real-Time Drowsiness Monitoring System for Road Safety**

Divine Word College of Calapan — School of Engineering

---

**Instructions:** Please evaluate SnoozeGuard based on your experience using the system. Rate each statement using the following scale:

| Rating | Meaning |
|--------|---------|
| 5 | Strongly Agree |
| 4 | Agree |
| 3 | Neutral |
| 2 | Disagree |
| 1 | Strongly Disagree |

**Respondent Profile (optional):**
- Age: _______
- Gender: _______
- Occupation / Role: _______
- Experience with mobile applications: [ ] Beginner [ ] Intermediate [ ] Advanced

---

### Part I: Functional Suitability

*The degree to which the system provides functions that meet stated and implied needs.*

**A. Functional Completeness** — The system covers all specified tasks and objectives.

| No. | Statement | 5 | 4 | 3 | 2 | 1 |
|-----|-----------|---|---|---|---|---|
| 1 | The system successfully detects yawning as a sign of driver drowsiness in real time. | | | | | |
| 2 | The system successfully detects head nodding and head movement events. | | | | | |
| 3 | The system alerts the driver when the drowsiness level reaches the configured threshold. | | | | | |
| 4 | The system sends emergency notifications (push/SMS) to the emergency contact at critical drowsiness levels. | | | | | |
| 5 | The IoT alert device responds with audio, vibration, and LED alerts when triggered by the system. | | | | | |
| 6 | The system records and stores driving session data for review. | | | | | |

**B. Functional Correctness** — The system produces correct results.

| No. | Statement | 5 | 4 | 3 | 2 | 1 |
|-----|-----------|---|---|---|---|---|
| 7 | The drowsiness level displayed correctly reflects the driver's observable fatigue state. | | | | | |
| 8 | Alert notifications are sent to the correct emergency contact. | | | | | |
| 9 | Session history and analytics data accurately reflect the recorded driving sessions. | | | | | |
| 10 | The IoT device dismisses the alert correctly when the physical dismiss button is pressed. | | | | | |

**C. Functional Appropriateness** — The system's functions facilitate task accomplishment effectively.

| No. | Statement | 5 | 4 | 3 | 2 | 1 |
|-----|-----------|---|---|---|---|---|
| 11 | The graduated 10-level drowsiness scoring model appropriately reflects the severity of fatigue. | | | | | |
| 12 | The escalating alert responses (voice, vibration, alarm, IoT device) are appropriate to the drowsiness level. | | | | | |
| 13 | The 120-second countdown before emergency notification provides sufficient time for the driver to self-dismiss. | | | | | |

---

### Part II: Performance Efficiency

*The degree to which the system performs its functions within specified time and resource constraints.*

**A. Time Behavior** — Response and processing times under normal operation.

| No. | Statement | 5 | 4 | 3 | 2 | 1 |
|-----|-----------|---|---|---|---|---|
| 14 | The system detects yawning and head movement events with minimal perceptible delay. | | | | | |
| 15 | The alert modal appears promptly when the drowsiness threshold is reached. | | | | | |
| 16 | The IoT alert device responds within an acceptable time after a drowsiness event is detected. | | | | | |
| 17 | The emergency notification is delivered to the emergency contact's device promptly. | | | | | |

**B. Resource Utilization** — System resource consumption during operation.

| No. | Statement | 5 | 4 | 3 | 2 | 1 |
|-----|-----------|---|---|---|---|---|
| 18 | The application runs smoothly on the test smartphone without causing noticeable lag or freezing. | | | | | |
| 19 | The application does not cause excessive heating of the smartphone during a drive session. | | | | | |
| 20 | Battery consumption during a monitoring session is at an acceptable level. | | | | | |

---

### Part III: Compatibility

*The degree to which the system can exchange information with other systems and perform its required functions while sharing the same environment.*

**A. Co-existence** — The system operates alongside other applications without interference.

| No. | Statement | 5 | 4 | 3 | 2 | 1 |
|-----|-----------|---|---|---|---|---|
| 21 | The application runs alongside other smartphone apps (navigation, music) without conflicts. | | | | | |
| 22 | The IoT device operates without interfering with other Bluetooth devices in the environment. | | | | | |

**B. Interoperability** — The system exchanges data with its connected components.

| No. | Statement | 5 | 4 | 3 | 2 | 1 |
|-----|-----------|---|---|---|---|---|
| 23 | The mobile application successfully connects and communicates with the IoT alert device. | | | | | |
| 24 | Session data is synchronized correctly between the mobile app and the cloud backend. | | | | | |
| 25 | The web dashboard correctly reflects the same session data as the mobile application. | | | | | |

---

### Part IV: Usability

*The degree to which the system can be used by specified users to achieve specified goals with effectiveness, efficiency, and satisfaction.*

**A. Appropriateness Recognizability** — Users can recognize whether the system is appropriate for their needs.

| No. | Statement | 5 | 4 | 3 | 2 | 1 |
|-----|-----------|---|---|---|---|---|
| 26 | The purpose of the SnoozeGuard system is immediately clear from the application interface. | | | | | |
| 27 | The drowsiness level indicator clearly communicates the driver's current fatigue state. | | | | | |

**B. Learnability** — The system is easy to learn to use.

| No. | Statement | 5 | 4 | 3 | 2 | 1 |
|-----|-----------|---|---|---|---|---|
| 28 | First-time users can start a monitoring session without requiring external assistance. | | | | | |
| 29 | The process of setting up an emergency contact is easy to understand and complete. | | | | | |
| 30 | The pairing process for the IoT alert device is straightforward. | | | | | |

**C. Operability** — The system is easy to control and operate.

| No. | Statement | 5 | 4 | 3 | 2 | 1 |
|-----|-----------|---|---|---|---|---|
| 31 | Navigating between screens (Home, Analytics, Drive, Alerts, History) is intuitive. | | | | | |
| 32 | Dismissing a drowsiness alert requires minimal interaction while in the driving position. | | | | | |
| 33 | The dark/light theme option improves the usability of the application under different lighting conditions. | | | | | |

**D. User Error Protection** — The system prevents user errors.

| No. | Statement | 5 | 4 | 3 | 2 | 1 |
|-----|-----------|---|---|---|---|---|
| 34 | The system prevents accidental termination of an active drive session. | | | | | |
| 35 | The system provides appropriate feedback when actions fail (e.g., network unavailable). | | | | | |

**E. User Interface Aesthetics** — The interface is visually appealing and professional.

| No. | Statement | 5 | 4 | 3 | 2 | 1 |
|-----|-----------|---|---|---|---|---|
| 36 | The visual design of the application is clean, organized, and professional. | | | | | |
| 37 | The color scheme and typography are appropriate for a safety-oriented application. | | | | | |

---

### Part V: Reliability

*The degree to which the system performs specified functions under stated conditions for a specified period of time.*

**A. Maturity** — The system meets reliability requirements under normal operation.

| No. | Statement | 5 | 4 | 3 | 2 | 1 |
|-----|-----------|---|---|---|---|---|
| 38 | The face detection engine consistently detects the driver's face throughout a monitoring session. | | | | | |
| 39 | The system does not crash or terminate unexpectedly during normal operation. | | | | | |
| 40 | Alert events are reliably recorded and retained across sessions. | | | | | |

**B. Availability** — The system is available and operational when needed.

| No. | Statement | 5 | 4 | 3 | 2 | 1 |
|-----|-----------|---|---|---|---|---|
| 41 | The system begins monitoring quickly after launching the Drive screen. | | | | | |
| 42 | The system continues to function in offline mode (without internet connectivity). | | | | | |

**C. Fault Tolerance** — The system continues operating despite component failures.

| No. | Statement | 5 | 4 | 3 | 2 | 1 |
|-----|-----------|---|---|---|---|---|
| 43 | When the IoT device is not connected, the mobile app continues to function and alert normally. | | | | | |
| 44 | Session data recorded offline is successfully synchronized when connectivity is restored. | | | | | |

**D. Recoverability** — The system recovers from failure states.

| No. | Statement | 5 | 4 | 3 | 2 | 1 |
|-----|-----------|---|---|---|---|---|
| 45 | Previously recorded sessions are retained and accessible after an application restart. | | | | | |
| 46 | Authentication state is preserved across app restarts (no repeated login required). | | | | | |

---

### Part VI: Security

*The degree to which the system protects information and data from unauthorized access.*

**A. Confidentiality** — User data is protected from unauthorized disclosure.

| No. | Statement | 5 | 4 | 3 | 2 | 1 |
|-----|-----------|---|---|---|---|---|
| 47 | I am confident that my driving session data is stored securely and not accessible to unauthorized parties. | | | | | |
| 48 | The system does not share my personal information without my consent. | | | | | |

**B. Integrity** — Data is protected from unauthorized modification.

| No. | Statement | 5 | 4 | 3 | 2 | 1 |
|-----|-----------|---|---|---|---|---|
| 49 | Session records cannot be altered or deleted by unauthorized users. | | | | | |
| 50 | Administrator configuration changes require appropriate credentials and authorization. | | | | | |

**C. Authenticity** — User identity is verifiable.

| No. | Statement | 5 | 4 | 3 | 2 | 1 |
|-----|-----------|---|---|---|---|---|
| 51 | The login process (email/password or Google sign-in) securely verifies user identity. | | | | | |
| 52 | Only authorized users (with proper credentials) can access the system. | | | | | |

---

### Part VII: Maintainability

*The degree to which the system can be effectively and efficiently modified.*

**A. Modularity** — The system is composed of discrete components.

| No. | Statement | 5 | 4 | 3 | 2 | 1 |
|-----|-----------|---|---|---|---|---|
| 53 | Individual system components (mobile app, IoT device, API, backend) can be updated independently. | | | | | |
| 54 | The drowsiness alert thresholds can be adjusted without modifying the application code (via admin configuration). | | | | | |

**B. Analysability** — Problems can be identified and diagnosed.

| No. | Statement | 5 | 4 | 3 | 2 | 1 |
|-----|-----------|---|---|---|---|---|
| 55 | Session analytics provide sufficient information to identify patterns in drowsiness occurrence. | | | | | |
| 56 | The system provides clear feedback that helps identify the cause of any alert or system state. | | | | | |

**C. Modifiability** — The system can be modified without introducing defects.

| No. | Statement | 5 | 4 | 3 | 2 | 1 |
|-----|-----------|---|---|---|---|---|
| 57 | The alert map configuration can be updated by an administrator without disrupting system operation. | | | | | |
| 58 | New emergency contacts can be added or changed without requiring a system update. | | | | | |

---

### Part VIII: Portability

*The degree to which the system can be transferred and installed in different environments.*

**A. Adaptability** — The system can be adapted to different environments.

| No. | Statement | 5 | 4 | 3 | 2 | 1 |
|-----|-----------|---|---|---|---|---|
| 59 | The mobile application functions correctly across different Android device models. | | | | | |
| 60 | The web dashboard is accessible and functional across different web browsers. | | | | | |
| 61 | The system adapts appropriately to both indoor (low-light) and outdoor (high-light) monitoring conditions. | | | | | |

**B. Installability** — The system can be installed in a specified environment.

| No. | Statement | 5 | 4 | 3 | 2 | 1 |
|-----|-----------|---|---|---|---|---|
| 62 | The mobile application is easy to install from the provided distribution link. | | | | | |
| 63 | The IoT alert device can be set up and paired without requiring technical expertise. | | | | | |

**C. Replaceability** — The system can be replaced in its environment.

| No. | Statement | 5 | 4 | 3 | 2 | 1 |
|-----|-----------|---|---|---|---|---|
| 64 | If the application is reinstalled, previous data and settings can be restored. | | | | | |

---

**Overall Satisfaction**

| No. | Statement | 5 | 4 | 3 | 2 | 1 |
|-----|-----------|---|---|---|---|---|
| 65 | Overall, SnoozeGuard is an effective tool for real-time driver drowsiness monitoring. | | | | | |
| 66 | I would recommend SnoozeGuard as a practical road safety aid for drivers. | | | | | |

**Open-ended (optional):**

What features did you find most useful?
_______________________________________________

What improvements would you suggest?
_______________________________________________

---

*Thank you for your participation. Your responses will be used solely for academic research purposes.*

## Appendix B: ESP32 Firmware Source Code Excerpt

<!-- System note: Full firmware source available at iot/firmware/src/main.cpp in the SnoozeGuard repository -->

The following excerpt illustrates the core alert dispatch logic from the ESP32 firmware:

```cpp
void handleBuzzCommand(int level, String alertId) {
  currentAlertId = alertId;
  currentLevel = level;
  
  dfPlayer.play(level - 5);  // Track 1=level6, 2=level7, ..., 5=level10
  
  if (level == 6) pulseVibration(3, 200, 150);
  else if (level == 7) pulseVibration(3, 400, 150);
  else if (level == 8) pulseVibration(3, 600, 150);
  else if (level == 9) { continuousBuzz = true; digitalWrite(LED_PIN, HIGH); }
  else if (level == 10) { continuousBuzz = true; flashingLED = true; }
}

void handleDismiss() {
  continuousBuzz = false;
  flashingLED = false;
  dfPlayer.stop();
  digitalWrite(BUZZER_PIN, LOW);
  digitalWrite(LED_PIN, LOW);
  
  // Publish dismiss to MQTT and BLE
  mqttClient.publish(("snoozeguard/dismiss/" + deviceId).c_str(),
    ("{\"alert_id\":\"" + currentAlertId + "\"}").c_str());
  pEventCharacteristic->setValue("{\"event\":\"dismiss\"}");
  pEventCharacteristic->notify();
}
```

## Appendix C: Alert Map Configuration Schema

```json
{
  "6": {
    "label": "High",
    "yawn_count": 6,
    "head_count": 12,
    "actions": ["voice", "vibration", "alarm", "iot_led", "iot_buzzer"]
  },
  "7": {
    "label": "Very High",
    "yawn_count": 7,
    "head_count": 14,
    "actions": ["voice", "vibration", "alarm", "iot_led", "iot_buzzer"]
  },
  "8": {
    "label": "Severe",
    "yawn_count": 8,
    "head_count": 16,
    "actions": ["voice", "vibration", "alarm", "iot_led", "iot_buzzer"]
  },
  "9": {
    "label": "Critical",
    "yawn_count": 9,
    "head_count": 18,
    "actions": ["voice", "vibration", "alarm", "iot_led", "iot_buzzer"]
  },
  "10": {
    "label": "Extreme",
    "yawn_count": 10,
    "head_count": 20,
    "actions": ["voice", "vibration", "alarm", "iot_led", "iot_buzzer"]
  }
}
```

## Appendix D: Curriculum Vitae of Researchers

<!-- USER: Please provide the CV content for each researcher:
- Cart Jeuiel T. Agno
- Aira Mae T. Pilor
- Christian Eduard B. Ylagan Jr.
-->
