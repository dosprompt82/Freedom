// Minimal typing for the claude.ai artifact runtime (present only when the app
// runs inside a Claude artifact viewer). See the sample capability contract.
export {};

declare global {
  interface ClaudeSampleTool {
    name: string;
    description: string;
    inputSchema?: { type: 'object'; properties?: Record<string, unknown>; required?: string[]; [k: string]: unknown };
    execute(input: Record<string, unknown>, context: { signal: AbortSignal }): unknown;
  }
  interface ClaudeSampleFn {
    (
      input: string | { role: 'user' | 'assistant'; content: string }[],
      options?: {
        onText?: (u: { text: string; delta: string }) => void;
        signal?: AbortSignal;
        tools?: ClaudeSampleTool[];
        modelTier?: 'default' | 'complex' | 'quick';
        cache?: boolean;
      },
    ): Promise<{ text: string; truncated: boolean }>;
    limits(): Promise<{ maxPromptBytes: number; tools?: { maxCount: number } }>;
  }
  interface Window {
    claude?: { use(name: 'sample'): Promise<ClaudeSampleFn | null> };
  }
}
