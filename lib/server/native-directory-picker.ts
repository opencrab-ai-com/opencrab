import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { promisify } from "node:util";
import { isDesktopAppMode } from "@/lib/runtime/app-mode";
import { resolveWorkspaceDirectoryInput } from "@/lib/resources/workspace-directories";

const execFileAsync = promisify(execFile);
const DESKTOP_BRIDGE_REQUEST_KIND = "opencrab:desktop-local-files:request";
const DESKTOP_BRIDGE_RESPONSE_KIND = "opencrab:desktop-local-files:response";
const DESKTOP_BRIDGE_TIMEOUT_MS = 15_000;

type PickNativeDirectoryInput = {
  title?: string;
  defaultPath?: string | null;
};

export async function pickNativeDirectory(input: PickNativeDirectoryInput = {}) {
  const title = input.title?.trim() || "选择目录";
  const defaultPath = normalizeDefaultPath(input.defaultPath);

  if (canUseDesktopLocalFilesBridge()) {
    return invokeDesktopLocalFilesBridge<{
      path: string | null;
      cancelled: boolean;
    }>("pick-directory", {
      title,
      defaultPath,
    }).then((result) => result.path);
  }

  switch (process.platform) {
    case "darwin":
      return pickDirectoryOnMac({ title, defaultPath });
    case "win32":
      return pickDirectoryOnWindows({ title, defaultPath });
    default:
      return pickDirectoryOnLinux({ title, defaultPath });
  }
}

export async function revealNativePath(targetPath: string) {
  if (canUseDesktopLocalFilesBridge()) {
    await invokeDesktopLocalFilesBridge("reveal-path", {
      targetPath,
    });
    return;
  }

  await revealPathOnCurrentPlatform(targetPath);
}

async function pickDirectoryOnMac(input: {
  title: string;
  defaultPath: string | null;
}) {
  const args = [
    "-e",
    buildMacChooseFolderScript(input),
    "-e",
    "POSIX path of chosenFolder",
  ];

  try {
    const { stdout } = await execFileAsync("osascript", args);
    return stdout.trim() || null;
  } catch (error) {
    if (isUserCancellation(error)) {
      return null;
    }

    throw error;
  }
}

async function pickDirectoryOnWindows(input: {
  title: string;
  defaultPath: string | null;
}) {
  const script = [
    "Add-Type -AssemblyName System.Windows.Forms",
    "$dialog = New-Object System.Windows.Forms.FolderBrowserDialog",
    `$dialog.Description = '${escapePowerShellString(input.title)}'`,
    input.defaultPath
      ? `$dialog.SelectedPath = '${escapePowerShellString(input.defaultPath)}'`
      : null,
    "if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {",
    "  Write-Output $dialog.SelectedPath",
    "}",
  ]
    .filter(Boolean)
    .join(";");

  const { stdout } = await execFileAsync(
    "powershell.exe",
    ["-NoProfile", "-STA", "-Command", script],
  );

  return stdout.trim() || null;
}

async function pickDirectoryOnLinux(input: {
  title: string;
  defaultPath: string | null;
}) {
  const args = [
    "--file-selection",
    "--directory",
    "--title",
    input.title,
  ];

  if (input.defaultPath) {
    args.push("--filename", `${input.defaultPath.replace(/\/?$/, "/")}`);
  }

  try {
    const { stdout } = await execFileAsync("zenity", args);
    return stdout.trim() || null;
  } catch (error) {
    if (isUserCancellation(error)) {
      return null;
    }

    throw new Error("当前系统暂不支持原生目录选择器，请手动输入目录路径。");
  }
}

async function revealPathOnCurrentPlatform(targetPath: string) {
  const { statSync } = await import("node:fs");
  const pathModule = await import("node:path");
  const stats = statSync(targetPath);
  const isDirectory = stats.isDirectory();

  switch (process.platform) {
    case "darwin":
      if (isDirectory) {
        await execFileAsync("open", [targetPath]);
        return;
      }

      await execFileAsync("open", ["-R", targetPath]);
      return;
    case "win32":
      if (isDirectory) {
        await execFileAsync("explorer.exe", [targetPath]);
        return;
      }

      await execFileAsync("explorer.exe", [`/select,${targetPath}`]);
      return;
    default:
      await execFileAsync("xdg-open", [isDirectory ? targetPath : pathModule.dirname(targetPath)]);
  }
}

function buildMacChooseFolderScript(input: {
  title: string;
  defaultPath: string | null;
}) {
  const base = `set chosenFolder to choose folder with prompt "${escapeAppleScriptString(input.title)}"`;

  if (!input.defaultPath) {
    return base;
  }

  return `${base} default location POSIX file "${escapeAppleScriptString(input.defaultPath)}"`;
}

function normalizeDefaultPath(value: string | null | undefined) {
  const resolved = resolveWorkspaceDirectoryInput(value);

  if (!resolved) {
    return null;
  }

  return existsSync(resolved) ? resolved : null;
}

function canUseDesktopLocalFilesBridge() {
  return isDesktopAppMode() && typeof process.send === "function";
}

function invokeDesktopLocalFilesBridge<TResult>(
  action: "pick-directory" | "reveal-path",
  payload: Record<string, unknown>,
) {
  return new Promise<TResult>((resolve, reject) => {
    if (typeof process.send !== "function") {
      reject(new Error("桌面原生桥接当前不可用。"));
      return;
    }

    const requestId = crypto.randomUUID();
    const cleanup = createDesktopBridgeCleanup(handleMessage);
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("桌面原生桥接响应超时。"));
    }, DESKTOP_BRIDGE_TIMEOUT_MS);

    timeout.unref?.();

    function handleMessage(message: unknown) {
      if (!isDesktopBridgeResponse(message) || message.requestId !== requestId) {
        return;
      }

      clearTimeout(timeout);
      cleanup();

      if (message.ok) {
        resolve((message.result ?? {}) as TResult);
        return;
      }

      reject(new Error(message.error || "桌面原生桥接调用失败。"));
    }

    process.on("message", handleMessage);

    try {
      process.send({
        kind: DESKTOP_BRIDGE_REQUEST_KIND,
        requestId,
        action,
        payload,
      });
    } catch (error) {
      clearTimeout(timeout);
      cleanup();
      reject(error);
    }
  });
}

function createDesktopBridgeCleanup(
  handleMessage: (message: unknown) => void,
) {
  return () => {
    process.removeListener("message", handleMessage);
  };
}

function isDesktopBridgeResponse(
  message: unknown,
): message is {
  kind: typeof DESKTOP_BRIDGE_RESPONSE_KIND;
  requestId: string;
  ok: boolean;
  result?: Record<string, unknown>;
  error?: string;
} {
  if (!message || typeof message !== "object") {
    return false;
  }

  const candidate = message as {
    kind?: string;
    requestId?: unknown;
    ok?: unknown;
    result?: Record<string, unknown>;
    error?: unknown;
  };

  return (
    candidate.kind === DESKTOP_BRIDGE_RESPONSE_KIND &&
    typeof candidate.requestId === "string" &&
    typeof candidate.ok === "boolean"
  );
}

function isUserCancellation(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  return (
    message.includes("User canceled") ||
    message.includes("Execution was interrupted") ||
    message.includes("Command failed")
  );
}

function escapeAppleScriptString(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function escapePowerShellString(value: string) {
  return value.replace(/'/g, "''");
}
