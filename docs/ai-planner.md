# AI Response Planner Specification: Nebius Token Factory & NVIDIA Models

**Service Base URL:** `https://api.tokenfactory.nebius.com/v1/`  
**Protocol:** OpenAI-compatible REST API (`POST /v1/chat/completions`)  
**Security Policy:** Server-side execution only. `NEBIUS_API_KEY` and `NEBIUS_MODEL` are stored strictly in backend environment variables. Zero exposure in browser bundles or client code.  

---

## 1. Model Catalog Candidates Considered

We evaluated the eligible open-source models available on the Nebius Token Factory API suitable for reasoning, crisis response synthesis, and structured JSON output:

| Model Candidate | Provider | Architecture | Context Window | Suitability Evaluation | Selected Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`nvidia/nemotron-4-340b-instruct`** | NVIDIA | Nemotron-4 (340B MoE/Dense) | 4k | Exceptional instruction-following, rigorous safety alignment, highly grounded synthesis. | **Recommended Primary** |
| **`meta-llama/Meta-Llama-3.1-70B-Instruct`** | Meta / Nebius | Llama-3.1 | 128k | Strong general reasoning, robust JSON schema generation, high availability. | **Qualified Alternative** |
| **`meta-llama/Meta-Llama-3.1-8B-Instruct`** | Meta / Nebius | Llama-3.1 | 128k | Low latency, lightweight, cost-effective fallback. | **Fast Fallback** |

### Environment Configuration:
```env
NEBIUS_API_KEY=your_nebius_api_key_here
NEBIUS_MODEL=nvidia/nemotron-4-340b-instruct
```
If `NEBIUS_MODEL` is not specified in the environment, the backend defaults to `nvidia/nemotron-4-340b-instruct` with fallback to `meta-llama/Meta-Llama-3.1-70B-Instruct`. If `NEBIUS_API_KEY` is missing or invalid, the backend returns a clear error (`401/400`) with setup instructions.

---

## 2. Prompt Injection Defense & Strict Truthfulness Contract

1. **Untrusted Data Boundary:** All geographic feature names, descriptions, and user notes in the digest are wrapped in strict data boundaries and treated as untrusted strings, never as instructions.
2. **Fact ID System (`F1`, `F2`, ...):** The backend compiles the deterministic analysis result into a compact digest of facts. The model is mandated to cite the specific Fact IDs that justify each finding and recommendation.
3. **Backend Grounding Verifier:**
   - The backend parses the model's JSON response and verifies every cited Fact ID.
   - It performs an automatic cross-check: any number, percentage, or asset name in the model's text is verified against the facts in the digest.
   - If ungrounded numbers or assets are discovered, they are flagged with `grounding_warning = true` and surfaced transparently in the UI.
4. **Precautionary Notice:** The generated plan explicitly concludes with:
   > *"AI-generated synthesis from the supplied data. Verify before acting. In an emergency in India, dial 112 or contact the Andhra Pradesh State Disaster Management Authority (APSDMA)."*
