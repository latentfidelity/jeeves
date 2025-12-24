import config from '../config';

const FAL_QUEUE_URL = 'https://queue.fal.run';
const DEFAULT_TIMEOUT_MS = 60000;
const POLL_INTERVAL_MS = 1000;

export type ImageModel = {
  id: string;
  name: string;
  defaultSize: { width: number; height: number };
  credits: number; // credits per image
};

// Base cost: 1 credit = $0.0001. Margin multiplier applied at runtime.
export const IMAGE_MODELS: ImageModel[] = [
  // FLUX.1 models
  { id: 'fal-ai/flux/schnell', name: 'FLUX.1 Schnell', defaultSize: { width: 1024, height: 1024 }, credits: 30 },
  { id: 'fal-ai/flux/dev', name: 'FLUX.1 Dev', defaultSize: { width: 1024, height: 1024 }, credits: 250 },
  { id: 'fal-ai/flux-pro/v1.1', name: 'FLUX Pro 1.1', defaultSize: { width: 1024, height: 1024 }, credits: 500 },
  // FLUX.2 models
  { id: 'fal-ai/flux-2', name: 'FLUX.2 Dev', defaultSize: { width: 1024, height: 1024 }, credits: 120 },
  { id: 'fal-ai/flux-2-pro', name: 'FLUX.2 Pro', defaultSize: { width: 1024, height: 1024 }, credits: 300 },
  { id: 'fal-ai/flux-2-flex', name: 'FLUX.2 Flex', defaultSize: { width: 1024, height: 1024 }, credits: 600 },
  // Google Nano Banana
  { id: 'fal-ai/nano-banana', name: 'Nano Banana', defaultSize: { width: 1024, height: 1024 }, credits: 400 },
  { id: 'fal-ai/nano-banana-pro', name: 'Nano Banana Pro', defaultSize: { width: 1024, height: 1024 }, credits: 1500 },
  // Fast models
  { id: 'fal-ai/z-image/turbo', name: 'Z-Image Turbo', defaultSize: { width: 1024, height: 1024 }, credits: 50 },
  // Other models
  { id: 'fal-ai/stable-diffusion-v3-medium', name: 'SD3 Medium', defaultSize: { width: 1024, height: 1024 }, credits: 350 },
  { id: 'fal-ai/recraft-v3', name: 'Recraft V3', defaultSize: { width: 1024, height: 1024 }, credits: 400 },
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
  width: number;
  height: number;
  content_type: string;
};

type FalResultResponse = {
  images: FalImageOutput[];
  seed: number;
  prompt: string;
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

  const response = await fetch(queueUrl, {
    method: 'POST',
    headers: {
      Authorization: `Key ${fal.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt,
      image_size: { width, height },
      num_images: 1,
    }),
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
    width: image.width,
    height: image.height,
    model: modelId,
    seed: result.seed,
    credits: Math.ceil(modelInfo.credits * config.creditMargin),
  };
}
