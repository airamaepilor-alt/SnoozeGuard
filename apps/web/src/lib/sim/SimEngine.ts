// SimEngine.ts — render loop, camera, input routing

import * as THREE from "three";
import { SimWorld } from "./SimWorld";
import type { TimeOfDay } from "./SimWorld";
import { SimCar, EYE_LOCAL } from "./SimCar";
import { GamepadDriver } from "./GamepadDriver";
import type { GamepadState } from "./GamepadDriver";

export type CameraMode = "first" | "third";

export interface SimTickState {
  speedKph: number;
  gpState: GamepadState;
  gear: string;
}

// ── Keyboard state tracker ───────────────────────────────────────────────────

class KeyboardTracker {
  private keys = new Set<string>();
  private readonly onDown: (e: KeyboardEvent) => void;
  private readonly onUp: (e: KeyboardEvent) => void;

  constructor() {
    this.onDown = (e) => this.keys.add(e.code);
    this.onUp = (e) => this.keys.delete(e.code);
    window.addEventListener("keydown", this.onDown);
    window.addEventListener("keyup", this.onUp);
  }

  getInputs(): { steer: number; throttle: number; brake: number } {
    const right = this.keys.has("ArrowRight") || this.keys.has("KeyD") ? 1 : 0;
    const left = this.keys.has("ArrowLeft") || this.keys.has("KeyA") ? 1 : 0;
    const throttle = this.keys.has("ArrowUp") || this.keys.has("KeyW") ? 1 : 0;
    const brake = this.keys.has("ArrowDown") || this.keys.has("KeyS") ? 1 : 0;
    return { steer: right - left, throttle, brake };
  }

  dispose() {
    window.removeEventListener("keydown", this.onDown);
    window.removeEventListener("keyup", this.onUp);
  }
}

// ── SimEngine ────────────────────────────────────────────────────────────────

const CAR_HEIGHT = 0.66; // must match SimCar

export class SimEngine {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;

  private world!: SimWorld;
  private car!: SimCar;
  private gamepad: GamepadDriver;
  private keyboard: KeyboardTracker;

  private animFrame = 0;
  private lastTime = 0;
  private cameraMode: CameraMode = "third";
  private resizeObserver: ResizeObserver;

  // Smooth camera lag target
  private camTarget = new THREE.Vector3();
  private camLookAt = new THREE.Vector3();

  /** React can subscribe to each frame's state for HUD updates. */
  onTick?: (state: SimTickState) => void;

  constructor(canvas: HTMLCanvasElement) {
    // ── Renderer ──────────────────────────────────────────────────────────
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = false; // kept off for performance

    // ── Scene ─────────────────────────────────────────────────────────────
    this.scene = new THREE.Scene();

    // ── Camera ────────────────────────────────────────────────────────────
    this.camera = new THREE.PerspectiveCamera(70, 1, 0.1, 700);

    // ── World & car (world sets scene background/fog/lights/road) ─────────
    this.world = new SimWorld(this.scene);
    this.car = new SimCar(this.scene);

    const start = this.world.getRoadStart();
    this.car.place(start.x, start.z, start.yaw);

    // Initialise camera targets to avoid a jump on first frame
    this.camTarget.set(start.x, CAR_HEIGHT + 5, start.z + 8);
    this.camLookAt.set(start.x, CAR_HEIGHT, start.z - 4);
    this.camera.position.copy(this.camTarget);
    this.camera.lookAt(this.camLookAt);

    // ── Input ─────────────────────────────────────────────────────────────
    this.gamepad = new GamepadDriver();
    this.keyboard = new KeyboardTracker();

    // ── Resize handling ───────────────────────────────────────────────────
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

  setCameraMode(mode: CameraMode) {
    this.cameraMode = mode;
    if (mode === "first") {
      // Hide exterior body (avoids clipping/z-fight), show cockpit interior
      this.car.showExterior(false);
      this.car.showInterior(true);
      this.camera.fov = 60; // narrower FOV feels more immersive in cockpit
    } else {
      this.car.showExterior(true);
      this.car.showInterior(false);
      this.camera.fov = 70;
    }
    this.camera.updateProjectionMatrix();
  }

  setTimeOfDay(tod: TimeOfDay) {
    this.world.setTimeOfDay(tod);
  }

  start() {
    this.lastTime = performance.now();
    this.tick(this.lastTime);
  }

  private tick(now: number) {
    this.animFrame = requestAnimationFrame((t) => this.tick(t));

    const dt = Math.min((now - this.lastTime) / 1000, 0.05); // cap at 50 ms
    this.lastTime = now;

    // ── Inputs ────────────────────────────────────────────────────────────
    const gp = this.gamepad.getState();
    const kb = this.keyboard.getInputs();

    const steer = gp.connected ? gp.steer : kb.steer;
    const throttle = gp.connected ? gp.throttle : kb.throttle;
    const brake = gp.connected ? gp.brake : kb.brake;

    // ── Physics ───────────────────────────────────────────────────────────
    this.car.update(steer, throttle, brake, dt);

    // ── Camera ────────────────────────────────────────────────────────────
    this.updateCamera(dt);

    // ── Render ────────────────────────────────────────────────────────────
    this.renderer.render(this.scene, this.camera);

    // ── Notify React HUD ─────────────────────────────────────────────────
    const kph = this.car.getSpeedKph();
    this.onTick?.({
      speedKph: kph,
      gpState: gp,
      gear: kph < 1 ? "N" : kph < 30 ? "1" : kph < 60 ? "2" : kph < 90 ? "3" : kph < 130 ? "4" : "5",
    });
  }

  private updateCamera(dt: number) {
    const carPos = this.car.position; // XZ, y=0
    const fwd = this.car.getForward(); // normalised, XZ plane

    const carWorldY = CAR_HEIGHT;

    if (this.cameraMode === "third") {
      // Camera sits 8 m behind and 5 m above the car, looking 6 m ahead of it
      const backward = fwd.clone().negate();
      const desiredCamPos = new THREE.Vector3(
        carPos.x + backward.x * 8,
        carWorldY + 5,
        carPos.z + backward.z * 8,
      );
      const desiredLookAt = new THREE.Vector3(
        carPos.x + fwd.x * 6,
        carWorldY - 0.3,
        carPos.z + fwd.z * 6,
      );

      // Smooth lag (lerp factor tuned to feel good at 60fps)
      const lag = 1 - Math.pow(0.04, dt);
      this.camTarget.lerp(desiredCamPos, lag);
      this.camLookAt.lerp(desiredLookAt, lag);

      this.camera.position.copy(this.camTarget);
      this.camera.lookAt(this.camLookAt);
    } else {
      // First person — driver's eye inside the cockpit.
      // EYE_LOCAL is the offset in car-root local space: (0, 0.69, -0.2).
      // Transform by the car's Y-rotation only (root never pitches/rolls).
      const cosY = Math.cos(this.car.yaw);
      const sinY = Math.sin(this.car.yaw);
      // Three.js Y-rotation matrix: x' = x*cosY + z*sinY, z' = -x*sinY + z*cosY
      const ex = EYE_LOCAL.x * cosY + EYE_LOCAL.z * sinY;
      const ez = -EYE_LOCAL.x * sinY + EYE_LOCAL.z * cosY;

      const eyePos = new THREE.Vector3(
        carPos.x + ex,
        CAR_HEIGHT + EYE_LOCAL.y,
        carPos.z + ez,
      );

      // Aim ahead with a ~1.7° downward tilt so the road fills the lower frame
      // and the steering wheel naturally sits in the bottom third of view.
      const lookTarget = new THREE.Vector3(
        eyePos.x + fwd.x * 50,
        eyePos.y - 1.5,
        eyePos.z + fwd.z * 50,
      );

      this.camera.position.copy(eyePos);
      this.camera.lookAt(lookTarget);
    }
  }

  dispose() {
    cancelAnimationFrame(this.animFrame);
    this.resizeObserver.disconnect();
    this.keyboard.dispose();

    // Dispose all scene geometries and materials
    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.InstancedMesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else {
          (obj.material as THREE.Material).dispose();
        }
      }
    });

    this.renderer.dispose();
  }
}
