# SnoozeGuard IoT Enclosure — 3D Print Guide

## Hardware it fits
| Component | Spec |
|-----------|------|
| Microcontroller | ESP32-CAM (AI Thinker) — 40 × 27 mm |
| Camera | OV2640 (built into ESP32-CAM module) |
| Status LEDs | 4 × 5 mm through-hole LED |
| Alert buzzer | Passive 12 mm buzzer / small speaker |
| Power | USB-C or Micro-USB breakout board |
| Fasteners | 4 × M2.5 × 8 mm socket head screws |
| PCB mounting | 4 × M2 × 6 mm self-tapping screws |

---

## Pieces to print (3 files, export each as STL)

### 1. Lid (front face)
In `snoozeguard_enclosure.scad`, set:
```
RENDER_LID  = true;
RENDER_BASE = false;
RENDER_CLIP = false;
```
**Orientation:** Front face DOWN on build plate (no supports needed).

### 2. Base (deep shell)
```
RENDER_LID  = false;
RENDER_BASE = true;
RENDER_CLIP = false;
```
**Orientation:** Opening facing UP (no supports needed).

### 3. Visor Clip (optional bracket)
```
RENDER_LID  = false;
RENDER_BASE = false;
RENDER_CLIP = true;
```
**Orientation:** Flat side DOWN. Adjust `VS = 7` for your visor thickness.

---

## Recommended print settings
| Setting | Value |
|---------|-------|
| Material | PLA or PETG |
| Layer height | 0.2 mm |
| Infill | 25 % (gyroid or grid) |
| Perimeters / walls | 3 |
| Supports | None required |
| Bed temp | 60 °C (PLA) / 80 °C (PETG) |
| Nozzle temp | 210 °C (PLA) / 235 °C (PETG) |

---

## Assembly order
1. **Test fit** lid + base dry before gluing anything.
2. Insert **M2.5 heat-set inserts** into base boss holes (or use nuts).
3. Solder/mount **buzzer** into its pocket on the base floor.
4. Screw **ESP32-CAM** onto the 4 PCB standoffs with M2 self-tapping screws.
5. Route **USB breakout** into the side slot; hot-glue in place.
6. Press **LEDs** through the lid holes — friction fit; add hot-glue from inside.
7. Align the **alignment pins** (base) into sockets (lid), then seat the lid.
8. Drive **4 × M2.5 screws** through lid corners into base bosses.
9. Bolt **visor clip** to the rear mounting boss with 2 × M2.5 screws.

---

## Front face layout (96 × 70 mm)

```
┌──────────────────────────────────────────┐
│  ●                                    ●  │  ← screw corners
│                                          │
│              ⊙  LED                      │
│         ⊙  [CAM]  ⊙                     │  ← camera centred
│              ⊙  LED                      │
│                                          │
│     ▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮         │  ← speaker grille
│  ●                                    ●  │  ← screw corners
└──────────────────────────────────────────┘
         USB-C slot → right side
```

---

## Customising the model
All key dimensions are at the top of the `.scad` file:

| Variable | Default | What it controls |
|----------|---------|-----------------|
| `W` | 96 mm | outer width |
| `H` | 70 mm | outer height |
| `D` | 42 mm | total depth |
| `T` | 2.8 mm | wall thickness |
| `CAM_HOLE_R` | 12 mm | camera cutout radius |
| `LED_DIST` | 22 mm | LED distance from camera |
| `VS` | 7 mm | visor clip slot thickness |
| `EXPLODE` | 0 | set to 25 to see exploded view |
