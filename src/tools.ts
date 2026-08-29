export interface WebMCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (input: any) => Promise<string> | string;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
}

interface ModelContext {
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

export interface ToolExecutors {
  list_cast: () => Promise<string>;
  spawn_puppet: (input: any) => Promise<string>;
  choreograph_move: (input: any) => Promise<string>;
  set_music: (input: any) => Promise<string>;
  save_show: (input: any) => Promise<string>;
}

export async function initTools(executors: ToolExecutors) {
  const tools: WebMCPTool[] = [
    {
      name: "list_cast",
      description: "Returns available traditional Vietnamese water puppet characters.",
      inputSchema: { type: "object", properties: {} },
      execute: async () => await executors.list_cast(),
      annotations: { readOnlyHint: true, untrustedContentHint: false }
    },
    {
      name: "spawn_puppet",
      description: "Adds a puppet to the water stage at given coordinates (-10 to 10).",
      inputSchema: {
        type: "object",
        properties: {
          character: { type: "string", enum: ["teu", "dragon", "farmer", "fish"] },
          id: { type: "string", description: "Unique ID for this puppet instance" },
          x: { type: "number", description: "Left/Right position (-10 to 10)" },
          z: { type: "number", description: "Depth position (-10 to 10)" }
        },
        required: ["character", "id", "x", "z"]
      },
      execute: async (input: any) => await executors.spawn_puppet(input),
      annotations: { readOnlyHint: false, untrustedContentHint: false }
    },
    {
      name: "choreograph_move",
      description: "Queues an action for a specific puppet on stage.",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string" },
          action: { type: "string", enum: ["splash", "spin", "chase", "wave", "jump"] },
          targetId: { type: "string", description: "Required only if action is 'chase'" }
        },
        required: ["id", "action"]
      },
      execute: async (input: any) => await executors.choreograph_move(input),
      annotations: { readOnlyHint: false, untrustedContentHint: false }
    },
    {
      name: "set_music",
      description: "Plays traditional background music.",
      inputSchema: {
        type: "object",
        properties: {
          track: { type: "string", enum: ["dan_bau", "gong", "silent"] }
        },
        required: ["track"]
      },
      execute: async (input: any) => await executors.set_music(input),
      annotations: { readOnlyHint: false, untrustedContentHint: false }
    },
    {
      name: "save_show",
      description: "Saves current stage setup and move queue to local storage.",
      inputSchema: {
        type: "object",
        properties: {
          showName: { type: "string" }
        },
        required: ["showName"]
      },
      execute: async (input: any) => await executors.save_show(input),
      annotations: { readOnlyHint: false, untrustedContentHint: false }
    }
  ];

  if (typeof document.modelContext !== 'undefined') {
    console.log('[WebMCP] ✅ Context detected. Registering tools...');
    const controller = new AbortController();
    
    for (const tool of tools) {
      await document.modelContext.registerTool(tool, { signal: controller.signal });
    }

    document.modelContext.addEventListener('toolchange', (e: any) => {
      console.log('[WebMCP] Tool change event:', e);
      const evt = new CustomEvent('webmcp-status-change', { detail: 'online' });
      window.dispatchEvent(evt);
    });

    window.__webmcpController = controller;
    
    const evt = new CustomEvent('webmcp-status-change', { detail: 'online' });
    window.dispatchEvent(evt);
    
  } else {
    console.warn('[WebMCP] ❌ Not available. Exposing window.__debugTools for DevTools.');
    window.__debugTools = {
      list_cast: tools[0].execute,
      spawn_puppet: tools[1].execute,
      choreograph_move: tools[2].execute,
      set_music: tools[3].execute,
      save_show: tools[4].execute
    };
    const evt = new CustomEvent('webmcp-status-change', { detail: 'offline' });
    window.dispatchEvent(evt);
  }
}

export function cleanupTools() {
  if (window.__webmcpController) {
    window.__webmcpController.abort();
  }
}

window.addEventListener('beforeunload', cleanupTools);
