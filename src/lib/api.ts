export interface ConversationTurn {
  role: string;
  content: string;
  timestamp: string;
}

export interface Supplier {
  name: string;
  contact_email: string;
  contact_phone: string;
  website: string;
  location: string;
  match_score: number;
  capabilities: string[];
  conversation_log: ConversationTurn[];
}

export interface BuyerRequirementPayload {
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  productDescription: string;
  quantity: string;
  budgetRange: string;
  timeline: string;
  specifications: string;
}

export interface RequirementResponse {
  investigation_id: string;
  cached: boolean;
  status: "processing" | "searching" | "contacting" | "completed" | "failed";
  message: string;
  suppliers: Supplier[];
  timestamp: string;
}

export interface StatusResponse {
  investigation_id: string;
  status: "processing" | "searching" | "contacting" | "completed" | "failed";
  progress: number;
  message: string;
  suppliers?: Supplier[];
  timestamp: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

async function parseJsonResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `API request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function submitRequirement(payload: BuyerRequirementPayload): Promise<RequirementResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/requirements`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return parseJsonResponse<RequirementResponse>(response);
}

export async function fetchInvestigationStatus(investigationId: string): Promise<StatusResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/investigations/${investigationId}/status`);
  return parseJsonResponse<StatusResponse>(response);
}
