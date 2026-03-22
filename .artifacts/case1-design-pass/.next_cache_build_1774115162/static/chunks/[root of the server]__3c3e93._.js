(globalThis.TURBOPACK = globalThis.TURBOPACK || []).push(["static/chunks/[root of the server]__3c3e93._.js", {

"[workspace]/components/site-header.tsx (ecmascript)": (({ r: __turbopack_require__, f: __turbopack_require_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, l: __turbopack_load__, j: __turbopack_dynamic__, g: global, __dirname, k: __turbopack_refresh__ }) => (() => {

__turbopack_esm__({
    "SiteHeader": ()=>SiteHeader
});
var __TURBOPACK__imported__module__$5b$workspace$5d2f$node_modules$2f$react$2f$jsx$2d$runtime$2e$js__$28$ecmascript$29$__ = __turbopack_import__("[workspace]/node_modules/react/jsx-runtime.js (ecmascript)");
var __TURBOPACK__imported__module__$5b$workspace$5d2f$node_modules$2f$next$2f$link$2e$js__$28$ecmascript$29$__ = __turbopack_import__("[workspace]/node_modules/next/link.js (ecmascript)");
var __TURBOPACK__imported__module__$5b$workspace$5d2f$node_modules$2f$next$2f$image$2e$js__$28$ecmascript$29$__ = __turbopack_import__("[workspace]/node_modules/next/image.js (ecmascript)");
var __TURBOPACK__imported__module__$5b$workspace$5d2f$node_modules$2f$react$2f$index$2e$js__$28$ecmascript$29$__ = __turbopack_import__("[workspace]/node_modules/react/index.js (ecmascript)");
"__TURBOPACK__ecmascript__hoisting__location__";
"use client";
;
;
;
;
function SiteHeader(param) {
    let { items, primaryHref, primaryLabel } = param;
    const [scrolled, setScrolled] = __TURBOPACK__imported__module__$5b$workspace$5d2f$node_modules$2f$react$2f$index$2e$js__$28$ecmascript$29$__["useState"](false);
    __TURBOPACK__imported__module__$5b$workspace$5d2f$node_modules$2f$react$2f$index$2e$js__$28$ecmascript$29$__["useEffect"](()=>{
        const handleScroll = ()=>{
            setScrolled(window.scrollY > 24);
        };
        handleScroll();
        window.addEventListener("scroll", handleScroll, {
            passive: true
        });
        return ()=>window.removeEventListener("scroll", handleScroll);
    }, []);
    return /*#__PURE__*/ __TURBOPACK__imported__module__$5b$workspace$5d2f$node_modules$2f$react$2f$jsx$2d$runtime$2e$js__$28$ecmascript$29$__["jsx"]("header", {
        className: `siteHeader ${scrolled ? "siteHeaderScrolled" : ""}`,
        children: /*#__PURE__*/ __TURBOPACK__imported__module__$5b$workspace$5d2f$node_modules$2f$react$2f$jsx$2d$runtime$2e$js__$28$ecmascript$29$__["jsxs"]("div", {
            className: "container siteHeaderInner",
            children: [
                /*#__PURE__*/ __TURBOPACK__imported__module__$5b$workspace$5d2f$node_modules$2f$react$2f$jsx$2d$runtime$2e$js__$28$ecmascript$29$__["jsx"](__TURBOPACK__imported__module__$5b$workspace$5d2f$node_modules$2f$next$2f$link$2e$js__$28$ecmascript$29$__["default"], {
                    href: "/",
                    className: "brandLink",
                    "aria-label": "OpenCrab 首页",
                    children: /*#__PURE__*/ __TURBOPACK__imported__module__$5b$workspace$5d2f$node_modules$2f$react$2f$jsx$2d$runtime$2e$js__$28$ecmascript$29$__["jsx"](__TURBOPACK__imported__module__$5b$workspace$5d2f$node_modules$2f$next$2f$image$2e$js__$28$ecmascript$29$__["default"], {
                        src: "/branding/opencrab-logo.svg",
                        alt: "OpenCrab",
                        width: 164,
                        height: 55,
                        priority: true
                    })
                }),
                /*#__PURE__*/ __TURBOPACK__imported__module__$5b$workspace$5d2f$node_modules$2f$react$2f$jsx$2d$runtime$2e$js__$28$ecmascript$29$__["jsx"]("nav", {
                    className: "siteNav",
                    "aria-label": "主导航",
                    children: items.map((item)=>item.external ? /*#__PURE__*/ __TURBOPACK__imported__module__$5b$workspace$5d2f$node_modules$2f$react$2f$jsx$2d$runtime$2e$js__$28$ecmascript$29$__["jsx"]("a", {
                            href: item.href,
                            className: "siteNavLink",
                            target: "_blank",
                            rel: "noreferrer",
                            children: item.label
                        }, item.href) : /*#__PURE__*/ __TURBOPACK__imported__module__$5b$workspace$5d2f$node_modules$2f$react$2f$jsx$2d$runtime$2e$js__$28$ecmascript$29$__["jsx"](__TURBOPACK__imported__module__$5b$workspace$5d2f$node_modules$2f$next$2f$link$2e$js__$28$ecmascript$29$__["default"], {
                            href: item.href,
                            className: "siteNavLink",
                            children: item.label
                        }, item.href))
                }),
                /*#__PURE__*/ __TURBOPACK__imported__module__$5b$workspace$5d2f$node_modules$2f$react$2f$jsx$2d$runtime$2e$js__$28$ecmascript$29$__["jsx"]("div", {
                    className: "siteHeaderActions",
                    children: /*#__PURE__*/ __TURBOPACK__imported__module__$5b$workspace$5d2f$node_modules$2f$react$2f$jsx$2d$runtime$2e$js__$28$ecmascript$29$__["jsx"](__TURBOPACK__imported__module__$5b$workspace$5d2f$node_modules$2f$next$2f$link$2e$js__$28$ecmascript$29$__["default"], {
                        href: primaryHref,
                        className: "button buttonPrimary headerButton",
                        children: primaryLabel
                    })
                })
            ]
        })
    });
}

})()),
"[workspace]/lib/site-content.ts (ecmascript)": (({ r: __turbopack_require__, f: __turbopack_require_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, l: __turbopack_load__, j: __turbopack_dynamic__, g: global, __dirname, k: __turbopack_refresh__ }) => (() => {

__turbopack_esm__({
    "faqItems": ()=>faqItems,
    "githubUrl": ()=>githubUrl,
    "heroPills": ()=>heroPills,
    "homeNavItems": ()=>homeNavItems,
    "installNavItems": ()=>installNavItems,
    "installRequirements": ()=>installRequirements,
    "installSteps": ()=>installSteps,
    "localFirstFacts": ()=>localFirstFacts,
    "runtimeAgents": ()=>runtimeAgents,
    "scenarios": ()=>scenarios,
    "screenshotRail": ()=>screenshotRail,
    "valueCards": ()=>valueCards,
    "workModes": ()=>workModes
});
const githubUrl = "https://github.com/KetteyMan/opencrab";
const homeNavItems = [
    {
        href: "#difference",
        label: "能力"
    },
    {
        href: "#scenarios",
        label: "场景"
    },
    {
        href: "#team-runtime",
        label: "Team Runtime"
    },
    {
        href: githubUrl,
        label: "GitHub",
        external: true
    }
];
const installNavItems = [
    {
        href: "/",
        label: "首页"
    },
    {
        href: "#requirements",
        label: "安装前提"
    },
    {
        href: githubUrl,
        label: "GitHub",
        external: true
    }
];
const heroPills = [
    "Local-first",
    "Chat-first",
    "Codex-powered",
    "中文优先"
];
const valueCards = [
    {
        title: "聊天是入口，不是终点",
        description: "从同一个对话里继续整理文件、推进任务、接住后续结果，而不是聊完就断。"
    },
    {
        title: "定时任务持续推进",
        description: "把日报、巡检、固定摘要交给 OpenCrab 按计划执行，结果回到原上下文。"
    },
    {
        title: "渠道进入同一工作空间",
        description: "网页、Telegram、飞书不是三套系统，而是回到同一套上下文和记录。"
    },
    {
        title: "本地优先，更可控",
        description: "运行时状态、附件和 secret 不默认散落到第三方云平台，更贴近你的真实工作环境。"
    }
];
const workModes = [
    {
        title: "对话处理工作",
        description: "在熟悉的聊天界面里提问、改写、整理、继续追问，先把主入口做顺手。",
        image: "/screenshots/homepage.png",
        alt: "OpenCrab 聊天首页",
        label: "Chat workspace"
    },
    {
        title: "文件与浏览器辅助执行",
        description: "文件上传、文档读取和浏览器能力放进同一工作流，不用来回切换工具。",
        image: "/screenshots/conversation-thread.png",
        alt: "OpenCrab 对话线程与文件处理",
        label: "Files and browser"
    },
    {
        title: "定时任务持续推进",
        description: "重复工作按计划跑，状态、结果和后续动作都能继续回到当前对话。",
        image: "/screenshots/tasks.png",
        alt: "OpenCrab 定时任务",
        label: "Scheduled jobs"
    },
    {
        title: "渠道接入真实消息入口",
        description: "Telegram / 飞书直接接进来，少搭一层机器人外壳，少丢一层上下文。",
        image: "/screenshots/channels.png",
        alt: "OpenCrab 渠道接入",
        label: "Channels"
    }
];
const scenarios = [
    {
        title: "个人工作台",
        headline: "把研究、整理、改写、文件处理收回到一个稳定界面里。",
        detail: "之前是浏览器、笔记、聊天窗口来回跳；现在是同一个工作台里连续推进。"
    },
    {
        title: "轻自动化工作流",
        headline: "把固定摘要、日报整理、周期巡检交给任务系统盯住节奏。",
        detail: "之前靠人记得做；现在让 OpenCrab 按时间执行，再把结果送回原对话。"
    },
    {
        title: "多入口协作",
        headline: "网页、Telegram、飞书进入的是同一上下文，而不是三套记录。",
        detail: "之前消息散落；现在入口不同，但工作空间还是同一个。"
    }
];
const localFirstFacts = [
    "对话、附件和运行时状态默认落在本地，减少“先上云再说”的惯性。",
    "浏览器连接与工作流由本机环境承接，更适合长期挂在真实工作空间里。",
    "我们只说更可控，不喊绝对安全。这比空话靠谱，也更接近产品当前边界。"
];
const runtimeAgents = [
    {
        name: "项管",
        role: "收束目标、编排执行"
    },
    {
        name: "设计",
        role: "负责视觉与界面判断"
    },
    {
        name: "开发",
        role: "负责代码实现与部署"
    },
    {
        name: "运营",
        role: "负责内容与渠道动作"
    }
];
const screenshotRail = [
    {
        label: "聊天首页",
        image: "/screenshots/homepage.png",
        alt: "OpenCrab 聊天首页截图"
    },
    {
        label: "定时任务",
        image: "/screenshots/tasks.png",
        alt: "OpenCrab 定时任务截图"
    },
    {
        label: "渠道接入",
        image: "/screenshots/channels-overview.png",
        alt: "OpenCrab 渠道概览截图"
    },
    {
        label: "技能管理",
        image: "/screenshots/skills.png",
        alt: "OpenCrab 技能管理截图"
    }
];
const installRequirements = [
    "推荐环境：macOS",
    "Node.js >= 20.9",
    "本机 `codex login status` 可用"
];
const faqItems = [
    {
        question: "OpenCrab 是纯在线 SaaS 吗？",
        answer: "不是。它更像一个本地优先的 AI 工作台，适合想把 AI 接回自己工作环境的人。"
    },
    {
        question: "Team Runtime 现在是什么状态？",
        answer: "它值得写进官网，但只能标为 Preview。方向明确，成熟度还在继续打磨，不装已经完工。"
    },
    {
        question: "为什么首页没有把一堆模型参数摆出来？",
        answer: "因为首页先卖工作方式，不卖参数面板。真正能拉开差异的是工作台，不是配置清单。"
    }
];
const installSteps = [
    {
        title: "确认 Codex 登录状态",
        description: "OpenCrab 当前核心对话能力依赖本机 Codex 登录状态，这一步别装糊涂跳过。",
        command: "codex login\ncodex login status"
    },
    {
        title: "准备运行环境",
        description: "在 macOS 上安装 Node.js，再装 Codex CLI，后面就别用奇怪环境折腾自己。",
        command: "brew install node\nnpm i -g @openai/codex"
    },
    {
        title: "拉取代码并安装依赖",
        description: "拿到仓库后先装依赖，别一上来就改配置。",
        command: "git clone https://github.com/KetteyMan/opencrab.git\ncd opencrab\nnpm install"
    },
    {
        title: "初始化本地配置",
        description: "复制默认环境文件。大多数首次安装场景，不需要先乱改环境变量。",
        command: "cp .env.example .env.local"
    },
    {
        title: "启动开发环境",
        description: "先把网页跑起来，再继续接渠道、任务或团队能力。",
        command: "npm run dev"
    },
    {
        title: "做最短验证",
        description: "打开设置页确认账户连接状态正常，再开始新建对话。",
        command: "open http://127.0.0.1:3000/settings"
    }
];

})()),
"[workspace]/components/install-page.tsx (ecmascript)": (({ r: __turbopack_require__, f: __turbopack_require_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, l: __turbopack_load__, j: __turbopack_dynamic__, g: global, __dirname, k: __turbopack_refresh__ }) => (() => {

__turbopack_esm__({
    "InstallPage": ()=>InstallPage
});
var __TURBOPACK__imported__module__$5b$workspace$5d2f$node_modules$2f$react$2f$jsx$2d$runtime$2e$js__$28$ecmascript$29$__ = __turbopack_import__("[workspace]/node_modules/react/jsx-runtime.js (ecmascript)");
var __TURBOPACK__imported__module__$5b$workspace$5d2f$node_modules$2f$next$2f$link$2e$js__$28$ecmascript$29$__ = __turbopack_import__("[workspace]/node_modules/next/link.js (ecmascript)");
var __TURBOPACK__imported__module__$5b$workspace$5d2f$lib$2f$site$2d$content$2e$ts__$28$ecmascript$29$__ = __turbopack_import__("[workspace]/lib/site-content.ts (ecmascript)");
var __TURBOPACK__imported__module__$5b$workspace$5d2f$components$2f$site$2d$header$2e$tsx__$28$ecmascript$29$__ = __turbopack_import__("[workspace]/components/site-header.tsx (ecmascript)");
"__TURBOPACK__ecmascript__hoisting__location__";
;
;
;
;
function InstallPage() {
    return /*#__PURE__*/ __TURBOPACK__imported__module__$5b$workspace$5d2f$node_modules$2f$react$2f$jsx$2d$runtime$2e$js__$28$ecmascript$29$__["jsxs"]("div", {
        className: "pageShell installPageShell",
        children: [
            /*#__PURE__*/ __TURBOPACK__imported__module__$5b$workspace$5d2f$node_modules$2f$react$2f$jsx$2d$runtime$2e$js__$28$ecmascript$29$__["jsx"](__TURBOPACK__imported__module__$5b$workspace$5d2f$components$2f$site$2d$header$2e$tsx__$28$ecmascript$29$__["SiteHeader"], {
                items: __TURBOPACK__imported__module__$5b$workspace$5d2f$lib$2f$site$2d$content$2e$ts__$28$ecmascript$29$__["installNavItems"],
                primaryHref: "/",
                primaryLabel: "回到首页"
            }),
            /*#__PURE__*/ __TURBOPACK__imported__module__$5b$workspace$5d2f$node_modules$2f$react$2f$jsx$2d$runtime$2e$js__$28$ecmascript$29$__["jsxs"]("main", {
                className: "installPageMain",
                children: [
                    /*#__PURE__*/ __TURBOPACK__imported__module__$5b$workspace$5d2f$node_modules$2f$react$2f$jsx$2d$runtime$2e$js__$28$ecmascript$29$__["jsx"]("section", {
                        className: "installHero",
                        children: /*#__PURE__*/ __TURBOPACK__imported__module__$5b$workspace$5d2f$node_modules$2f$react$2f$jsx$2d$runtime$2e$js__$28$ecmascript$29$__["jsxs"]("div", {
                            className: "container installHeroGrid",
                            children: [
                                /*#__PURE__*/ __TURBOPACK__imported__module__$5b$workspace$5d2f$node_modules$2f$react$2f$jsx$2d$runtime$2e$js__$28$ecmascript$29$__["jsxs"]("div", {
                                    children: [
                                        /*#__PURE__*/ __TURBOPACK__imported__module__$5b$workspace$5d2f$node_modules$2f$react$2f$jsx$2d$runtime$2e$js__$28$ecmascript$29$__["jsx"]("p", {
                                            className: "eyebrow",
                                            children: "Install OpenCrab"
                                        }),
                                        /*#__PURE__*/ __TURBOPACK__imported__module__$5b$workspace$5d2f$node_modules$2f$react$2f$jsx$2d$runtime$2e$js__$28$ecmascript$29$__["jsx"]("h1", {
                                            className: "installTitle",
                                            children: "在 macOS 上启动 OpenCrab 的最短路径。"
                                        }),
                                        /*#__PURE__*/ __TURBOPACK__imported__module__$5b$workspace$5d2f$node_modules$2f$react$2f$jsx$2d$runtime$2e$js__$28$ecmascript$29$__["jsx"]("p", {
                                            className: "installDescription",
                                            children: "先确认环境，再走最短链路。别把安装过程搞成研究项目，先跑起来才有资格谈后面的工作流。"
                                        })
                                    ]
                                }),
                                /*#__PURE__*/ __TURBOPACK__imported__module__$5b$workspace$5d2f$node_modules$2f$react$2f$jsx$2d$runtime$2e$js__$28$ecmascript$29$__["jsxs"]("div", {
                                    className: "softCard installHeroCard",
                                    children: [
                                        /*#__PURE__*/ __TURBOPACK__imported__module__$5b$workspace$5d2f$node_modules$2f$react$2f$jsx$2d$runtime$2e$js__$28$ecmascript$29$__["jsx"]("p", {
                                            className: "installCardLabel",
                                            children: "当前推荐前提"
                                        }),
                                        /*#__PURE__*/ __TURBOPACK__imported__module__$5b$workspace$5d2f$node_modules$2f$react$2f$jsx$2d$runtime$2e$js__$28$ecmascript$29$__["jsx"]("ul", {
                                            className: "requirementList",
                                            id: "requirements",
                                            children: __TURBOPACK__imported__module__$5b$workspace$5d2f$lib$2f$site$2d$content$2e$ts__$28$ecmascript$29$__["installRequirements"].map((item)=>/*#__PURE__*/ __TURBOPACK__imported__module__$5b$workspace$5d2f$node_modules$2f$react$2f$jsx$2d$runtime$2e$js__$28$ecmascript$29$__["jsx"]("li", {
                                                    children: item
                                                }, item))
                                        })
                                    ]
                                })
                            ]
                        })
                    }),
                    /*#__PURE__*/ __TURBOPACK__imported__module__$5b$workspace$5d2f$node_modules$2f$react$2f$jsx$2d$runtime$2e$js__$28$ecmascript$29$__["jsx"]("section", {
                        className: "sectionBlock sectionTint",
                        children: /*#__PURE__*/ __TURBOPACK__imported__module__$5b$workspace$5d2f$node_modules$2f$react$2f$jsx$2d$runtime$2e$js__$28$ecmascript$29$__["jsxs"]("div", {
                            className: "container",
                            children: [
                                /*#__PURE__*/ __TURBOPACK__imported__module__$5b$workspace$5d2f$node_modules$2f$react$2f$jsx$2d$runtime$2e$js__$28$ecmascript$29$__["jsxs"]("div", {
                                    className: "sectionHeading",
                                    children: [
                                        /*#__PURE__*/ __TURBOPACK__imported__module__$5b$workspace$5d2f$node_modules$2f$react$2f$jsx$2d$runtime$2e$js__$28$ecmascript$29$__["jsx"]("p", {
                                            className: "sectionEyebrow",
                                            children: "Quickstart"
                                        }),
                                        /*#__PURE__*/ __TURBOPACK__imported__module__$5b$workspace$5d2f$node_modules$2f$react$2f$jsx$2d$runtime$2e$js__$28$ecmascript$29$__["jsx"]("h2", {
                                            children: "先照这个顺序跑通，再扩展渠道、任务和技能。"
                                        })
                                    ]
                                }),
                                /*#__PURE__*/ __TURBOPACK__imported__module__$5b$workspace$5d2f$node_modules$2f$react$2f$jsx$2d$runtime$2e$js__$28$ecmascript$29$__["jsx"]("div", {
                                    className: "installSteps",
                                    children: __TURBOPACK__imported__module__$5b$workspace$5d2f$lib$2f$site$2d$content$2e$ts__$28$ecmascript$29$__["installSteps"].map((step, index)=>/*#__PURE__*/ __TURBOPACK__imported__module__$5b$workspace$5d2f$node_modules$2f$react$2f$jsx$2d$runtime$2e$js__$28$ecmascript$29$__["jsxs"]("article", {
                                            className: "softCard installStepCard",
                                            children: [
                                                /*#__PURE__*/ __TURBOPACK__imported__module__$5b$workspace$5d2f$node_modules$2f$react$2f$jsx$2d$runtime$2e$js__$28$ecmascript$29$__["jsxs"]("div", {
                                                    className: "installStepTop",
                                                    children: [
                                                        /*#__PURE__*/ __TURBOPACK__imported__module__$5b$workspace$5d2f$node_modules$2f$react$2f$jsx$2d$runtime$2e$js__$28$ecmascript$29$__["jsxs"]("span", {
                                                            className: "installStepIndex",
                                                            children: [
                                                                "0",
                                                                index + 1
                                                            ]
                                                        }),
                                                        /*#__PURE__*/ __TURBOPACK__imported__module__$5b$workspace$5d2f$node_modules$2f$react$2f$jsx$2d$runtime$2e$js__$28$ecmascript$29$__["jsx"]("h3", {
                                                            children: step.title
                                                        })
                                                    ]
                                                }),
                                                /*#__PURE__*/ __TURBOPACK__imported__module__$5b$workspace$5d2f$node_modules$2f$react$2f$jsx$2d$runtime$2e$js__$28$ecmascript$29$__["jsx"]("p", {
                                                    children: step.description
                                                }),
                                                /*#__PURE__*/ __TURBOPACK__imported__module__$5b$workspace$5d2f$node_modules$2f$react$2f$jsx$2d$runtime$2e$js__$28$ecmascript$29$__["jsx"]("pre", {
                                                    className: "commandBlock",
                                                    children: /*#__PURE__*/ __TURBOPACK__imported__module__$5b$workspace$5d2f$node_modules$2f$react$2f$jsx$2d$runtime$2e$js__$28$ecmascript$29$__["jsx"]("code", {
                                                        children: step.command
                                                    })
                                                })
                                            ]
                                        }, step.title))
                                })
                            ]
                        })
                    }),
                    /*#__PURE__*/ __TURBOPACK__imported__module__$5b$workspace$5d2f$node_modules$2f$react$2f$jsx$2d$runtime$2e$js__$28$ecmascript$29$__["jsx"]("section", {
                        className: "sectionBlock",
                        children: /*#__PURE__*/ __TURBOPACK__imported__module__$5b$workspace$5d2f$node_modules$2f$react$2f$jsx$2d$runtime$2e$js__$28$ecmascript$29$__["jsx"]("div", {
                            className: "container",
                            children: /*#__PURE__*/ __TURBOPACK__imported__module__$5b$workspace$5d2f$node_modules$2f$react$2f$jsx$2d$runtime$2e$js__$28$ecmascript$29$__["jsxs"]("div", {
                                className: "installSummary",
                                children: [
                                    /*#__PURE__*/ __TURBOPACK__imported__module__$5b$workspace$5d2f$node_modules$2f$react$2f$jsx$2d$runtime$2e$js__$28$ecmascript$29$__["jsxs"]("div", {
                                        className: "sectionHeading installSummaryCopy",
                                        children: [
                                            /*#__PURE__*/ __TURBOPACK__imported__module__$5b$workspace$5d2f$node_modules$2f$react$2f$jsx$2d$runtime$2e$js__$28$ecmascript$29$__["jsx"]("p", {
                                                className: "sectionEyebrow",
                                                children: "Before you proceed"
                                            }),
                                            /*#__PURE__*/ __TURBOPACK__imported__module__$5b$workspace$5d2f$node_modules$2f$react$2f$jsx$2d$runtime$2e$js__$28$ecmascript$29$__["jsx"]("h2", {
                                                children: "OpenCrab 更适合想把 AI 接回本地工作流的人。"
                                            }),
                                            /*#__PURE__*/ __TURBOPACK__imported__module__$5b$workspace$5d2f$node_modules$2f$react$2f$jsx$2d$runtime$2e$js__$28$ecmascript$29$__["jsx"]("p", {
                                                children: "如果你期待的是纯在线开箱即用 SaaS，这页已经替你筛掉预期偏差了。反过来，如果你就是想要一个本地优先的工作台，这个方向就对。"
                                            })
                                        ]
                                    }),
                                    /*#__PURE__*/ __TURBOPACK__imported__module__$5b$workspace$5d2f$node_modules$2f$react$2f$jsx$2d$runtime$2e$js__$28$ecmascript$29$__["jsxs"]("div", {
                                        className: "softCard installSummarySide",
                                        children: [
                                            /*#__PURE__*/ __TURBOPACK__imported__module__$5b$workspace$5d2f$node_modules$2f$react$2f$jsx$2d$runtime$2e$js__$28$ecmascript$29$__["jsx"]("p", {
                                                className: "installCardLabel",
                                                children: "继续查看"
                                            }),
                                            /*#__PURE__*/ __TURBOPACK__imported__module__$5b$workspace$5d2f$node_modules$2f$react$2f$jsx$2d$runtime$2e$js__$28$ecmascript$29$__["jsxs"]("div", {
                                                className: "ctaGroup ctaGroupCompact",
                                                children: [
                                                    /*#__PURE__*/ __TURBOPACK__imported__module__$5b$workspace$5d2f$node_modules$2f$react$2f$jsx$2d$runtime$2e$js__$28$ecmascript$29$__["jsx"](__TURBOPACK__imported__module__$5b$workspace$5d2f$node_modules$2f$next$2f$link$2e$js__$28$ecmascript$29$__["default"], {
                                                        href: "/",
                                                        className: "button buttonSecondary",
                                                        children: "回到首页"
                                                    }),
                                                    /*#__PURE__*/ __TURBOPACK__imported__module__$5b$workspace$5d2f$node_modules$2f$react$2f$jsx$2d$runtime$2e$js__$28$ecmascript$29$__["jsx"]("a", {
                                                        href: __TURBOPACK__imported__module__$5b$workspace$5d2f$lib$2f$site$2d$content$2e$ts__$28$ecmascript$29$__["githubUrl"],
                                                        className: "button buttonPrimary",
                                                        target: "_blank",
                                                        rel: "noreferrer",
                                                        children: "打开仓库"
                                                    })
                                                ]
                                            })
                                        ]
                                    })
                                ]
                            })
                        })
                    })
                ]
            })
        ]
    });
}

})()),
"[workspace]/pages/install.tsx (ecmascript)": (({ r: __turbopack_require__, f: __turbopack_require_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, l: __turbopack_load__, j: __turbopack_dynamic__, g: global, __dirname, k: __turbopack_refresh__ }) => (() => {

__turbopack_esm__({
    "default": ()=>InstallRoute
});
var __TURBOPACK__imported__module__$5b$workspace$5d2f$node_modules$2f$react$2f$jsx$2d$runtime$2e$js__$28$ecmascript$29$__ = __turbopack_import__("[workspace]/node_modules/react/jsx-runtime.js (ecmascript)");
var __TURBOPACK__imported__module__$5b$workspace$5d2f$node_modules$2f$next$2f$head$2e$js__$28$ecmascript$29$__ = __turbopack_import__("[workspace]/node_modules/next/head.js (ecmascript)");
var __TURBOPACK__imported__module__$5b$workspace$5d2f$components$2f$install$2d$page$2e$tsx__$28$ecmascript$29$__ = __turbopack_import__("[workspace]/components/install-page.tsx (ecmascript)");
"__TURBOPACK__ecmascript__hoisting__location__";
;
;
;
function InstallRoute() {
    return /*#__PURE__*/ __TURBOPACK__imported__module__$5b$workspace$5d2f$node_modules$2f$react$2f$jsx$2d$runtime$2e$js__$28$ecmascript$29$__["jsxs"](__TURBOPACK__imported__module__$5b$workspace$5d2f$node_modules$2f$react$2f$jsx$2d$runtime$2e$js__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ __TURBOPACK__imported__module__$5b$workspace$5d2f$node_modules$2f$react$2f$jsx$2d$runtime$2e$js__$28$ecmascript$29$__["jsxs"](__TURBOPACK__imported__module__$5b$workspace$5d2f$node_modules$2f$next$2f$head$2e$js__$28$ecmascript$29$__["default"], {
                children: [
                    /*#__PURE__*/ __TURBOPACK__imported__module__$5b$workspace$5d2f$node_modules$2f$react$2f$jsx$2d$runtime$2e$js__$28$ecmascript$29$__["jsx"]("title", {
                        children: "安装 OpenCrab"
                    }),
                    /*#__PURE__*/ __TURBOPACK__imported__module__$5b$workspace$5d2f$node_modules$2f$react$2f$jsx$2d$runtime$2e$js__$28$ecmascript$29$__["jsx"]("meta", {
                        name: "description",
                        content: "在 macOS 上安装并启动 OpenCrab 的最短路径。"
                    })
                ]
            }),
            /*#__PURE__*/ __TURBOPACK__imported__module__$5b$workspace$5d2f$node_modules$2f$react$2f$jsx$2d$runtime$2e$js__$28$ecmascript$29$__["jsx"](__TURBOPACK__imported__module__$5b$workspace$5d2f$components$2f$install$2d$page$2e$tsx__$28$ecmascript$29$__["InstallPage"], {})
        ]
    });
}

})()),
"[next]/entry/page-loader.ts/(PAGE)/[workspace]/pages/install.tsx (ecmascript) (ecmascript)": (function({ r: __turbopack_require__, f: __turbopack_require_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, l: __turbopack_load__, j: __turbopack_dynamic__, g: global, __dirname, k: __turbopack_refresh__, m: module, e: exports }) { !function() {

const PAGE_PATH = "/install";
(window.__NEXT_P = window.__NEXT_P || []).push([
    PAGE_PATH,
    ()=>{
        return __turbopack_require__("[workspace]/pages/install.tsx (ecmascript)");
    }
]);
if (module.hot) {
    module.hot.dispose(function() {
        window.__NEXT_P.push([
            PAGE_PATH
        ]);
    });
}

}.call(this) }),
"[next]/build/shims.ts (ecmascript)": (function({ r: __turbopack_require__, f: __turbopack_require_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, l: __turbopack_load__, j: __turbopack_dynamic__, g: global, __dirname, k: __turbopack_refresh__, m: module, e: exports }) { !function() {

// This ensures Next.js uses React 18's APIs (hydrateRoot) instead of React 17's
// (hydrate).
var __TURBOPACK__imported__module__$5b$workspace$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$28$ecmascript$29$__ = __turbopack_import__("[workspace]/node_modules/next/dist/build/polyfills/process.js (ecmascript)");
"__TURBOPACK__ecmascript__hoisting__location__";
__TURBOPACK__imported__module__$5b$workspace$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$28$ecmascript$29$__["default"].env.__NEXT_REACT_ROOT = 'true';

}.call(this) }),
"[next]/build/client/bootstrap.ts (ecmascript)": (({ r: __turbopack_require__, f: __turbopack_require_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, l: __turbopack_load__, j: __turbopack_dynamic__, g: global, __dirname, k: __turbopack_refresh__ }) => (() => {

/**
 * This is the runtime entry point for Next.js Page Router client-side bundles.
 */ var __TURBOPACK__imported__module__$5b$next$5d2f$build$2f$shims$2e$ts__$28$ecmascript$29$__ = __turbopack_import__("[next]/build/shims.ts (ecmascript)");
var __TURBOPACK__imported__module__$5b$workspace$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$index$2e$js__$28$ecmascript$29$__ = __turbopack_import__("[workspace]/node_modules/next/dist/client/index.js (ecmascript)");
"__TURBOPACK__ecmascript__hoisting__location__";
;
;
window.next = {
    version: `${__TURBOPACK__imported__module__$5b$workspace$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$index$2e$js__$28$ecmascript$29$__["version"]}-turbo`,
    // router is initialized later so it has to be live-binded
    get router () {
        return __TURBOPACK__imported__module__$5b$workspace$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$index$2e$js__$28$ecmascript$29$__["router"];
    },
    emitter: __TURBOPACK__imported__module__$5b$workspace$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$index$2e$js__$28$ecmascript$29$__["emitter"]
};
self.__next_set_public_path__ = ()=>{};
__TURBOPACK__imported__module__$5b$workspace$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$index$2e$js__$28$ecmascript$29$__["initialize"]({}).then(()=>__TURBOPACK__imported__module__$5b$workspace$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$index$2e$js__$28$ecmascript$29$__["hydrate"]()).catch(console.error);

})()),
}]);

//# sourceMappingURL=[root of the server]__3c3e93._.js.map