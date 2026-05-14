/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Serves Swagger UI at /api/docs. Returns a raw HTML shell that loads
 * Swagger UI from a CDN and points it at /openapi.json (which is generated
 * by scripts/generate-openapi.ts on every build).
 *
 * Returning HTML from a Route Handler (rather than a page.tsx) lets us
 * bypass the app-wide layout/Tailwind globals so Swagger UI renders cleanly.
 */

const SWAGGER_UI_VERSION = "5.17.14";

const HTML = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>API Reference — Cursor Boston</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@${SWAGGER_UI_VERSION}/swagger-ui.css" />
    <style>html,body{margin:0;padding:0;background:#fafafa;}</style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@${SWAGGER_UI_VERSION}/swagger-ui-bundle.js" crossorigin></script>
    <script>
      window.addEventListener('load', function () {
        window.ui = SwaggerUIBundle({
          url: '/openapi.json',
          dom_id: '#swagger-ui',
          deepLinking: true,
          tryItOutEnabled: true,
          persistAuthorization: true,
        });
      });
    </script>
  </body>
</html>`;

export function GET() {
  return new Response(HTML, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
