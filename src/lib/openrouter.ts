import config from '../config';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_TIMEOUT_MS = 20000;

type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

type OpenRouterChoice = {
  message?: {
    role: string;
    content?: string;
  };
};

type OpenRouterError = {
  message?: string;
};

type OpenRouterResponse = {
  choices?: OpenRouterChoice[];
  error?: OpenRouterError;
};

export type ChatOptions = {
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  userId?: string;
};

export async function runOpenRouterChat(prompt: string, options?: ChatOptions): Promise<string> {
  const { openRouter } = config;
  if (!openRouter.apiKey) {
    throw new Error('OpenRouter API key is not configured. Set OPENROUTER_API_KEY to enable AI features.');
  }

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content:
        options?.systemPrompt ||
        'You are Jeeves, a concise moderation copilot for Discord staff. Keep answers short, specific, and factual.',
    },
    { role: 'user', content: prompt },
  ];

  const headers: Record<string, string> = {
    Authorization: `Bearer ${openRouter.apiKey}`,
    'Content-Type': 'application/json',
  };

  if (openRouter.siteUrl) {
    headers['HTTP-Referer'] = openRouter.siteUrl;
  }
  if (openRouter.appName) {
    headers['X-Title'] = openRouter.appName;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options?.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: openRouter.model,
        messages,
        temperature: options?.temperature ?? 0.35,
        max_tokens: options?.maxTokens ?? 400,
        user: options?.userId,
      }),
      signal: controller.signal,
    });

    const data = (await response.json()) as OpenRouterResponse;

    if (!response.ok) {
      const message = data?.error?.message || `OpenRouter request failed with status ${response.status}`;
      throw new Error(message);
    }

    const content = data?.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new Error('OpenRouter returned an empty response.');
    }

    return content;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('OpenRouter request timed out.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
