export type Character = 'teu' | 'dragon' | 'farmer' | 'fish';
export type ActionType = 'splash' | 'spin' | 'chase' | 'wave' | 'jump';

export interface PuppetState {
  id: string;
  character: Character;
  x: number;
  z: number;
}

export interface MoveAction {
  id: string;
  action: ActionType;
  targetId?: string;
}

export interface ShowState {
  name: string;
  music: string;
  cast: PuppetState[];
  moves: MoveAction[];
}

export interface AppState {
  activeShow: ShowState;
  savedShows: Record<string, ShowState>;
  unsavedMoveCount: number;
}

const STORAGE_KEY = 'waterPuppetShows';

export const state: AppState = {
  activeShow: {
    name: 'Buổi diễn mới',
    music: 'silent',
    cast: [],
    moves: [],
  },
  savedShows: {},
  unsavedMoveCount: 0,
};

export function loadShows() {
  const data = localStorage.getItem(STORAGE_KEY);
  if (data) {
    try {
      state.savedShows = JSON.parse(data);
    } catch (e) {
      console.error('Failed to parse saved shows', e);
    }
  }
}

export function saveShowToStorage(name: string) {
  state.activeShow.name = name;
  state.savedShows[name] = JSON.parse(JSON.stringify(state.activeShow));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.savedShows));
  state.unsavedMoveCount = 0; // reset for 4th wall hook
}

export function addPuppetState(puppet: PuppetState) {
  if (state.activeShow.cast.length >= 15) return false;
  state.activeShow.cast.push(puppet);
  return true;
}

export function queueMoveState(move: MoveAction) {
  state.activeShow.moves.push(move);
  state.unsavedMoveCount++;
}

export function resetActiveShow() {
  state.activeShow = {
    name: 'Buổi diễn mới',
    music: 'silent',
    cast: [],
    moves: [],
  };
  state.unsavedMoveCount = 0;
}

export function loadShowByName(name: string) {
  if (state.savedShows[name]) {
    state.activeShow = JSON.parse(JSON.stringify(state.savedShows[name]));
    state.unsavedMoveCount = 0;
    return true;
  }
  return false;
}
