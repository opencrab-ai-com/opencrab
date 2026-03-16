import Link from "next/link";
import { notFound } from "next/navigation";
import { ChannelCopyBlock } from "@/components/channels/channel-copy-block";
import { ChannelDetailActions } from "@/components/channels/channel-detail-actions";
import { ChannelSetupForm } from "@/components/channels/channel-setup-form";
import { AppPage } from "@/components/ui/app-page";
import { PageHeader } from "@/components/ui/page-header";
import { ensureChannelStartupSync } from "@/lib/channels/channel-startup";
import {
  getChannelDetail,
  getPublicBaseUrl,
  getChannelStatusLabel,
} from "@/lib/channels/channel-store";
import {
  getTelegramBotTokenPreview,
  syncAllChannelConfigsFromSecrets,
} from "@/lib/channels/secret-store";
import type { ChannelDetail, ChannelId } from "@/lib/channels/types";

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
  void ensureChannelStartupSync();

  const channel = getChannelDetail(channelId as ChannelId);
  const webhookTarget = channel.configSummary.webhookUrl || channel.configSummary.webhookPath;
  const publicBaseUrl = getPublicBaseUrl();
  const telegramSetWebhookCommand = buildTelegramSetWebhookCommand(channel, webhookTarget);
  const isTelegram = channel.id === "telegram";
  const telegramTokenPreview = isTelegram ? getTelegramBotTokenPreview() : null;

  return (
    <AppPage width="wide" contentClassName="space-y-8">
      <PageHeader
        title={channel.name}
        description={
          channel.id === "telegram"
            ? "填好 Bot Token 后，OpenCrab 会尽量自动帮你连上 Telegram。"
            : "飞书第一版支持事件订阅、challenge 校验和文本消息回推。"
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
                    <StatusBadge channel={channel} />
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
          />
        </div>
      ) : (
        <section className="rounded-[28px] border border-line bg-[linear-gradient(135deg,#fffdf8_0%,#ffffff_58%,#f8f8f4_100%)] p-5 shadow-soft">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-[720px]">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-[16px] border border-line bg-white text-[16px] font-semibold text-text">
                  {channel.id === "telegram" ? "TG" : "FS"}
                </div>
                <div>
                  <div className="text-[12px] text-muted">
                    {channel.id === "telegram" ? "Bot 私聊入口" : "企业协作入口"}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <h2 className="text-[22px] font-semibold tracking-[-0.04em] text-text">
                      {channel.name}
                    </h2>
                    <StatusBadge channel={channel} />
                  </div>
                  {channel.id === "feishu" && channel.configSummary.appId ? (
                    <div className="mt-1 text-[12px] text-muted">
                      当前 App：{channel.configSummary.appId}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <CapabilityPill>文本消息闭环</CapabilityPill>
                <CapabilityPill>自动创建 conversation</CapabilityPill>
                <CapabilityPill>最近事件记录</CapabilityPill>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[420px]">
              <MetricCard label="会话绑定" value={`${channel.bindingCount}`} />
              <MetricCard label="最近事件" value={`${channel.recentEventCount}`} />
              <MetricCard
                label="最近错误"
                value={channel.lastError ? "1" : "0"}
                tone={channel.lastError ? "danger" : "default"}
              />
            </div>
          </div>

          <div className="mt-5 rounded-[18px] border border-line bg-white/80 px-4 py-4">
            <div className="text-[11px] uppercase tracking-[0.12em] text-muted">Webhook 地址</div>
            <div className="mt-2 break-all font-mono text-[12px] leading-6 text-muted-strong">
              {webhookTarget}
            </div>
            <ChannelDetailActions
              channelId={channel.id}
              webhookTarget={webhookTarget}
              hasPublicBaseUrl={Boolean(publicBaseUrl)}
              canRebind={channel.id === "telegram"}
            />
          </div>
        </section>
      )}

      {!isTelegram ? (
        <section className="rounded-[24px] border border-line bg-surface p-6 shadow-soft">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-[17px] font-semibold tracking-[-0.03em] text-text">接入进度</h2>
              <p className="mt-2 text-[14px] leading-6 text-muted-strong">
                先把当前卡点说清楚，再去配 token、订阅地址或 webhook，会更顺。
              </p>
            </div>
            <div className="text-[13px] text-muted">
              已完成 {buildReadinessSteps(channel, publicBaseUrl).filter((step) => step.done).length} / {buildReadinessSteps(channel, publicBaseUrl).length}
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            {buildReadinessSteps(channel, publicBaseUrl).map((step, index) => (
              <ReadinessCard
                key={step.title}
                index={index + 1}
                title={step.title}
                description={step.description}
                done={step.done}
              />
            ))}
          </div>
        </section>
      ) : null}

      {isTelegram ? (
        <details className="rounded-[24px] border border-line bg-surface p-6 shadow-soft">
          <summary className="cursor-pointer list-none text-[15px] font-semibold text-text">
            遇到问题再展开
          </summary>
          <div className="mt-4 space-y-3">
            <ChecklistItem
              title="当前连接状态"
              description={
                channel.configSummary.webhookConfigured
                  ? "Telegram 已连接到 OpenCrab。"
                  : channel.lastError || "还没有完成连接。"
              }
            />
            {channel.configSummary.lastWebhookError ? (
              <ChecklistItem
                title="最近错误"
                description={channel.configSummary.lastWebhookError}
              />
            ) : null}
            <ChecklistItem
              title="网络提醒"
              description="如果这台机器本身连不上 Telegram，OpenCrab 也无法替你收发消息。"
            />
          </div>
        </details>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
          <ChannelSetupForm channel={channel} />

          <section className="rounded-[24px] border border-line bg-surface p-6 shadow-soft">
            {channel.id === "feishu" ? (
            <>
              <h2 className="text-[17px] font-semibold tracking-[-0.03em] text-text">连接说明</h2>
              <p className="mt-3 text-[14px] leading-6 text-muted-strong">
                在飞书开放平台中开启事件订阅，把请求地址指向下面这个地址。配置了 verification token 的话，OpenCrab 会在接收 challenge 和事件时校验它。
              </p>

              <div className="mt-5 rounded-[18px] border border-line bg-background px-4 py-4">
                <div className="text-[11px] uppercase tracking-[0.12em] text-muted">订阅地址</div>
                <div className="mt-2 break-all font-mono text-[12px] leading-6 text-muted-strong">
                  {webhookTarget}
                </div>
              </div>

              <div className="mt-5 space-y-3">
                <ChecklistItem
                  title="凭证状态"
                  description={
                    channel.configSummary.credentialsVerified
                      ? "飞书应用凭证已经校验通过，可以正常获取 tenant access token。"
                      : channel.configSummary.hasAppId && channel.configSummary.hasAppSecret
                        ? "已经保存 App ID 和 App Secret，但还没有完成最近一次校验。"
                        : "还没有配置飞书 App ID 和 App Secret。"
                  }
                />
                <ChecklistItem
                  title="最近校验时间"
                  description={channel.configSummary.lastVerifiedAt || "还没有校验记录。"}
                  mono
                />
                <ChecklistItem
                  title="当前 App ID"
                  description={channel.configSummary.appId || "还没有配置 App ID。"}
                  mono
                />
              </div>
            </>
          ) : null}

          {channel.id === "feishu" ? (
            <div className="mt-5 space-y-3">
              <ChecklistItem
                title="公开地址"
                description="点“一键生成公网地址”后，OpenCrab 会自动拿到一个外部 HTTPS 地址。高级用法下，也可以自己提供固定域名。"
              />
              <ChecklistItem
                title="密钥存储"
                description="Channel secret 只会保存在本地运行目录或环境变量里，不会进入前端快照。"
              />
              <ChecklistItem
                title="当前限制"
                description="这版只支持文本消息，不包含附件回传、主动群发和复杂权限。"
              />
            </div>
          ) : null}

          {channel.lastError ? (
            <div className="mt-5 rounded-[16px] border border-[#f3d0cb] bg-[#fff3f1] px-4 py-3 text-[13px] text-[#b42318]">
              最近异常：{channel.lastError}
            </div>
          ) : (
            <div className="mt-5 rounded-[16px] border border-[#cfe7d4] bg-[#eef8f0] px-4 py-3 text-[13px] text-[#23633a]">
              最近没有渠道错误。
            </div>
          )}
          </section>
        </div>
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
        <section className="rounded-[24px] border border-line bg-surface p-6 shadow-soft">
          <h2 className="text-[17px] font-semibold tracking-[-0.03em] text-text">接入手册</h2>
          <p className="mt-2 text-[14px] leading-6 text-muted-strong">
            下面这些值就是你去 Telegram / 飞书后台时需要填写的内容，尽量减少来回切换和手工拼接。
          </p>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <ChannelCopyBlock label="事件订阅地址" value={webhookTarget} tone="code" />
            <ChannelCopyBlock
              label="事件类型"
              value="im.message.receive_v1"
            />
            <ChannelCopyBlock
              label="Verification Token"
              value={
                channel.configSummary.hasVerificationToken
                  ? "已在 OpenCrab 中配置，请在飞书事件订阅后台填入同一个 token。"
                  : "当前未配置；如果飞书后台配置了 token，需要在这里保持一致。"
              }
            />
            <ChannelCopyBlock
              label="外部平台步骤"
              value="1. 在飞书开放平台创建应用并保存 App ID / App Secret\n2. 把凭证填回 OpenCrab 并刷新状态\n3. 在事件订阅中把请求地址设为左侧地址\n4. 订阅 im.message.receive_v1，并完成 challenge 校验"
            />
          </div>
        </section>
      )}

      <details className="rounded-[24px] border border-line bg-surface p-6 shadow-soft">
        <summary className="cursor-pointer list-none text-[17px] font-semibold tracking-[-0.03em] text-text">
          最近对话与事件
        </summary>
        <div className="mt-5 space-y-6">
          <section>
            <h3 className="text-[15px] font-medium text-text">已绑定对话</h3>
            <div className="mt-4 space-y-3">
              {channel.bindings.length ? (
                channel.bindings.map((binding) => (
                  <Link
                    key={binding.id}
                    href={`/conversations/${binding.conversationId}`}
                    className="block rounded-[18px] border border-line bg-background px-4 py-4 transition hover:border-text/20"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="text-[14px] font-medium text-text">
                          {binding.remoteUserLabel || binding.remoteChatLabel}
                        </div>
                        <div className="mt-1 text-[12px] leading-5 text-muted">
                          chat: {binding.remoteChatLabel}
                        </div>
                        <div className="mt-1 text-[12px] leading-5 text-muted">
                          conversation: {binding.conversation?.title || binding.conversationId}
                        </div>
                      </div>
                      <div className="shrink-0 text-[12px] text-muted">
                        {binding.lastInboundAt || binding.updatedAt}
                      </div>
                    </div>
                  </Link>
                ))
              ) : (
                <p className="text-[14px] text-muted-strong">还没有外部会话进入这个 channel。</p>
              )}
            </div>
          </section>

          <section>
            <h3 className="text-[15px] font-medium text-text">最近事件</h3>
            <div className="mt-4 space-y-3">
              {channel.events.length ? (
                channel.events.slice(0, 12).map((event) => (
                  <div
                    key={event.id}
                    className="rounded-[18px] border border-line bg-background px-4 py-4"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[13px] font-medium text-text">
                            {event.direction === "inbound"
                              ? "入站消息"
                              : event.direction === "outbound"
                                ? "出站消息"
                                : "系统事件"}
                          </span>
                          <EventStatusBadge status={event.status} />
                        </div>
                        <div className="mt-2 text-[13px] leading-6 text-muted-strong">
                          {event.summary}
                        </div>
                        {event.errorMessage ? (
                          <div className="mt-2 text-[12px] text-[#b42318]">{event.errorMessage}</div>
                        ) : null}
                      </div>
                      <div className="shrink-0 text-right text-[12px] text-muted">
                        <div className="font-mono">{event.createdAt}</div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-[14px] text-muted-strong">这个 channel 还没有收到事件。</p>
              )}
            </div>
          </section>
        </div>
      </details>
    </AppPage>
  );
}

function MetricCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "danger";
}) {
  return (
    <div
      className={`rounded-[18px] border px-4 py-4 ${
        tone === "danger" ? "border-[#f3d0cb] bg-[#fff8f7]" : "border-line bg-white/80"
      }`}
    >
      <div className="text-[11px] uppercase tracking-[0.12em] text-muted">{label}</div>
      <div className="mt-2 text-[24px] font-semibold tracking-[-0.04em] text-text">{value}</div>
    </div>
  );
}

function StatusBadge({ channel }: { channel: ChannelDetail }) {
  const tone =
    channel.status === "ready"
      ? "border-[#cfe7d4] bg-[#eef8f0] text-[#23633a]"
      : channel.status === "disconnected"
        ? "border-[#e7d9c2] bg-[#fbf6ed] text-[#8a5b16]"
      : channel.status === "error"
        ? "border-[#f3d0cb] bg-[#fff3f1] text-[#b42318]"
        : "border-line bg-surface-muted text-muted-strong";

  return (
    <span className={`rounded-full border px-3 py-1.5 text-[12px] font-medium ${tone}`}>
      {getChannelStatusLabel(channel.status)}
    </span>
  );
}

function EventStatusBadge({ status }: { status: string }) {
  const tone =
    status === "sent" || status === "processed"
      ? "border-[#cfe7d4] bg-[#eef8f0] text-[#23633a]"
      : status === "error"
        ? "border-[#f3d0cb] bg-[#fff3f1] text-[#b42318]"
        : "border-line bg-surface-muted text-muted-strong";

  return (
    <span className={`rounded-full border px-2.5 py-1 text-[11px] ${tone}`}>{status}</span>
  );
}

function CapabilityPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-line bg-white/80 px-3 py-1.5 text-[12px] text-muted-strong">
      {children}
    </span>
  );
}

function buildTelegramStatusSummary(channel: ChannelDetail, publicBaseUrl: string | null) {
  if (!channel.configSummary.hasBotToken) {
    return "还没开始连接。先填入 Bot Token，启动后 OpenCrab 会自动尝试把 Telegram 连起来。";
  }

  if (channel.status === "disconnected") {
    return "当前已经断开连接。Bot Token 还保留着，但 OpenCrab 不会继续接收 Telegram 消息。";
  }

  if (channel.configSummary.webhookConfigured) {
    return "已经连上了。现在你可以直接去 Telegram 给 bot 发消息，消息会自动进入 OpenCrab。";
  }

  if (!publicBaseUrl) {
    return "Bot Token 已保存。OpenCrab 正在自动准备公网地址并继续完成连接。";
  }

  return "Bot Token 已保存，OpenCrab 正在尝试完成 Telegram 连接。如果还没成功，可以点一次重新连接。";
}

function ChecklistItem({
  title,
  description,
  mono = false,
}: {
  title: string;
  description: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-[16px] border border-line bg-background px-4 py-3">
      <div className="text-[13px] font-medium text-text">{title}</div>
      <div
        className={`mt-1 text-[13px] leading-6 text-muted-strong ${mono ? "break-all font-mono text-[12px]" : ""}`}
      >
        {description}
      </div>
    </div>
  );
}

function ReadinessCard({
  index,
  title,
  description,
  done,
}: {
  index: number;
  title: string;
  description: string;
  done: boolean;
}) {
  return (
    <div
      className={`rounded-[18px] border px-4 py-4 ${
        done ? "border-[#cfe7d4] bg-[#eef8f0]" : "border-line bg-background"
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-medium ${
            done ? "bg-[#23633a] text-white" : "bg-surface-muted text-muted-strong"
          }`}
        >
          {index}
        </div>
        <div className="text-[14px] font-medium text-text">{title}</div>
      </div>
      <div className="mt-3 text-[13px] leading-6 text-muted-strong">{description}</div>
    </div>
  );
}

function buildReadinessSteps(channel: ChannelDetail, publicBaseUrl: string | null) {
  if (channel.id === "telegram") {
    return [
      {
        title: "配置 Bot Token",
        description: channel.configSummary.hasBotToken
          ? "已经保存 Bot Token，OpenCrab 可以开始校验 Telegram bot 身份。"
          : "先在 BotFather 创建 bot，并把 Bot Token 填到当前页面。",
        done: Boolean(channel.configSummary.hasBotToken),
      },
      {
        title: "提供公开地址",
        description: publicBaseUrl
          ? `当前公开地址是 ${publicBaseUrl}，OpenCrab 可以自动设置 Telegram webhook。`
          : "点“一键生成公网地址”，让 OpenCrab 自动创建外部 HTTPS 地址并回填 Telegram。",
        done: Boolean(publicBaseUrl),
      },
      {
        title: "确认 Webhook 指向",
        description: channel.configSummary.webhookConfigured
          ? "Telegram 当前 webhook 已经对准 OpenCrab，可以开始做真实消息联调。"
          : "点保存或“重新绑定 Webhook”后，确认 Telegram 返回地址已经对准当前 webhook。",
        done: Boolean(channel.configSummary.webhookConfigured),
      },
    ];
  }

  return [
    {
      title: "配置 App 凭证",
      description: channel.configSummary.hasAppId && channel.configSummary.hasAppSecret
        ? "App ID 和 App Secret 都已保存，OpenCrab 可以尝试获取 tenant access token。"
        : "先把飞书 App ID 和 App Secret 填上，才能开始校验应用凭证。",
      done: Boolean(channel.configSummary.hasAppId && channel.configSummary.hasAppSecret),
    },
    {
      title: "校验凭证可用",
      description: channel.configSummary.credentialsVerified
        ? "最近一次校验已通过，说明当前应用凭证可以正常使用。"
        : "点击保存配置或刷新状态，确认 OpenCrab 能成功获取 tenant access token。",
      done: Boolean(channel.configSummary.credentialsVerified),
    },
    {
      title: "完成事件订阅",
      description: publicBaseUrl
        ? "接下来去飞书开放平台把订阅地址填成当前 webhook，并完成 challenge 校验。"
        : "先点“一键生成公网地址”，再把飞书事件订阅地址指向这个 webhook。",
      done: false,
    },
  ];
}

function buildTelegramSetWebhookCommand(channel: ChannelDetail, webhookTarget: string) {
  const secretClause = channel.configSummary.hasWebhookSecret
    ? ', "secret_token":"$OPENCRAB_TELEGRAM_WEBHOOK_SECRET"'
    : "";

  return [
    'curl -X POST "https://api.telegram.org/bot$OPENCRAB_TELEGRAM_BOT_TOKEN/setWebhook" \\',
    '  -H "Content-Type: application/json" \\',
    `  -d '{"url":"${webhookTarget}"${secretClause}}'`,
  ].join("\n");
}
