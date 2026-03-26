import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { promisify } from "node:util";
import { resolveWorkspaceDirectoryInput } from "@/lib/resources/workspace-directories";

const execFileAsync = promisify(execFile);

type PickNativeDirectoryInput = {
  title?: string;
  defaultPath?: string | null;
};

export async function pickNativeDirectory(input: PickNativeDirectoryInput = {}) {
  const title = input.title?.trim() || "选择目录";
  const defaultPath = normalizeDefaultPath(input.defaultPath);

  switch (process.platform) {
    case "darwin":
      return pickDirectoryOnMac({ title, defaultPath });
    case "win32":
      return pickDirectoryOnWindows({ title, defaultPath });
    default:
      return pickDirectoryOnLinux({ title, defaultPath });
  }
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
