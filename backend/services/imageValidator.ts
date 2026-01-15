import * as ort from "onnxruntime-web/all";
import * as brain from "brain.js";

// Track initialization state
let session: ort.InferenceSession | null = null;
let labels: Record<string, string[]> | null = null;
let isInitializing = false;

// Blocked URL patterns for placeholder/avatar images
const BLOCKED_URL_PATTERNS = [
  "ui-avatars.com",
  "placeholder",
  "avatar",
  "picsum.photos",
  "via.placeholder",
  "placehold.it",
  "dummyimage.com",
];

export interface VisualDescriptors {
  subjects: string[];
  scenes: string[];
  moods: string[];
}

/**
 * Check if URL is a placeholder/avatar image that should be filtered out
 */
export function isPlaceholderImage(url: string): boolean {
  const lowerUrl = url.toLowerCase();
  return BLOCKED_URL_PATTERNS.some((pattern) => lowerUrl.includes(pattern));
}

/**
 * Initialize ONNX Runtime Session and Labels
 */
export async function initializeImageClassifier(): Promise<void> {
  if (session || isInitializing) return;

  isInitializing = true;
  try {
    console.log("Initializing ONNX Runtime with MobileNet v2...");

    // Load labels
    const labelsResponse = await fetch("/models/imagenet_classes.json");
    labels = await labelsResponse.json();

    // Create session with WebNN / WASM fallbacks
    // Note: WebNN is the preferred EP as requested
    session = await ort.InferenceSession.create("/models/mobilenetv2.onnx", {
      executionProviders: [
        {
          name: "webnn",
          deviceType: "gpu",
          powerPreference: "default",
        },
        "wasm",
      ],
      graphOptimizationLevel: "all",
    });

    console.log("✅ ONNX Runtime Session initialized");
  } catch (error) {
    console.error("Failed to initialize ONNX Runtime:", error);
    session = null;
  } finally {
    isInitializing = false;
  }
}

/**
 * Ensure classifier is fully loaded before usage.
 * Waits up to 5 seconds, retrying every 100ms.
 */
async function ensureClassifierReady(): Promise<void> {
  if (!session && !isInitializing) {
    await initializeImageClassifier();
  }
  let retries = 0;
  while (!session && retries < 50) {
    await new Promise((r) => setTimeout(r, 100)); // 100ms * 50 = 5s
    retries++;
  }
  if (!session) {
    throw new Error("Classifier failed to load");
  }
}

/**
 * Preprocess image for MobileNet v2 (224x224, Normalize)
 */
async function preprocess(img: HTMLImageElement): Promise<ort.Tensor> {
  const width = 224;
  const height = 224;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get canvas context");

  ctx.drawImage(img, 0, 0, width, height);
  const imageData = ctx.getImageData(0, 0, width, height).data;

  // MobileNet expectations: NCHW, Normalize with ImageNet mean/std
  const float32Data = new Float32Array(3 * width * height);
  const mean = [0.485, 0.456, 0.406];
  const std = [0.229, 0.224, 0.225];

  for (let i = 0; i < width * height; i++) {
    float32Data[i] = (imageData[i * 4] / 255 - mean[0]) / std[0]; // R
    float32Data[i + width * height] =
      (imageData[i * 4 + 1] / 255 - mean[1]) / std[1]; // G
    float32Data[i + 2 * width * height] =
      (imageData[i * 4 + 2] / 255 - mean[2]) / std[2]; // B
  }

  return new ort.Tensor("float32", float32Data, [1, 3, width, height]);
}

/**
 * Perform Softmax on logits
 */
function softmax(logits: Float32Array): Float32Array {
  const maxLogit = Math.max(...logits);
  const exps = logits.map((l) => Math.exp(l - maxLogit));
  const sumExps = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sumExps);
}

/**
 * Run Inference and Get Top Results
 */
async function classify(
  img: HTMLImageElement
): Promise<{ label: string; score: number }[]> {
  if (!session || !labels) throw new Error("Classifier not ready");

  const inputTensor = await preprocess(img);
  const outputMap = await session.run({ input: inputTensor });

  // The output name for MobileNet v2 is usually 'output' or 'output_0' or '473' (v2-7)
  // We'll dynamic find the result
  const outputKey = Object.keys(outputMap)[0];
  const output = outputMap[outputKey].data as Float32Array;

  const probabilities = softmax(output);

  // Get top 20 results
  const results = Array.from(probabilities)
    .map((score, index) => ({
      label: labels![index.toString()][1],
      score,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);

  return results;
}

/**
 * Validate image relevance using ON-DEVICE vision (ONNX Runtime)
 */
export async function validateImageRelevance(
  imageUrl: string,
  word: string,
  descriptors?: VisualDescriptors
): Promise<number> {
  // 1. Block placeholder images immediately
  if (isPlaceholderImage(imageUrl)) {
    console.log(
      `🚫 Blocked placeholder image: ${imageUrl.substring(0, 50)}...`
    );
    return 0;
  }

  try {
    await ensureClassifierReady();
    const img = await loadImage(imageUrl);
    const results = await classify(img);

    // Detailed scoring based on descriptors
    let score = 0;
    if (descriptors) {
      score = await calculateNeuralScore(results, descriptors, word);
    } else {
      score = calculateBasicScore(results, word);
    }

    console.log(
      `👁️ (NEURAL) On-device score for "${word}": ${(score * 100).toFixed(1)}%`
    );

    // REQUIREMENT: Threshold 85%
    return score >= 0.85 ? score : 0;
  } catch (error) {
    console.warn(`On-device validation failed for "${word}":`, error);
    return 0;
  }
}

/**
 * Neural Matcher using Brain.js
 * Evaluates the non-linear relationship between subjects, scenes, and moods.
 */
async function calculateNeuralScore(
  results: { label: string; score: number }[],
  descriptors: VisualDescriptors,
  targetWord: string
): Promise<number> {
  // 1. Extract feature scores
  const labels = results.map((r) => ({
    name: r.label.toLowerCase().replace(/_/g, " "),
    confidence: r.score,
  }));

  let subjectMatch = 0;
  let sceneMatch = 0;
  let moodMatch = 0;
  let exactWordMatch = 0;

  descriptors.subjects.forEach((sub) => {
    const subLow = sub.toLowerCase();
    labels.forEach((l) => {
      if (l.name.includes(subLow) || subLow.includes(l.name)) {
        subjectMatch = Math.max(subjectMatch, l.confidence);
      }
    });
  });

  descriptors.scenes.forEach((scene) => {
    const sceneLow = scene.toLowerCase();
    labels.forEach((l) => {
      if (l.name.includes(sceneLow)) {
        sceneMatch = Math.max(sceneMatch, l.confidence);
      }
    });
  });

  const moodMap: Record<string, string[]> = {
    happy: ["sunny", "bright", "yellow", "smile", "joy"],
    calm: ["blue", "ocean", "forest", "zen", "mist", "calm"],
    urban: ["city", "skyscraper", "traffic", "street", "building"],
    nature: ["green", "tree", "flower", "mountain", "wood", "outdoor"],
    danger: ["fire", "red", "explosion", "warning", "intense"],
  };

  descriptors.moods.forEach((mood) => {
    const moodLow = mood.toLowerCase();
    labels.forEach((l) => {
      if (l.name.includes(moodLow))
        moodMatch = Math.max(moodMatch, l.confidence);
      if (moodMap[moodLow]?.some((kw) => l.name.includes(kw))) {
        moodMatch = Math.max(moodMatch, l.confidence * 0.8);
      }
    });
  });

  const normalizedWord = targetWord.toLowerCase();
  labels.forEach((l) => {
    if (l.name.includes(normalizedWord)) {
      exactWordMatch = Math.max(exactWordMatch, l.confidence);
    }
  });

  // 2. Neural Network Evaluation
  // Architecture: 4 Inputs -> 3 Hidden -> 1 Output
  const net = new brain.NeuralNetwork({
    hiddenLayers: [3],
    activation: "sigmoid",
  });

  // Synthetic training for the "well-logic" of this specific word
  net.train(
    [
      { input: [1, 1, 1, 1], output: [1] }, // Perfect
      { input: [1, 0, 0, 1], output: [0.9] }, // Subject + Exact Word = Very High
      { input: [1, 0.5, 0.5, 0], output: [0.75] }, // Subject + Context = High
      { input: [0, 1, 1, 0], output: [0.3] }, // Only Scene/Mood = Low (No subject)
      { input: [0.2, 0.2, 0.2, 1], output: [0.5] }, // Mostly Word, but image is weak
      { input: [0, 0, 0, 0], output: [0] }, // Nothing
    ],
    {
      iterations: 100,
      errorThresh: 0.01,
      log: false,
    }
  );

  const input = [subjectMatch, sceneMatch, moodMatch, exactWordMatch];
  const output = net.run(input) as Float32Array;

  return output[0];
}

/**
 * Basic score if no descriptors
 */
function calculateBasicScore(
  results: { label: string; score: number }[],
  targetWord: string
): number {
  const normalizedWord = targetWord.toLowerCase().trim();
  let maxScore = 0;
  for (const r of results) {
    const label = r.label.toLowerCase().replace(/_/g, " ");
    if (label.includes(normalizedWord) || normalizedWord.includes(label)) {
      maxScore = Math.max(maxScore, r.score);
    }
  }
  return maxScore;
}

/**
 * Load image from URL into HTMLImageElement
 */
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}
