(globalThis.TURBOPACK = globalThis.TURBOPACK || []).push(["chunks/next_config/[root of the server]__9acd7a._.js", {

"[next]/entry/config/next.js (ecmascript, next_config)": (({ r: __turbopack_require__, f: __turbopack_require_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, l: __turbopack_load__, j: __turbopack_dynamic__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, k: __turbopack_refresh__ }) => (() => {

__turbopack_esm__({
    "default": ()=>loadNextConfig
});
var __TURBOPACK__external__next$2f$dist$2f$server$2f$config__ = __turbopack_external_require__("next/dist/server/config", true);
var __TURBOPACK__external__next$2f$dist$2f$lib$2f$load$2d$custom$2d$routes__ = __turbopack_external_require__("next/dist/lib/load-custom-routes", true);
var __TURBOPACK__external__next$2f$dist$2f$shared$2f$lib$2f$constants__ = __turbopack_external_require__("next/dist/shared/lib/constants", true);
var __TURBOPACK__external__node$3a$assert__ = __turbopack_external_require__("node:assert", true);
"__TURBOPACK__ecmascript__hoisting__location__";
;
;
;
;
const loadNextConfig = async (silent)=>{
    const nextConfig = await __TURBOPACK__external__next$2f$dist$2f$server$2f$config__["default"](__TURBOPACK__external__next$2f$dist$2f$shared$2f$lib$2f$constants__["PHASE_DEVELOPMENT_SERVER"], process.cwd(), undefined, undefined, silent);
    nextConfig.generateBuildId = await nextConfig.generateBuildId?.();
    const customRoutes = await __TURBOPACK__external__next$2f$dist$2f$lib$2f$load$2d$custom$2d$routes__["default"](nextConfig);
    // TODO: these functions takes arguments, have to be supported in a different way
    nextConfig.exportPathMap = nextConfig.exportPathMap && {};
    nextConfig.webpack = nextConfig.webpack && {};
    // Transform the `modularizeImports` option
    nextConfig.modularizeImports = nextConfig.modularizeImports ? Object.fromEntries(Object.entries(nextConfig.modularizeImports).map(([mod, config])=>[
            mod,
            {
                ...config,
                transform: typeof config.transform === 'string' ? config.transform : Object.entries(config.transform).map(([key, value])=>[
                        key,
                        value
                    ])
            }
        ])) : undefined;
    if (nextConfig.experimental?.turbopack?.loaders) {
        ensureLoadersHaveSerializableOptions(nextConfig.experimental.turbopack.loaders);
    }
    return {
        customRoutes: customRoutes,
        config: nextConfig
    };
};
;
function ensureLoadersHaveSerializableOptions(turbopackLoaders) {
    for (const [ext, loaderItems] of Object.entries(turbopackLoaders)){
        for (const loaderItem of loaderItems){
            if (typeof loaderItem !== 'string' && !deepEqual(loaderItem, JSON.parse(JSON.stringify(loaderItem)))) {
                throw new Error(`loader ${loaderItem.loader} for match "${ext}" does not have serializable options. Ensure that options passed are plain JavaScript objects and values.`);
            }
        }
    }
}
function deepEqual(a, b) {
    try {
        __TURBOPACK__external__node$3a$assert__["default"].deepStrictEqual(a, b);
        return true;
    } catch  {
        return false;
    }
}

})()),
"[turbopack-node]/ipc/error.ts (ecmascript, next_config)": (({ r: __turbopack_require__, f: __turbopack_require_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, l: __turbopack_load__, j: __turbopack_dynamic__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, k: __turbopack_refresh__ }) => (() => {

// merged from next.js
// https://github.com/vercel/next.js/blob/e657741b9908cf0044aaef959c0c4defb19ed6d8/packages/next/src/lib/is-error.ts
// https://github.com/vercel/next.js/blob/e657741b9908cf0044aaef959c0c4defb19ed6d8/packages/next/src/shared/lib/is-plain-object.ts
__turbopack_esm__({
    "default": ()=>isError,
    "getProperError": ()=>getProperError
});
function isError(err) {
    return typeof err === "object" && err !== null && "name" in err && "message" in err;
}
function getProperError(err) {
    if (isError(err)) {
        return err;
    }
    if ("TURBOPACK compile-time truthy", 1) {
        // Provide a better error message for cases where `throw undefined`
        // is called in development
        if (typeof err === "undefined") {
            return new Error("`undefined` was thrown instead of a real error");
        }
        if (err === null) {
            return new Error("`null` was thrown instead of a real error");
        }
    }
    return new Error(isPlainObject(err) ? JSON.stringify(err) : err + "");
}
function getObjectClassLabel(value) {
    return Object.prototype.toString.call(value);
}
function isPlainObject(value) {
    if (getObjectClassLabel(value) !== "[object Object]") {
        return false;
    }
    const prototype = Object.getPrototypeOf(value);
    /**
   * this used to be previously:
   *
   * `return prototype === null || prototype === Object.prototype`
   *
   * but Edge Runtime expose Object from vm, being that kind of type-checking wrongly fail.
   *
   * It was changed to the current implementation since it's resilient to serialization.
   */ return prototype === null || prototype.hasOwnProperty("isPrototypeOf");
}

})()),
"[turbopack-node]/compiled/stacktrace-parser/index.js (ecmascript, next_config)": (function({ r: __turbopack_require__, f: __turbopack_require_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, l: __turbopack_load__, j: __turbopack_dynamic__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, k: __turbopack_refresh__, m: module, e: exports }) { !function() {

(()=>{
    "use strict";
    if (typeof __nccwpck_require__ !== "undefined") __nccwpck_require__.ab = __dirname + "/";
    var e = {};
    (()=>{
        var r = e;
        Object.defineProperty(r, "__esModule", {
            value: true
        });
        var n = "<unknown>";
        function parse(e) {
            var r = e.split("\n");
            return r.reduce(function(e, r) {
                var n = parseChrome(r) || parseWinjs(r) || parseGecko(r) || parseNode(r) || parseJSC(r);
                if (n) {
                    e.push(n);
                }
                return e;
            }, []);
        }
        var a = /^\s*at (.*?) ?\(((?:file|https?|blob|chrome-extension|native|eval|webpack|<anonymous>|\/|[a-z]:\\|\\\\).*?)(?::(\d+))?(?::(\d+))?\)?\s*$/i;
        var l = /\((\S*)(?::(\d+))(?::(\d+))\)/;
        function parseChrome(e) {
            var r = a.exec(e);
            if (!r) {
                return null;
            }
            var u = r[2] && r[2].indexOf("native") === 0;
            var t = r[2] && r[2].indexOf("eval") === 0;
            var i = l.exec(r[2]);
            if (t && i != null) {
                r[2] = i[1];
                r[3] = i[2];
                r[4] = i[3];
            }
            return {
                file: !u ? r[2] : null,
                methodName: r[1] || n,
                arguments: u ? [
                    r[2]
                ] : [],
                lineNumber: r[3] ? +r[3] : null,
                column: r[4] ? +r[4] : null
            };
        }
        var u = /^\s*at (?:((?:\[object object\])?.+) )?\(?((?:file|ms-appx|https?|webpack|blob):.*?):(\d+)(?::(\d+))?\)?\s*$/i;
        function parseWinjs(e) {
            var r = u.exec(e);
            if (!r) {
                return null;
            }
            return {
                file: r[2],
                methodName: r[1] || n,
                arguments: [],
                lineNumber: +r[3],
                column: r[4] ? +r[4] : null
            };
        }
        var t = /^\s*(.*?)(?:\((.*?)\))?(?:^|@)((?:file|https?|blob|chrome|webpack|resource|\[native).*?|[^@]*bundle)(?::(\d+))?(?::(\d+))?\s*$/i;
        var i = /(\S+) line (\d+)(?: > eval line \d+)* > eval/i;
        function parseGecko(e) {
            var r = t.exec(e);
            if (!r) {
                return null;
            }
            var a = r[3] && r[3].indexOf(" > eval") > -1;
            var l = i.exec(r[3]);
            if (a && l != null) {
                r[3] = l[1];
                r[4] = l[2];
                r[5] = null;
            }
            return {
                file: r[3],
                methodName: r[1] || n,
                arguments: r[2] ? r[2].split(",") : [],
                lineNumber: r[4] ? +r[4] : null,
                column: r[5] ? +r[5] : null
            };
        }
        var s = /^\s*(?:([^@]*)(?:\((.*?)\))?@)?(\S.*?):(\d+)(?::(\d+))?\s*$/i;
        function parseJSC(e) {
            var r = s.exec(e);
            if (!r) {
                return null;
            }
            return {
                file: r[3],
                methodName: r[1] || n,
                arguments: [],
                lineNumber: +r[4],
                column: r[5] ? +r[5] : null
            };
        }
        var o = /^\s*at (?:((?:\[object object\])?[^\\/]+(?: \[as \S+\])?) )?\(?(.*?):(\d+)(?::(\d+))?\)?\s*$/i;
        function parseNode(e) {
            var r = o.exec(e);
            if (!r) {
                return null;
            }
            return {
                file: r[2],
                methodName: r[1] || n,
                arguments: [],
                lineNumber: +r[3],
                column: r[4] ? +r[4] : null
            };
        }
        r.parse = parse;
    })();
    module.exports = e;
})();

}.call(this) }),
"[turbopack-node]/ipc/index.ts (ecmascript, next_config)": (({ r: __turbopack_require__, f: __turbopack_require_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, l: __turbopack_load__, j: __turbopack_dynamic__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, k: __turbopack_refresh__ }) => (() => {

__turbopack_esm__({
    "IPC": ()=>IPC,
    "structuredError": ()=>structuredError
});
var __TURBOPACK__external__node$3a$net__ = __turbopack_external_require__("node:net", true);
var __TURBOPACK__imported__module__$5b$turbopack$2d$node$5d2f$compiled$2f$stacktrace$2d$parser$2f$index$2e$js__$28$ecmascript$29$__ = __turbopack_import__("[turbopack-node]/compiled/stacktrace-parser/index.js (ecmascript, next_config)");
var __TURBOPACK__imported__module__$5b$turbopack$2d$node$5d2f$ipc$2f$error$2e$ts__$28$ecmascript$29$__ = __turbopack_import__("[turbopack-node]/ipc/error.ts (ecmascript, next_config)");
"__TURBOPACK__ecmascript__hoisting__location__";
;
;
;
function structuredError(e) {
    e = __TURBOPACK__imported__module__$5b$turbopack$2d$node$5d2f$ipc$2f$error$2e$ts__$28$ecmascript$29$__["getProperError"](e);
    return {
        name: e.name,
        message: e.message,
        stack: typeof e.stack === "string" ? __TURBOPACK__imported__module__$5b$turbopack$2d$node$5d2f$compiled$2f$stacktrace$2d$parser$2f$index$2e$js__$28$ecmascript$29$__["parse"](e.stack) : []
    };
}
function createIpc(port) {
    const socket = __TURBOPACK__external__node$3a$net__["createConnection"](port, "127.0.0.1");
    const packetQueue = [];
    const recvPromiseResolveQueue = [];
    function pushPacket(packet) {
        const recvPromiseResolve = recvPromiseResolveQueue.shift();
        if (recvPromiseResolve != null) {
            recvPromiseResolve(JSON.parse(packet.toString("utf8")));
        } else {
            packetQueue.push(packet);
        }
    }
    let state = {
        type: "waiting"
    };
    let buffer = Buffer.alloc(0);
    socket.once("connect", ()=>{
        socket.on("data", (chunk)=>{
            buffer = Buffer.concat([
                buffer,
                chunk
            ]);
            loop: while(true){
                switch(state.type){
                    case "waiting":
                        {
                            if (buffer.length >= 4) {
                                const length = buffer.readUInt32BE(0);
                                buffer = buffer.subarray(4);
                                state = {
                                    type: "packet",
                                    length
                                };
                            } else {
                                break loop;
                            }
                            break;
                        }
                    case "packet":
                        {
                            if (buffer.length >= state.length) {
                                const packet = buffer.subarray(0, state.length);
                                buffer = buffer.subarray(state.length);
                                state = {
                                    type: "waiting"
                                };
                                pushPacket(packet);
                            } else {
                                break loop;
                            }
                            break;
                        }
                }
            }
        });
    });
    // When the socket is closed, this process is no longer needed.
    // This might happen e. g. when parent process is killed or
    // node.js pool is garbage collected.
    socket.once("close", ()=>{
        process.exit(0);
    });
    function send(message) {
        const packet = Buffer.from(JSON.stringify(message), "utf8");
        const length = Buffer.alloc(4);
        length.writeUInt32BE(packet.length);
        socket.write(length);
        return new Promise((resolve, reject)=>{
            socket.write(packet, (err)=>{
                process.stderr.write(`TURBOPACK_OUTPUT_D\n`);
                process.stdout.write(`TURBOPACK_OUTPUT_D\n`);
                if (err != null) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }
    return {
        async recv () {
            const packet = packetQueue.shift();
            if (packet != null) {
                return JSON.parse(packet.toString("utf8"));
            }
            const result = await new Promise((resolve)=>{
                recvPromiseResolveQueue.push((result)=>{
                    resolve(result);
                });
            });
            return result;
        },
        send (message) {
            return send(message);
        },
        async sendError (error) {
            try {
                await send({
                    type: "error",
                    ...structuredError(error)
                });
            } catch (err) {
                console.error("failed to send error back to rust:", err);
                // ignore and exit anyway
                process.exit(1);
            }
            process.exit(0);
        }
    };
}
const PORT = process.argv[2];
const IPC = createIpc(parseInt(PORT, 10));
process.on("uncaughtException", (err)=>{
    IPC.sendError(err);
});
const improveConsole = (name, stream, addStack)=>{
    // @ts-ignore
    const original = console[name];
    // @ts-ignore
    const stdio = process[stream];
    // @ts-ignore
    console[name] = (...args)=>{
        stdio.write(`TURBOPACK_OUTPUT_B\n`);
        original(...args);
        if (addStack) {
            const stack = new Error().stack?.replace(/^.+\n.+\n/, "") + "\n";
            stdio.write("TURBOPACK_OUTPUT_S\n");
            stdio.write(stack);
        }
        stdio.write("TURBOPACK_OUTPUT_E\n");
    };
};
improveConsole("error", "stderr", true);
improveConsole("warn", "stderr", true);
improveConsole("count", "stdout", true);
improveConsole("trace", "stderr", false);
improveConsole("log", "stdout", true);
improveConsole("group", "stdout", true);
improveConsole("groupCollapsed", "stdout", true);
improveConsole("table", "stdout", true);
improveConsole("debug", "stdout", true);
improveConsole("info", "stdout", true);
improveConsole("dir", "stdout", true);
improveConsole("dirxml", "stdout", true);
improveConsole("timeEnd", "stdout", true);
improveConsole("timeLog", "stdout", true);
improveConsole("timeStamp", "stdout", true);
improveConsole("assert", "stderr", true);

})()),
"[turbopack-node]/ipc/evaluate.ts (ecmascript, next_config)": (({ r: __turbopack_require__, f: __turbopack_require_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, l: __turbopack_load__, j: __turbopack_dynamic__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, k: __turbopack_refresh__ }) => (() => {

__turbopack_esm__({
    "run": ()=>run
});
var __TURBOPACK__imported__module__$5b$turbopack$2d$node$5d2f$ipc$2f$index$2e$ts__$28$ecmascript$29$__ = __turbopack_import__("[turbopack-node]/ipc/index.ts (ecmascript, next_config)");
"__TURBOPACK__ecmascript__hoisting__location__";
;
const ipc = __TURBOPACK__imported__module__$5b$turbopack$2d$node$5d2f$ipc$2f$index$2e$ts__$28$ecmascript$29$__["IPC"];
const run = async (getValue)=>{
    while(true){
        const msg = await ipc.recv();
        switch(msg.type){
            case "evaluate":
                {
                    try {
                        const value = await getValue(ipc, ...msg.args);
                        await ipc.send({
                            type: "end",
                            data: value === undefined ? undefined : JSON.stringify(value, null, 2)
                        });
                    } catch (e) {
                        await ipc.sendError(e);
                    }
                    break;
                }
            default:
                {
                    console.error("unexpected message type", msg.type);
                    process.exit(1);
                }
        }
    }
};

})()),
"[turbopack-node]/ipc/evaluate.ts/evaluate.js/(INNER)/[next]/entry/config/next.js (ecmascript)/(RUNTIME)/[turbopack-node]/ipc/evaluate.ts (ecmascript) (ecmascript, next_config)": (({ r: __turbopack_require__, f: __turbopack_require_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, l: __turbopack_load__, j: __turbopack_dynamic__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, k: __turbopack_refresh__ }) => (() => {

var __TURBOPACK__imported__module__$5b$turbopack$2d$node$5d2f$ipc$2f$evaluate$2e$ts__$28$ecmascript$29$__ = __turbopack_import__("[turbopack-node]/ipc/evaluate.ts (ecmascript, next_config)");
"__TURBOPACK__ecmascript__hoisting__location__";
;
__TURBOPACK__imported__module__$5b$turbopack$2d$node$5d2f$ipc$2f$evaluate$2e$ts__$28$ecmascript$29$__["run"]((...args)=>__turbopack_require__("[next]/entry/config/next.js (ecmascript, next_config)").default(...args));

})()),
"[turbopack-node]/globals.ts (ecmascript, next_config)": (function({ r: __turbopack_require__, f: __turbopack_require_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, l: __turbopack_load__, j: __turbopack_dynamic__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, k: __turbopack_refresh__, m: module, e: exports }) { !function() {

// @ts-ignore
process.turbopack = {};

}.call(this) }),
}]);

//# sourceMappingURL=[root of the server]__9acd7a._.js.map