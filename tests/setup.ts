import { File } from "node:buffer";
import { webcrypto } from "node:crypto";

if (!globalThis.crypto) {
  Object.defineProperty(globalThis, "crypto", {
    value: webcrypto,
    configurable: true,
  });
}

if (!globalThis.File) {
  Object.defineProperty(globalThis, "File", {
    value: File,
    configurable: true,
  });
}
