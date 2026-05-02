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

Driver drowsiness remains one of the leading contributors to road traffic fatalities worldwide. This paper presents SnoozeGuard, a multi-platform, AI-driven real-time drowsiness monitoring and alert system designed to detect early signs of fatigue and deliver escalating alerts before a critical event occurs. The system employs Google's MediaPipe Face Landmarker model—processing 478 facial landmarks and 52 blend shape coefficients—to detect yawning (jawOpen blend shape), head nodding (pitch and roll deviation), and sustained head tilt through a smartphone camera, without requiring dedicated hardware at the vehicle level. A scored 10-level drowsiness model aggregates these signals using a configurable administrator-controlled alert map, enabling precise threshold tuning for operational contexts. Alert escalation triggers multi-modal responses: text-to-speech voice warnings, device vibration, audio alarm, and—at levels 6 through 10—commands to a paired ESP32-based IoT alert device that plays distinct MP3 tracks with vibration and LED patterns calibrated to drowsiness severity. At levels 9 and 10, the system triggers an emergency notification pipeline that sends push notifications and SMS alerts to the driver's designated emergency contact after a 120-second countdown (30 seconds on the web platform). The system is built as a cross-platform solution comprising a React Native mobile application (Expo SDK 54) deployed via Expo EAS, a React/Vite web dashboard deployed on Firebase Hosting, a Node.js/Hono IoT ingest and MQTT bridge API deployed on Railway, and a Supabase cloud backend (PostgreSQL, Authentication, Realtime). SMS alerts are delivered through PhilSMS, a Philippine SMS gateway, enabling reliable local carrier delivery. An offline-first architecture using local SQLite storage with background Supabase synchronization ensures continuous session recording even without network connectivity. To simulate a realistic driving environment for testing and evaluation, the research team constructed a physical driving simulator prototype comprising a genuine automobile seat mounted on a wooden frame, a gaming steering wheel, brake and accelerator pedals, and a front-facing smartphone mount—providing an ergonomically accurate evaluation platform without requiring a live road vehicle. Evaluated against the ISO/IEC 25010 software quality model, SnoozeGuard demonstrates a Grand Mean of 4.01, interpreted as Very Satisfactory, across all eight quality characteristics. The system provides a practical, low-cost, and deployable solution to reduce drowsy driving incidents through continuous monitoring, intelligent escalation, and guardian-linked emergency response.

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
- Theoretical Framework
- Framework Summary
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
- Developmental Method
- Gantt Chart
- Requirements Specifications
  - Functional Requirements
  - User Interface Requirements
  - Hardware Interface Requirements
  - Software Interface Requirements
  - Security Requirements
- Technical Background
  - Hardware Specifications
  - Software Specifications
- System Analysis and Design
  - System Overview
  - System Architecture
  - Use Case Diagram
  - Activity Diagram
  - Data Flow Diagram (DFD)
  - Database Schema
- Testing and Evaluation
- Participants of the Study
- Implementation Plan

**Chapter IV: Results and Discussion**
- Overview
- Respondent Profile
- Presentation of System Output
  - Login and Authentication
  - Home Screen — Session Dashboard
  - Drive Screen — Active Monitoring Session
  - Drowsiness Alert Modal
  - Analytics Screen
  - Session History Screen
  - Emergency Contact Screen
  - Alerts Map Screen
  - Admin Configuration Screen
  - Web Dashboard — Drive Screen
  - IoT Alert Device — Physical Prototype
- ISO/IEC 25010 Evaluation Results
- Summary of All ISO/IEC 25010 Characteristics
- Overall User Satisfaction
- Qualitative Feedback
- Chapter Summary

**Chapter V: Summary, Conclusions, and Recommendations**
- Summary
- Conclusions
- Recommendations

**Bibliography**

**Appendices**
- Appendix A: Survey Instrument
- Appendix B: ESP32 Firmware Source Code
- Appendix C: Alert Map Configuration Schema
- Appendix D: Curriculum Vitae of Researchers

---

## List of Figures

- Figure 1: System Architecture Overview of SnoozeGuard ................. [Chapter III]
- Figure 2: Use Case Diagram of SnoozeGuard ................. [Chapter III]
- Figure 3: Activity Diagram — Drive Session Flow ................. [Chapter III]
- Figure 4: Activity Diagram — IoT Alert Dismiss Flow ................. [Chapter III]
- Figure 5: Data Flow Diagram — Context Diagram ................. [Chapter III]
- Figure 6: Data Flow Diagram — Diagram 0 (Level 1) ................. [Chapter III]
- Figure 7: Database Entity-Relationship Diagram ................. [Chapter III]
- Figure 8: MediaPipe Face Landmarker — Key Landmarks for Detection ................. [Chapter III]
- Figure 9: Alert Escalation Level Flow ................. [Chapter III]
- Figure 10: ESP32 IoT Alert Device — Physical Prototype ................. [Chapter III]
- Figure 11: MQTT Communication Topology ................. [Chapter III]
- Figure 12: Login Screen ................. [Chapter IV]
- Figure 13: Home Screen (Session Dashboard) ................. [Chapter IV]
- Figure 14: Drive Screen (Active Monitoring Session) ................. [Chapter IV]
- Figure 15: Drowsiness Alert Modal ................. [Chapter IV]
- Figure 16: Analytics Screen ................. [Chapter IV]
- Figure 17: Session History Screen ................. [Chapter IV]
- Figure 18: Emergency Contact Screen ................. [Chapter IV]
- Figure 19: Emergency Alert Map Screen ................. [Chapter IV]
- Figure 20: Admin Configuration Screen ................. [Chapter IV]
- Figure 21: Web Dashboard — Drive Screen ................. [Chapter IV]
- Figure 22: IoT Alert Device — Physical Prototype ................. [Chapter IV]

---

## List of Tables

- Table 1: Project Gantt Chart ................. [Chapter III]
- Table 2: Hardware Bill of Materials — ESP32 IoT Alert Device ................. [Chapter III]
- Table 3: Software Stack Summary ................. [Chapter III]
- Table 4: Deployment Infrastructure ................. [Chapter III]
- Table 5: Alert Level Definitions and Thresholds (Default Configuration) ................. [Chapter III]
- Table 6: IoT Device Alert Behavior by Drowsiness Level ................. [Chapter III]
- Table 7: Weighted Mean Interpretation Scale ................. [Chapter IV]
- Table 8: Distribution of Respondents by Experience Level ................. [Chapter IV]
- Table 9: Functional Suitability — Item Means ................. [Chapter IV]
- Table 10: Performance Efficiency — Item Means ................. [Chapter IV]
- Table 11: Compatibility — Item Means ................. [Chapter IV]
- Table 12: Usability — Item Means ................. [Chapter IV]
- Table 13: Reliability — Item Means ................. [Chapter IV]
- Table 14: Security — Item Means ................. [Chapter IV]
- Table 15: Maintainability — Item Means ................. [Chapter IV]
- Table 16: Portability — Item Means ................. [Chapter IV]
- Table 17: Summary of Weighted Means per ISO/IEC 25010 Characteristic ................. [Chapter IV]
- Table 18: Overall Satisfaction Items ................. [Chapter IV]

---

## List of Appendices

- Appendix A: Survey Instrument — ISO/IEC 25010 Evaluation Questionnaire (66 items)
- Appendix B: ESP32 Firmware Source Code (Arduino/C++)
- Appendix C: Alert Map Configuration Schema (JSON)
- Appendix D: Curriculum Vitae of Researchers

---

# CHAPTER I: The Problem and Its Background

## Introduction

Drowsy driving is a pervasive and underreported cause of road traffic collisions globally. The World Health Organization (2023) estimates that road traffic injuries are the eighth leading cause of death worldwide, with fatigue-impaired driving contributing to an estimated 20% of all road fatalities on high-speed roads in high-income countries (Horne & Reyner, 1995). In the Philippines, the Land Transportation Office reported rising road incident rates in 2022–2023, with driver inattention and fatigue cited among the primary causal factors. Unlike alcohol impairment, drowsiness does not manifest with clear outward indicators visible to law enforcement, and drivers themselves frequently misjudge their own level of fatigue—a phenomenon documented in laboratory studies as "sleepiness misperception" (Philip et al., 2005).

The physiological signs of drowsiness are, however, objectively measurable through facial and behavioral cues. Yawning—characterized by the wide involuntary opening of the jaw—is one of the most reliable early indicators of central fatigue. Head nodding and uncontrolled postural drift of the head are manifestations of microsleep episodes, the brief but dangerous losses of consciousness lasting 3 to 30 seconds during which a vehicle traveling at highway speed can cover over 100 meters without driver input (Horne & Reyner, 1999). The convergence of these signals over time provides a robust basis for automated fatigue assessment.

Contemporary Driver Monitoring Systems (DMS) embedded in premium vehicles leverage near-infrared cameras and eye-tracking algorithms to detect eye closure (PERCLOS—Percentage of Eye Closure) and gaze deviation. While effective, these systems are prohibitively expensive for mass-market adoption and are absent from the vehicle fleet that constitutes the majority of road transport in developing economies. Smartphone-based approaches, leveraging the high-quality front-facing cameras available on modern mobile devices, offer an accessible and deployable alternative that requires no vehicle modification.

SnoozeGuard is a multi-platform, AI-driven drowsiness monitoring and alert system that transforms a driver's existing smartphone into a continuous fatigue detection station. By integrating Google's MediaPipe Face Landmarker—a state-of-the-art on-device machine learning model processing 478 facial landmarks and 52 blend shape coefficients—with a configurable 10-level drowsiness scoring engine and a multi-modal alert escalation pipeline, SnoozeGuard delivers real-time, actionable drowsiness warnings without requiring any vehicle-level hardware modification. At elevated drowsiness levels, the system optionally communicates with a purpose-built ESP32-based IoT alert device—capable of playing calibrated audio tracks, triggering vibration patterns, and illuminating LED indicators—and automatically notifies a designated emergency contact via push notification and SMS when the driver's state reaches a critical threshold.

## Theoretical Framework

The theoretical foundation of this study draws from four established bodies of knowledge that collectively define the scientific, technical, developmental, and evaluative dimensions of SnoozeGuard.

**Psychophysiological Theory of Driver Drowsiness.** The detection model of SnoozeGuard is grounded in the psychophysiological literature establishing yawning, head nodding, and sustained lateral head tilt as validated indicators of central nervous system fatigue. Horne and Reyner (1995, 1999) demonstrated through controlled driving studies that fatigue-impaired drivers exhibit measurable behavioral cues—most prominently head drooping and microsleep-associated motor responses—before crash-critical events occur. Guggisberg et al. (2010) confirmed yawning frequency as a reliable correlate of sleep deprivation, establishing the scientific basis for incorporating the jawOpen facial blend shape as a primary drowsiness signal. Alioua et al. (2012) demonstrated that head pitch and roll deviation beyond defined thresholds reliably predict driver inattention and drowsiness states. These findings collectively justify SnoozeGuard's multi-signal detection architecture—fusing jawOpen coefficient, pitch/roll head angles, sustained lateral tilt, and sudden deceleration events—rather than relying on any single indicator.

**Machine Learning and Computer Vision Theory.** The technical implementation of SnoozeGuard's detection engine is grounded in advances in on-device deep learning for facial analysis. MediaPipe Face Landmarker (Lugaresi et al., 2019; Kartynnik et al., 2019) provides the framework for extracting 478 three-dimensional facial landmark coordinates and 52 blend shape coefficients from a standard smartphone camera in real time, without server dependency. The theoretical basis for face landmark regression—developed by Kazemi and Sullivan (2014) and subsequently advanced through deep network architectures—enables accurate head pose estimation (pitch, roll, yaw) from a single monocular camera, which is the computational foundation for SnoozeGuard's head movement detection subsystem. The availability of production-grade, privacy-preserving on-device inference at mobile hardware capabilities makes camera-based drowsiness detection deployable at scale without specialized hardware.

**ISO/IEC 25010 Software Quality Model.** The evaluation framework of this study is anchored on the ISO/IEC 25010 international standard for software product quality, which defines eight quality characteristics: Functional Suitability, Performance Efficiency, Compatibility, Usability, Reliability, Security, Maintainability, and Portability. This model provides a structured, internationally recognized basis for assessing whether SnoozeGuard meets the quality requirements of a deployable safety application, ensuring that the evaluation is not limited to functional correctness but encompasses the full spectrum of software quality attributes relevant to real-world deployment.

**Iterative Software Development Life Cycle.** The development methodology of this study is grounded in the Iterative SDLC model, which organizes development into successive functional sprints—each producing a tested, working increment of the system. This approach is particularly appropriate for multi-platform systems with evolving requirements, as it allows incremental validation of each component (detection algorithm, alert engine, IoT firmware, cloud backend, synchronization) before integration. The iterative model's feedback loops between sprints mirror the empirical approach of the study: implementation findings directly inform subsequent sprint planning, reducing the risk of late-stage integration failures.

## Framework Summary

The four theoretical pillars described above collectively define the design, development, and evaluation of SnoozeGuard. Psychophysiological drowsiness theory establishes the scientific validity of the behavioral signals the system monitors; machine learning and computer vision theory provides the technical means to extract those signals from a smartphone camera in real time; the Iterative SDLC guides the structured, incremental approach by which the multi-platform system was built and validated; and the ISO/IEC 25010 software quality model supplies the rigorous, internationally standardized framework against which the completed system is formally assessed. Together, these frameworks ensure that SnoozeGuard is not only technically sound in its detection approach but also systematically developed and objectively evaluated against established quality benchmarks.

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

## Developmental Method

This study employed a **developmental research design** following the **Iterative Software Development Life Cycle (Iterative SDLC)**. The iterative approach was chosen for its suitability in building complex, multi-platform software systems where requirements evolve through successive cycles of implementation and testing. Unlike a linear waterfall model, the iterative SDLC allows each implementation sprint to produce a working, testable increment of the system while feeding findings back into the planning of subsequent sprints.

Development was organized into seven functional domains, each treated as an independent sprint: (1) user authentication and session management; (2) face detection and drowsiness signal extraction; (3) drowsiness scoring and alert escalation; (4) emergency contact registration and notification pipeline; (5) IoT alert device firmware and cloud API; (6) analytics dashboard and session history; and (7) offline-first data synchronization and multi-contact emergency contact model. Each sprint followed a cycle of planning, implementation, unit and integration testing, and retrospective review before the next sprint began.

The formal evaluation of the completed system was conducted using a structured questionnaire based on the **ISO/IEC 25010 software product quality standard**, administered to thirty (30) respondents who interacted with the full system through the physical driving simulator prototype. Response data were analyzed using weighted mean computations across the eight quality characteristics of the standard.

## Gantt Chart

The development activities were scheduled and tracked using a Gantt chart spanning January to April 2025. The phases and their corresponding timelines are presented in Table 1.

**Table 1. Project Gantt Chart**

| Phase | Activity | Start | End | Duration |
|-------|----------|-------|-----|----------|
| Phase 1 | Requirements Analysis and System Design | Jan 1, 2025 | Jan 31, 2025 | 31 days |
| Phase 2 | Mobile App — Authentication and Core Screens | Feb 1, 2025 | Feb 10, 2025 | 10 days |
| Phase 3 | Mobile App — Detection, Scoring, and Alert Engine | Feb 11, 2025 | Feb 28, 2025 | 18 days |
| Phase 4 | Web Dashboard and IoT API | Mar 1, 2025 | Mar 15, 2025 | 15 days |
| Phase 5 | IoT Firmware — MQTT, BLE, DFPlayer, Dismiss | Mar 1, 2025 | Mar 20, 2025 | 20 days |
| Phase 6 | Integration Testing and Driving Simulator Build | Mar 21, 2025 | Mar 31, 2025 | 11 days |
| Phase 7 | Evaluation Survey Administration | Apr 1, 2025 | Apr 15, 2025 | 15 days |
| Phase 8 | Data Analysis and Documentation | Apr 16, 2025 | Apr 30, 2025 | 15 days |

---

## Requirements Specifications

### Functional Requirements

The functional requirements of SnoozeGuard define the specific behaviors that the system must perform to fulfill the research objectives. These requirements were derived from the statement of the problem, the specific objectives, and the identified needs of the target user group — active drivers seeking an accessible, real-time drowsiness monitoring solution.

The system must be capable of detecting drowsiness through multiple physiological indicators captured from the driver's smartphone front camera and accelerometer. Specifically, it must detect yawning events in real time using the MediaPipe jawOpen blend shape coefficient, where a value equal to or greater than 0.70 registers a confirmed yawn; detect head nodding and lateral head tilt events using head pose estimation derived from facial landmark coordinates; and detect sudden braking events by monitoring the device accelerometer for a delta threshold of 0.45g or greater. These three independent signals must be fused into a unified drowsiness level on a scale of 0 to 10 using a configurable alert map maintained by the system administrator.

The system must trigger graduated alert responses proportional to the computed drowsiness level, beginning with voice and vibration alerts at lower levels, escalating to IoT device audio and LED alerts at levels 6 through 8, and triggering an emergency contact notification when the driver sustains a level-9 or level-10 state for more than 120 seconds without dismissal. Emergency notifications must be delivered via both Expo push notification and SMS to the driver's designated guardian.

The system must also provide a web dashboard with equivalent drive monitoring functionality, session analytics with date filtering and Focus Score computation, multi-contact emergency contact management, and administrator-controlled threshold configuration. All session data must be stored to local SQLite storage and synchronized to Supabase cloud storage when network connectivity is available, ensuring continuity of operation under intermittent connectivity conditions.

### User Interface Requirements

The user interface of the SnoozeGuard mobile application must present a Drive screen that displays the real-time drowsiness level (0–10), a camera preview, a session timer, and event counters while monitoring is active. When the drowsiness threshold is reached, a full-screen alert modal must appear with the alert level label, a countdown timer of 120 seconds, and a clearly labeled dismiss button that is reachable without the driver removing their eyes from the road.

The application must provide a Home screen displaying recent session summaries, a Focus Score, and a drowsiness event breakdown by type. An Analytics screen must display drowsiness trend charts, a stability classification badge, and an hourly activity breakdown across user-selectable date ranges of 7 days, 30 days, 90 days, or all time. The application must support both dark and light color themes, with the user's preference persisted across sessions. A navigation drawer accessible from the hamburger button must provide access to secondary screens including Emergency Contact, Account, Admin Config (for authorized users), About, and Terms and Privacy.

All interactive touch targets must meet a minimum size of 48 by 48 density-independent pixels in compliance with Android accessibility guidelines. An offline status banner must be clearly displayed when the device has no network connectivity. The web dashboard must be fully functional across Chrome, Firefox, Edge, and Safari on desktop and tablet form factors.

### Hardware Interface Requirements

The mobile application must interface with the Android device's front-facing camera to capture facial video at a minimum resolution of 480 by 640 pixels for MediaPipe inference. The camera must be accessible through the React Native camera permission API. The application must also interface with the device's built-in three-axis accelerometer, sampled at 100-millisecond intervals for sudden braking event detection.

The ESP32 IoT alert device must interface with the DFPlayer Mini MP3 module via UART2 on GPIO pins 16 and 17 for audio alert playback from a MicroSD card. It must interface with a buzzer on GPIO 26 for tactile and auditory alerts, with LED indicators on GPIO 27 and GPIO 32 for visual alert indication, and with a BLE status LED on GPIO 33. A physical push button on GPIO 25 configured as INPUT_PULLUP with 200-millisecond software debounce must serve as the driver's physical dismiss control. The device must receive power from a 5V USB supply or a 12V automotive adapter with step-down voltage regulation.

### Software Interface Requirements

The mobile application must interface with the Supabase JavaScript client for all cloud database operations, authentication, and Realtime event subscriptions over HTTPS and WebSocket. The MediaPipe Face Landmarker model must be accessed via the react-native-mediapipe library on Android in IMAGE mode, and via the @mediapipe/tasks-vision WebAssembly package on the web platform. The ESP32 firmware must connect to the HiveMQ Cloud MQTT broker over TLS at port 8883. The emergency notification system must interface with the Expo Push Notification service for mobile delivery and with PhilSMS through a Supabase Edge Function for SMS delivery to Philippine mobile numbers. User authentication must support both email-and-password and Google OAuth 2.0 sign-in via expo-auth-session.

### Security Requirements

All database tables in Supabase must be protected by Row Level Security policies ensuring that each user can only access their own records. Administrative configuration changes must be performed exclusively through the `update_admin_config` SECURITY DEFINER RPC function, which enforces role-based authorization at the database level, preventing unauthorized direct writes to the admin_config table. All communication between the ESP32 device and the MQTT broker must use TLS encryption. User sessions must be managed using JWT tokens issued by Supabase Auth with automatic refresh. Camera feed data must be processed entirely on the device and must not be transmitted to any external server. Emergency contact personal data must be stored encrypted at rest and transmitted only over HTTPS.

---

## Technical Background

### Hardware Specifications

**Smartphone — Primary Detection Platform**

The drowsiness detection engine runs on the driver's Android smartphone, which is mounted in a front-facing dashboard cradle during a drive session. No specific device model is required. The minimum hardware requirements are Android 8.0 (API level 26) or higher, a front-facing camera capable of 720p capture or above, a built-in three-axis accelerometer, and at least 3 GB of RAM for stable concurrent execution of the MediaPipe inference pipeline alongside the React Native runtime. Camera frames are captured at 600-millisecond intervals in IMAGE mode for inference; the accelerometer is sampled at 100-millisecond intervals for braking event detection. No vehicle-level hardware modification is required.

**ESP32 IoT Alert Device**

The IoT alert peripheral is built around the ESP32 DevKit V1 microcontroller, selected for its dual-core 240 MHz processor, 520 KB SRAM, native WiFi and Bluetooth Low Energy support, and low cost. Audio alerts are produced by a DFPlayer Mini MP3 module connected via UART2 (GPIO 16 RX, GPIO 17 TX), which plays level-specific MP3 tracks from a MicroSD card formatted in FAT32. A 3-watt 8-ohm speaker delivers audible alerts to the driver. A buzzer on GPIO 26 provides vibration-pattern alerts, and LED indicators on GPIO 27 and GPIO 32 provide visual alerts calibrated to the drowsiness level. A physical dismiss button on GPIO 25 allows the driver to acknowledge and clear an active alert without touching the smartphone. The complete hardware bill of materials is presented in Table 2.

**Table 2. Hardware Bill of Materials — ESP32 IoT Alert Device**

| Component | Purpose | Interface / GPIO |
|-----------|---------|-----------------|
| ESP32 DevKit V1 | Microcontroller — WiFi, BLE, GPIO | — |
| DFPlayer Mini | MP3 audio playback | UART2 (GPIO 16/17) |
| MicroSD Card (≥ 1 GB) | Audio track storage (0001–0005.mp3) | SPI via DFPlayer |
| 3W Speaker (8Ω) | Audio output | DFPlayer Mini SPK pins |
| Buzzer | Tactile and auditory alerts | GPIO 26 |
| LED — Primary Alert | Visual alert indicator | GPIO 27 |
| LED — Secondary | Secondary visual indicator | GPIO 32 |
| LED — BLE Status | BLE connection status | GPIO 33 |
| Push Button | Driver physical dismiss | GPIO 25 (INPUT_PULLUP) |
| 5V USB Power Supply | Device power (or 12V automotive adapter) | VIN |

**Driving Simulator Prototype**

To provide a realistic, standardized evaluation environment without requiring live road access, the research team constructed a physical driving simulator prototype. The simulator comprises a genuine automobile bucket seat mounted on a rigid wooden frame that provides authentic seating posture and a head-to-camera distance representative of actual driving conditions. A Logitech-series gaming steering wheel with force feedback is mounted at ergonomically correct height relative to the seat. Brake and accelerator pedals at floor level on the wooden base allow natural foot positioning. A front-facing smartphone mount positioned at windshield-equivalent distance of approximately 60 to 80 centimeters from the driver's face captures the full face within MediaPipe's detection range. The frame is constructed from dimensional lumber providing structural rigidity and adjustability. All evaluation respondents used this simulator before completing the ISO/IEC 25010 evaluation questionnaire.

### Software Specifications

The SnoozeGuard system is built on a stack of open-source and managed-cloud technologies selected for their suitability to real-time mobile ML inference, offline-first data persistence, and IoT communication. The primary mobile framework is Expo SDK 54 with React Native 0.81.5, providing the Android application runtime. The web dashboard is built with React 18 and Vite 5. On-device ML inference uses the react-native-mediapipe library (version 0.6.0) on Android and the @mediapipe/tasks-vision WebAssembly package (version 0.10.17) on the web. Local data persistence uses expo-sqlite (version 16.0.10), while cloud backend services are provided by Supabase (PostgreSQL, Auth, Realtime, Edge Functions). The IoT ingest API is implemented in Node.js with the Hono framework. MQTT communication uses the HiveMQ Cloud managed broker over TLS port 8883. The IoT firmware runs on the Arduino framework for ESP32. Push notifications are delivered through Expo Push (FCM for Android, APNs for iOS). SMS emergency notifications are delivered through PhilSMS via a Supabase Edge Function. The web application is hosted on Firebase Hosting and the IoT API is deployed on Railway.

**Table 3. Software Stack Summary**

| Layer | Technology | Version |
|-------|-----------|---------|
| Mobile framework | Expo / React Native | SDK 54 / RN 0.81.5 |
| Web framework | React + Vite | 18 / 5 |
| Mobile ML inference | react-native-mediapipe | ^0.6.0 |
| Web ML inference | @mediapipe/tasks-vision (WASM) | 0.10.17 |
| Local database | expo-sqlite | ~16.0.10 |
| Cloud backend | Supabase | — |
| IoT API | Node.js + Hono | Node 20 / Hono 4 |
| MQTT broker | HiveMQ Cloud | TLS port 8883 |
| IoT firmware | Arduino framework (ESP32) | espressif32 |
| Push notifications | Expo Push / FCM / APNs | — |
| SMS gateway | PhilSMS via Supabase Edge Function | — |
| Web hosting | Firebase Hosting | — |
| API hosting | Railway | — |

---

## System Analysis and Design

### System Overview

SnoozeGuard is a four-tier, multi-platform driver drowsiness monitoring system. The four tiers are: the client applications (React Native mobile app and React/Vite web dashboard); the IoT alert peripheral (ESP32 device); the IoT ingest API (Node.js/Hono on Railway); and the cloud backend (Supabase). The mobile application serves as the primary detection and data storage platform, using an offline-first architecture where local SQLite is the ground truth and Supabase cloud storage receives synchronized copies of all session data. The system is designed to operate continuously during a driving session, detecting fatigue signals every 600 milliseconds, computing a drowsiness level, and executing the appropriate alert response — all without requiring any vehicle modification.

### System Architecture

The system architecture follows a four-tier client-server-IoT model. At the client tier, the React Native mobile application hosts the MediaPipe inference engine, the drowsiness scoring algorithm, the alert escalation pipeline, the emergency notification dispatcher, and the SQLite database. The React/Vite web dashboard at the same tier provides a browser-based Drive experience and administrator tools. At the IoT peripheral tier, the ESP32 device receives alert commands and delivers physical alerts (audio, vibration, LED) to the driver. At the API tier, the Node.js/Hono IoT API routes alert commands through the MQTT broker and processes dismiss events from the ESP32 button. At the cloud tier, Supabase provides the PostgreSQL database with Row Level Security, Supabase Auth for user management, Realtime WebSocket subscriptions for live event streaming, and Edge Functions for SMS dispatch via PhilSMS.

The deployment infrastructure is summarized in Table 4.

**Table 4. Deployment Infrastructure**

| Component | Hosting Service | Notes |
|-----------|----------------|-------|
| Mobile application | Expo EAS | OTA updates; preview channel APK |
| Web dashboard | Firebase Hosting | CDN-distributed React/Vite SPA |
| IoT ingest API | Railway | Node.js/Hono container; auto-deploy |
| Cloud backend | Supabase | PostgreSQL + Auth + Realtime + Edge Fn |
| MQTT broker | HiveMQ Cloud | TLS port 8883 |
| SMS delivery | PhilSMS | Philippine carrier delivery |

[DIAGRAM: Figure 1 — System Architecture Overview of SnoozeGuard | PROMPT: "Create a professional software architecture diagram for a system called SnoozeGuard. Draw four horizontal tiers labeled: Tier 1 - Client Applications (left box: React Native Mobile App, right box: React/Vite Web Dashboard), Tier 2 - IoT Peripheral (ESP32 Alert Device), Tier 3 - IoT API Layer (Node.js/Hono on Railway), Tier 4 - Cloud Backend (Supabase: PostgreSQL, Auth, Realtime, Edge Functions). Add a MQTT Broker cloud shape (HiveMQ Cloud) on the side connecting the IoT API and ESP32. Show arrows: Mobile App to Cloud Backend (HTTPS/WebSocket), Web Dashboard to Cloud Backend (HTTPS), Mobile App to IoT API (HTTPS/Bearer JWT), IoT API to MQTT Broker (MQTT TLS 8883), MQTT Broker to ESP32 (subscribe/publish), ESP32 to IoT API (dismiss events), Mobile App to ESP32 (BLE fallback dashed arrow). Use a clean white background, navy blue (#1A3A5C) for tier boxes, green (#145A32) for IoT components, and dark red (#6B1A1A) for cloud. Professional academic thesis style."]

### Use Case Diagram

The SnoozeGuard use case diagram defines the interactions between three primary actors and the system. The **Driver** is the primary user who operates the mobile application during a driving session. The **Emergency Contact** is the designated guardian who receives alert notifications. The **System Administrator** holds the super_admin role and is responsible for maintaining system configuration through the Admin Config screen.

The Driver's primary use cases include logging in or registering, starting and ending drive sessions, viewing the real-time drowsiness level, dismissing drowsiness alerts (via the in-app button or the IoT physical button), and accessing session history, analytics, and emergency contact management. The Emergency Contact's use cases include receiving push notification and SMS alerts at critical drowsiness levels, viewing the driver's alert location on a map, and managing contact requests. The System Administrator's use cases include configuring the alert map thresholds, adjusting SMS and scoring parameters, and accessing the full system configuration.

[DIAGRAM: Figure 2 — Use Case Diagram of SnoozeGuard | PROMPT: "Create a formal UML Use Case Diagram for a system called SnoozeGuard. Draw a large rounded rectangle labeled 'SnoozeGuard System' as the system boundary. Place three actor stick figures outside the boundary: 'Driver' on the far left, 'Emergency Contact' on the far right, 'System Administrator' below-right. Inside the system boundary, draw these use case ovals and connect them with solid lines to the appropriate actors: Connected to Driver: 'Login / Register', 'Start Drive Session', 'View Real-Time Drowsiness Level', 'Dismiss Alert (In-App)', 'Dismiss Alert (IoT Button)', 'View Session History', 'View Analytics Dashboard', 'Manage Emergency Contacts'. Connected to Emergency Contact: 'Receive Push Notification', 'Receive SMS Alert', 'View Alert Location on Map', 'Accept / Decline Contact Request'. Connected to System Administrator: 'Configure Alert Map Thresholds', 'Configure SMS Settings', 'View Admin Dashboard'. Use standard UML notation. Clean white background, professional academic thesis style, navy blue text, gray oval borders."]

### Activity Diagram

The activity diagram for the drive session flow illustrates the sequential lifecycle of a SnoozeGuard drive session from initialization through detection, alert handling, and session termination. The flow begins when the driver opens the Drive screen, which initializes the MediaPipe model and requests camera permission. The detection loop then runs continuously: each camera frame is processed for yawn, head movement, and brake events; the drowsiness level is recomputed; and if the level meets or exceeds the configured trigger threshold and has not yet been dismissed in the current session, an alert fires. The alert actions execute in parallel (voice, vibration, alarm audio, and IoT commands where applicable), and a 120-second countdown begins. If the driver dismisses the alert before the countdown expires, the system resets the alert state and resumes monitoring. If the countdown expires without dismissal, the emergency notification pipeline triggers: GPS location is captured, an emergency alert event record is inserted into Supabase, and push notification and SMS are dispatched to the active emergency contact. The session ends when the driver taps the End Session button, finalizing the session record in SQLite and triggering a background sync to Supabase.

[DIAGRAM: Figure 3 — Activity Diagram: Drive Session Flow | PROMPT: "Create a UML Activity Diagram showing the flow of a SnoozeGuard drive session. Use standard UML swimlane notation with two swimlanes: 'Driver' and 'System'. Start node (filled circle) in System. Flow: 1. System: Open Drive Screen → Initialize MediaPipe Model → Start Camera. 2. System: Detection Loop (diamond decision: Face Detected? If No → Show 'No Face' indicator, loop back. If Yes → Extract jawOpen, head pitch/roll, accelerometer delta). 3. System: Compute Drowsiness Level 0-10. 4. System: decision diamond 'Level ≥ Threshold AND not dismissed?' If No → loop back to Detection Loop. If Yes → Execute Alert Actions (parallel bar: Voice TTS, Vibration, Alarm Audio, IoT Buzz Command). 5. System: Start 120s Countdown. 6. Decision: 'Driver dismisses?' with two paths: Yes → Reset Alert State → loop back to Detection Loop. No (timeout) → Trigger Emergency Notification (Capture GPS → Insert Alert Event → Send Push Notification → Send SMS). 7. Driver swimlane: 'End Session' action. 8. System: Finalize SQLite Session Record → Sync to Supabase → End node (filled circle in double circle). Use standard UML notation, clean white background, navy blue activity boxes, professional academic style."]

[DIAGRAM: Figure 4 — Activity Diagram: IoT Alert Dismiss Flow | PROMPT: "Create a UML Activity Diagram showing the IoT physical dismiss button flow for SnoozeGuard. Use two swimlanes: 'ESP32 Device' and 'Cloud / Mobile App'. Start: Driver presses GPIO 25 button (200ms debounce). ESP32: Stop DFPlayer audio, Turn off buzzer, Turn off LEDs. ESP32: Publish dismiss event to MQTT topic 'snoozeguard/dismiss/{device_id}' AND Send BLE NOTIFY event. IoT API receives MQTT message → Updates iot_alerts.status = 'dismissed' in Supabase. Mobile App (via Supabase Realtime): Receives iot_alerts UPDATE → Stops alarm audio (currentSoundRef) → Adds level to dismissedLevelsRef → Resets alert modal state → Resumes detection monitoring. End node. Clean white background, professional UML style, navy blue swimlane headers."]

### Data Flow Diagram (DFD)

#### Context Diagram

The context diagram presents the entire SnoozeGuard system as a single process surrounded by four external entities. The **Driver** supplies facial video, accelerometer data, session control actions, and authentication credentials to the system, and receives the real-time drowsiness level, in-app alerts, and session analytics in return. The **Emergency Contact** receives emergency push notifications and SMS alerts from the system, and sends contact request responses back to the system. The **System Administrator** provides alert map configuration, SMS settings, and threshold parameters to the system. The **IoT Alert Device** receives alert commands from the system and sends physical dismiss events and heartbeat pings back.

[DIAGRAM: Figure 5 — DFD Context Diagram of SnoozeGuard | PROMPT: "Create a Data Flow Diagram (DFD) Level 0 Context Diagram for SnoozeGuard. Draw a large central rectangle or rounded box labeled '0 SnoozeGuard System'. Place four external entity rectangles around it: 'Driver' (left), 'Emergency Contact' (right), 'System Administrator' (bottom-left), 'IoT Alert Device / ESP32' (bottom-right). Draw labeled arrows (data flows): From Driver to System: 'Facial video + accelerometer data', 'Authentication credentials', 'Session control (start/stop/dismiss)'. From System to Driver: 'Real-time drowsiness level', 'Alert modal + countdown', 'Session analytics'. From System to Emergency Contact: 'Push notification', 'SMS alert + GPS location'. From Emergency Contact to System: 'Contact request response'. From System Administrator to System: 'Alert map thresholds + SMS config'. From System to IoT Alert Device: 'Alert command (level + alert_id)'. From IoT Alert Device to System: 'Dismiss event', 'Heartbeat ping'. Use standard Gane-Sarson or Yourdon DFD notation, clean white background, professional academic style."]

#### Diagram 0

Diagram 0 decomposes the SnoozeGuard system into six major sub-processes with their associated data stores and inter-process data flows. Process 1, Authentication and Session Management, handles user login, JWT session management, and offline session caching, reading from and writing to the user_preferences SQLite store and the Supabase auth.users table. Process 2, Drowsiness Detection, receives the camera frame stream and accelerometer data from the Driver, reads the alert map from the admin_config store, and produces a computed drowsiness level and alert trigger events while writing telemetry samples to session_telemetry_local. Process 3, Alert Escalation, receives alert trigger events from Process 2, executes the configured alert actions in parallel, and writes alert records to iot_alerts and emergency_alert_events_local. Process 4, IoT Communication, receives alert commands from Process 3 and dismiss events from the IoT device, routing commands through the MQTT broker and updating the iot_alerts and user_iot_devices stores. Process 5, Emergency Notification, receives countdown expiry signals from Process 3, retrieves emergency contact data, and dispatches push notifications through Expo Push and SMS through PhilSMS, reading from the emergency_contacts_local and push_tokens stores. Process 6, Data Persistence and Sync, receives all session, telemetry, and event records from the other processes, writes them to SQLite stores, and synchronizes pending records to the Supabase cloud database when connectivity is available.

[DIAGRAM: Figure 6 — DFD Diagram 0 (Level 1) of SnoozeGuard | PROMPT: "Create a Data Flow Diagram (DFD) Level 1 (Diagram 0) for SnoozeGuard. Draw six numbered process bubbles/rectangles: '1.0 Authentication and Session Management', '2.0 Drowsiness Detection', '3.0 Alert Escalation', '4.0 IoT Communication', '5.0 Emergency Notification', '6.0 Data Persistence and Sync'. Draw these data stores (open-ended rectangles): D1 user_preferences (SQLite), D2 session_telemetry_local (SQLite), D3 emergency_contacts_local (SQLite), D4 emergency_alert_events_local (SQLite), D5 iot_alerts (Supabase), D6 user_iot_devices (Supabase), D7 driving_sessions (Supabase), D8 admin_config (Supabase). Draw external entities: 'Driver', 'Emergency Contact', 'IoT Alert Device', 'System Administrator'. Connect with labeled arrows showing data flows: Driver → 2.0 (camera frames, accel data), D8 → 2.0 (alert map config), 2.0 → 3.0 (alert trigger + level), 3.0 → 4.0 (IoT alert command), IoT Alert Device → 4.0 (dismiss event), 3.0 → 5.0 (countdown expiry), D3 → 5.0 (EC contact info), 5.0 → Emergency Contact (push notif + SMS), 2.0 → D2 (telemetry sample), 3.0 → D4 (alert event), 6.0 → D7 (synced session). Use standard Gane-Sarson DFD notation, clean white background, professional academic style."]

### Database Schema

SnoozeGuard uses a two-layer data persistence architecture: a local SQLite database on the mobile device serving as the ground truth, and a Supabase PostgreSQL cloud database as the synchronized backup and multi-platform data source. The local SQLite schema is managed by expo-sqlite through migration scripts in the `db/database.ts` module.

The primary local SQLite tables are as follows. The `driving_sessions_local` table stores one record per drive session, capturing the session UUID, user ID, start and end timestamps, total yawn and nod counts, peak drowsiness level, alert count, and a `pending_sync` flag that tracks whether the record has been successfully synchronized to Supabase. The `session_telemetry_local` table stores per-second telemetry samples with the session ID, timestamp, drowsiness level, accumulator values, and head tilt delta. The `emergency_contacts_local` table maintains an offline cache of the driver's registered emergency contacts, including a multi-contact model where the `is_active` column identifies the currently designated guardian. The `emergency_alert_events_local` table records each alert trigger event with its session association, level, trigger timestamp, and dismiss timestamp. The `user_preferences` table is a simple key-value store for user settings such as theme preference.

The Supabase cloud schema mirrors the local data with additional fields suited for multi-user, cloud-native access. Notable cloud-only tables include `iot_alerts`, which stores the alert commands dispatched to the ESP32 device along with their current status (pending, sent, or dismissed) and the identity of the dismissing party; `user_iot_devices`, which maps paired ESP32 devices to user accounts and tracks the last heartbeat timestamp for presence computation; `alert_events`, which provides an audit log of all alert triggers across the system; and `admin_config`, a singleton table containing the system-wide configuration including the full alert map JSON, trigger level, score reset parameters, and SMS settings. All cloud tables are protected by Row Level Security policies.

[DIAGRAM: Figure 7 — Database Entity-Relationship Diagram | PROMPT: "Create a database Entity-Relationship Diagram (ERD) for the SnoozeGuard system. Show these entities as rectangles with their key attributes: LOCAL SQLITE (shaded light blue): 'driving_sessions_local' (id PK, user_id, start_time, end_time, total_yawns, total_nods, max_drowsiness_level, alert_count, pending_sync), 'session_telemetry_local' (id PK, session_id FK, timestamp, drowsiness_level, yawn_acc, head_acc, head_tilt_delta), 'emergency_contacts_local' (id PK, user_id, contact_name, contact_phone, is_active, status, pending_sync), 'emergency_alert_events_local' (id PK, session_id FK, drowsiness_level, timestamp, dismissed_at), 'user_preferences' (key PK, value). SUPABASE CLOUD (shaded light green): 'driving_sessions' (id PK, user_id FK, start_time, end_time, total_yawns, max_drowsiness_level), 'iot_alerts' (id PK, device_id, user_id FK, drowsiness_level, status, dismissed_by, dismissed_at), 'user_iot_devices' (id PK, user_id FK, device_id, last_seen), 'admin_config' (id PK, trigger_level, alert_map JSONB, sms_enabled). Draw crow's foot notation relationships: driving_sessions_local 1:N session_telemetry_local, driving_sessions_local 1:N emergency_alert_events_local, driving_sessions_local ---sync---> driving_sessions (dashed arrow), emergency_contacts_local ---sync---> emergency_contacts (dashed arrow). Professional ERD style, clean white background, academic thesis quality."]

---

## Drowsiness Detection Algorithm

### Face Landmark Acquisition

The MediaPipe Face Landmarker model processes 478 three-dimensional facial landmarks and outputs 52 blend shape coefficients from each camera frame. On the mobile platform, the model runs in IMAGE mode at a 600-millisecond sampling interval, balancing detection responsiveness with device thermal stability. The model file, approximately 5 megabytes in size (face_landmarker.task), is downloaded from Google's CDN on first launch and cached to the device's document directory for offline use.

On the web platform, the model runs in VIDEO mode at approximately 130-millisecond intervals, using WebAssembly execution to process frames from the browser's MediaStream API.

[DIAGRAM: Figure 8 — MediaPipe Face Landmarker Key Landmarks for Detection | PROMPT: "Create a clean technical illustration showing a front-facing human face outline (simple line drawing, gender-neutral) with labeled facial landmark points for the SnoozeGuard drowsiness detection system. Highlight and label these specific points with arrows and text: Landmark 10 (forehead top, labeled 'Forehead — Pitch Reference'), Landmark 152 (chin bottom, labeled 'Chin — Pitch Reference'), Landmark 168 (nose bridge, labeled 'Nose Bridge — Head Pose'), Landmark 1 (nose tip, labeled 'Nose Tip — Head Pose'), Jaw open region around landmarks 13 and 14 (labeled 'jawOpen Blend Shape ≥ 0.70 = Yawn Detected'). In the upper right corner, show a small scale diagram of head axes: Pitch (nodding up/down), Roll (tilting left/right), Yaw (turning left/right). Use a clean white background, blue annotation lines, professional academic style. Add a small caption: 'MediaPipe Face Landmarker — 478 landmarks, 52 blend shapes'."]

### Yawn Detection

Yawn detection is performed using the `jawOpen` blend shape coefficient output by the MediaPipe Face Landmarker model. The coefficient ranges from 0.0 (fully closed) to 1.0 (fully open). The detection logic applies a two-threshold hysteresis: a value equal to or greater than 0.70 opens the yawn state, and a value equal to or less than 0.40 confirms the yawn completion and increments the yawn accumulator (`yawnAcc`). A cooldown period of 2,000 milliseconds between consecutive yawn events prevents rapid re-triggering. Head movement and tilt detection are suspended when `jawOpen` is equal to or greater than 0.60 to prevent cross-signal noise from the jaw movement affecting head pose estimation.

### Head Movement Detection

Head pose is estimated from four key facial landmarks: the forehead (landmark 10), the chin (landmark 152), the nose bridge (landmark 168), and the nose tip (landmark 1). Pitch — the forward nodding motion — and roll — the lateral tilt — are derived from the relative positions of these landmarks. An event fires on the centered-to-off-center transition only, preventing continuous accumulation from a sustained off-center pose. The pitch threshold is 0.35 normalized units and the roll threshold is 0.25 radians. A cooldown of 500 milliseconds applies between consecutive head events. Each confirmed event increments the head movement accumulator (`headAcc`).

### Sustained Head Tilt Detection

A sustained lateral head tilt of greater than 10 continuous seconds — with a 4-frame grace window to accommodate brief corrections — triggers an independent special alert at level 8. This alert is displayed through a dedicated modal separate from the main drowsiness scoring pipeline and does not modify the yawn or head movement accumulators.

### Sudden Brake Detection

The device accelerometer is sampled at 100-millisecond intervals. When the magnitude of the accelerometer delta vector exceeds 0.45 g across two qualifying samples within a 3,000-millisecond window, a sudden braking event is recorded. Brake events trigger a separate special alert modal and suppress the main drowsiness alert popup for 10 seconds to prevent simultaneous alert fatigue.

### Drowsiness Level Computation

The unified drowsiness score is computed by the `computeLevelFromAlertMap()` function in the shared `packages/shared/src/alertMap.ts` module. The function accepts the current yawn accumulator, head movement accumulator, brake flag, and the administrator-configured alert map, and returns the highest level for which both the yawn count and head count thresholds are simultaneously met. The default threshold configuration is presented in Table 5.

**Table 5. Alert Level Definitions and Thresholds (Default Configuration)**

| Level | Label | Yawn Threshold | Head Movement Threshold | Actions |
|-------|-------|:--------------:|:-----------------------:|---------|
| 1 | Very Low | 1 | 2 | voice |
| 2 | Low | 2 | 4 | voice, vibration |
| 3 | Mild | 3 | 6 | voice, vibration |
| 4 | Moderate | 4 | 8 | voice, vibration, alarm |
| 5 | Moderate-High | 5 | 10 | voice, vibration, alarm |
| 6 | High | 6 | 12 | voice, vibration, alarm, IoT LED, IoT buzzer |
| 7 | Very High | 7 | 14 | voice, vibration, alarm, IoT LED, IoT buzzer |
| 8 | Severe | 8 | 16 | voice, vibration, alarm, IoT LED, IoT buzzer |
| 9 | Critical | 9 | 18 | voice, vibration, alarm, IoT LED, IoT buzzer, emergency |
| 10 | Extreme | 10 | 20 | voice, vibration, alarm, IoT LED, IoT buzzer, emergency |

*Note: Thresholds are configurable by the system administrator via the Admin Config screen.*

---

## Alert Escalation System

[DIAGRAM: Figure 9 — Alert Escalation Level Flow | PROMPT: "Create a vertical flow diagram showing the SnoozeGuard 10-level drowsiness alert escalation scale. Draw 10 horizontal bands stacked vertically, colored from light yellow at the top (Level 1) to dark red at the bottom (Level 10). For each level, show: Level number on the left, Label in the center (Level 1: Very Low, 2: Low, 3: Mild, 4: Moderate, 5: Moderate-High, 6: High, 7: Very High, 8: Severe, 9: Critical, 10: Extreme), and Alert Actions on the right as small icons or text. Show a legend: Levels 1-2: Voice only (light green), Levels 3-5: Voice + Vibration + Alarm (yellow/orange), Levels 6-8: + IoT Device (LED + Audio) (orange/red), Levels 9-10: + Emergency Contact Notification (deep red). Add an upward arrow on the left side labeled 'Increasing Drowsiness Severity'. Professional academic thesis style, clean white background."]

When a computed drowsiness level meets or exceeds the administrator-configured `trigger_level` and the corresponding level has not already been dismissed in the current session, an alert fires. A 35-second inter-alert cooldown prevents repeated firing at the same level, but this cooldown is bypassed when the level escalates beyond a previously dismissed level or when level 10 re-triggers after 3 additional yawn events or 10 additional head events above the reset baseline.

Upon firing, all configured actions for that level execute in parallel. Voice alerts use Expo Speech TTS to announce a level-specific warning message, with the number of repetitions increasing with level severity. Vibration uses a five-pulse pattern. Alarm audio plays a system ringtone for 8 seconds, with the playback handle tracked for immediate cancellation on dismiss. At levels 6 through 10, the system inserts a row into the `iot_alerts` Supabase table and simultaneously sends a BLE buzz command to the IoT device's CMD characteristic and an HTTP POST request to the IoT API for MQTT-based delivery.

Dismissal can be initiated by the driver tapping the in-app dismiss button, by a dismiss event received via Supabase Realtime from the IoT device's physical button, or by the web dashboard's dismiss control. In all cases, the dismissed level is recorded in the session's dismissed-levels set and the alarm audio is stopped. After two minutes of idle detection at level 10, all accumulators reset to zero.

---

## IoT Alert Device

The ESP32 IoT alert device communicates with the SnoozeGuard backend through two channels. The primary channel uses WiFi to connect to the HiveMQ Cloud MQTT broker over TLS at port 8883. The device subscribes to the topic `snoozeguard/commands/{device_id}` to receive alert commands, publishes dismiss events to `snoozeguard/dismiss/{device_id}`, and sends a heartbeat ping to `snoozeguard/ping/{device_id}` every 5 seconds. The fallback channel uses Bluetooth Low Energy, advertising under the name `SG-{device_id}`, with a CMD write characteristic for receiving commands and an EVENT notify characteristic for publishing dismiss events when WiFi is unavailable.

The alert response patterns by drowsiness level are defined in Table 6.

**Table 6. IoT Device Alert Behavior by Drowsiness Level**

| Level | MP3 Track | Buzzer / Vibration Pattern | LED Pattern |
|-------|-----------|--------------------------|-------------|
| 6 | 0001.mp3 | 3 short pulses (200 ms on / 150 ms off) | Pulsed |
| 7 | 0002.mp3 | 3 medium pulses (400 ms on / 150 ms off) | Pulsed |
| 8 | 0003.mp3 | 3 long pulses (600 ms on / 150 ms off) | Pulsed |
| 9 | 0004.mp3 | Continuous | Continuous on |
| 10 | 0005.mp3 | Continuous | Flashing (400 ms) |

[DIAGRAM: Figure 10 — ESP32 IoT Alert Device Hardware Schematic | PROMPT: "Create a hardware wiring/schematic diagram for the SnoozeGuard ESP32 IoT Alert Device. Show an ESP32 DevKit V1 board in the center. Draw wired connections to: DFPlayer Mini module (connect ESP32 GPIO 16 to DFPlayer TX, GPIO 17 to DFPlayer RX, DFPlayer SPK+ and SPK- to a small speaker symbol). Buzzer symbol connected to GPIO 26 and GND. LED symbol (labeled 'Alert LED 1') connected to GPIO 27 via 220-ohm resistor to GND. LED symbol (labeled 'Alert LED 2') connected to GPIO 32 via 220-ohm resistor to GND. LED symbol (labeled 'BLE Status LED') connected to GPIO 33 via 220-ohm resistor to GND. Push button (labeled 'Dismiss Button') connected between GPIO 25 and GND with a pull-up indication. 5V power supply connected to VIN and GND. Add a small MicroSD card icon near the DFPlayer. Use standard electronics schematic style with clean white background, component labels, professional academic quality."]

[DIAGRAM: Figure 11 — MQTT Communication Topology | PROMPT: "Create a network topology diagram showing the MQTT communication architecture for SnoozeGuard. Draw these nodes: Mobile Phone labeled 'React Native App (Driver)' on the left, a Cloud shape in the center labeled 'HiveMQ Cloud MQTT Broker (TLS port 8883)', an ESP32 board on the right labeled 'ESP32 IoT Alert Device'. Also show a server box labeled 'IoT API (Railway / Node.js + Hono)'. Draw labeled arrows: Mobile App → IoT API: 'POST /v1/iot/buzz (Bearer JWT)'. IoT API → MQTT Broker: 'PUBLISH snoozeguard/commands/{device_id}'. MQTT Broker → ESP32: 'SUBSCRIBE snoozeguard/commands/{device_id}'. ESP32 → MQTT Broker: 'PUBLISH snoozeguard/dismiss/{device_id}' and 'PUBLISH snoozeguard/ping/{device_id}'. MQTT Broker → IoT API: 'Message routing (dismiss events)'. Add a dashed arrow from Mobile App to ESP32 labeled 'BLE Fallback (when WiFi unavailable)'. Clean white background, cloud shapes in light blue, server boxes in navy, professional academic diagram style."]

---

## Emergency Notification System

At drowsiness levels 9 and 10, a 120-second countdown begins in the mobile application (30 seconds in the web dashboard). If the driver does not dismiss the alert within this window, the emergency notification pipeline executes the following sequence. First, the driver's current GPS coordinates are captured if location permission has been granted. Second, an `emergency_alert_events` record is inserted into Supabase with status "active." Third, the active emergency contact's Expo push token is retrieved from the `push_tokens` table and an Expo Push notification is dispatched to the guardian's device. Fourth, if SMS notifications are enabled in the admin configuration and the rate limit has not been reached, a POST request is sent to the Supabase Edge Function (`dynamic-worker`), which calls the PhilSMS API with the emergency contact's phone number, the driver's name, and the GPS location. PhilSMS delivers the message through Philippine telecommunications carriers.

The emergency contact can view the driver's alert location on the `EmergencyAlertMapScreen`, which shows a map centered on the reported coordinates. A multi-contact model allows the driver to maintain multiple registered guardians; the contact with `is_active = 1` in the `emergency_contacts_local` table is the one that receives notifications.

---

## Testing and Evaluation

Testing of the SnoozeGuard system was conducted at three levels throughout the iterative development process. Unit testing was applied to the drowsiness scoring algorithm (`computeLevelFromAlertMap()`), the offline sync logic, and the CSV data parser for the evaluation instrument. Integration testing covered the end-to-end alert pipeline from detection through IoT command delivery, the emergency notification pipeline from countdown expiry through push and SMS delivery, and the offline-to-online synchronization from SQLite write through Supabase upsert. End-to-end system testing was conducted using the physical driving simulator prototype, with a team member simulating drowsiness behaviors — deliberate yawning, head nodding, and head tilting — while the complete system response was observed, including IoT device output and emergency contact notification delivery.

The formal evaluation used a structured 66-item Likert-scale questionnaire aligned with the ISO/IEC 25010 software product quality standard. Each item was rated on a 5-point scale from 1 (Strongly Disagree) to 5 (Strongly Agree). Weighted mean scores were computed per characteristic and interpreted according to the scale presented in Table 7 (Chapter IV). The questionnaire was administered after respondents had interacted with the system through the driving simulator prototype, ensuring that responses reflected genuine system experience rather than theoretical assessment.

---

## Participants of the Study

The participants of this study were selected through **purposive sampling** based on two primary criteria: active driving experience and availability to attend a system demonstration session. Purposive sampling was employed because the ISO/IEC 25010 evaluation required respondents with genuine driving experience who could meaningfully assess the system's drowsiness detection accuracy, alert response appropriateness, and usability during a simulated driving context. Convenience sampling was not used because it would not guarantee that respondents possessed the driving background necessary to evaluate a drowsiness monitoring system with informed judgment.

A total of thirty (30) respondents participated in the evaluation, of whom twenty-nine (29) provided complete responses that were used in the weighted mean analysis. The age range of named respondents was 22 to 56 years, with the majority falling in the 22 to 25 age bracket. Occupations represented included students, fresh graduates, a junior automation engineer, a junior architect, and a self-employed individual, providing a diverse cross-section of perspectives on the system's usability and practical value. The profile of respondents is summarized in the following table.

| Profile Attribute | Description |
|-------------------|-------------|
| Total respondents | 30 (29 with complete responses) |
| Age range | 22–56 years old |
| Sampling method | Purposive sampling |
| Basis for selection | Active driving experience; availability for system demonstration |
| Evaluation context | Physical driving simulator; live system demonstration |
| Instrument | 66-item ISO/IEC 25010 Likert-scale questionnaire |

---

## Implementation Plan

The implementation of SnoozeGuard was carried out in accordance with the phased plan described in the Gantt Chart section. Table 7 below summarizes the key implementation activities and their completion dates.

| Activity | Completion Date | Status |
|----------|----------------|--------|
| Requirements analysis and system architecture design | January 31, 2025 | Completed |
| User authentication and session management (mobile) | February 10, 2025 | Completed |
| Face detection, drowsiness scoring, and alert engine (mobile) | February 28, 2025 | Completed |
| Emergency contact registration and notification pipeline | February 28, 2025 | Completed |
| Web dashboard — Drive screen and analytics | March 15, 2025 | Completed |
| IoT firmware — MQTT, BLE, DFPlayer, GPIO dismiss | March 20, 2025 | Completed |
| IoT ingest API — buzz, dismiss, ping, telemetry endpoints | March 20, 2025 | Completed |
| Offline-first SQLite sync and multi-contact EC model | March 31, 2025 | Completed |
| Physical driving simulator prototype construction | March 30, 2025 | Completed |
| Integration and end-to-end system testing | March 31, 2025 | Completed |
| ISO/IEC 25010 evaluation survey administration | April 15, 2025 | Completed |
| Data analysis and weighted mean computation | April 23, 2025 | Completed |
| Thesis documentation | April 30, 2025 | Completed |

---

# CHAPTER IV: Results and Discussion

## Overview

This chapter presents the results of the study in two parts. The first part presents the system output of SnoozeGuard through screenshots and descriptions of each major screen and feature of the developed system. The second part presents the results of the ISO/IEC 25010 software quality evaluation conducted by twenty-nine (29) respondents who interacted with the complete system through the physical driving simulator prototype. Weighted means were computed per quality characteristic and interpreted using the scale shown in Table 7.



**Table 7. Weighted Mean Interpretation Scale**

| Weighted Mean Range | Verbal Interpretation |
|---------------------|-----------------------|
| 4.50 – 5.00 | Excellent |
| 3.50 – 4.49 | Very Satisfactory |
| 2.50 – 3.49 | Satisfactory |
| 1.50 – 2.49 | Poor |
| 1.00 – 1.49 | Very Poor |

## Respondent Profile

Thirty respondents participated in the evaluation. All respondents were given access to the complete SnoozeGuard system — the mobile application, web dashboard, and IoT alert device — during a controlled evaluation session. The demographic profile is presented below.

**Table 8. Distribution of Respondents by Experience Level with Mobile Applications**

| Experience Level | Frequency | Percentage |
|------------------|-----------|------------|
| Beginner | 7 | 24.14% |
| Intermediate | 15 | 51.72% |
| Advanced | 7 | 24.14% |
| **Total** | **29** | **100%** |

The respondents represented a cross-section of mobile application experience levels. The majority (51.72%) identified as Intermediate users, while Beginner and Advanced users each comprised approximately 24% of the sample. The age range of named respondents was 22 to 56 years, with most falling in the 22–25 age bracket, reflecting a sample predominantly composed of young adult drivers and students. Occupations included students, fresh graduates, a junior automation engineer, a junior architect, and a self-employed individual, providing diverse perspectives on the system's usability and practicality.

## Presentation of System Output

This section presents the actual output of the SnoozeGuard system through annotated screenshots of each major screen and functional module. The screenshots were captured from the deployed Android mobile application (Expo SDK 54), the React/Vite web dashboard, and the ESP32 IoT alert device during an actual system operation session using the physical driving simulator prototype.

### Login and Authentication

The Login screen is the entry point of the SnoozeGuard mobile application. It presents two authentication options: email-and-password login and Google Sign-In via OAuth 2.0. Upon successful authentication, the user is routed to the Home screen. If no internet connection is available, the system falls back to an offline session cached in local SQLite storage, allowing previously authenticated users to continue without re-entering credentials.

[DIAGRAM: Figure 12 — Login Screen | PROMPT: "A clean mobile app screenshot mockup for a driver drowsiness detection app called SnoozeGuard. Dark navy background (#0B1326). Shows a login screen with: SnoozeGuard logo/title at the top, an email input field, a password input field, a 'Sign In' button in blue, a 'Continue with Google' button with Google icon, and a 'Create Account' link at the bottom. Material Design 3 style, professional mobile UI."]

### Home Screen — Session Dashboard

The Home screen serves as the main dashboard of the application. It displays a summary of the driver's recent driving activity, including the total number of sessions recorded, the cumulative number of drowsiness events by type (yawns, head nods, head tilts, and brake events), and the Focus Score — a computed metric representing the driver's average attentiveness, calculated as the maximum of zero and the result of one hundred minus the product of the average drowsiness level and ten. Filter pills at the top of the screen allow the user to view summaries for the past 7 days, 30 days, 90 days, or all time. All data displayed is read from the local SQLite database, ensuring immediate availability regardless of network state.

[DIAGRAM: Figure 13 — Home Screen (Session Dashboard) | PROMPT: "A mobile app screenshot mockup for SnoozeGuard. Dark navy background. Home/Dashboard screen showing: a header with hamburger menu and 'SnoozeGuard' title, filter pills at top (7D, 30D, 90D, All Time), a large Focus Score circle showing '87' with label 'Focus Score', stat cards showing Total Sessions, Total Yawns (with yawn emoji), Total Nods (with sleep emoji), a Recent Sessions list with session rows showing date/time and drowsiness level. Material Design 3, dark navy theme, clean professional UI."]

### Drive Screen — Active Monitoring Session

The Drive screen is the core functional screen of the SnoozeGuard application. When a drive session is started, the screen displays a live camera preview from the front-facing camera, overlaid with the real-time drowsiness level indicator on a scale of 0 to 10, a session elapsed time counter, and running counts of yawn and head movement events detected in the current session. The MediaPipe Face Landmarker model processes camera frames every 600 milliseconds in the background. A prominent End Session button allows the driver to conclude monitoring at any time.

[DIAGRAM: Figure 14 — Drive Screen (Active Monitoring Session) | PROMPT: "A mobile app screenshot mockup for SnoozeGuard Drive Screen. Dark navy background. Shows: live camera preview area (front-facing, showing a person's face in a car), a large drowsiness level indicator showing '3' on a color-coded scale (green=low, yellow=medium, red=high), session timer showing '00:12:34', yawn count '2' and nod count '5' displayed as counters, a prominent red 'End Session' button at the bottom, a 'Monitoring Active' status indicator with a green dot. Material Design 3, dark theme, safety-oriented UI."]

### Drowsiness Alert Modal

When the computed drowsiness level meets or exceeds the administrator-configured trigger threshold and has not been previously dismissed in the current session, the system displays a full-screen alert modal. The modal shows the current alert level, the level label (e.g., Severe, Critical, Extreme), a 120-second countdown timer, and a clearly labeled Dismiss button. Simultaneously, the system executes the configured alert actions for the detected level — voice TTS, vibration, alarm audio, and IoT device commands. The driver must tap Dismiss or the countdown must expire before monitoring resumes.

[DIAGRAM: Figure 15 — Drowsiness Alert Modal | PROMPT: "A mobile app screenshot mockup for SnoozeGuard Alert Modal. Dark red/orange overlay on top of the drive screen. Shows a centered alert card with: a warning icon (triangle with exclamation), large text 'DROWSINESS DETECTED', level badge showing 'Level 8 — Severe' in red, a circular countdown timer showing '1:52' counting down from 2:00, text 'Emergency contact will be notified if not dismissed', a large green 'DISMISS' button, status text 'IoT Device Alerting...' with pulsing indicator. Urgent, safety-critical visual design, Material Design 3."]

### Analytics Screen

The Analytics screen provides a post-session and longitudinal view of the driver's drowsiness patterns. It displays a drowsiness trend line chart showing the maximum drowsiness level reached per session over the selected date range. A stability classification badge — labeled STABLE, MODERATE, or VOLATILE based on variance in session drowsiness levels — provides a quick summary of driving pattern consistency. An hourly activity block chart groups session data into six four-hour blocks, identifying the time-of-day periods with the highest drowsiness risk. Date range filter pills (7D, 30D, 90D, All Time) apply to all charts simultaneously. All data is sourced from the local SQLite database.

[DIAGRAM: Figure 16 — Analytics Screen | PROMPT: "A mobile app screenshot mockup for SnoozeGuard Analytics Screen. Dark navy background. Shows: filter pills (7D, 30D, 90D, All Time) at top, a 'STABLE' badge in green, a line chart showing drowsiness level over time (x-axis: dates, y-axis: levels 0-10) with a smooth blue line, a section labeled 'Hourly Risk Blocks' showing 6 colored blocks (00-04, 04-08, 08-12, 12-16, 16-20, 20-24) with varying colors indicating risk level, a legend. Clean data visualization, Material Design 3, dark theme."]

### Session History Screen

The History screen presents a scrollable chronological list of all driving sessions recorded in the local SQLite database. Each session row displays the session date and time, total duration, the peak drowsiness level reached, and the number of alert events triggered. Tapping a session row navigates to a session detail view showing the full drowsiness timeline for that session, event counts by type, and the GPS location if an emergency alert was triggered. A date range picker allows filtering the history to a specific period.

[DIAGRAM: Figure 17 — Session History Screen | PROMPT: "A mobile app screenshot mockup for SnoozeGuard History Screen. Dark navy background. Shows: a 'History' header, a date range picker bar at top, a scrollable list of session cards. Each card shows: session date/time (e.g., 'April 12, 2025 — 08:34 AM'), duration '1h 23m', peak drowsiness level badge (e.g., 'Level 4' in yellow), alert count '2 alerts', a small right arrow. Material Design 3, dark theme, clean list UI."]

### Emergency Contact Screen

The Emergency Contact screen allows the driver to manage their registered emergency guardians. The screen is divided into two tabs: My Guardian (which lists all registered emergency contacts with the currently active one highlighted, and provides options to add, edit, or remove contacts and set the active guardian) and I Protect (which shows a list of other SnoozeGuard users who have registered the current user as their emergency contact, with real-time online presence indicators showing which drivers are currently in an active session).

[DIAGRAM: Figure 18 — Emergency Contact Screen | PROMPT: "A mobile app screenshot mockup for SnoozeGuard Emergency Contact Screen. Dark navy background. Shows two tabs at top: 'My Guardian' (active) and 'I Protect'. Under My Guardian tab: a list of contacts, the first one highlighted with a green 'ACTIVE' badge showing name 'Juan Dela Cruz', phone '+63 912 345 6789', email, and 'Set Active' and 'Remove' action buttons. An 'Add Contact' button at the bottom. Professional contact management UI, Material Design 3, dark theme."]

### Alerts Map Screen

The Emergency Alert Map screen displays a map view of all alert events recorded in the current user's session history. Each alert is plotted as a location marker, color-coded by drowsiness level severity. Tapping a marker reveals a detail card showing the session date, time, drowsiness level, and the dismissal status of the alert. This screen is also the interface used by the emergency contact to view the driver's last known location when an emergency notification is received.

[DIAGRAM: Figure 19 — Emergency Alert Map Screen | PROMPT: "A mobile app screenshot mockup for SnoozeGuard Alert Map Screen. Shows a Google Maps-style map view with several colored marker pins on Philippine roads. A selected marker shows a popup card with: 'Level 9 — Critical', date 'April 12, 2025 08:34 AM', 'Driver: Self', 'Status: Dismissed'. Map has dark style tiles. Navigation bar at bottom with map icon active. Safety app, Material Design 3 UI."]

### Admin Configuration Screen

The Admin Configuration screen is accessible only to users with the super_admin role. It provides controls for modifying the system-wide operational parameters stored in the Supabase admin_config table. Configuration fields include the drowsiness trigger level (the minimum level that causes the alert modal to appear), the score reset interval in minutes, SMS notification toggle, and the full alert map configuration showing the yawn count and head count thresholds and the associated actions for each of the ten drowsiness levels. All changes are applied through the update_admin_config SECURITY DEFINER RPC function, ensuring that no direct table writes bypass the role authorization check.

[DIAGRAM: Figure 20 — Admin Configuration Screen | PROMPT: "A mobile app screenshot mockup for SnoozeGuard Admin Config Screen. Dark navy background. Shows: 'Admin Configuration' header with a shield icon, a settings form with labeled fields: 'Trigger Level' (number input showing '5'), 'Score Reset (minutes)' (input showing '2'), 'SMS Notifications' toggle (ON), a section 'Alert Map Configuration' showing a collapsible table of 10 levels (Level 1-10) each with yawn threshold, head threshold, and actions columns. A 'Save Configuration' button at the bottom in blue. Professional admin panel UI, Material Design 3, dark theme."]

### Web Dashboard — Drive Screen

The SnoozeGuard web dashboard provides an equivalent drowsiness monitoring experience accessible from any desktop or tablet browser. The web Drive screen mirrors the mobile Drive screen in layout and functionality, using the MediaPipe Face Landmarker WASM model running in VIDEO mode at approximately 130-millisecond intervals. When a drowsiness alert fires, a full-screen overlay appears with a 30-second countdown (shorter than the mobile countdown of 120 seconds, reflecting the higher-attention context of a browser-based simulation). The web dashboard is deployed on Firebase Hosting and requires only a browser — no installation is needed.

[DIAGRAM: Figure 21 — Web Dashboard: Drive Screen | PROMPT: "A web browser screenshot mockup for the SnoozeGuard web dashboard. Shows a dark navy browser window. Left sidebar navigation with icons (Home, Drive, Analytics, Alerts, IoT Devices). Main content area shows Drive screen: a large camera preview rectangle showing a person's face, drowsiness level meter showing '2' on a 0-10 scale with color gradient, session elapsed time '00:08:21', yawn count and nod count badges, an 'End Session' button. Clean modern React web UI, Material Design 3 color scheme, dark navy theme."]

### IoT Alert Device — Physical Prototype

The ESP32 IoT alert device is the physical hardware peripheral of the SnoozeGuard system. The device is housed in a compact enclosure suitable for dashboard or visor mounting. The front panel features three LED indicators — a primary alert LED, a secondary alert LED, and a BLE status LED — and a clearly labeled physical dismiss button. The internal components include the ESP32 DevKit V1 board, DFPlayer Mini MP3 module connected to a speaker, and a buzzer module. The device connects to the mobile application and cloud backend through WiFi (MQTT over TLS) as the primary channel, with Bluetooth Low Energy as a fallback.

[DIAGRAM: Figure 22 — IoT Alert Device: Physical Prototype | PROMPT: "A product photography style illustration of the SnoozeGuard ESP32 IoT Alert Device. Show a small rectangular black electronics enclosure (roughly 10cm x 7cm x 4cm) with: 3 LED indicator lights on the front panel (labeled Alert LED 1, Alert LED 2, BLE Status), a round push button labeled 'DISMISS' in white text, a small speaker grille on the side, a USB-C power port. The device is shown mounted on a car dashboard with double-sided tape. The SnoozeGuard logo is on the front. Professional product render style, clean white background with subtle shadow."]

## ISO/IEC 25010 Evaluation Results

### Functional Suitability

Functional Suitability evaluates the degree to which the system provides functions that meet stated and implied needs under specified conditions. Thirteen (13) items assessed three sub-characteristics: Functional Completeness, Functional Correctness, and Functional Appropriateness.

**Table 9. Functional Suitability — Item Means**

| # | Indicator | WM | Interpretation |
|---|-----------|-----|----------------|
| Q1 | The system successfully detects yawning as a sign of driver drowsiness in real time. | 4.31 | Very Satisfactory |
| Q2 | The system successfully detects head nodding and head movement events. | 4.14 | Very Satisfactory |
| Q3 | The system alerts the driver when the drowsiness level reaches the configured threshold. | 4.17 | Very Satisfactory |
| Q4 | The system sends emergency notifications (push/SMS) to the emergency contact at critical drowsiness levels. | 4.10 | Very Satisfactory |
| Q5 | The IoT alert device responds with audio, vibration, and LED alerts when triggered by the system. | 3.90 | Very Satisfactory |
| Q6 | The system records and stores driving session data for review. | 4.03 | Very Satisfactory |
| Q7 | The drowsiness level displayed correctly reflects the driver's observable fatigue state. | 4.24 | Very Satisfactory |
| Q8 | Alert notifications are sent to the correct emergency contact. | 3.97 | Very Satisfactory |
| Q9 | Session history and analytics data accurately reflect the recorded driving sessions. | 4.00 | Very Satisfactory |
| Q10 | The IoT device dismisses the alert correctly when the physical dismiss button is pressed. | 3.79 | Very Satisfactory |
| Q11 | The graduated 10-level drowsiness scoring model appropriately reflects the severity of fatigue. | 3.90 | Very Satisfactory |
| Q12 | The escalating alert responses (voice, vibration, alarm, IoT device) are appropriate to the drowsiness level. | 4.07 | Very Satisfactory |
| Q13 | The 120-second countdown before emergency notification provides sufficient time for the driver to self-dismiss. | 4.07 | Very Satisfactory |
| | **Functional Completeness (Q1–Q6)** | **4.11** | **Very Satisfactory** |
| | **Functional Correctness (Q7–Q10)** | **4.00** | **Very Satisfactory** |
| | **Functional Appropriateness (Q11–Q13)** | **4.01** | **Very Satisfactory** |
| | **Functional Suitability (Overall)** | **4.05** | **Very Satisfactory** |

**Discussion.** The Functional Suitability characteristic received an overall weighted mean of **4.05**, interpreted as *Very Satisfactory*. The highest-rated item was yawn detection in real time (WM = 4.31), reflecting the system's strong performance in detecting the primary drowsiness signal via MediaPipe Face Landmarker at a jaw-open threshold of ≥ 0.70. Head movement detection (WM = 4.14) and threshold-based alerting (WM = 4.17) also scored favorably. The lowest-rated item in this characteristic was IoT dismiss button functionality (WM = 3.79), which respondents noted can be affected by MQTT connectivity conditions. Overall, Functional Completeness (WM = 4.11) slightly outperformed Functional Correctness (WM = 4.00) and Functional Appropriateness (WM = 4.01), indicating that the system successfully implements its intended feature set.

### Performance Efficiency

Performance Efficiency measures the relationship between system performance and the resources used under stated conditions. Seven (7) items assessed Time Behavior and Resource Utilization.

**Table 10. Performance Efficiency — Item Means**

| # | Indicator | WM | Interpretation |
|---|-----------|-----|----------------|
| Q14 | The system detects yawning and head movement events with minimal perceptible delay. | 4.34 | Very Satisfactory |
| Q15 | The alert modal appears promptly when the drowsiness threshold is reached. | 3.93 | Very Satisfactory |
| Q16 | The IoT alert device responds within an acceptable time after a drowsiness event is detected. | 4.38 | Very Satisfactory |
| Q17 | The emergency notification is delivered to the emergency contact's device promptly. | 4.41 | Very Satisfactory |
| Q18 | The application runs smoothly on the test smartphone without causing noticeable lag or freezing. | 4.21 | Very Satisfactory |
| Q19 | The application does not cause excessive heating of the smartphone during a drive session. | 3.79 | Very Satisfactory |
| Q20 | Battery consumption during a monitoring session is at an acceptable level. | 3.69 | Very Satisfactory |
| | **Time Behavior (Q14–Q17)** | **4.27** | **Very Satisfactory** |
| | **Resource Utilization (Q18–Q20)** | **3.90** | **Very Satisfactory** |
| | **Performance Efficiency (Overall)** | **4.11** | **Very Satisfactory** |

**Discussion.** Performance Efficiency was the highest-rated characteristic overall (WM = **4.11**). Emergency notification delivery received the highest single-item mean in this section (WM = 4.41), demonstrating that the PhilSMS and Supabase push notification pipeline performs reliably within acceptable time bounds. IoT device response time (WM = 4.38) and detection latency (WM = 4.34) were also rated highly, reflecting the effectiveness of the MQTT HiveMQ TLS pipeline with BLE fallback. Resource utilization received relatively lower scores for heating (WM = 3.79) and battery consumption (WM = 3.69), which is expected given the continuous camera-based inference load on a mobile device. These resource constraints are an acknowledged trade-off of on-device real-time ML processing.

### Compatibility

Compatibility measures the degree to which the system can perform its functions while sharing an environment and resources with other systems. Five (5) items assessed Co-existence and Interoperability.

**Table 11. Compatibility — Item Means**

| # | Indicator | WM | Interpretation |
|---|-----------|-----|----------------|
| Q21 | The application runs alongside other smartphone apps (navigation, music) without conflicts. | 4.00 | Very Satisfactory |
| Q22 | The IoT device operates without interfering with other Bluetooth devices in the environment. | 3.79 | Very Satisfactory |
| Q23 | The mobile application successfully connects and communicates with the IoT alert device. | 4.28 | Very Satisfactory |
| Q24 | Session data is synchronized correctly between the mobile app and the cloud backend. | 3.83 | Very Satisfactory |
| Q25 | The web dashboard correctly reflects the same session data as the mobile application. | 4.21 | Very Satisfactory |
| | **Co-existence (Q21–Q22)** | **3.90** | **Very Satisfactory** |
| | **Interoperability (Q23–Q25)** | **4.10** | **Very Satisfactory** |
| | **Compatibility (Overall)** | **4.02** | **Very Satisfactory** |

**Discussion.** The Compatibility characteristic received an overall weighted mean of **4.02**, interpreted as *Very Satisfactory*. Mobile-to-IoT connection and communication (WM = 4.28) and web dashboard data consistency (WM = 4.21) received the strongest ratings, indicating effective cross-platform data synchronization between the mobile application (Expo), cloud backend (Supabase), and web dashboard (Firebase). The slightly lower score for Bluetooth non-interference (WM = 3.79) may reflect variability in environments with dense BLE activity, a known characteristic of ESP32 BLE operation.

### Usability

Usability evaluates the degree to which the system can be used with effectiveness, efficiency, and satisfaction by specified users to achieve specified goals. Twelve (12) items assessed Appropriateness Recognizability, Learnability, Operability, and User Interface Aesthetics.

**Table 12. Usability — Item Means**

| # | Indicator | WM | Interpretation |
|---|-----------|-----|----------------|
| Q26 | The purpose of the SnoozeGuard system is immediately clear from the application interface. | 3.90 | Very Satisfactory |
| Q27 | The drowsiness level indicator clearly communicates the driver's current fatigue state. | 3.69 | Very Satisfactory |
| Q28 | First-time users can start a monitoring session without requiring external assistance. | 3.62 | Very Satisfactory |
| Q29 | The process of setting up an emergency contact is easy to understand and complete. | 3.86 | Very Satisfactory |
| Q30 | The pairing process for the IoT alert device is straightforward. | 4.21 | Very Satisfactory |
| Q31 | Navigating between screens (Home, Analytics, Drive, Alerts, History) is intuitive. | 3.86 | Very Satisfactory |
| Q32 | Dismissing a drowsiness alert requires minimal interaction while in the driving position. | 4.00 | Very Satisfactory |
| Q33 | The dark/light theme option improves the usability of the application under different lighting conditions. | 4.00 | Very Satisfactory |
| Q34 | The system prevents accidental termination of an active drive session. | 3.93 | Very Satisfactory |
| Q35 | The system provides appropriate feedback when actions fail (e.g., network unavailable). | 3.69 | Very Satisfactory |
| Q36 | The visual design of the application is clean, organized, and professional. | 4.00 | Very Satisfactory |
| Q37 | The color scheme and typography are appropriate for a safety-oriented application. | 4.07 | Very Satisfactory |
| | **Appropriateness Recognizability (Q26–Q27)** | **3.79** | **Very Satisfactory** |
| | **Learnability (Q28–Q30)** | **3.90** | **Very Satisfactory** |
| | **Operability (Q31–Q35)** | **3.90** | **Very Satisfactory** |
| | **User Interface Aesthetics (Q36–Q37)** | **4.03** | **Very Satisfactory** |
| | **Usability (Overall)** | **3.90** | **Very Satisfactory** |

**Discussion.** Usability received the second-lowest overall weighted mean of **3.90**, though it remains squarely within the *Very Satisfactory* range. The lowest-rated items were Q27 — clarity of the drowsiness level indicator (WM = 3.69) and Q28 — first-time user onboarding without assistance (WM = 3.62). This finding highlights an opportunity to improve the visual representation of drowsiness states, particularly for users unfamiliar with 10-level scoring systems. IoT pairing intuitiveness (WM = 4.21) was notably high within this characteristic, indicating that the device pairing flow was well-designed. Visual design aesthetics received consistent scores (Q36 = 4.00, Q37 = 4.07), affirming that the dark-navy Material Design 3 interface communicates a safety-appropriate aesthetic.

### Reliability

Reliability measures the degree to which the system performs specified functions under specified conditions for a specified period of time. Nine (9) items assessed Maturity, Fault Tolerance, and Recoverability.

**Table 13. Reliability — Item Means**

| # | Indicator | WM | Interpretation |
|---|-----------|-----|----------------|
| Q38 | The face detection engine consistently detects the driver's face throughout a monitoring session. | 3.76 | Very Satisfactory |
| Q39 | The system does not crash or terminate unexpectedly during normal operation. | 3.62 | Very Satisfactory |
| Q40 | Alert events are reliably recorded and retained across sessions. | 3.59 | Very Satisfactory |
| Q41 | The system begins monitoring quickly after launching the Drive screen. | 3.79 | Very Satisfactory |
| Q42 | The system continues to function in offline mode (without internet connectivity). | 4.28 | Very Satisfactory |
| Q43 | When the IoT device is not connected, the mobile app continues to function and alert normally. | 4.07 | Very Satisfactory |
| Q44 | Session data recorded offline is successfully synchronized when connectivity is restored. | 4.31 | Very Satisfactory |
| Q45 | Previously recorded sessions are retained and accessible after an application restart. | 3.90 | Very Satisfactory |
| Q46 | Authentication state is preserved across app restarts (no repeated login required). | 3.90 | Very Satisfactory |
| | **Maturity (Q38–Q40)** | **3.66** | **Very Satisfactory** |
| | **Fault Tolerance (Q41–Q43)** | **4.05** | **Very Satisfactory** |
| | **Recoverability (Q44–Q46)** | **4.03** | **Very Satisfactory** |
| | **Reliability (Overall)** | **3.91** | **Very Satisfactory** |

**Discussion.** Reliability received a weighted mean of **3.91**, the lowest of all eight characteristics, though still *Very Satisfactory*. The Maturity sub-characteristic received the lowest scores in the entire evaluation: Q40 — reliable alert event recording (WM = 3.59), Q39 — system stability (WM = 3.62), and Q38 — face detection consistency (WM = 3.76). These reflect the inherent challenges of continuous camera-based inference under varied lighting conditions and device resource constraints. In contrast, Recoverability (WM = 4.03) and Fault Tolerance (WM = 4.05) were rated substantially higher, affirming that the SQLite offline-first architecture and BLE fallback for IoT alerts function effectively. Offline operation (WM = 4.28) and offline data synchronization (WM = 4.31) were the highest-rated reliability indicators, validating the system's offline-first design philosophy.

### Security

Security evaluates the degree to which the system protects information and data so that individuals, organizations, and other systems have access only to the degree appropriate to their type and level of authorization. Six (6) items assessed Confidentiality, Integrity, and Authenticity.

**Table 14. Security — Item Means**

| # | Indicator | WM | Interpretation |
|---|-----------|-----|----------------|
| Q47 | I am confident that my driving session data is stored securely and not accessible to unauthorized parties. | 4.10 | Very Satisfactory |
| Q48 | The system does not share my personal information without my consent. | 3.83 | Very Satisfactory |
| Q49 | Session records cannot be altered or deleted by unauthorized users. | 3.93 | Very Satisfactory |
| Q50 | Administrator configuration changes require appropriate credentials and authorization. | 4.10 | Very Satisfactory |
| Q51 | The login process (email/password or Google sign-in) securely verifies user identity. | 4.34 | Very Satisfactory |
| Q52 | Only authorized users (with proper credentials) can access the system. | 3.93 | Very Satisfactory |
| | **Confidentiality (Q47–Q48)** | **3.97** | **Very Satisfactory** |
| | **Integrity (Q49–Q50)** | **4.02** | **Very Satisfactory** |
| | **Authenticity (Q51–Q52)** | **4.14** | **Very Satisfactory** |
| | **Security (Overall)** | **4.04** | **Very Satisfactory** |

**Discussion.** The Security characteristic received a weighted mean of **4.04**, interpreted as *Very Satisfactory*. The highest-scoring item was Q51 — login process security (WM = 4.34), reflecting respondent confidence in the Supabase Auth implementation supporting both email/password and Google OAuth sign-in. Administrator credential enforcement (WM = 4.10) and secure session data storage (WM = 4.10) also scored well. The SECURITY DEFINER RPC pattern for admin configuration changes, which enforces role-based authorization at the database level, appears to have communicated trustworthiness to evaluators. The lowest score in this characteristic, Q48 — no sharing without consent (WM = 3.83), suggests that some respondents were uncertain about data handling, pointing to an opportunity to improve in-app privacy communication.

### Maintainability

Maintainability evaluates the degree to which the system can be modified to improve, correct, or adapt to changes in the environment and requirements. Six (6) items assessed Modularity, Analysability, and Modifiability.

**Table 15. Maintainability — Item Means**

| # | Indicator | WM | Interpretation |
|---|-----------|-----|----------------|
| Q53 | Individual system components (mobile app, IoT device, API, backend) can be updated independently. | 4.17 | Very Satisfactory |
| Q54 | The drowsiness alert thresholds can be adjusted without modifying the application code (via admin configuration). | 3.90 | Very Satisfactory |
| Q55 | Session analytics provide sufficient information to identify patterns in drowsiness occurrence. | 4.17 | Very Satisfactory |
| Q56 | The system provides clear feedback that helps identify the cause of any alert or system state. | 3.83 | Very Satisfactory |
| Q57 | The alert map configuration can be updated by an administrator without disrupting system operation. | 3.97 | Very Satisfactory |
| Q58 | New emergency contacts can be added or changed without requiring a system update. | 3.83 | Very Satisfactory |
| | **Modularity (Q53–Q54)** | **4.03** | **Very Satisfactory** |
| | **Analysability (Q55–Q56)** | **4.00** | **Very Satisfactory** |
| | **Modifiability (Q57–Q58)** | **3.90** | **Very Satisfactory** |
| | **Maintainability (Overall)** | **3.98** | **Very Satisfactory** |

**Discussion.** Maintainability received a weighted mean of **3.98**, interpreted as *Very Satisfactory*. Independent component updatability (WM = 4.17) was the highest-rated item, affirming that the microservice architecture — with the mobile app deployed via Expo EAS OTA, the IoT firmware updated independently, and the backend managed through Supabase — enables isolation of changes. Analytics pattern identification (WM = 4.17) also scored well, indicating that the multi-chart analytics screen effectively surfaces drowsiness trends. The lowest-scoring items were Q56 — clear feedback on alert causes (WM = 3.83) and Q58 — emergency contact changes without an app update (WM = 3.83), suggesting targeted improvements to in-app feedback messaging and contact management flows.

### Portability

Portability evaluates the effectiveness and efficiency with which the system can be transferred from one hardware, software, or operational environment to another. Six (6) items assessed Adaptability, Installability, and Replaceability.

**Table 16. Portability — Item Means**

| # | Indicator | WM | Interpretation |
|---|-----------|-----|----------------|
| Q59 | The mobile application functions correctly across different Android device models. | 4.31 | Very Satisfactory |
| Q60 | The web dashboard is accessible and functional across different web browsers. | 3.97 | Very Satisfactory |
| Q61 | The system adapts appropriately to both indoor (low-light) and outdoor (high-light) monitoring conditions. | 3.93 | Very Satisfactory |
| Q62 | The mobile application is easy to install from the provided distribution link. | 4.03 | Very Satisfactory |
| Q63 | The IoT alert device can be set up and paired without requiring technical expertise. | 3.97 | Very Satisfactory |
| Q64 | If the application is reinstalled, previous data and settings can be restored. | 4.24 | Very Satisfactory |
| | **Adaptability (Q59–Q61)** | **4.07** | **Very Satisfactory** |
| | **Installability (Q62–Q63)** | **4.00** | **Very Satisfactory** |
| | **Replaceability (Q64)** | **4.24** | **Very Satisfactory** |
| | **Portability (Overall)** | **4.07** | **Very Satisfactory** |

**Discussion.** Portability received a weighted mean of **4.07**, the second-highest among all characteristics. Cross-device Android compatibility (WM = 4.31) received the highest single score within this section, reflecting effective use of the Expo managed workflow which abstracts Android version differences. Post-reinstall data restoration (WM = 4.24) scored highly, attributable to the Supabase cloud sync and auth state preservation mechanisms. The adaptability to lighting conditions (WM = 3.93) was the only item below 4.00 in this section, consistent with the face detection limitations under extreme low-light conditions that are noted throughout the literature.

## Summary of Weighted Means per ISO/IEC 25010 Characteristic

**Table 17. Summary of Weighted Means per ISO/IEC 25010 Characteristic**

| # | Quality Characteristic | No. of Items | Weighted Mean | Interpretation |
|---|------------------------|:------------:|:-------------:|----------------|
| 1 | Functional Suitability | 13 | 4.05 | Very Satisfactory |
| 2 | Performance Efficiency | 7 | 4.11 | Very Satisfactory |
| 3 | Compatibility | 5 | 4.02 | Very Satisfactory |
| 4 | Usability | 12 | 3.90 | Very Satisfactory |
| 5 | Reliability | 9 | 3.91 | Very Satisfactory |
| 6 | Security | 6 | 4.04 | Very Satisfactory |
| 7 | Maintainability | 6 | 3.98 | Very Satisfactory |
| 8 | Portability | 6 | 4.07 | Very Satisfactory |
| | **Grand Mean** | **64** | **4.01** | **Very Satisfactory** |

The evaluation of SnoozeGuard across all eight ISO/IEC 25010 quality characteristics produced a **Grand Mean of 4.01**, interpreted as ***Very Satisfactory***. All eight characteristics fell within the 3.50–4.49 range, confirming consistent performance across the entire quality framework. Performance Efficiency (WM = 4.11) and Portability (WM = 4.07) were the strongest-performing characteristics, while Usability (WM = 3.90) and Reliability (WM = 3.91) were the lowest, though both remained squarely in the Very Satisfactory band.

## Overall User Satisfaction

Beyond the eight ISO characteristics, two items captured overall user satisfaction with the system:

**Table 18. Overall Satisfaction Items**

| # | Indicator | WM | Interpretation |
|---|-----------|-----|----------------|
| Q65 | Overall, SnoozeGuard is an effective tool for real-time driver drowsiness monitoring. | 3.90 | Very Satisfactory |
| Q66 | I would recommend SnoozeGuard as a practical road safety aid for drivers. | 4.17 | Very Satisfactory |
| | **Overall Satisfaction** | **4.03** | **Very Satisfactory** |

A weighted mean of **4.03** for overall satisfaction affirms that respondents viewed SnoozeGuard as an effective and recommendable road safety tool. The recommendation score (WM = 4.17) exceeding the effectiveness score (WM = 3.90) suggests that even respondents who perceived individual limitations still found the system compelling enough to endorse to others, which is a strong indicator of practical value.

## Qualitative Feedback

The open-ended items — "What features did you find most useful?" and "What improvements would you suggest?" — yielded the following thematic responses from the ten named respondents who provided qualitative feedback.

**Most Useful Features Cited:**
- Drowsiness detection and monitoring functions (cited by multiple respondents)
- The driving simulator prototype and physical interaction model
- The IoT alert sensor and its responsive feedback
- The alert system escalation mechanism
- Real-time drowsiness level display

**Improvement Suggestions:**
- Address camera detection inconsistencies under varied conditions
- Improve user interface clarity, particularly the drowsiness level indicator
- Enhance the web application features and interface
- Streamline first-time onboarding for non-technical users

These qualitative observations are consistent with the quantitative findings: respondents valued the core detection and alert pipeline most highly, while usability and reliability maturity represented the primary areas for future improvement.

## Chapter Summary

This chapter presented the ISO/IEC 25010 software quality evaluation of the SnoozeGuard system based on responses from twenty-nine (29) respondents. All eight quality characteristics achieved a *Very Satisfactory* rating, with a grand mean of **4.01**. The system demonstrated strongest performance in Performance Efficiency (WM = 4.11) and Portability (WM = 4.07), affirming the effectiveness of the MQTT-based IoT pipeline, offline-first SQLite architecture, and cross-platform deployment strategy. Areas identified for future development include reliability maturity — specifically face detection consistency and system stability under sustained load — and usability improvements to alert visualization and first-time user onboarding. Overall, the evaluation confirms that SnoozeGuard meets the quality standards expected of a research-grade safety-critical application and provides a sound foundation for continued development toward production deployment.

---

# CHAPTER V: Summary, Conclusions, and Recommendations

## Summary

This study developed SnoozeGuard, a multi-platform AI-driven real-time drowsiness monitoring and alert system for road safety. The system addresses the critical gap in affordable, deployable driver fatigue detection for the vehicle fleets of developing economies where factory-integrated Driver Monitoring Systems are absent.

The core detection engine leverages Google's MediaPipe Face Landmarker model—processing 478 facial landmarks and 52 blend shape coefficients—to extract four drowsiness signals from the driver's smartphone front-facing camera: yawn events (detected via the `jawOpen` blend shape), head nodding events (detected via pitch and roll thresholds), sustained head tilt (detected over a 10-second window), and sudden braking events (detected via accelerometer delta threshold). These signals are fused through a configurable administrator-controlled alert map to compute a graduated drowsiness level from 0 to 10.

Alert escalation is graduated and multi-modal: lower-level alerts trigger smartphone-native responses (text-to-speech, vibration, alarm audio); at levels 6 and above, a paired ESP32 IoT alert device receives commands via MQTT (HiveMQ Cloud TLS 8883) or BLE fallback and executes level-specific patterns—three distinct pulse patterns for levels 6–8 and continuous alerts for levels 9–10—using DFPlayer Mini audio, a buzzer, and LED indicators. A physical dismiss button on the IoT device integrates with the same dismiss logic used by the mobile and web interfaces.

At the critical threshold (levels 9–10), a 120-second countdown (30 seconds on web) precedes automatic emergency notification delivery: an Expo push notification and optional SMS (via Supabase Edge Function) are sent to the driver's designated active emergency contact. The emergency contact can view the driver's location and respond via the EmergencyAlertMapScreen.

An offline-first architecture using local SQLite storage with background Supabase cloud synchronization ensures uninterrupted session recording and data integrity under intermittent network conditions. The system supports multi-contact emergency contact management, real-time presence indicators, a light/dark theme, analytics dashboards with stability classification, and a configurable admin interface.

The system was evaluated against the ISO/IEC 25010 software product quality model by twenty-nine (29) respondents, yielding a Grand Mean of 4.01 across all eight quality characteristics, interpreted as Very Satisfactory.

## Conclusions

Based on the results of the study, the following conclusions are drawn:

1. A smartphone-camera-based drowsiness detection system using MediaPipe Face Landmarker can reliably detect multiple physiological indicators of driver fatigue—including yawning, head nodding, sustained head tilt, and sudden deceleration—in real time on consumer Android hardware, without requiring specialized vehicle equipment or body-worn sensors.

2. A graduated 10-level drowsiness scoring model, configurable via an administrator-controlled alert map, provides a flexible and proportional framework for escalating alert responses that avoids the false-alarm fatigue associated with binary threshold approaches.

3. An ESP32-based IoT alert peripheral with MQTT primary communication and BLE fallback successfully extends the alert modality beyond the smartphone screen, delivering level-calibrated audio, vibration, and LED responses that augment the driver's awareness of fatigue onset across the critical levels 6–10.

4. The closed-loop emergency notification pipeline—combining Expo push notifications, SMS, and real-time location sharing—provides meaningful guardian response capability that is absent from existing smartphone DMS applications.

5. An offline-first SQLite-based storage architecture with Supabase background synchronization ensures continuous session recording and data availability regardless of network connectivity, addressing a practical deployment constraint in areas with intermittent cellular service.

6. SnoozeGuard achieves a Grand Mean of 4.01 (Very Satisfactory) across all eight ISO/IEC 25010 quality characteristics, with all individual characteristics falling within the Very Satisfactory range (3.50–4.49), demonstrating satisfactory software quality as a functional prototype suitable for further field validation.

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

---

**CART JEUIEL T. AGNO**

*[Photo placeholder]*

**Personal Information**
- Date of Birth: _______________
- Address: _______________
- Contact Number: _______________
- Email: _______________

**Educational Background**

| Year | Degree / Program | School |
|------|-----------------|--------|
| 2025 (expected) | Bachelor of Science in Computer Engineering | Divine Word College of Calapan |
| | Senior High School | _______________ |
| | Junior High School | _______________ |

**Awards and Recognition**
- _______________

---

**AIRA MAE T. PILOR**

*[Photo placeholder]*

**Personal Information**
- Date of Birth: _______________
- Address: _______________
- Contact Number: _______________
- Email: _______________

**Educational Background**

| Year | Degree / Program | School |
|------|-----------------|--------|
| 2025 (expected) | Bachelor of Science in Computer Engineering | Divine Word College of Calapan |
| | Senior High School | _______________ |
| | Junior High School | _______________ |

**Awards and Recognition**
- _______________

---

**CHRISTIAN EDUARD B. YLAGAN JR.**

*[Photo placeholder]*

**Personal Information**
- Date of Birth: _______________
- Address: _______________
- Contact Number: _______________
- Email: _______________

**Educational Background**

| Year | Degree / Program | School |
|------|-----------------|--------|
| 2025 (expected) | Bachelor of Science in Computer Engineering | Divine Word College of Calapan |
| | Senior High School | _______________ |
| | Junior High School | _______________ |

**Awards and Recognition**
- _______________

---
