import { Composer } from "@/components/composer/composer";
import { ConversationThread } from "@/components/conversation/conversation-thread";

export default async function ConversationDetailPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = await params;

  return (
    <div className="flex min-h-screen flex-col lg:h-full lg:min-h-0">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <ConversationThread conversationId={conversationId} />
      </div>
      <div className="shrink-0 border-t border-line bg-background px-4 py-4 lg:px-6">
        <div className="w-full max-w-[1180px]">
          <Composer />
        </div>
      </div>
    </div>
  );
}
