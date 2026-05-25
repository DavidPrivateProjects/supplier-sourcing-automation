# Supplier Scout Backend

FastAPI service for supplier discovery, enrichment, contact validation, scoring, and reusable investigation storage.

## Highlights

- **Runs with or without external credentials:** deterministic demo data keeps the app usable locally.
- **Typed API contracts:** Pydantic models validate requests and responses.
- **Reusable investigations:** Weaviate vector search can return similar prior work before new enrichment starts.
- **Supplier enrichment:** EXA Websets can discover supplier candidates and contact evidence.
- **Contact validation:** OpenAI can extract the right commercial contact from supplier replies.
- **Operational visibility:** `/health` reports which integrations are configured.

## Setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Leave optional credentials blank to use the deterministic demo workflow.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `ALLOWED_ORIGINS` | No | Comma-separated frontend origins for CORS |
| `SIMILARITY_DISTANCE` | No | Weaviate distance threshold for cache reuse |
| `EXA_WAIT_SECONDS` | No | Wait time before collecting EXA Websets results |
| `WEAVIATE_URL` | No | Enables vector lookup and persistence |
| `WEAVIATE_API_KEY` | No | Authenticates Weaviate Cloud |
| `EXA_API_KEY` | No | Enables live supplier enrichment |
| `OPENAI_API_KEY` | No | Enables AI-assisted contact extraction |
| `OPENAI_MODEL` | No | Defaults to `gpt-4o-mini` |

## Endpoints

### `POST /api/v1/requirements`

Submit buyer requirements and receive supplier matches.

```json
{
  "companyName": "Acme Manufacturing",
  "contactName": "John Smith",
  "email": "john.smith@acme.com",
  "phone": "+1-555-0123",
  "productDescription": "Industrial temperature sensors with digital output",
  "quantity": "1000 units",
  "budgetRange": "$10,000 - $25,000",
  "timeline": "3 months",
  "specifications": "Operating range: -40C to 125C, Digital I2C interface, IP67 rated housing"
}
```

Example response:

```json
{
  "investigation_id": "inv_5fdd3f02-4d1e-4938-96e2-2d18f9b906cb",
  "cached": false,
  "status": "completed",
  "message": "Demo supplier set generated because live enrichment is not configured. Contact validation and scoring are ready for review.",
  "suppliers": [
    {
      "name": "Atlas Precision Manufacturing",
      "contact_email": "sales-industrial-temperature-sensors@atlasprecision.example.com",
      "contact_phone": "+49 89 0000 0000",
      "website": "https://atlasprecision.example.com",
      "location": "Germany",
      "match_score": 94,
      "capabilities": ["Technical qualification", "Capacity screening", "Commercial follow-up"],
      "conversation_log": []
    }
  ],
  "timestamp": "2026-05-25T13:52:00+00:00"
}
```

### `GET /api/v1/investigations/{investigation_id}/status`

Returns completed investigation details from in-memory demo storage or Weaviate.

### `GET /health`

Returns service health and configured integration flags.

## Initialize Weaviate

When using live vector search, create the collection once:

```bash
python create_collection.py
```

The script is idempotent and exits without changing an existing collection.

## Manual API check

```bash
curl -X POST http://localhost:8000/api/v1/requirements \
  -H "Content-Type: application/json" \
  -d @test_request.json
```

Interactive docs:

- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## Project structure

```text
backend/
├── main.py              # FastAPI app and orchestration workflow
├── create_collection.py # Weaviate collection setup
├── requirements.txt     # Python dependencies
├── test_request.json    # Sample request payload
├── .env.example         # Local configuration template
└── README.md
```
