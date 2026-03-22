const CHUNK_PUBLIC_PATH = "server/app/_not-found.js";
const runtime = require("../chunks/rsc/[turbopack]_runtime.js");
runtime.loadChunk("server/chunks/rsc/node_modules_750879._.js");
runtime.getOrInstantiateRuntimeModule("[next]/build/server/app-bootstrap.ts (ecmascript, rsc)", CHUNK_PUBLIC_PATH);
module.exports = runtime.getOrInstantiateRuntimeModule("[workspace]/node_modules/next/dist/esm/build/templates/app-page.js/(COMPONENT_0)/[workspace]/node_modules/next/dist/client/components/not-found-error.js (ecmascript, Next.js server component) (ecmascript, rsc)", CHUNK_PUBLIC_PATH).exports;
