import { NextResponse } from 'next/server';

/**
 * Health check endpoint for container orchestration and monitoring
 * Returns 200 OK if the application is running
 */
export async function GET() {
  return NextResponse.json(
    {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '0.1.0',
    },
    { status: 200 }
  );
}
