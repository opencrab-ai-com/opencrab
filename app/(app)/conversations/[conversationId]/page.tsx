import { ConversationDetailScreen } from "@/components/conversation/conversation-detail-screen";

export default async function ConversationDetailPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = await params;

  return <ConversationDetailScreen conversationId={conversationId} />;
}
