import { BoardPageClient } from "./BoardPageClient";

export default async function BoardPage(props: { params: Promise<{ boardId: string }> }) {
  const { boardId } = await props.params;
  return <BoardPageClient boardId={boardId} />;
}
