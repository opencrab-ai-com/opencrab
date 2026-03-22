const CHUNK_PUBLIC_PATH = "server/pages/_app.js";
const runtime = require("../chunks/ssr/[turbopack]_runtime.js");
runtime.loadChunk("server/chunks/ssr/[root of the server]__d3e662._.css");
runtime.loadChunk("server/chunks/ssr/[root of the server]__a14e67._.js");
module.exports = runtime.getOrInstantiateRuntimeModule("[workspace]/node_modules/next/dist/esm/build/templates/pages.js/(INNER_PAGE)/[workspace]/pages/_app.tsx (ecmascript) (ecmascript, ssr)", CHUNK_PUBLIC_PATH).exports;
