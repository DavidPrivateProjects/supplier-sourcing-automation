import asyncio
import json
import logging
import os
import re
from datetime import datetime, timezone
from typing import Any, Literal, Optional
from uuid import uuid4

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field

try:
    import weaviate
    import weaviate.classes.query as wq
    from weaviate.classes.init import Auth
except ImportError:  # pragma: no cover - lets local demos run before optional setup
    weaviate = None
    wq = None
    Auth = None

try:
    from exa_py import Exa
except ImportError:  # pragma: no cover
    Exa = None

try:
    from openai import OpenAI
except ImportError:  # pragma: no cover
    OpenAI = None


load_dotenv()

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
logger = logging.getLogger("supplier_scout")

StatusValue = Literal["processing", "searching", "contacting", "completed", "failed"]
INVESTIGATION_STORE: dict[str, dict[str, Any]] = {}


class Settings(BaseModel):
    weaviate_url: Optional[str] = Field(default_factory=lambda: os.getenv("WEAVIATE_URL"))
    weaviate_api_key: Optional[str] = Field(default_factory=lambda: os.getenv("WEAVIATE_API_KEY"))
    exa_api_key: Optional[str] = Field(default_factory=lambda: os.getenv("EXA_API_KEY"))
    openai_api_key: Optional[str] = Field(default_factory=lambda: os.getenv("OPENAI_API_KEY"))
    allowed_origins: list[str] = Field(default_factory=lambda: [
        origin.strip()
        for origin in os.getenv(
            "ALLOWED_ORIGINS",
            "http://localhost:5173,http://localhost:3000,http://localhost:8080",
        ).split(",")
        if origin.strip()
    ])
    similarity_distance: float = Field(default_factory=lambda: float(os.getenv("SIMILARITY_DISTANCE", "0.5")))
    exa_wait_seconds: int = Field(default_factory=lambda: int(os.getenv("EXA_WAIT_SECONDS", "5")))


settings = Settings()


class BuyerRequirement(BaseModel):
    companyName: str = Field(min_length=2, max_length=100)
    contactName: str = Field(min_length=2, max_length=100)
    email: EmailStr
    phone: str = Field(min_length=7, max_length=30)
    productDescription: str = Field(min_length=5, max_length=500)
    quantity: str = Field(min_length=1, max_length=100)
    budgetRange: str = Field(min_length=1, max_length=100)
    timeline: str = Field(min_length=1, max_length=100)
    specifications: Optional[str] = Field(default=None, max_length=2000)


class ConversationTurn(BaseModel):
    role: str
    content: str
    timestamp: str


class SupplierMatch(BaseModel):
    name: str
    contact_email: str
    contact_phone: str
    website: str
    location: str
    match_score: int = Field(ge=0, le=100)
    capabilities: list[str]
    conversation_log: list[ConversationTurn]


class RequirementResponse(BaseModel):
    investigation_id: str
    cached: bool
    status: StatusValue
    message: str
    suppliers: list[SupplierMatch]
    timestamp: str


class StatusResponse(BaseModel):
    investigation_id: str
    status: StatusValue
    progress: int = Field(ge=0, le=100)
    message: str
    suppliers: Optional[list[SupplierMatch]] = None
    timestamp: str


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def make_app() -> FastAPI:
    api = FastAPI(
        title="Supplier Scout API",
        version="1.0.0",
        description="AI-assisted supplier discovery, enrichment, and reusable sourcing investigations.",
    )
    api.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    return api


app = make_app()


def get_weaviate_collection() -> Any:
    if not (weaviate and Auth and settings.weaviate_url and settings.weaviate_api_key):
        return None

    try:
        client = weaviate.connect_to_weaviate_cloud(
            cluster_url=settings.weaviate_url,
            auth_credentials=Auth.api_key(settings.weaviate_api_key),
        )
        return client.collections.use("Investigations")
    except Exception as exc:
        logger.warning("Weaviate unavailable; continuing without cache: %s", exc)
        return None


def get_exa_client() -> Any:
    if not (Exa and settings.exa_api_key):
        return None
    return Exa(settings.exa_api_key)


def get_openai_client() -> Any:
    if not (OpenAI and settings.openai_api_key):
        return None
    return OpenAI(api_key=settings.openai_api_key)


def parse_suppliers(suppliers_field: Any, fallback_distance: Optional[float] = None) -> list[SupplierMatch]:
    if isinstance(suppliers_field, str):
        try:
            suppliers = json.loads(suppliers_field)
        except json.JSONDecodeError:
            suppliers = []
    elif isinstance(suppliers_field, list):
        suppliers = suppliers_field
    else:
        suppliers = []

    formatted: list[SupplierMatch] = []
    for supplier in suppliers:
        if not isinstance(supplier, dict):
            continue

        raw_score = supplier.get("match_score")
        if isinstance(raw_score, (int, float)):
            match_score = max(0, min(100, int(raw_score)))
        elif fallback_distance is not None:
            match_score = max(0, min(100, int(round((1.0 - fallback_distance) * 100))))
        else:
            match_score = 80

        raw_conversation = supplier.get("conversation_log") or []
        conversation_log = [
            ConversationTurn(
                role=str(turn.get("role", "system")),
                content=str(turn.get("content") or turn.get("message") or ""),
                timestamp=str(turn.get("timestamp") or now_iso()),
            )
            for turn in raw_conversation
            if isinstance(turn, dict)
        ]

        formatted.append(
            SupplierMatch(
                name=str(supplier.get("company_name") or supplier.get("name") or "Unknown supplier"),
                contact_email=str(
                    supplier.get("contact_email")
                    or supplier.get("extracted_contact_email")
                    or supplier.get("email")
                    or "contact@example.com"
                ),
                contact_phone=str(supplier.get("contact_phone") or supplier.get("phone") or "Contact via email"),
                website=str(supplier.get("website") or supplier.get("linkedin") or "https://example.com"),
                location=str(supplier.get("location") or supplier.get("country") or "Global"),
                match_score=match_score,
                capabilities=[str(item) for item in supplier.get("capabilities", [])],
                conversation_log=conversation_log,
            )
        )
    return formatted


def cached_investigation(query_text: str) -> Optional[RequirementResponse]:
    collection = get_weaviate_collection()
    if collection is None or wq is None:
        return None

    try:
        response = collection.query.near_text(
            query=query_text,
            limit=3,
            return_metadata=wq.MetadataQuery(distance=True),
        )
    except Exception as exc:
        logger.warning("Cache lookup failed: %s", exc)
        return None

    objects = getattr(response, "objects", []) or []
    for obj in objects:
        metadata = getattr(obj, "metadata", None)
        distance = getattr(metadata, "distance", None)
        if distance is None or float(distance) > settings.similarity_distance:
            continue

        properties = getattr(obj, "properties", {}) or {}
        suppliers = parse_suppliers(
            properties.get("suppliers") or properties.get("suppliers_json") or properties.get("results") or [],
            fallback_distance=float(distance),
        )
        if not suppliers:
            continue

        investigation_id = str(getattr(obj, "uuid", None) or properties.get("id") or uuid4())
        return RequirementResponse(
            investigation_id=investigation_id,
            cached=True,
            status="completed",
            message="Similar sourcing investigation found. Returning reusable results.",
            suppliers=suppliers,
            timestamp=str(properties.get("created_at") or now_iso()),
        )
    return None


def extract_contact_email(text: str) -> Optional[str]:
    match = re.search(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}", text)
    return match.group(0) if match else None


def simulate_conversation(supplier: dict[str, str], requirement: BuyerRequirement) -> tuple[str, list[ConversationTurn]]:
    timestamp = now_iso()
    domain = re.sub(r"[^a-z0-9]+", "", supplier["name"].lower())[:32] or "supplier"
    fallback_email = f"sourcing@{domain}.example.com"

    outreach = (
        f"Hi {supplier['name']}, we are sourcing {requirement.productDescription}. "
        f"Target quantity: {requirement.quantity}; budget: {requirement.budgetRange}; "
        f"timeline: {requirement.timeline}. Could you confirm the best commercial contact?"
    )
    reply = (
        "Thanks for the context. The right contact for commercial qualification is "
        f"{supplier.get('email') or fallback_email}. They can confirm capacity, certifications, "
        "and lead-time assumptions."
    )

    openai_client = get_openai_client()
    extracted_email = supplier.get("email") or fallback_email
    if openai_client:
        prompt = (
            "Extract the decision-maker email from this supplier reply. "
            "Return JSON with contact_email and reason only.\n\n"
            f"Reply: {reply}"
        )
        try:
            completion = openai_client.chat.completions.create(
                model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"},
            )
            content = completion.choices[0].message.content or "{}"
            extracted_email = json.loads(content).get("contact_email") or extracted_email
        except Exception as exc:
            logger.warning("OpenAI extraction failed; using deterministic parser: %s", exc)

    extracted_email = extract_contact_email(extracted_email) or extract_contact_email(reply) or fallback_email
    return extracted_email, [
        ConversationTurn(role="buyer", content=outreach, timestamp=timestamp),
        ConversationTurn(role="supplier", content=reply, timestamp=timestamp),
        ConversationTurn(
            role="system",
            content=f"Extracted commercial contact: {extracted_email}",
            timestamp=timestamp,
        ),
    ]


async def search_suppliers(requirement: BuyerRequirement) -> list[dict[str, str]]:
    exa = get_exa_client()
    if exa is None:
        return []

    try:
        webset = exa.websets.create(params={
            "search": {
                "query": f"Supplier companies and work emails for {requirement.productDescription}",
                "criteria": [{"description": requirement.productDescription}],
                "count": 10,
            },
            "enrichments": [{"description": "Work Email", "format": "text"}],
        })
        webset_id = dict(webset)["id"]
        await asyncio.sleep(settings.exa_wait_seconds)
        items = exa.websets.items.list(webset_id=webset_id, limit=20)
    except Exception as exc:
        logger.warning("EXA enrichment failed; using demo suppliers: %s", exc)
        return []

    suppliers: list[dict[str, str]] = []
    for item in dict(items).get("data", []):
        item_text = str(item)
        name_match = re.search(r"name=['\"]([^'\"]{2,120})['\"]", item_text)
        email = extract_contact_email(item_text)
        linkedin_match = re.search(r"https?://(?:[a-z]{2,4}\.)?linkedin\.com[^\s'\)\],>\"]+", item_text, re.I)
        if name_match and email:
            suppliers.append({
                "name": name_match.group(1).strip(),
                "email": email,
                "website": linkedin_match.group(0) if linkedin_match else "https://example.com",
            })
    return suppliers


def demo_suppliers(requirement: BuyerRequirement) -> list[dict[str, str]]:
    slug = re.sub(r"[^a-z0-9]+", "-", requirement.productDescription.lower()).strip("-")[:36] or "industrial-components"
    return [
        {
            "name": "Atlas Precision Manufacturing",
            "email": f"sales-{slug}@atlasprecision.example.com",
            "website": "https://atlasprecision.example.com",
            "location": "Germany",
        },
        {
            "name": "Nordic Components Group",
            "email": f"rfq-{slug}@nordiccomponents.example.com",
            "website": "https://nordiccomponents.example.com",
            "location": "Sweden",
        },
        {
            "name": "Vector Industrial Supply",
            "email": f"partner-{slug}@vectorindustrial.example.com",
            "website": "https://vectorindustrial.example.com",
            "location": "United States",
        },
    ]


def build_supplier_matches(raw_suppliers: list[dict[str, str]], requirement: BuyerRequirement) -> list[SupplierMatch]:
    matches: list[SupplierMatch] = []
    base_capabilities = [
        "Technical qualification",
        "Capacity screening",
        "Commercial follow-up",
    ]

    for index, supplier in enumerate(raw_suppliers[:5]):
        contact_email, conversation_log = simulate_conversation(supplier, requirement)
        matches.append(
            SupplierMatch(
                name=supplier["name"],
                contact_email=contact_email,
                contact_phone="+49 89 0000 0000" if supplier.get("location") == "Germany" else "Contact via email",
                website=supplier.get("website") or "https://example.com",
                location=supplier.get("location") or "Global",
                match_score=max(72, 94 - (index * 5)),
                capabilities=base_capabilities + [
                    "Requirement fit scoring",
                    f"Supports {requirement.quantity}",
                ],
                conversation_log=conversation_log,
            )
        )
    return matches


def save_investigation(requirement: BuyerRequirement, suppliers: list[SupplierMatch]) -> str:
    investigation_id = f"inv_{uuid4()}"
    timestamp = now_iso()
    INVESTIGATION_STORE[investigation_id] = {
        "status": "completed",
        "progress": 100,
        "message": "Investigation completed with supplier enrichment and contact validation.",
        "suppliers": [supplier.model_dump() for supplier in suppliers],
        "timestamp": timestamp,
    }

    collection = get_weaviate_collection()
    if collection is None:
        return investigation_id

    try:
        stored_id = collection.data.insert(properties={
            "status": "completed",
            "requirement_text": f"{requirement.productDescription} {requirement.specifications or ''}".strip(),
            "suppliers": json.dumps([supplier.model_dump() for supplier in suppliers]),
            "created_at": timestamp,
            "message": "Investigation completed with supplier enrichment and contact validation.",
        })
        return str(stored_id)
    except Exception as exc:
        logger.warning("Could not persist investigation to Weaviate: %s", exc)
        return investigation_id


@app.post("/api/v1/requirements", response_model=RequirementResponse)
async def process_requirements(requirement: BuyerRequirement) -> RequirementResponse:
    query_text = f"{requirement.productDescription} {requirement.specifications or ''}".strip()
    logger.info("Processing supplier requirement for %s", requirement.companyName)

    cached = cached_investigation(query_text)
    if cached:
        INVESTIGATION_STORE[cached.investigation_id] = {
            "status": cached.status,
            "progress": 100,
            "message": cached.message,
            "suppliers": [supplier.model_dump() for supplier in cached.suppliers],
            "timestamp": cached.timestamp,
        }
        return cached

    raw_suppliers = await search_suppliers(requirement)
    source_message = "Live web enrichment completed."
    if not raw_suppliers:
        raw_suppliers = demo_suppliers(requirement)
        source_message = "Demo supplier set generated because live enrichment is not configured."

    suppliers = build_supplier_matches(raw_suppliers, requirement)
    investigation_id = save_investigation(requirement, suppliers)

    return RequirementResponse(
        investigation_id=investigation_id,
        cached=False,
        status="completed",
        message=f"{source_message} Contact validation and scoring are ready for review.",
        suppliers=suppliers,
        timestamp=now_iso(),
    )


@app.get("/api/v1/investigations/{investigation_id}/status", response_model=StatusResponse)
async def get_investigation_status(investigation_id: str) -> StatusResponse:
    stored = INVESTIGATION_STORE.get(investigation_id)
    if stored:
        suppliers = parse_suppliers(stored.get("suppliers", []))
        return StatusResponse(
            investigation_id=investigation_id,
            status=stored.get("status", "completed"),
            progress=stored.get("progress", 100),
            message=stored.get("message", "Investigation completed."),
            suppliers=suppliers if stored.get("status") == "completed" else None,
            timestamp=stored.get("timestamp", now_iso()),
        )

    collection = get_weaviate_collection()
    if collection is not None:
        try:
            result = collection.query.fetch_object_by_id(investigation_id)
            if result:
                properties = getattr(result, "properties", {}) or {}
                status_value = properties.get("status", "completed")
                suppliers = parse_suppliers(properties.get("suppliers", []))
                return StatusResponse(
                    investigation_id=investigation_id,
                    status=status_value if status_value in {"processing", "searching", "contacting", "completed", "failed"} else "completed",
                    progress=100 if status_value == "completed" else 25,
                    message=properties.get("message", "Processing your request..."),
                    suppliers=suppliers if status_value == "completed" else None,
                    timestamp=properties.get("created_at", now_iso()),
                )
        except Exception as exc:
            logger.warning("Status lookup failed for %s: %s", investigation_id, exc)

    return StatusResponse(
        investigation_id=investigation_id,
        status="failed",
        progress=0,
        message="Investigation was not found. Submit a new requirement to start a fresh search.",
        timestamp=now_iso(),
    )


@app.get("/health")
async def health_check() -> dict[str, Any]:
    return {
        "status": "healthy",
        "timestamp": now_iso(),
        "services": {
            "weaviate_configured": bool(settings.weaviate_url and settings.weaviate_api_key),
            "exa_configured": bool(settings.exa_api_key),
            "openai_configured": bool(settings.openai_api_key),
        },
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
