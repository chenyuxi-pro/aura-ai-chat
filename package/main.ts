import "./src/index.js";
import { AuraToolRisk } from "./src/index.js";
import type {
    AuraConfig,
    AuraEvent,
    AuraTool,
    ChatMessage,
    Conversation,
    IConversationManager,
    Skill,
} from "./src/index.js";

type DemoTool = AuraTool & { enabled?: boolean };
type DemoSkill = Skill & { enabled?: boolean };
type DemoConfig = AuraConfig & {
    appearance: NonNullable<AuraConfig["appearance"]>;
    providers: NonNullable<AuraConfig["providers"]>;
    agent: NonNullable<AuraConfig["agent"]> & {
        skills: DemoSkill[];
        tools: DemoTool[];
    };
};

const conversations = new Map<string, Conversation>();

function makeConversation(id: string = crypto.randomUUID()): Conversation {
    const now = Date.now();
    return {
        id,
        messages: [],
        createdAt: now,
        updatedAt: now,
        title: `Chat ${conversations.size + 1}`,
    };
}

const conversationManager: IConversationManager = {
    async createConversation(conversation?: Conversation) {
        const conv = conversation?.id ? conversation : makeConversation();
        conversations.set(conv.id, { ...conv, messages: [...(conv.messages ?? [])] });
        return conv;
    },
    async loadConversation(conversationId: string) {
        return conversations.get(conversationId) ?? null;
    },
    async listConversations() {
        return Array.from(conversations.values()).sort((a, b) => b.updatedAt - a.updatedAt);
    },
    async saveMessage(conversationId: string, message: ChatMessage) {
        const conv = conversations.get(conversationId) ?? makeConversation(conversationId);
        conv.messages.push(message);
        conv.updatedAt = Date.now();
        if (!conv.title || conv.title.startsWith("Chat ")) {
            const firstUser = conv.messages.find((m) => m.role === "user");
            if (firstUser) conv.title = firstUser.content.slice(0, 60);
        }
        conversations.set(conversationId, conv);
    },
    async deleteConversation(conversationId: string) {
        conversations.delete(conversationId);
    },
    async clearHistory() {
        conversations.clear();
    },
};

const marketTape = {
    ALTO: {
        symbol: "ALTO",
        name: "Alto Systems",
        assetClass: "Equity",
        venue: "AURA-X",
        last: 207.84,
        changePct: 1.1,
        volume: "68.4M",
        trend: "holding above the 20 day average after a strong product-cycle breakout",
        support: 205.6,
        resistance: 210.4,
        liquidity: "deep",
    },
    NOVA: {
        symbol: "NOVA",
        name: "Nova Circuits",
        assetClass: "Equity",
        venue: "AURA-X",
        last: 869.15,
        changePct: 2.9,
        volume: "51.2M",
        trend: "breaking higher with momentum buyers still in control",
        support: 852.0,
        resistance: 884.0,
        liquidity: "deep",
    },
    PYRA: {
        symbol: "PYRA",
        name: "Pyra Mobility",
        assetClass: "Equity",
        venue: "AURA-X",
        last: 176.9,
        changePct: -1.4,
        volume: "94.6M",
        trend: "trading heavy after another failed bounce at resistance",
        support: 172.5,
        resistance: 181.8,
        liquidity: "deep",
    },
    MERC: {
        symbol: "MERC",
        name: "Meridian Cloud",
        assetClass: "Equity",
        venue: "AURA-X",
        last: 420.0,
        changePct: 0.7,
        volume: "24.1M",
        trend: "steady grind higher with strong dip-buying",
        support: 416.0,
        resistance: 424.5,
        liquidity: "deep",
    },
    ORB: {
        symbol: "ORB",
        name: "Orbit Credit",
        assetClass: "Crypto",
        venue: "Nebula Exchange",
        last: 68_450,
        changePct: 1.8,
        volume: "$32.1B",
        trend: "compressing near yearly highs after a strong trend leg",
        support: 67_100,
        resistance: 69_500,
        liquidity: "deep",
    },
    LYRA: {
        symbol: "LYRA",
        name: "Lyra Mesh",
        assetClass: "Crypto",
        venue: "Nebula Exchange",
        last: 3_640,
        changePct: 2.2,
        volume: "$14.8B",
        trend: "following ORB higher with improving relative strength",
        support: 3_560,
        resistance: 3_720,
        liquidity: "deep",
    },
} as const;

const newsFeed = {
    ALTO: {
        tone: "positive",
        score: 0.71,
        takeaway: "Recurring software demand is offsetting softer device commentary.",
        headlines: [
            "Desk notes persistent upside positioning after Alto's device launch cycle.",
            "Quality growth rotation is keeping Alto near the top of the software-hardware basket.",
        ],
    },
    NOVA: {
        tone: "strongly positive",
        score: 0.88,
        takeaway: "Accelerator demand is still dominating the tape.",
        headlines: [
            "Supply-chain checks point to another quarter of tight Nova rack demand.",
            "Synthetic-chip basket flows remain skewed toward momentum longs.",
        ],
    },
    PYRA: {
        tone: "mixed",
        score: 0.42,
        takeaway: "Narrative remains noisy and the tape is reacting poorly to execution concerns.",
        headlines: [
            "Desk debate is focused on pricing pressure and uneven vehicle rollout pacing.",
            "Short-term positioning is crowded and intraday reversals have been sharp.",
        ],
    },
    ORB: {
        tone: "positive",
        score: 0.77,
        takeaway: "Macro liquidity and treasury inflows continue to anchor dip buying.",
        headlines: [
            "Spot demand remains firm while funding stays manageable across the venue complex.",
            "Cross-asset desks still see ORB as a high-beta liquidity trade.",
        ],
    },
    LYRA: {
        tone: "positive",
        score: 0.69,
        takeaway: "Relative strength is improving as risk appetite broadens beyond ORB.",
        headlines: [
            "Traders are leaning into Lyra network usage as an upside catalyst.",
            "LYRA beta is catching up after several sessions of lagging ORB.",
        ],
    },
} as const;

const portfolioBook = {
    desk: "Fable Harbor Sim Desk",
    navUsd: 2_500_000,
    cashUsd: 318_400,
    grossExposurePct: 128,
    netExposurePct: 54,
    varUsagePct: 61,
    maxSingleNameWeightPct: 15,
    maxCryptoWeightPct: 10,
    approvalThresholdUsd: 25_000,
    positions: [
        {
            symbol: "MERC",
            side: "long",
            quantity: 700,
            avgPrice: 418.2,
            marketValueUsd: 294_000,
            weightPct: 11.8,
            pnlDayUsd: 4_900,
        },
        {
            symbol: "NOVA",
            side: "long",
            quantity: 240,
            avgPrice: 821.4,
            marketValueUsd: 208_596,
            weightPct: 8.3,
            pnlDayUsd: 10_600,
        },
        {
            symbol: "ALTO",
            side: "long",
            quantity: 500,
            avgPrice: 202.1,
            marketValueUsd: 103_920,
            weightPct: 4.2,
            pnlDayUsd: 1_900,
        },
        {
            symbol: "PYRA",
            side: "short",
            quantity: 150,
            avgPrice: 188.0,
            marketValueUsd: -26_535,
            weightPct: -1.1,
            pnlDayUsd: -1_250,
        },
        {
            symbol: "ORB",
            side: "long",
            quantity: 1.2,
            avgPrice: 64_800,
            marketValueUsd: 82_140,
            weightPct: 3.3,
            pnlDayUsd: 1_460,
        },
    ],
};

function normalizeSymbol(value: unknown): string {
    return String(value ?? "").trim().toUpperCase();
}

function toNumber(value: unknown, fallback: number): number {
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function formatUsd(value: number): string {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: value >= 1_000 ? 0 : 2,
    }).format(value);
}

function formatSignedPct(value: number): string {
    return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function lookupMarket(symbolInput: unknown) {
    const symbol = normalizeSymbol(symbolInput);
    return (
        marketTape[symbol as keyof typeof marketTape] ?? {
            symbol,
            name: `${symbol} Holdings`,
            assetClass: "Equity",
            venue: "Primary Exchange",
            last: 100,
            changePct: 0,
            volume: "12.0M",
            trend: "flat while the desk waits for more catalysts",
            support: 98,
            resistance: 102,
            liquidity: "normal",
        }
    );
}

function lookupNews(symbolInput: unknown) {
    const symbol = normalizeSymbol(symbolInput);
    return (
        newsFeed[symbol as keyof typeof newsFeed] ?? {
            tone: "neutral",
            score: 0.5,
            takeaway: "No major catalyst is dominating the tape right now.",
            headlines: [
                "News flow is light and positioning is doing most of the work.",
                "The desk wants fresh catalysts before expanding conviction.",
            ],
        }
    );
}

function lookupPosition(symbolInput: unknown) {
    const symbol = normalizeSymbol(symbolInput);
    return portfolioBook.positions.find((position) => position.symbol === symbol) ?? null;
}

function evaluateOrder(args: Record<string, unknown>) {
    const symbol = normalizeSymbol(args.symbol);
    const market = lookupMarket(symbol);
    const position = lookupPosition(symbol);
    const side = String(args.side ?? "buy").toLowerCase() === "sell" ? "sell" : "buy";
    const quantity = Math.max(toNumber(args.quantity, 0), 0);
    const limitPrice = toNumber(args.limitPrice, market.last);
    const notionalUsd = Number((quantity * limitPrice).toFixed(2));
    const currentWeightPct = position?.weightPct ?? 0;
    const deltaWeightPct =
        Number((((notionalUsd / portfolioBook.navUsd) * 100) * (side === "buy" ? 1 : -1)).toFixed(2));
    const projectedWeightPct = Number((currentWeightPct + deltaWeightPct).toFixed(2));

    let projectedVarUsagePct =
        portfolioBook.varUsagePct + Math.min(Math.abs(deltaWeightPct) * 1.4, 12);
    if (
        (currentWeightPct < 0 && side === "buy") ||
        (currentWeightPct > 0 && side === "sell")
    ) {
        projectedVarUsagePct =
            portfolioBook.varUsagePct - Math.min(Math.abs(deltaWeightPct) * 0.9, 8);
    }
    projectedVarUsagePct = Number(
        Math.max(0, Math.min(100, projectedVarUsagePct)).toFixed(1),
    );

    const notes = [
        `Order notional ${formatUsd(notionalUsd)} versus the ${formatUsd(portfolioBook.approvalThresholdUsd)} approval threshold.`,
    ];
    let decision = "within-limits";

    if (Math.abs(projectedWeightPct) > portfolioBook.maxSingleNameWeightPct) {
        decision = "breach";
        notes.push(
            `Projected ${symbol} weight reaches ${projectedWeightPct.toFixed(2)}% of NAV, above the ${portfolioBook.maxSingleNameWeightPct}% single-name limit.`,
        );
    }

    if (projectedVarUsagePct > 80) {
        decision = "breach";
        notes.push(
            `Projected VaR usage reaches ${projectedVarUsagePct.toFixed(1)}%, above the desk cap of 80.0%.`,
        );
    }

    if (
        (symbol === "ORB" || symbol === "LYRA") &&
        Math.abs(projectedWeightPct) > portfolioBook.maxCryptoWeightPct
    ) {
        decision = "breach";
        notes.push(
            `Projected crypto weight reaches ${projectedWeightPct.toFixed(2)}%, above the ${portfolioBook.maxCryptoWeightPct}% crypto limit.`,
        );
    }

    if (
        decision === "within-limits" &&
        (Math.abs(projectedWeightPct) > portfolioBook.maxSingleNameWeightPct * 0.9 ||
            projectedVarUsagePct > 72)
    ) {
        decision = "caution";
        notes.push("Trade is still allowed, but it pushes the book close to a hard limit.");
    }

    if (decision === "within-limits") {
        notes.push("Sizing is inside desk concentration and VaR guardrails.");
    }

    return {
        symbol,
        side,
        quantity,
        limitPrice,
        notionalUsd,
        currentWeightPct,
        projectedWeightPct,
        projectedVarUsagePct,
        decision,
        notes,
    };
}

const sampleTools: DemoTool[] = [
    {
        name: "get_market_snapshot",
        title: "Get Market Snapshot",
        risk: AuraToolRisk.Safe,
        description: "Returns a quick market snapshot for a symbol, including price, trend, and key levels.",
        inputSchema: {
            type: "object",
            properties: {
                symbol: { type: "string", description: "Ticker or asset symbol, for example ALTO or ORB" },
                timeframe: { type: "string", description: "Optional timeframe focus, for example intraday or swing" },
            },
            required: ["symbol"],
        },
        execute: async (input: Record<string, unknown>) => {
            const market = lookupMarket(input.symbol);
            const position = lookupPosition(input.symbol);
            return {
                content: [
                    {
                        type: "text",
                        text:
                            `${market.symbol} trades at ${formatUsd(market.last)} (${formatSignedPct(market.changePct)} on the day). ` +
                            `Trend: ${market.trend}. Liquidity is ${market.liquidity}.`,
                    },
                    {
                        type: "json",
                        label: "Market Snapshot",
                        data: {
                            symbol: market.symbol,
                            name: market.name,
                            assetClass: market.assetClass,
                            venue: market.venue,
                            last: market.last,
                            dayChangePct: market.changePct,
                            volume: market.volume,
                            trend: market.trend,
                            support: market.support,
                            resistance: market.resistance,
                            liquidity: market.liquidity,
                            deskPositionWeightPct: position?.weightPct ?? 0,
                        },
                    },
                ],
            };
        },
    },
    {
        name: "scan_news_sentiment",
        title: "Scan News Sentiment",
        risk: AuraToolRisk.Safe,
        description: "Summarises recent news flow and desk sentiment for a symbol.",
        inputSchema: {
            type: "object",
            properties: {
                symbol: { type: "string", description: "Ticker or asset symbol" },
            },
            required: ["symbol"],
        },
        execute: async (input: Record<string, unknown>) => {
            const symbol = normalizeSymbol(input.symbol);
            const news = lookupNews(symbol);
            return {
                content: [
                    {
                        type: "text",
                        text:
                            `${symbol} sentiment is ${news.tone} with a ${news.score.toFixed(2)} score. ` +
                            `Desk takeaway: ${news.takeaway}`,
                    },
                    {
                        type: "json",
                        label: "News and Sentiment",
                        data: {
                            symbol,
                            sentiment: news.tone,
                            score: news.score,
                            takeaway: news.takeaway,
                            headlines: news.headlines,
                        },
                    },
                ],
            };
        },
    },
    {
        name: "get_portfolio_exposure",
        title: "Get Portfolio Exposure",
        risk: AuraToolRisk.Safe,
        description: "Returns desk exposure with an optional focus on one symbol.",
        inputSchema: {
            type: "object",
            properties: {
                symbol: { type: "string", description: "Optional symbol to focus the exposure report on" },
            },
        },
        execute: async (input: Record<string, unknown>) => {
            const symbol = input.symbol ? normalizeSymbol(input.symbol) : null;
            const focusPosition = symbol ? lookupPosition(symbol) : null;
            return {
                content: [
                    {
                        type: "text",
                        text:
                            `Desk exposure is ${portfolioBook.netExposurePct}% net and ${portfolioBook.grossExposurePct}% gross with ` +
                            `${formatUsd(portfolioBook.cashUsd)} cash. ` +
                            (focusPosition
                                ? `${focusPosition.symbol} is currently ${focusPosition.weightPct}% of NAV.`
                                : "Top positions are attached below."),
                    },
                    {
                        type: "json",
                        label: "Portfolio Exposure",
                        data: {
                            desk: portfolioBook.desk,
                            navUsd: portfolioBook.navUsd,
                            cashUsd: portfolioBook.cashUsd,
                            grossExposurePct: portfolioBook.grossExposurePct,
                            netExposurePct: portfolioBook.netExposurePct,
                            varUsagePct: portfolioBook.varUsagePct,
                            focusPosition,
                            topPositions: portfolioBook.positions,
                        },
                    },
                ],
            };
        },
    },
    {
        name: "check_risk_limits",
        title: "Check Risk Limits",
        risk: AuraToolRisk.Safe,
        description: "Checks whether a proposed order fits concentration, crypto, and VaR limits.",
        inputSchema: {
            type: "object",
            properties: {
                symbol: { type: "string", description: "Ticker or asset symbol" },
                side: { type: "string", enum: ["buy", "sell"], description: "Order side" },
                quantity: { type: "number", description: "Units to trade" },
                limitPrice: { type: "number", description: "Proposed limit price" },
            },
            required: ["symbol", "side", "quantity"],
        },
        execute: async (input: Record<string, unknown>) => {
            const check = evaluateOrder(input);
            return {
                content: [
                    {
                        type: "text",
                        text:
                            `Risk check for ${check.side} ${check.quantity} ${check.symbol} at ${formatUsd(check.limitPrice)}: ` +
                            `${check.decision}. Projected weight is ${check.projectedWeightPct.toFixed(2)}% of NAV and projected VaR usage is ` +
                            `${check.projectedVarUsagePct.toFixed(1)}%.`,
                    },
                    {
                        type: "json",
                        label: "Risk Check",
                        data: {
                            symbol: check.symbol,
                            side: check.side,
                            quantity: check.quantity,
                            limitPrice: check.limitPrice,
                            orderNotionalUsd: check.notionalUsd,
                            currentWeightPct: check.currentWeightPct,
                            projectedWeightPct: check.projectedWeightPct,
                            projectedVarUsagePct: check.projectedVarUsagePct,
                            decision: check.decision,
                            notes: check.notes,
                        },
                    },
                ],
            };
        },
    },
    {
        name: "place_limit_order",
        title: "Place Limit Order",
        risk: AuraToolRisk.Destructive,
        description: "Places a live limit order on the execution desk. Requires user approval.",
        inputSchema: {
            type: "object",
            properties: {
                symbol: { type: "string", description: "Ticker or asset symbol" },
                side: { type: "string", enum: ["buy", "sell"], description: "Order side" },
                quantity: { type: "number", description: "Units to trade" },
                limitPrice: { type: "number", description: "Limit price" },
                timeInForce: { type: "string", enum: ["day", "gtc"], description: "Optional time in force" },
                thesis: { type: "string", description: "Optional trade thesis for the blotter" },
            },
            required: ["symbol", "side", "quantity", "limitPrice"],
        },
        preview: {
            buildContent: async (args: Record<string, unknown>) => {
                const order = evaluateOrder(args);
                return [
                    {
                        type: "text",
                        text:
                            `${order.side.toUpperCase()} ${order.quantity} ${order.symbol} @ ${formatUsd(order.limitPrice)} ` +
                            `for about ${formatUsd(order.notionalUsd)}. Approval is required before the order is sent.`,
                    },
                ];
            },
        },
        execute: async (input: Record<string, unknown>, ctx) => {
            const order = evaluateOrder(input);
            const orderId = `ord_${Date.now().toString(36)}`;
            return {
                content: [
                    {
                        type: "text",
                        text:
                            `Order ${orderId} accepted: ${order.side} ${order.quantity} ${order.symbol} @ ${formatUsd(order.limitPrice)} ` +
                            `for ${formatUsd(order.notionalUsd)}.`,
                    },
                    {
                        type: "json",
                        label: "Execution Ticket",
                        data: {
                            orderId,
                            status: "accepted",
                            symbol: order.symbol,
                            side: order.side,
                            quantity: order.quantity,
                            limitPrice: order.limitPrice,
                            notionalUsd: order.notionalUsd,
                            timeInForce: String(input.timeInForce ?? "day"),
                            submittedBy: ctx.userId ?? "unknown-user",
                            conversationId: ctx.conversationId,
                            desk: portfolioBook.desk,
                            thesis: input.thesis ?? "not supplied",
                        },
                    },
                ],
            };
        },
    },
    {
        name: "place_protective_stop",
        title: "Place Protective Stop",
        risk: AuraToolRisk.Destructive,
        description: "Places a protective stop order against an existing or newly opened long position.",
        inputSchema: {
            type: "object",
            properties: {
                symbol: { type: "string", description: "Ticker or asset symbol" },
                quantity: { type: "number", description: "Units to protect" },
                stopPrice: { type: "number", description: "Stop trigger price" },
            },
            required: ["symbol", "quantity", "stopPrice"],
        },
        preview: {
            buildContent: async (args: Record<string, unknown>) => [
                {
                    type: "text",
                    text:
                        `Protect ${toNumber(args.quantity, 0)} ${normalizeSymbol(args.symbol)} with a sell stop at ` +
                        `${formatUsd(toNumber(args.stopPrice, 0))}.`,
                },
            ],
        },
        execute: async (input: Record<string, unknown>, ctx) => {
            const symbol = normalizeSymbol(input.symbol);
            const quantity = Math.max(toNumber(input.quantity, 0), 0);
            const stopPrice = toNumber(input.stopPrice, 0);
            const stopId = `stop_${Date.now().toString(36)}`;
            return {
                content: [
                    {
                        type: "text",
                        text:
                            `Protective stop ${stopId} accepted for ${quantity} ${symbol} at ${formatUsd(stopPrice)}.`,
                    },
                    {
                        type: "json",
                        label: "Protective Stop",
                        data: {
                            stopId,
                            status: "accepted",
                            symbol,
                            side: "sell",
                            quantity,
                            stopPrice,
                            submittedBy: ctx.userId ?? "unknown-user",
                            conversationId: ctx.conversationId,
                        },
                    },
                ],
            };
        },
    },
];

const sampleSkills: DemoSkill[] = [
    {
        name: "Market Analyst",
        description: "Researches setups with market and sentiment tools before any trade is sized.",
        instructions:
            "You are the desk market analyst. Use both market and sentiment tools when the user wants conviction, catalysts, or a trade idea. When the task moves from research into sizing or limits, switch to the Risk Manager skill. Do not execute trades from this skill.",
        tools: ["get_market_snapshot", "scan_news_sentiment"],
        metadata: { category: "Research" },
    },
    {
        name: "Risk Manager",
        description: "Checks the live book, concentration, and VaR before any execution decision.",
        instructions:
            "You are the desk risk manager. Always inspect portfolio exposure before or alongside a risk limit check. If the user wants to place a trade and risk is acceptable, switch to the Execution Trader skill to send orders. If trade details are missing, ask the user instead of guessing.",
        tools: ["get_portfolio_exposure", "check_risk_limits"],
        metadata: { category: "Risk" },
    },
    {
        name: "Execution Trader",
        description: "Sends orders only after research and risk checks are complete.",
        instructions:
            "You are the execution trader. Only use execution tools after the research and risk work is already done or explicitly waived by the user. If an order instruction is missing quantity, price, or stop level, call aura_ask_user. Every execution tool requires approval before it runs.",
        tools: ["place_limit_order", "place_protective_stop"],
        metadata: { category: "Execution" },
    },
];

const defaultConfig: DemoConfig = {
    identity: {
        appMetadata: {
            appId: "paper-trading-sim",
            teamId: "fable-harbor-labs",
            tenantId: "fictional-multi-asset",
            userId: "demo-pm-001",
        },
        aiName: "Aster",
    },
    appearance: {
        theme: "professional-light",
        headerTitle: "Aster Trader",
        headerIcon: "candlestick_chart",
        welcomeMessageTitle: "Paper Trading Demo",
        welcomeMessage:
            "This demo config uses fully fictional market, portfolio, and order data while still showing the full aura-chat loop: skill selection, tool calls, skill switching, and approval before simulated execution.",
        inputPlaceholder: "Ask Aster to research, risk-check, and simulate a trade...",
        loadingMessage: "I'm thinking...",
        errorMessage: "The paper-trading workflow hit an error.",
        retryLabel: "Retry",
        enableAttachments: true,
        maxAttachmentSize: 10_485_760,
        suggestedPrompts: [
            {
                title: "Research Stack",
                description: "Use multiple research tools inside one skill.",
                promptText:
                    "Give me an ORB brief with a market snapshot, news sentiment, and tell me how exposed the desk already is.",
            },
            {
                title: "Cross-Skill Risk",
                description: "Research first, then switch into risk mode.",
                promptText:
                    "Check NOVA momentum, then switch to risk and tell me whether buying 120 shares at 871.50 would push the desk over any limits.",
            },
            {
                title: "End-to-End Trade",
                description: "Run research, risk, execution, and protective stop.",
                promptText:
                    "Work this ALTO trade end to end: research the setup, switch to risk and check whether buying 100 shares at 207.50 fits the desk, then if limits pass switch to execution and place the order plus a protective stop at 201.",
            },
            {
                title: "Ask For Missing Details",
                description: "Let the agent request what it still needs.",
                promptText:
                    "I want a semis trade today. Use the right skills and ask me whatever you still need before you execute anything.",
            },
        ],
    },
    providers: [
        {
            type: "built-in",
            id: "gitHubCopilot",
            config: {
                rememberToken: true,
            },
        },
    ],
    agent: {
        appSystemPrompt:
            "You are Aster, the AI trader for a simulated multi-asset desk. Work agentically: select the right skill, gather facts with tools instead of guessing, switch skills when the job moves from research to risk to execution, and keep the user updated with crisp trading rationale. Never send a simulated order without explicit approval.",
        additionalSafetyInstructions:
            "Do not imply any real market connectivity. All fills, prices, approvals, and portfolio data in this demo are fictional. If execution details are missing, ask the user before calling an order tool.",
        skills: sampleSkills,
        tools: sampleTools,
        conversationManager,
        maxContextTokens: 4096,
        enableStreaming: true,
        maxIterations: 12,
        showThinkingProcess: true,
        toolTimeout: 30_000,
        confirmationTimeoutMs: 65_000,
        enableWebMcp: false,
    },
};

type AuraEventMonitorApi = HTMLElement & {
    pushEvent(event: AuraEvent): void;
    clearEvents(): void;
};

type AuraSettingsApi = HTMLElement & {
    config?: Partial<AuraConfig>;
    showActions?: boolean;
    getValues(): Partial<AuraConfig>;
};

const eventMonitor = document.getElementById("eventMonitor") as AuraEventMonitorApi;
const settingsPanel = document.getElementById("settingsPanel") as AuraSettingsApi;

function cloneEditorConfig(): DemoConfig {
    return {
        ...defaultConfig,
        identity: {
            ...defaultConfig.identity,
            appMetadata: { ...defaultConfig.identity.appMetadata },
        },
        appearance: { ...defaultConfig.appearance },
        providers: defaultConfig.providers.map((p: any) => ({
            ...p,
            config: { ...(p.config ?? {}) },
        })),
        agent: {
            ...defaultConfig.agent,
            skills: [...defaultConfig.agent.skills],
            tools: [...defaultConfig.agent.tools],
        },
    };
}

function syncBaseConfigFromDraft(draft: Partial<AuraConfig>): void {
    if (draft.identity) {
        defaultConfig.identity = {
            ...defaultConfig.identity,
            ...draft.identity,
            appMetadata: {
                ...defaultConfig.identity.appMetadata,
                ...(draft.identity.appMetadata ?? {}),
            },
        };
    }

    if (draft.appearance) {
        defaultConfig.appearance = {
            ...defaultConfig.appearance,
            ...draft.appearance,
        };
    }

    if (draft.providers?.length) {
        defaultConfig.providers = draft.providers as NonNullable<DemoConfig["providers"]>;
    }

    if (draft.agent) {
        const {
            tools: _ignoredTools,
            skills: _ignoredSkills,
            ...agentUpdates
        } = draft.agent;

        defaultConfig.agent = {
            ...defaultConfig.agent,
            ...agentUpdates,
        };
    }
}

function resolveEffectiveTheme(theme: string): string {
    if (theme === "auto") {
        return window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light";
    }

    return theme;
}

function applyPageTheme(theme: string): void {
    defaultConfig.appearance.theme = theme as DemoConfig["appearance"]["theme"];
    const effectiveTheme = resolveEffectiveTheme(theme);

    document.body.classList.remove("light", "professional-light");
    if (effectiveTheme !== "dark") {
        document.body.classList.add(effectiveTheme);
    }

    eventMonitor.setAttribute("data-theme", effectiveTheme);
    settingsPanel.setAttribute("data-theme", effectiveTheme);
}

function buildWidgetConfig(draft?: Partial<AuraConfig>) {
    const editorConfig = cloneEditorConfig();
    const agentDraft = draft?.agent;
    const {
        tools: selectedTools,
        skills: selectedSkills,
        ...agentUpdates
    } = agentDraft ?? {};

    return {
        ...editorConfig,
        identity: {
            ...editorConfig.identity,
            ...(draft?.identity ?? {}),
            appMetadata: {
                ...editorConfig.identity.appMetadata,
                ...(draft?.identity?.appMetadata ?? {}),
            },
        },
        appearance: {
            ...editorConfig.appearance,
            ...(draft?.appearance ?? {}),
        },
        providers: draft?.providers?.length
            ? draft.providers as NonNullable<AuraConfig["providers"]>
            : editorConfig.providers,
        agent: {
            ...editorConfig.agent,
            ...agentUpdates,
            skills: selectedSkills ?? editorConfig.agent.skills,
            tools: selectedTools ?? editorConfig.agent.tools,
        },
        onAuraEvent: (event: AuraEvent) => eventMonitor.pushEvent(event),
    };
}

function applyToWidget() {
    const draft = settingsPanel.getValues();
    syncBaseConfigFromDraft(draft);
    applyPageTheme(draft.appearance?.theme ?? defaultConfig.appearance.theme ?? "light");

    const widget: any = document.getElementById("widget");
    widget.config = buildWidgetConfig(draft);
    settingsPanel.config = cloneEditorConfig();

    eventMonitor.pushEvent({
        type: "debug",
        timestamp: Date.now(),
        payload: { message: "Config applied from sidebar." },
    });
}

document.getElementById("applyBtn")!.addEventListener("click", applyToWidget);

const toggleFull = document.getElementById("toggleFullSize")!;
const toggleLog = document.getElementById("toggleEventLog")!;
const widgetContainer = document.getElementById("widgetContainer")!;
const eventLogPanel = document.getElementById("eventLogPanel")!;

toggleFull.addEventListener("click", () => {
    toggleFull.classList.toggle("active");
    widgetContainer.classList.toggle("full");
});

toggleLog.addEventListener("click", () => {
    toggleLog.classList.toggle("active");
    eventLogPanel.classList.toggle("hidden");
    document.getElementById("dragRight")!.style.display = eventLogPanel.classList.contains("hidden")
        ? "none"
        : "block";
});

const dragLeft = document.getElementById("dragLeft")!;
const dragRight = document.getElementById("dragRight")!;
const sidebarLeft = document.getElementById("sidebarLeft")!;

let resizingLeft = false;
let resizingRight = false;

dragLeft.addEventListener("mousedown", () => {
    resizingLeft = true;
    dragLeft.classList.add("active");
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
});

dragRight.addEventListener("mousedown", () => {
    resizingRight = true;
    dragRight.classList.add("active");
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
});

window.addEventListener("mousemove", (e) => {
    if (resizingLeft) {
        const width = e.clientX;
        if (width >= 260 && width <= 500) {
            sidebarLeft.style.width = width + "px";
        }
    }

    if (resizingRight) {
        const width = window.innerWidth - e.clientX;
        if (width >= 220 && width <= 500) {
            eventLogPanel.style.width = width + "px";
        }
    }
});

window.addEventListener("mouseup", () => {
    resizingLeft = false;
    resizingRight = false;
    dragLeft.classList.remove("active");
    dragRight.classList.remove("active");
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
});

settingsPanel.showActions = false;
settingsPanel.config = cloneEditorConfig();
applyPageTheme(defaultConfig.appearance.theme ?? "light");

const widget: any = document.getElementById("widget");
widget.config = buildWidgetConfig();



