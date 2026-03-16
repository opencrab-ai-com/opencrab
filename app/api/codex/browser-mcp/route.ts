import { handleBrowserMcpRequest } from "@/lib/codex/browser-session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleBrowserMcpRequest(request);
}

export async function POST(request: Request) {
  return handleBrowserMcpRequest(request);
}

export async function DELETE(request: Request) {
  return handleBrowserMcpRequest(request);
}
