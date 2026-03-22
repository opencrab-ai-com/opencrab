const CHUNK_PUBLIC_PATH = "server/pages/install.js";
const runtime = require("../chunks/ssr/[turbopack]_runtime.js");
runtime.loadChunk("server/chunks/ssr/[root of the server]__f90d9a._.js");
runtime.loadChunk("server/chunks/ssr/node_modules_2f08be._.js");
runtime.loadChunk("server/chunks/ssr/[root of the server]__d3e662._.css");
module.exports = runtime.getOrInstantiateRuntimeModule("[workspace]/node_modules/next/dist/esm/build/templates/pages.js/(INNER_PAGE)/[workspace]/pages/install.tsx (ecmascript) (ecmascript, ssr)", CHUNK_PUBLIC_PATH).exports;
