[CONFERENCE_TITLE]
SnoozeGuard: An AI-Driven Real-Time Drowsiness Monitoring and Alert System for Road Safety

[AUTHORS]
Cart Jeuiel T. Agno, Aira Mae T. Pilor, Christian Eduard B. Ylagan Jr.
School of Engineering, Divine Word College of Calapan
Calapan City, Oriental Mindoro, Philippines

[ABSTRACT]
Driver drowsiness is a leading but underreported cause of road traffic fatalities globally, yet affordable and deployable real-time detection solutions remain inaccessible to most vehicle operators in developing economies. This paper presents SnoozeGuard, a multi-platform AI-driven drowsiness monitoring and alert system that transforms a driver's existing smartphone into a continuous fatigue detection station—requiring no vehicle modification or dedicated hardware purchase. The system employs Google's MediaPipe Face Landmarker to extract 478 facial landmarks and 52 blend shape coefficients, detecting yawning via the jawOpen coefficient (threshold ≥ 0.70), head nodding via pitch and roll angles, and sustained head tilt from the front-facing camera. Accelerometer data detects sudden braking events. These four signals are fused through a configurable administrator-controlled alert map into a graduated 10-level drowsiness model. Alert escalation is multi-modal: smartphone alerts at levels 1–5, an ESP32-based IoT peripheral delivering level-calibrated audio (DFPlayer Mini), vibration, and LED responses at levels 6–8, and an emergency contact notification pipeline (Expo push notification and PhilSMS SMS) at levels 9–10. An offline-first SQLite architecture with Supabase cloud synchronization ensures continuous operation under intermittent connectivity. The system was evaluated against the ISO/IEC 25010 software quality model by 29 respondents using a physical driving simulator prototype, achieving a Grand Mean of 4.01 (Very Satisfactory) across all eight quality characteristics. Results demonstrate that SnoozeGuard is a practical, low-cost, deployable countermeasure to drowsy driving fatalities.

[KEYWORDS]
driver drowsiness detection, MediaPipe, face landmark analysis, IoT alert system, MQTT, emergency notification, road safety, ISO/IEC 25010

---

[SECTION_I]
I. INTRODUCTION

Road traffic accidents caused by driver fatigue represent a persistent global public health crisis. The World Health Organization estimates that road traffic injuries are the eighth leading cause of death worldwide, with driver fatigue implicated in approximately 20% of all road fatalities on high-speed road networks [1], [2]. In the Philippines, the Land Transportation Office has consistently cited driver inattention and fatigue among the leading behavioral causes of road incidents. Unlike alcohol impairment — which carries established legal thresholds and roadside detection protocols — drowsiness leaves no objective trace and drivers commonly fail to self-recognize their own level of fatigue before a safety-critical event occurs [3].

Existing technological countermeasures fall into two categories. Vehicle-integrated Driver Monitoring Systems (DMS), deployed by manufacturers such as Mercedes-Benz, Volvo, and Subaru, use proprietary near-infrared cameras and eye-tracking algorithms but are model-specific, economically prohibitive, and absent from the aging vehicle fleets of developing economies. Aftermarket hardware DMS units reduce cost but still require dedicated hardware purchase and installation. Neither category is accessible to the majority of road transport operators in developing-country contexts.

Smartphone-based approaches leverage the ubiquitous front-facing cameras of modern mobile devices to perform drowsiness monitoring without dedicated hardware. However, existing smartphone DMS implementations have generally relied on single-signal detection (eye closure only), lacked multi-modal graduated alert escalation, and provided no closed-loop emergency response capability linking the driver's drowsiness state to a designated guardian.

This paper makes the following contributions:
- A multi-signal smartphone-native drowsiness detection engine fusing yawn detection (MediaPipe jawOpen blend shape), head nodding, sustained head tilt, and accelerometer-based braking events into a unified 10-level drowsiness model.
- A graduated multi-modal alert pipeline integrating smartphone-native alerts with a purpose-built ESP32 IoT peripheral delivering level-calibrated audio, vibration, and LED responses.
- A closed-loop emergency notification system delivering Expo push notifications and SMS alerts to a designated guardian after a 120-second countdown at critical drowsiness levels.
- An offline-first data persistence architecture using local SQLite with automatic Supabase cloud synchronization.
- A formal ISO/IEC 25010 software quality evaluation with 29 respondents through a physical driving simulator, producing a Grand Mean of 4.01 (Very Satisfactory).

The remainder of this paper is organized as follows. Section II reviews related work. Section III presents the system architecture. Section IV describes the drowsiness detection and alert engine. Section V reports the evaluation results. Section VI concludes the paper.

---

[SECTION_II]
II. RELATED WORK

Early driver monitoring systems relied primarily on PERCLOS — the Percentage of Eye Closure metric developed by Wierwille et al. [4] — as the primary fatigue indicator. Bergasa et al. [5] demonstrated real-time PERCLOS-based vigilance monitoring with high correlation to EEG-measured sleepiness, but noted susceptibility to occlusion from eyewear and performance degradation under real-world lighting variability. Ji et al. [6] confirmed that single-signal PERCLOS systems are insufficient for robust naturalistic deployment. The inclusion of head movement as a complementary, non-ocular indicator — demonstrated by Alioua et al. [7] to reliably predict drowsiness through pitch and roll deviation — motivated the multi-signal fusion approach adopted in SnoozeGuard.

Smartphone-based drowsiness detection gained traction with Daza et al. [8], who achieved 83% sensitivity using HOG-based facial landmark tracking on a mobile camera at 15 frames per second. Weng et al. [9] extended this to CNNs, achieving 94.2% accuracy, but with real-time mobile inference remaining computationally challenging. Ramzan et al. [10] conducted a systematic review establishing that multi-modal signal fusion consistently outperforms single-signal approaches — a finding that directly informs SnoozeGuard's design.

Google's MediaPipe framework [11], [12] introduced production-grade on-device facial analysis processing 478 three-dimensional landmarks and 52 blend shape coefficients at real-time inference speeds on consumer mobile hardware, resolving the compute-performance bottleneck identified in earlier work. Guggisberg et al. [13] confirmed yawning frequency as a reliable sleep-deprivation correlate, providing scientific grounding for the jawOpen blend shape as a primary detection signal.

In the IoT domain, Nunes et al. [14] demonstrated IoT-augmented fatigue detection but required body-worn physiological sensors, imposing driver acceptance barriers absent from SnoozeGuard's camera-only approach. The ESP32 microcontroller [15] and MQTT protocol [16] have emerged as de facto standards for low-cost IoT alert peripheral development.

SnoozeGuard advances the state of the art by integrating multi-signal on-device detection, graduated IoT peripheral alerting, and a guardian-linked emergency notification pipeline into a single deployable prototype — an integration that no prior system in the literature has achieved.

---

[SECTION_III]
III. SYSTEM ARCHITECTURE

SnoozeGuard is organized as a four-tier system as illustrated in Figure 1. The Client tier comprises the React Native mobile application (Expo SDK 54 / Android) and the React/Vite web dashboard (Firebase Hosting). The IoT Peripheral tier is the ESP32 alert device. The API tier is a Node.js/Hono IoT ingest service deployed on Railway. The Cloud tier is Supabase (PostgreSQL, Authentication, Realtime, Edge Functions).

[FIGURE_CAPTION]
Fig. 1. SnoozeGuard four-tier system architecture.

The mobile application is the primary platform. It hosts the MediaPipe inference engine, the drowsiness scoring algorithm, the alert escalation pipeline, the emergency notification dispatcher, and a local SQLite database. The SQLite database is the ground truth for all session data; Supabase receives synchronized copies when network connectivity is available, implementing an offline-first architecture with a pending_sync flag pattern.

The ESP32 IoT device communicates with the backend via two channels. The primary channel uses WiFi and MQTT over TLS (HiveMQ Cloud, port 8883), subscribing to the topic snoozeguard/commands/{device_id} for alert commands and publishing to snoozeguard/dismiss/{device_id} for physical dismiss events. The fallback channel uses Bluetooth Low Energy (BLE), advertising as SG-{device_id}, with a write characteristic for commands and a notify characteristic for dismiss events when WiFi is unavailable.

The IoT ingest API translates HTTP alert commands from the mobile application into MQTT publish operations and processes device dismiss events, updating the iot_alerts Supabase table for real-time cross-platform synchronization via Supabase Realtime subscriptions.

---

[SECTION_IV]
IV. DROWSINESS DETECTION AND ALERT ENGINE

A. Signal Acquisition and Drowsiness Scoring

The MediaPipe Face Landmarker model processes camera frames at 600 ms intervals on mobile (IMAGE mode) and 130 ms on the web (VIDEO mode, WebAssembly). From each frame, 478 three-dimensional landmark coordinates and 52 blend shape coefficients are extracted.

Four independent drowsiness signals are computed. Yawn detection uses the jawOpen blend shape with a two-threshold hysteresis: opening at ≥ 0.70 and confirming closure at ≤ 0.40, with a 2,000 ms inter-yawn cooldown. Head movement detection uses the relative positions of four landmarks (forehead #10, chin #152, nose bridge #168, nose tip #1) to compute pitch and roll; events fire on center-to-off-center transitions at pitch threshold 0.35 normalized units and roll threshold 0.25 radians, with a 500 ms cooldown. Sustained head tilt detection fires an independent special alert at level 8 when lateral tilt exceeds 10 continuous seconds. Sudden brake detection samples the device accelerometer at 100 ms intervals and fires when the delta vector exceeds 0.45g across two qualifying samples within 3,000 ms.

The four signals are fused through the computeLevelFromAlertMap() function, which evaluates the current yawn accumulator and head movement accumulator against an administrator-configured threshold table, returning the highest level at which both thresholds are simultaneously met. The default 5-level alert configuration is shown in Table I.

[TABLE_I]
TABLE I. DEFAULT ALERT LEVEL CONFIGURATION (LEVELS 6–10)

| Level | Label | Yawn Threshold | Head Move Threshold | Actions |
|-------|-------|---------------|--------------------|-----------------------------|
| 6 | Mild | 1 | 20 | Voice, IoT audio |
| 7 | Moderate | 2 | 35 | Voice, vibration, IoT audio |
| 8 | High | 3 | 55 | Voice, vibration, IoT audio |
| 9 | Severe | 4 | 80 | Voice, vibration, IoT + EC notification |
| 10 | Critical | 5 | 110 | Voice, vibration, IoT + EC notification |

B. Alert Escalation and IoT Integration

When the computed level meets or exceeds the configured trigger threshold and has not been dismissed in the current session, the alert pipeline executes all configured actions in parallel. Voice alerts use Expo Speech TTS with level-specific messages. At levels 6–10, the system inserts a row into the Supabase iot_alerts table and simultaneously sends an HTTP POST to the IoT ingest API (Bearer JWT) and a BLE write command — providing dual-path delivery for reliability.

The ESP32 device executes level-specific response patterns: 3-pulse vibration patterns of increasing duration at levels 6–8 (200/400/600 ms), and continuous buzzer and LED at levels 9–10, with flashing LED at level 10. DFPlayer Mini plays level-specific MP3 tracks (0001–0005.mp3) from a MicroSD card via UART2.

Dismissal is accepted from three sources: the in-app dismiss button, the IoT physical button (GPIO 25, INPUT_PULLUP, 200 ms debounce, MQTT publish to snoozeguard/dismiss/{device_id}), and the web dashboard dismiss control. All three paths converge through a Supabase Realtime subscription on iot_alerts UPDATE events in the mobile application.

C. Emergency Notification Pipeline

At sustained levels 9 or 10, a 120-second countdown (30 seconds on the web) precedes emergency response. Upon countdown expiry, the system captures GPS coordinates, inserts an emergency_alert_events record into Supabase, and dispatches an Expo push notification to the active emergency contact. If SMS notifications are enabled in the admin configuration, a POST to the Supabase Edge Function dynamic-worker calls the PhilSMS API for carrier delivery to the guardian's Philippine mobile number.

The active emergency contact is determined by the is_active flag in the multi-contact emergency_contacts_local SQLite table, supporting multiple registered guardians with real-time presence indicators.

---

[SECTION_V]
V. EVALUATION

A. Experimental Setup

The system was evaluated against the ISO/IEC 25010 software product quality model [17], which defines eight quality characteristics: Functional Suitability, Performance Efficiency, Compatibility, Usability, Reliability, Security, Maintainability, and Portability. A structured 66-item Likert-scale questionnaire was developed and validated for this purpose. Each item was rated on a five-point scale (1 = Strongly Disagree, 5 = Strongly Agree).

To ensure ecologically valid responses, all 29 respondents (of 30 enrolled; one questionnaire was incomplete) interacted with the full SnoozeGuard system — mobile application, web dashboard, and ESP32 IoT device — through a physical driving simulator prototype constructed by the research team. The simulator comprised an actual automobile seat on a rigid wooden frame, a Logitech gaming steering wheel with force feedback, brake and accelerator pedals, and a front-facing smartphone mount at windshield-equivalent distance (60–80 cm). Respondents were recruited through purposive sampling based on active driving experience and system evaluation availability. The sample ranged in age from 22 to 56 years; 51.72% identified as Intermediate mobile application users, 24.14% as Beginner, and 24.14% as Advanced.

B. Results

Weighted means were computed per item and aggregated per characteristic. Table II summarizes the results.

[TABLE_II]
TABLE II. ISO/IEC 25010 EVALUATION RESULTS (n = 29)

| Quality Characteristic | Items | Weighted Mean | Interpretation |
|------------------------|-------|--------------|----------------|
| Functional Suitability | 13 | 4.05 | Very Satisfactory |
| Performance Efficiency | 7 | 4.11 | Very Satisfactory |
| Compatibility | 5 | 4.02 | Very Satisfactory |
| Usability | 12 | 3.90 | Very Satisfactory |
| Reliability | 9 | 3.91 | Very Satisfactory |
| Security | 6 | 4.04 | Very Satisfactory |
| Maintainability | 6 | 3.98 | Very Satisfactory |
| Portability | 6 | 4.07 | Very Satisfactory |
| **Grand Mean** | **64** | **4.01** | **Very Satisfactory** |

C. Discussion

All eight characteristics fell within the Very Satisfactory band (3.50–4.49), with a Grand Mean of 4.01. Performance Efficiency (4.11) and Portability (4.07) were the strongest characteristics. Emergency notification delivery received the highest single-item mean (4.41), affirming the reliability of the MQTT/PhilSMS/Expo push pipeline. IoT device response time (4.38) and yawn detection accuracy (4.31) were rated highly, validating the MediaPipe jawOpen threshold and HiveMQ TLS command delivery.

Usability (3.90) and Reliability (3.91) were the lowest-scoring characteristics, though both remain Very Satisfactory. Within Reliability, face detection consistency under varied lighting (3.76), system stability (3.62), and alert event recording reliability (3.59) represent the primary areas for improvement — consistent with the known trade-offs of continuous on-device ML inference on mobile hardware. Within Usability, first-time user onboarding (3.62) and drowsiness level indicator clarity (3.69) suggest opportunities for improved onboarding flows and visualization design in subsequent iterations.

The physical driving simulator provided an ecologically valid evaluation context that would not have been achievable through a purely screen-based demonstration, ensuring that respondent ratings reflected genuine system interaction rather than theoretical assessment.

---

[SECTION_VI]
VI. CONCLUSION

This paper presented SnoozeGuard, a multi-platform AI-driven drowsiness monitoring system that delivers real-time detection, graduated IoT-augmented alerts, and guardian-linked emergency notification from a driver's existing smartphone without vehicle modification. The system integrates four drowsiness signals through an on-device MediaPipe inference pipeline, escalates through a 10-level alert model to an ESP32 IoT peripheral via MQTT and BLE, and triggers emergency notifications via Expo push and SMS at critical levels. An offline-first SQLite architecture ensures operation under intermittent network conditions.

Formal evaluation against ISO/IEC 25010 with 29 respondents yielded a Grand Mean of 4.01 (Very Satisfactory), with all eight quality characteristics rated within the Very Satisfactory band. These results demonstrate that SnoozeGuard meets the quality criteria of a research-grade safety-critical application and provides a sound foundation for continued development.

Future work will focus on naturalistic driving field validation, adaptive sampling strategies to reduce battery load from continuous ML inference, eye closure integration as an optional supplementary signal, and vehicle OBD-II integration for a richer drowsiness feature set.

---

[ACKNOWLEDGMENT]
The authors thank the respondents who participated in the system evaluation, the faculty of the School of Engineering of Divine Word College of Calapan for their guidance, and the research advisers Engr. Jezer E. Ilao and Engr. Michael John Pedrasa for their unwavering support throughout this study.

---

[REFERENCES]

[1] World Health Organization, "Road traffic injuries," WHO Fact Sheet, 2023. [Online]. Available: https://www.who.int/news-room/fact-sheets/detail/road-traffic-injuries

[2] J. Horne and L. Reyner, "Sleep related vehicle accidents," *British Medical Journal*, vol. 310, no. 6979, pp. 565–567, 1995. https://doi.org/10.1136/bmj.310.6979.565

[3] P. Philip, P. Sagaspe, N. Moore, J. Taillard, A. Charles, C. Guilleminault, and B. Bioulac, "Fatigue, sleep restriction and driving performance," *Accident Analysis & Prevention*, vol. 37, no. 3, pp. 473–478, 2005. https://doi.org/10.1016/j.aap.2004.07.007

[4] W. W. Wierwille, L. A. Ellsworth, S. S. Wreggit, R. J. Fairbanks, and C. L. Kim, "Research on vehicle-based driver status/performance monitoring: Development, validation, and refinement of algorithms for detection of driver drowsiness," NHTSA, DOT HS 808 247, 1994.

[5] L. M. Bergasa, J. Nuevo, M. A. Sotelo, R. Barea, and M. E. Lopez, "Real-time system for monitoring driver vigilance," *IEEE Transactions on Intelligent Transportation Systems*, vol. 7, no. 1, pp. 63–77, 2006. https://doi.org/10.1109/TITS.2006.869598

[6] Q. Ji, Z. Zhu, and P. Lan, "Real-time nonintrusive monitoring and prediction of driver fatigue," *IEEE Transactions on Vehicular Technology*, vol. 53, no. 4, pp. 1052–1068, 2004. https://doi.org/10.1109/TVT.2004.830974

[7] N. Alioua, A. Amine, M. Rziza, and D. Aboutajdine, "Driver head pose estimation using efficient descriptor fusion," *IET Computer Vision*, vol. 6, no. 3, pp. 228–237, 2012. https://doi.org/10.1049/iet-cvi.2011.0163

[8] I. G. Daza, N. Hernandez, L. M. Bergasa, I. Parra, J. J. Yebes, and M. Gavilan, "Drowsiness monitoring based on driver and driving data fusion," in *Proc. 17th Int. IEEE Conf. Intelligent Transportation Systems (ITSC)*, 2014, pp. 1199–1204. https://doi.org/10.1109/ITSC.2014.6957862

[9] C. H. Weng, Y. H. Lai, and S. H. Lai, "Driver drowsiness detection via a hierarchical temporal deep belief network," in *Proc. Asian Conf. Computer Vision (ACCV) Workshops*, Lecture Notes in Computer Science, vol. 10117, 2017, pp. 117–133. https://doi.org/10.1007/978-3-319-54427-4_9

[10] M. Ramzan, H. U. Khan, S. M. Awan, A. Ismail, M. Ilyas, and A. Mahmood, "A survey on state-of-the-art drowsiness detection techniques," *IEEE Access*, vol. 7, pp. 61904–61919, 2019. https://doi.org/10.1109/ACCESS.2019.2914373

[11] C. Lugaresi et al., "MediaPipe: A framework for building perception pipelines," *arXiv preprint arXiv:1906.08172*, 2019. https://arxiv.org/abs/1906.08172

[12] Y. Kartynnik, A. Ablavatski, I. Grishchenko, and M. Grundmann, "Real-time facial surface geometry from monocular video on mobile GPUs," *arXiv preprint arXiv:1907.06724*, 2019. https://arxiv.org/abs/1907.06724

[13] A. G. Guggisberg, J. Mathis, A. Schnider, and C. W. Hess, "Why do we yawn?" *Neuroscience & Biobehavioral Reviews*, vol. 34, no. 8, pp. 1267–1276, 2010. https://doi.org/10.1016/j.neubiorev.2010.03.008

[14] T. Nunes, J. Barbosa, P. Leitão, and R. Rabelo, "IoT-based solution for driver fatigue detection," in *Proc. 2019 24th IEEE Int. Conf. Emerging Technologies and Factory Automation (ETFA)*, 2019, pp. 1627–1630. https://doi.org/10.1109/ETFA.2019.8868999

[15] Espressif Systems, "ESP32 technical reference manual," Version 5.1, 2022. [Online]. Available: https://www.espressif.com/sites/default/files/documentation/esp32_technical_reference_manual_en.pdf

[16] OASIS, "MQTT version 5.0 specification," OASIS Standard, 2019. [Online]. Available: https://docs.oasis-open.org/mqtt/mqtt/v5.0/mqtt-v5.0.html

[17] ISO/IEC 25010:2011, "Systems and software engineering — Systems and software Quality Requirements and Evaluation (SQuaRE) — System and software quality models," International Organization for Standardization, 2011.

[18] J. Horne and L. Reyner, "Vehicle accidents related to sleep: A review," *Occupational and Environmental Medicine*, vol. 56, no. 5, pp. 289–294, 1999. https://doi.org/10.1136/oem.56.5.289

[19] S. Yang, G. Song, J. Yin, Z. Zhang, and Y. Zhou, "Real-time driver drowsiness detection using facial landmarks and machine learning on edge devices," *Sensors*, vol. 22, no. 11, p. 4007, 2022. https://doi.org/10.3390/s22114007

[20] National Highway Traffic Safety Administration, "Drowsy driving," U.S. Department of Transportation, 2017. [Online]. Available: https://www.nhtsa.gov/risky-driving/drowsy-driving
