const CHUNK_PUBLIC_PATH = "server/pages/index.js";
const runtime = require("../chunks/ssr/[turbopack]_runtime.js");
runtime.loadChunk("server/chunks/ssr/[root of the server]__70639f._.js");
runtime.loadChunk("server/chunks/ssr/node_modules_f76f1c._.js");
runtime.loadChunk("server/chunks/ssr/[root of the server]__d3e662._.css");
module.exports = runtime.getOrInstantiateRuntimeModule("[workspace]/node_modules/next/dist/esm/build/templates/pages.js/(INNER_PAGE)/[workspace]/pages/index.tsx (ecmascript) (ecmascript, ssr)", CHUNK_PUBLIC_PATH).exports;
