// SimEngine.ts — FPV-only engine (clean + aligned with new SimCar)

import * as THREE from "three";
import { SimWorld } from "./SimWorld";
import type { TimeOfDay } from "./SimWorld";
import { SimCar, EYE_LOCAL } from "./SimCar";
import { GamepadDriver } from "./GamepadDriver";
import type { GamepadState } from "./GamepadDriver";

export interface SimTickState {
  speedKph: number;
  gpState: GamepadState;
  gear: string;
}

// ── Keyboard ─────────────────────────────────────────────

class KeyboardTracker {
  private keys = new Set<string>();

  private onDown = (e: KeyboardEvent) => this.keys.add(e.code);
  private onUp = (e: KeyboardEvent) => this.keys.delete(e.code);

  constructor() {
    window.addEventListener("keydown", this.onDown);
    window.addEventListener("keyup", this.onUp);
  }

  getInputs() {
    const right = this.keys.has("ArrowRight") || this.keys.has("KeyD") ? 1 : 0;
    const left = this.keys.has("ArrowLeft") || this.keys.has("KeyA") ? 1 : 0;
    const throttle = this.keys.has("ArrowUp") || this.keys.has("KeyW") ? 1 : 0;
    const brake = this.keys.has("ArrowDown") || this.keys.has("KeyS") ? 1 : 0;

    return {
      steer: right - left,
      throttle,
      brake,
    };
  }

  dispose() {
    window.removeEventListener("keydown", this.onDown);
    window.removeEventListener("keyup", this.onUp);
  }
}

// ── Engine ───────────────────────────────────────────────

const CAR_HEIGHT = 0.66;

export class SimEngine {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;

  private world: SimWorld;
  private car: SimCar;

  private gamepad: GamepadDriver;
  private keyboard: KeyboardTracker;

  private lastTime = 0;
  private animFrame = 0;

  private resizeObserver: ResizeObserver;

  // Crash detection
  private shakeTime = 0;
  private crashCooldown = 0;
  private readonly SHAKE_DURATION = 1.2;
  private readonly SHAKE_INTENSITY = 0.14;
  private readonly CAR_RADIUS = 0.95; // half the car body width

  onTick?: (state: SimTickState) => void;
  onCrash?: (speedKph: number) => void;

  constructor(canvas: HTMLCanvasElement) {
    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Scene
    this.scene = new THREE.Scene();

    // Camera (FPV tuned)
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 700);

    // World + Car
    this.world = new SimWorld(this.scene);
    this.car = new SimCar(this.scene);

    const start = this.world.getRoadStart();
    this.car.place(start.x, start.z, start.yaw);

    // Input
    this.gamepad = new GamepadDriver();
    this.keyboard = new KeyboardTracker();

    // Resize
    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(canvas);
    this.handleResize();
  }

  private handleResize() {
    const canvas = this.renderer.domElement;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight || 1;

    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  setTimeOfDay(tod: TimeOfDay) {
    this.world.setTimeOfDay(tod);
  }

  resetSpeed() {
    this.car.speed = 0;
  }

  start() {
    this.lastTime = performance.now();
    this.tick(this.lastTime);
  }

  private tick(now: number) {
    this.animFrame = requestAnimationFrame((t) => this.tick(t));

    const dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;

    // Inputs
    const gp = this.gamepad.getState();
    const kb = this.keyboard.getInputs();

    const steer = gp.connected ? gp.steer : kb.steer;
    const throttle = gp.connected ? gp.throttle : kb.throttle;
    const brake = gp.connected ? gp.brake : kb.brake;

    // Physics
    this.car.update(steer, throttle, brake, dt);

    // Crash detection
    this.checkCrash(dt);

    // Camera (FPV ONLY)
    this.updateFPVCamera();

    // Render
    this.renderer.render(this.scene, this.camera);

    // HUD
    const kph = this.car.getSpeedKph();

    this.onTick?.({
      speedKph: kph,
      gpState: gp,
      gear:
        kph < 1
          ? "N"
          : kph < 30
          ? "1"
          : kph < 60
          ? "2"
          : kph < 90
          ? "3"
          : kph < 130
          ? "4"
          : "5",
    });
  }

  private checkCrash(dt: number) {
    if (this.shakeTime > 0) this.shakeTime -= dt;
    if (this.crashCooldown > 0) {
      this.crashCooldown -= dt;
      return;
    }
    const cx = this.car.position.x;
    const cz = this.car.position.z;
    for (const obj of this.world.getCollisionObjects()) {
      const dx = cx - obj.x;
      const dz = cz - obj.z;
      const distSq = dx * dx + dz * dz;
      const threshold = this.CAR_RADIUS + obj.radius;
      if (distSq < threshold * threshold) {
        const kph = this.car.getSpeedKph();
        this.car.crashSlowdown();
        this.shakeTime = this.SHAKE_DURATION;
        this.crashCooldown = 5.0;
        this.onCrash?.(kph);
        return;
      }
    }
  }

  // 🔥 PERFECT FPV CAMERA
  private updateFPVCamera() {
    const carPos = this.car.position;
    const fwd = this.car.getForward();

    const cosY = Math.cos(this.car.yaw);
    const sinY = Math.sin(this.car.yaw);

    const ex = EYE_LOCAL.x * cosY + EYE_LOCAL.z * sinY;
    const ez = -EYE_LOCAL.x * sinY + EYE_LOCAL.z * cosY;

    const eye = new THREE.Vector3(
      carPos.x + ex,
      CAR_HEIGHT + EYE_LOCAL.y,
      carPos.z + ez
    );

    // 🔥 This is what makes it match your screenshot
    const look = new THREE.Vector3(
      eye.x + fwd.x * 60,
      eye.y - 0.75,
      eye.z + fwd.z * 60
    );

    // Apply crash camera shake
    if (this.shakeTime > 0) {
      const t = this.shakeTime / this.SHAKE_DURATION;
      const s = t * this.SHAKE_INTENSITY;
      eye.x += (Math.random() - 0.5) * 2 * s;
      eye.y += (Math.random() - 0.5) * s * 0.6;
      look.x += (Math.random() - 0.5) * s * 3;
      look.y += (Math.random() - 0.5) * s;
    }

    this.camera.position.copy(eye);
    this.camera.lookAt(look);
  }

  dispose() {
    cancelAnimationFrame(this.animFrame);
    this.resizeObserver.disconnect();
    this.keyboard.dispose();

    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.InstancedMesh) {
        if (obj.geometry) {
          obj.geometry.dispose();
        }
        if (obj.material) {
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => {
              if (m && typeof m.dispose === 'function') {
                m.dispose();
              }
            });
          } else if (typeof obj.material.dispose === 'function') {
            obj.material.dispose();
          }
        }
      }
    });

    this.renderer.dispose();
  }
}