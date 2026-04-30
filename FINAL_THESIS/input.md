![C:\\Documents and Settings\\User Admin\\My Documents\\My
Pictures\\kim\\dwcc
copy.jpg](./image1.jpeg){width="1.230217629046369in"
height="1.2191655730533684in"}

DIVINE WORD COLLEGE OF CALAPAN

School of Engineering

Bachelor of Science in Computer Engineering

Cart Jeuiel T. Agno

Aira Mae T. Pilor

Christian Eduard B. Ylagan Jr.

**SnoozeGuard: Prototype Development of an AI-Driven Real-Time
Drowsiness Monitoring System for Road Safety**

Research Adviser:

ENGR. JEZER E. ILAO

Computer Engineering Program

Date of Submission:

December 3, 2025

**Abstract:**

This paper presents a computationally efficient, real-time driver
fatigue detection system designed for high reliability in real-world
conditions. The system utilizes a single-camera setup and an ESP32
microcontroller to perform head pose analysis, a robust and
scientifically validated method for identifying driver drowsiness. By
employing a computer vision model to track head orientation in three
dimensions (pitch, yaw, and roll), the system accurately detects the
tell-tale physical signs of fatigue, such as the rapid head nods
associated with \"microsleeps\" and prolonged, unnatural head tilts
indicative of a loss of postural control. This non-ocular approach
ensures the system remains effective even when a driver\'s eyes are
obscured by sunglasses, prescription glasses, or in conditions of poor
ambient lighting, addressing a critical failure point in many
contemporary systems. Upon detection of a critical fatigue event, the
system activates a dual-channel alert: an auditory buzzer to alert the
driver and a relay to flash the vehicle\'s hazard lights, warning
surrounding traffic. This research demonstrates a focused, low-cost, and
effective solution engineered to mitigate the significant risk of
accidents caused by driver drowsiness, prioritizing pragmatic
reliability and accessibility.

**TABLE OF CONTENTS**

Title Page
\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\.....i

Abstract
\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\....
ii

Table of Contents
\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\.....iii

CHAPTER I: INTRODUCTION

> Background of the Study
> \...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\....1
>
> Statement of the Problem
> \...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\.....2
>
> Research Objectives
> \...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\....2
>
> Research Framework
> \...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\....3
>
> Scope and Delimitations
> \...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\....4-5
>
> Definition of Terms
> \...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\.....6

CHAPTER II: REVIEW OF RELATED LITERATURE

> Introduction\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\....7
>
> Related
> Studies\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\....7

CHAPTER III: RESEARCH METHODOLOGY

### Research Design......................\...\...\...\...\...\...\...\...\...\...\.......\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\.....9

Materials and
Methods........................................................................\...\...\..................10

Alert System
Implementation...........................................................................\...\...\....
11

Data
Collection...................................................................................................\...\...\.....12

Recoding and Data
Analysis...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...13

Interpretation of Results
\...\...\...\...\...\...\...\...\...\..................\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...14

REFERENCE\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\....15

**Chapter I: Introduction**

**Background of the Study**

Driver fatigue is a significant global concern, contributing to a
substantial number of traffic accidents annually.^1^ Research
consistently identifies fatigue as a major causal factor in road
accidents, with some studies suggesting it is implicated in as many as
20% of all traffic collisions worldwide.^2^ The problem is particularly
acute for heavy vehicles, where long hours and monotonous conditions
create a high-risk environment.^1^

Many modern technological solutions attempt to mitigate this risk by
monitoring the driver, but they often rely on ocular metrics such as
eye-blink rate.^1^ However, these systems have a critical reliability
gap; their effectiveness can be compromised in common real-world
scenarios where a driver's eyes are obscured by sunglasses, prescription
glasses, or in conditions with poor ambient lighting.^1^ This
vulnerability represents a fundamental flaw, as the systems are most
likely to fail under conditions where they might be needed most.^1^

This research addresses this reliability challenge by focusing on a
powerful and robust non-ocular indicator: head movement.^1^ The analysis
of a driver\'s head pose is one of the most effective methods for
detecting the onset of severe drowsiness.^1^ The physical struggle to
maintain an upright head position, which leads to slow tilts and the
rapid \"head-snap\" corrections associated with microsleeps, provides a
clear and measurable sign of fatigue that is difficult to mask and
remains detectable under a wide range of conditions.^1^ This project
leverages the power of modern computer vision and the efficiency of the
ESP32 microcontroller to create a system dedicated to one task:
analyzing head pose for signs of fatigue. This focused approach ensures
high performance on low-cost hardware, creating a practical and
accessible solution for enhancing road safety.^1^

**Statement of the Problem**

Building upon the established understanding of driver fatigue as a
critical road safety concern, this project addresses the reliability
issues inherent in many vision-based detection systems.^1^ Current
systems that depend on eye-tracking often fail in real-world conditions,
rendering them ineffective when a driver\'s eyes are not clearly
visible.^1^ This research tackles this challenge by developing a
cost-effective, real-time system that detects fatigue using a single,
robust behavioral metric: head pose analysis.^1^ The goal is to create a
system that remains reliable and functional across a wider range of
driving conditions and driver appearances.^1^

**Research Objectives**

The central aim of this research is to design, develop, and evaluate a
real-time driver fatigue detection system that accurately identifies
early signs of drowsiness through head pose analysis.

The specific objectives are:

-   To develop a real-time, non-intrusive driver fatigue detection
    system based on a single camera analyzing head pose indicators such
    as nodding and tilting.^1^

-   To implement an algorithm on an ESP32 microcontroller capable of
    distinguishing between normal head movements and patterns indicative
    of fatigue, such as microsleeps.^1^

-   To design and integrate an alert system that activates a buzzer and
    the vehicle\'s hazard lights upon the detection of a fatigue
    event.^1^

-   To evaluate the accuracy and reliability of the developed system in
    detecting driver fatigue within a controlled, simulated
    environment.^1^

**Research Framework**

The system is designed around a four-module framework to ensure
modularity and clarity in its operation.

1.  Sensing Module: A single camera module, combined with computer
    vision libraries, serves as the sole sensor, capturing a real-time
    video stream of the driver.^1^

2.  Data Processing Module: An ESP32 microcontroller processes the video
    stream, chosen for its balance of low cost, low power consumption,
    and sufficient processing power.^1^ The system employs a lightweight
    computer vision model (e.g., MediaPipe Face Mesh) to extract head
    pose metrics, specifically the pitch (nodding) and roll (tilting)
    angles.^1^ A 30-second calibration phase at the start of each
    session establishes a personalized \'neutral\' head position, from
    which all subsequent deviations are measured.^1^

3.  Decision-Making Module: A rule-based algorithm analyzes the head
    pose data to identify two critical fatigue patterns: a \"head snap\"
    indicative of a microsleep and a sustained head tilt indicating loss
    of posture.^1^ This threshold-based system compares real-time values
    against predefined limits to trigger an alert when a critical
    fatigue level is detected.^1^

4.  Alert Action Module: Upon confirmation of a fatigue event, the ESP32
    activates two alert mechanisms: an auditory buzzer to get the
    driver\'s attention and a relay switch to activate the vehicle\'s
    hazard lights, warning surrounding traffic.^1^

**Scope and Delimitations**

Scope:

-   Utilize a camera with OpenCV/Media Pipe to monitor and analyze the
    driver\'s head orientation (pitch and roll).^1^

-   Implement an algorithm on an ESP32 microcontroller to detect
    patterns of microsleeps and loss of posture based on head
    movement.^1^

-   Activate a buzzer and hazard lights upon fatigue detection.^1^

-   Evaluate the system\'s performance under various simulated
    conditions.^1^

Delimitations:

-   The system\'s analysis is exclusively limited to head pose. It will
    not incorporate any other metrics such as eye-tracking, yawning,
    hand gestures, vehicle data, heart rate, or steering wheel
    patterns.^1^

-   The system will be tested primarily through simulations. Real-world
    testing will be limited to controlled environments and will not
    involve on-road vehicle operation.^1^

-   The project will not account for external factors such as specific
    road conditions or weather.^1^

-   Comprehensive user experience testing and official safety
    certifications are outside the scope of this project.^1^

**Definition of Terms**

-   **Driver Fatigue:** A state of reduced alertness and impaired
    performance resulting from prolonged wakefulness or monotonous
    tasks, increasing the risk of accidents.^1^

-   **Head Pose Estimation:** The process of using computer vision to
    determine the 3D orientation (pitch, yaw, roll) of a driver\'s head
    from a 2D image. It is used to detect fatigue indicators like head
    nodding and tilting.^1^

-   **Microsleep:** A brief, unintended episode of loss of attention
    which may last for a few seconds. In this context, it is physically
    identified by a sudden, involuntary downward head nod followed by a
    rapid correction.^1^

-   **Non-Ocular Monitoring:** The use of sensors to observe a driver\'s
    behavior without relying on eye-tracking, making the system robust
    against obstructions like sunglasses.^1^

-   **Real-Time Detection:** The ability of a system to identify and
    respond to driver fatigue indicators instantaneously, providing
    immediate warnings.^1^

-   **Microcontroller**: A small, low-cost computer on a single
    integrated circuit used to control electronic devices, such as the
    ESP32 used in this project.^1^

-   **Pitch (Head Movement):** The rotation of the head up or down,
    often referred to as nodding. A rapid downward pitch is a key
    indicator of a microsleep.^1^

-   **Roll (Head Movement):** The rotation of the head from side to
    side, often referred to as tilting. A prolonged, sustained tilt can
    indicate a loss of postural control due to drowsiness.^1^

**Chapter II: Review of Related Literature**

**Introduction**

This chapter reviews existing literature on driver fatigue detection
systems, with a specific focus on methodologies relevant to computer
vision and non-ocular behavioral analysis. The aim is to establish a
foundation of current knowledge in the field, identify the research gaps
that this thesis addresses, and contextualize the decision to focus on
**head pose analysis** as a primary indicator of driver drowsiness. By
examining previous studies, this review will highlight the scientific
validity of using head movements to detect microsleeps and loss of
postural control, thereby justifying the approach taken in this project.

**Related Studies**

The detection of driver fatigue through technological means has been an
active area of research, with a significant portion of studies focusing
on vision-based techniques.^1^ These approaches typically monitor a
driver\'s facial features to identify signs of drowsiness in
real-time.^1^ A common method involves tracking various facial landmarks
to detect events like yawning and eye closure.^1^ Studies have
acknowledged, however, that detecting drowsiness is challenging due to
varying conditions such as ambient illumination and the potential for
normal behaviors like talking to be misidentified as yawning.^1^
Furthermore, systems that rely on eye-blink monitoring can be rendered
ineffective if the driver is wearing glasses.^1^

These limitations have driven researchers to explore more robust,
non-ocular metrics. Head movement analysis has emerged as a particularly
strong alternative and supplement to ocular-based systems.^1^ Research
has focused on calculating feature parameters such as the head\'s pitch
angle from facial landmarks to detect signs of fatigue.^1^ The rationale
is that monitoring the position and orientation of a driver\'s head can
effectively detect signs of fatigue or distraction.^1^ The involuntary
\"nodding\" motion associated with microsleeps is a key indicator that
head pose estimation can reliably capture.^1^

To implement these systems on low-cost hardware, many projects utilize
single-board computers or powerful microcontrollers.^1^ The ESP32, for
instance, is frequently noted for its balance of processing power, low
energy consumption, and built-in connectivity, making it a suitable
choice for real-time data processing in an automotive context.^1^ The
use of libraries like OpenCV is also prevalent, providing the essential
tools for face detection and feature extraction needed to track a
driver\'s eyes, mouth, and head movements from a video stream.^1^ This
project builds upon these established technologies but narrows its focus
to perfect the detection of fatigue exclusively through head pose
analysis, thereby creating a more resilient and specialized system.^1^

**Chapter III: Methodology**

**Research Design**

This study will employ a mixed-methods approach, with a primary focus on
quantitative evaluation, to assess the effectiveness of the real-time
driver fatigue detection system.^1^ A combination of developmental and
experimental research strategies will be utilized.^1^

-   **Developmental:** The project involves the creation and refinement
    of a novel system. This aspect focuses on integrating the camera
    module and ESP32 microcontroller, and optimizing the head pose
    analysis algorithm for real-time performance and accuracy.^1^

-   **Experimental:** The study includes controlled experiments to
    quantitatively assess the system\'s accuracy and reliability in
    detecting fatigue-related head movements. This involves measuring
    the system\'s performance under various simulated conditions to
    validate its effectiveness.^1^

The core evaluation will rely on quantitative data collected from
participants in a controlled setting.^1^ The system\'s automated fatigue
detections will be compared against a pre-established ground truth to
calculate performance metrics.^1^ This will be supplemented with
qualitative data gathered through post-experiment questionnaires to
capture participant feedback on the effectiveness and intrusiveness of
the alert system.^1^

**Materials and Methods**

**Hardware Components**

-   **ESP32 Microcontroller:** A low-cost, low-power microcontroller
    will serve as the central processing unit for the system, handling
    real-time data analysis and alert activation.^1^

-   **Camera Module:** A camera compatible with the ESP32 will be used
    to capture the video stream of the driver for head pose analysis.^1^

-   **Buzzer:** An auditory buzzer will be used to generate a clear and
    immediate alert signal for the driver.^1^

-   **Relay Switch:** A relay will be used to interface with and control
    the vehicle\'s hazard lights, providing a visual warning to
    surrounding traffic.^1^

-   **Power Supply:** A stable power supply will be used for the ESP32
    and the connected components.^1^

-   **Prototyping Materials:** A breadboard and jumper wires will be
    used for initial system assembly and testing.^1^

**Software Components**

-   **Arduino IDE:** The Integrated Development Environment for
    programming the ESP32 microcontroller.^1^

-   **Computer Vision Libraries (OpenCV/MediaPipe):** Software libraries
    used for processing the video stream and performing real-time facial
    landmark detection to enable head pose estimation.^1^

-   **Data Logging Software:** Custom software for recording and storing
    the system\'s output, including detected fatigue events and
    corresponding timestamps.^1^

-   **Data Analysis Software:** Python with libraries such as NumPy and
    Pandas will be used for processing the collected data and performing
    statistical analysis.^1^

**Alert System Implementation**

To effectively alert the driver of detected fatigue, a dual-alert system
is implemented. An auditory alert was chosen for its ability to produce
a distinct, attention-grabbing signal that is less likely to be missed
than a purely visual cue.^1^ The buzzer is connected to a digital output
pin on the ESP32 microcontroller.^1^ When the head pose analysis
algorithm detects a fatigue event, the ESP32 sends a HIGH signal to this
pin, activating the buzzer.^1^ The frequency and duration of the sound
can be programmed to be effective without being overly startling.^1^
Simultaneously, the system will send a signal to a relay switch
connected to the vehicle\'s hazard light system, providing an external
visual warning

**Data Collection**

**Procedure**

The ESP32 and camera module will be mounted in a fixed position within a
simulated driving setup to ensure accurate monitoring of the driver\'s
head movements.1 Participants will be briefed on the study\'s purpose
and procedure, and they will be informed of their right to withdraw at
any time.

**Participants**

A target of 10 participants will be recruited for this pilot study.1
Participants will be screened to ensure they meet specific criteria,
such as holding a valid driver\'s license and having no history of sleep
disorders, to maintain data consistency.

**Ground Truth Establishment**

To validate the system\'s accuracy, a multi-modal ground truth measure
of driver fatigue will be established.1 This will consist of two
methods:

1.  **Self-Reported Data:** Participants will complete the Karolinska
    Sleepiness Scale (KSS), a standardized self-assessment
    questionnaire, at regular intervals.

2.  **Observational Data:** Video recordings of the sessions will be
    analyzed by two independent reviewers who will manually log fatigue
    events (e.g., head-snap microsleeps).

The system\'s automated detections will be compared against this
combined ground truth data.

**Recording and Data Analysis**

The system will continuously record the driver\'s head pitch and roll
angles with corresponding timestamps.^1^ The ESP32\'s fatigue detection
algorithm will analyze this data in real-time to classify fatigue based
on two patterns: microsleep \"head snaps\" and sustained loss of
posture.^1^ The system\'s output (detected fatigue events) will be
compared to the ground truth data.^1^ Key performance metrics, including
sensitivity (the ability to correctly identify fatigue) and specificity
(the ability to correctly identify an alert state), will be calculated
to assess the system\'s accuracy.^1^

**Interpretation of Results**

The collected data will be analyzed to determine the overall
effectiveness of the proposed system in accurately detecting driver
fatigue through head pose analysis.^1^ Statistical tests will be
performed to assess the significance of the findings.^1^ The limitations
of the study, such as the small sample size and simulated environment,
will be acknowledged, and suggestions for future research and
development will be provided.

**References:**

Aravind, A., Agarwal, A., Jaiswal, A., Panjiyara, A., & PM, M. S.
(2019). Fatigue Detection System Based on Eye Blinks of Drivers.
*International Journal of Engineering and Advanced Technology*, 8, 72.
<https://doi.org/10.35940/ijeat.e1015.0585s19>

Forsman, P., Vila, B., Short, R., Mott, C. G., & Dongen, H. P. A. V.
(2012). Efficient driver drowsiness detection at moderate levels of
drowsiness. *Accident Analysis & Prevention*, 50, 341.
<https://doi.org/10.1016/j.aap.2012.05.005>

He, H., Zhang, X., Fu, J., Wang, C., Yang, Y., Liu, W., & Peng, J.
(2020). A Real-time Driver Fatigue Detection Method Based on Two-Stage
Convolutional Neural Network. *IFAC-PapersOnLine*, 53(2), 15374.
<https://doi.org/10.1016/j.ifacol.2020.12.2357>

Heinzmann, J., Tate, D., & Scott, R. C. (2008, April 15). *Using
Technology to Eliminate Drowsy Driving*. SPE International Conference on
Health, Safety, and Environment in Oil and Gas Exploration and
Production. <https://doi.org/10.2118/111942-ms>

Hsieh, C.-S., & Tai, C.-C. (2013). AN IMPROVED AND PORTABLE EYE-BLINK
DURATION DETECTION SYSTEM TO WARN OF DRIVER FATIGUE. *Instrumentation
Science & Technology*, 41(5), 429.
<https://doi.org/10.1080/10739149.2013.796560>

Josephin, J. S. F., Lakshmi, C., & James, S. J. (2020). A review on the
measures and techniques adapted for the detection of driver drowsiness.
*IOP Conference Series Materials Science and Engineering*, 993(1),
12101. IOP Publishing. <https://doi.org/10.1088/1757-899x/993/1/012101>

Li, X., Xia, J., Cao, L., Zhang, G., & Feng, X. (2021). Driver fatigue
detection based on convolutional neural network and face alignment for
edge computing device. *Proceedings of the Institution of Mechanical
Engineers Part D Journal of Automobile Engineering*, 235, 2699.
<https://doi.org/10.1177/0954407021999485>

Shi, S.-Y., Tang, W., & Wang, Y. (2017). A Review on Fatigue Driving
Detection. *ITM Web of Conferences*, 12, 1019. EDP Sciences.
<https://doi.org/10.1051/itmconf/20171201019>

Vasiliev, A., Martiusheva, N., Boykov, A., Vyatkin, N., & Никитин, К. И.
(2019). Development of decision algorithms in the driver fatigue
monitoring and prediction system based on a wireless multisensor device.
*IOP Conference Series Materials Science and Engineering*, 618(1),
12029. <https://doi.org/10.1088/1757-899x/618/1/012029>

Williamson, A., & Chamberlain, T. (2005). *Review of on-road driver
fatigue monitoring devices*. <https://trid.trb.org/view/1156314>

Yang, S., Song, X., Zhang, L., & Yu, J. (2017). The anti-fatigue driving
system design based on the eye blink detect. *Proceedings of SPIE, the
International Society for Optical Engineering/Proceedings of SPIE*,
10322. <https://doi.org/10.1117/12.2266074>

Zhao, X., & Ye, W. (2018). Research on fatigue driving pre-warning
system based on multi-information fusion. *AIP Conference Proceedings*,
1967, 20002. <https://doi.org/10.1063/1.5038974>

**Works cited**

1.  Driver fatigue - Brake \| The Road Safety Charity, accessed October
    26, 2025,
    <https://www.brake.org.uk/get-involved/take-action/mybrake/knowledge-centre/driver-fatigue>

2.  Fatigue 2018 - RSA, accessed October 26, 2025,
    <https://www.rsa.ie/docs/default-source/about/european-commission-fatigue-european-commission-directorate-general-for-transport-feburary-2018.pdf?Status=Master&sfvrsn=fe8b1a12_12>

3.  THE ROLE OF DRIVER FATIGUE IN COMMERCIAL ROAD TRANSPORT CRASHES,
    accessed October 26, 2025,
    <https://etsc.eu/wp-content/uploads/The-role-of-driver-fatigue-in-commercial-road-transport-crashes.pdf>

4.  Assessment of a Drowsy Driver Warning System for Heavy-Vehicle
    Drivers Final Report - NHTSA, accessed October 26, 2025,
    <https://www.nhtsa.gov/sites/nhtsa.gov/files/811117.pdf>
