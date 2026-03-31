const TRANSPORT_NOISE_PATTERNS = [
  /^reconnecting\.\.\.\s*\d+\/\d+/i,
  /stream disconnected before completion/i,
  /\b(?:broken pipe|connection reset by peer)\b/i,
];

const TRANSPORT_NOISE_USER_MESSAGE =
  "OpenCrab 与本机执行引擎的连接刚刚中断了，请重试。";

export function isCodexTransportNoiseMessage(value: string | null | undefined) {
  const normalized = value?.trim();

  if (!normalized) {
    return false;
  }

  return TRANSPORT_NOISE_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function normalizeCodexTransportNoiseMessage(
  value: string | null | undefined,
) {
  return isCodexTransportNoiseMessage(value) ? TRANSPORT_NOISE_USER_MESSAGE : null;
}
