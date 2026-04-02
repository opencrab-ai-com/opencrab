const CONVERSATION_SIDEBAR_ROUTE_PREFIXES = [
  "/conversations",
  "/agents",
  "/projects",
  "/channels",
] as const;

export function shouldShowConversationSidebar(pathname: string | null) {
  if (!pathname) {
    return false;
  }

  return CONVERSATION_SIDEBAR_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
