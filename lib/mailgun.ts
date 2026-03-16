/**
 * Mailgun email sending - direct API, no Firebase extension.
 *
 * Required env vars:
 *   MAILGUN_API_KEY - your Mailgun API key (from Sending > Domain Settings > API keys)
 *   MAILGUN_DOMAIN  - sending domain (e.g. mg.cursorboston.com or sandbox-xxx.mailgun.org)
 *
 * Optional:
 *   MAILGUN_FROM   - default from address (default: noreply@MAILGUN_DOMAIN)
 *   MAILGUN_EU     - set to "true" for EU Mailgun region
 */

import FormData from "form-data";
import Mailgun from "mailgun.js";

let mailgunClient: ReturnType<Mailgun["client"]> | null = null;

function getMailgunClient() {
  if (mailgunClient) return mailgunClient;

  const apiKey = process.env.MAILGUN_API_KEY;
  const domain = process.env.MAILGUN_DOMAIN;

  if (!apiKey || !domain) {
    throw new Error("MAILGUN_API_KEY and MAILGUN_DOMAIN must be set");
  }

  const mailgun = new Mailgun(FormData);
  mailgunClient = mailgun.client({
    username: "api",
    key: apiKey,
    ...(process.env.MAILGUN_EU === "true" && { url: "https://api.eu.mailgun.net" }),
  });

  return mailgunClient;
}

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  from?: string;
}

export async function sendEmail(options: SendEmailOptions): Promise<void> {
  const domain = process.env.MAILGUN_DOMAIN;
  if (!domain) {
    throw new Error("MAILGUN_DOMAIN is not set");
  }

  const from = options.from || process.env.MAILGUN_FROM || `noreply@${domain}`;
  const to = Array.isArray(options.to) ? options.to : [options.to];
  const text = options.text ?? "";
  const html = options.html ?? "";
  if (!text && !html) {
    throw new Error("Either text or html is required for sendEmail");
  }

  const mg = getMailgunClient();

  await mg.messages.create(domain, {
    from,
    to,
    subject: options.subject,
    ...(text && { text }),
    ...(html && { html }),
  } as Parameters<typeof mg.messages.create>[1]);
}
