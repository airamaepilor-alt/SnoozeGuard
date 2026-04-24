// SimCar.ts — arcade-physics car with exterior 3D model + interior cockpit

import * as THREE from "three";

const CAR_HEIGHT = 0.66; // root Y above ground (wheels just touch ground)
const WHEEL_RADIUS = 0.38;

// Driver eye position in car-root local space
export const EYE_LOCAL = new THREE.Vector3(0, 0.69, -0.2);

export class SimCar {
  readonly root: THREE.Group;

  position: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  yaw = 0;
  speed = 0;

  private readonly MAX_SPEED = 50;
  private readonly ACCELERATION = 22;
  private readonly BRAKE_DECEL = 45;
  private readonly DRAG = 0.38;
  private readonly MAX_STEER_RATE = 1.7;

  private exteriorGroup: THREE.Group;
  private interiorGroup: THREE.Group;
  private steeringWheelSpinGroup: THREE.Group;
  private wheelGroupFL!: THREE.Group;
  private wheelGroupFR!: THREE.Group;

  constructor(scene: THREE.Scene) {
    this.root = new THREE.Group();
    scene.add(this.root);

    this.exteriorGroup = new THREE.Group();
    this.interiorGroup = new THREE.Group();
    this.steeringWheelSpinGroup = new THREE.Group();
    this.root.add(this.exteriorGroup);
    this.root.add(this.interiorGroup);
    this.interiorGroup.visible = false; // hidden until FPV mode

    this.buildExterior();
    this.buildInterior();
    this.root.position.y = CAR_HEIGHT;
  }

  // ── Exterior ────────────────────────────────────────────────────────────────

  private buildExterior() {
    const bodyMat = new THREE.MeshPhongMaterial({ color: 0x1a3a6b, shininess: 90 });
    const cabinMat = new THREE.MeshPhongMaterial({ color: 0x0d1f40, shininess: 30 });
    const wheelMat = new THREE.MeshPhongMaterial({ color: 0x111111 });
    const rimMat = new THREE.MeshPhongMaterial({ color: 0x999999, shininess: 120 });
    const headlightMat = new THREE.MeshBasicMaterial({ color: 0xfffff0 });
    const taillightMat = new THREE.MeshBasicMaterial({ color: 0xdd2200 });
    const undersideMat = new THREE.MeshPhongMaterial({ color: 0x0a0a0f });

    // Chassis body
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.55, 4.3), bodyMat);
    chassis.castShadow = true;
    this.exteriorGroup.add(chassis);

    const skirt = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.12, 4.4), undersideMat);
    skirt.position.set(0, -0.28, 0);
    this.exteriorGroup.add(skirt);

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.58, 2.1), cabinMat);
    cabin.position.set(0, 0.565, -0.2);
    this.exteriorGroup.add(cabin);

    // Headlights
    ([-0.55, 0.55] as const).forEach((x) => {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.14, 0.04), headlightMat);
      hl.position.set(x, 0.06, -2.15);
      this.exteriorGroup.add(hl);

      const spot = new THREE.SpotLight(0xfff8e0, 4, 90, 0.38, 0.7, 1.6);
      spot.position.set(x, 0.3, -2.1);
      this.root.add(spot); // on root so headlights work in FPV too
      const tgt = new THREE.Object3D();
      tgt.position.set(x * 0.4, -0.6, -35);
      this.root.add(tgt);
      spot.target = tgt;
    });

    // Taillights
    ([-0.55, 0.55] as const).forEach((x) => {
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.11, 0.04), taillightMat);
      tl.position.set(x, 0.06, 2.16);
      this.exteriorGroup.add(tl);
    });

    // Wheels
    const makeWheel = (xOff: number, zOff: number): THREE.Group => {
      const grp = new THREE.Group();
      grp.position.set(xOff, -0.28, zOff);
      const tire = new THREE.Mesh(
        new THREE.CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, 0.26, 20),
        wheelMat,
      );
      tire.rotation.z = Math.PI / 2;
      grp.add(tire);
      const rim = new THREE.Mesh(
        new THREE.CylinderGeometry(WHEEL_RADIUS * 0.6, WHEEL_RADIUS * 0.6, 0.27, 8),
        rimMat,
      );
      rim.rotation.z = Math.PI / 2;
      grp.add(rim);
      this.exteriorGroup.add(grp);
      return grp;
    };

    this.wheelGroupFL = makeWheel(-0.95, -1.38);
    this.wheelGroupFR = makeWheel(0.95, -1.38);
    makeWheel(-0.95, 1.38);
    makeWheel(0.95, 1.38);
  }

  // ── Interior cockpit ─────────────────────────────────────────────────────────

  private buildInterior() {
    const darkMat = new THREE.MeshPhongMaterial({ color: 0x0f0f13, shininess: 8 });
    const dashMat = new THREE.MeshPhongMaterial({ color: 0x12121a, shininess: 12 });
    const bodyColorMat = new THREE.MeshPhongMaterial({ color: 0x1a3a6b, shininess: 40 });
    const pillarMat = new THREE.MeshPhongMaterial({ color: 0x0c0c10, shininess: 0 });
    const wheelRimMat = new THREE.MeshPhongMaterial({ color: 0x0e0e14, shininess: 140 });
    const spokeMat = new THREE.MeshPhongMaterial({ color: 0x1a1a22, shininess: 60 });

    // ── Dashboard main body ──────────────────────────────────────────────────
    // z=-1.15: between eye (z=-0.2) and front of cabin (z=-1.25)
    const dashBody = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.2, 0.5), dashMat);
    dashBody.position.set(0, 0.36, -1.12);
    this.interiorGroup.add(dashBody);

    // Dashboard top pad (horizontal surface facing upward)
    const dashTop = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.06, 0.32), darkMat);
    dashTop.position.set(0, 0.475, -1.02);
    this.interiorGroup.add(dashTop);

    // Dashboard lower fascia (angled panel below steering column)
    const fascia = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.26, 0.08), darkMat);
    fascia.position.set(0, 0.22, -0.78);
    fascia.rotation.x = -0.35;
    this.interiorGroup.add(fascia);

    // Instrument cluster (dark recessed panel on dashboard)
    const cluster = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 0.02), darkMat);
    cluster.position.set(-0.28, 0.44, -0.86);
    this.interiorGroup.add(cluster);

    // Infotainment / center screen on dashboard
    const screen = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.16, 0.02),
      new THREE.MeshPhongMaterial({ color: 0x060c14, emissive: 0x040810, shininess: 80 }),
    );
    screen.position.set(0, 0.36, -0.86);
    this.interiorGroup.add(screen);

    // ── Steering column ──────────────────────────────────────────────────────
    const col = new THREE.Mesh(
      new THREE.CylinderGeometry(0.038, 0.045, 0.52, 8),
      darkMat,
    );
    col.position.set(0, 0.49, -0.68);
    col.rotation.x = 0.55; // tilt toward driver
    this.interiorGroup.add(col);

    // ── Steering wheel ───────────────────────────────────────────────────────
    // Outer tilt group (position + X tilt — never changes)
    const wheelTiltGroup = new THREE.Group();
    wheelTiltGroup.position.set(0, 0.47, -0.85);
    wheelTiltGroup.rotation.x = -0.48; // tilt toward horizontal (like a real wheel)
    this.interiorGroup.add(wheelTiltGroup);

    // Inner spin group (rotates on Z when steering)
    this.steeringWheelSpinGroup = new THREE.Group();
    wheelTiltGroup.add(this.steeringWheelSpinGroup);

    const RING_R = 0.185;

    // Outer rim ring
    const rimRing = new THREE.Mesh(
      new THREE.TorusGeometry(RING_R, 0.019, 10, 52),
      wheelRimMat,
    );
    this.steeringWheelSpinGroup.add(rimRing);

    // Inner grip detail (slightly different tone)
    const gripRing = new THREE.Mesh(
      new THREE.TorusGeometry(RING_R, 0.013, 8, 52),
      new THREE.MeshPhongMaterial({ color: 0x1a1a20, shininess: 30 }),
    );
    this.steeringWheelSpinGroup.add(gripRing);

    // Central hub disk
    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.052, 0.052, 0.022, 12),
      new THREE.MeshPhongMaterial({ color: 0x1c1c24, shininess: 50 }),
    );
    hub.rotation.x = Math.PI / 2;
    this.steeringWheelSpinGroup.add(hub);

    // Logo badge on hub (very simple box)
    const badge = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.022, 0.005),
      new THREE.MeshBasicMaterial({ color: 0x334466 }),
    );
    badge.position.set(0, 0, 0.013);
    this.steeringWheelSpinGroup.add(badge);

    // 3 spokes
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2 + Math.PI / 2; // start at bottom
      const spokeLen = RING_R * 0.82;
      const spoke = new THREE.Mesh(
        new THREE.CylinderGeometry(0.011, 0.013, spokeLen, 6),
        spokeMat,
      );
      spoke.position.set(
        Math.cos(angle) * spokeLen * 0.5,
        Math.sin(angle) * spokeLen * 0.5,
        0,
      );
      spoke.rotation.z = angle - Math.PI / 2;
      this.steeringWheelSpinGroup.add(spoke);
    }

    // ── A-pillars ────────────────────────────────────────────────────────────
    // Left A-pillar (angled from dashboard left edge up to roof-line)
    const makePillar = (x: number) => {
      const pillar = new THREE.Mesh(
        new THREE.BoxGeometry(0.07, 0.72, 0.065),
        pillarMat,
      );
      pillar.position.set(x, 0.66, -1.12);
      pillar.rotation.z = x < 0 ? 0.18 : -0.18;  // lean outward
      pillar.rotation.y = x < 0 ? 0.14 : -0.14;  // slight fore-aft tilt
      this.interiorGroup.add(pillar);
    };
    makePillar(-0.73);
    makePillar(0.73);

    // Top windshield frame (connects tops of A-pillars)
    const topFrame = new THREE.Mesh(
      new THREE.BoxGeometry(1.62, 0.07, 0.07),
      pillarMat,
    );
    topFrame.position.set(0, 0.845, -1.08);
    this.interiorGroup.add(topFrame);

    // ── Hood visible through lower windshield ────────────────────────────────
    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.88, 0.025, 0.56), bodyColorMat);
    hood.position.set(0, 0.285, -1.55);
    this.interiorGroup.add(hood);

    // Hood centre ridge
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.04, 0.56), bodyColorMat);
    ridge.position.set(0, 0.3, -1.55);
    this.interiorGroup.add(ridge);

    // ── Side window sill (left door) ─────────────────────────────────────────
    const makeSill = (x: number) => {
      const sill = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.85), darkMat);
      sill.position.set(x, 0.47, -0.42);
      this.interiorGroup.add(sill);
    };
    makeSill(-0.78);
    makeSill(0.78);

    // ── Rear-view mirror ─────────────────────────────────────────────────────
    const mirror = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.08, 0.04),
      new THREE.MeshPhongMaterial({ color: 0x222230, shininess: 120 }),
    );
    mirror.position.set(0, 0.82, -0.85);
    this.interiorGroup.add(mirror);
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  showExterior(v: boolean) {
    this.exteriorGroup.visible = v;
  }

  showInterior(v: boolean) {
    this.interiorGroup.visible = v;
  }

  update(steer: number, throttle: number, brake: number, dt: number): void {
    // Speed
    if (throttle > 0.02) this.speed += throttle * this.ACCELERATION * dt;
    if (brake > 0.02) this.speed -= brake * this.BRAKE_DECEL * dt;
    this.speed -= this.DRAG * this.speed * dt;
    this.speed = Math.max(0, Math.min(this.MAX_SPEED, this.speed));

    // Steering (speed-sensitive)
    const steerFactor = this.MAX_STEER_RATE * Math.min(1, (this.speed + 2) / 10);
    this.yaw -= steer * steerFactor * dt;

    // Position — forward = (-sin(yaw), 0, -cos(yaw))
    this.position.x -= Math.sin(this.yaw) * this.speed * dt;
    this.position.z -= Math.cos(this.yaw) * this.speed * dt;

    // Apply to root
    this.root.position.set(this.position.x, CAR_HEIGHT, this.position.z);
    this.root.rotation.y = this.yaw;

    // Exterior chassis roll
    this.exteriorGroup.rotation.z = steer * 0.045 * Math.min(1, this.speed / 12);

    // Front wheel steering
    this.wheelGroupFL.rotation.y = steer * 0.44;
    this.wheelGroupFR.rotation.y = steer * 0.44;

    // Steering wheel rotation — about 2.5 full turns lock-to-lock (steer=±1 → ±450°)
    this.steeringWheelSpinGroup.rotation.z = -steer * Math.PI * 1.25;
  }

  getSpeedKph(): number {
    return this.speed * 3.6;
  }

  getForward(): THREE.Vector3 {
    return new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
  }

  place(x: number, z: number, yaw: number): void {
    this.position.set(x, 0, z);
    this.yaw = yaw;
    this.speed = 0;
    this.root.position.set(x, CAR_HEIGHT, z);
    this.root.rotation.y = yaw;
    this.exteriorGroup.rotation.z = 0;
  }
}
