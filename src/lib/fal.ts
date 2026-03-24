import config from '../config';

const FAL_QUEUE_URL = 'https://queue.fal.run';
const DEFAULT_TIMEOUT_MS = 60000;
const POLL_INTERVAL_MS = 1000;

export type ImageModel = {
  id: string;
  name: string;
  defaultSize: { width: number; height: number };
  credits: number; // credits per image (1 credit = $0.0001)
  inputFormat: 'image_size' | 'aspect_ratio'; // which param the API expects
};

// Base cost: 1 credit = $0.0001. Margin multiplier applied at runtime.
// Credits calculated from pricing at 1024x1024 (~1MP) per image.
export const IMAGE_MODELS: ImageModel[] = [
  // ── FLUX.1 ──────────────────────────────────────────────────────────
  { id: 'fal-ai/flux/schnell', name: 'FLUX.1 Schnell', defaultSize: { width: 1024, height: 1024 }, credits: 30, inputFormat: 'image_size' },
  // $0.003/MP
  { id: 'fal-ai/flux/dev', name: 'FLUX.1 Dev', defaultSize: { width: 1024, height: 1024 }, credits: 250, inputFormat: 'image_size' },
  // $0.025/MP
  { id: 'fal-ai/flux-pro/v1.1', name: 'FLUX Pro 1.1', defaultSize: { width: 1024, height: 1024 }, credits: 400, inputFormat: 'image_size' },
  // $0.04/MP

  // ── FLUX.2 ──────────────────────────────────────────────────────────
  { id: 'fal-ai/flux-2', name: 'FLUX.2 Dev', defaultSize: { width: 1024, height: 1024 }, credits: 120, inputFormat: 'image_size' },
  // $0.012/MP
  { id: 'fal-ai/flux-2-pro', name: 'FLUX.2 Pro', defaultSize: { width: 1024, height: 1024 }, credits: 300, inputFormat: 'image_size' },
  // $0.03 first MP
  { id: 'fal-ai/flux-2-flex', name: 'FLUX.2 Flex', defaultSize: { width: 1024, height: 1024 }, credits: 500, inputFormat: 'image_size' },
  // $0.05/MP
  { id: 'fal-ai/flux-2-max', name: 'FLUX.2 Max', defaultSize: { width: 1024, height: 1024 }, credits: 700, inputFormat: 'image_size' },
  // $0.07 first MP

  // ── FLUX Kontext ────────────────────────────────────────────────────
  { id: 'fal-ai/flux-pro/kontext', name: 'FLUX Kontext Pro', defaultSize: { width: 1024, height: 1024 }, credits: 400, inputFormat: 'image_size' },
  // $0.04/image

  // ── Google Nano Banana ──────────────────────────────────────────────
  { id: 'fal-ai/nano-banana', name: 'Nano Banana', defaultSize: { width: 1024, height: 1024 }, credits: 390, inputFormat: 'aspect_ratio' },
  // $0.039/image
  { id: 'fal-ai/nano-banana-pro', name: 'Nano Banana Pro', defaultSize: { width: 1024, height: 1024 }, credits: 1500, inputFormat: 'aspect_ratio' },
  // $0.15/image
  { id: 'fal-ai/nano-banana-2', name: 'Nano Banana 2', defaultSize: { width: 1024, height: 1024 }, credits: 800, inputFormat: 'aspect_ratio' },
  // $0.08/image

  // ── GPT Image ───────────────────────────────────────────────────────
  { id: 'fal-ai/gpt-image-1.5', name: 'GPT Image 1.5', defaultSize: { width: 1024, height: 1024 }, credits: 340, inputFormat: 'image_size' },
  // ~$0.034 medium quality 1024x1024

  // ── Recraft ─────────────────────────────────────────────────────────
  { id: 'fal-ai/recraft/v3/text-to-image', name: 'Recraft V3', defaultSize: { width: 1024, height: 1024 }, credits: 400, inputFormat: 'image_size' },
  // $0.04/image
  { id: 'fal-ai/recraft/v4/pro/text-to-image', name: 'Recraft V4 Pro', defaultSize: { width: 1024, height: 1024 }, credits: 2500, inputFormat: 'image_size' },
  // $0.25/image

  // ── ByteDance Seedream ──────────────────────────────────────────────
  { id: 'fal-ai/bytedance/seedream/v4/text-to-image', name: 'Seedream V4', defaultSize: { width: 1024, height: 1024 }, credits: 300, inputFormat: 'image_size' },
  // $0.03/image
  { id: 'fal-ai/bytedance/seedream/v5/lite/text-to-image', name: 'Seedream 5 Lite', defaultSize: { width: 1024, height: 1024 }, credits: 350, inputFormat: 'image_size' },
  // $0.035/image

  // ── Other ───────────────────────────────────────────────────────────
  { id: 'fal-ai/qwen-image', name: 'Qwen Image', defaultSize: { width: 1024, height: 1024 }, credits: 200, inputFormat: 'image_size' },
  // $0.02/MP
  { id: 'imagineart/imagineart-1.5-preview/text-to-image', name: 'ImagineArt 1.5', defaultSize: { width: 1024, height: 1024 }, credits: 300, inputFormat: 'image_size' },
  // $0.03/image
  { id: 'fal-ai/stable-diffusion-v3-medium', name: 'SD3 Medium', defaultSize: { width: 1024, height: 1024 }, credits: 350, inputFormat: 'image_size' },
  // $0.035/image
  { id: 'fal-ai/z-image/turbo', name: 'Z-Image Turbo', defaultSize: { width: 1024, height: 1024 }, credits: 50, inputFormat: 'image_size' },
  // $0.005/MP
  { id: 'bria/fibo/generate', name: 'Bria FIBO', defaultSize: { width: 1024, height: 1024 }, credits: 400, inputFormat: 'image_size' },
  // $0.04/image
];

type FalQueueResponse = {
  request_id: string;
  status: string;
  response_url: string;
  status_url: string;
};

type FalStatusResponse = {
  status: 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  error?: string;
};

type FalImageOutput = {
  url: string;
  width?: number;
  height?: number;
  content_type?: string;
  file_name?: string;
};

type FalResultResponse = {
  images: FalImageOutput[];
  seed?: number;
  prompt?: string;
  description?: string;
};

export type ImageResult = {
  url: string;
  width: number;
  height: number;
  model: string;
  seed: number;
  credits: number;
};

export type ImageOptions = {
  model?: string;
  width?: number;
  height?: number;
  timeoutMs?: number;
};

async function pollForResult(
  statusUrl: string,
  responseUrl: string,
  apiKey: string,
  timeoutMs: number,
): Promise<FalResultResponse> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const statusRes = await fetch(statusUrl, {
      headers: { Authorization: `Key ${apiKey}` },
    });

    if (!statusRes.ok) {
      throw new Error(`FAL status check failed: ${statusRes.status}`);
    }

    const status = (await statusRes.json()) as FalStatusResponse;

    if (status.status === 'COMPLETED') {
      const resultRes = await fetch(responseUrl, {
        headers: { Authorization: `Key ${apiKey}` },
      });

      if (!resultRes.ok) {
        throw new Error(`FAL result fetch failed: ${resultRes.status}`);
      }

      return (await resultRes.json()) as FalResultResponse;
    }

    if (status.status === 'FAILED') {
      throw new Error(status.error || 'FAL request failed');
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error('FAL request timed out');
}

/**
 * Build the request body for the model, handling different input formats.
 */
function buildRequestBody(
  prompt: string,
  modelInfo: ImageModel,
  width: number,
  height: number,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    prompt,
    num_images: 1,
  };

  if (modelInfo.inputFormat === 'aspect_ratio') {
    // Nano Banana 2, Nano Banana, Nano Banana Pro use aspect_ratio
    body.aspect_ratio = '1:1';
  } else {
    // FLUX and most other models use image_size
    body.image_size = { width, height };
  }

  return body;
}

export async function generateImage(prompt: string, options?: ImageOptions): Promise<ImageResult> {
  const { fal } = config;
  if (!fal.apiKey) {
    throw new Error('FAL API key is not configured. Set FAL_API_KEY to enable image generation.');
  }

  const modelId = options?.model || IMAGE_MODELS[0].id;
  const modelInfo = IMAGE_MODELS.find((m) => m.id === modelId) || IMAGE_MODELS[0];

  const width = options?.width || modelInfo.defaultSize.width;
  const height = options?.height || modelInfo.defaultSize.height;
  const timeoutMs = options?.timeoutMs || DEFAULT_TIMEOUT_MS;

  const queueUrl = `${FAL_QUEUE_URL}/${modelId}`;
  const body = buildRequestBody(prompt, modelInfo, width, height);

  const response = await fetch(queueUrl, {
    method: 'POST',
    headers: {
      Authorization: `Key ${fal.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`FAL request failed: ${response.status} - ${text}`);
  }

  const queueData = (await response.json()) as FalQueueResponse;

  const result = await pollForResult(queueData.status_url, queueData.response_url, fal.apiKey, timeoutMs);

  if (!result.images || result.images.length === 0) {
    throw new Error('FAL returned no images');
  }

  const image = result.images[0];

  return {
    url: image.url,
    width: image.width || width,
    height: image.height || height,
    model: modelId,
    seed: result.seed ?? 0,
    credits: Math.ceil(modelInfo.credits * config.creditMargin),
  };
}
