export interface Workspace {
  id: string;
  name: string;
  slug: string;
  memberIds: string[];
  createdBy: string;
  createdAt: string;
  defaultBoardId?: string;
}

export interface Label {
  id: string;
  name: string;
  color: string;
}

export interface Board {
  id: string;
  workspaceId: string;
  title: string;
  weekLabel: string;
  columnOrder: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Column {
  id: string;
  title: string;
  position: number;
}

export interface Card {
  id: string;
  columnId: string;
  title: string;
  description: string | null;
  assigneeId: string | null;
  labelIds: string[];
  position: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface NoteEntry {
  id: string;
  body: string;
  authorId: string;
  authorName: string;
  authorPhoto: string | null;
  createdAt: string;
}

export interface ScratchDoc {
  body: string;
  updatedBy: string | null;
  updatedAt: string | null;
}

export interface MemberPreview {
  uid: string;
  displayName: string | null;
  photoUrl: string | null;
}

export interface BoardFullPayload {
  board: Board;
  columns: Column[];
  cards: Card[];
  labels: Label[];
  members: MemberPreview[];
  scratch: ScratchDoc;
}
