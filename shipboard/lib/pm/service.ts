import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { getAdminAuth } from "@/lib/firebase-admin";
import { COLLECTIONS, DEFAULT_BOARD_ID, DEFAULT_WORKSPACE_ID } from "@/lib/pm/constants";
import type {
  Board,
  BoardFullPayload,
  Card,
  Column,
  Label,
  MemberPreview,
  NoteEntry,
  ScratchDoc,
  Workspace,
} from "@/lib/pm/types";

function ts(data: FirebaseFirestore.Timestamp | { toDate?: () => Date } | undefined): string {
  if (!data) return new Date().toISOString();
  const maybeTs = data as { toDate?: () => Date };
  if (typeof maybeTs.toDate === "function") {
    return maybeTs.toDate().toISOString();
  }
  return new Date().toISOString();
}

export async function getWorkspace(db: Firestore, workspaceId: string): Promise<Workspace | null> {
  const snap = await db.collection(COLLECTIONS.WORKSPACES).doc(workspaceId).get();
  if (!snap.exists) return null;
  const d = snap.data()!;
  return {
    id: snap.id,
    name: d.name ?? "",
    slug: d.slug ?? "",
    memberIds: Array.isArray(d.memberIds) ? d.memberIds : [],
    createdBy: d.createdBy ?? "",
    createdAt: ts(d.createdAt),
    defaultBoardId: d.defaultBoardId,
  };
}

export async function assertWorkspaceMember(
  db: Firestore,
  workspaceId: string,
  uid: string,
): Promise<Workspace> {
  const ws = await getWorkspace(db, workspaceId);
  if (!ws) throw new Error("Workspace not found");
  if (!ws.memberIds.includes(uid)) throw new Error("Forbidden");
  return ws;
}

export async function getBoard(db: Firestore, boardId: string): Promise<Board | null> {
  const snap = await db.collection(COLLECTIONS.BOARDS).doc(boardId).get();
  if (!snap.exists) return null;
  const d = snap.data()!;
  return {
    id: snap.id,
    workspaceId: d.workspaceId ?? "",
    title: d.title ?? "",
    weekLabel: d.weekLabel ?? "",
    columnOrder: Array.isArray(d.columnOrder) ? d.columnOrder : [],
    createdAt: ts(d.createdAt),
    updatedAt: ts(d.updatedAt),
  };
}

export async function assertBoardAccess(db: Firestore, boardId: string, uid: string): Promise<Board> {
  const board = await getBoard(db, boardId);
  if (!board) throw new Error("Board not found");
  await assertWorkspaceMember(db, board.workspaceId, uid);
  return board;
}

export async function listLabels(db: Firestore, workspaceId: string): Promise<Label[]> {
  const snap = await db
    .collection(COLLECTIONS.WORKSPACES)
    .doc(workspaceId)
    .collection(COLLECTIONS.LABELS)
    .get();
  const labels = snap.docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      name: d.name ?? "",
      color: d.color ?? "#71717a",
    };
  });
  labels.sort((a, b) => a.name.localeCompare(b.name));
  return labels;
}

export async function loadMemberPreviews(memberIds: string[]): Promise<MemberPreview[]> {
  const auth = getAdminAuth();
  const out: MemberPreview[] = [];
  for (const uid of memberIds) {
    try {
      const u = auth ? await auth.getUser(uid) : null;
      out.push({
        uid,
        displayName: u?.displayName ?? u?.email ?? uid,
        photoUrl: u?.photoURL ?? null,
      });
    } catch {
      out.push({ uid, displayName: uid, photoUrl: null });
    }
  }
  return out;
}

export async function getBoardFull(db: Firestore, boardId: string, uid: string): Promise<BoardFullPayload> {
  const board = await assertBoardAccess(db, boardId, uid);
  const workspace = await getWorkspace(db, board.workspaceId);
  if (!workspace) throw new Error("Workspace missing");

  const labels = await listLabels(db, board.workspaceId);

  const colSnap = await db
    .collection(COLLECTIONS.BOARDS)
    .doc(boardId)
    .collection(COLLECTIONS.COLUMNS)
    .get();

  const colMap = new Map<string, Column>();
  for (const doc of colSnap.docs) {
    const d = doc.data();
    colMap.set(doc.id, {
      id: doc.id,
      title: d.title ?? "",
      position: Number(d.position ?? 0),
    });
  }

  const columns: Column[] = board.columnOrder
    .map((id) => colMap.get(id))
    .filter((c): c is Column => Boolean(c));
  for (const c of colMap.values()) {
    if (!columns.find((x) => x.id === c.id)) {
      columns.push(c);
    }
  }
  columns.sort((a, b) => a.position - b.position);

  const cardSnap = await db
    .collection(COLLECTIONS.BOARDS)
    .doc(boardId)
    .collection(COLLECTIONS.CARDS)
    .get();

  const cards: Card[] = cardSnap.docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      columnId: d.columnId ?? "",
      title: d.title ?? "",
      description: d.description ?? null,
      assigneeId: d.assigneeId ?? null,
      labelIds: Array.isArray(d.labelIds) ? d.labelIds : [],
      position: Number(d.position ?? 0),
      createdBy: d.createdBy ?? "",
      createdAt: ts(d.createdAt),
      updatedAt: ts(d.updatedAt),
    };
  });

  const members = await loadMemberPreviews(workspace.memberIds);

  const scratchSnap = await db.collection(COLLECTIONS.SCRATCH).doc(boardId).get();
  const sd = scratchSnap.data();
  const scratch: ScratchDoc = {
    body: typeof sd?.body === "string" ? sd.body : "",
    updatedBy: sd?.updatedBy ?? null,
    updatedAt: sd?.updatedAt ? ts(sd.updatedAt) : null,
  };

  return { board, columns, cards, labels, members, scratch };
}

export async function listWorkspacesForUser(db: Firestore, uid: string): Promise<Workspace[]> {
  const snap = await db
    .collection(COLLECTIONS.WORKSPACES)
    .where("memberIds", "array-contains", uid)
    .get();
  return snap.docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      name: d.name ?? "",
      slug: d.slug ?? "",
      memberIds: Array.isArray(d.memberIds) ? d.memberIds : [],
      createdBy: d.createdBy ?? "",
      createdAt: ts(d.createdAt),
      defaultBoardId: d.defaultBoardId,
    };
  });
}

export async function joinWorkspaceWithInvite(
  db: Firestore,
  uid: string,
  inviteCode: string,
  expectedCode: string,
): Promise<{ workspaceId: string; boardId: string }> {
  if (inviteCode.trim() !== expectedCode.trim()) {
    throw new Error("Invalid invite code");
  }
  const ref = db.collection(COLLECTIONS.WORKSPACES).doc(DEFAULT_WORKSPACE_ID);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      throw new Error("Workspace not seeded — run npm run seed");
    }
    const d = snap.data()!;
    const memberIds: string[] = Array.isArray(d.memberIds) ? [...d.memberIds] : [];
    if (!memberIds.includes(uid)) {
      memberIds.push(uid);
      tx.update(ref, { memberIds, updatedAt: FieldValue.serverTimestamp() });
    }
  });
  return { workspaceId: DEFAULT_WORKSPACE_ID, boardId: DEFAULT_BOARD_ID };
}

export async function listNotes(
  db: Firestore,
  boardId: string,
  uid: string,
  limit = 100,
): Promise<NoteEntry[]> {
  await assertBoardAccess(db, boardId, uid);
  const snap = await db
    .collection(COLLECTIONS.BOARDS)
    .doc(boardId)
    .collection(COLLECTIONS.NOTE_ENTRIES)
    .limit(500)
    .get();

  const entries = snap.docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      body: d.body ?? "",
      authorId: d.authorId ?? "",
      authorName: d.authorName ?? "",
      authorPhoto: d.authorPhoto ?? null,
      createdAt: ts(d.createdAt),
    };
  });
  entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return entries.slice(0, limit);
}

export async function appendNote(
  db: Firestore,
  boardId: string,
  uid: string,
  body: string,
  authorName: string,
  authorPhoto: string | null,
): Promise<NoteEntry> {
  await assertBoardAccess(db, boardId, uid);
  const ref = db
    .collection(COLLECTIONS.BOARDS)
    .doc(boardId)
    .collection(COLLECTIONS.NOTE_ENTRIES)
    .doc();
  const now = FieldValue.serverTimestamp();
  await ref.set({
    body,
    authorId: uid,
    authorName,
    authorPhoto,
    createdAt: now,
  });
  const snap = await ref.get();
  const d = snap.data()!;
  return {
    id: ref.id,
    body: d.body ?? "",
    authorId: d.authorId ?? "",
    authorName: d.authorName ?? "",
    authorPhoto: d.authorPhoto ?? null,
    createdAt: ts(d.createdAt),
  };
}

export async function patchScratch(
  db: Firestore,
  boardId: string,
  uid: string,
  body: string,
): Promise<ScratchDoc> {
  await assertBoardAccess(db, boardId, uid);
  const ref = db.collection(COLLECTIONS.SCRATCH).doc(boardId);
  await ref.set(
    {
      body,
      updatedBy: uid,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  const snap = await ref.get();
  const d = snap.data()!;
  return {
    body: d.body ?? "",
    updatedBy: d.updatedBy ?? null,
    updatedAt: ts(d.updatedAt),
  };
}

export async function updateBoardMeta(
  db: Firestore,
  boardId: string,
  uid: string,
  patch: { title?: string; weekLabel?: string; columnOrder?: string[] },
): Promise<Board> {
  await assertBoardAccess(db, boardId, uid);
  const ref = db.collection(COLLECTIONS.BOARDS).doc(boardId);
  await ref.update({
    ...patch,
    updatedAt: FieldValue.serverTimestamp(),
  });
  const next = await getBoard(db, boardId);
  if (!next) throw new Error("Board missing after update");
  return next;
}

export async function createColumnSvc(
  db: Firestore,
  boardId: string,
  uid: string,
  title: string,
): Promise<Column> {
  const board = await assertBoardAccess(db, boardId, uid);
  const cols = await db
    .collection(COLLECTIONS.BOARDS)
    .doc(boardId)
    .collection(COLLECTIONS.COLUMNS)
    .get();
  const maxPos = cols.docs.reduce((m, d) => Math.max(m, Number(d.data().position ?? 0)), -1);
  const colRef = db.collection(COLLECTIONS.BOARDS).doc(boardId).collection(COLLECTIONS.COLUMNS).doc();
  const position = maxPos + 1;
  await colRef.set({
    title,
    position,
    createdAt: FieldValue.serverTimestamp(),
  });
  const newOrder = [...board.columnOrder, colRef.id];
  await db.collection(COLLECTIONS.BOARDS).doc(boardId).update({
    columnOrder: newOrder,
    updatedAt: FieldValue.serverTimestamp(),
  });
  return { id: colRef.id, title, position };
}

export async function patchColumnSvc(
  db: Firestore,
  boardId: string,
  columnId: string,
  uid: string,
  patch: { title?: string; position?: number },
): Promise<void> {
  await assertBoardAccess(db, boardId, uid);
  const ref = db
    .collection(COLLECTIONS.BOARDS)
    .doc(boardId)
    .collection(COLLECTIONS.COLUMNS)
    .doc(columnId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("Column not found");
  await ref.update({ ...patch, updatedAt: FieldValue.serverTimestamp() });
}

export async function deleteColumnSvc(
  db: Firestore,
  boardId: string,
  columnId: string,
  uid: string,
): Promise<void> {
  const board = await assertBoardAccess(db, boardId, uid);
  const targetRef = db
    .collection(COLLECTIONS.BOARDS)
    .doc(boardId)
    .collection(COLLECTIONS.COLUMNS)
    .doc(columnId);
  const targetSnap = await targetRef.get();
  if (!targetSnap.exists) throw new Error("Column not found");

  const backlogId = board.columnOrder[0];
  if (!backlogId || backlogId === columnId) {
    throw new Error("Cannot delete the only column");
  }

  const allCards = await db
    .collection(COLLECTIONS.BOARDS)
    .doc(boardId)
    .collection(COLLECTIONS.CARDS)
    .get();
  const cardSnap = { docs: allCards.docs.filter((d) => d.data().columnId === columnId) };

  const batch = db.batch();
  let i = 0;
  for (const doc of cardSnap.docs) {
    batch.update(doc.ref, {
      columnId: backlogId,
      position: i++,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
  batch.delete(targetRef);
  const newOrder = board.columnOrder.filter((id) => id !== columnId);
  batch.update(db.collection(COLLECTIONS.BOARDS).doc(boardId), {
    columnOrder: newOrder,
    updatedAt: FieldValue.serverTimestamp(),
  });
  await batch.commit();
}

export async function createCardSvc(
  db: Firestore,
  boardId: string,
  uid: string,
  input: {
    columnId: string;
    title: string;
    description?: string;
    assigneeId?: string | null;
    labelIds?: string[];
  },
): Promise<Card> {
  await assertBoardAccess(db, boardId, uid);
  const colRef = db
    .collection(COLLECTIONS.BOARDS)
    .doc(boardId)
    .collection(COLLECTIONS.COLUMNS)
    .doc(input.columnId);
  const colSnap = await colRef.get();
  if (!colSnap.exists) throw new Error("Column not found");

  const all = await db
    .collection(COLLECTIONS.BOARDS)
    .doc(boardId)
    .collection(COLLECTIONS.CARDS)
    .get();
  const inCol = all.docs.filter((d) => d.data().columnId === input.columnId);
  const maxPos = inCol.reduce((m, d) => Math.max(m, Number(d.data().position ?? 0)), -1);

  const ref = db.collection(COLLECTIONS.BOARDS).doc(boardId).collection(COLLECTIONS.CARDS).doc();
  const now = FieldValue.serverTimestamp();
  await ref.set({
    columnId: input.columnId,
    title: input.title,
    description: input.description ?? null,
    assigneeId: input.assigneeId ?? null,
    labelIds: input.labelIds ?? [],
    position: maxPos + 1,
    createdBy: uid,
    createdAt: now,
    updatedAt: now,
  });
  const snap = await ref.get();
  const d = snap.data()!;
  return {
    id: ref.id,
    columnId: d.columnId ?? "",
    title: d.title ?? "",
    description: d.description ?? null,
    assigneeId: d.assigneeId ?? null,
    labelIds: Array.isArray(d.labelIds) ? d.labelIds : [],
    position: Number(d.position ?? 0),
    createdBy: d.createdBy ?? "",
    createdAt: ts(d.createdAt),
    updatedAt: ts(d.updatedAt),
  };
}

export async function patchCardSvc(
  db: Firestore,
  boardId: string,
  cardId: string,
  uid: string,
  patch: {
    columnId?: string;
    title?: string;
    description?: string | null;
    assigneeId?: string | null;
    labelIds?: string[];
    position?: number;
  },
): Promise<Card> {
  await assertBoardAccess(db, boardId, uid);
  const ref = db.collection(COLLECTIONS.BOARDS).doc(boardId).collection(COLLECTIONS.CARDS).doc(cardId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("Card not found");
  if (patch.columnId) {
    const c = await db
      .collection(COLLECTIONS.BOARDS)
      .doc(boardId)
      .collection(COLLECTIONS.COLUMNS)
      .doc(patch.columnId)
      .get();
    if (!c.exists) throw new Error("Column not found");
  }
  await ref.update({
    ...patch,
    updatedAt: FieldValue.serverTimestamp(),
  });
  const next = await ref.get();
  const d = next.data()!;
  return {
    id: ref.id,
    columnId: d.columnId ?? "",
    title: d.title ?? "",
    description: d.description ?? null,
    assigneeId: d.assigneeId ?? null,
    labelIds: Array.isArray(d.labelIds) ? d.labelIds : [],
    position: Number(d.position ?? 0),
    createdBy: d.createdBy ?? "",
    createdAt: ts(d.createdAt),
    updatedAt: ts(d.updatedAt),
  };
}

export async function deleteCardSvc(db: Firestore, boardId: string, cardId: string, uid: string): Promise<void> {
  await assertBoardAccess(db, boardId, uid);
  const ref = db.collection(COLLECTIONS.BOARDS).doc(boardId).collection(COLLECTIONS.CARDS).doc(cardId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("Card not found");
  await ref.delete();
}

export async function applyLayoutSvc(
  db: Firestore,
  boardId: string,
  uid: string,
  updates: { id: string; columnId: string; position: number }[],
): Promise<void> {
  await assertBoardAccess(db, boardId, uid);
  const boardRef = db.collection(COLLECTIONS.BOARDS).doc(boardId);
  const colIds = new Set((await boardRef.collection(COLLECTIONS.COLUMNS).get()).docs.map((d) => d.id));
  const cardRefs = await boardRef.collection(COLLECTIONS.CARDS).get();
  const validIds = new Set(cardRefs.docs.map((d) => d.id));

  for (const u of updates) {
    if (!validIds.has(u.id)) throw new Error(`Unknown card: ${u.id}`);
    if (!colIds.has(u.columnId)) throw new Error(`Unknown column: ${u.columnId}`);
  }

  const batch = db.batch();
  for (const u of updates) {
    batch.update(boardRef.collection(COLLECTIONS.CARDS).doc(u.id), {
      columnId: u.columnId,
      position: u.position,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
  batch.update(boardRef, { updatedAt: FieldValue.serverTimestamp() });
  await batch.commit();
}
