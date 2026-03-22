module.exports = {

"[workspace]/components/site-header.tsx (ecmascript, ssr)": (({ r: __turbopack_require__, f: __turbopack_require_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, l: __turbopack_load__, j: __turbopack_dynamic__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__ }) => (() => {

__turbopack_esm__({
    "SiteHeader": ()=>SiteHeader
});
var __TURBOPACK__external__react$2f$jsx$2d$runtime__ = __turbopack_external_require__("react/jsx-runtime", true);
var __TURBOPACK__imported__module__$5b$workspace$5d2f$node_modules$2f$next$2f$link$2e$js__$28$ecmascript$29$__ = __turbopack_import__("[workspace]/node_modules/next/link.js (ecmascript, ssr)");
var __TURBOPACK__imported__module__$5b$workspace$5d2f$node_modules$2f$next$2f$image$2e$js__$28$ecmascript$29$__ = __turbopack_import__("[workspace]/node_modules/next/image.js (ecmascript, ssr)");
var __TURBOPACK__external__react__ = __turbopack_external_require__("react", true);
"__TURBOPACK__ecmascript__hoisting__location__";
"use client";
;
;
;
;
function SiteHeader({ items, primaryHref, primaryLabel }) {
    const [scrolled, setScrolled] = __TURBOPACK__external__react__["useState"](false);
    __TURBOPACK__external__react__["useEffect"](()=>{
        const handleScroll = ()=>{
            setScrolled(window.scrollY > 24);
        };
        handleScroll();
        window.addEventListener("scroll", handleScroll, {
            passive: true
        });
        return ()=>window.removeEventListener("scroll", handleScroll);
    }, []);
    return /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("header", {
        className: `siteHeader ${scrolled ? "siteHeaderScrolled" : ""}`,
        children: /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsxs"]("div", {
            className: "container siteHeaderInner",
            children: [
                /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"](__TURBOPACK__imported__module__$5b$workspace$5d2f$node_modules$2f$next$2f$link$2e$js__$28$ecmascript$29$__["default"], {
                    href: "/",
                    className: "brandLink",
                    "aria-label": "OpenCrab 首页",
                    children: /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"](__TURBOPACK__imported__module__$5b$workspace$5d2f$node_modules$2f$next$2f$image$2e$js__$28$ecmascript$29$__["default"], {
                        src: "/branding/opencrab-logo.svg",
                        alt: "OpenCrab",
                        width: 164,
                        height: 55,
                        priority: true
                    })
                }),
                /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("nav", {
                    className: "siteNav",
                    "aria-label": "主导航",
                    children: items.map((item)=>item.external ? /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("a", {
                            href: item.href,
                            className: "siteNavLink",
                            target: "_blank",
                            rel: "noreferrer",
                            children: item.label
                        }, item.href) : /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"](__TURBOPACK__imported__module__$5b$workspace$5d2f$node_modules$2f$next$2f$link$2e$js__$28$ecmascript$29$__["default"], {
                            href: item.href,
                            className: "siteNavLink",
                            children: item.label
                        }, item.href))
                }),
                /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("div", {
                    className: "siteHeaderActions",
                    children: /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"](__TURBOPACK__imported__module__$5b$workspace$5d2f$node_modules$2f$next$2f$link$2e$js__$28$ecmascript$29$__["default"], {
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
"[workspace]/lib/site-content.ts (ecmascript, ssr)": (({ r: __turbopack_require__, f: __turbopack_require_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, l: __turbopack_load__, j: __turbopack_dynamic__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__ }) => (() => {

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
"[workspace]/components/home-page.tsx (ecmascript, ssr)": (({ r: __turbopack_require__, f: __turbopack_require_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, l: __turbopack_load__, j: __turbopack_dynamic__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__ }) => (() => {

__turbopack_esm__({
    "HomePage": ()=>HomePage
});
var __TURBOPACK__external__react$2f$jsx$2d$runtime__ = __turbopack_external_require__("react/jsx-runtime", true);
var __TURBOPACK__imported__module__$5b$workspace$5d2f$node_modules$2f$next$2f$image$2e$js__$28$ecmascript$29$__ = __turbopack_import__("[workspace]/node_modules/next/image.js (ecmascript, ssr)");
var __TURBOPACK__imported__module__$5b$workspace$5d2f$node_modules$2f$next$2f$link$2e$js__$28$ecmascript$29$__ = __turbopack_import__("[workspace]/node_modules/next/link.js (ecmascript, ssr)");
var __TURBOPACK__imported__module__$5b$workspace$5d2f$lib$2f$site$2d$content$2e$ts__$28$ecmascript$29$__ = __turbopack_import__("[workspace]/lib/site-content.ts (ecmascript, ssr)");
var __TURBOPACK__imported__module__$5b$workspace$5d2f$components$2f$site$2d$header$2e$tsx__$28$ecmascript$29$__ = __turbopack_import__("[workspace]/components/site-header.tsx (ecmascript, ssr)");
"__TURBOPACK__ecmascript__hoisting__location__";
;
;
;
;
;
function HomePage() {
    return /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsxs"]("div", {
        className: "pageShell",
        children: [
            /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"](__TURBOPACK__imported__module__$5b$workspace$5d2f$components$2f$site$2d$header$2e$tsx__$28$ecmascript$29$__["SiteHeader"], {
                items: __TURBOPACK__imported__module__$5b$workspace$5d2f$lib$2f$site$2d$content$2e$ts__$28$ecmascript$29$__["homeNavItems"],
                primaryHref: "/install",
                primaryLabel: "开始安装"
            }),
            /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsxs"]("main", {
                children: [
                    /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("section", {
                        className: "heroSection",
                        children: /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsxs"]("div", {
                            className: "container heroGrid",
                            children: [
                                /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsxs"]("div", {
                                    className: "heroCopy",
                                    children: [
                                        /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("p", {
                                            className: "eyebrow",
                                            children: "Local-first AI Workspace"
                                        }),
                                        /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsxs"]("h1", {
                                            className: "heroTitle",
                                            children: [
                                                "把聊天、执行、任务和渠道，",
                                                /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("br", {}),
                                                "收进同一个本地优先的 AI 工作台。"
                                            ]
                                        }),
                                        /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("p", {
                                            className: "heroDescription",
                                            children: "OpenCrab 以聊天为主入口，把文件、浏览器、定时任务、Telegram / 飞书和正在进化中的 Team Runtime 放进同一个工作空间。"
                                        }),
                                        /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsxs"]("div", {
                                            className: "ctaGroup",
                                            children: [
                                                /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"](__TURBOPACK__imported__module__$5b$workspace$5d2f$node_modules$2f$next$2f$link$2e$js__$28$ecmascript$29$__["default"], {
                                                    href: "/install",
                                                    className: "button buttonPrimary",
                                                    children: "查看安装方式"
                                                }),
                                                /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("a", {
                                                    href: __TURBOPACK__imported__module__$5b$workspace$5d2f$lib$2f$site$2d$content$2e$ts__$28$ecmascript$29$__["githubUrl"],
                                                    className: "button buttonSecondary",
                                                    target: "_blank",
                                                    rel: "noreferrer",
                                                    children: "查看 GitHub"
                                                })
                                            ]
                                        }),
                                        /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("ul", {
                                            className: "pillRow",
                                            "aria-label": "产品标签",
                                            children: __TURBOPACK__imported__module__$5b$workspace$5d2f$lib$2f$site$2d$content$2e$ts__$28$ecmascript$29$__["heroPills"].map((pill)=>/*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("li", {
                                                    className: "pill",
                                                    children: pill
                                                }, pill))
                                        }),
                                        /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("p", {
                                            className: "heroMeta",
                                            children: "面向中文 AI 重度用户、独立开发者、小团队工作流搭建者。别把它理解成另一个聊天套壳，方向从一开始就不是那个。"
                                        })
                                    ]
                                }),
                                /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsxs"]("div", {
                                    className: "heroStage",
                                    children: [
                                        /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsxs"]("div", {
                                            className: "ambientSlot",
                                            children: [
                                                /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("span", {
                                                    className: "ambientSlotLabel",
                                                    children: "Future motion layer"
                                                }),
                                                /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("p", {
                                                    children: "预留 6-10 秒静音氛围视频位，当前先用低对比纹理占位，不拿空镜头装产品力。"
                                                })
                                            ]
                                        }),
                                        /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsxs"]("div", {
                                            className: "stageFrame stageMain",
                                            children: [
                                                /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsxs"]("div", {
                                                    className: "frameTopline",
                                                    children: [
                                                        /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("span", {
                                                            children: "产品主界面"
                                                        }),
                                                        /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("span", {
                                                            children: "Chat-first workspace"
                                                        })
                                                    ]
                                                }),
                                                /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"](__TURBOPACK__imported__module__$5b$workspace$5d2f$node_modules$2f$next$2f$image$2e$js__$28$ecmascript$29$__["default"], {
                                                    src: "/screenshots/homepage.png",
                                                    alt: "OpenCrab 首页界面",
                                                    width: 2880,
                                                    height: 1822,
                                                    priority: true
                                                })
                                            ]
                                        }),
                                        /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsxs"]("article", {
                                            className: "floatingCard floatingCardTask",
                                            children: [
                                                /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsxs"]("div", {
                                                    className: "floatingCardHeader",
                                                    children: [
                                                        /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("span", {
                                                            children: "定时任务"
                                                        }),
                                                        /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("span", {
                                                            children: "持续推进"
                                                        })
                                                    ]
                                                }),
                                                /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("h2", {
                                                    children: "把重复工作交给计划执行"
                                                }),
                                                /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("p", {
                                                    children: "日报、周回顾、固定巡检不该一直靠人记着。"
                                                }),
                                                /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsxs"]("div", {
                                                    className: "miniChecklist",
                                                    children: [
                                                        /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("span", {
                                                            children: "每日 09:00"
                                                        }),
                                                        /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("span", {
                                                            children: "结果回到原对话"
                                                        })
                                                    ]
                                                })
                                            ]
                                        }),
                                        /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsxs"]("article", {
                                            className: "floatingCard floatingCardChannel",
                                            children: [
                                                /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsxs"]("div", {
                                                    className: "floatingCardHeader",
                                                    children: [
                                                        /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("span", {
                                                            children: "渠道接入"
                                                        }),
                                                        /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("span", {
                                                            children: "同一上下文"
                                                        })
                                                    ]
                                                }),
                                                /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("h2", {
                                                    children: "Telegram / 飞书回到同一个工作空间"
                                                }),
                                                /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("p", {
                                                    children: "入口不同，记录别再散落。"
                                                }),
                                                /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsxs"]("div", {
                                                    className: "channelTokens",
                                                    children: [
                                                        /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("span", {
                                                            children: "TG"
                                                        }),
                                                        /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("span", {
                                                            children: "FS"
                                                        }),
                                                        /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("span", {
                                                            children: "Web"
                                                        })
                                                    ]
                                                })
                                            ]
                                        })
                                    ]
                                })
                            ]
                        })
                    }),
                    /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("section", {
                        className: "sectionBlock",
                        id: "difference",
                        children: /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsxs"]("div", {
                            className: "container",
                            children: [
                                /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsxs"]("div", {
                                    className: "sectionHeading",
                                    children: [
                                        /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("p", {
                                            className: "sectionEyebrow",
                                            children: "Not another chat page"
                                        }),
                                        /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("h2", {
                                            children: "它不是另一个 AI 聊天页，而是能在同一工作空间里继续做事。"
                                        }),
                                        /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("p", {
                                            children: "首页先把这件事讲清楚，比罗列一堆模型、参数和概念词有用得多。"
                                        })
                                    ]
                                }),
                                /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("div", {
                                    className: "valueGrid",
                                    children: __TURBOPACK__imported__module__$5b$workspace$5d2f$lib$2f$site$2d$content$2e$ts__$28$ecmascript$29$__["valueCards"].map((item)=>/*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsxs"]("article", {
                                            className: "softCard valueCard",
                                            children: [
                                                /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("h3", {
                                                    children: item.title
                                                }),
                                                /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("p", {
                                                    children: item.description
                                                })
                                            ]
                                        }, item.title))
                                })
                            ]
                        })
                    }),
                    /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("section", {
                        className: "sectionBlock sectionTint",
                        children: /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsxs"]("div", {
                            className: "container",
                            children: [
                                /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsxs"]("div", {
                                    className: "sectionHeading",
                                    children: [
                                        /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("p", {
                                            className: "sectionEyebrow",
                                            children: "Four work modes"
                                        }),
                                        /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("h2", {
                                            children: "一个工作空间，四种工作方式。"
                                        }),
                                        /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("p", {
                                            children: "从能力描述切到实际工作方式，用户才知道它为什么值得装在自己的机器上。"
                                        })
                                    ]
                                }),
                                /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("div", {
                                    className: "featureGrid",
                                    children: __TURBOPACK__imported__module__$5b$workspace$5d2f$lib$2f$site$2d$content$2e$ts__$28$ecmascript$29$__["workModes"].map((item)=>/*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsxs"]("article", {
                                            className: "softCard featureCard",
                                            children: [
                                                /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsxs"]("div", {
                                                    className: "featureCardCopy",
                                                    children: [
                                                        /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("p", {
                                                            className: "featureLabel",
                                                            children: item.label
                                                        }),
                                                        /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("h3", {
                                                            children: item.title
                                                        }),
                                                        /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("p", {
                                                            children: item.description
                                                        })
                                                    ]
                                                }),
                                                /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("div", {
                                                    className: "featureImageWrap",
                                                    children: /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"](__TURBOPACK__imported__module__$5b$workspace$5d2f$node_modules$2f$next$2f$image$2e$js__$28$ecmascript$29$__["default"], {
                                                        src: item.image,
                                                        alt: item.alt,
                                                        width: 2880,
                                                        height: 1822
                                                    })
                                                })
                                            ]
                                        }, item.title))
                                })
                            ]
                        })
                    }),
                    /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("section", {
                        className: "sectionBlock",
                        id: "scenarios",
                        children: /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsxs"]("div", {
                            className: "container",
                            children: [
                                /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsxs"]("div", {
                                    className: "sectionHeading",
                                    children: [
                                        /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("p", {
                                            className: "sectionEyebrow",
                                            children: "Scenarios"
                                        }),
                                        /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("h2", {
                                            children: "最适合 OpenCrab 的三类场景。"
                                        }),
                                        /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("p", {
                                            children: "讲清“之前怎么做，现在怎么做”，比摆一张大而空的流程图强得多。"
                                        })
                                    ]
                                }),
                                /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("div", {
                                    className: "scenarioGrid",
                                    children: __TURBOPACK__imported__module__$5b$workspace$5d2f$lib$2f$site$2d$content$2e$ts__$28$ecmascript$29$__["scenarios"].map((scenario)=>/*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsxs"]("article", {
                                            className: "scenarioCard",
                                            children: [
                                                /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("p", {
                                                    className: "scenarioIndex",
                                                    children: scenario.title
                                                }),
                                                /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("h3", {
                                                    children: scenario.headline
                                                }),
                                                /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("p", {
                                                    children: scenario.detail
                                                })
                                            ]
                                        }, scenario.title))
                                })
                            ]
                        })
                    }),
                    /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("section", {
                        className: "sectionBlock",
                        children: /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("div", {
                            className: "container",
                            children: /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsxs"]("div", {
                                className: "localFirstPanel",
                                children: [
                                    /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsxs"]("div", {
                                        className: "localFirstLead",
                                        children: [
                                            /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("p", {
                                                className: "sectionEyebrow",
                                                children: "Local-first, for real"
                                            }),
                                            /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("h2", {
                                                children: "本地优先，不是喊口号，而是把 AI 接回你自己的工作环境。"
                                            }),
                                            /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("p", {
                                                children: "我们不吹“绝对安全”。更可控、更贴近本机工作流、能长期挂在真实环境里，这才是现在能成立的判断。"
                                            })
                                        ]
                                    }),
                                    /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("div", {
                                        className: "localFirstFacts",
                                        children: __TURBOPACK__imported__module__$5b$workspace$5d2f$lib$2f$site$2d$content$2e$ts__$28$ecmascript$29$__["localFirstFacts"].map((fact)=>/*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("article", {
                                                className: "softCard factCard",
                                                children: /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("p", {
                                                    children: fact
                                                })
                                            }, fact))
                                    })
                                ]
                            })
                        })
                    }),
                    /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("section", {
                        className: "sectionBlock sectionTint",
                        id: "team-runtime",
                        children: /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsxs"]("div", {
                            className: "container teamRuntimeGrid",
                            children: [
                                /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsxs"]("div", {
                                    className: "sectionHeading teamRuntimeCopy",
                                    children: [
                                        /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("p", {
                                            className: "sectionEyebrow",
                                            children: "Preview"
                                        }),
                                        /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("h2", {
                                            children: "从单人工作台，延伸到团队协作运行时。"
                                        }),
                                        /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("p", {
                                            children: "这段值得放首页，因为它确实有差异化。但也只能标 Preview，别把未来规划写得像今天已经完全成熟，那是营销病。"
                                        }),
                                        /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsxs"]("div", {
                                            className: "previewNote",
                                            children: [
                                                /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("span", {
                                                    className: "pill",
                                                    children: "Coming next"
                                                }),
                                                /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("span", {
                                                    className: "pill",
                                                    children: "Frontstage / Backstage"
                                                })
                                            ]
                                        })
                                    ]
                                }),
                                /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsxs"]("div", {
                                    className: "runtimeDiagram softCard",
                                    children: [
                                        /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsxs"]("div", {
                                            className: "runtimeStage runtimeStageFront",
                                            children: [
                                                /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("p", {
                                                    className: "runtimeStageLabel",
                                                    children: "前台团队群聊"
                                                }),
                                                /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("h3", {
                                                    children: "共享目标、补充上下文、接收结果"
                                                })
                                            ]
                                        }),
                                        /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("div", {
                                            className: "runtimeConnector",
                                            "aria-hidden": "true"
                                        }),
                                        /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsxs"]("div", {
                                            className: "runtimeStage runtimeStageCore",
                                            children: [
                                                /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("p", {
                                                    className: "runtimeStageLabel",
                                                    children: "项目经理编排"
                                                }),
                                                /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("h3", {
                                                    children: "分工、排序、收口，而不是所有角色一起刷屏。"
                                                })
                                            ]
                                        }),
                                        /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("div", {
                                            className: "runtimeAgentGrid",
                                            children: __TURBOPACK__imported__module__$5b$workspace$5d2f$lib$2f$site$2d$content$2e$ts__$28$ecmascript$29$__["runtimeAgents"].map((agent)=>/*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsxs"]("article", {
                                                    className: "runtimeAgent",
                                                    children: [
                                                        /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("strong", {
                                                            children: agent.name
                                                        }),
                                                        /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("span", {
                                                            children: agent.role
                                                        })
                                                    ]
                                                }, agent.name))
                                        })
                                    ]
                                })
                            ]
                        })
                    }),
                    /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("section", {
                        className: "sectionBlock",
                        children: /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsxs"]("div", {
                            className: "container",
                            children: [
                                /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsxs"]("div", {
                                    className: "sectionHeading",
                                    children: [
                                        /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("p", {
                                            className: "sectionEyebrow",
                                            children: "Product proof"
                                        }),
                                        /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("h2", {
                                            children: "真实界面先拿出来，信任感才站得住。"
                                        }),
                                        /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("p", {
                                            children: "截图不够完美可以继续换，但别用一堆抽象海报代替产品证据。"
                                        })
                                    ]
                                }),
                                /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("div", {
                                    className: "screenshotRail",
                                    children: __TURBOPACK__imported__module__$5b$workspace$5d2f$lib$2f$site$2d$content$2e$ts__$28$ecmascript$29$__["screenshotRail"].map((shot)=>/*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsxs"]("figure", {
                                            className: "screenshotCard",
                                            children: [
                                                /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("figcaption", {
                                                    children: shot.label
                                                }),
                                                /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"](__TURBOPACK__imported__module__$5b$workspace$5d2f$node_modules$2f$next$2f$image$2e$js__$28$ecmascript$29$__["default"], {
                                                    src: shot.image,
                                                    alt: shot.alt,
                                                    width: 2880,
                                                    height: 1822
                                                })
                                            ]
                                        }, shot.label))
                                })
                            ]
                        })
                    }),
                    /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("section", {
                        className: "sectionBlock",
                        id: "install",
                        children: /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("div", {
                            className: "container",
                            children: /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsxs"]("div", {
                                className: "installPanel",
                                children: [
                                    /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsxs"]("div", {
                                        className: "installPanelLead",
                                        children: [
                                            /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("p", {
                                                className: "sectionEyebrow",
                                                children: "Install and expectations"
                                            }),
                                            /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("h2", {
                                                children: "先确认预期，再开始安装。"
                                            }),
                                            /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("p", {
                                                children: "OpenCrab 当前不是点开即用的纯在线 SaaS。它更适合愿意把 AI 接回本地工作流、接受 macOS 与 Codex 登录前提的用户。"
                                            })
                                        ]
                                    }),
                                    /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsxs"]("div", {
                                        className: "installPanelSide softCard",
                                        children: [
                                            /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("ul", {
                                                className: "requirementList",
                                                children: __TURBOPACK__imported__module__$5b$workspace$5d2f$lib$2f$site$2d$content$2e$ts__$28$ecmascript$29$__["installRequirements"].map((item)=>/*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("li", {
                                                        children: item
                                                    }, item))
                                            }),
                                            /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsxs"]("div", {
                                                className: "ctaGroup ctaGroupCompact",
                                                children: [
                                                    /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"](__TURBOPACK__imported__module__$5b$workspace$5d2f$node_modules$2f$next$2f$link$2e$js__$28$ecmascript$29$__["default"], {
                                                        href: "/install",
                                                        className: "button buttonPrimary",
                                                        children: "开始安装"
                                                    }),
                                                    /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("a", {
                                                        href: __TURBOPACK__imported__module__$5b$workspace$5d2f$lib$2f$site$2d$content$2e$ts__$28$ecmascript$29$__["githubUrl"],
                                                        className: "button buttonSecondary",
                                                        target: "_blank",
                                                        rel: "noreferrer",
                                                        children: "打开 GitHub"
                                                    })
                                                ]
                                            })
                                        ]
                                    })
                                ]
                            })
                        })
                    }),
                    /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("section", {
                        className: "sectionBlock sectionFaq",
                        children: /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsxs"]("div", {
                            className: "container",
                            children: [
                                /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsxs"]("div", {
                                    className: "sectionHeading",
                                    children: [
                                        /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("p", {
                                            className: "sectionEyebrow",
                                            children: "FAQ"
                                        }),
                                        /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("h2", {
                                            children: "把该说清的边界说清，比强行装大成熟更重要。"
                                        })
                                    ]
                                }),
                                /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("div", {
                                    className: "faqGrid",
                                    children: __TURBOPACK__imported__module__$5b$workspace$5d2f$lib$2f$site$2d$content$2e$ts__$28$ecmascript$29$__["faqItems"].map((item)=>/*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsxs"]("article", {
                                            className: "softCard faqCard",
                                            children: [
                                                /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("h3", {
                                                    children: item.question
                                                }),
                                                /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("p", {
                                                    children: item.answer
                                                })
                                            ]
                                        }, item.question))
                                })
                            ]
                        })
                    })
                ]
            }),
            /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("footer", {
                className: "siteFooter",
                children: /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsxs"]("div", {
                    className: "container footerInner",
                    children: [
                        /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsxs"]("div", {
                            children: [
                                /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("p", {
                                    className: "footerBrand",
                                    children: "OpenCrab"
                                }),
                                /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("p", {
                                    className: "footerText",
                                    children: "本地优先的 AI 工作台。先把聊天、执行、任务和渠道收回同一个空间，再谈后面的团队协作。"
                                })
                            ]
                        }),
                        /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsxs"]("div", {
                            className: "footerLinks",
                            children: [
                                /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("a", {
                                    href: __TURBOPACK__imported__module__$5b$workspace$5d2f$lib$2f$site$2d$content$2e$ts__$28$ecmascript$29$__["githubUrl"],
                                    target: "_blank",
                                    rel: "noreferrer",
                                    children: "GitHub"
                                }),
                                /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("a", {
                                    href: "mailto:sky@opencrab-ai.com",
                                    children: "sky@opencrab-ai.com"
                                }),
                                /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"](__TURBOPACK__imported__module__$5b$workspace$5d2f$node_modules$2f$next$2f$link$2e$js__$28$ecmascript$29$__["default"], {
                                    href: "/install",
                                    children: "安装方式"
                                })
                            ]
                        })
                    ]
                })
            })
        ]
    });
}

})()),
"[workspace]/pages/index.tsx (ecmascript, ssr)": (({ r: __turbopack_require__, f: __turbopack_require_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, l: __turbopack_load__, j: __turbopack_dynamic__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__ }) => (() => {

__turbopack_esm__({
    "default": ()=>HomeRoute
});
var __TURBOPACK__external__react$2f$jsx$2d$runtime__ = __turbopack_external_require__("react/jsx-runtime", true);
var __TURBOPACK__imported__module__$5b$workspace$5d2f$node_modules$2f$next$2f$head$2e$js__$28$ecmascript$29$__ = __turbopack_import__("[workspace]/node_modules/next/head.js (ecmascript, ssr)");
var __TURBOPACK__imported__module__$5b$workspace$5d2f$components$2f$home$2d$page$2e$tsx__$28$ecmascript$29$__ = __turbopack_import__("[workspace]/components/home-page.tsx (ecmascript, ssr)");
"__TURBOPACK__ecmascript__hoisting__location__";
;
;
;
function HomeRoute() {
    return /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsxs"](__TURBOPACK__external__react$2f$jsx$2d$runtime__["Fragment"], {
        children: [
            /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsxs"](__TURBOPACK__imported__module__$5b$workspace$5d2f$node_modules$2f$next$2f$head$2e$js__$28$ecmascript$29$__["default"], {
                children: [
                    /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("title", {
                        children: "OpenCrab | 本地优先的 AI 工作台"
                    }),
                    /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("meta", {
                        name: "description",
                        content: "把聊天、执行、任务和渠道，收进同一个本地优先的 AI 工作台。"
                    })
                ]
            }),
            /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"](__TURBOPACK__imported__module__$5b$workspace$5d2f$components$2f$home$2d$page$2e$tsx__$28$ecmascript$29$__["HomePage"], {})
        ]
    });
}

})()),
"[next]/internal/font/google/instrument_serif_5fce7eec.module.css (css module, ssr)": (({ r: __turbopack_require__, f: __turbopack_require_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, l: __turbopack_load__, j: __turbopack_dynamic__, g: global, __dirname }) => (() => {

__turbopack_export_value__({
  "className": "className__instrument_serif_5fce7eec__82f8c45",
  "variable": "variable__instrument_serif_5fce7eec__82f8c45",
});

})()),
"[next]/internal/font/google/instrument_serif_5fce7eec.js (ecmascript, ssr)": (({ r: __turbopack_require__, f: __turbopack_require_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, l: __turbopack_load__, j: __turbopack_dynamic__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__ }) => (() => {

__turbopack_esm__({
    "default": ()=>__TURBOPACK__default__export__
});
var __TURBOPACK__imported__module__$5b$next$5d2f$internal$2f$font$2f$google$2f$instrument_serif_5fce7eec$2e$module$2e$css__$28$css__module$29$__ = __turbopack_import__("[next]/internal/font/google/instrument_serif_5fce7eec.module.css (css module, ssr)");
"__TURBOPACK__ecmascript__hoisting__location__";
;
const fontData = {
    className: __TURBOPACK__imported__module__$5b$next$5d2f$internal$2f$font$2f$google$2f$instrument_serif_5fce7eec$2e$module$2e$css__$28$css__module$29$__["default"].className,
    style: {
        fontFamily: "'__Instrument_Serif_5fce7e'",
        fontWeight: 400,
        fontStyle: "normal"
    }
};
if (__TURBOPACK__imported__module__$5b$next$5d2f$internal$2f$font$2f$google$2f$instrument_serif_5fce7eec$2e$module$2e$css__$28$css__module$29$__["default"].variable != null) {
    fontData.variable = __TURBOPACK__imported__module__$5b$next$5d2f$internal$2f$font$2f$google$2f$instrument_serif_5fce7eec$2e$module$2e$css__$28$css__module$29$__["default"].variable;
}
const __TURBOPACK__default__export__ = fontData;

})()),
"[next]/internal/font/google/instrument_sans_8beb6112.module.css (css module, ssr)": (({ r: __turbopack_require__, f: __turbopack_require_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, l: __turbopack_load__, j: __turbopack_dynamic__, g: global, __dirname }) => (() => {

__turbopack_export_value__({
  "className": "className__instrument_sans_8beb6112__95cf5f96",
  "variable": "variable__instrument_sans_8beb6112__95cf5f96",
});

})()),
"[next]/internal/font/google/instrument_sans_8beb6112.js (ecmascript, ssr)": (({ r: __turbopack_require__, f: __turbopack_require_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, l: __turbopack_load__, j: __turbopack_dynamic__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__ }) => (() => {

__turbopack_esm__({
    "default": ()=>__TURBOPACK__default__export__
});
var __TURBOPACK__imported__module__$5b$next$5d2f$internal$2f$font$2f$google$2f$instrument_sans_8beb6112$2e$module$2e$css__$28$css__module$29$__ = __turbopack_import__("[next]/internal/font/google/instrument_sans_8beb6112.module.css (css module, ssr)");
"__TURBOPACK__ecmascript__hoisting__location__";
;
const fontData = {
    className: __TURBOPACK__imported__module__$5b$next$5d2f$internal$2f$font$2f$google$2f$instrument_sans_8beb6112$2e$module$2e$css__$28$css__module$29$__["default"].className,
    style: {
        fontFamily: "'__Instrument_Sans_8beb61'",
        fontStyle: "normal"
    }
};
if (__TURBOPACK__imported__module__$5b$next$5d2f$internal$2f$font$2f$google$2f$instrument_sans_8beb6112$2e$module$2e$css__$28$css__module$29$__["default"].variable != null) {
    fontData.variable = __TURBOPACK__imported__module__$5b$next$5d2f$internal$2f$font$2f$google$2f$instrument_sans_8beb6112$2e$module$2e$css__$28$css__module$29$__["default"].variable;
}
const __TURBOPACK__default__export__ = fontData;

})()),
"[workspace]/pages/_app.tsx (ecmascript, ssr)": (({ r: __turbopack_require__, f: __turbopack_require_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, l: __turbopack_load__, j: __turbopack_dynamic__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__ }) => (() => {

__turbopack_esm__({
    "default": ()=>App
});
var __TURBOPACK__imported__module__$5b$next$5d2f$internal$2f$font$2f$google$2f$instrument_sans_8beb6112$2e$js__$28$ecmascript$29$__ = __turbopack_import__("[next]/internal/font/google/instrument_sans_8beb6112.js (ecmascript, ssr)");
var __TURBOPACK__imported__module__$5b$next$5d2f$internal$2f$font$2f$google$2f$instrument_serif_5fce7eec$2e$js__$28$ecmascript$29$__ = __turbopack_import__("[next]/internal/font/google/instrument_serif_5fce7eec.js (ecmascript, ssr)");
var __TURBOPACK__external__react$2f$jsx$2d$runtime__ = __turbopack_external_require__("react/jsx-runtime", true);
"__TURBOPACK__ecmascript__hoisting__location__";
;
;
;
;
function App({ Component, pageProps }) {
    return /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("div", {
        className: `${__TURBOPACK__imported__module__$5b$next$5d2f$internal$2f$font$2f$google$2f$instrument_sans_8beb6112$2e$js__$28$ecmascript$29$__["default"].variable} ${__TURBOPACK__imported__module__$5b$next$5d2f$internal$2f$font$2f$google$2f$instrument_serif_5fce7eec$2e$js__$28$ecmascript$29$__["default"].variable}`,
        children: /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"](Component, {
            ...pageProps
        })
    });
}

})()),
"[workspace]/pages/_document.tsx (ecmascript, ssr)": (({ r: __turbopack_require__, f: __turbopack_require_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, l: __turbopack_load__, j: __turbopack_dynamic__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__ }) => (() => {

__turbopack_esm__({
    "default": ()=>Document
});
var __TURBOPACK__external__react$2f$jsx$2d$runtime__ = __turbopack_external_require__("react/jsx-runtime", true);
var __TURBOPACK__imported__module__$5b$workspace$5d2f$node_modules$2f$next$2f$document$2e$js__$28$ecmascript$29$__ = __turbopack_import__("[workspace]/node_modules/next/document.js (ecmascript, ssr)");
"__TURBOPACK__ecmascript__hoisting__location__";
;
;
function Document() {
    return /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsxs"](__TURBOPACK__imported__module__$5b$workspace$5d2f$node_modules$2f$next$2f$document$2e$js__$28$ecmascript$29$__["Html"], {
        lang: "zh-CN",
        children: [
            /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"](__TURBOPACK__imported__module__$5b$workspace$5d2f$node_modules$2f$next$2f$document$2e$js__$28$ecmascript$29$__["Head"], {
                children: /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"]("link", {
                    rel: "icon",
                    href: "/branding/opencrab-mark.svg",
                    type: "image/svg+xml"
                })
            }),
            /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsxs"]("body", {
                children: [
                    /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"](__TURBOPACK__imported__module__$5b$workspace$5d2f$node_modules$2f$next$2f$document$2e$js__$28$ecmascript$29$__["Main"], {}),
                    /*#__PURE__*/ __TURBOPACK__external__react$2f$jsx$2d$runtime__["jsx"](__TURBOPACK__imported__module__$5b$workspace$5d2f$node_modules$2f$next$2f$document$2e$js__$28$ecmascript$29$__["NextScript"], {})
                ]
            })
        ]
    });
}

})()),

};

//# sourceMappingURL=[root of the server]__70639f._.js.map