# Intelligence Platform — Master Product & Build Plan

## 0. Executive Summary

We are building a **B2C-first, domain-agnostic Intelligence Platform** whose first real-world use case is AI ecosystem intelligence and whose initial distribution wedge is Masters' Union students.

The product is **not** intended to be another AI chatbot, news aggregator, Crunchbase/PitchBook clone, or startup-idea generator.

Its core loop is:

> **Discover → Understand → Connect → Detect Patterns → Form Hypotheses → Validate/Attack → Produce Insights**

The platform continuously researches a user-selected domain, builds a structured evidence base, analyzes ecosystem and investment activity, detects patterns, identifies potential opportunities, and aggressively validates those opportunities.

The first domain will be **Artificial Intelligence**, because it directly supports the PGP AIAS 2027 assignment. The underlying architecture must remain domain-agnostic so the same engine can later support Healthcare, FinTech, Biotech, Agriculture, IT Infrastructure, Investments, and other domains.

---

# 1. Product Vision

## Working vision

Build a personal intelligence system that helps an individual understand an industry deeply enough to identify emerging opportunities and determine whether those opportunities are actually real.

The system should become more valuable over time because its knowledge compounds.

A user should eventually be able to ask:

- What changed in my domain recently?
- Which startups are emerging?
- Which companies are gaining momentum?
- Where is capital moving?
- What are investors saying versus actually funding?
- Which patterns are recurring?
- What appears to be missing?
- Has this hypothesis appeared before?
- What evidence supports it?
- What evidence contradicts it?
- Which competitors already exist?
- What failed attempts have occurred?
- Is this opportunity worth investigating further?

---

# 2. Product Structure

The product has two primary user-facing intelligence pillars.

## Pillar 1 — Ecosystem Radar

Answers:

> **What is happening in this domain?**

Depending on the selected domain, this includes:

- New startups
- Startup launches
- New products
- Funding announcements
- Founder movements
- Acquisitions
- Partnerships
- Technology developments
- Research
- Market movements
- Important failures/shutdowns
- Regulatory developments
- Hiring/expansion signals
- Emerging companies
- Other meaningful ecosystem events

The product should not merely dump news.

It should identify:

- What changed
- Why it matters
- Whether it is genuinely new
- Whether it is accelerating
- Whether it represents continuation/reversal
- Which ecosystem entities are affected
- How confident the system is

## Pillar 2 — Investment Intelligence

Answers:

> **Where is capital and investor conviction moving?**

Tracks:

- VCs
- YCs
- Funds
- Investors
- Investment rounds
- Portfolio companies
- Public investment theses
- Founder/investor movements
- Category concentration
- Emerging investment categories
- Investment behavior

A major objective is to distinguish:

### Stated thesis
What an investor publicly says it believes.

### Revealed thesis
What the investor's actual investment behavior indicates.

The system should compare the two rather than assuming they are identical.

---

# 3. The Core Intelligence Loop

The product's deeper value begins when Ecosystem Radar and Investment Intelligence converge.

```text
ECOSYSTEM RADAR
       +
INVESTMENT INTELLIGENCE
       ↓
PATTERN ENGINE
       ↓
OPPORTUNITY / IDEATION ENGINE
       ↓
VALIDATION ENGINE
       ↓
EVIDENCE-BACKED INSIGHT
```

The hierarchy should be:

```text
SOURCE
  ↓
EVIDENCE
  ↓
SIGNAL
  ↓
OBSERVATION
  ↓
THESIS
  ↓
PATTERN
  ↓
HYPOTHESIS
  ↓
VALIDATION
  ↓
INSIGHT
```

These levels must remain distinct.

The system must never jump directly from:

> "People are talking about X"

to:

> "There is a startup opportunity in X."

---

# 4. The Research Engine

The Research Engine is the foundation of the entire platform.

## Critical architectural principle

**There should be ONE shared Research Engine.**

Individual intelligence modules should NOT independently browse the web whenever they want.

Instead:

```text
                 RESEARCH ENGINE
                       ↓
               Structured Evidence
                       ↓
                SUPABASE KNOWLEDGE
                       ↓
        ┌──────────────┼──────────────┐
        ↓              ↓              ↓
     AI Lens         YC Lens        VC Lens
        └──────────────┼──────────────┘
                       ↓
                Pattern Engine
                       ↓
                Ideation Engine
                       ↓
               Validation Engine
```

This gives us:

- One source of truth
- Less duplicate searching
- Lower LLM/API costs
- Better reproducibility
- Historical memory
- Easier debugging
- Better citations
- Better cross-source analysis
- Better longitudinal pattern detection

## Research channels

The engine should eventually support configurable discovery sources such as:

- Google Search
- RSS/news feeds
- Official company websites
- YC
- VC websites
- GitHub
- arXiv / research sources
- Reddit
- X/social signals where appropriate
- Hacker News
- YouTube/transcripts
- Relevant industry-specific sources
- APIs where reliable

Not every domain needs every source.

---

# 5. Domain Architecture

The platform must be domain-agnostic.

A domain is a configuration, not a separate application.

Example:

```json
{
  "domain": "Artificial Intelligence",
  "entities": [
    "startups",
    "VCs",
    "founders",
    "products",
    "technologies"
  ],
  "topics": [
    "AI agents",
    "LLMs",
    "AI infrastructure"
  ],
  "geographies": [
    "Global",
    "India"
  ]
}
```

A Healthcare configuration might contain:

```json
{
  "domain": "Healthcare",
  "entities": [
    "startups",
    "hospitals",
    "drugs",
    "devices",
    "investors"
  ],
  "topics": [
    "digital health",
    "diagnostics",
    "biotech"
  ]
}
```

The underlying Research Engine remains the same.

---

# 6. Universal Research JSON Contract

Every discovery source should eventually be normalized into a common structure before downstream intelligence processing.

Initial conceptual structure:

```json
{
  "source_id": "",
  "source_type": "",
  "discovery_source": "",
  "title": "",
  "url": "",
  "canonical_url": "",
  "author": "",
  "content": "",
  "published_at": "",
  "discovered_at": "",
  "domain": "",
  "relevance_score": 0,
  "source_quality": "",
  "extraction_method": "",
  "content_hash": "",
  "evidence_status": "",
  "collection_run_id": "",
  "metadata": {}
}
```

This is a starting contract. It should be finalized before rebuilding the n8n workflows.

---

# 7. Research Pipeline

The target ingestion pipeline is:

```text
Discovery
   ↓
Search Results
   ↓
Normalize JSON
   ↓
Canonicalize URLs
   ↓
Deduplicate
   ↓
Relevance Filter
   ↓
Content Extraction
   ↓
Source/Evidence Verification
   ↓
Store in Supabase
   ↓
AI Analysis
```

The AI agents should operate on evidence packs rather than raw search-result lists whenever possible.

---

# 8. Intelligence Architecture

The system should contain several analytical engines, but they should all consume the shared knowledge base.

## 8.1 Ecosystem Intelligence

Analyzes:

- News
- Startups
- Products
- Technology
- Research
- Market developments
- Company movements

## 8.2 Investment Intelligence

Analyzes:

- VC activity
- YC activity
- Investment rounds
- Investor portfolios
- Public theses
- Investment behavior
- Capital concentration

## 8.3 Pattern Engine

Looks for repeated relationships across:

- Companies
- Investors
- Technologies
- Markets
- Founder behavior
- Funding
- Product categories
- Geography
- Time

The objective is not simply trend detection.

It should identify relationships that persist across multiple pieces of evidence.

## 8.4 Ideation / Opportunity Engine

Consumes strong patterns and asks:

> What potential unmet need or opportunity could this pattern indicate?

It must generate **hypotheses**, not declare facts.

## 8.5 Validation Engine

This is a critical differentiator.

Its job is to actively try to disprove hypotheses.

Validation should investigate:

- Existing competitors
- Existing solutions
- Customer evidence
- Market demand
- Funding
- Adoption
- Technical feasibility
- Regulatory barriers
- Incumbents
- Failed startups
- Counter-signals
- Evidence against the hypothesis

The system should preserve both supporting and contradictory evidence.

---

# 9. Potential Moats

We should not compete on "we have lots of data."

Potential long-term moats:

## 9.1 Longitudinal Intelligence Graph

The system remembers what was happening over weeks/months and can identify what changed.

## 9.2 Thesis ↔ Behavior Graph

Connects:

Investor
→ public thesis
→ investments
→ portfolio companies
→ categories
→ repeated behavior

This enables stated-vs-revealed thesis analysis.

## 9.3 Evidence-Backed Opportunity Graph

Every opportunity can trace backwards:

```text
Opportunity
 ↓
Hypothesis
 ↓
Pattern
 ↓
Signals
 ↓
Evidence
 ↓
Sources
```

And separately:

```text
Hypothesis
 ↓
Counter-evidence
 ↓
Competitors
 ↓
Failed attempts
 ↓
Validation result
```

## 9.4 Personal Intelligence Memory

Over time, each user accumulates:

- Domains
- Watched companies
- Watched investors
- Patterns
- Hypotheses
- Rejected ideas
- Research history
- Questions
- Decisions

The user's intelligence compounds.

---

# 10. Initial Customer / Go-To-Market

The initial product is B2C.

Primary initial users:

- Students
- Aspiring founders
- Young builders
- Early-career researchers
- Product/strategy-oriented individuals

The first distribution wedge is the Masters' Union community.

The PGP AIAS assignment creates an immediate real-world use case.

Important:

**The product should NOT become an "assignment tool."**

The assignment is the initial distribution and forcing function.

The product itself should solve:

> "I want to understand a domain deeply enough to identify where opportunities are emerging."

Potential progression:

```text
Student
   ↓
Aspiring Founder / Builder
   ↓
Founder / PM
   ↓
Professional / Investor / Strategy
```

Long-term B2B/team expansion can be considered after validating the B2C product.

---

# 11. Competitive Positioning

The product should NOT become:

- Another Crunchbase
- Another PitchBook
- Another AlphaSense
- Another CB Insights
- Another Tracxn
- Another Dealroom
- Another generic AI news aggregator
- Another Perplexity clone
- Another startup idea generator

The competitive distinction should be:

> **Persistent individual intelligence that turns ecosystem evidence into patterns, opportunities, and adversarially validated hypotheses.**

The product is not merely:

> "Tell me what is happening."

It aims to answer:

> "What is happening, where is capital moving, what patterns are emerging, what might those patterns mean, and is the resulting opportunity actually real?"

---

# 12. User Journey

Initial user flow:

```text
Create Account
      ↓
Create Personal Workspace
      ↓
Choose Domain
      ↓
Configure Interests
      ↓
Research Engine Begins Collection
      ↓
Ecosystem Radar
      +
Investment Intelligence
      ↓
Personal Dashboard
      ↓
Patterns
      ↓
Opportunities
      ↓
Validation
      ↓
Saved Intelligence / Hypotheses
```

The system should eventually support multiple domains per user.

---

# 13. Product Portal

The user-facing application should include:

## Authentication

- Sign up
- Login
- Password/account recovery
- User profile

## Onboarding

- Select domain
- Select geography
- Select topics
- Select entities to follow
- Configure research preferences

## Dashboard

Potential sections:

- What changed?
- Important signals
- Ecosystem activity
- Investment activity
- Emerging patterns
- Active hypotheses
- Validation results
- Saved intelligence

## Ecosystem Radar

- News/events
- Companies
- Products
- Research
- Trends

## Investment Intelligence

- Investors
- Funds
- Investments
- Theses
- Portfolio/category views

## Patterns

- Emerging patterns
- Persistent patterns
- Contradictory signals
- Pattern timeline

## Opportunities

- Hypotheses
- Supporting evidence
- Counter-evidence
- Competitors
- Validation status

## Personal Knowledge

- Saved sources
- Saved companies
- Saved investors
- Saved hypotheses
- Research history

---

# 14. Backend / Supabase

Supabase becomes the multi-tenant knowledge layer.

Conceptual hierarchy:

```text
User
 ↓
Workspace
 ↓
Domain
 ↓
Research Runs
 ↓
Sources
 ↓
Evidence
 ↓
Entities
 ↓
Signals
 ↓
Patterns
 ↓
Hypotheses
 ↓
Validation
 ↓
Insights
```

RLS must ensure users can only access their own workspace-scoped data.

Potential core tables:

- users / auth.users
- workspaces
- workspace_members
- domains
- workspace_domains
- sources
- research_runs
- evidence
- organizations
- people
- investments
- signals
- thesis_observations
- patterns
- hypotheses
- validation_evidence
- insights
- daily_briefs
- llm_usage

Existing Supabase work already contains tables such as:

- sources
- ai_signals
- organizations
- people
- investments
- thesis_observations
- patterns
- hypotheses
- validation_evidence
- daily_briefs
- research_runs

These should be reviewed and upgraded for the multi-user product rather than blindly discarded.

---

# 15. Cost Architecture

The system must be cost-controlled from the beginning.

Do NOT send every operation to an expensive model.

## Tier 0 — Deterministic

Use n8n/JavaScript/SQL for:

- Filtering
- Routing
- URL normalization
- Deduplication
- Hashing
- Database operations
- Basic transformations

Cost: effectively $0.

## Tier 1 — Free/Open Models

Use for high-volume tasks:

- Classification
- Relevance scoring
- Basic extraction
- Categorization
- Metadata processing
- Routine structured analysis

Potential candidates to benchmark:

- NVIDIA Nemotron
- Qwen
- Mistral
- DeepSeek
- Other current open-weight models

Do not permanently lock to one model until actual project tasks are benchmarked.

## Tier 2 — Strong inexpensive/open model

Use for:

- Signal analysis
- Evidence synthesis
- Thesis extraction
- Entity relationships
- Structured reasoning

## Tier 3 — OpenAI API

The user's existing $50 OpenAI API balance should be reserved for high-value reasoning:

- Complex pattern synthesis
- Thesis analysis
- Contradiction detection
- Opportunity evaluation
- Adversarial validation
- Final synthesis
- High-value report generation

OpenAI should be the senior analyst, not the high-volume scraper.

## Cost tracking

Create an `llm_usage` table with fields such as:

```text
workflow
agent
model
provider
input_tokens
output_tokens
estimated_cost
timestamp
workspace_id
```

The dashboard should eventually expose:

- Daily cost
- Total cost
- Cost by workflow
- Cost by model
- Estimated remaining budget
- Projected 15-day cost

Target: keep the initial 15-day project comfortably below the available $50 balance.

---

# 16. Team Structure — 5 People

## Person 1 — Intelligence / AI Lead

Owns:

- Research Engine
- Discovery
- Source ingestion
- Model routing
- AI intelligence
- Ideation Engine
- Validation Engine

## Person 2 — Backend / Data Lead

Owns:

- Supabase
- Database schema
- RLS
- Multi-tenancy
- Vector search
- APIs
- n8n ↔ Supabase
- Usage/cost tracking
- Reliability

These two own the product's brain.

## Person 3 — Frontend / Product Experience Lead

Owns:

- Authentication
- Onboarding
- Domain selection
- Dashboard
- Research UI
- Patterns UI
- Opportunity UI
- Validation UI
- Frontend ↔ backend

## Person 4 — Product Strategy Lead

Owns:

- Personas
- JTBD
- Competitor research
- Positioning
- Naming
- USP
- Moat
- PRD
- Roadmap
- Pitch deck
- Assignment narrative

## Person 5 — Growth / GTM Lead

Owns:

- Masters' Union launch
- Student acquisition
- User interviews
- Onboarding funnel
- Pricing
- Feedback
- Retention
- Referral loops
- Community distribution

Everyone should dogfood the product.

---

# 17. Development Roadmap

## Phase 0 — Product Foundation

Before building:

1. Lock product vision
2. Define ICP
3. Define Jobs-to-be-Done
4. Competitor teardown
5. Define positioning
6. Define product vocabulary
7. Define universal JSON contract
8. Define data model
9. Define model-routing strategy
10. Define cost limits

## Phase 1 — Research Engine

Build:

1. Source discovery
2. Google/search integration
3. Source normalization
4. Canonical URL handling
5. Deduplication
6. Content extraction
7. Evidence verification
8. Supabase storage
9. Research run tracking
10. Cost tracking

## Phase 2 — Intelligence

Build:

1. Ecosystem Intelligence
2. Investment Intelligence
3. Entity resolution
4. Signal generation
5. Thesis analysis
6. Pattern detection

## Phase 3 — Ideation

Build:

1. Pattern → hypothesis generation
2. Opportunity evidence
3. Opportunity lineage
4. Saved hypotheses
5. Hypothesis timeline

## Phase 4 — Validation

Build:

1. Competitor validation
2. Market validation
3. Demand evidence
4. Counter-evidence
5. Technical feasibility
6. Regulatory checks
7. Failed-attempt analysis
8. Validation conclusion

## Phase 5 — User Product

Build:

1. Auth
2. Workspace
3. Domain onboarding
4. Dashboard
5. Ecosystem Radar
6. Investment Intelligence
7. Patterns
8. Opportunities
9. Validation
10. Personal knowledge

## Phase 6 — Dogfooding

Team uses it daily.

Measure:

- Useful signals
- False positives
- Duplicate research
- Bad sources
- Hallucinations
- Cost
- Latency
- User engagement
- Opportunity quality

## Phase 7 — Masters' Union Beta

Launch to student cohort.

Measure:

- Activation
- Research sessions
- Saved insights
- Saved hypotheses
- Validation usage
- Retention
- Feedback
- Referral

## Phase 8 — Product Iteration

Use real usage data to refine:

- Product
- Research quality
- Model routing
- UX
- Pricing
- Distribution
- Moat

---

# 18. Initial Repository Structure

Suggested monorepo:

```text
intelligence-platform/
│
├── apps/
│   └── web/
│
├── backend/
│   ├── api/
│   └── services/
│
├── workflows/
│   ├── research-engine/
│   ├── ecosystem-intelligence/
│   ├── investment-intelligence/
│   ├── pattern-engine/
│   ├── ideation-engine/
│   └── validation-engine/
│
├── supabase/
│   ├── migrations/
│   ├── seed/
│   └── functions/
│
├── docs/
│   ├── product/
│   ├── architecture/
│   ├── research/
│   ├── decisions/
│   └── pitch/
│
├── schemas/
│   ├── research-source.json
│   ├── signal.json
│   ├── hypothesis.json
│   └── validation.json
│
├── tests/
│
├── .env.example
├── README.md
└── CONTRIBUTING.md
```

The exact stack can be finalized after the architecture discussion.

---

# 19. Team Workspace Setup

Before development starts:

### GitHub

Create:

- One organization
- One primary repository
- `main` protected
- `develop` or equivalent integration branch if useful
- Feature branches
- Pull requests
- Required review
- Issues
- Project board
- CODEOWNERS if useful

Suggested labels:

- `frontend`
- `backend`
- `n8n`
- `supabase`
- `ai`
- `research`
- `product`
- `growth`
- `bug`
- `experiment`
- `architecture`

### Documentation

Create a shared `/docs` structure.

Every major product/architecture decision should have a short decision record.

### Secrets

Never commit:

- Supabase service/secret keys
- OpenAI API keys
- Search API keys
- n8n credentials
- Other provider secrets

Use environment variables and n8n credentials.

---

# 20. Supabase Setup

Create the production project and environments deliberately.

Recommended:

- Development
- Production

Avoid letting every developer directly modify production.

Initial setup:

1. Create Supabase project
2. Configure authentication
3. Create database schema
4. Enable required extensions
5. Establish workspace/user relationships
6. Add RLS
7. Add indexes
8. Create service/backend credentials
9. Create frontend-safe publishable credentials
10. Test isolation between users

The backend/service key must never be exposed to the browser.

---

# 21. n8n Setup

n8n should be treated as orchestration infrastructure, not the entire product backend.

Use it for:

- Research workflows
- Scheduled collection
- API orchestration
- AI pipelines
- Data transformations
- Background jobs

Keep core application authorization and user-facing product logic in the application/backend layer.

The Research Engine should become a reusable workflow rather than a single hardcoded AI Radar workflow.

---

# 22. First Workflow Reset

The existing:

```text
Manual Trigger
 → Research Configuration
 → Web Search
 → AI Signal Analyst
 → Structured Output Parser
```

is a prototype.

Do not continue blindly from it.

We should redesign it into the Research Engine architecture:

```text
Research Configuration
        ↓
Discovery
        ↓
Universal JSON
        ↓
Canonicalization
        ↓
Deduplication
        ↓
Relevance Filtering
        ↓
Content Extraction
        ↓
Evidence Pack
        ↓
Supabase
        ↓
Intelligence Analysis
```

The current AI Signal Analyst can be reused later as an intelligence-stage component.

---

# 23. Product Metrics

The product should eventually track:

## Research quality

- Source quality
- Evidence coverage
- Signal precision
- Duplicate rate
- Extraction success
- Hallucination/error rate

## Product usage

- Daily active users
- Weekly active users
- Research sessions
- Domains tracked
- Sources viewed
- Signals saved
- Patterns saved
- Hypotheses created
- Validations run

## Intelligence value

- User-rated useful signals
- Useful pattern rate
- Hypothesis survival rate
- Validation outcomes
- Repeat research sessions

## Economics

- Cost/user
- LLM cost/session
- Search cost/user
- Extraction cost
- Infrastructure cost
- Gross margin eventually

---

# 24. Product Vocabulary

Use consistent terms across the team.

**Source** = external origin of information.

**Evidence** = extracted information from a source that can support or contradict a claim.

**Signal** = meaningful event/development extracted from evidence.

**Observation** = interpretation based on multiple signals.

**Thesis** = explicit or inferred belief about where a market/investor is moving.

**Pattern** = recurring relationship supported by multiple observations.

**Hypothesis** = potential opportunity or explanation that still needs testing.

**Validation** = structured attempt to support and disprove a hypothesis.

**Insight** = evidence-backed conclusion after analysis.

**Domain** = the market/industry the user is researching.

**Workspace** = a user's isolated product environment.

---

# 25. What Success Looks Like

The final product should let an individual say:

> "I want to understand AI."

The platform should then help them move from:

```text
Thousands of sources
       ↓
Hundreds of relevant sources
       ↓
Meaningful evidence
       ↓
Signals
       ↓
Patterns
       ↓
Investment movements
       ↓
Potential gaps
       ↓
Hypotheses
       ↓
Counter-evidence
       ↓
Validated opportunities
```

The user should never have to manually repeat this research process every day.

---

# 26. Immediate Next Steps

Do NOT begin by building more n8n agents.

First complete these in order:

### Step 1
Create the team workspace.

### Step 2
Create the GitHub organization/repository and branch strategy.

### Step 3
Create the shared documentation structure.

### Step 4
Review and redesign the existing Supabase schema for multi-tenancy.

### Step 5
Finalize the Universal Research JSON Contract.

### Step 6
Define the source/discovery architecture.

### Step 7
Define the model-routing and cost-control architecture.

### Step 8
Define the exact Research Engine workflow.

### Step 9
Only then rebuild Workflow 1.

### Step 10
Build the reusable Research Engine before building the downstream intelligence agents.

---

# 27. Guiding Principle

The product should be built around one principle:

> **The system should not merely answer questions about a domain. It should continuously build an evidence-backed understanding of that domain and help the user discover, investigate, and validate what deserves attention next.**

The assignment is the first use case.

The Masters' Union cohort is the first distribution channel.

AI is the first domain.

But the underlying product is a **personal, persistent, multi-domain Intelligence → Ideation → Validation platform**.
