/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { redirect } from "next/navigation";

// Registration closed May 12 and the door list is now locked. The
// previous client-side form is no longer relevant; anyone hitting this
// URL — whether from Luma, an old email link, or a bookmark — should
// land on the gated event hub. The PyDataAccessGate on the hub page
// handles approved vs non-approved downstream (non-approved are sent
// to /events?pydataLocked=1).
export default function PyDataRegisterRedirect(): never {
  redirect("/events/cursor-boston-pydata-2026");
}
