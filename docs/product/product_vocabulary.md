# Product Vocabulary

This glossary defines the terms used in the product, database, user interface, workflows, and team discussions. A contributor should not introduce a synonym for one of these concepts without updating this document and the affected contracts.

## Intelligence hierarchy

| Term | Definition | Minimum evidence rule | Example |
|---|---|---|---|
| Source | An external origin of information, such as a page, filing, feed item, paper, or transcript. | Has a canonical URL or stable external identifier. | A company funding announcement. |
| Evidence | A bounded, attributable statement or excerpt extracted from one source that can support or contradict a claim. | Must point to one source and preserve enough location context to verify it. | “Company X raised a seed round led by Fund Y.” |
| Signal | A meaningful event, change, or development derived from one or more evidence items. | At least one evidence item; confidence and novelty must be recorded. | A new seed investment in agent security. |
| Observation | An analyst interpretation that combines signals without claiming a recurring pattern yet. | Normally at least two signals or one unusually strong verified signal. | Seed activity is increasing in agent security. |
| Thesis | An explicit or inferred belief about where a market, company, or investor is moving. | Must be labelled `stated` or `revealed` and linked to evidence. | Fund Y publicly prioritizes infrastructure; its portfolio shows agent security concentration. |
| Pattern | A recurring relationship supported by multiple observations over entities, sources, or time. | At least two observations and evidence diversity; the engine records strength and counter-signals. | Several infrastructure investors are repeatedly backing agent security teams. |
| Hypothesis | A testable explanation or potential opportunity produced from one or more patterns. It is never presented as fact. | Must state the claim, target user or market, rationale, assumptions, and validation status. | Teams may need an independent control layer for autonomous agents. |
| Validation | A structured attempt to support and disprove a hypothesis. | Must search for competitors, demand, counter-evidence, failed attempts, and constraints. | Investigation of existing agent control products and user demand. |
| Insight | A conclusion reached after analysis and validation, with evidence lineage and explicit confidence. | Must trace to a completed validation or a clearly bounded analytical conclusion. | The need is real in regulated teams but the horizontal market is crowded. |

## Supporting terms

| Term | Definition |
|---|---|
| Domain | A configurable market or field being researched, such as Artificial Intelligence or Healthcare. |
| Workspace | The tenant boundary containing a person or team’s domains, research, saved items, and intelligence. |
| Workspace domain | A domain configured for a workspace with selected topics, geographies, entities, and research preferences. |
| Entity | A resolvable subject such as a company, person, fund, product, technology, market, geography, or regulator. |
| Relationship | A typed connection between two entities with time bounds and evidence. |
| Research run | One traceable execution of the Research Engine for a workspace domain. |
| Discovery source | The channel that surfaced a source, such as Google Search, RSS, GitHub, arXiv, or a VC website. |
| Canonical URL | The normalized identity URL used for deduplication after tracking parameters and aliases are resolved. |
| Evidence pack | A bounded set of sources and evidence prepared for one downstream intelligence task. |
| Stated thesis | What an investor or organization publicly says it believes. |
| Revealed thesis | What repeated behavior, such as investments, indicates it actually prioritizes. |
| Counter-evidence | Evidence that weakens, limits, or contradicts a signal, pattern, thesis, or hypothesis. |
| Confidence | The system’s calibrated belief that a structured claim is supported by available evidence. It is not source quality. |
| Source quality | An assessment of the source’s authority, proximity to the event, transparency, and reliability. |
| Relevance | How closely a source or evidence item matches the configured workspace domain and research objective. |
| Novelty | How different a signal is from information already known in the workspace. |
| Saved item | A user bookmark or annotation on an intelligence object; it does not duplicate the object. |

## Required product language

- The UI says “hypothesis” until validation supports an insight. It does not label unvalidated output an “opportunity.”
- “Contradictory evidence” and “counter-evidence” are visible first-class concepts, not hidden model notes.
- “Confidence” always has an explanation or component scores in detailed views.
- “New” means new to the workspace’s knowledge at a recorded time, not necessarily new to the world.
- “Trending” requires change over a defined comparison window. A high absolute count alone is not a trend.
- “Revealed thesis” is an inference and must be displayed as such.

## Disallowed conflations

- A source is not evidence; one source can contain many evidence items.
- Evidence is not a signal; extraction precedes interpretation.
- A group of similar headlines is not automatically a pattern.
- A pattern is not automatically an opportunity.
- Supporting evidence is not validation unless the system also searches for disconfirming evidence.
- An LLM response is not a source.
