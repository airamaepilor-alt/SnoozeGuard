import * as THREE from "three";

const CAR_HEIGHT = 0.66;
const WHEEL_RADIUS = 0.38;

// tuned specifically for your screenshot alignment
export const EYE_LOCAL = new THREE.Vector3(0, 0.78, -0.15);

export class SimCar {
  readonly root: THREE.Group;
  private steeringAngle = 0;  
  position = new THREE.Vector3();
  yaw = 0;
  speed = 0;

  private readonly MAX_SPEED = 50;        // m/s ≈ 180 km/h ceiling
  private readonly ACCEL_RATE = 10 / 3.6; // +10 km/h per second (linear phase)
  private readonly DECEL_RATE = 5 / 3.6;  // −5 km/h per second when coasting
  private readonly BRAKE_RATE = 25 / 3.6; // −25 km/h per second under braking
  private readonly MAX_STEER_RATE = 0.85; // halved — less twitchy at speed
  private readonly MAX_STEERING_ANGLE = Math.PI / 4;
  private readonly STEERING_WHEEL_RESPONSE = 1.8; // slower wheel weight feel
  private readonly STEERING_WHEEL_GEAR_RATIO = 15; // wheel rotation multiplier

  private interior: THREE.Group;
  private exterior: THREE.Group;
  private steeringWheel!: THREE.Group;
  private wheelFL!: THREE.Group;
  private wheelFR!: THREE.Group;

  constructor(scene: THREE.Scene) {
    this.root = new THREE.Group();
    scene.add(this.root);

    this.exterior = new THREE.Group();
    this.interior = new THREE.Group();

    this.root.add(this.exterior);
    this.root.add(this.interior);

    this.buildExterior();
    this.buildInterior();

    this.root.position.y = CAR_HEIGHT;
  }

  // ─────────────────────────────────────────
  // EXTERIOR (kept simple)
  // ─────────────────────────────────────────
  private buildExterior() {
    const bodyMat = new THREE.MeshPhongMaterial({ color: 0x1a3a6b });
    const wheelMat = new THREE.MeshPhongMaterial({ color: 0x111 });

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(1.9, 0.5, 4.2),
      bodyMat
    );
    this.exterior.add(body);

    const makeWheel = (x: number, z: number) => {
      const g = new THREE.Group();
      g.position.set(x, -0.28, z);

      const tire = new THREE.Mesh(
        new THREE.CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, 0.25, 16),
        wheelMat
      );
      tire.rotation.z = Math.PI / 2;
      g.add(tire);

      this.exterior.add(g);
      return g;
    };

    this.wheelFL = makeWheel(-0.9, -1.3);
    this.wheelFR = makeWheel(0.9, -1.3);
    makeWheel(-0.9, 1.3);
    makeWheel(0.9, 1.3);
  }

  // ─────────────────────────────────────────
  // INTERIOR (FPV ONLY — CLEAN)
  // ─────────────────────────────────────────
  private buildInterior() {
    const dashMat = new THREE.MeshPhongMaterial({ color: 0x202020 });
    const darkMat = new THREE.MeshPhongMaterial({ color: 0x0f0f0f });
    const bodyMat = new THREE.MeshPhongMaterial({ color: 0x1a3a6b });

    // LOW PROFILE DASH (just the top edge)
    const dash = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 0.12, 0.6),
      dashMat
    );
    dash.position.set(0, 0.32, -1.05);
    this.interior.add(dash);

    // SMOOTH DASH TOP (what you see in screenshot)
    const dashTop = new THREE.Mesh(
      new THREE.BoxGeometry(2.0, 0.05, 0.9),
      darkMat
    );
    dashTop.position.set(0, 0.38, -0.8);
    this.interior.add(dashTop);

    // HOOD (very important for realism)
    const hood = new THREE.Mesh(
      new THREE.BoxGeometry(1.9, 0.02, 0.7),
      bodyMat
    );
    hood.position.set(0, 0.26, -1.6);
    this.interior.add(hood);

    // ─── Steering wheel ───
    const wheelTilt = new THREE.Group();
    wheelTilt.position.set(0, 0.42, -0.65);
    wheelTilt.rotation.x = -0.5;
    this.interior.add(wheelTilt);

    this.steeringWheel = new THREE.Group();
    wheelTilt.add(this.steeringWheel);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.18, 0.02, 10, 40),
      new THREE.MeshPhongMaterial({ color: 0x111 })
    );
    this.steeringWheel.add(ring);

    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 0.03, 12),
      new THREE.MeshPhongMaterial({ color: 0x222 })
    );
    hub.rotation.x = Math.PI / 2;
    this.steeringWheel.add(hub);

    // spokes
    for (let i = 0; i < 3; i++) {
      const spoke = new THREE.Mesh(
        new THREE.CylinderGeometry(0.018, 0.018, 0.28, 8),
        new THREE.MeshPhongMaterial({ color: 0x444 })
      );
      const angle = (i / 3) * Math.PI * 2;
      spoke.position.set(
        Math.cos(angle) * 0.08,
        Math.sin(angle) * 0.08,
        0
      );
      spoke.rotation.z = angle;
      this.steeringWheel.add(spoke);
    }
  }

  // ─────────────────────────────────────────
  // UPDATE LOOP
  // ─────────────────────────────────────────
  update(steer: number, throttle: number, brake: number, dt: number) {
    const pedal = (raw: number, dz: number) =>
      raw <= dz ? 0 : (raw - dz) / (1 - dz);

    const t = pedal(throttle, 0.10);
    const b = pedal(brake,    0.05);

    // ── Throttle / coast (two-phase model, accelerator only) ──────────
    if (t > 0) {
      const kph = this.speed * 3.6;
      // 0–50 km/h: linear +10 km/h/s (≈ first 5 s at full throttle).
      // 50–70 km/h: blend into quadratic.
      // 70+ km/h: quadratic only — gradually harder to gain speed.
      const phase = Math.min(1, Math.max(0, (kph - 50) / 20));
      const rate = (1 - phase) * (t * this.ACCEL_RATE)
                 + phase        * (t * t * 0.35 * this.ACCEL_RATE);
      this.speed += rate * dt;
    } else {
      // Releasing accelerator: coast down at fixed rate
      this.speed -= this.DECEL_RATE * dt;
    }

    // ── Brake (fully independent of throttle model) ────────────────────
    if (b > 0) {
      this.speed -= b * this.BRAKE_RATE * dt;
    }

    this.speed = Math.max(0, Math.min(this.MAX_SPEED, this.speed));

    // Update steering angle smoothly (accumulate steering input)
    const targetSteeringAngle = steer * this.MAX_STEERING_ANGLE;
    const steerDiff = targetSteeringAngle - this.steeringAngle;
    this.steeringAngle += Math.sign(steerDiff) * Math.min(Math.abs(steerDiff), this.STEERING_WHEEL_RESPONSE * dt);

    // Apply steering to yaw
    const steerFactor =
      this.MAX_STEER_RATE * Math.min(1, (this.speed + 2) / 10);
    this.yaw -= this.steeringAngle * steerFactor * dt;

    this.position.x -= Math.sin(this.yaw) * this.speed * dt;
    this.position.z -= Math.cos(this.yaw) * this.speed * dt;

    this.root.position.set(this.position.x, CAR_HEIGHT, this.position.z);
    this.root.rotation.y = this.yaw;

    // wheel steering
    this.wheelFL.rotation.y = this.steeringAngle * 0.4;
    this.wheelFR.rotation.y = this.steeringAngle * 0.4;

    // steering wheel rotation (realistic gear ratio, ±540° from ±45° steering angle)
    this.steeringWheel.rotation.z = -this.steeringAngle * this.STEERING_WHEEL_GEAR_RATIO;
  }

  getSpeedKph() {
    return this.speed * 3.6;
  }

  crashSlowdown() {
    this.speed *= 0.1;
  }

  getForward() {
    return new THREE.Vector3(
      -Math.sin(this.yaw),
      0,
      -Math.cos(this.yaw)
    );
  }

  place(x: number, z: number, yaw: number) {
    this.position.set(x, 0, z);
    this.yaw = yaw;
    this.speed = 0;

    this.root.position.set(x, CAR_HEIGHT, z);
    this.root.rotation.y = yaw;
  }
}