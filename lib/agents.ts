import { createHash, randomBytes } from "crypto";
import { NextRequest } from "next/server";
import { getAdminDb } from "./firebase-admin";
import { Timestamp, FieldValue } from "firebase-admin/firestore";

// ============================================================================
// Types
// ============================================================================

export interface Agent {
  id: string;
  name: string;
  description?: string;
  apiKeyHash: string;
  apiKeyPrefix: string;

  // Claim status
  status: "pending_claim" | "claimed" | "suspended";
  claimToken?: string;
  claimExpiresAt?: Timestamp;

  // Owner info (after claim)
  ownerId?: string;
  ownerEmail?: string;
  ownerDisplayName?: string;
  claimedAt?: Timestamp;

  // Metadata
  createdAt: Timestamp;
  lastActiveAt?: Timestamp;

  // Profile
  avatarUrl?: string;
  visibility: {
    isPublic: boolean;
    showOwner: boolean;
  };
}

export interface AgentPublicProfile {
  id: string;
  name: string;
  description?: string;
  status: Agent["status"];
  avatarUrl?: string;
  createdAt: Timestamp;
  lastActiveAt?: Timestamp;
  owner?: {
    displayName?: string;
    email?: string;
  };
}

// ============================================================================
// Constants
// ============================================================================

const API_KEY_PREFIX = "cb_agent_";
const API_KEY_SECRET_LENGTH = 32; // 32 hex chars = 128 bits
const CLAIM_TOKEN_LENGTH = 32;
const CLAIM_EXPIRY_DAYS = 7;

// ============================================================================
// Key Generation & Hashing
// ============================================================================

/**
 * Generate a new API key for an agent.
 * Returns both the full key (to show once) and its hash (to store).
 */
export function generateApiKey(): {
  apiKey: string;
  apiKeyHash: string;
  apiKeyPrefix: string;
} {
  const secret = randomBytes(API_KEY_SECRET_LENGTH / 2).toString("hex");
  const apiKey = `${API_KEY_PREFIX}${secret}`;
  const apiKeyHash = hashApiKey(apiKey);

  return {
    apiKey,
    apiKeyHash,
    apiKeyPrefix: API_KEY_PREFIX,
  };
}

/**
 * Generate a claim token for human verification.
 */
export function generateClaimToken(): string {
  return randomBytes(CLAIM_TOKEN_LENGTH / 2).toString("hex");
}

/**
 * Hash an API key using SHA-256.
 */
export function hashApiKey(apiKey: string): string {
  return createHash("sha256").update(apiKey).digest("hex");
}

/**
 * Get the claim expiry timestamp (7 days from now).
 */
export function getClaimExpiry(): Timestamp {
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + CLAIM_EXPIRY_DAYS);
  return Timestamp.fromDate(expiryDate);
}

// ============================================================================
// Agent Verification
// ============================================================================

/**
 * Extract API key from request Authorization header.
 */
export function extractApiKey(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization") || "";

  // Support both "Bearer cb_agent_xxx" and just "cb_agent_xxx"
  if (authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    if (token.startsWith(API_KEY_PREFIX)) {
      return token;
    }
  } else if (authHeader.startsWith(API_KEY_PREFIX)) {
    return authHeader;
  }

  return null;
}

/**
 * Verify an agent by their API key.
 * Returns the agent document if valid, null otherwise.
 */
export async function getVerifiedAgent(
  request: NextRequest
): Promise<Agent | null> {
  const apiKey = extractApiKey(request);
  if (!apiKey) {
    return null;
  }

  const adminDb = getAdminDb();
  if (!adminDb) {
    throw new Error("Firebase Admin is not configured");
  }

  const apiKeyHash = hashApiKey(apiKey);

  // Query for agent with matching hash
  const agentsRef = adminDb.collection("agents");
  const snapshot = await agentsRef.where("apiKeyHash", "==", apiKeyHash).get();

  if (snapshot.empty) {
    return null;
  }

  const doc = snapshot.docs[0];
  const agent = { id: doc.id, ...doc.data() } as Agent;

  // Check if agent is suspended
  if (agent.status === "suspended") {
    return null;
  }

  // Update last active timestamp (fire and forget)
  doc.ref.update({ lastActiveAt: Timestamp.now() }).catch(() => {
    // Ignore errors for this non-critical update
  });

  return agent;
}

/**
 * Get agent by claim token.
 * SECURITY: Validates token format before database query to prevent abuse.
 */
export async function getAgentByClaimToken(
  claimToken: string
): Promise<Agent | null> {
  // Validate claim token format (32 hex characters = 16 bytes)
  // This prevents database queries with malformed tokens
  if (!claimToken || typeof claimToken !== "string" || !/^[a-f0-9]{32}$/i.test(claimToken)) {
    return null;
  }

  const adminDb = getAdminDb();
  if (!adminDb) {
    throw new Error("Firebase Admin is not configured");
  }

  const agentsRef = adminDb.collection("agents");
  const snapshot = await agentsRef
    .where("claimToken", "==", claimToken)
    .where("status", "==", "pending_claim")
    .get();

  if (snapshot.empty) {
    return null;
  }

  const doc = snapshot.docs[0];
  const agent = { id: doc.id, ...doc.data() } as Agent;

  // Check if claim has expired
  if (agent.claimExpiresAt && agent.claimExpiresAt.toDate() < new Date()) {
    return null;
  }

  return agent;
}

// ============================================================================
// Agent CRUD Operations
// ============================================================================

/**
 * Create a new agent.
 */
export async function createAgent(
  name: string,
  description?: string
): Promise<{ agent: Agent; apiKey: string; claimUrl: string }> {
  const adminDb = getAdminDb();
  if (!adminDb) {
    throw new Error("Firebase Admin is not configured");
  }

  const { apiKey, apiKeyHash, apiKeyPrefix } = generateApiKey();
  const claimToken = generateClaimToken();

  const agentData: Omit<Agent, "id"> = {
    name,
    description,
    apiKeyHash,
    apiKeyPrefix,
    status: "pending_claim",
    claimToken,
    claimExpiresAt: getClaimExpiry(),
    createdAt: Timestamp.now(),
    visibility: {
      isPublic: false,
      showOwner: false,
    },
  };

  const docRef = await adminDb.collection("agents").add(agentData);
  const agent = { id: docRef.id, ...agentData } as Agent;

  // Construct claim URL (will be relative, caller should make absolute)
  const claimUrl = `/agents/claim/${claimToken}`;

  return { agent, apiKey, claimUrl };
}

/**
 * Claim an agent (link to human owner).
 */
export async function claimAgent(
  claimToken: string,
  ownerId: string,
  ownerEmail?: string,
  ownerDisplayName?: string
): Promise<Agent | null> {
  const agent = await getAgentByClaimToken(claimToken);
  if (!agent) {
    return null;
  }

  const adminDb = getAdminDb();
  if (!adminDb) {
    throw new Error("Firebase Admin is not configured");
  }

  const claimedAt = Timestamp.now();
  
  // Build update object - only include defined values (Firestore rejects undefined)
  const updateData: Record<string, unknown> = {
    status: "claimed",
    ownerId,
    claimedAt,
    claimToken: FieldValue.delete(),
    claimExpiresAt: FieldValue.delete(),
  };
  
  // Only include optional fields if they have values
  if (ownerEmail !== undefined) {
    updateData.ownerEmail = ownerEmail;
  }
  if (ownerDisplayName !== undefined) {
    updateData.ownerDisplayName = ownerDisplayName;
  }

  await adminDb.collection("agents").doc(agent.id).update(updateData);

  return {
    ...agent,
    status: "claimed",
    ownerId,
    ownerEmail,
    ownerDisplayName,
    claimedAt,
    claimToken: undefined,
    claimExpiresAt: undefined,
  } as Agent;
}

/**
 * Update agent profile.
 */
export async function updateAgentProfile(
  agentId: string,
  updates: Partial<Pick<Agent, "name" | "description" | "avatarUrl" | "visibility">>
): Promise<void> {
  const adminDb = getAdminDb();
  if (!adminDb) {
    throw new Error("Firebase Admin is not configured");
  }

  await adminDb.collection("agents").doc(agentId).update(updates);
}

/**
 * Convert agent to public profile (safe to expose).
 */
export function toPublicProfile(agent: Agent): AgentPublicProfile {
  const profile: AgentPublicProfile = {
    id: agent.id,
    name: agent.name,
    description: agent.description,
    status: agent.status,
    avatarUrl: agent.avatarUrl,
    createdAt: agent.createdAt,
    lastActiveAt: agent.lastActiveAt,
  };

  if (agent.visibility?.showOwner && agent.status === "claimed") {
    profile.owner = {
      displayName: agent.ownerDisplayName,
      email: agent.ownerEmail,
    };
  }

  return profile;
}

/**
 * Get all agents owned by a user.
 */
export async function getAgentsByOwner(ownerId: string): Promise<Agent[]> {
  const adminDb = getAdminDb();
  if (!adminDb) {
    throw new Error("Firebase Admin is not configured");
  }

  const agentsRef = adminDb.collection("agents");
  const snapshot = await agentsRef
    .where("ownerId", "==", ownerId)
    .where("status", "==", "claimed")
    .orderBy("claimedAt", "desc")
    .get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Agent[];
}
