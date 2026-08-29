import * as THREE from 'three';
import { PuppetState } from './state';

export function createPuppet(state: PuppetState): THREE.Group {
  const group = new THREE.Group();
  group.name = state.id;
  
  // Set position based on state
  group.position.set(state.x, 0.5, state.z);

  // Load Sprite
  const map = new THREE.TextureLoader().load(`assets/puppets/${state.character}.svg`);
  map.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: map, color: 0xffffff });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(2.5, 2.5, 1);
  sprite.position.y = 1.25; // Half of scale to rest on water
  
  // Add Stick (Cylinder)
  const stickGeometry = new THREE.CylinderGeometry(0.05, 0.05, 3, 8);
  const stickMaterial = new THREE.MeshStandardMaterial({ color: 0x4A2E15 });
  const stick = new THREE.Mesh(stickGeometry, stickMaterial);
  stick.position.y = -0.5; // Stick goes down into the water
  
  group.add(stick);
  group.add(sprite);
  
  // Add label for debugging or just flavor
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.font = 'bold 24px "Be Vietnam Pro", sans-serif';
  ctx.fillStyle = 'white';
  ctx.strokeStyle = 'black';
  ctx.lineWidth = 4;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const labelText = state.character.toUpperCase();
  ctx.strokeText(labelText, 128, 32);
  ctx.fillText(labelText, 128, 32);
  
  const labelTexture = new THREE.CanvasTexture(canvas);
  const labelMat = new THREE.SpriteMaterial({ map: labelTexture });
  const labelSprite = new THREE.Sprite(labelMat);
  labelSprite.position.y = 3.0;
  labelSprite.scale.set(1.5, 0.375, 1);
  
  group.add(labelSprite);
  
  return group;
}
