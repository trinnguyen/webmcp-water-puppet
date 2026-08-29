import gsap from 'gsap';
import * as THREE from 'three';
import { ActionType, state, MoveAction, PuppetState } from './state';
import { playSFX } from './audio';

export async function processMoveQueue(scene: THREE.Scene, moves: MoveAction[]) {
  for (const move of moves) {
    const puppetObj = scene.getObjectByName(move.id);
    if (!puppetObj) {
      console.warn(`Puppet ${move.id} not found in scene for action ${move.action}`);
      continue;
    }
    
    let targetObj: THREE.Object3D | undefined;
    if (move.targetId) {
      targetObj = scene.getObjectByName(move.targetId);
      if (!targetObj && move.action === 'chase') {
        // Tangled Strings Hook
        tangledStrings(scene);
        throw new Error('String tangled. Reboot.');
      }
    }

    await executeAction(puppetObj, move.action, targetObj);
  }
}

export function executeAction(puppetObj: THREE.Object3D, action: ActionType, targetObj?: THREE.Object3D): Promise<void> {
  return new Promise((resolve) => {
    gsap.killTweensOf(puppetObj.position);
    gsap.killTweensOf(puppetObj.rotation);

    switch (action) {
      case 'splash':
        // Dragon Sneeze Hook
        if (puppetObj.name.startsWith('dragon') || (puppetObj.userData.character === 'dragon')) {
          if (Math.random() < 0.1) {
            playSFX('sneeze');
            // Flash red
            puppetObj.children.forEach(c => {
              if (c instanceof THREE.Sprite) {
                gsap.to((c.material as THREE.SpriteMaterial).color, { r: 1, g: 0, b: 0, duration: 0.2, yoyo: true, repeat: 1 });
              }
            });
            setTimeout(resolve, 800);
            return;
          }
        }
        
        playSFX('splash');
        gsap.to(puppetObj.position, {
          y: -0.5,
          duration: 0.2,
          ease: "power2.in",
          yoyo: true,
          repeat: 1,
          onComplete: resolve
        });
        break;
        
      case 'spin':
        gsap.to(puppetObj.rotation, {
          y: puppetObj.rotation.y + Math.PI * 2,
          duration: 1.0,
          ease: "back.inOut(1.7)",
          onComplete: resolve
        });
        break;
        
      case 'chase':
        if (targetObj) {
          gsap.to(puppetObj.position, {
            x: targetObj.position.x,
            z: targetObj.position.z,
            duration: 1.5,
            ease: "power2.inOut",
            onComplete: resolve
          });
        } else {
          resolve();
        }
        break;
        
      case 'wave':
        gsap.to(puppetObj.rotation, {
          z: Math.PI / 12,
          duration: 0.3,
          ease: "sine.inOut",
          yoyo: true,
          repeat: 3,
          onComplete: () => {
            puppetObj.rotation.z = 0;
            resolve();
          }
        });
        break;
        
      case 'jump':
        playSFX('splash');
        gsap.to(puppetObj.position, {
          y: 3.0,
          duration: 0.6,
          ease: "circ.out",
          yoyo: true,
          repeat: 1,
          onComplete: resolve
        });
        break;
        
      default:
        resolve();
    }
  });
}

export function tangledStrings(scene: THREE.Scene) {
  playSFX('sneeze'); // reuse sfx for error
  scene.children.forEach(child => {
    if (child.name) {
      gsap.to(child.position, {
        x: child.position.x + (Math.random() - 0.5) * 0.5,
        z: child.position.z + (Math.random() - 0.5) * 0.5,
        duration: 0.1,
        yoyo: true,
        repeat: 10
      });
    }
  });
}

export function checkFishPanic(scene: THREE.Scene, newDragonState: PuppetState) {
  state.activeShow.cast.forEach(p => {
    if (p.character === 'fish') {
      const dist = Math.sqrt(Math.pow(p.x - newDragonState.x, 2) + Math.pow(p.z - newDragonState.z, 2));
      if (dist <= 3) {
        const fishObj = scene.getObjectByName(p.id);
        if (fishObj) {
          console.log('Fish Panic!');
          playSFX('splash');
          gsap.to(fishObj.position, {
            x: fishObj.position.x > 0 ? 10 : -10,
            y: 2,
            duration: 0.8,
            ease: "power2.out",
            onComplete: () => {
              gsap.to(fishObj.position, { y: 0.5, duration: 0.2, ease: "bounce.out" });
            }
          });
        }
      }
    }
  });
}

export function triggerFourthWall() {
  const popup = document.getElementById('teu-popup');
  if (popup) {
    popup.classList.add('show');
    setTimeout(() => popup.classList.remove('show'), 4000);
  }
}
