/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

export function getLudwittErrorMessage(code: string | null): string {
  switch (code) {
    case "missing_params":
      return "Ludwitt sign-in was incomplete. Please try again.";
    case "invalid_state":
      return "Ludwitt sign-in expired before you finished. Please try again.";
    case "not_configured":
      return "Ludwitt sign-in isn't set up on this site yet.";
    case "token_failed":
      return "Couldn't reach Ludwitt to finish signing you in. Please try again.";
    case "userinfo_failed":
      return "Ludwitt didn't return your account details. Please try again.";
    case "no_email":
      return "Your Ludwitt account doesn't have an email on file. Please add one and try again.";
    case "firebase_user_failed":
      return "We couldn't create your account on our side. Please try again.";
    case "token_persist_failed":
      return "We couldn't save your Ludwitt session. Please try again.";
    case "custom_token_failed":
      return "We couldn't establish your sign-in session. Please try again.";
    case "finalize_failed":
      return "Sign-in expired before it finished. Please try again.";
    case "access_denied":
      return "You declined the Ludwitt sign-in. No problem — try again whenever.";
    default:
      return "Ludwitt sign-in failed. Please try again.";
  }
}
