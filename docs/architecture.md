# Architecture Guide

Supplier Scout is organized around a single business outcome: shorten supplier discovery while making the reasoning behind each shortlist easy to inspect.

## System context

```mermaid
flowchart LR
    Buyer[Procurement buyer] --> UI[Web application]
    UI --> API[Supplier Scout API]
    API --> Store[(Reusable investigation store)]
    API --> Research[Supplier research service]
    API --> AI[AI extraction service]
    API --> UI
```

**What the visualization shows:** the buyer only interacts with the web application. The backend owns the orchestration work: reuse prior investigations, request new research, validate contact information, and return a structured decision package.

## Runtime flow

```mermaid
sequenceDiagram
    participant Buyer
    participant UI as React UI
    participant API as FastAPI API
    participant DB as Weaviate
    participant EXA as EXA Websets
    participant LLM as OpenAI

    Buyer->>UI: Submit sourcing requirement
    UI->>API: POST /api/v1/requirements
    API->>DB: Search similar investigation
    alt Similar result exists
        DB-->>API: Supplier shortlist
        API-->>UI: Cached completed result
    else New investigation needed
        API->>EXA: Search and enrich suppliers
        EXA-->>API: Supplier candidates
        API->>LLM: Extract best contact from reply
        LLM-->>API: Contact insight
        API->>DB: Persist result for reuse
        API-->>UI: Completed shortlist
    end
    UI-->>Buyer: Results dashboard
```

**What the visualization shows:** the cache branch is intentionally first because it is the highest-leverage part of the design. Every completed investigation can reduce future research effort for similar requirements.

## Component responsibilities

| Component | Responsibility | Why it matters |
| --- | --- | --- |
| Requirement form | Captures buyer, product, quantity, budget, timeline, and specifications | Converts unstructured sourcing asks into validated data |
| API orchestrator | Coordinates cache lookup, enrichment, contact validation, scoring, and persistence | Keeps the UI simple and the business workflow traceable |
| Weaviate store | Stores requirement text and supplier results for vector similarity reuse | Turns prior work into a reusable knowledge asset |
| EXA enrichment | Finds supplier candidates and contact evidence | Reduces manual research effort |
| OpenAI extraction | Reads supplier replies and extracts the next best contact | Moves the workflow closer to a buyer-ready handoff |
| Results dashboard | Shows fit score, capabilities, contact path, and audit trail | Helps stakeholders review the recommendation quickly |

## Data model

```mermaid
erDiagram
    BUYER_REQUIREMENT ||--o{ SUPPLIER_MATCH : produces
    BUYER_REQUIREMENT {
        string companyName
        string contactName
        string email
        string phone
        string productDescription
        string quantity
        string budgetRange
        string timeline
        string specifications
    }
    SUPPLIER_MATCH ||--o{ CONVERSATION_TURN : includes
    SUPPLIER_MATCH {
        string name
        string contact_email
        string contact_phone
        string website
        string location
        int match_score
        string capabilities
    }
    CONVERSATION_TURN {
        string role
        string content
        string timestamp
    }
```

**What the visualization shows:** the result is not only a supplier name. It is a reviewable package with contact evidence, scoring, and a history of how the contact was identified.

## Demo and production modes

The backend supports two useful modes:

1. **Demo mode:** no external credentials are required. The API generates deterministic supplier examples, scores them, and returns contact validation logs. This keeps the product easy to evaluate.
2. **Integrated mode:** configure Weaviate, EXA, and OpenAI credentials to enable vector reuse, live supplier enrichment, and AI-assisted extraction.

## Operational notes

- `ALLOWED_ORIGINS` controls browser origins that can call the API.
- `SIMILARITY_DISTANCE` controls the Weaviate cache threshold. Lower values are stricter; higher values reuse more prior investigations.
- `EXA_WAIT_SECONDS` controls how long the backend waits before collecting EXA webset results.
- `/health` reports whether each optional integration is configured.
