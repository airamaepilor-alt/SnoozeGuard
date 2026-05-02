# CHAPTER IV: RESULTS AND DISCUSSION

## 4.1 Overview

This chapter presents the results of the ISO/IEC 25010 software quality evaluation of the SnoozeGuard system. A structured Likert-scale questionnaire consisting of sixty-six (66) items distributed across the eight quality characteristics of the ISO/IEC 25010 standard was administered to thirty (30) respondents, of whom twenty-nine (29) provided complete responses used in this analysis. Weighted means were computed per quality characteristic and per sub-characteristic. The interpretation scale used throughout this chapter is as follows:

**Table 7. Weighted Mean Interpretation Scale**

| Weighted Mean Range | Verbal Interpretation |
|---------------------|-----------------------|
| 4.50 – 5.00 | Excellent |
| 3.50 – 4.49 | Very Satisfactory |
| 2.50 – 3.49 | Satisfactory |
| 1.50 – 2.49 | Poor |
| 1.00 – 1.49 | Very Poor |

---

## 4.2 Respondent Profile

Thirty respondents participated in the evaluation. All respondents were given access to the complete SnoozeGuard system — the mobile application, web dashboard, and IoT alert device — during a controlled evaluation session. The demographic profile is presented below.

**Table 8. Distribution of Respondents by Experience Level with Mobile Applications**

| Experience Level | Frequency | Percentage |
|------------------|-----------|------------|
| Beginner | 7 | 24.14% |
| Intermediate | 15 | 51.72% |
| Advanced | 7 | 24.14% |
| **Total** | **29** | **100%** |

The respondents represented a cross-section of mobile application experience levels. The majority (51.72%) identified as Intermediate users, while Beginner and Advanced users each comprised approximately 24% of the sample. The age range of named respondents was 22 to 56 years, with most falling in the 22–25 age bracket, reflecting a sample predominantly composed of young adult drivers and students. Occupations included students, fresh graduates, a junior automation engineer, a junior architect, and a self-employed individual, providing diverse perspectives on the system's usability and practicality.

---

## 4.3 ISO/IEC 25010 Evaluation Results

### 4.3.1 Functional Suitability

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

---

### 4.3.2 Performance Efficiency

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

---

### 4.3.3 Compatibility

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

---

### 4.3.4 Usability

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

---

### 4.3.5 Reliability

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

---

### 4.3.6 Security

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

---

### 4.3.7 Maintainability

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

---

### 4.3.8 Portability

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

---

## 4.4 Summary of All ISO/IEC 25010 Characteristics

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

---

## 4.5 Overall User Satisfaction

Beyond the eight ISO characteristics, two items captured overall user satisfaction with the system:

**Table 18. Overall Satisfaction Items**

| # | Indicator | WM | Interpretation |
|---|-----------|-----|----------------|
| Q65 | Overall, SnoozeGuard is an effective tool for real-time driver drowsiness monitoring. | 3.90 | Very Satisfactory |
| Q66 | I would recommend SnoozeGuard as a practical road safety aid for drivers. | 4.17 | Very Satisfactory |
| | **Overall Satisfaction** | **4.03** | **Very Satisfactory** |

A weighted mean of **4.03** for overall satisfaction affirms that respondents viewed SnoozeGuard as an effective and recommendable road safety tool. The recommendation score (WM = 4.17) exceeding the effectiveness score (WM = 3.90) suggests that even respondents who perceived individual limitations still found the system compelling enough to endorse to others, which is a strong indicator of practical value.

---

## 4.6 Qualitative Feedback

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

---

## 4.7 Chapter Summary

This chapter presented the ISO/IEC 25010 software quality evaluation of the SnoozeGuard system based on responses from twenty-nine (29) respondents. All eight quality characteristics achieved a *Very Satisfactory* rating, with a grand mean of **4.01**. The system demonstrated strongest performance in Performance Efficiency (WM = 4.11) and Portability (WM = 4.07), affirming the effectiveness of the MQTT-based IoT pipeline, offline-first SQLite architecture, and cross-platform deployment strategy. Areas identified for future development include reliability maturity — specifically face detection consistency and system stability under sustained load — and usability improvements to alert visualization and first-time user onboarding. Overall, the evaluation confirms that SnoozeGuard meets the quality standards expected of a research-grade safety-critical application and provides a sound foundation for continued development toward production deployment.
