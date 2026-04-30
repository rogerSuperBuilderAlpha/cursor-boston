/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { FieldValue, Firestore } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { matchesQuestionSearchTerms } from "./search";
import type {
  Question,
  Answer,
  QuestionTag,
  QuestionSort,
  VoteType,
  VoteResult,
} from "@/types/questions";
import { QUESTION_TAGS } from "@/types/questions";
import type { CookbookEntry } from "@/types/cookbook";

const COLLECTIONS = {
  QUESTIONS: "questions",
  QUESTION_VOTES: "question_votes",
  ANSWER_VOTES: "answer_votes",
  COOKBOOK_ENTRIES: "cookbook_entries",
} as const;

const ANSWERS_SUBCOLLECTION = "answers";

const SEARCH_SCAN_BATCH = 40;
const MAX_SEARCH_SCAN = 30;
const DEFAULT_LIMIT = 20;

export class QuestionNotFoundError extends Error {
  constructor() { super("Question not found"); this.name = "QuestionNotFoundError"; }
}
export class AnswerNotFoundError extends Error {
  constructor() { super("Answer not found"); this.name = "AnswerNotFoundError"; }
}
export class UnauthorizedError extends Error {
  constructor(msg = "Unauthorized") { super(msg); this.name = "UnauthorizedError"; }
}

function questionVoteDocId(targetId: string, userId: string) {
  return `${targetId}_${userId}`;
}

function toQuestion(id: string, data: FirebaseFirestore.DocumentData): Question {
  return {
    id,
    title: data.title ?? "",
    body: data.body ?? "",
    tags: data.tags ?? [],
    authorId: data.authorId ?? "",
    authorName: data.authorName ?? "",
    authorPhoto: data.authorPhoto ?? null,
    createdAt: data.createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
    updatedAt: data.updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
    upCount: Number(data.upCount ?? 0),
    downCount: Number(data.downCount ?? 0),
    netScore: Number(data.netScore ?? 0),
    answerCount: Number(data.answerCount ?? 0),
  };
}

function toAnswer(id: string, questionId: string, data: FirebaseFirestore.DocumentData): Answer {
  return {
    id,
    questionId,
    body: data.body ?? "",
    authorId: data.authorId ?? "",
    authorName: data.authorName ?? "",
    authorPhoto: data.authorPhoto ?? null,
    createdAt: data.createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
    updatedAt: data.updatedAt?.toDate?.().toISOString() ?? new Date().toISOString(),
    upCount: Number(data.upCount ?? 0),
    downCount: Number(data.downCount ?? 0),
    netScore: Number(data.netScore ?? 0),
    isAccepted: Boolean(data.isAccepted),
  };
}

export class QuestionsService {
  private db: Firestore;

  constructor(db?: Firestore) {
    if (db) {
      this.db = db;
    } else {
      const adminDb = getAdminDb();
      if (!adminDb) throw new Error("Firebase Admin not initialized");
      this.db = adminDb;
    }
  }

  // ─── Questions CRUD ──────────────────────────────────────────────────────────

  async createQuestion(
    userId: string,
    userName: string,
    userPhoto: string | null,
    data: { title: string; body: string; tags: QuestionTag[] }
  ): Promise<string> {
    const validTags = data.tags.filter(
      (t): t is QuestionTag => (QUESTION_TAGS as readonly string[]).includes(t)
    ).slice(0, 10);

    const docRef = await this.db.collection(COLLECTIONS.QUESTIONS).add({
      title: data.title,
      body: data.body,
      tags: validTags,
      authorId: userId,
      authorName: userName,
      authorPhoto: userPhoto,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      upCount: 0,
      downCount: 0,
      netScore: 0,
      answerCount: 0,
    });
    return docRef.id;
  }

  async getQuestion(questionId: string): Promise<Question | null> {
    const snap = await this.db.collection(COLLECTIONS.QUESTIONS).doc(questionId).get();
    if (!snap.exists) return null;
    return toQuestion(snap.id, snap.data()!);
  }

  async listQuestions(opts: {
    sort?: QuestionSort;
    tag?: string;
    search?: string;
    limit?: number;
    cursor?: string;
  }): Promise<{ questions: Question[]; nextCursor: string | null }> {
    const sort = opts.sort ?? "newest";
    const limit = opts.limit ?? DEFAULT_LIMIT;
    const searchRaw = opts.search?.trim().toLowerCase() ?? "";
    const hasSearch = searchRaw.length > 0;
    const searchTerms = hasSearch ? searchRaw.split(/\s+/).filter(Boolean) : [];

    if (hasSearch) {
      return this.searchQuestions(searchTerms, opts.tag, limit, opts.cursor);
    }

    let query: FirebaseFirestore.Query = this.db.collection(COLLECTIONS.QUESTIONS);

    if (opts.tag && (QUESTION_TAGS as readonly string[]).includes(opts.tag)) {
      query = query.where("tags", "array-contains", opts.tag);
    }

    if (sort === "top") {
      query = query.orderBy("netScore", "desc").orderBy("createdAt", "desc");
    } else if (sort === "unanswered") {
      query = query.where("answerCount", "==", 0).orderBy("createdAt", "desc");
    } else {
      query = query.orderBy("createdAt", "desc");
    }

    if (opts.cursor) {
      const cursorSnap = await this.db.collection(COLLECTIONS.QUESTIONS).doc(opts.cursor).get();
      if (cursorSnap.exists) {
        query = query.startAfter(cursorSnap);
      }
    }

    query = query.limit(limit + 1);
    const snapshot = await query.get();
    const docs = snapshot.docs;
    const hasMore = docs.length > limit;
    const resultDocs = hasMore ? docs.slice(0, limit) : docs;

    return {
      questions: resultDocs.map((d) => toQuestion(d.id, d.data())),
      nextCursor: hasMore ? resultDocs[resultDocs.length - 1].id : null,
    };
  }

  private async searchQuestions(
    searchTerms: string[],
    tag: string | undefined,
    limit: number,
    cursor: string | undefined
  ): Promise<{ questions: Question[]; nextCursor: string | null }> {
    let baseQuery: FirebaseFirestore.Query = this.db.collection(COLLECTIONS.QUESTIONS);

    if (tag && (QUESTION_TAGS as readonly string[]).includes(tag)) {
      baseQuery = baseQuery.where("tags", "array-contains", tag);
    }

    baseQuery = baseQuery.orderBy("createdAt", "desc");

    if (cursor) {
      const cursorSnap = await this.db.collection(COLLECTIONS.QUESTIONS).doc(cursor).get();
      if (cursorSnap.exists) {
        baseQuery = baseQuery.startAfter(cursorSnap);
      }
    }

    const results: Question[] = [];
    let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;
    let scans = 0;

    while (results.length < limit && scans < MAX_SEARCH_SCAN) {
      scans++;
      let scanQuery = baseQuery.limit(SEARCH_SCAN_BATCH);
      if (lastDoc) {
        scanQuery = scanQuery.startAfter(lastDoc);
      }
      const batch = await scanQuery.get();
      if (batch.empty) break;

      for (const doc of batch.docs) {
        const d = doc.data();
        if (matchesQuestionSearchTerms(d.title ?? "", d.body ?? "", d.tags ?? [], searchTerms)) {
          results.push(toQuestion(doc.id, d));
          if (results.length >= limit + 1) break;
        }
      }
      lastDoc = batch.docs[batch.docs.length - 1];
      if (batch.docs.length < SEARCH_SCAN_BATCH) break;
    }

    const hasMore = results.length > limit;
    const trimmed = hasMore ? results.slice(0, limit) : results;

    return {
      questions: trimmed,
      nextCursor: hasMore ? trimmed[trimmed.length - 1].id : null,
    };
  }

  // ─── Answers CRUD ─────────────────────────────────────────────────────────────

  async createAnswer(
    questionId: string,
    userId: string,
    userName: string,
    userPhoto: string | null,
    body: string
  ): Promise<string> {
    const questionRef = this.db.collection(COLLECTIONS.QUESTIONS).doc(questionId);

    const answerId = await this.db.runTransaction(async (tx) => {
      const qSnap = await tx.get(questionRef);
      if (!qSnap.exists) throw new QuestionNotFoundError();

      const answerRef = questionRef.collection(ANSWERS_SUBCOLLECTION).doc();
      tx.set(answerRef, {
        body,
        authorId: userId,
        authorName: userName,
        authorPhoto: userPhoto,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        upCount: 0,
        downCount: 0,
        netScore: 0,
        isAccepted: false,
      });

      tx.update(questionRef, {
        answerCount: (Number(qSnap.data()?.answerCount) || 0) + 1,
        updatedAt: FieldValue.serverTimestamp(),
      });

      return answerRef.id;
    });

    return answerId;
  }

  async getAnswersForQuestion(
    questionId: string,
    sort: "top" | "newest" = "top"
  ): Promise<Answer[]> {
    let query: FirebaseFirestore.Query = this.db
      .collection(COLLECTIONS.QUESTIONS)
      .doc(questionId)
      .collection(ANSWERS_SUBCOLLECTION);

    if (sort === "top") {
      query = query.orderBy("netScore", "desc").orderBy("createdAt", "desc");
    } else {
      query = query.orderBy("createdAt", "desc");
    }

    const snapshot = await query.get();
    const answers = snapshot.docs.map((d) => toAnswer(d.id, questionId, d.data()));

    // Pin accepted answer to top
    const accepted = answers.filter((a) => a.isAccepted);
    const rest = answers.filter((a) => !a.isAccepted);
    return [...accepted, ...rest];
  }

  async acceptAnswer(questionId: string, answerId: string, userId: string): Promise<void> {
    const questionRef = this.db.collection(COLLECTIONS.QUESTIONS).doc(questionId);

    await this.db.runTransaction(async (tx) => {
      const qSnap = await tx.get(questionRef);
      if (!qSnap.exists) throw new QuestionNotFoundError();
      if (qSnap.data()?.authorId !== userId) {
        throw new UnauthorizedError("Only the question author can accept an answer");
      }

      const answerRef = questionRef.collection(ANSWERS_SUBCOLLECTION).doc(answerId);
      const aSnap = await tx.get(answerRef);
      if (!aSnap.exists) throw new AnswerNotFoundError();

      // Unaccept any previously accepted answer (must read through tx)
      const prevAccepted = await tx.get(
        questionRef
          .collection(ANSWERS_SUBCOLLECTION)
          .where("isAccepted", "==", true)
      );

      for (const doc of prevAccepted.docs) {
        if (doc.id !== answerId) {
          tx.update(doc.ref, { isAccepted: false });
        }
      }

      const isAlreadyAccepted = aSnap.data()?.isAccepted === true;
      tx.update(answerRef, { isAccepted: !isAlreadyAccepted });
    });
  }

  // ─── Voting ───────────────────────────────────────────────────────────────────

  async vote(
    targetType: "question" | "answer",
    targetId: string,
    userId: string,
    voteType: VoteType,
    questionId?: string
  ): Promise<VoteResult> {
    const voteCollection =
      targetType === "question" ? COLLECTIONS.QUESTION_VOTES : COLLECTIONS.ANSWER_VOTES;

    const targetRef =
      targetType === "question"
        ? this.db.collection(COLLECTIONS.QUESTIONS).doc(targetId)
        : this.db
            .collection(COLLECTIONS.QUESTIONS)
            .doc(questionId!)
            .collection(ANSWERS_SUBCOLLECTION)
            .doc(targetId);

    const voteRef = this.db
      .collection(voteCollection)
      .doc(questionVoteDocId(targetId, userId));

    return this.db.runTransaction(async (tx) => {
      const [targetSnap, voteSnap] = await Promise.all([
        tx.get(targetRef),
        tx.get(voteRef),
      ]);

      if (!targetSnap.exists) {
        throw targetType === "question"
          ? new QuestionNotFoundError()
          : new AnswerNotFoundError();
      }

      const targetData = targetSnap.data()!;
      const upCount = Number(targetData.upCount ?? 0);
      const downCount = Number(targetData.downCount ?? 0);

      if (voteSnap.exists) {
        const existingType = voteSnap.data()?.type as VoteType | undefined;

        if (existingType === voteType) {
          // Toggle off
          tx.delete(voteRef);
          const nextUp = voteType === "up" ? Math.max(0, upCount - 1) : upCount;
          const nextDown = voteType === "down" ? Math.max(0, downCount - 1) : downCount;
          tx.update(targetRef, {
            upCount: nextUp,
            downCount: nextDown,
            netScore: nextUp - nextDown,
          });
          return { action: "removed" as const, type: voteType, upCount: nextUp, downCount: nextDown, netScore: nextUp - nextDown };
        }

        // Switch
        tx.update(voteRef, { type: voteType, updatedAt: FieldValue.serverTimestamp() });
        const nextUp = (existingType === "up" ? Math.max(0, upCount - 1) : upCount) + (voteType === "up" ? 1 : 0);
        const nextDown = (existingType === "down" ? Math.max(0, downCount - 1) : downCount) + (voteType === "down" ? 1 : 0);
        tx.update(targetRef, {
          upCount: nextUp,
          downCount: nextDown,
          netScore: nextUp - nextDown,
        });
        return { action: "switched" as const, type: voteType, previousType: existingType, upCount: nextUp, downCount: nextDown, netScore: nextUp - nextDown };
      }

      // New vote
      tx.set(voteRef, {
        targetId,
        userId,
        type: voteType,
        createdAt: FieldValue.serverTimestamp(),
      });
      const nextUp = voteType === "up" ? upCount + 1 : upCount;
      const nextDown = voteType === "down" ? downCount + 1 : downCount;
      tx.update(targetRef, {
        upCount: nextUp,
        downCount: nextDown,
        netScore: nextUp - nextDown,
      });
      return { action: "added" as const, type: voteType, upCount: nextUp, downCount: nextDown, netScore: nextUp - nextDown };
    });
  }

  async getUserVotes(userId: string): Promise<Record<string, VoteType>> {
    const [qVotes, aVotes] = await Promise.all([
      this.db.collection(COLLECTIONS.QUESTION_VOTES).where("userId", "==", userId).get(),
      this.db.collection(COLLECTIONS.ANSWER_VOTES).where("userId", "==", userId).get(),
    ]);

    const result: Record<string, VoteType> = {};
    for (const doc of qVotes.docs) {
      const data = doc.data();
      result[data.targetId] = data.type;
    }
    for (const doc of aVotes.docs) {
      const data = doc.data();
      result[data.targetId] = data.type;
    }
    return result;
  }

  // ─── Tag-based cookbook linking ────────────────────────────────────────────────

  async getRelatedCookbookEntries(tags: string[], limit = 5): Promise<CookbookEntry[]> {
    if (tags.length === 0) return [];

    const queryTags = tags.slice(0, 10);
    const snapshot = await this.db
      .collection(COLLECTIONS.COOKBOOK_ENTRIES)
      .where("tags", "array-contains-any", queryTags)
      .orderBy("netScore", "desc")
      .limit(limit)
      .get();

    return snapshot.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        title: data.title ?? "",
        description: data.description ?? "",
        promptContent: data.promptContent ?? "",
        category: data.category ?? "other",
        tags: data.tags ?? [],
        worksWith: data.worksWith ?? [],
        authorId: data.authorId ?? "",
        authorDisplayName: data.authorDisplayName ?? "",
        createdAt: data.createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
        upCount: Number(data.upCount ?? 0),
        downCount: Number(data.downCount ?? 0),
      } as CookbookEntry;
    });
  }
}

let _instance: QuestionsService | null = null;

export function getQuestionsService(): QuestionsService {
  if (!_instance) {
    _instance = new QuestionsService();
  }
  return _instance;
}
