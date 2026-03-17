import { notFound } from "next/navigation";
import { ChannelActivityPanel } from "@/components/channels/channel-activity-panel";
import { ChannelChecklistItem } from "@/components/channels/channel-checklist-item";
import { ChannelCopyBlock } from "@/components/channels/channel-copy-block";
import { ChannelDetailActions } from "@/components/channels/channel-detail-actions";
import { ChannelSetupForm } from "@/components/channels/channel-setup-form";
import { ChannelStatusBadge } from "@/components/channels/channel-status-badge";
import { AppPage } from "@/components/ui/app-page";
import { PageHeader } from "@/components/ui/page-header";
import {
  ensureChannelStartupSync,
  ensureChannelWatchdog,
} from "@/lib/channels/channel-startup";
import { getChannelDetail, getPublicBaseUrl } from "@/lib/channels/channel-store";
import {
  buildFeishuStatusSummary,
  buildTelegramSetWebhookCommand,
  buildTelegramStatusSummary,
} from "@/lib/channels/channel-detail-copy";
import {
  getFeishuCredentialPreview,
  getTelegramBotTokenPreview,
  syncAllChannelConfigsFromSecrets,
} from "@/lib/channels/secret-store";
import type { ChannelId } from "@/lib/channels/types";

export const dynamic = "force-dynamic";

export default async function ChannelDetailPage({
  params,
}: {
  params: Promise<{ channelId: string }>;
}) {
  const { channelId } = await params;

  if (channelId !== "telegram" && channelId !== "feishu") {
    notFound();
  }

  syncAllChannelConfigsFromSecrets();
  ensureChannelWatchdog();
  void ensureChannelStartupSync();

  const channel = getChannelDetail(channelId as ChannelId);
  const webhookTarget = channel.configSummary.webhookUrl || channel.configSummary.webhookPath;
  const publicBaseUrl = getPublicBaseUrl();
  const telegramSetWebhookCommand = buildTelegramSetWebhookCommand(channel, webhookTarget);
  const isTelegram = channel.id === "telegram";
  const telegramTokenPreview = isTelegram ? getTelegramBotTokenPreview() : null;
  const feishuCredentialPreview = isTelegram ? null : getFeishuCredentialPreview();

  return (
    <AppPage width="wide" contentClassName="space-y-8">
      <PageHeader
        title={channel.name}
        description={
          channel.id === "telegram"
            ? "填好 Bot Token 后，OpenCrab 会尽量自动帮你连上 Telegram。"
            : "飞书默认使用长连接接收事件，不需要公网 Webhook 地址。"
        }
      />

      {isTelegram ? (
        <div className="grid gap-6 xl:grid-cols-2">
          <section className="rounded-[28px] border border-line bg-[linear-gradient(135deg,#fffdf8_0%,#ffffff_58%,#f8f8f4_100%)] p-5 shadow-soft">
            <div className="max-w-[720px]">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-[16px] border border-line bg-white text-[16px] font-semibold text-text">
                  TG
                </div>
                <div>
                  <div className="text-[12px] text-muted">Bot 私聊入口</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <h2 className="text-[22px] font-semibold tracking-[-0.04em] text-text">
                      {channel.name}
                    </h2>
                    <ChannelStatusBadge channel={channel} />
                  </div>
                  {channel.configSummary.botUsername ? (
                    <div className="mt-1 text-[12px] text-muted">
                      当前 Bot：{channel.configSummary.botUsername}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 space-y-3">
                <p className="text-[15px] leading-7 text-muted-strong">
                  {buildTelegramStatusSummary(channel, publicBaseUrl)}
                </p>
                <div className="rounded-[18px] border border-line bg-white/80 px-4 py-4">
                  <div className="text-[13px] font-medium text-text">连接操作</div>
                  <div className="mt-2 text-[13px] leading-6 text-muted">
                    大多数情况下，你只需要保存 Bot Token。OpenCrab 会自动完成后面的连接步骤。
                  </div>
                  <ChannelDetailActions
                    channelId={channel.id}
                    webhookTarget={webhookTarget}
                    hasPublicBaseUrl={Boolean(publicBaseUrl)}
                    canRebind
                    canDisconnect={Boolean(channel.configSummary.hasBotToken)}
                  />
                </div>
              </div>
            </div>
          </section>

          <ChannelSetupForm
            channel={channel}
            telegramTokenPreview={telegramTokenPreview}
            feishuCredentialPreview={feishuCredentialPreview}
          />
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          <section className="rounded-[28px] border border-line bg-[linear-gradient(135deg,#fffdf8_0%,#ffffff_58%,#f8f8f4_100%)] p-5 shadow-soft">
            <div className="max-w-[720px]">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-[16px] border border-line bg-white text-[16px] font-semibold text-text">
                  FS
                </div>
                <div>
                  <div className="text-[12px] text-muted">企业协作入口</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <h2 className="text-[22px] font-semibold tracking-[-0.04em] text-text">
                      {channel.name}
                    </h2>
                    <ChannelStatusBadge channel={channel} />
                  </div>
                  {channel.configSummary.appId ? (
                    <div className="mt-1 text-[12px] text-muted">
                      当前 App：{channel.configSummary.appId}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 space-y-3">
                <p className="text-[15px] leading-7 text-muted-strong">
                  {buildFeishuStatusSummary(channel)}
                </p>
                <div className="rounded-[18px] border border-line bg-white/80 px-4 py-4">
                  <div className="text-[13px] font-medium text-text">连接操作</div>
                  <div className="mt-2 text-[13px] leading-6 text-muted">
                    飞书默认走长连接。保存 App ID 和 App Secret 后，OpenCrab 会自动校验凭证并启动 socket。
                  </div>
                  <ChannelDetailActions
                    channelId={channel.id}
                    webhookTarget={webhookTarget}
                    hasPublicBaseUrl={Boolean(publicBaseUrl)}
                    canRebind
                    canDisconnect={Boolean(channel.configSummary.hasAppId && channel.configSummary.hasAppSecret)}
                    showCopyButton={false}
                  />
                </div>
              </div>
            </div>
          </section>

          <ChannelSetupForm
            channel={channel}
            feishuCredentialPreview={feishuCredentialPreview}
          />
        </div>
      )}

      {isTelegram ? (
        <details className="rounded-[24px] border border-line bg-surface p-6 shadow-soft">
          <summary className="cursor-pointer list-none text-[15px] font-semibold text-text">
            遇到问题再展开
          </summary>
          <div className="mt-4 space-y-3">
            <ChannelChecklistItem
              title="当前连接状态"
              description={
                channel.configSummary.webhookConfigured
                  ? "Telegram 已连接到 OpenCrab。"
                  : channel.lastError || "还没有完成连接。"
              }
            />
            {channel.configSummary.lastWebhookError ? (
              <ChannelChecklistItem
                title="最近错误"
                description={channel.configSummary.lastWebhookError}
              />
            ) : null}
            <ChannelChecklistItem
              title="网络提醒"
              description="如果这台机器本身连不上 Telegram，OpenCrab 也无法替你收发消息。"
            />
          </div>
        </details>
      ) : (
        <section className="rounded-[24px] border border-line bg-surface p-6 shadow-soft">
          <h2 className="text-[17px] font-semibold tracking-[-0.03em] text-text">接入手册</h2>
          <p className="mt-2 text-[14px] leading-6 text-muted-strong">
            下面这些值就是去飞书开放平台时最常需要确认的内容，尽量减少来回切换和手工拼接。
          </p>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <ChannelCopyBlock label="接入方式" value="使用长连接接收事件（WebSocket）" />
            <ChannelCopyBlock
              label="事件类型"
              value="im.message.receive_v1"
            />
            <ChannelCopyBlock
              label="Verification Token"
              value={
                channel.configSummary.hasVerificationToken
                  ? "默认长连接模式不需要；如果你启用了兼容 Webhook 模式，请在飞书后台填入同一个 token。"
                  : "默认长连接模式不需要；只有兼容 Webhook 模式才需要配置。"
              }
            />
            <ChannelCopyBlock
              label="外部平台步骤"
              value="1. 在飞书开放平台创建应用并启用 Bot 能力\n2. 把 App ID / App Secret 填回 OpenCrab 并保存\n3. 在事件订阅里选择“使用长连接接收事件”\n4. 订阅 im.message.receive_v1\n5. 创建版本并发布应用"
            />
          </div>
        </section>
      )}

      {isTelegram ? (
        <details className="rounded-[24px] border border-line bg-surface p-6 shadow-soft">
          <summary className="cursor-pointer list-none text-[17px] font-semibold tracking-[-0.03em] text-text">
            高级信息
          </summary>
          <p className="mt-3 text-[14px] leading-6 text-muted-strong">
            只有在自动连接失败时，才需要看这些技术细节。
          </p>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <ChannelCopyBlock label="Webhook 地址" value={webhookTarget} tone="code" />
            <ChannelCopyBlock
              label="Webhook Secret"
              value={
                channel.configSummary.hasWebhookSecret
                  ? "已在 OpenCrab 中配置，请在 Telegram setWebhook 时使用相同 secret_token。"
                  : "当前未配置；如需额外校验 Telegram header，可在高级选项中设置。"
              }
            />
            <ChannelCopyBlock
              label="手动 setWebhook 命令"
              value={telegramSetWebhookCommand}
              tone="code"
            />
            <ChannelCopyBlock
              label="公网地址状态"
              value={publicBaseUrl || "当前还没有公网地址"}
              tone={publicBaseUrl ? "code" : "default"}
            />
          </div>
        </details>
      ) : (
        <details className="rounded-[24px] border border-line bg-surface p-6 shadow-soft">
          <summary className="cursor-pointer list-none text-[15px] font-semibold text-text">
            遇到问题再展开
          </summary>
          <div className="mt-4 space-y-3">
            <ChannelChecklistItem
              title="当前连接状态"
              description={
                channel.configSummary.socketConnected
                  ? `飞书长连接已连接${channel.configSummary.lastSocketConnectedAt ? `，最近启动时间是 ${channel.configSummary.lastSocketConnectedAt}` : "。"}`
                  : channel.lastError || "飞书还没有完成连接。"
              }
            />
            <ChannelChecklistItem
              title="平台提醒"
              description="在飞书开放平台里记得启用 Bot 能力、选择“使用长连接接收事件”、订阅 im.message.receive_v1，并完成应用发布。"
            />
            <ChannelChecklistItem
              title="兼容模式"
              description="如果你的环境暂时只能走 Webhook，OpenCrab 也保留了兼容入口，但默认不建议用它做首选方案。"
            />
            <div className="grid gap-4 lg:grid-cols-2">
              <ChannelCopyBlock label="兼容 Webhook 地址" value={webhookTarget} tone="code" />
              <ChannelCopyBlock
                label="Verification Token"
                value={
                  channel.configSummary.hasVerificationToken
                    ? "已在 OpenCrab 中配置；只有兼容 Webhook 模式时才需要在飞书后台填同一个 token。"
                    : "默认长连接模式不需要；只有兼容 Webhook 模式时才需要配置。"
                }
              />
              <ChannelCopyBlock
                label="Encrypt Key"
                value={
                  channel.configSummary.hasEncryptKey
                    ? "已在 OpenCrab 中配置；如果你启用了加密 Webhook，这里已经可以完成解密和签名校验。"
                    : "默认长连接模式不需要；如果你启用了加密 Webhook，还需要补上 Encrypt Key。"
                }
              />
              <ChannelCopyBlock
                label="最近状态"
                value={channel.lastError || "最近没有渠道错误。"}
              />
            </div>
          </div>
        </details>
      )}

      <ChannelActivityPanel channel={channel} />
    </AppPage>
  );
}
