/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { Cursor, CursorAgentError } from "@cursor/sdk";

export interface CursorAccountInfo {
  modelsAvailable: string[];
  defaultModel?: string;
}

export class InvalidCursorKeyError extends Error {
  constructor(message = "Invalid Cursor API key") {
    super(message);
    this.name = "InvalidCursorKeyError";
  }
}

export async function validateCursorApiKey(
  apiKey: string
): Promise<CursorAccountInfo> {
  try {
    const models = await Cursor.models.list({ apiKey });
    const modelsAvailable = models.map((model) => model.id);

    return {
      modelsAvailable,
      defaultModel:
        models.find((model) => model.id === "composer-2")?.id ??
        modelsAvailable[0],
    };
  } catch (error) {
    if (error instanceof CursorAgentError) {
      throw new InvalidCursorKeyError(error.message);
    }
    throw new InvalidCursorKeyError();
  }
}
