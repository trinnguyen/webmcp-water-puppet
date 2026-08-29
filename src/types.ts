export interface WebMCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (input: any) => Promise<string> | string;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
}

export interface ModelContext {
  registerTool: (tool: WebMCPTool, opts?: { signal?: AbortSignal }) => Promise<unknown>;
  addEventListener: (type: string, listener: (event: any) => void) => void;
}

declare global {
  interface Window {
    __debugTools: Record<string, (input: any) => string | Promise<string>>;
    __webmcpController?: AbortController;
  }
  interface Document {
    modelContext?: ModelContext;
  }
}

export interface GameToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (input: any) => Promise<string>;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
}

export interface GameDef {
  id: string;
  name: string;
  nameEn: string;
  emoji: string;
  minPlayers: number;
  maxPlayers: number;
  description: string;
  buildScene: (container: HTMLElement) => void;
  destroyScene: () => void;
  tools: GameToolDef[];
  saveKey: string;
}
