import * as THREE from 'three';

export function initScene(canvasContainer: HTMLElement) {
  const scene = new THREE.Scene();
  
  // Camera
  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 8, 15);
  camera.lookAt(0, 0, 0);

  // Renderer
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  canvasContainer.appendChild(renderer.domElement);

  // Lights
  const ambientLight = new THREE.AmbientLight(0xFFF3E0, 0.6);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 1);
  dirLight.position.set(-10, 10, 5);
  scene.add(dirLight);

  // Water Fallback (Simple Plane)
  // To avoid complex Water.js shader compilation issues on some mobiles for this quick prototype,
  // we'll use a stylized MeshStandardMaterial that looks good.
  const waterGeometry = new THREE.PlaneGeometry(100, 100);
  const waterMaterial = new THREE.MeshStandardMaterial({
    color: 0x2E9AB6,
    roughness: 0.1,
    metalness: 0.8,
    transparent: true,
    opacity: 0.8,
  });
  const water = new THREE.Mesh(waterGeometry, waterMaterial);
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0;
  scene.add(water);

  // Handle Resize
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  return { scene, camera, renderer };
}

export function startRenderLoop(scene: THREE.Scene, camera: THREE.Camera, renderer: THREE.WebGLRenderer) {
  function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
  }
  animate();
}
