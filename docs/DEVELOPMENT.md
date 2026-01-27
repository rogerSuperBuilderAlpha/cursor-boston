# Development Guide

This document describes the development setup and tools for the Cursor Boston project.

## Environment Variables

### Validation

Before starting the application, ensure all required environment variables are set. A validation script is available:

```bash
npm run validate-env
```

This script checks that all required Firebase configuration variables are set and not using placeholder values. It runs automatically before builds via the `prebuild` hook.

Required variables:
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_DATABASE_URL`

Optional variables (for OAuth features):
- Discord OAuth variables
- GitHub OAuth variables
- Admin email

## Rate Limiting

API routes are protected with rate limiting to prevent abuse:

- **OAuth Callbacks**: 10 requests per 15 minutes (strict)
- **Webhooks**: 30 requests per minute
- **Standard API Routes**: 60 requests per minute
- **Public Endpoints**: 100 requests per minute

Rate limit headers are included in responses:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Remaining requests in current window
- `X-RateLimit-Reset`: Timestamp when the limit resets
- `Retry-After`: Seconds to wait before retrying (on 429 responses)

## Request Logging

All API requests are automatically logged with:
- Request method and path
- Response status code
- Request duration
- Client IP address
- User agent
- Request ID (for tracing)

Logs are structured and include different levels:
- **INFO**: Successful requests (2xx)
- **WARN**: Client errors (4xx)
- **ERROR**: Server errors (5xx)

In production, consider integrating with a logging service (e.g., Sentry, LogRocket) for better error tracking.

## Testing

The project uses Jest and React Testing Library for automated testing.

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Writing Tests

Tests are located in the `__tests__` directory, mirroring the source structure:
- `__tests__/lib/` - Library function tests
- `__tests__/components/` - Component tests
- `__tests__/app/` - Page and API route tests

Example test structure:
```typescript
import { someFunction } from '@/lib/some-module';

describe('someFunction', () => {
  it('should do something', () => {
    expect(someFunction()).toBe(expected);
  });
});
```

## Pre-commit Hooks

Pre-commit hooks automatically run before each commit to ensure code quality:

1. **Type Checking**: Validates TypeScript types
2. **Linting**: Runs ESLint and auto-fixes issues

The hooks use Husky and lint-staged to only check staged files, making them fast and efficient.

### Setup

After cloning the repository, run:
```bash
npm install
```

This will automatically set up Husky hooks via the `prepare` script.

### Bypassing Hooks

If you need to bypass hooks in an emergency (not recommended):
```bash
git commit --no-verify
```

## Code Quality

### Type Checking

```bash
npm run type-check
```

Runs TypeScript compiler in check-only mode without emitting files.

### Linting

```bash
npm run lint
```

Runs ESLint to check for code quality issues. The pre-commit hook automatically fixes auto-fixable issues.

## Development Workflow

1. **Start Development Server**
   ```bash
   npm run dev
   ```

2. **Before Committing**
   - Ensure tests pass: `npm test`
   - Check types: `npm run type-check`
   - Fix linting: `npm run lint`
   - Pre-commit hooks will run automatically

3. **Before Building**
   - Environment variables are validated automatically
   - Run `npm run build` to create production build

## Production Considerations

### Rate Limiting

The current rate limiting implementation uses in-memory storage, which works for single-instance deployments. For multi-instance deployments (e.g., multiple server instances, serverless functions), consider:

- Using Redis for shared rate limit state
- Using a dedicated rate limiting service (e.g., Upstash, Cloudflare Rate Limiting)

### Logging

For production, enhance logging by:

1. **Error Tracking**: Integrate with Sentry or similar service
2. **Log Aggregation**: Use services like Datadog, LogRocket, or CloudWatch
3. **Structured Logging**: Ensure logs are in a format your logging service can parse

### Monitoring

Consider adding:
- Health check endpoints
- Metrics collection (e.g., Prometheus)
- Performance monitoring (e.g., New Relic, Datadog APM)
