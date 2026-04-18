// ============================================================
//  SnoozeGuard IoT Device Enclosure  — v1.0
//  Designed for:
//    • ESP32-CAM (AI Thinker, 40 × 27 mm)
//    • OV2640 camera lens (centre front)
//    • 4 × 5 mm status LEDs (diamond around camera)
//    • 1 × passive buzzer  (12 mm diameter, 9 mm tall)
//    • USB-C or Micro-USB breakout for power
//
//  Two-piece clamshell held by 4 × M2.5 screws.
//  Print each piece flat on build plate, 0.2 mm layers, PLA/PETG.
//  Export STLs: render SHELL then SHELL=false for LID.
//
//  Free software: OpenSCAD  https://openscad.org/
// ============================================================

$fn = 72;

// ── Toggle which piece to render ────────────────────────────
RENDER_LID   = true;   // front face + short walls
RENDER_BASE  = false;  // deep shell + internals
RENDER_CLIP  = false;  // separate visor-clip bracket
EXPLODE      = 0;      // set to 25 to see both pieces apart

// ── Outer envelope ───────────────────────────────────────────
W  = 96;    // outer width   (mm)
H  = 70;    // outer height  (mm)
D  = 42;    // total depth   (mm)
T  = 2.8;   // wall thickness
CR = 7;     // corner radius

// ── Split depth (lid vs base) ────────────────────────────────
LID_D  = 10;           // lid wall depth (front face + short lip)
BASE_D = D - LID_D;    // base depth

// ── Camera (OV2640 through ESP32-CAM module) ─────────────────
CAM_X  = W / 2;        // centred horizontally
CAM_Y  = H / 2 + 4;   // slightly above mid-height
CAM_HOLE_R = 12;       // radius of camera cutout (24 mm diameter)
BEZEL_R    = 16;       // outer radius of decorative ring

// ── LEDs — diamond pattern, 4 × 5 mm ────────────────────────
LED_D      = 5.4;      // hole diameter
LED_DIST   = 22;       // distance from camera centre

// ── Speaker / buzzer grille ──────────────────────────────────
SPK_CX     = W / 2;
SPK_CY     = 11;
SPK_ROWS   = 3;
SPK_COLS   = 10;
SPK_SLOT_W = 2.2;
SPK_SLOT_H = 2.2;
SPK_GAP_X  = 3.8;
SPK_GAP_Y  = 4.0;

// ── USB port cutout (right side, near bottom) ────────────────
USB_W  = 11;    // slot width
USB_H  = 4.5;   // slot height
USB_Y  = 14;    // from bottom

// ── Corner screw columns (M2.5) ──────────────────────────────
SC_INSET  = 8;          // screw column inset from corner
SC_OD     = 5.5;        // column outer diameter
SC_HOLE_D = 2.6;        // through-hole for M2.5 screw
SC_BOSS_H = 7.0;        // standoff height inside base

// ── ESP32-CAM PCB standoffs ──────────────────────────────────
// Board: 40 × 27 mm, mounting holes ≈ 2.5 mm from each edge
PCB_W  = 40;
PCB_H  = 27;
PCB_X0 = (W - PCB_W) / 2;      // left edge X
PCB_Y0 = (H - PCB_H) / 2 - 4;  // bottom edge Y (shifted down a touch)
PCB_STANDOFF_H = 4;             // height above base floor
PCB_STANDOFF_OD = 4.5;
PCB_PILOT_D = 2.0;              // M2 self-tap pilot

// ── Buzzer pocket (sits beside PCB) ──────────────────────────
BUZ_X  = W - T - 16;
BUZ_Y  = PCB_Y0 - 14;
BUZ_D  = 13;   // pocket diameter
BUZ_H  = 10;   // pocket depth

// ── Alignment pin / socket on parting line ───────────────────
PIN_D  = 2.5;
PIN_H  = 3.5;

// ============================================================
//  Helpers
// ============================================================

module roundedBox(w, h, d, r) {
    hull()
        for (x = [r, w - r], y = [r, h - r])
            translate([x, y, 0]) cylinder(h = d, r = r);
}

module screwCol(h, od, id) {
    difference() {
        cylinder(h = h, r = od / 2);
        translate([0, 0, -0.1]) cylinder(h = h + 0.2, r = id / 2);
    }
}

// ── LED hole (4 positions) ───────────────────────────────────
module ledHoles() {
    angles = [90, 0, 270, 180];  // top, right, bottom, left
    for (a = angles)
        translate([
            CAM_X + LED_DIST * cos(a),
            CAM_Y + LED_DIST * sin(a),
            -0.1
        ])
        cylinder(h = T + 0.2, r = LED_D / 2);
}

// ── Speaker grille (grid of small rectangular slots) ─────────
module grilleHoles() {
    start_x = SPK_CX - (SPK_COLS * SPK_GAP_X) / 2 + SPK_GAP_X / 2 - SPK_SLOT_W / 2;
    start_y = SPK_CY - (SPK_ROWS * SPK_GAP_Y) / 2 + SPK_GAP_Y / 2 - SPK_SLOT_H / 2;
    for (r = [0 : SPK_ROWS - 1], c = [0 : SPK_COLS - 1])
        translate([
            start_x + c * SPK_GAP_X,
            start_y + r * SPK_GAP_Y,
            -0.1
        ])
        cube([SPK_SLOT_W, SPK_SLOT_H, T + 0.2]);
}

// ============================================================
//  LID  (front face — camera / LEDs / grille visible)
//  Print: place front face DOWN on build plate
// ============================================================

module lid() {
    difference() {
        // ── Outer shell ──────────────────────────────────────
        roundedBox(W, H, LID_D, CR);

        // ── Hollow interior ──────────────────────────────────
        translate([T, T, T])
            roundedBox(W - 2*T, H - 2*T, LID_D, max(CR - T, 1));

        // ── Camera circular cutout ────────────────────────────
        translate([CAM_X, CAM_Y, -0.1])
            cylinder(h = T + 0.2, r = CAM_HOLE_R);

        // ── LED holes ─────────────────────────────────────────
        ledHoles();

        // ── Speaker grille ────────────────────────────────────
        grilleHoles();

        // ── Corner screw through-holes ────────────────────────
        for (x = [SC_INSET, W - SC_INSET], y = [SC_INSET, H - SC_INSET])
            translate([x, y, -0.1])
                cylinder(h = LID_D + 0.2, r = SC_HOLE_D / 2);

        // ── Alignment socket (receive pin from base) ──────────
        for (x = [W * 0.25, W * 0.75])
            translate([x, H / 2, LID_D - PIN_H])
                cylinder(h = PIN_H + 0.1, r = PIN_D / 2 + 0.15);
    }

    // ── Decorative camera bezel ring ─────────────────────────
    translate([CAM_X, CAM_Y, T])
    difference() {
        cylinder(h = 1.5, r = BEZEL_R);
        translate([0, 0, -0.1]) cylinder(h = 2, r = CAM_HOLE_R);
    }

    // ── LED surrounds (small raised rings for light diffusion) ─
    angles = [90, 0, 270, 180];
    for (a = angles)
        translate([
            CAM_X + LED_DIST * cos(a),
            CAM_Y + LED_DIST * sin(a),
            T
        ])
        difference() {
            cylinder(h = 1.2, r = LED_D / 2 + 1.8);
            translate([0, 0, -0.1]) cylinder(h = 1.5, r = LED_D / 2);
        }

    // ── Screw columns (recessed caps inside lid) ──────────────
    for (x = [SC_INSET, W - SC_INSET], y = [SC_INSET, H - SC_INSET])
        translate([x, y, T])
            screwCol(LID_D - T - 0.5, SC_OD, SC_HOLE_D);

    // ── Label emboss — "SnoozeGuard" text placeholder ridge ───
    // (replace with actual text() if you have a font installed)
    translate([W / 2 - 20, 3.5, T])
        cube([40, 1, 0.6]);
}

// ============================================================
//  BASE  (deep shell — internals, USB slot, mounting boss)
//  Print: opening facing UP on build plate
// ============================================================

module base() {
    difference() {
        // ── Outer shell ──────────────────────────────────────
        roundedBox(W, H, BASE_D, CR);

        // ── Hollow interior ──────────────────────────────────
        translate([T, T, T])
            roundedBox(W - 2*T, H - 2*T, BASE_D, max(CR - T, 1));

        // ── USB-C slot — right wall, near bottom ─────────────
        translate([W - T - 0.1, H / 2 - USB_W / 2, USB_Y])
            cube([T + 0.2, USB_W, USB_H]);

        // ── Corner screw through-holes ────────────────────────
        for (x = [SC_INSET, W - SC_INSET], y = [SC_INSET, H - SC_INSET])
            translate([x, y, BASE_D - SC_BOSS_H - 0.1])
                cylinder(h = SC_BOSS_H + 0.2, r = SC_HOLE_D / 2);

        // ── Buzzer pocket ─────────────────────────────────────
        translate([BUZ_X, BUZ_Y, T])
            cylinder(h = BUZ_H + 0.1, r = BUZ_D / 2);

        // ── Cable management slot (top wall) ──────────────────
        translate([W / 2 - 5, H - T - 0.1, T + 8])
            cube([10, T + 0.2, 6]);
    }

    // ── Corner screw boss columns ─────────────────────────────
    for (x = [SC_INSET, W - SC_INSET], y = [SC_INSET, H - SC_INSET])
        translate([x, y, T])
            screwCol(SC_BOSS_H, SC_OD, SC_HOLE_D);

    // ── PCB standoffs for ESP32-CAM ───────────────────────────
    // Mounting holes at 4 corners of PCB footprint
    for (dx = [0, PCB_W], dy = [0, PCB_H])
        translate([PCB_X0 + dx, PCB_Y0 + dy, T])
        difference() {
            cylinder(h = PCB_STANDOFF_H, r = PCB_STANDOFF_OD / 2);
            translate([0, 0, -0.1])
                cylinder(h = PCB_STANDOFF_H + 0.2, r = PCB_PILOT_D / 2);
        }

    // ── Alignment pins on parting face ────────────────────────
    for (x = [W * 0.25, W * 0.75])
        translate([x, H / 2, BASE_D - PIN_H])
            cylinder(h = PIN_H, r = PIN_D / 2);

    // ── Rear mounting boss (flat pad for adhesive or clip) ────
    translate([W / 2 - 18, H / 2 - 10, 0])
        difference() {
            cube([36, 20, T + 2]);
            // Two screw holes for visor clip
            for (bx = [8, 28])
                translate([bx, 10, -0.1])
                    cylinder(h = T + 2.2, r = SC_HOLE_D / 2);
        }
}

// ============================================================
//  VISOR CLIP  (prints separately — attaches to base boss)
//  Clips over a car sun visor (6 mm thick slot)
// ============================================================

module visorClip() {
    CW = 72;  // clip width
    CH = 14;  // clip body height
    CD = 28;  // clip body depth
    VS = 7;   // visor slot opening (adjust for your visor)

    difference() {
        // Main body
        cube([CW, CH, CD]);

        // Visor slot — open at top
        translate([10, -VS, CD / 2])
            cube([CW - 20, VS + T + 0.1, CD / 2 + 0.1]);

        // Through-holes to bolt onto enclosure back boss
        for (bx = [16, CW - 16])
            translate([bx, CH / 2, -0.1])
                cylinder(h = CD + 0.2, r = SC_HOLE_D / 2);
    }

    // Grip ridges on visor jaw
    for (i = [0 : 4])
        translate([12 + i * 10, -VS + T - 0.8, CD / 2])
            cube([4, 1.0, CD / 2]);
}

// ============================================================
//  RENDER
// ============================================================

if (RENDER_LID)
    translate([0, 0, EXPLODE])
        lid();

if (RENDER_BASE)
    // Flip base so its opening faces up for printing
    translate([0, H, BASE_D + EXPLODE])
        rotate([180, 0, 0])
            base();

if (RENDER_CLIP)
    translate([W + 15, 0, 0])
        visorClip();
