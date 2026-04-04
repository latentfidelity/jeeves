import config from '../config';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_TIMEOUT_MS = 20000;

// Pricing per 1M tokens -> converted to credits (1 credit = $0.0001)
// So multiply $/1M by 10000 to get credits per 1M tokens, then /1M for per-token
const MODEL_PRICING: Record<string, { prompt: number; completion: number }> = {
  // Free models
  'meta-llama/llama-3.3-70b-instruct:free': { prompt: 0, completion: 0 },
  'meta-llama/llama-3.2-3b-instruct:free': { prompt: 0, completion: 0 },
  'google/gemma-3-27b-it:free': { prompt: 0, completion: 0 },
  'mistralai/mistral-small-3.1-24b-instruct:free': { prompt: 0, completion: 0 },
  'nvidia/nemotron-3-super-120b-a12b:free': { prompt: 0, completion: 0 },
  'nousresearch/hermes-3-llama-3.1-405b:free': { prompt: 0, completion: 0 },
  'qwen/qwen3.6-plus:free': { prompt: 0, completion: 0 },
  'openai/gpt-oss-120b:free': { prompt: 0, completion: 0 },
  // Paid models (credits per 1K tokens: $/token * 1000 * 10000)
  'openai/gpt-4o-mini': { prompt: 1.5, completion: 6 },
  'openai/gpt-4o': { prompt: 25, completion: 100 },
  'openai/o1': { prompt: 150, completion: 600 },
  'openai/o3-mini': { prompt: 11, completion: 44 },
  'anthropic/claude-3.5-sonnet': { prompt: 30, completion: 150 },
  'anthropic/claude-3-opus': { prompt: 150, completion: 750 },
  'anthropic/claude-3-5-haiku': { prompt: 8, completion: 40 },
  'anthropic/claude-3-haiku': { prompt: 2.5, completion: 12.5 },
  'deepseek/deepseek-chat': { prompt: 1.4, completion: 2.8 },
  'deepseek/deepseek-r1': { prompt: 5.5, completion: 21.9 },
  'x-ai/grok-2-1212': { prompt: 20, completion: 100 },
  'google/gemini-2.0-flash-001': { prompt: 1, completion: 4 },
  'google/gemini-1.5-pro': { prompt: 12.5, completion: 50 },
  'meta-llama/llama-3.1-405b-instruct': { prompt: 30, completion: 30 },
};

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

type OpenRouterUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
};

type OpenRouterResponse = {
  choices?: OpenRouterChoice[];
  error?: OpenRouterError;
  usage?: OpenRouterUsage;
  model?: string;
};

export type ChatResult = {
  content: string;
  model: string;
  credits: number;
  tokens: { prompt: number; completion: number; total: number };
};

export type ChatOptions = {
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  userId?: string;
  model?: string;
};

function calculateCredits(model: string, promptTokens: number, completionTokens: number): number {
  const pricing = MODEL_PRICING[model] || { prompt: 10, completion: 30 }; // Default to moderate pricing
  // Credits per 1K tokens, so divide by 1000, then apply margin multiplier
  const baseCost = (promptTokens * pricing.prompt + completionTokens * pricing.completion) / 1000;
  return Math.ceil(baseCost * config.creditMargin);
}

export async function runOpenRouterChat(prompt: string, options?: ChatOptions): Promise<ChatResult> {
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

  const model = options?.model || openRouter.model;

  try {
    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
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

    const promptTokens = data.usage?.prompt_tokens ?? 0;
    const completionTokens = data.usage?.completion_tokens ?? 0;
    const usedModel = data.model ?? model;
    const credits = calculateCredits(usedModel, promptTokens, completionTokens);

    return {
      content,
      model: usedModel,
      credits,
      tokens: {
        prompt: promptTokens,
        completion: completionTokens,
        total: promptTokens + completionTokens,
      },
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('OpenRouter request timed out.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
