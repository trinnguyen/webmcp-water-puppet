import * as THREE from 'three';
import { gsap } from 'gsap';
import type {
  Ingredient,
  BanhChungPersistentState,
  BanhChungChangeEvent,
} from './rules';
import {
  MAX_CAPACITY_KG,
  getBanhChungState,
  getBanhChungAnalysis,
  loadState,
  driveDropIngredient,
  driveFoldAndBoil,
  driveReset,
  onBanhChungChange,
} from './rules';
import { playSFX } from '../../audio';
import { reducedMotion } from '../../motion';
import { getWebMCPStatus } from '../../ui';

let rootEl: HTMLElement | null = null;
let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;
let frameId = 0;
let resizeObserver: ResizeObserver | null = null;
let unsubscribeChange: (() => void) | null = null;
let gsapCtx: gsap.Context | null = null;
let clock: THREE.Clock | null = null;
let pointerAbortController: AbortController | null = null;

// Three.js groups and meshes
let worldGroup: THREE.Group | null = null;
let boxGroup: THREE.Group | null = null;
let baseMesh: THREE.Mesh | null = null;
let wallFront: THREE.Mesh | null = null;
let wallBack: THREE.Mesh | null = null;
let wallLeft: THREE.Mesh | null = null;
let wallRight: THREE.Mesh | null = null;
let lidMesh: THREE.Group | null = null;
let goldHatGroup: THREE.Group | null = null;
let giantPorkMesh: THREE.Mesh | null = null;

const ingredientMeshes: THREE.Object3D[] = [];
const debrisMeshes: THREE.Object3D[] = [];

// Interaction state
let isDragging = false;
let prevMouseX = 0;
let targetRotationY = -Math.PI / 6;

// DOM references
let totalMassFillEl: HTMLElement | null = null;
let totalMassValEl: HTMLElement | null = null;
let statusBadgeEl: HTMLElement | null = null;
let ratioNepEl: HTMLElement | null = null;
let ratioDauEl: HTMLElement | null = null;
let ratioThitEl: HTMLElement | null = null;
let bestScoreEl: HTMLElement | null = null;
let winsEl: HTMLElement | null = null;
let triesEl: HTMLElement | null = null;
let messageBannerEl: HTMLElement | null = null;

function safeGsapTo(target: gsap.TweenTarget, vars: gsap.TweenVars): gsap.core.Tween {
  return gsapCtx ? gsapCtx.add(() => gsap.to(target, vars)) : gsap.to(target, vars);
}

// Procedural materials
const leafGreenMat = new THREE.MeshStandardMaterial({
  color: 0x2e7d32,
  roughness: 0.65,
  metalness: 0.1,
});

const leafLidMat = new THREE.MeshStandardMaterial({
  color: 0x1b5e20,
  roughness: 0.6,
  metalness: 0.1,
});

const bambooTwineMat = new THREE.MeshStandardMaterial({
  color: 0xf5deb3,
  roughness: 0.8,
  metalness: 0.05,
});

const nepMat = new THREE.MeshStandardMaterial({
  color: 0xfafafa,
  roughness: 0.9,
  metalness: 0.0,
});

const dauXanhMat = new THREE.MeshStandardMaterial({
  color: 0xffd54f,
  roughness: 0.55,
  metalness: 0.1,
});

const thitMoMat = new THREE.MeshStandardMaterial({
  color: 0xef9a9a,
  roughness: 0.45,
  metalness: 0.05,
});

const goldCrownMat = new THREE.MeshStandardMaterial({
  color: 0xffd700,
  roughness: 0.25,
  metalness: 0.85,
});

const goldJewelMat = new THREE.MeshStandardMaterial({
  color: 0xd50000,
  roughness: 0.2,
  metalness: 0.6,
});

function createBox(): THREE.Group {
  const group = new THREE.Group();

  // Bottom leaf base
  const baseGeo = new THREE.BoxGeometry(2.2, 0.08, 2.2);
  baseMesh = new THREE.Mesh(baseGeo, leafGreenMat);
  baseMesh.position.set(0, 0.04, 0);
  baseMesh.receiveShadow = true;
  group.add(baseMesh);

  // Back wall
  const backGeo = new THREE.BoxGeometry(2.2, 1.2, 0.08);
  wallBack = new THREE.Mesh(backGeo, leafGreenMat);
  wallBack.position.set(0, 0.64, -1.06);
  wallBack.castShadow = true;
  wallBack.receiveShadow = true;
  group.add(wallBack);

  // Left wall
  const sideGeo = new THREE.BoxGeometry(0.08, 1.2, 2.04);
  wallLeft = new THREE.Mesh(sideGeo, leafGreenMat);
  wallLeft.position.set(-1.06, 0.64, 0);
  wallLeft.castShadow = true;
  wallLeft.receiveShadow = true;
  group.add(wallLeft);

  // Right wall
  wallRight = new THREE.Mesh(sideGeo, leafGreenMat);
  wallRight.position.set(1.06, 0.64, 0);
  wallRight.castShadow = true;
  wallRight.receiveShadow = true;
  group.add(wallRight);

  // Front wall (slightly lower so kids can see inside)
  const frontGeo = new THREE.BoxGeometry(2.2, 0.6, 0.08);
  wallFront = new THREE.Mesh(frontGeo, leafGreenMat);
  wallFront.position.set(0, 0.34, 1.06);
  wallFront.castShadow = true;
  wallFront.receiveShadow = true;
  group.add(wallFront);

  // Bamboo string tie around exterior
  const tieGeoH = new THREE.BoxGeometry(2.24, 0.04, 2.24);
  const tieH = new THREE.Mesh(tieGeoH, bambooTwineMat);
  tieH.position.set(0, 0.32, 0);
  group.add(tieH);

  return group;
}

function createLid(): THREE.Group {
  const group = new THREE.Group();

  // Square lid leaf
  const lidGeo = new THREE.BoxGeometry(2.22, 0.12, 2.22);
  const lidPlate = new THREE.Mesh(lidGeo, leafLidMat);
  lidPlate.castShadow = true;
  lidPlate.receiveShadow = true;
  group.add(lidPlate);

  // Crossed bamboo strings on top
  const ribbon1 = new THREE.Mesh(new THREE.BoxGeometry(2.24, 0.04, 0.12), bambooTwineMat);
  ribbon1.position.set(0, 0.07, 0);
  group.add(ribbon1);

  const ribbon2 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 2.24), bambooTwineMat);
  ribbon2.position.set(0, 0.07, 0);
  group.add(ribbon2);

  group.position.set(0, 1.28, 0);
  group.visible = false;
  return group;
}

function createGoldHat(): THREE.Group {
  const group = new THREE.Group();

  // Conical Royal Crown / Hat
  const coneGeo = new THREE.ConeGeometry(0.65, 0.75, 24);
  const cone = new THREE.Mesh(coneGeo, goldCrownMat);
  cone.position.set(0, 0.375, 0);
  cone.castShadow = true;
  group.add(cone);

  // Hat Rim Ring
  const rimGeo = new THREE.TorusGeometry(0.66, 0.04, 12, 32);
  const rim = new THREE.Mesh(rimGeo, goldJewelMat);
  rim.rotation.x = Math.PI / 2;
  rim.position.set(0, 0.02, 0);
  group.add(rim);

  // Top gem
  const gemGeo = new THREE.SphereGeometry(0.08, 12, 12);
  const gem = new THREE.Mesh(gemGeo, goldJewelMat);
  gem.position.set(0, 0.78, 0);
  group.add(gem);

  group.position.set(0, 1.85, 0);
  group.visible = false;
  return group;
}

function createIngredientMesh(type: Ingredient): THREE.Object3D {
  if (type === 'nep') {
    // Rice grains cluster
    const cluster = new THREE.Group();
    const count = 7;
    for (let i = 0; i < count; i++) {
      const grainGeo = new THREE.BoxGeometry(0.12, 0.08, 0.12);
      const grain = new THREE.Mesh(grainGeo, nepMat);
      grain.position.set(
        (Math.random() - 0.5) * 0.22,
        (Math.random() - 0.5) * 0.06,
        (Math.random() - 0.5) * 0.22
      );
      grain.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      );
      grain.castShadow = true;
      cluster.add(grain);
    }
    return cluster;
  }

  if (type === 'dau_xanh') {
    // Golden mung bean spheres cluster
    const cluster = new THREE.Group();
    const count = 4;
    for (let i = 0; i < count; i++) {
      const beanGeo = new THREE.SphereGeometry(0.13, 12, 12);
      const bean = new THREE.Mesh(beanGeo, dauXanhMat);
      bean.position.set(
        (Math.random() - 0.5) * 0.2,
        (Math.random() - 0.5) * 0.08,
        (Math.random() - 0.5) * 0.2
      );
      bean.castShadow = true;
      cluster.add(bean);
    }
    return cluster;
  }

  // thit_mo: pork belly cube
  const porkGroup = new THREE.Group();
  const porkGeo = new THREE.BoxGeometry(0.42, 0.28, 0.42);
  const pork = new THREE.Mesh(porkGeo, thitMoMat);
  pork.castShadow = true;
  pork.receiveShadow = true;
  porkGroup.add(pork);

  // Add a strip of lean meat on top of fat
  const leanGeo = new THREE.BoxGeometry(0.42, 0.08, 0.42);
  const leanMat = new THREE.MeshStandardMaterial({
    color: 0xc62828,
    roughness: 0.5,
  });
  const lean = new THREE.Mesh(leanGeo, leanMat);
  lean.position.set(0, 0.1, 0);
  porkGroup.add(lean);

  return porkGroup;
}

function clearIngredients(): void {
  for (const obj of ingredientMeshes) {
    if (scene && obj.parent) {
      obj.parent.remove(obj);
    }
    obj.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const m = child as THREE.Mesh;
        m.geometry.dispose();
      }
    });
  }
  ingredientMeshes.length = 0;

  for (const deb of debrisMeshes) {
    if (scene && deb.parent) {
      deb.parent.remove(deb);
    }
    deb.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const m = child as THREE.Mesh;
        m.geometry.dispose();
      }
    });
  }
  debrisMeshes.length = 0;

  if (giantPorkMesh) {
    if (giantPorkMesh.parent) giantPorkMesh.parent.remove(giantPorkMesh);
    giantPorkMesh.geometry.dispose();
    giantPorkMesh = null;
  }
}

function resetBoxWalls(): void {
  if (wallFront) {
    wallFront.position.set(0, 0.34, 1.06);
    wallFront.rotation.set(0, 0, 0);
  }
  if (wallBack) {
    wallBack.position.set(0, 0.64, -1.06);
    wallBack.rotation.set(0, 0, 0);
  }
  if (wallLeft) {
    wallLeft.position.set(-1.06, 0.64, 0);
    wallLeft.rotation.set(0, 0, 0);
  }
  if (wallRight) {
    wallRight.position.set(1.06, 0.64, 0);
    wallRight.rotation.set(0, 0, 0);
  }
  if (lidMesh) lidMesh.visible = false;
  if (goldHatGroup) goldHatGroup.visible = false;
}

function populateExistingItems(state: BanhChungPersistentState): void {
  clearIngredients();
  resetBoxWalls();

  const run = state.currentRun;
  for (let i = 0; i < run.items.length; i++) {
    const it = run.items[i];
    const mesh = createIngredientMesh(it.type);
    const restingY = 0.12 + Math.min(1.0, (i / Math.max(1, run.items.length)) * 0.9);
    const restingX = (Math.random() - 0.5) * 1.5;
    const restingZ = (Math.random() - 0.5) * 1.5;

    mesh.position.set(restingX, restingY, restingZ);
    mesh.rotation.set(
      (Math.random() - 0.5) * 0.4,
      Math.random() * Math.PI,
      (Math.random() - 0.5) * 0.4
    );

    if (boxGroup) {
      boxGroup.add(mesh);
      ingredientMeshes.push(mesh);
    }
  }

  if (run.status === 'perfect') {
    if (lidMesh) lidMesh.visible = true;
    if (goldHatGroup) {
      goldHatGroup.visible = true;
      goldHatGroup.position.set(0, 1.85, 0);
    }
  } else if (run.status === 'exploded') {
    if (wallFront) wallFront.rotation.x = Math.PI / 3;
    if (wallBack) wallBack.rotation.x = -Math.PI / 3;
    if (wallLeft) wallLeft.rotation.z = Math.PI / 3;
    if (wallRight) wallRight.rotation.z = -Math.PI / 3;
  }
}

/* ================== ANIMATIONS ================== */

async function animateDropIngredient(type: Ingredient = 'nep'): Promise<void> {
  if (!boxGroup || !scene) return;

  const mesh = createIngredientMesh(type);
  const state = getBanhChungState();

  const spawnY = 3.6 + Math.random() * 0.4;
  const targetX = (Math.random() - 0.5) * 1.4;
  const targetZ = (Math.random() - 0.5) * 1.4;
  const targetY = 0.12 + Math.min(1.05, (state.currentRun.totalMass / MAX_CAPACITY_KG) * 0.95);

  mesh.position.set(targetX, spawnY, targetZ);
  mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);

  boxGroup.add(mesh);
  ingredientMeshes.push(mesh);

  playSFX('coin');

  if (reducedMotion()) {
    mesh.position.y = targetY;
    return;
  }

  await new Promise<void>((resolve) => {
    safeGsapTo(mesh.position, {
      y: targetY,
      duration: 0.45,
      ease: 'bounce.out',
      onComplete: () => resolve(),
    });
    safeGsapTo(mesh.rotation, {
      x: (Math.random() - 0.5) * 0.4,
      y: Math.random() * Math.PI * 2,
      z: (Math.random() - 0.5) * 0.4,
      duration: 0.45,
    });
  });
}

async function animateWinGoldHat(): Promise<void> {
  if (!boxGroup || !lidMesh || !goldHatGroup || !scene) return;

  playSFX('capture');

  // Close lid
  lidMesh.visible = true;
  lidMesh.position.set(0, 3.2, 0);

  if (reducedMotion()) {
    lidMesh.position.set(0, 1.28, 0);
    goldHatGroup.visible = true;
    goldHatGroup.position.set(0, 1.85, 0);
    playSFX('win_chime');
    return;
  }

  await new Promise<void>((resolve) => {
    safeGsapTo(lidMesh!.position, {
      y: 1.28,
      duration: 0.5,
      ease: 'power2.out',
      onComplete: () => resolve(),
    });
  });

  // Drop royal gold hat
  goldHatGroup.visible = true;
  goldHatGroup.position.set(0, 4.5, 0);
  playSFX('win_chime');

  await new Promise<void>((resolve) => {
    safeGsapTo(goldHatGroup!.position, {
      y: 1.85,
      duration: 0.8,
      ease: 'bounce.out',
      onComplete: () => resolve(),
    });
    safeGsapTo(goldHatGroup!.rotation, {
      y: Math.PI * 2,
      duration: 0.8,
    });
  });

  import('../../hub')
    .then((h) => h.markGameCompleted('banh-chung'))
    .catch(() => {});
}

async function animateExplosion(): Promise<void> {
  if (!boxGroup || !scene) return;

  playSFX('sneeze');

  // Walls blow outward
  if (wallFront) safeGsapTo(wallFront.rotation, { x: Math.PI / 3, duration: 0.4 });
  if (wallBack) safeGsapTo(wallBack.rotation, { x: -Math.PI / 3, duration: 0.4 });
  if (wallLeft) safeGsapTo(wallLeft.rotation, { z: Math.PI / 3, duration: 0.4 });
  if (wallRight) safeGsapTo(wallRight.rotation, { z: -Math.PI / 3, duration: 0.4 });

  if (camera && !reducedMotion()) {
    safeGsapTo(camera.position, {
      x: '+=0.2',
      yoyo: true,
      repeat: 4,
      duration: 0.05,
    });
  }

  // Spawn flying leaf planes
  const leafCount = reducedMotion() ? 6 : 28;
  const leafPlaneGeo = new THREE.PlaneGeometry(0.32, 0.32);
  const leafFragMat = new THREE.MeshStandardMaterial({
    color: 0x2e7d32,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 1,
  });

  for (let i = 0; i < leafCount; i++) {
    const frag = new THREE.Mesh(leafPlaneGeo, leafFragMat.clone());
    frag.position.set(
      (Math.random() - 0.5) * 1.5,
      0.5 + Math.random() * 0.8,
      (Math.random() - 0.5) * 1.5
    );
    scene.add(frag);
    debrisMeshes.push(frag);

    const targetX = (Math.random() - 0.5) * 8;
    const targetY = 1.0 + Math.random() * 4;
    const targetZ = (Math.random() - 0.5) * 8;

    if (reducedMotion()) {
      frag.position.set(targetX * 0.5, targetY * 0.5, targetZ * 0.5);
    } else {
      safeGsapTo(frag.position, {
        x: targetX,
        y: targetY,
        z: targetZ,
        duration: 0.75,
        ease: 'power2.out',
      });
      safeGsapTo(frag.rotation, {
        x: Math.random() * 8,
        y: Math.random() * 8,
        z: Math.random() * 8,
        duration: 0.75,
      });
      safeGsapTo(frag.material as THREE.Material, {
        opacity: 0,
        duration: 0.75,
        delay: 0.2,
      });
    }
  }

  // Toss ingredient meshes outwards
  for (const ing of ingredientMeshes) {
    safeGsapTo(ing.position, {
      x: ing.position.x * 2.5 + (Math.random() - 0.5) * 2,
      y: 0.1 + Math.random() * 0.4,
      z: ing.position.z * 2.5 + (Math.random() - 0.5) * 2,
      duration: 0.6,
      ease: 'power2.out',
    });
  }
}

async function animateGiantCubeExplosion(): Promise<void> {
  if (!boxGroup || !scene) return;

  // 1. Drop colossal pork cube
  const giantGeo = new THREE.BoxGeometry(2.3, 2.3, 2.3);
  giantPorkMesh = new THREE.Mesh(giantGeo, thitMoMat);
  giantPorkMesh.position.set(0, 7.5, 0);
  scene.add(giantPorkMesh);

  playSFX('dice_roll');

  if (!reducedMotion()) {
    await new Promise<void>((resolve) => {
      safeGsapTo(giantPorkMesh!.position, {
        y: 1.2,
        duration: 0.35,
        ease: 'power4.in',
        onComplete: () => resolve(),
      });
    });
  } else {
    giantPorkMesh.position.y = 1.2;
  }

  // 2. Giant Impact & Blast
  playSFX('sneeze');

  if (camera && !reducedMotion()) {
    safeGsapTo(camera.position, {
      x: '+=0.35',
      yoyo: true,
      repeat: 6,
      duration: 0.04,
    });
  }

  // Animate explosion
  await animateExplosion();

  // Blow giant cube away or dissolve
  if (giantPorkMesh) {
    safeGsapTo(giantPorkMesh.position, {
      y: 4.5,
      duration: 0.5,
      ease: 'power1.out',
    });
    safeGsapTo(giantPorkMesh.scale, {
      x: 0.01,
      y: 0.01,
      z: 0.01,
      duration: 0.5,
      onComplete: () => {
        if (giantPorkMesh && giantPorkMesh.parent) {
          giantPorkMesh.parent.remove(giantPorkMesh);
          giantPorkMesh.geometry.dispose();
          giantPorkMesh = null;
        }
      },
    });
  }
}

async function animateReset(): Promise<void> {
  playSFX('coin');
  clearIngredients();
  resetBoxWalls();
  if (camera) {
    safeGsapTo(camera.position, {
      x: 0,
      y: 3.2,
      z: 4.0,
      duration: 0.4,
    });
  }
}

export async function triggerSceneEffect(effect: string, extra?: any): Promise<void> {
  if (!scene) return;

  if (effect === 'drop') {
    await animateDropIngredient(extra?.type);
  } else if (effect === 'win_gold_hat') {
    await animateWinGoldHat();
  } else if (effect === 'explosion') {
    await animateExplosion();
  } else if (effect === 'giant_cube_explosion') {
    await animateGiantCubeExplosion();
  } else if (effect === 'reset') {
    await animateReset();
  } else if (effect === 'fail') {
    playSFX('sneeze');
  }
}

/* ================== DOM UI & HUD ================== */

function updateHUD(): void {
  const fullState = getBanhChungState();
  const run = fullState.currentRun;
  const analysis = getBanhChungAnalysis(run);

  if (totalMassFillEl) {
    const pct = Math.min(100, (run.totalMass / MAX_CAPACITY_KG) * 100);
    totalMassFillEl.style.width = `${pct}%`;
    totalMassFillEl.style.background =
      run.totalMass > MAX_CAPACITY_KG
        ? '#d32f2f'
        : 'linear-gradient(90deg, #4caf50 0%, #ff9800 70%, #f44336 100%)';
  }

  if (totalMassValEl) {
    totalMassValEl.textContent = `${run.totalMass} / ${MAX_CAPACITY_KG} kg`;
    totalMassValEl.style.color = run.totalMass > MAX_CAPACITY_KG ? '#d32f2f' : 'var(--lacquer-deep)';
  }

  if (statusBadgeEl) {
    if (run.status === 'packing') {
      statusBadgeEl.innerHTML = `📦 <span>Đang gói</span>`;
      statusBadgeEl.style.color = 'var(--lacquer-deep)';
    } else if (run.status === 'perfect') {
      statusBadgeEl.innerHTML = `👑 <span>Hoàn hảo!</span>`;
      statusBadgeEl.style.color = '#2e7d32';
    } else if (run.status === 'failed') {
      statusBadgeEl.innerHTML = `⚠️ <span>Chưa đạt</span>`;
      statusBadgeEl.style.color = '#e65100';
    } else if (run.status === 'exploded') {
      statusBadgeEl.innerHTML = `💥 <span>Nổ tung!</span>`;
      statusBadgeEl.style.color = '#c62828';
    }
  }

  if (ratioNepEl) {
    ratioNepEl.textContent = `${analysis.percentages.nep}% (${run.nepMass}kg)`;
  }
  if (ratioDauEl) {
    ratioDauEl.textContent = `${analysis.percentages.dau_xanh}% (${run.dauMass}kg)`;
  }
  if (ratioThitEl) {
    ratioThitEl.textContent = `${analysis.percentages.thit_mo}% (${run.thitMass}kg)`;
  }

  if (bestScoreEl) {
    bestScoreEl.textContent =
      fullState.bestRatioScore !== null ? `${fullState.bestRatioScore}` : 'Chưa có';
  }
  if (winsEl) winsEl.textContent = `${fullState.lifetimeWins}`;
  if (triesEl) triesEl.textContent = `${fullState.lifetimeTries}`;
}

function handleBanhChungChange(event: BanhChungChangeEvent): void {
  updateHUD();

  if (event.message && messageBannerEl) {
    messageBannerEl.textContent = event.message;
    messageBannerEl.style.opacity = '1';
    safeGsapTo(messageBannerEl, { opacity: 1, duration: 0.2 });
  }

  // If triggered by human DOM button, play visual effect
  if (!event.isTool && event.effect) {
    void triggerSceneEffect(event.effect, event.extra).catch(() => {});
  }
}

function injectSceneStyle(): void {
  if (document.getElementById('banh-chung-style')) return;
  const styleEl = document.createElement('style');
  styleEl.id = 'banh-chung-style';
  styleEl.textContent = `
    .bc-root {
      position: relative;
      width: 100%;
      height: 100%;
      min-height: 540px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      font-family: var(--font-body);
      user-select: none;
      background: #19271d;
    }
    .bc-hud {
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
    .bc-hud > * { pointer-events: auto; }
    .bc-badge {
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
    .bc-meter-box {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(255, 248, 236, 0.95);
      border: 2px solid var(--wood);
      padding: 4px 12px;
      border-radius: var(--r-pill);
      box-shadow: var(--shadow-toy);
    }
    .bc-meter-label {
      font-size: 0.8rem;
      font-weight: 800;
      font-family: var(--font-display);
      color: var(--ink);
    }
    .bc-meter-track {
      width: 90px;
      height: 10px;
      background: var(--paper-deep);
      border: 1px solid var(--wood);
      border-radius: var(--r-pill);
      overflow: hidden;
    }
    .bc-meter-fill {
      height: 100%;
      background: linear-gradient(90deg, #4caf50 0%, #ff9800 70%, #f44336 100%);
      width: 0%;
      transition: width 0.3s ease;
      border-radius: var(--r-pill);
    }
    .bc-meter-val {
      font-size: 0.75rem;
      font-weight: 800;
      color: var(--lacquer-deep);
      min-width: 60px;
      text-align: right;
    }
    .bc-ratio-bar {
      position: absolute;
      top: calc(52px + env(safe-area-inset-top));
      left: 12px;
      right: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      z-index: 10;
      pointer-events: none;
      flex-wrap: wrap;
    }
    .bc-ratio-pill {
      pointer-events: auto;
      background: rgba(255, 255, 255, 0.92);
      border: 1.5px solid #2e7d32;
      border-radius: 16px;
      padding: 3px 10px;
      font-size: 0.76rem;
      font-weight: 700;
      font-family: var(--font-display);
      box-shadow: 0 2px 6px rgba(0,0,0,0.12);
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .bc-banner {
      position: absolute;
      top: calc(90px + env(safe-area-inset-top));
      left: 50%;
      transform: translateX(-50%);
      background: rgba(33, 33, 33, 0.88);
      color: #fff;
      padding: 5px 14px;
      border-radius: 20px;
      font-size: 0.8rem;
      font-family: var(--font-body);
      max-width: 90%;
      text-align: center;
      z-index: 11;
      pointer-events: none;
      transition: opacity 0.3s ease;
      box-shadow: 0 3px 8px rgba(0,0,0,0.25);
    }
    .bc-canvas-wrap {
      flex: 1;
      position: relative;
      width: 100%;
      height: 100%;
      overflow: hidden;
      cursor: grab;
    }
    .bc-canvas-wrap:active { cursor: grabbing; }
    .bc-canvas-wrap canvas {
      display: block;
      width: 100% !important;
      height: 100% !important;
    }
    .bc-dock {
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
    .bc-dock-row {
      display: flex;
      align-items: center;
      gap: 6px;
      overflow-x: auto;
      scrollbar-width: none;
      -webkit-overflow-scrolling: touch;
      padding-bottom: 2px;
    }
    .bc-dock-row::-webkit-scrollbar { display: none; }
    .bc-dock-label {
      font-size: 0.72rem;
      font-weight: 800;
      font-family: var(--font-display);
      color: var(--ink-soft);
      white-space: nowrap;
      min-width: 65px;
    }
    .bc-btn {
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
      transition: transform 0.1s ease, background 0.1s ease, border-color 0.1s ease;
    }
    .bc-btn:hover { background: var(--paper-deep); }
    .bc-btn:active { transform: translateY(2px); }
    .bc-btn.gold {
      background: linear-gradient(135deg, #ffd54f, #ffb300);
      color: #3e2723;
      border-color: #f57f17;
      font-weight: 800;
    }
    .bc-btn.danger {
      background: linear-gradient(135deg, #ff8a80, #ff5252);
      color: #fff;
      border-color: #d32f2f;
    }
  `;
  document.head.appendChild(styleEl);
}

/* ================== SCENE LIFECYCLE ================== */

export function buildBanhChungScene(container: HTMLElement): void {
  destroyBanhChungScene();
  injectSceneStyle();

  loadState();
  const current = getBanhChungState();

  rootEl = document.createElement('div');
  rootEl.className = 'bc-root';
  gsapCtx = gsap.context(() => {}, rootEl);

  // HUD Top Bar
  const hudEl = document.createElement('div');
  hudEl.className = 'bc-hud';

  const titleBadge = document.createElement('div');
  titleBadge.className = 'bc-badge';
  titleBadge.innerHTML = '🟩 <span>Bánh Chưng Lang Liêu</span>';
  hudEl.appendChild(titleBadge);

  statusBadgeEl = document.createElement('div');
  statusBadgeEl.className = 'bc-badge';
  statusBadgeEl.innerHTML = '📦 <span>Đang gói</span>';
  hudEl.appendChild(statusBadgeEl);

  const massBox = document.createElement('div');
  massBox.className = 'bc-meter-box';
  massBox.innerHTML = `
    <span class="bc-meter-label">Khối lượng:</span>
    <div class="bc-meter-track">
      <div class="bc-meter-fill" id="bc-mass-fill"></div>
    </div>
    <span class="bc-meter-val" id="bc-mass-val">0 / ${MAX_CAPACITY_KG} kg</span>
  `;
  totalMassFillEl = massBox.querySelector('#bc-mass-fill');
  totalMassValEl = massBox.querySelector('#bc-mass-val');
  hudEl.appendChild(massBox);

  const statsBadge = document.createElement('div');
  statsBadge.className = 'bc-badge';
  statsBadge.innerHTML = `🏆 Thắng: <strong id="bc-wins" style="margin:0 4px">0</strong> | Lần gói: <strong id="bc-tries" style="margin:0 4px">0</strong>`;
  winsEl = statsBadge.querySelector('#bc-wins');
  triesEl = statsBadge.querySelector('#bc-tries');
  hudEl.appendChild(statsBadge);

  const webmcpStatus = getWebMCPStatus();
  const webmcpBadge = document.createElement('div');
  webmcpBadge.className = 'bc-badge';
  webmcpBadge.innerHTML = `🤖 WebMCP: ${webmcpStatus.text}`;
  hudEl.appendChild(webmcpBadge);

  rootEl.appendChild(hudEl);

  // Ratio Indicators Row
  const ratioRow = document.createElement('div');
  ratioRow.className = 'bc-ratio-bar';
  ratioRow.innerHTML = `
    <div class="bc-ratio-pill" style="border-color:#388e3c">🍚 Nếp: <span id="bc-ratio-nep">0%</span> (chuẩn 50%)</div>
    <div class="bc-ratio-pill" style="border-color:#fbc02d">🟡 Đậu: <span id="bc-ratio-dau">0%</span> (chuẩn 25%)</div>
    <div class="bc-ratio-pill" style="border-color:#e53935">🥩 Thịt: <span id="bc-ratio-thit">0%</span> (chuẩn 25%)</div>
    <div class="bc-ratio-pill" style="border-color:#7b1fa2">🎯 Sai số tốt: <span id="bc-best-score">Chưa có</span></div>
  `;
  ratioNepEl = ratioRow.querySelector('#bc-ratio-nep');
  ratioDauEl = ratioRow.querySelector('#bc-ratio-dau');
  ratioThitEl = ratioRow.querySelector('#bc-ratio-thit');
  bestScoreEl = ratioRow.querySelector('#bc-best-score');
  rootEl.appendChild(ratioRow);

  // Message banner
  messageBannerEl = document.createElement('div');
  messageBannerEl.className = 'bc-banner';
  messageBannerEl.textContent = 'Hãy cho nếp, đậu xanh và thịt mỡ vào khuôn theo tỷ lệ 50/25/25!';
  rootEl.appendChild(messageBannerEl);

  // 3D Canvas wrapper
  const canvasWrap = document.createElement('div');
  canvasWrap.className = 'bc-canvas-wrap';
  rootEl.appendChild(canvasWrap);

  // Bottom Control Dock
  const dockEl = document.createElement('div');
  dockEl.className = 'bc-dock';

  // Row 1: Thả nguyên liệu
  const dropRow = document.createElement('div');
  dropRow.className = 'bc-dock-row';
  dropRow.innerHTML = `<span class="bc-dock-label">Cho vào:</span>`;

  const dropButtons: Array<{ label: string; type: Ingredient; mass: number; title: string }> = [
    { label: '🍚 +1kg Nếp', type: 'nep', mass: 1, title: 'Thêm 1kg gạo nếp' },
    { label: '🍚 +0.5kg Nếp', type: 'nep', mass: 0.5, title: 'Thêm 0.5kg gạo nếp' },
    { label: '🟡 +0.5kg Đậu', type: 'dau_xanh', mass: 0.5, title: 'Thêm 0.5kg đậu xanh' },
    { label: '🥩 +0.5kg Thịt', type: 'thit_mo', mass: 0.5, title: 'Thêm 0.5kg thịt mỡ' },
  ];

  for (const db of dropButtons) {
    const btn = document.createElement('button');
    btn.className = 'bc-btn';
    btn.innerHTML = db.label;
    btn.title = db.title;
    btn.addEventListener('click', () => {
      driveDropIngredient(db.type, db.mass, false);
    });
    dropRow.appendChild(btn);
  }

  // Funny hook button: 100kg pork!
  const fatPorkBtn = document.createElement('button');
  fatPorkBtn.className = 'bc-btn danger';
  fatPorkBtn.innerHTML = '🥩 100kg Thịt Mỡ!';
  fatPorkBtn.title = 'Thả 100kg thịt mỡ thử thách nồi bánh (nguy hiểm!)';
  fatPorkBtn.addEventListener('click', () => {
    driveDropIngredient('thit_mo', 100, false);
  });
  dropRow.appendChild(fatPorkBtn);

  dockEl.appendChild(dropRow);

  // Row 2: Hành động
  const actionRow = document.createElement('div');
  actionRow.className = 'bc-dock-row';
  actionRow.innerHTML = `<span class="bc-dock-label">Hành động:</span>`;

  const foldBtn = document.createElement('button');
  foldBtn.className = 'bc-btn gold';
  foldBtn.innerHTML = '🎋 Gói Bánh & Luộc';
  foldBtn.title = 'Gói lá dong và kiểm tra tỷ lệ nguyên liệu';
  foldBtn.addEventListener('click', () => {
    driveFoldAndBoil(false);
  });
  actionRow.appendChild(foldBtn);

  const resetBtn = document.createElement('button');
  resetBtn.className = 'bc-btn';
  resetBtn.innerHTML = '🔄 Dọn Khuôn Mới';
  resetBtn.title = 'Xóa nguyên liệu hiện tại để làm lại từ đầu';
  resetBtn.addEventListener('click', () => {
    driveReset();
  });
  actionRow.appendChild(resetBtn);

  dockEl.appendChild(actionRow);
  rootEl.appendChild(dockEl);

  container.appendChild(rootEl);

  // Three.js Scene Setup
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a261c);
  scene.fog = new THREE.FogExp2(0x1a261c, 0.08);
  clock = new THREE.Clock();

  const initialWidth = canvasWrap.clientWidth || window.innerWidth;
  const initialHeight = canvasWrap.clientHeight || 500;

  camera = new THREE.PerspectiveCamera(42, initialWidth / initialHeight, 0.1, 50);
  camera.position.set(0, 3.2, 4.2);
  camera.lookAt(0, 0.5, 0);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setSize(initialWidth, initialHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  canvasWrap.appendChild(renderer.domElement);

  // Lights
  const ambientLight = new THREE.AmbientLight(0xfff8e1, 1.2);
  scene.add(ambientLight);

  const sunLight = new THREE.DirectionalLight(0xffecb3, 1.6);
  sunLight.position.set(3.5, 6, 4.5);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 1024;
  sunLight.shadow.mapSize.height = 1024;
  scene.add(sunLight);

  const fillLight = new THREE.DirectionalLight(0x81c784, 0.6);
  fillLight.position.set(-3.5, 2.5, -2);
  scene.add(fillLight);

  // Floor / Festive wooden surface
  const floorGeo = new THREE.CylinderGeometry(3.0, 3.1, 0.1, 36);
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x4e342e,
    roughness: 0.8,
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.position.set(0, -0.05, 0);
  floor.receiveShadow = true;
  scene.add(floor);

  // Box Group
  worldGroup = new THREE.Group();
  scene.add(worldGroup);

  boxGroup = createBox();
  worldGroup.add(boxGroup);

  lidMesh = createLid();
  worldGroup.add(lidMesh);

  goldHatGroup = createGoldHat();
  worldGroup.add(goldHatGroup);

  // Populate loaded items
  populateExistingItems(current);
  updateHUD();

  // Pointer drag rotation
  const onPointerDown = (e: MouseEvent | TouchEvent) => {
    isDragging = true;
    prevMouseX = 'touches' in e ? e.touches[0].clientX : e.clientX;
  };
  const onPointerMove = (e: MouseEvent | TouchEvent) => {
    if (!isDragging || !worldGroup) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const deltaX = clientX - prevMouseX;
    prevMouseX = clientX;
    targetRotationY += deltaX * 0.01;
  };
  const onPointerUp = () => {
    isDragging = false;
  };

  pointerAbortController = new AbortController();
  const { signal } = pointerAbortController;
  canvasWrap.addEventListener('mousedown', onPointerDown, { signal });
  window.addEventListener('mousemove', onPointerMove, { signal });
  window.addEventListener('mouseup', onPointerUp, { signal });
  canvasWrap.addEventListener('touchstart', onPointerDown, { passive: true, signal });
  window.addEventListener('touchmove', onPointerMove, { passive: true, signal });
  window.addEventListener('touchend', onPointerUp, { signal });

  // ResizeObserver
  resizeObserver = new ResizeObserver(() => {
    if (!canvasWrap || !renderer || !camera) return;
    const w = canvasWrap.clientWidth;
    const h = canvasWrap.clientHeight;
    if (w === 0 || h === 0) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });
  resizeObserver.observe(canvasWrap);

  // Subscribe to rules state changes
  unsubscribeChange = onBanhChungChange(handleBanhChungChange);

  // Render Loop
  function renderLoop(): void {
    if (!renderer || !scene || !camera || !clock) return;

    // Smooth world rotation
    if (worldGroup) {
      worldGroup.rotation.y += (targetRotationY - worldGroup.rotation.y) * 0.1;
    }

    renderer.render(scene, camera);
    frameId = requestAnimationFrame(renderLoop);
  }
  renderLoop();
}

export function destroyBanhChungScene(): void {
  if (pointerAbortController) {
    pointerAbortController.abort();
    pointerAbortController = null;
  }
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
  if (gsapCtx) {
    gsapCtx.revert();
    gsapCtx = null;
  }

  clearIngredients();

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
  clock = null;
  worldGroup = null;
  boxGroup = null;
  baseMesh = null;
  wallFront = null;
  wallBack = null;
  wallLeft = null;
  wallRight = null;
  lidMesh = null;
  goldHatGroup = null;
  giantPorkMesh = null;

  if (rootEl) {
    const styleEl = document.getElementById('banh-chung-style');
    if (styleEl) styleEl.remove();
    rootEl.remove();
    rootEl = null;
  }

  totalMassFillEl = null;
  totalMassValEl = null;
  statusBadgeEl = null;
  ratioNepEl = null;
  ratioDauEl = null;
  ratioThitEl = null;
  bestScoreEl = null;
  winsEl = null;
  triesEl = null;
  messageBannerEl = null;
}
