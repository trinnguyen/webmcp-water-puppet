import * as THREE from 'three';
import { gsap } from 'gsap';
import type {
  SonTinhChangeEvent,
} from './rules';
import {
  getSonTinhState,
  onSonTinhChange,
} from './rules';
import { playSFX } from '../../audio';
import { reducedMotion } from '../../motion';
import { showToast } from '../../ui';

let rootEl: HTMLElement | null = null;
let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;
let frameId = 0;
let resizeObserver: ResizeObserver | null = null;
let unsubscribeChange: (() => void) | null = null;
let gsapCtx: gsap.Context | null = null;

// Scene objects
let mountainGroup: THREE.Group | null = null;
let waterPlane: THREE.Mesh | null = null;
let groundPlane: THREE.Mesh | null = null;

function safeGsapTo(target: gsap.TweenTarget, vars: gsap.TweenVars): gsap.core.Tween {
  return gsapCtx ? gsapCtx.add(() => gsap.to(target, vars)) : gsap.to(target, vars);
}

function buildVoxelMountain(heightLayers: number): THREE.Group {
  const group = new THREE.Group();
  const dirtMat = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.8 });
  const grassMat = new THREE.MeshStandardMaterial({ color: 0x4caf50, roughness: 0.7 });
  const snowMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });

  // Height maps to layers (0..100 -> 0..10 voxel layers)
  const layers = Math.max(3, Math.min(10, Math.ceil(heightLayers / 10)));

  for (let i = 0; i < layers; i++) {
    const scale = 1.0 - (i / layers) * 0.5; // taper toward top
    const width = 1.8 * scale;
    const depth = 1.8 * scale;
    const height = 0.2;

    let mat = dirtMat;
    if (i > layers * 0.7) mat = snowMat;
    else if (i > layers * 0.3) mat = grassMat;

    const geo = new THREE.BoxGeometry(width, height, depth);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(0, i * height + height / 2, 0);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  // Base marker
  group.position.set(0, 0, 0);
  return group;
}

function buildWaterPlane(): THREE.Mesh {
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x2196f3,
    transparent: true,
    opacity: 0.5,
    roughness: 0.1,
    metalness: 0.3,
  });
  const geo = new THREE.PlaneGeometry(6, 6);
  const mesh = new THREE.Mesh(geo, waterMat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(0, -1, 0); // start below ground
  mesh.receiveShadow = true;
  return mesh;
}

function buildGround(): THREE.Mesh {
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 0.9 });
  const geo = new THREE.PlaneGeometry(6, 6);
  const mesh = new THREE.Mesh(geo, groundMat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(0, -0.1, 0);
  mesh.receiveShadow = true;
  return mesh;
}

function updateScene(): void {
  if (!mountainGroup || !waterPlane || !scene) return;

  const state = getSonTinhState();
  const run = state.currentRun;

  // Rebuild mountain voxels
  scene.remove(mountainGroup);
  disposeGroup(mountainGroup);
  mountainGroup = buildVoxelMountain(run.mountainHeight);
  scene.add(mountainGroup);

  // Position water based on waterLevel vs mountainHeight
  const waterRatio = run.waterLevel / 100;
  const waterY = -1.0 + waterRatio * 2.5;
  waterPlane.position.y = waterY;

  // Update water color based on threat
  const threatRatio = run.threat / 100;
  const waterMesh = waterPlane as THREE.Mesh;
  const waterMat = waterMesh.material as THREE.MeshStandardMaterial;
  const r = 0.13 + threatRatio * 0.5;
  const g = 0.6 - threatRatio * 0.3;
  const b = 0.95 - threatRatio * 0.5;
  waterMat.color.setRGB(r, g, b);
}

function disposeGroup(group: THREE.Group): void {
  group.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      if (Array.isArray(child.material)) {
        child.material.forEach((m) => m.dispose());
      } else {
        child.material.dispose();
      }
    }
  });
}

function handleChange(event: SonTinhChangeEvent): void {
  if (reducedMotion()) {
    updateScene();
    return;
  }

  if (event.effect === 'raised') {
    // Animate mountain growth
    playSFX('sneeze');
    updateScene();
    // Add a subtle scale pop
    if (mountainGroup) {
      safeGsapTo(mountainGroup.scale, {
        x: 1.05, y: 1.05, z: 1.05,
        duration: 0.15,
        yoyo: true,
        repeat: 1,
      });
    }
  } else if (event.effect === 'submerged') {
    playSFX('splash');
    updateScene();
    showToast('Sơn Tinh bị ngập! Thủy Tinh thắng thế! 🌊');
  } else if (event.effect === 'survived') {
    playSFX('win_chime');
    updateScene();
    showToast('Sơn Tinh toàn thắng! ⛰️');
  } else if (event.effect === 'summoned') {
    playSFX('coin');
    updateScene();
  } else if (event.effect === 'no_points') {
    playSFX('sneeze');
    showToast('Không đủ điểm!');
  } else {
    updateScene();
  }
}

export function buildScene(container: HTMLElement): void {
  rootEl = container;

  // Create renderer
  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
  });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x87ceeb); // Sky blue
  container.appendChild(renderer.domElement);

  // Scene
  scene = new THREE.Scene();

  // Camera
  const aspect = container.clientWidth / container.clientHeight;
  camera = new THREE.PerspectiveCamera(40, aspect, 0.1, 20);
  camera.position.set(3, 2.5, 4);
  camera.lookAt(0, 0.8, 0);

  // Lighting
  const ambient = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambient);

  const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
  dirLight.position.set(5, 8, 4);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 1024;
  dirLight.shadow.mapSize.height = 1024;
  scene.add(dirLight);

  const fillLight = new THREE.DirectionalLight(0x8888ff, 0.3);
  fillLight.position.set(-3, 2, -2);
  scene.add(fillLight);

  // Ground
  groundPlane = buildGround();
  scene.add(groundPlane);

  // Water
  waterPlane = buildWaterPlane();
  scene.add(waterPlane);

  // Mountain
  const state = getSonTinhState();
  mountainGroup = buildVoxelMountain(state.currentRun.mountainHeight);
  scene.add(mountainGroup);

  // GSAP context
  gsapCtx = gsap.context(() => {}, container);

  // Listen for state changes
  unsubscribeChange = onSonTinhChange(handleChange);

  // Resize observer
  resizeObserver = new ResizeObserver(() => {
    if (!renderer || !camera || !container) return;
    const w = container.clientWidth;
    const h = container.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  });
  resizeObserver.observe(container);

  // Animation loop
  function animate(): void {
    frameId = requestAnimationFrame(animate);
    if (renderer && scene && camera) {
      renderer.render(scene, camera);
    }
  }
  animate();
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
  if (gsapCtx) {
    gsapCtx.revert();
    gsapCtx = null;
  }
  if (renderer) {
    if (renderer.domElement && rootEl) {
      rootEl.removeChild(renderer.domElement);
    }
    renderer.dispose();
    renderer = null;
  }
  if (mountainGroup) {
    disposeGroup(mountainGroup);
    mountainGroup = null;
  }
  if (waterPlane) {
    waterPlane.geometry.dispose();
    (waterPlane.material as THREE.Material).dispose();
    waterPlane = null;
  }
  if (groundPlane) {
    groundPlane.geometry.dispose();
    (groundPlane.material as THREE.Material).dispose();
    groundPlane = null;
  }
  scene = null;
  camera = null;
  rootEl = null;
}
