// SimWorld.ts — Three.js scene: road, terrain, trees, mountains, sky, lighting

import * as THREE from "three";

export type TimeOfDay = "day" | "night";

const CIRCUIT_PTS: [number, number][] = [
  [0, 500], [0, 250], [80, 0], [200, -150],
  [380, -260], [500, -400], [430, -570], [250, -650],
  [0, -680], [-250, -650], [-430, -570], [-500, -380],
  [-380, -200], [-220, -60], [-80, 80], [-30, 300], [-10, 480],
];

const ROAD_HALF_WIDTH = 5.5;
const ROAD_SEGMENTS = 3000;
const ROAD_Y = 0.015;

function makePrng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

// ── Time-of-day presets ────────────────────────────────────────────────────────

const PRESETS = {
  day: {
    bgColor: 0x6ab0e0,
    fogColor: 0x8ecae6,
    fogDensity: 0.0014,
    hemiSky: 0x87ceeb,
    hemiGround: 0x4a7a3a,
    hemiIntensity: 1.0,
    sunColor: 0xfff5d0,
    sunIntensity: 2.8,
    sunPos: new THREE.Vector3(200, 350, -100),
    fillColor: 0xaaccdd,
    fillIntensity: 0.45,
    groundColor: 0x4a8a3a,
    roadColor: 0x303038,
    trunkColor: 0x4a2a10,
    canopyColor: 0x2d5a20,
    mountainColor: 0x4a5a3a,
  },
  night: {
    bgColor: 0x06101e,
    fogColor: 0x06101e,
    fogDensity: 0.0038,
    hemiSky: 0x112244,
    hemiGround: 0x060d06,
    hemiIntensity: 0.55,
    sunColor: 0x8899cc,
    sunIntensity: 0.65,
    sunPos: new THREE.Vector3(-200, 300, 100),
    fillColor: 0x223355,
    fillIntensity: 0.2,
    groundColor: 0x0b160b,
    roadColor: 0x1c1c22,
    trunkColor: 0x1a0f06,
    canopyColor: 0x0d1f0e,
    mountainColor: 0x0c0c14,
  },
} as const;

export class SimWorld {
  private scene: THREE.Scene;
  private roadCurve!: THREE.CatmullRomCurve3;

  // Lights
  private hemiLight!: THREE.HemisphereLight;
  private mainLight!: THREE.DirectionalLight;
  private fillLight!: THREE.DirectionalLight;

  // Materials (updated when time-of-day changes)
  private groundMat!: THREE.MeshPhongMaterial;
  private roadMat!: THREE.MeshPhongMaterial;
  private trunkMesh!: THREE.InstancedMesh;
  private canopyMesh!: THREE.InstancedMesh;
  private mountainMat!: THREE.MeshPhongMaterial;

  // Sky objects
  private sunMesh!: THREE.Mesh;
  private moonMesh!: THREE.Mesh;

  private currentTOD: TimeOfDay = "night";

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.setupSkyAndFog();
    this.setupLighting();
    this.buildGround();
    this.buildRoad();
    this.buildRoadMarkings();
    this.buildTrees();
    this.buildMountains();
    this.buildStreetlights();
    this.buildSkyObjects();
  }

  // ── Sky / Fog ──────────────────────────────────────────────────────────────

  private setupSkyAndFog() {
    const p = PRESETS.night;
    this.scene.background = new THREE.Color(p.bgColor);
    this.scene.fog = new THREE.FogExp2(p.fogColor, p.fogDensity);
  }

  // ── Lighting ───────────────────────────────────────────────────────────────

  private setupLighting() {
    const p = PRESETS.night;
    this.hemiLight = new THREE.HemisphereLight(p.hemiSky, p.hemiGround, p.hemiIntensity);
    this.scene.add(this.hemiLight);

    this.mainLight = new THREE.DirectionalLight(p.sunColor, p.sunIntensity);
    this.mainLight.position.copy(p.sunPos);
    this.mainLight.castShadow = false;
    this.scene.add(this.mainLight);

    this.fillLight = new THREE.DirectionalLight(p.fillColor, p.fillIntensity);
    this.fillLight.position.set(200, 100, -100);
    this.scene.add(this.fillLight);
  }

  // ── Sky objects (sun disc + moon disc) ────────────────────────────────────

  private buildSkyObjects() {
    // Sun — large emissive sphere high in the sky
    this.sunMesh = new THREE.Mesh(
      new THREE.SphereGeometry(22, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xfffacc }),
    );
    this.sunMesh.position.set(200, 380, -100);
    this.sunMesh.visible = false; // hidden in night mode initially
    this.scene.add(this.sunMesh);

    // Sun halo (slightly larger, lower opacity warm sphere)
    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(36, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xffeeaa, transparent: true, opacity: 0.18 }),
    );
    halo.position.copy(this.sunMesh.position);
    halo.visible = false;
    this.sunMesh.userData.halo = halo;
    this.scene.add(halo);

    // Moon — smaller, cooler disc
    this.moonMesh = new THREE.Mesh(
      new THREE.SphereGeometry(14, 14, 14),
      new THREE.MeshBasicMaterial({ color: 0xd8e8f5 }),
    );
    this.moonMesh.position.set(-200, 340, 100);
    this.moonMesh.visible = true; // visible in night mode
    this.scene.add(this.moonMesh);
  }

  // ── Ground plane ──────────────────────────────────────────────────────────

  private buildGround() {
    const p = PRESETS.night;
    this.groundMat = new THREE.MeshPhongMaterial({ color: p.groundColor, shininess: 0 });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000, 1, 1), this.groundMat);
    ground.rotation.x = -Math.PI / 2;
    this.scene.add(ground);
  }

  // ── Road ──────────────────────────────────────────────────────────────────

  private buildRoad() {
    const pts = CIRCUIT_PTS.map(([x, z]) => new THREE.Vector3(x, 0, z));
    this.roadCurve = new THREE.CatmullRomCurve3(pts, true, "catmullrom", 0.5);

    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    const up = new THREE.Vector3(0, 1, 0);
    const tmp = new THREE.Vector3();

    for (let i = 0; i <= ROAD_SEGMENTS; i++) {
      const t = i / ROAD_SEGMENTS;
      const pt = this.roadCurve.getPoint(t);
      const tan = this.roadCurve.getTangent(t).normalize();
      tmp.crossVectors(tan, up).normalize();

      positions.push(
        pt.x - tmp.x * ROAD_HALF_WIDTH, ROAD_Y, pt.z - tmp.z * ROAD_HALF_WIDTH,
        pt.x + tmp.x * ROAD_HALF_WIDTH, ROAD_Y, pt.z + tmp.z * ROAD_HALF_WIDTH,
      );
      normals.push(0, 1, 0, 0, 1, 0);
      uvs.push(0, t * 60, 1, t * 60);
    }

    for (let i = 0; i < ROAD_SEGMENTS; i++) {
      const a = i * 2, b = i * 2 + 1, c = (i + 1) * 2, d = (i + 1) * 2 + 1;
      indices.push(a, c, b, b, c, d);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);

    this.roadMat = new THREE.MeshPhongMaterial({
      color: PRESETS.night.roadColor,
      shininess: 8,
      side: THREE.DoubleSide,
    });
    this.scene.add(new THREE.Mesh(geo, this.roadMat));
  }

  // ── Road markings ─────────────────────────────────────────────────────────

  private buildRoadMarkings() {
    const up = new THREE.Vector3(0, 1, 0);
    const tmp = new THREE.Vector3();
    const MARK_Y = ROAD_Y + 0.008;
    const EDGE_W = 0.22;
    const DASH_W = 0.18;
    const DASH_ON = 0.018;
    const DASH_OFF = 0.025;

    const edgePos: number[] = [];
    const edgeIdx: number[] = [];
    const dashPos: number[] = [];
    const dashIdx: number[] = [];
    let edgeV = 0, dashV = 0, dashCycle = 0, dashOn = true;

    for (let i = 0; i <= ROAD_SEGMENTS; i++) {
      const t = i / ROAD_SEGMENTS;
      const pt = this.roadCurve.getPoint(t);
      const tan = this.roadCurve.getTangent(t).normalize();
      tmp.crossVectors(tan, up).normalize();

      const lo = new THREE.Vector3(pt.x - tmp.x * ROAD_HALF_WIDTH, MARK_Y, pt.z - tmp.z * ROAD_HALF_WIDTH);
      const li = new THREE.Vector3(pt.x - tmp.x * (ROAD_HALF_WIDTH - EDGE_W), MARK_Y, pt.z - tmp.z * (ROAD_HALF_WIDTH - EDGE_W));
      const ri = new THREE.Vector3(pt.x + tmp.x * (ROAD_HALF_WIDTH - EDGE_W), MARK_Y, pt.z + tmp.z * (ROAD_HALF_WIDTH - EDGE_W));
      const ro = new THREE.Vector3(pt.x + tmp.x * ROAD_HALF_WIDTH, MARK_Y, pt.z + tmp.z * ROAD_HALF_WIDTH);

      edgePos.push(lo.x, lo.y, lo.z, li.x, li.y, li.z, ri.x, ri.y, ri.z, ro.x, ro.y, ro.z);
      if (i > 0) {
        const b = edgeV * 4, a = b - 4;
        edgeIdx.push(a, a + 1, b, b, a + 1, b + 1);
        edgeIdx.push(a + 2, a + 3, b + 2, b + 2, a + 3, b + 3);
      }
      edgeV++;

      dashCycle += 1 / ROAD_SEGMENTS;
      const curOn = (dashCycle % (DASH_ON + DASH_OFF)) < DASH_ON;
      if (curOn !== dashOn) dashOn = curOn;
      if (dashOn) {
        const cl = new THREE.Vector3(pt.x - tmp.x * DASH_W, MARK_Y, pt.z - tmp.z * DASH_W);
        const cr = new THREE.Vector3(pt.x + tmp.x * DASH_W, MARK_Y, pt.z + tmp.z * DASH_W);
        dashPos.push(cl.x, cl.y, cl.z, cr.x, cr.y, cr.z);
        if (dashV > 0) {
          const d = dashV * 2, c2 = d - 2;
          dashIdx.push(c2, c2 + 1, d, d, c2 + 1, d + 1);
        }
        dashV++;
      }
    }

    const whiteMat = new THREE.MeshBasicMaterial({ color: 0xdde8f0, side: THREE.DoubleSide });
    if (edgePos.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(edgePos, 3));
      g.setIndex(edgeIdx);
      this.scene.add(new THREE.Mesh(g, whiteMat));
    }
    if (dashPos.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(dashPos, 3));
      g.setIndex(dashIdx);
      this.scene.add(new THREE.Mesh(g, whiteMat));
    }
  }

  // ── Trees ─────────────────────────────────────────────────────────────────

  private buildTrees() {
    const rng = makePrng(42);
    const N = 600;
    const roadUp = new THREE.Vector3(0, 1, 0);
    const roadTmp = new THREE.Vector3();
    const p = PRESETS.night;

    const trunkMat = new THREE.MeshPhongMaterial({ color: p.trunkColor });
    const canopyMat = new THREE.MeshPhongMaterial({ color: p.canopyColor });

    this.trunkMesh = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.18, 0.26, 2.8, 6), trunkMat, N,
    );
    this.canopyMesh = new THREE.InstancedMesh(
      new THREE.ConeGeometry(2.2, 5.0, 7), canopyMat, N,
    );

    const mat4 = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const scl = new THREE.Vector3();

    for (let i = 0; i < N; i++) {
      const t = rng();
      const side = rng() < 0.5 ? -1 : 1;
      const offset = (ROAD_HALF_WIDTH + 4) + rng() * 56;
      const pt = this.roadCurve.getPoint(t);
      const tan = this.roadCurve.getTangent(t).normalize();
      roadTmp.crossVectors(tan, roadUp).normalize();

      const tx = pt.x + roadTmp.x * side * offset;
      const tz = pt.z + roadTmp.z * side * offset;
      const ts = 0.7 + rng() * 0.7;
      quat.setFromAxisAngle(roadUp, rng() * Math.PI * 2);
      scl.set(ts, ts, ts);

      pos.set(tx, 1.4 * ts, tz);
      mat4.compose(pos, quat, scl);
      this.trunkMesh.setMatrixAt(i, mat4);

      pos.set(tx, 1.4 * ts * 2 + 2.5 * ts, tz);
      mat4.compose(pos, quat, scl);
      this.canopyMesh.setMatrixAt(i, mat4);
    }

    this.trunkMesh.instanceMatrix.needsUpdate = true;
    this.canopyMesh.instanceMatrix.needsUpdate = true;
    this.scene.add(this.trunkMesh);
    this.scene.add(this.canopyMesh);
  }

  // ── Mountains ─────────────────────────────────────────────────────────────

  private buildMountains() {
    const rng = makePrng(99);
    this.mountainMat = new THREE.MeshPhongMaterial({
      color: PRESETS.night.mountainColor,
      shininess: 0,
    });
    for (let i = 0; i < 28; i++) {
      const angle = (i / 28) * Math.PI * 2 + rng() * 0.4;
      const radius = 700 + rng() * 300;
      const height = 80 + rng() * 160;
      const geo = new THREE.ConeGeometry(80 + rng() * 100, height, 5 + Math.floor(rng() * 3));
      const mesh = new THREE.Mesh(geo, this.mountainMat);
      mesh.position.set(Math.cos(angle) * radius, height / 2, Math.sin(angle) * radius);
      mesh.rotation.y = rng() * Math.PI * 2;
      this.scene.add(mesh);
    }
  }

  // ── Streetlights ──────────────────────────────────────────────────────────

  private buildStreetlights() {
    const rng = makePrng(7);
    const roadUp = new THREE.Vector3(0, 1, 0);
    const roadTmp = new THREE.Vector3();
    const POLE_SIDE = ROAD_HALF_WIDTH + 1.5;
    const poleMat = new THREE.MeshPhongMaterial({ color: 0x334455 });
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xfff8c0 });
    const totalLen = this.roadCurve.getLength();
    const numLights = Math.floor(totalLen / 80);

    for (let i = 0; i < numLights; i++) {
      const t = i / numLights;
      const pt = this.roadCurve.getPoint(t);
      const tan = this.roadCurve.getTangent(t).normalize();
      roadTmp.crossVectors(tan, roadUp).normalize();
      const side = i % 2 === 0 ? -1 : 1;
      const bx = pt.x + roadTmp.x * side * POLE_SIDE;
      const bz = pt.z + roadTmp.z * side * POLE_SIDE;

      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 8, 6), poleMat);
      pole.position.set(bx, 4, bz);
      this.scene.add(pole);

      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.5, 5), poleMat);
      arm.position.set(bx - roadTmp.x * side * 1.2, 8.2, bz - roadTmp.z * side * 1.2);
      arm.rotation.z = Math.PI / 2;
      this.scene.add(arm);

      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.18, 6, 6), bulbMat);
      bulb.position.set(bx - roadTmp.x * side * 2.4, 8.2, bz - roadTmp.z * side * 2.4);
      this.scene.add(bulb);

      if (i % 4 === 0 && rng() > 0.2) {
        const pl = new THREE.PointLight(0xfff0c0, 0.6, 28);
        pl.position.set(bx - roadTmp.x * side * 2.4, 8, bz - roadTmp.z * side * 2.4);
        this.scene.add(pl);
      }
    }
  }

  // ── Time of day ────────────────────────────────────────────────────────────

  setTimeOfDay(tod: TimeOfDay) {
    if (tod === this.currentTOD) return;
    this.currentTOD = tod;
    const p = PRESETS[tod];

    // Sky + fog
    (this.scene.background as THREE.Color).setHex(p.bgColor);
    (this.scene.fog as THREE.FogExp2).color.setHex(p.fogColor);
    (this.scene.fog as THREE.FogExp2).density = p.fogDensity;

    // Lights
    this.hemiLight.color.setHex(p.hemiSky);
    this.hemiLight.groundColor.setHex(p.hemiGround);
    this.hemiLight.intensity = p.hemiIntensity;
    this.mainLight.color.setHex(p.sunColor);
    this.mainLight.intensity = p.sunIntensity;
    this.mainLight.position.copy(p.sunPos);
    this.fillLight.color.setHex(p.fillColor);
    this.fillLight.intensity = p.fillIntensity;

    // Materials
    this.groundMat.color.setHex(p.groundColor);
    this.roadMat.color.setHex(p.roadColor);
    (this.trunkMesh.material as THREE.MeshPhongMaterial).color.setHex(p.trunkColor);
    (this.canopyMesh.material as THREE.MeshPhongMaterial).color.setHex(p.canopyColor);
    this.mountainMat.color.setHex(p.mountainColor);

    // Sky objects
    this.sunMesh.visible = tod === "day";
    (this.sunMesh.userData.halo as THREE.Mesh).visible = tod === "day";
    this.moonMesh.visible = tod === "night";
  }

  // ── Public helpers ─────────────────────────────────────────────────────────

  getRoadStart(): { x: number; z: number; yaw: number } {
    const pt = this.roadCurve.getPoint(0);
    const tan = this.roadCurve.getTangent(0).normalize();
    const yaw = Math.atan2(-tan.x, -tan.z);
    return { x: pt.x, z: pt.z, yaw };
  }
}
