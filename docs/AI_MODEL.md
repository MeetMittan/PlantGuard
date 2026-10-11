# PlantGuard AI — AI Vision Model & Cloud Diagnostics

PlantGuard AI uses **Google Gemini Vision AI** hosted securely on the Express backend, replacing the legacy client-side SmolVLM model. This eliminates client-side memory exhaustion, mobile overheating, and heavy multi-hundred-megabyte model downloads while delivering enterprise-grade botanical diagnostics.

---

## 1. Architectural Motivation

### Why We Migrated from Client-Side SmolVLM to Gemini

| Feature | Legacy Client-Side SmolVLM | Server-Side Google Gemini Vision |
|---|---|---|
| **Download Size** | ~180MB – 350MB (ONNX weights) | **0 MB** (no client model download) |
| **Device Load** | High RAM (>1.5 GB), CPU/GPU throttling, battery drain | **Zero client inference overhead** |
| **Inference Latency** | 8 – 25 seconds on mobile devices | **1.2 – 2.0 seconds** over HTTPS |
| **Diagnostic Accuracy** | General-purpose VLM (frequent hallucination of plant diseases) | **State-of-the-art vision reasoning** with deep botanical taxonomy |
| **Offline Fallback** | Required full model in browser cache | Graceful offline queueing with Dexie IndexedDB sync |

---

## 2. Gemini Vision Integration

### 2.1 Model Selection & Configuration
- **Default Model:** `gemini-3.8-flash` (configured via `GEMINI_MODEL` environment variable in `server/.env`).
- **SDK:** Official `@google/genai` JavaScript/TypeScript SDK.
- **Backend Service:** Implemented in `server/src/services/gemini.ts`.

### 2.2 Security & Key Protection
- **No Client Exposure:** `GEMINI_API_KEY` is loaded exclusively by the Express backend.
- **Frontend Isolation:** Neither Vite nor client bundles have access to `GEMINI_API_KEY`. No `VITE_GEMINI_API_KEY` variables exist.
- **Pino Redaction:** All HTTP logs automatically redact authorization keys, tokens, and raw base64 image strings.

---

## 3. Prompt Engineering & Structured Output

### 3.1 System Prompt
The model is instructed to act as an expert botanist and plant pathologist:
```text
You are an expert plant pathologist and botanist AI assistant for PlantGuard AI.
Analyze the provided plant or leaf photograph. Identify the plant species and assess its health.
Provide structured, evidence-based botanical diagnostic observations.
If the image does not show a plant or leaf, indicate this clearly.
Always return your assessment strictly in valid JSON matching the requested schema.
```

### 3.2 Zod Validation Schema
Responses from Gemini are parsed and strictly validated using Zod (`server/src/modules/ai/ai.schemas.ts`):

```typescript
export const PlantAnalysisResultSchema = z.object({
  plantName: z.string().min(1),
  identifiedSpecies: z.string().optional(),
  condition: z.enum(['healthy', 'attention', 'critical']),
  confidenceScore: z.number().min(0).max(1),
  summary: z.string().min(5),
  symptoms: z.array(z.string()).default([]),
  possibleCauses: z.array(z.string()).default([]),
  recommendations: z.array(z.string()).min(1),
  urgency: z.enum(['low', 'medium', 'high', 'immediate']).default('low'),
});
```

---

## 4. Rate Limiting & Resource Safeguards

To prevent API abuse and control Google Cloud costs:
- **Rate Limiter:** `server/src/middleware/rate-limiter.ts` applies a specialized window for `/api/v1/ai/analyze` (30 requests/minute per IP).
- **Payload Limits:** Maximum image upload size is capped at 10MB.
- **Input Sanitization:** Images are checked for valid magic bytes (JPEG, PNG, WebP) before being dispatched to Gemini.

---

## 5. Error Handling & Offline Strategy

### 5.1 Error Scenarios
- **API Key Missing or Invalid:** Returns `503 Service Unavailable` with `AI_PROVIDER_ERROR` and status explanation.
- **Network or Quota Errors:** Catches Google Cloud API rate limits and returns `502 Bad Gateway` with retry guidance.
- **Non-Plant Image:** The model returns a friendly `confidenceScore: 0` result with guidance indicating no plant was detected.

### 5.2 Offline Resiliency
When the user's device is disconnected from the internet:
1. The client-side PWA detects offline state via `navigator.onLine`.
2. The user can capture photographs and save notes locally in Dexie IndexedDB.
3. Once internet connectivity is restored, the client outbox queues the observation for AI analysis and server synchronization.
4. For automated testing and offline demos, the client includes `DemoVisionProvider` (`client/src/services/ai/demoProvider.ts`).
