# Initial AI Source Catalogue

This catalogue is the proposed monitored-source baseline for the Artificial Intelligence MVP. It complements search discovery; it is not a complete list of credible AI sources.

Status values are `proposed`, `approved`, `deferred`, and `blocked`. Every source begins as `proposed` until the Intelligence Lead checks access, update behavior, terms, extraction quality, and signal yield.

## Collection priorities

- `P0`: poll every 2-4 hours when an efficient feed/API exists; otherwise check twice daily.
- `P1`: poll daily.
- `P2`: poll two or three times weekly or use only in query-based discovery.

The engine uses conditional HTTP requests where supported and a 48-hour overlap window for scheduled discovery.

## Official model and platform sources

| Source | URL | Channel | Priority | Expected material | Status |
|---|---|---|---|---|---|
| OpenAI News | <https://openai.com/news/> | Official site | P0 | Models, APIs, research, products, company announcements | proposed |
| Anthropic Newsroom | <https://www.anthropic.com/news> | Official site | P0 | Models, safety, research, products, company announcements | proposed |
| Google DeepMind News | <https://deepmind.google/discover/blog/> | Official site | P0 | Models, research, science, safety | proposed |
| Google AI updates | <https://blog.google/innovation-and-ai/technology/ai/> | Official site | P1 | Gemini and applied AI product updates | proposed |
| AI at Meta | <https://ai.meta.com/blog/> | Official site | P0 | Open-weight models, research, infrastructure, applied AI | proposed |
| Microsoft AI News | <https://news.microsoft.com/source/topics/ai/> | Official site | P1 | Copilot, enterprise AI, infrastructure and partnerships | proposed |
| AWS Machine Learning Blog | <https://aws.amazon.com/blogs/machine-learning/> | Official site | P1 | Model hosting, tooling, reference implementations | proposed |
| NVIDIA AI Blog | <https://blogs.nvidia.com/blog/category/deep-learning/> | Official site | P1 | Chips, inference, models, developer platforms | proposed |
| Mistral AI News | <https://mistral.ai/news> | Official site | P0 | Models, products, research and partnerships | proposed |
| Cohere Blog | <https://cohere.com/blog> | Official site | P1 | Enterprise models, retrieval and product updates | proposed |
| Hugging Face Blog | <https://huggingface.co/blog> | Official/community platform | P1 | Open models, datasets, libraries and research | proposed |

Official sources establish what an organization says happened. They do not provide independent verification.

## Research and standards sources

| Source | URL or API | Channel | Priority | Scope | Status |
|---|---|---|---|---|---|
| arXiv Computer Science AI | <https://export.arxiv.org/api/query?search_query=cat:cs.AI> | Structured API | P0 | AI research preprints | proposed |
| arXiv Computation and Language | <https://export.arxiv.org/api/query?search_query=cat:cs.CL> | Structured API | P0 | Language-model research | proposed |
| arXiv Machine Learning | <https://export.arxiv.org/api/query?search_query=cat:cs.LG> | Structured API | P0 | Machine-learning research | proposed |
| Papers with Code | <https://paperswithcode.com/> | Structured/site discovery | P2 | Papers, code and benchmarks | proposed |
| NIST AI | <https://www.nist.gov/artificial-intelligence> | Official authority | P1 | Standards, risk management and evaluations | proposed |
| OECD AI | <https://oecd.ai/> | Official authority | P2 | Policy, incidents, indicators and national activity | proposed |
| European Commission AI policy | <https://digital-strategy.ec.europa.eu/en/policies/artificial-intelligence> | Official authority | P1 | EU AI policy and implementation | proposed |
| IndiaAI | <https://indiaai.gov.in/> | Official ecosystem source | P1 | India programs, policy, ecosystem and opportunities | proposed |

Preprints are evidence of research activity, not peer-reviewed validation. Preserve version and submission dates.

## Developer and open-source activity

| Source | Route | Priority | Scope | Status |
|---|---|---|---|---|
| GitHub releases | `GET /repos/{owner}/{repo}/releases` | P0 for allowlisted repositories | Versioned releases and release notes | proposed |
| GitHub repository metadata | GitHub REST API | P1 | Repository activity and ownership | proposed |
| Hugging Face model and dataset pages | Hugging Face Hub APIs/pages | P1 | Model and dataset publication/activity | proposed |
| PyPI project releases | PyPI JSON API for allowlisted projects | P1 | Python AI library releases | proposed |
| npm package releases | npm registry for allowlisted projects | P2 | JavaScript AI tooling releases | proposed |

The initial GitHub allowlist should start small and include only repositories tied to tracked organizations, models, or critical infrastructure. Stars and download counts are popularity signals, not quality proof.

## Ecosystem and community discovery

| Source | URL or API | Channel | Priority | Acceptance behavior | Status |
|---|---|---|---|---|---|
| Hacker News Search | <https://hn.algolia.com/> | Community/API | P0 | Discovery only until the linked source is extracted | proposed |
| Hacker News official API | <https://github.com/HackerNews/API> | Community/API | P1 | Discussion and velocity metadata | proposed |
| Y Combinator companies | <https://www.ycombinator.com/companies> | Ecosystem site | P1 | Company and launch discovery; verify against company sources | proposed |
| Product Hunt AI topics | <https://www.producthunt.com/topics/artificial-intelligence> | Ecosystem site | P2 | Early product discovery; never automatic evidence acceptance | proposed |
| Reddit | Source-specific public access route | Community | P2 | Deferred from automatic acceptance; policy review required | deferred |
| X | Approved API/terms route only | Social | P2 | Deferred from MVP automated collection | deferred |
| YouTube | Approved Data API plus transcript policy | Video/API | P2 | Manual or selected-channel pilot only | deferred |

Community posts can identify what to investigate. Claims must trace to the linked primary material or remain clearly labelled community evidence.

## Independent reporting and analysis

These should initially be discovered through search rather than aggressively crawled. Approve each publisher after terms and extraction testing.

| Publisher group | Examples | Priority | Role | Status |
|---|---|---|---|---|
| Technology reporting | TechCrunch, The Verge, Ars Technica, Wired | P1 discovery | Product/company events and external context | proposed |
| Enterprise and developer reporting | VentureBeat, InfoQ, The New Stack | P1 discovery | Enterprise adoption and infrastructure | proposed |
| Business and financial reporting | Reuters, Bloomberg, Financial Times | P1 discovery | Funding, markets, regulation and company verification | proposed |
| Specialist newsletters/analysis | Individually approved sources | P2 discovery | Interpretation and weak-signal discovery | proposed |

Paywalled content must remain blocked or excerpt-limited according to the retention policy. Search snippets do not substitute for accessible source evidence.

## Search query families

The daily discovery planner should generate bounded variants from:

- Model and API releases.
- AI agent products and deployments.
- Inference, chips, data centres, and AI infrastructure.
- Open-weight models, datasets, benchmarks, and licensing.
- AI startup launches, funding, acquisitions, partnerships, and shutdowns.
- India AI startups, funding, policy, research, and adoption.
- AI safety, security incidents, evaluations, and regulation.
- Enterprise adoption and measurable workflow changes.
- Research breakthroughs and credible negative results.
- Pricing, availability, deprecation, and material product-policy changes.

Queries must include explicit time windows where supported and retain the generated query in discovery provenance.

## Source approval checklist

Before changing a row to `approved`, verify:

```text
[ ] Publisher/source identity is clear
[ ] Access method and update cadence are stable enough
[ ] Robots, API, and publisher terms were reviewed
[ ] Storage class is assigned
[ ] Extraction route succeeds on representative items
[ ] Dates and canonical URLs are reliable
[ ] Expected signal types are named
[ ] Cost and rate-limit behavior are recorded
[ ] Failure behavior is defined
[ ] Source produced useful, non-duplicate evidence in the evaluation set
```

## Related

- [How to Complete Research Engine Phase 0](phase0_execution_plan.md)
- [Content Storage and Retention Policy](content_storage_and_retention_policy.md)
- [Universal Research Contract](universal_research_contract.md)
