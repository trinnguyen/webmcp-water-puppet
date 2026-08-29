import * as THREE from 'three';
import { initScene, startRenderLoop } from './scene';
import { createPuppet } from './puppet';
import { initTools, ToolExecutors } from './tools';
import { state, addPuppetState, queueMoveState, saveShowToStorage } from './state';
import { processMoveQueue, checkFishPanic, triggerFourthWall, executeAction } from './animation';
import { playBGM } from './audio';
import { setupUI, updateWebMCPStatus, updateShowName } from './ui';

let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let lastFarmerActivity = Date.now();

async function initApp() {
  const container = document.getElementById('canvas-container');
  if (!container) return;

  const sceneData = initScene(container);
  scene = sceneData.scene;
  camera = sceneData.camera as THREE.PerspectiveCamera;
  renderer = sceneData.renderer;

  startRenderLoop(scene, camera, renderer);

  setupUI(
    () => { console.log('Entered stage'); },
    () => { 
      // Play saved show
      clearStage();
      reconstructShow();
    }
  );

  window.addEventListener('webmcp-status-change', ((e: CustomEvent) => {
    updateWebMCPStatus(e.detail, e.detail === 'online' ? 'Online' : 'Fallback (__debugTools)');
  }) as EventListener);

  const executors: ToolExecutors = {
    list_cast: async () => {
      return JSON.stringify({
        characters: ['teu', 'dragon', 'farmer', 'fish'],
        descriptions: { teu: 'Chú Tễu - The Jester', dragon: 'Rồng', farmer: 'Nông Dân', fish: 'Cá' }
      });
    },
    spawn_puppet: async (input: any) => {
      if (addPuppetState(input)) {
        const puppet = createPuppet(input);
        scene.add(puppet);
        
        if (input.character === 'dragon') {
          checkFishPanic(scene, input);
        }
        if (input.character === 'farmer') {
          lastFarmerActivity = Date.now();
        }
        return JSON.stringify({ status: 'success', message: `Spawned ${input.character} at ${input.x},${input.z}` });
      }
      return JSON.stringify({ status: 'error', message: 'Stage full (15 max)' });
    },
    choreograph_move: async (input: any) => {
      queueMoveState(input);
      
      const puppet = state.activeShow.cast.find(p => p.id === input.id);
      if (puppet && puppet.character === 'farmer') {
        lastFarmerActivity = Date.now();
      }

      if (state.unsavedMoveCount > 5) {
        triggerFourthWall();
      }
      try {
        await processMoveQueue(scene, [input]);
        return JSON.stringify({ status: 'success', move: input.action });
      } catch (e: any) {
        return JSON.stringify({ status: 'error', message: e.message });
      }
    },
    set_music: async (input: any) => {
      state.activeShow.music = input.track;
      playBGM(input.track);
      return JSON.stringify({ status: 'success', track: input.track });
    },
    save_show: async (input: any) => {
      saveShowToStorage(input.showName);
      updateShowName(input.showName);
      
      // Applause Break Hook
      const promises = state.activeShow.cast.map(p => {
        const obj = scene.getObjectByName(p.id);
        if (obj) return executeAction(obj, 'wave');
        return Promise.resolve();
      });
      await Promise.all(promises);

      return JSON.stringify({ status: 'success', name: input.showName });
    }
  };

  await initTools(executors);
  
  // idle timer for Sleepy Farmer
  setInterval(() => {
    const farmer = state.activeShow.cast.find(p => p.character === 'farmer');
    if (farmer && Date.now() - lastFarmerActivity > 10000) {
      const obj = scene.getObjectByName(farmer.id);
      if (obj && obj.position.y > 0) {
        obj.position.y = 0; // Sink slightly
        // Add Zzz emoji via DOM
        const emoji = document.createElement('div');
        emoji.className = 'floating-emoji';
        emoji.textContent = 'Zzz';
        // Need to project 3d pos to 2d screen... simplified for prototype: just append to center
        emoji.style.left = '50%';
        emoji.style.top = '50%';
        document.body.appendChild(emoji);
        setTimeout(() => emoji.remove(), 2000);
        lastFarmerActivity = Date.now(); // wait 10s before checking again
      }
    }
  }, 1000);
}

function clearStage() {
  const toRemove: THREE.Object3D[] = [];
  scene.children.forEach(child => {
    if (child instanceof THREE.Group) { // puppets are Groups
      toRemove.push(child);
    }
  });
  toRemove.forEach(c => scene.remove(c));
}

async function reconstructShow() {
  playBGM(state.activeShow.music || 'silent');
  
  // Spawn all
  for (const p of state.activeShow.cast) {
    const puppet = createPuppet(p);
    scene.add(puppet);
  }
  
  // Animate all moves
  await processMoveQueue(scene, state.activeShow.moves);
}

initApp();
