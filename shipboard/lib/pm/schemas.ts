import { z } from "zod";

export const joinWorkspaceSchema = z.object({
  inviteCode: z.string().min(1).max(200),
});

export const patchBoardSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  weekLabel: z.string().max(80).optional(),
  columnOrder: z.array(z.string()).optional(),
});

export const createColumnSchema = z.object({
  title: z.string().min(1).max(120),
});

export const patchColumnSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  position: z.number().int().min(0).optional(),
});

export const createCardSchema = z.object({
  columnId: z.string().min(1),
  title: z.string().min(1).max(300),
  description: z.string().max(20000).optional(),
  assigneeId: z.string().nullable().optional(),
  labelIds: z.array(z.string()).optional(),
});

export const patchCardSchema = z.object({
  columnId: z.string().optional(),
  title: z.string().min(1).max(300).optional(),
  description: z.string().max(20000).nullable().optional(),
  assigneeId: z.string().nullable().optional(),
  labelIds: z.array(z.string()).optional(),
  position: z.number().int().min(0).optional(),
});

export const layoutPatchSchema = z.object({
  cards: z.array(
    z.object({
      id: z.string(),
      columnId: z.string(),
      position: z.number().int().min(0),
    }),
  ),
});

export const createNoteSchema = z.object({
  body: z.string().min(1).max(20000),
});

export const patchScratchSchema = z.object({
  body: z.string().max(100000),
});
