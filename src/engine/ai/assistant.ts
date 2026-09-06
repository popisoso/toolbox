/**
 * ANTHROPIC API SEAM
 * ------------------
 * This is a hook, not a feature. Modules receive `ctx.ai` and may call
 * `complete()` for future AI-assisted tools (describe-a-look → params,
 * shader authoring help, scene analysis…). Today no module uses it.
 *
 * Design:
 *  - The key is the user's own, entered in Settings and kept in localStorage.
 *    Nothing is sent anywhere until a module explicitly calls the hook.
 *  - The official SDK is loaded lazily (dynamic import → separate chunk) so
 *    the PWA pays nothing for it until first use. Requests go directly from
 *    the browser to the Anthropic API, which the SDK permits when
 *    `dangerouslyAllowBrowser` is set. A relay server can replace this
 *    provider behind the same `AIHook` interface without touching modules.
 */

export interface AIRequest {
  prompt: string;
  system?: string;
  /** Optional PNG/JPEG frame for vision-assisted tools. */
  image?: { mediaType: 'image/png' | 'image/jpeg'; base64: string };
  maxTokens?: number;
  /** Streaming text callback. */
  onText?: (delta: string) => void;
  signal?: AbortSignal;
}

export interface AIHook {
  /** True when a key is configured and the network layer exists. */
  readonly available: boolean;
  complete(req: AIRequest): Promise<string>;
}

export const AI_KEY_STORAGE = 'toolbox.anthropic.apiKey';
export const AI_MODEL = 'claude-opus-5';

export function getStoredApiKey(): string | null {
  try { return localStorage.getItem(AI_KEY_STORAGE); } catch { return null; }
}
export function setStoredApiKey(key: string | null): void {
  try {
    if (key) localStorage.setItem(AI_KEY_STORAGE, key.trim());
    else localStorage.removeItem(AI_KEY_STORAGE);
  } catch { /* private mode */ }
}

export function createAnthropicHook(): AIHook {
  return {
    get available() { return !!getStoredApiKey(); },

    async complete(req) {
      const apiKey = getStoredApiKey();
      if (!apiKey) throw new Error('No Anthropic API key configured (Settings → AI).');
      const { default: Anthropic } = await import('@anthropic-ai/sdk');
      const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

      const content: Array<
        | { type: 'text'; text: string }
        | { type: 'image'; source: { type: 'base64'; media_type: 'image/png' | 'image/jpeg'; data: string } }
      > = [];
      if (req.image) content.push({ type: 'image', source: { type: 'base64', media_type: req.image.mediaType, data: req.image.base64 } });
      content.push({ type: 'text', text: req.prompt });

      const stream = client.messages.stream(
        {
          model: AI_MODEL,
          max_tokens: req.maxTokens ?? 4096,
          ...(req.system ? { system: req.system } : {}),
          messages: [{ role: 'user', content }],
        },
        { signal: req.signal },
      );
      if (req.onText) stream.on('text', (delta) => req.onText?.(delta));
      const message = await stream.finalMessage();
      if (message.stop_reason === 'refusal') throw new Error('The model declined this request.');
      return message.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
    },
  };
}
