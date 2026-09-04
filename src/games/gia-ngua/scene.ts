import * as THREE from 'three';
import { gsap } from 'gsap';
import type {
  FoodType,
  GearItem,
  GiaNguaPersistentState,
  GiaNguaChangeEvent,
} from './rules';
import {
  SCALE_FACTORS,
  SIZE_STAGE_NAMES,
  GEAR_NAMES,
  FOOD_NAMES,
  getGiaNguaState,
  loadState,
  driveFeed,
  driveEquip,
  driveTestFire,
  driveReset,
  onGiaNguaChange,
} from './rules';
import { playSFX } from '../../audio';
import { reducedMotion } from '../../motion';
import { getWebMCPStatus, showToast } from '../../ui';

let rootEl: HTMLElement | null = null;
let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;
let frameId = 0;
let resizeObserver: ResizeObserver | null = null;
let unsubscribeChange: (() => void) | null = null;
let gsapCtx: gsap.Context | null = null;
let boundHandlers: {
  canvasWrap: HTMLElement;
  onPointerDown: (e: MouseEvent | TouchEvent) => void;
  onPointerMove: (e: MouseEvent | TouchEvent) => void;
  onPointerUp: () => void;
} | null = null;

function safeGsapTo(target: gsap.TweenTarget, vars: gsap.TweenVars): gsap.core.Tween {
  return gsapCtx ? gsapCtx.add(() => gsap.to(target, vars)) : gsap.to(target, vars);
}

// Three.js object references
let horseGroup: THREE.Group | null = null;
let headGroup: THREE.Group | null = null;
let snoutPoint: THREE.Object3D | null = null;
let headAnchor: THREE.Object3D | null = null;
let backAnchor: THREE.Object3D | null = null;
let sideLeftAnchor: THREE.Object3D | null = null;
let sideRightAnchor: THREE.Object3D | null = null;
let snoutLight: THREE.PointLight | null = null;

// Attached gear meshes
const gearMeshes: Map<GearItem, THREE.Object3D> = new Map();

// Particle system references
const MAX_PARTICLES = 200;
let particlePoints: THREE.Points | null = null;
let particlePositions: Float32Array | null = null;
let particleColors: Float32Array | null = null;

interface ParticleData {
  active: boolean;
  type: 'fire' | 'smoke';
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  r: number;
  g: number;
  b: number;
}
const particlesData: ParticleData[] = [];

// Animation state
let fireRemainingSeconds = 0;
let clock: THREE.Clock | null = null;
let isVictoryDancing = false;
let victoryDanceTimer: number | null = null;

// DOM references
let hungerFillEl: HTMLElement | null = null;
let hungerValEl: HTMLElement | null = null;
let sizeStageEl: HTMLElement | null = null;
let bestRecordEl: HTMLElement | null = null;
let dockEl: HTMLElement | null = null;

function initParticles(): void {
  particlesData.length = 0;
  for (let i = 0; i < MAX_PARTICLES; i++) {
    particlesData.push({
      active: false,
      type: 'fire',
      x: 0,
      y: -999,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      life: 0,
      maxLife: 1,
      r: 1,
      g: 0.5,
      b: 0,
    });
  }

  particlePositions = new Float32Array(MAX_PARTICLES * 3);
  particleColors = new Float32Array(MAX_PARTICLES * 3);

  for (let i = 0; i < MAX_PARTICLES; i++) {
    particlePositions[i * 3 + 0] = 0;
    particlePositions[i * 3 + 1] = -999;
    particlePositions[i * 3 + 2] = 0;

    particleColors[i * 3 + 0] = 1;
    particleColors[i * 3 + 1] = 0.5;
    particleColors[i * 3 + 2] = 0;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.BufferAttribute(particlePositions, 3)
  );
  geometry.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));

  const material = new THREE.PointsMaterial({
    size: 0.22,
    vertexColors: true,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  particlePoints = new THREE.Points(geometry, material);
  if (scene) {
    scene.add(particlePoints);
  }
}

function spawnFireParticle(): void {
  if (!snoutPoint) return;
  const p = particlesData.find((pt) => !pt.active);
  if (!p) return;

  const worldPos = new THREE.Vector3();
  snoutPoint.getWorldPosition(worldPos);

  p.active = true;
  p.type = 'fire';
  p.x = worldPos.x;
  p.y = worldPos.y;
  p.z = worldPos.z;

  // Snout orientation direction vector (forward + slightly right/down)
  const forward = new THREE.Vector3(0.8, -0.1, 1.2).normalize();
  const spreadX = (Math.random() - 0.5) * 0.6;
  const spreadY = (Math.random() - 0.3) * 0.5;
  const spreadZ = (Math.random() - 0.5) * 0.6;

  const speed = 2.5 + Math.random() * 2.0;
  p.vx = forward.x * speed + spreadX;
  p.vy = forward.y * speed + spreadY;
  p.vz = forward.z * speed + spreadZ;

  p.life = 0.4 + Math.random() * 0.4;
  p.maxLife = p.life;

  // Fire color: from bright yellow-white to orange-red
  p.r = 1.0;
  p.g = 0.35 + Math.random() * 0.55;
  p.b = 0.05 + Math.random() * 0.15;
}

function spawnSmokeParticle(isBelch = false): void {
  if (!snoutPoint) return;
  const p = particlesData.find((pt) => !pt.active);
  if (!p) return;

  const worldPos = new THREE.Vector3();
  snoutPoint.getWorldPosition(worldPos);

  p.active = true;
  p.type = 'smoke';
  p.x = worldPos.x + (Math.random() - 0.5) * 0.2;
  p.y = worldPos.y + (Math.random() - 0.5) * 0.1;
  p.z = worldPos.z + (Math.random() - 0.5) * 0.2;

  const mult = isBelch ? 1.4 : 0.8;
  p.vx = (Math.random() - 0.3) * 0.4 * mult;
  p.vy = (0.6 + Math.random() * 0.7) * mult;
  p.vz = (Math.random() - 0.3) * 0.4 * mult;

  p.life = 0.8 + Math.random() * 0.7;
  p.maxLife = p.life;

  // Ash gray color
  const gray = 0.55 + Math.random() * 0.25;
  p.r = gray;
  p.g = gray * 0.95;
  p.b = gray * 0.9;
}

function triggerSmokeBurst(isBelch = false): void {
  const count = isBelch ? 30 : 16;
  for (let i = 0; i < count; i++) {
    spawnSmokeParticle(isBelch);
  }
}

/**
 * Builds the procedural low-poly dark grey Iron Horse
 */
function buildHorse(): THREE.Group {
  const horse = new THREE.Group();
  horse.position.set(0, 0, 0);

  // Materials
  const ironBodyMat = new THREE.MeshStandardMaterial({
    color: 0x3d4147,
    roughness: 0.35,
    metalness: 0.7,
  });
  const ironJointMat = new THREE.MeshStandardMaterial({
    color: 0x2b2e32,
    roughness: 0.4,
    metalness: 0.8,
  });
  const bronzeTrimMat = new THREE.MeshStandardMaterial({
    color: 0xb8860b,
    roughness: 0.3,
    metalness: 0.85,
  });
  const glowingEyeMat = new THREE.MeshStandardMaterial({
    color: 0xff3b30,
    emissive: 0xff2200,
    emissiveIntensity: 0.8,
  });

  // 1. Torso
  const torsoGeo = new THREE.BoxGeometry(1.2, 0.95, 2.0);
  const torso = new THREE.Mesh(torsoGeo, ironBodyMat);
  torso.position.set(0, 1.4, 0);
  torso.castShadow = true;
  torso.receiveShadow = true;
  horse.add(torso);

  // Torso side plates
  const sidePlateGeo = new THREE.BoxGeometry(1.26, 0.5, 1.4);
  const sidePlate = new THREE.Mesh(sidePlateGeo, ironJointMat);
  sidePlate.position.set(0, 1.4, 0);
  horse.add(sidePlate);

  // 2. Four Legs
  const legPositions: [number, number, number][] = [
    [-0.45, 0.65, 0.75],  // front left
    [0.45, 0.65, 0.75],   // front right
    [-0.45, 0.65, -0.75], // back left
    [0.45, 0.65, -0.75],  // back right
  ];

  for (const pos of legPositions) {
    const legGeo = new THREE.BoxGeometry(0.24, 1.3, 0.24);
    const leg = new THREE.Mesh(legGeo, ironBodyMat);
    leg.position.set(pos[0], pos[1], pos[2]);
    leg.castShadow = true;
    horse.add(leg);

    // Hoof
    const hoofGeo = new THREE.BoxGeometry(0.28, 0.2, 0.32);
    const hoof = new THREE.Mesh(hoofGeo, bronzeTrimMat);
    hoof.position.set(pos[0], 0.1, pos[2]);
    hoof.castShadow = true;
    horse.add(hoof);
  }

  // 3. Neck
  const neckGroup = new THREE.Group();
  neckGroup.position.set(0, 1.65, 0.85);
  neckGroup.rotation.x = Math.PI / 6; // Angle upward

  const neckGeo = new THREE.BoxGeometry(0.42, 0.9, 0.5);
  const neck = new THREE.Mesh(neckGeo, ironBodyMat);
  neck.position.set(0, 0.45, 0);
  neck.castShadow = true;
  neckGroup.add(neck);

  // Mane along the neck
  const maneGeo = new THREE.BoxGeometry(0.12, 0.85, 0.2);
  const mane = new THREE.Mesh(maneGeo, bronzeTrimMat);
  mane.position.set(0, 0.45, -0.28);
  neckGroup.add(mane);

  horse.add(neckGroup);

  // 4. Head
  headGroup = new THREE.Group();
  headGroup.position.set(0, 0.9, 0.1);
  headGroup.rotation.x = -Math.PI / 6; // Orient head horizontal

  const skullGeo = new THREE.BoxGeometry(0.46, 0.48, 0.65);
  const skull = new THREE.Mesh(skullGeo, ironBodyMat);
  skull.position.set(0, 0, 0.1);
  skull.castShadow = true;
  headGroup.add(skull);

  // Snout / Muzzle
  const snoutGeo = new THREE.BoxGeometry(0.38, 0.34, 0.5);
  const snout = new THREE.Mesh(snoutGeo, ironJointMat);
  snout.position.set(0, -0.06, 0.6);
  snout.castShadow = true;
  headGroup.add(snout);

  // Snout nostrils / emitter point
  snoutPoint = new THREE.Object3D();
  snoutPoint.position.set(0, -0.05, 0.88);
  headGroup.add(snoutPoint);

  // Snout fire point light
  snoutLight = new THREE.PointLight(0xff5722, 0, 8);
  snoutLight.position.set(0, 0, 0.2);
  snoutPoint.add(snoutLight);

  // Glowing eyes
  const eyeLeft = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.14), glowingEyeMat);
  eyeLeft.position.set(-0.24, 0.1, 0.15);
  headGroup.add(eyeLeft);

  const eyeRight = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.14), glowingEyeMat);
  eyeRight.position.set(0.24, 0.1, 0.15);
  headGroup.add(eyeRight);

  // Ears
  const earGeo = new THREE.ConeGeometry(0.08, 0.22, 4);
  const earLeft = new THREE.Mesh(earGeo, bronzeTrimMat);
  earLeft.position.set(-0.16, 0.32, -0.15);
  earLeft.rotation.z = -0.2;
  headGroup.add(earLeft);

  const earRight = new THREE.Mesh(earGeo, bronzeTrimMat);
  earRight.position.set(0.16, 0.32, -0.15);
  earRight.rotation.z = 0.2;
  headGroup.add(earRight);

  // Head Anchor for Helmet
  headAnchor = new THREE.Object3D();
  headAnchor.position.set(0, 0.26, 0.1);
  headGroup.add(headAnchor);

  neckGroup.add(headGroup);

  // 5. Back Anchor for Armor
  backAnchor = new THREE.Object3D();
  backAnchor.position.set(0, 1.88, 0);
  horse.add(backAnchor);

  // 6. Side Anchors for Bamboo Whip and Sword
  sideLeftAnchor = new THREE.Object3D();
  sideLeftAnchor.position.set(-0.68, 1.5, 0.1);
  horse.add(sideLeftAnchor);

  sideRightAnchor = new THREE.Object3D();
  sideRightAnchor.position.set(0.68, 1.5, 0.1);
  horse.add(sideRightAnchor);

  // 7. Tail
  const tailGroup = new THREE.Group();
  tailGroup.position.set(0, 1.7, -1.0);
  tailGroup.rotation.x = -Math.PI / 4;
  const tailMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.9, 0.14),
    bronzeTrimMat
  );
  tailMesh.position.set(0, -0.45, 0);
  tailGroup.add(tailMesh);
  horse.add(tailGroup);

  // Slight angle facing towards camera
  horse.rotation.y = -Math.PI / 6;

  return horse;
}

/**
 * Builds gear primitive meshes
 */
function createGearMesh(item: GearItem): THREE.Object3D {
  const group = new THREE.Group();

  if (item === 'iron_hat') {
    // Mũ sắt: Conical iron helmet with golden rim & red tassel
    const hatMat = new THREE.MeshStandardMaterial({
      color: 0x7f8c8d,
      roughness: 0.3,
      metalness: 0.85,
    });
    const brimMat = new THREE.MeshStandardMaterial({
      color: 0xb8860b,
      roughness: 0.3,
      metalness: 0.85,
    });
    const tasselMat = new THREE.MeshStandardMaterial({
      color: 0xe74c3c,
      roughness: 0.5,
    });

    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.45, 8), hatMat);
    cone.position.set(0, 0.22, 0);
    group.add(cone);

    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.08, 8), brimMat);
    brim.position.set(0, 0.04, 0);
    group.add(brim);

    const plume = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.35, 0.08), tasselMat);
    plume.position.set(0, 0.52, -0.05);
    plume.rotation.x = -0.3;
    group.add(plume);
  } else if (item === 'iron_armor') {
    // Giáp sắt: Steel barding over horse back and flanks
    const armorMat = new THREE.MeshStandardMaterial({
      color: 0x95a5a6,
      roughness: 0.25,
      metalness: 0.9,
    });
    const goldRim = new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      roughness: 0.3,
      metalness: 0.8,
    });

    // Saddle pad
    const saddle = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.16, 1.4), armorMat);
    saddle.position.set(0, 0.05, 0);
    group.add(saddle);

    // Flank armor plates hanging down
    const flankLeft = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.75, 1.3), armorMat);
    flankLeft.position.set(-0.68, -0.35, 0);
    group.add(flankLeft);

    const flankRight = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.75, 1.3), armorMat);
    flankRight.position.set(0.68, -0.35, 0);
    group.add(flankRight);

    // Gold trim plates
    const rimFront = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.1, 0.1), goldRim);
    rimFront.position.set(0, 0.12, 0.65);
    group.add(rimFront);

    const rimBack = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.1, 0.1), goldRim);
    rimBack.position.set(0, 0.12, -0.65);
    group.add(rimBack);
  } else if (item === 'bamboo_whip') {
    // Roi tre ngà: Bamboo rod with segments
    const bambooMat = new THREE.MeshStandardMaterial({
      color: 0x8bc34a,
      roughness: 0.45,
    });
    const jointMat = new THREE.MeshStandardMaterial({
      color: 0xcddc39,
      roughness: 0.4,
    });

    const whip = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 1.6, 6), bambooMat);
    whip.rotation.z = Math.PI / 5;
    whip.rotation.x = Math.PI / 8;
    group.add(whip);

    for (let j = -0.5; j <= 0.5; j += 0.35) {
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.05, 6), jointMat);
      ring.position.set(0, j, 0);
      ring.rotation.z = Math.PI / 5;
      ring.rotation.x = Math.PI / 8;
      group.add(ring);
    }
  } else if (item === 'iron_sword') {
    // Kiếm sắt: Iron longsword in scabbard
    const steelMat = new THREE.MeshStandardMaterial({
      color: 0xecf0f1,
      roughness: 0.2,
      metalness: 0.95,
    });
    const hiltMat = new THREE.MeshStandardMaterial({
      color: 0xb8860b,
      roughness: 0.3,
      metalness: 0.8,
    });

    // Blade / scabbard
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.4, 0.14), steelMat);
    blade.rotation.z = -Math.PI / 6;
    blade.rotation.x = Math.PI / 8;
    group.add(blade);

    // Crossguard
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 0.36), hiltMat);
    guard.position.set(0.35, 0.6, 0.15);
    guard.rotation.z = -Math.PI / 6;
    guard.rotation.x = Math.PI / 8;
    group.add(guard);
  }

  return group;
}

function updateGearMeshes(gear: GearItem[]): void {
  // Remove items no longer equipped
  for (const [item, mesh] of gearMeshes.entries()) {
    if (!gear.includes(item)) {
      if (mesh.parent) {
        mesh.parent.remove(mesh);
      }
      mesh.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const m = obj as THREE.Mesh;
          m.geometry.dispose();
          if (Array.isArray(m.material)) {
            m.material.forEach((mat) => mat.dispose());
          } else {
            m.material.dispose();
          }
        }
      });
      gearMeshes.delete(item);
    }
  }

  // Add newly equipped items
  for (const item of gear) {
    if (!gearMeshes.has(item)) {
      const mesh = createGearMesh(item);
      if (item === 'iron_hat' && headAnchor) {
        headAnchor.add(mesh);
      } else if (item === 'iron_armor' && backAnchor) {
        backAnchor.add(mesh);
      } else if (item === 'bamboo_whip' && sideLeftAnchor) {
        sideLeftAnchor.add(mesh);
      } else if (item === 'iron_sword' && sideRightAnchor) {
        sideRightAnchor.add(mesh);
      }
      gearMeshes.set(item, mesh);

      if (!reducedMotion()) {
        mesh.scale.set(0, 0, 0);
        void (async () => {
          safeGsapTo(mesh.scale, {
            x: 1,
            y: 1,
            z: 1,
            duration: 0.45,
            ease: 'back.out(2)',
          });
        })().catch(() => {});
      }
    }
  }
}

function updateHorseScale(sizeStage: number): void {
  if (!horseGroup) return;
  const target = SCALE_FACTORS[sizeStage] ?? 1.0;

  if (reducedMotion()) {
    horseGroup.scale.set(target, target, target);
  } else {
    void (async () => {
      safeGsapTo(horseGroup.scale, {
        x: target,
        y: target,
        z: target,
        duration: 0.9,
        ease: 'back.out(1.4)',
      });
    })().catch(() => {});
  }
}

function updateUI(state: GiaNguaPersistentState): void {
  const run = state.currentRun;

  if (hungerFillEl) {
    hungerFillEl.style.width = `${run.hunger}%`;
  }
  if (hungerValEl) {
    hungerValEl.textContent = `${run.hunger}%`;
  }
  if (sizeStageEl) {
    const stageName = SIZE_STAGE_NAMES[run.sizeStage]?.vi || `Cấp ${run.sizeStage}`;
    sizeStageEl.textContent = `${run.sizeStage}/5 (${stageName})`;
  }
  if (bestRecordEl) {
    bestRecordEl.textContent = `${state.lifetimeBestSize}/5`;
  }

  // Update equip button states in dock
  if (dockEl) {
    dockEl.querySelectorAll<HTMLButtonElement>('[data-gear]').forEach((btn) => {
      const item = btn.getAttribute('data-gear') as GearItem;
      const isEquipped = run.gear.includes(item);
      if (isEquipped) {
        btn.classList.add('equipped');
      } else {
        btn.classList.remove('equipped');
      }
    });
  }
}

function handleGiaNguaChange(event: GiaNguaChangeEvent): void {
  const { action, effect, state, message } = event;
  updateUI(state);

  if (action === 'feed') {
    if (effect === 'spit_smoke') {
      playSFX('sneeze');
      triggerSmokeBurst(false);
      if (headGroup && !reducedMotion()) {
        void (async () => {
          safeGsapTo(headGroup.rotation, {
            y: 0.35,
            duration: 0.08,
            repeat: 5,
            yoyo: true,
            ease: 'power1.inOut',
            clearProps: 'y',
          });
        })().catch(() => {});
      }
      if (message) showToast(message);
    } else if (effect === 'overfed') {
      playSFX('sneeze');
      triggerSmokeBurst(true);
      if (message) showToast(message);
    } else if (effect === 'grow') {
      playSFX('capture');
      updateHorseScale(state.currentRun.sizeStage);
      if (message) showToast(message);
    }
  } else if (action === 'equip') {
    if (effect === 'already_wearing') {
      playSFX('dice_roll');
      if (message) showToast(message);
    } else if (effect === 'victory_dance') {
      playSFX('win_chime');
      updateGearMeshes(state.currentRun.gear);
      isVictoryDancing = true;
      if (victoryDanceTimer !== null) {
        window.clearTimeout(victoryDanceTimer);
      }
      victoryDanceTimer = window.setTimeout(() => {
        isVictoryDancing = false;
        victoryDanceTimer = null;
        if (horseGroup) {
          horseGroup.position.y = 0;
          horseGroup.rotation.y = -Math.PI / 6;
        }
      }, 5000);

      import('../../hub')
        .then((h) => h.markGameCompleted('gia-ngua'))
        .catch(() => {});

      if (message) showToast(message);
    } else {
      playSFX('coin');
      updateGearMeshes(state.currentRun.gear);
      if (message) showToast(message);
    }
  } else if (action === 'test_fire') {
    playSFX('dice_roll');
    const d = (event.extra as { duration?: number })?.duration || 3;
    fireRemainingSeconds = Math.max(fireRemainingSeconds, d);
    if (message) showToast(message);
  } else if (action === 'reset') {
    if (victoryDanceTimer !== null) {
      window.clearTimeout(victoryDanceTimer);
      victoryDanceTimer = null;
    }
    playSFX('splash');
    updateGearMeshes([]);
    updateHorseScale(0);
    isVictoryDancing = false;
    fireRemainingSeconds = 0;
    if (horseGroup) {
      horseGroup.position.set(0, 0, 0);
      horseGroup.rotation.y = -Math.PI / 6;
    }
    if (message) showToast(message);
  }
}

function injectSceneStyle(): void {
  if (document.getElementById('gia-ngua-style')) return;
  const styleEl = document.createElement('style');
  styleEl.id = 'gia-ngua-style';
  styleEl.textContent = `
    .gn-root {
      position: relative;
      width: 100%;
      height: 100%;
      min-height: 540px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      font-family: var(--font-body);
      user-select: none;
      background: #1a191f;
    }
    .gn-hud {
      position: absolute;
      top: calc(8px + env(safe-area-inset-top));
      left: 12px;
      right: 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      z-index: 10;
      pointer-events: none;
      flex-wrap: wrap;
    }
    .gn-hud > * { pointer-events: auto; }
    .gn-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-family: var(--font-display);
      font-weight: 700;
      font-size: 0.85rem;
      background: rgba(255, 248, 236, 0.95);
      color: var(--lacquer-deep);
      padding: 4px 12px;
      border-radius: var(--r-pill);
      border: 2px solid var(--wood);
      box-shadow: var(--shadow-toy);
    }
    .gn-meter-box {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(255, 248, 236, 0.95);
      border: 2px solid var(--wood);
      padding: 4px 12px;
      border-radius: var(--r-pill);
      box-shadow: var(--shadow-toy);
    }
    .gn-meter-label {
      font-size: 0.8rem;
      font-weight: 800;
      font-family: var(--font-display);
      color: var(--ink);
    }
    .gn-meter-track {
      width: 80px;
      height: 10px;
      background: var(--paper-deep);
      border: 1px solid var(--wood);
      border-radius: var(--r-pill);
      overflow: hidden;
    }
    .gn-meter-fill {
      height: 100%;
      background: linear-gradient(90deg, #4caf50 0%, #ff9800 65%, #e53935 100%);
      width: 0%;
      transition: width 0.3s ease;
      border-radius: var(--r-pill);
    }
    .gn-meter-val {
      font-size: 0.75rem;
      font-weight: 800;
      color: var(--lacquer-deep);
      min-width: 28px;
      text-align: right;
    }
    .gn-canvas-wrap {
      flex: 1;
      position: relative;
      width: 100%;
      height: 100%;
      overflow: hidden;
      cursor: grab;
    }
    .gn-canvas-wrap:active { cursor: grabbing; }
    .gn-canvas-wrap canvas {
      display: block;
      width: 100% !important;
      height: 100% !important;
    }
    .gn-dock {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      background: rgba(255, 248, 236, 0.96);
      border-top: 2px solid var(--wood);
      box-shadow: 0 -4px 12px rgba(0,0,0,0.16);
      padding: 8px 12px calc(8px + env(safe-area-inset-bottom));
      z-index: 12;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .gn-dock-row {
      display: flex;
      align-items: center;
      gap: 6px;
      overflow-x: auto;
      scrollbar-width: none;
      -webkit-overflow-scrolling: touch;
      padding-bottom: 2px;
    }
    .gn-dock-row::-webkit-scrollbar { display: none; }
    .gn-dock-label {
      font-size: 0.72rem;
      font-weight: 800;
      font-family: var(--font-display);
      color: var(--ink-soft);
      white-space: nowrap;
      min-width: 65px;
    }
    .gn-btn {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      background: var(--paper-bright);
      color: var(--ink);
      border: 1.5px solid var(--wood);
      border-radius: var(--r-btn);
      padding: 5px 11px;
      font-family: var(--font-display);
      font-size: 0.8rem;
      font-weight: 700;
      cursor: pointer;
      white-space: nowrap;
      transition: transform var(--dur-micro) ease, background var(--dur-micro) ease, border-color var(--dur-micro) ease;
    }
    .gn-btn:hover { background: var(--paper-deep); }
    .gn-btn:active { transform: translateY(2px); }
    .gn-btn.equipped {
      background: #e8f5e9;
      border-color: #2e7d32;
      color: #1b5e20;
      font-weight: 800;
      box-shadow: inset 0 0 0 1px #2e7d32;
    }
    .gn-btn.equipped::after {
      content: ' ✓';
      font-weight: 900;
      color: #2e7d32;
    }
    .gn-btn.primary {
      background: var(--lacquer);
      color: #FFF8EC;
      border-color: var(--lacquer-deep);
    }
    .gn-btn.primary:hover {
      background: var(--lacquer-bright);
    }
    .gn-btn.fire {
      background: linear-gradient(135deg, #ff5722, #f44336);
      color: #fff;
      border-color: #d32f2f;
      text-shadow: 0 1px 2px rgba(0,0,0,0.3);
    }
    .gn-btn.fire:hover {
      background: linear-gradient(135deg, #ff7043, #e53935);
    }
  `;
  document.head.appendChild(styleEl);
}

export function buildScene(container: HTMLElement): void {
  destroyScene();
  injectSceneStyle();

  loadState();
  const current = getGiaNguaState();

  rootEl = document.createElement('div');
  rootEl.className = 'gn-root';
  gsapCtx = gsap.context(() => {}, rootEl);

  // HUD (Top Bar)
  const hudEl = document.createElement('div');
  hudEl.className = 'gn-hud';

  const titleBadge = document.createElement('div');
  titleBadge.className = 'gn-badge';
  titleBadge.innerHTML = '🐎 <span>Gara Ngựa Sắt</span>';
  hudEl.appendChild(titleBadge);

  const stageBadge = document.createElement('div');
  stageBadge.className = 'gn-badge';
  const stageName = SIZE_STAGE_NAMES[current.currentRun.sizeStage]?.vi || `Cấp ${current.currentRun.sizeStage}`;
  stageBadge.innerHTML = `📏 Vóc dáng: <strong id="gn-size-stage" style="margin-left:4px">${current.currentRun.sizeStage}/5 (${stageName})</strong>`;
  sizeStageEl = stageBadge.querySelector('#gn-size-stage');
  hudEl.appendChild(stageBadge);

  const hungerBox = document.createElement('div');
  hungerBox.className = 'gn-meter-box';
  hungerBox.innerHTML = `
    <span class="gn-meter-label">Độ no:</span>
    <div class="gn-meter-track">
      <div class="gn-meter-fill" id="gn-hunger-fill" style="width: ${current.currentRun.hunger}%"></div>
    </div>
    <span class="gn-meter-val" id="gn-hunger-val">${current.currentRun.hunger}%</span>
  `;
  hungerFillEl = hungerBox.querySelector('#gn-hunger-fill');
  hungerValEl = hungerBox.querySelector('#gn-hunger-val');
  hudEl.appendChild(hungerBox);

  const recordBadge = document.createElement('div');
  recordBadge.className = 'gn-badge';
  recordBadge.innerHTML = `🏆 Kỷ lục: <strong id="gn-best-record" style="margin-left:4px">${current.lifetimeBestSize}/5</strong>`;
  bestRecordEl = recordBadge.querySelector('#gn-best-record');
  hudEl.appendChild(recordBadge);

  const status = getWebMCPStatus();
  const webmcpPill = document.createElement('div');
  webmcpPill.className = 'gn-badge';
  webmcpPill.innerHTML = `🤖 WebMCP: ${status.text}`;
  hudEl.appendChild(webmcpPill);

  rootEl.appendChild(hudEl);

  // 3D Canvas wrapper
  const canvasWrap = document.createElement('div');
  canvasWrap.className = 'gn-canvas-wrap';
  rootEl.appendChild(canvasWrap);

  // Bottom Dock
  dockEl = document.createElement('div');
  dockEl.className = 'gn-dock';

  // Row 1: Thức ăn (Feed)
  const feedRow = document.createElement('div');
  feedRow.className = 'gn-dock-row';
  feedRow.innerHTML = `<span class="gn-dock-label">Thức ăn:</span>`;

  const foods: FoodType[] = ['com_ca', 'pizza', 'nuoc_ngot'];
  for (const f of foods) {
    const btn = document.createElement('button');
    btn.className = 'gn-btn';
    btn.innerHTML = `${FOOD_NAMES[f].emoji} ${FOOD_NAMES[f].vi}`;
    btn.title = f === 'com_ca' ? 'Nuôi ngựa lớn vùn vụt (+30 no)' : 'Đồ ăn vặt (ngựa nhổ ra khói)';
    btn.addEventListener('click', () => {
      driveFeed(f);
    });
    feedRow.appendChild(btn);
  }
  dockEl.appendChild(feedRow);

  // Row 2: Trang bị (Equip)
  const equipRow = document.createElement('div');
  equipRow.className = 'gn-dock-row';
  equipRow.innerHTML = `<span class="gn-dock-label">Trang bị:</span>`;

  const gears: GearItem[] = ['bamboo_whip', 'iron_armor', 'iron_hat', 'iron_sword'];
  for (const g of gears) {
    const btn = document.createElement('button');
    btn.className = `gn-btn ${current.currentRun.gear.includes(g) ? 'equipped' : ''}`;
    btn.setAttribute('data-gear', g);
    btn.innerHTML = `${GEAR_NAMES[g].emoji} ${GEAR_NAMES[g].vi}`;
    btn.addEventListener('click', () => {
      driveEquip(g);
    });
    equipRow.appendChild(btn);
  }
  dockEl.appendChild(equipRow);

  // Row 3: Thử nghiệm & Quản lý
  const actionRow = document.createElement('div');
  actionRow.className = 'gn-dock-row';
  actionRow.innerHTML = `<span class="gn-dock-label">Hành động:</span>`;

  const fireBtn = document.createElement('button');
  fireBtn.className = 'gn-btn fire';
  fireBtn.innerHTML = '🔥 Phun lửa (3s)';
  fireBtn.addEventListener('click', () => {
    driveTestFire(3);
  });
  actionRow.appendChild(fireBtn);

  const resetBtn = document.createElement('button');
  resetBtn.className = 'gn-btn primary';
  resetBtn.style.marginLeft = 'auto';
  resetBtn.innerHTML = '🔄 Lượt nuôi mới';
  resetBtn.addEventListener('click', () => {
    driveReset();
  });
  actionRow.appendChild(resetBtn);

  dockEl.appendChild(actionRow);
  rootEl.appendChild(dockEl);

  container.appendChild(rootEl);

  // Three.js Setup
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a191f);
  scene.fog = new THREE.FogExp2(0x1a191f, 0.04);

  const initialWidth = canvasWrap.clientWidth || 600;
  const initialHeight = canvasWrap.clientHeight || 420;

  camera = new THREE.PerspectiveCamera(
    45,
    initialWidth / initialHeight,
    0.1,
    100
  );
  camera.position.set(2.8, 2.5, 4.4);
  camera.lookAt(0, 1.2, 0);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setSize(initialWidth, initialHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  canvasWrap.appendChild(renderer.domElement);

  // Lights
  const ambientLight = new THREE.AmbientLight(0xfff3e0, 1.0);
  scene.add(ambientLight);

  const forgeDirLight = new THREE.DirectionalLight(0xffaa44, 1.6);
  forgeDirLight.position.set(4, 7, 5);
  forgeDirLight.castShadow = true;
  forgeDirLight.shadow.mapSize.width = 1024;
  forgeDirLight.shadow.mapSize.height = 1024;
  scene.add(forgeDirLight);

  const fillLight = new THREE.DirectionalLight(0x7986cb, 0.6);
  fillLight.position.set(-4, 3, -3);
  scene.add(fillLight);

  // Procedural Workshop Floor
  const floorGeo = new THREE.PlaneGeometry(16, 16);
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x242228,
    roughness: 0.75,
    metalness: 0.1,
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // Procedural garage pillar props in background
  const pillarMat = new THREE.MeshStandardMaterial({
    color: 0x3e2723,
    roughness: 0.8,
  });
  const pillarLeft = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6, 0.5), pillarMat);
  pillarLeft.position.set(-3.5, 3, -2.5);
  scene.add(pillarLeft);

  const pillarRight = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6, 0.5), pillarMat);
  pillarRight.position.set(3.5, 3, -2.5);
  scene.add(pillarRight);

  // Anvil / forge stone prop
  const anvilMat = new THREE.MeshStandardMaterial({
    color: 0x424242,
    roughness: 0.4,
    metalness: 0.7,
  });
  const anvil = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.65, 0.6), anvilMat);
  anvil.position.set(-2.2, 0.32, 1.0);
  anvil.rotation.y = 0.4;
  anvil.castShadow = true;
  scene.add(anvil);

  // Build Horse
  horseGroup = buildHorse();
  scene.add(horseGroup);

  // Set initial scale and equip meshes
  const targetScale = SCALE_FACTORS[current.currentRun.sizeStage] ?? 1.0;
  horseGroup.scale.set(targetScale, targetScale, targetScale);
  updateGearMeshes(current.currentRun.gear);

  // Initialize Particle Emitter
  initParticles();

  clock = new THREE.Clock();

  // Mouse orbit drag interaction
  let isDragging = false;
  let prevMouseX = 0;
  let targetRotationY = -Math.PI / 6;

  const onPointerDown = (e: MouseEvent | TouchEvent) => {
    isDragging = true;
    prevMouseX = 'touches' in e ? e.touches[0].clientX : e.clientX;
  };
  const onPointerMove = (e: MouseEvent | TouchEvent) => {
    if (!isDragging || !horseGroup) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const deltaX = clientX - prevMouseX;
    prevMouseX = clientX;
    targetRotationY += deltaX * 0.012;
  };
  const onPointerUp = () => {
    isDragging = false;
  };

  boundHandlers = {
    canvasWrap,
    onPointerDown,
    onPointerMove,
    onPointerUp,
  };

  canvasWrap.addEventListener('mousedown', onPointerDown);
  window.addEventListener('mousemove', onPointerMove);
  window.addEventListener('mouseup', onPointerUp);
  canvasWrap.addEventListener('touchstart', onPointerDown, { passive: true });
  window.addEventListener('touchmove', onPointerMove, { passive: true });
  window.addEventListener('touchend', onPointerUp);

  // Render Loop
  function renderLoop(): void {
    if (!renderer || !scene || !camera || !clock) return;

    const dt = Math.min(clock.getDelta(), 0.1);
    const elapsedTime = clock.getElapsedTime();

    // Smooth horse rotation
    if (horseGroup && !isVictoryDancing) {
      horseGroup.rotation.y += (targetRotationY - horseGroup.rotation.y) * 0.1;
    }

    // Idle bobbing / victory dancing
    if (horseGroup) {
      if (isVictoryDancing) {
        horseGroup.position.y = Math.abs(Math.sin(elapsedTime * 9.0)) * 0.35;
        horseGroup.rotation.y = targetRotationY + Math.sin(elapsedTime * 8.0) * 0.3;
        horseGroup.rotation.z = Math.sin(elapsedTime * 6.0) * 0.1;
      } else if (!reducedMotion()) {
        horseGroup.position.y = Math.sin(elapsedTime * 2.2) * 0.035;
        horseGroup.rotation.z = 0;
      } else {
        horseGroup.position.y = 0;
        horseGroup.rotation.z = 0;
      }
    }

    // Fire breath emission
    if (fireRemainingSeconds > 0) {
      fireRemainingSeconds -= dt;
      if (snoutLight) snoutLight.intensity = 2.5 + Math.random() * 1.5;
      const count = Math.ceil(dt * 80);
      for (let i = 0; i < count; i++) {
        spawnFireParticle();
      }
      if (fireRemainingSeconds <= 0 && snoutLight) {
        snoutLight.intensity = 0;
      }
    } else if (snoutLight && snoutLight.intensity > 0) {
      snoutLight.intensity = 0;
    }

    // Update particles
    if (particlePoints && particlePositions && particleColors) {
      let activeCount = 0;
      for (let i = 0; i < MAX_PARTICLES; i++) {
        const p = particlesData[i];
        if (!p.active) {
          particlePositions[i * 3 + 1] = -999;
          continue;
        }

        activeCount++;
        p.life -= dt;
        if (p.life <= 0) {
          p.active = false;
          particlePositions[i * 3 + 1] = -999;
          continue;
        }

        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;

        particlePositions[i * 3 + 0] = p.x;
        particlePositions[i * 3 + 1] = p.y;
        particlePositions[i * 3 + 2] = p.z;

        const progress = 1 - p.life / p.maxLife;
        if (p.type === 'fire') {
          particleColors[i * 3 + 0] = p.r;
          particleColors[i * 3 + 1] = Math.max(0, p.g - progress * 0.4);
          particleColors[i * 3 + 2] = Math.max(0, p.b - progress * 0.15);
        } else {
          particleColors[i * 3 + 0] = p.r * (1 - progress * 0.5);
          particleColors[i * 3 + 1] = p.g * (1 - progress * 0.5);
          particleColors[i * 3 + 2] = p.b * (1 - progress * 0.5);
        }
      }

      particlePoints.geometry.attributes.position.needsUpdate = true;
      particlePoints.geometry.attributes.color.needsUpdate = true;
    }

    renderer.render(scene, camera);
    frameId = requestAnimationFrame(renderLoop);
  }
  frameId = requestAnimationFrame(renderLoop);

  // Resize Observer
  resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const w = entry.contentRect.width;
      const h = entry.contentRect.height;
      if (w > 0 && h > 0 && renderer && camera) {
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }
    }
  });
  resizeObserver.observe(canvasWrap);

  // Subscribe to pure rules state changes
  unsubscribeChange = onGiaNguaChange(handleGiaNguaChange);
}

export function destroyScene(): void {
  if (frameId) {
    cancelAnimationFrame(frameId);
    frameId = 0;
  }
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
  if (unsubscribeChange) {
    unsubscribeChange();
    unsubscribeChange = null;
  }
  if (boundHandlers) {
    const { canvasWrap: wrap, onPointerDown, onPointerMove, onPointerUp } = boundHandlers;
    wrap.removeEventListener('mousedown', onPointerDown);
    window.removeEventListener('mousemove', onPointerMove);
    window.removeEventListener('mouseup', onPointerUp);
    wrap.removeEventListener('touchstart', onPointerDown);
    window.removeEventListener('touchmove', onPointerMove);
    window.removeEventListener('touchend', onPointerUp);
    boundHandlers = null;
  }
  if (gsapCtx) {
    gsapCtx.revert();
    gsapCtx = null;
  }
  if (victoryDanceTimer !== null) {
    window.clearTimeout(victoryDanceTimer);
    victoryDanceTimer = null;
  }

  // Dispose gear meshes
  for (const [, mesh] of gearMeshes.entries()) {
    mesh.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const m = obj as THREE.Mesh;
        m.geometry.dispose();
        if (Array.isArray(m.material)) {
          m.material.forEach((mat) => mat.dispose());
        } else {
          m.material.dispose();
        }
      }
    });
  }
  gearMeshes.clear();

  // Dispose particle points
  if (particlePoints) {
    particlePoints.geometry.dispose();
    if (Array.isArray(particlePoints.material)) {
      particlePoints.material.forEach((m) => m.dispose());
    } else {
      particlePoints.material.dispose();
    }
    particlePoints = null;
  }
  particlePositions = null;
  particleColors = null;

  // Dispose horse and scene meshes
  if (scene) {
    scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const m = obj as THREE.Mesh;
        m.geometry.dispose();
        if (Array.isArray(m.material)) {
          m.material.forEach((mat) => mat.dispose());
        } else {
          m.material.dispose();
        }
      }
    });
    scene = null;
  }

  if (renderer) {
    renderer.dispose();
    if (renderer.domElement && renderer.domElement.parentElement) {
      renderer.domElement.remove();
    }
    renderer = null;
  }

  camera = null;
  horseGroup = null;
  headGroup = null;
  snoutPoint = null;
  headAnchor = null;
  backAnchor = null;
  sideLeftAnchor = null;
  sideRightAnchor = null;
  snoutLight = null;
  clock = null;
  isVictoryDancing = false;
  fireRemainingSeconds = 0;

  if (rootEl) {
    const styleEl = document.getElementById('gia-ngua-style');
    if (styleEl) styleEl.remove();
    rootEl.remove();
    rootEl = null;
  }

  hungerFillEl = null;
  hungerValEl = null;
  sizeStageEl = null;
  bestRecordEl = null;
  dockEl = null;
}
