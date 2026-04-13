import { NextResponse } from 'next/server';

/**
 * AI Service Discovery Endpoint
 * Provides metadata for LLMs and AI Agents to understand the
 * capabilities of the Boston AI Community platform.
 */
export async function GET() {
  const discoveryData = {
    schema_version: "v1",
    name_for_model: "cursor_boston_community",
    description_for_model: "A hub for AI developers in Boston to coordinate meetups, share AI coding rules, and find AI-native jobs.",
    capabilities: {
      event_tracking: true,
      career_board: true,
      cursor_rules_sharing: true
    },
    endpoints: {
      events: "/api/events",
      careers: "/api/careers",
      rules: "/api/rules"
    },
    contact_email: "community@cursorboston.com"
  };

  return NextResponse.json(discoveryData, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json',
    },
  });
}
