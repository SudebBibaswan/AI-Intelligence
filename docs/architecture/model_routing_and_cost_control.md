# Model Routing and Cost Control

The platform routes work by capability, risk, and budget. Deterministic transformations remain deterministic; high-volume classification uses inexpensive models; expensive reasoning is reserved for analysis whose value justifies it. Every model call is schema-validated, traceable, and recorded in the usage ledger.

## Routing principles

1. Use no model when code, SQL, or rules can produce a reliable result.
2. Route by task capability, not by personal model preference.
3. Benchmark candidate models on representative project examples before making a default permanent.
4. Escalate only after a lower tier fails a defined quality or confidence gate.
5. Give every operation a maximum attempts, token, latency, and cost budget.
6. Do not send entire source collections when a bounded evidence pack is sufficient.
7. Preserve model, prompt, schema, and engine versions for reproducibility.

## Task tiers

| Tier | Intended work | Examples | Default behavior |
|---|---|---|---|
| 0 Deterministic | Exact transformations and database work | URL normalization, hashing, deduplication, routing, validation, calculations | JavaScript, SQL, or application code only |
| 1 High volume | Narrow classification and extraction | relevance, entity type, topic tags, simple structured fields | Cheapest model meeting quality threshold |
| 2 Analytical | Evidence-level synthesis | signal extraction, entity relationships, thesis extraction | Strong inexpensive model with constrained evidence pack |
| 3 Senior reasoning | High-value, ambiguity-heavy work | pattern synthesis, contradiction analysis, hypothesis evaluation, final validation | OpenAI or best benchmarked reasoning model within budget |

## Capability names

Workflows request stable capabilities rather than provider-specific model names:

- `classify_relevance`
- `extract_evidence`
- `resolve_entities`
- `generate_signal`
- `extract_stated_thesis`
- `infer_revealed_thesis`
- `detect_pattern`
- `generate_hypothesis`
- `challenge_hypothesis`
- `synthesize_validation`
- `generate_brief`

A routing configuration maps capability and environment to provider, model, tier, limits, and fallback.

## Required call envelope

```json
{
  "request_id": "uuid",
  "workspace_id": "uuid",
  "research_run_id": "uuid-or-null",
  "validation_run_id": "uuid-or-null",
  "capability": "generate_signal",
  "prompt_version": "signal-v1.2.0",
  "schema_version": "1.0.0",
  "budget": {
    "max_input_tokens": 12000,
    "max_output_tokens": 1500,
    "max_cost_usd": 0.15,
    "max_attempts": 2
  },
  "input": {}
}
```

The wrapper records usage even for failure, timeout, invalid JSON, or rejected output.

## Quality and escalation gates

- Structured output must validate against its JSON Schema.
- Evidence identifiers in output must be present in the supplied evidence pack.
- A classification below its confidence threshold goes to review or a stronger tier; it is not coerced to accepted.
- A retry uses a known repair prompt and counts against the same budget.
- A fallback model is allowed only if the remaining budget can cover it.
- Tier 3 output still requires lineage and deterministic validation.
- Model self-reported confidence is only one feature; it does not override evidence quality or diversity.

## Budget hierarchy

Apply the most restrictive active limit:

1. Per-call limit.
2. Per research or validation run limit.
3. Daily workspace limit.
4. Project-wide provider budget.

When a budget is reached, stop optional stages, mark the run partial, and surface the reason. Do not silently switch to an unapproved provider or exceed the ceiling.

## Usage ledger

Each call writes to `llm_usage` with workflow, agent, operation, provider, model, tier, input and output tokens, estimated cost, latency, success, error code, prompt version, schema version, workspace ID, and relevant run IDs.

Cost calculation uses a versioned price table with `effective_from`. If a provider reports exact cost, retain both provider-reported and estimated values for reconciliation.

## Prompt and evaluation versioning

- Store prompts in the repository, not only inside n8n nodes.
- Use semantic versions for prompt behavior and schema versions for response shape.
- A prompt change that can alter meaning or classification thresholds requires evaluation.
- Maintain a small gold dataset per capability with expected labels, lineage validity, and failure cases.
- Record quality, latency, and cost together; the cheapest model is not selected if it misses the quality floor.

## Initial evaluation metrics

| Capability | Minimum evaluation focus |
|---|---|
| Relevance classification | Precision on accepted sources; false-positive cost |
| Evidence extraction | Attribution accuracy, span faithfulness, field completeness |
| Entity resolution | Incorrect merge rate and unresolved rate |
| Signal generation | Evidence coverage, duplicate rate, unsupported-claim rate |
| Thesis extraction | Stated versus inferred separation |
| Pattern detection | Persistence, source diversity, and false pattern rate |
| Hypothesis generation | Testability, lineage, and unsupported leap rate |
| Validation synthesis | Counter-evidence coverage, conclusion calibration, unresolved questions |

## Initial cost reporting

The product and operations dashboard should show daily cost, cost by workflow and capability, cost by model, cost per accepted source, cost per useful signal, cost per validation, remaining configured budget, and projected 15-day spend.

Do not optimize only cost per call. Optimize cost per useful, evidence-backed outcome.
