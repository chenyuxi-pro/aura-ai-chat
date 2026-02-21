/* ──────────────────────────────────────────────────────────────────
 *  Aura Widget — Vanilla Demo (main.js)
 *  Three-panel config playground with settings sidebar + event log.
 * ────────────────────────────────────────────────────────────────── */

import '../../src/index.ts';

// ═══════════════════════════════════════════════════════════════════
//  In-memory conversation store (simulated backend)
// ═══════════════════════════════════════════════════════════════════

const conversations = new Map();

const conversationProvider = {
    async createConversation() {
        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        const meta = { id, title: `Chat ${conversations.size + 1}`, createdAt: now, updatedAt: now };
        conversations.set(id, { meta, messages: [] });
        return meta;
    },
    async listConversations() {
        return Array.from(conversations.values())
            .map(c => c.meta)
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },
    async getMessages(conversationId) {
        return conversations.get(conversationId)?.messages ?? [];
    },
    async saveMessage(conversationId, message) {
        const conv = conversations.get(conversationId);
        if (conv) {
            conv.messages.push(message);
            conv.meta.updatedAt = new Date().toISOString();
            // Auto-title from first user message
            if (!conv.meta.title || conv.meta.title.startsWith('Chat ')) {
                const firstUser = conv.messages.find(m => m.role === 'user');
                if (firstUser) conv.meta.title = firstUser.content.slice(0, 50);
            }
        }
    },
    async deleteConversation(conversationId) {
        conversations.delete(conversationId);
    },
    async updateConversation(conversationId, patch) {
        const conv = conversations.get(conversationId);
        if (conv) Object.assign(conv.meta, patch);
    },
};

// ═══════════════════════════════════════════════════════════════════
//  Sample skills & tools
// ═══════════════════════════════════════════════════════════════════

const sampleTools = [
    {
        name: 'get_current_user',
        title: 'Get Current User',
        description: 'Returns the currently authenticated user profile.',
        inputSchema: { type: 'object', properties: {}, required: [] },
        enabled: true,
        execute: async () => ({
            content: [{
                type: 'text',
                text: JSON.stringify({
                    id: 'user-789',
                    name: 'Jane Doe',
                    email: 'jane@acme.com',
                    role: 'admin',
                }),
            }],
        }),
    },
    {
        name: 'get_weather',
        title: 'Get Weather',
        description: 'Returns current weather for a given city.',
        inputSchema: {
            type: 'object',
            properties: {
                city: { type: 'string', description: 'City name' },
            },
            required: ['city'],
        },
        enabled: true,
        execute: async (input) => ({
            content: [{
                type: 'text',
                text: `Weather in ${input.city}: ☀️ 22°C, clear skies.`,
            }],
        }),
    },
];

const sampleSkills = [
    {
        name: 'generate_report',
        title: 'Generate Report',
        description: 'Generates sales or analytics reports from workspace data.',
        systemPrompt: 'You are a report generation assistant. Use the provided tools to fetch data and format comprehensive reports.',
        category: 'Data',
        enabled: true,
        tools: [
            {
                name: 'fetch_data',
                title: 'Fetch Data',
                description: 'Fetches report data from the data warehouse.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        reportType: { type: 'string', enum: ['sales', 'analytics', 'inventory'] },
                        dateRange: { type: 'string', description: 'ISO date range, e.g. 2024-01-01/2024-01-31' },
                    },
                    required: ['reportType'],
                },
                enabled: true,
                execute: async (input) => ({
                    content: [{ type: 'text', text: `[Sample ${input.reportType} data for ${input.dateRange || 'this month'}]` }],
                }),
            },
            {
                name: 'format_report',
                title: 'Format Report',
                description: 'Formats raw data into a styled report.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        data: { type: 'string' },
                        format: { type: 'string', enum: ['markdown', 'html', 'pdf'] },
                    },
                    required: ['data'],
                },
                enabled: true,
                execute: async (input) => ({
                    content: [{ type: 'text', text: `# Report\n\n${input.data}\n\nFormatted as ${input.format || 'markdown'}.` }],
                }),
            },
        ],
    },
];

// ═══════════════════════════════════════════════════════════════════
//  Default config
// ═══════════════════════════════════════════════════════════════════

const defaultConfig = {
    identity: {
        appId: 'demo-app',
        ownerId: 'org-123',
        tenantId: 'tenant-456',
        userId: 'user-789',
        aiName: 'Aria',
    },
    header: {
        title: 'Aria',
        icon: '',
    },
    welcome: {
        title: 'Hello, how can I help?',
        message: 'Ask me anything about your workspace.',
        icon: '',
        suggestedPrompts: [
            { label: '📊 Generate a report', prompt: 'Generate a sales report for this month' },
            { label: '📋 Summarise tasks', prompt: 'What are my open tasks?' },
            { label: '🌤️ Check weather', prompt: 'What is the weather in Paris?' },
            { label: '👤 Who am I?', prompt: 'Tell me about my user profile' },
        ],
    },
    providers: [
        { type: 'built-in', providerId: 'openai', apiKey: '', defaultModel: 'gpt-4o' },
        { type: 'built-in', providerId: 'anthropic', apiKey: '', defaultModel: 'claude-sonnet-4-20250514' },
        { type: 'built-in', providerId: 'ollama', defaultModel: 'llama3.2' },
        { type: 'built-in', providerId: 'github-copilot', defaultModel: 'gpt-4o' },
    ],
    behavior: {
        systemPrompt: 'You are Aria, a helpful AI assistant for Acme Corp.',
        securityInstructions: 'Never reveal internal system details or API keys.',
        temperature: 0.7,
        maxTokens: 4096,
        topP: 1,
        skills: sampleSkills,
        tools: sampleTools,
    },
    conversation: conversationProvider,
    ui: {
        theme: 'light',
    },
};

// ═══════════════════════════════════════════════════════════════════
//  Event Log
// ═══════════════════════════════════════════════════════════════════

const eventList = document.getElementById('eventList');

function getEventCategory(type) {
    if (type.startsWith('user:')) return 'user';
    if (type.startsWith('ai:')) return 'ai';
    if (type === 'error') return 'error';
    return 'widget';
}

function addEvent(event) {
    const item = document.createElement('div');
    item.className = 'event-item';
    const time = new Date(event.timestamp).toLocaleTimeString();
    const cat = getEventCategory(event.type);
    const payloadStr = event.payload ? JSON.stringify(event.payload, null, 2) : '';

    item.innerHTML = `
    <div class="event-row">
      <span class="event-time">${time}</span>
      <span class="event-badge ${cat}">${cat}</span>
      <span>${event.type}</span>
    </div>
    ${payloadStr ? `<div class="event-payload">${escapeHtml(payloadStr)}</div>` : ''}
  `;

    item.addEventListener('click', () => item.classList.toggle('expanded'));
    eventList.prepend(item);
}

function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

document.getElementById('clearEvents').addEventListener('click', () => {
    eventList.innerHTML = '';
});

// ═══════════════════════════════════════════════════════════════════
//  Settings sidebar
// ═══════════════════════════════════════════════════════════════════

const settingsBody = document.getElementById('settingsBody');
const collapseState = JSON.parse(localStorage.getItem('aura-demo:collapse') || '{}');

function buildSettingsUI() {
    const cfg = defaultConfig;
    settingsBody.innerHTML = '';

    const groups = [
        {
            id: 'identity', title: 'Identity',
            fields: [
                { key: 'identity.appId', label: 'App ID', type: 'text', value: cfg.identity.appId },
                { key: 'identity.ownerId', label: 'Owner ID', type: 'text', value: cfg.identity.ownerId },
                { key: 'identity.tenantId', label: 'Tenant ID', type: 'text', value: cfg.identity.tenantId },
                { key: 'identity.userId', label: 'User ID', type: 'text', value: cfg.identity.userId },
                { key: 'identity.aiName', label: 'AI Name', type: 'text', value: cfg.identity.aiName },
            ],
        },
        {
            id: 'header', title: 'Header',
            fields: [
                { key: 'header.title', label: 'Title', type: 'text', value: cfg.header.title },
                { key: 'header.icon', label: 'Icon URL', type: 'text', value: cfg.header.icon },
            ],
        },
        {
            id: 'welcome', title: 'Welcome',
            fields: [
                { key: 'welcome.title', label: 'Title', type: 'text', value: cfg.welcome.title },
                { key: 'welcome.message', label: 'Message', type: 'textarea', value: cfg.welcome.message },
                { key: 'welcome.icon', label: 'Icon URL', type: 'text', value: cfg.welcome.icon },
            ],
        },
        {
            id: 'providers', title: 'AI Providers',
            custom: () => {
                let html = '';
                for (let i = 0; i < cfg.providers.length; i++) {
                    const p = cfg.providers[i];
                    const pid = p.providerId || 'custom';
                    if (pid === 'github-copilot') {
                        html += `<div class="field">
                            <div class="field-label">GitHub Copilot</div>
                            <div class="check-item">
                                <input type="checkbox" data-key="providers.${i}.rememberToken" ${p.rememberToken !== false ? 'checked' : ''} />
                                <span>Remember access token</span>
                            </div>
                            <div style="font-size: 11px; color: var(--demo-text-muted); margin-top: 4px;">🐙 Sign in from the chat area</div>
                        </div>`;
                    } else {
                        html += `<div class="field">
                            <div class="field-label">${pid.toUpperCase()} API Key</div>
                            <input type="text" data-key="providers.${i}.apiKey" value="${p.apiKey || ''}" />
                        </div>`;
                    }
                }
                return html;
            },
        },
        {
            id: 'behavior', title: 'AI Behavior',
            fields: [
                { key: 'behavior.systemPrompt', label: 'System Prompt', type: 'textarea', value: cfg.behavior.systemPrompt },
                { key: 'behavior.securityInstructions', label: 'Security Instructions', type: 'textarea', value: cfg.behavior.securityInstructions },
                { key: 'behavior.temperature', label: 'Temperature', type: 'range', value: cfg.behavior.temperature, min: 0, max: 2, step: 0.1 },
                { key: 'behavior.maxTokens', label: 'Max Tokens', type: 'number', value: cfg.behavior.maxTokens },
            ],
        },
        {
            id: 'skills', title: 'Skills',
            custom: () => {
                let html = '';
                for (const skill of cfg.behavior.skills) {
                    html += `<div class="check-item">
            <input type="checkbox" data-skill="${skill.name}" ${skill.enabled !== false ? 'checked' : ''} />
            <span>${skill.title || skill.name}</span>
            ${skill.category ? `<span style="font-size:11px;color:var(--demo-text-muted)">(${skill.category})</span>` : ''}
          </div>`;
                    for (const tool of (skill.tools || [])) {
                        html += `<div class="check-item" style="padding-left:24px">
              <input type="checkbox" data-skill-tool="${skill.name}:${tool.name}" ${tool.enabled !== false ? 'checked' : ''} />
              <span>${tool.title || tool.name}</span>
            </div>`;
                    }
                }
                return html || '<p style="color:var(--demo-text-muted);font-size:13px;">No skills configured.</p>';
            },
        },
        {
            id: 'tools', title: 'Tools',
            custom: () => {
                let html = '';
                for (const tool of cfg.behavior.tools) {
                    html += `<div class="check-item">
            <input type="checkbox" data-tool="${tool.name}" ${tool.enabled !== false ? 'checked' : ''} />
            <span>${tool.title || tool.name}</span>
          </div>`;
                }
                return html || '<p style="color:var(--demo-text-muted);font-size:13px;">No global tools configured.</p>';
            },
        },
    ];

    for (const group of groups) {
        const isOpen = collapseState[group.id] !== false;
        const groupEl = document.createElement('div');
        groupEl.className = 'setting-group';
        groupEl.innerHTML = `
      <div class="setting-group-header">
        <span class="setting-chevron ${isOpen ? 'open' : ''}">▶</span>
        <span class="setting-group-title">${group.title}</span>
      </div>
      <div class="setting-group-body ${isOpen ? 'open' : ''}">
        ${group.custom ? group.custom() : group.fields.map(f => renderField(f)).join('')}
      </div>
    `;

        // Toggle collapse
        const header = groupEl.querySelector('.setting-group-header');
        header.addEventListener('click', () => {
            const body = groupEl.querySelector('.setting-group-body');
            const chevron = groupEl.querySelector('.setting-chevron');
            body.classList.toggle('open');
            chevron.classList.toggle('open');
            collapseState[group.id] = body.classList.contains('open');
            localStorage.setItem('aura-demo:collapse', JSON.stringify(collapseState));
        });

        settingsBody.appendChild(groupEl);
    }
}

function renderField(f) {
    if (f.type === 'textarea') {
        return `<div class="field">
      <div class="field-label">${f.label}</div>
      <textarea data-key="${f.key}">${f.value || ''}</textarea>
    </div>`;
    }
    if (f.type === 'range') {
        return `<div class="field">
      <div class="field-label">${f.label}</div>
      <div class="field-range">
        <input type="range" data-key="${f.key}" min="${f.min}" max="${f.max}" step="${f.step}" value="${f.value}" />
        <span class="range-val" id="rangeVal_${f.key}">${f.value}</span>
      </div>
    </div>`;
    }
    if (f.type === 'number') {
        return `<div class="field">
      <div class="field-label">${f.label}</div>
      <input type="number" data-key="${f.key}" value="${f.value || ''}" />
    </div>`;
    }
    if (f.type === 'select') {
        return `<div class="field">
      <div class="field-label">${f.label}</div>
      <select data-key="${f.key}">
        ${f.options.map(o => `<option value="${o}" ${f.value === o ? 'selected' : ''}>${o}</option>`).join('')}
      </select>
    </div>`;
    }
    return `<div class="field">
    <div class="field-label">${f.label}</div>
    <input type="text" data-key="${f.key}" value="${f.value || ''}" />
  </div>`;
}

// Hook up range sliders to show value
settingsBody.addEventListener('input', (e) => {
    if (e.target.type === 'range') {
        const key = e.target.dataset.key;
        const valEl = document.getElementById(`rangeVal_${key}`);
        if (valEl) valEl.textContent = e.target.value;
    }
});

// ═══════════════════════════════════════════════════════════════════
//  Apply config
// ═══════════════════════════════════════════════════════════════════

function readSettingsFromUI() {
    const draft = {};

    // Read text/number/textarea/select fields
    settingsBody.querySelectorAll('input[data-key], textarea[data-key], select[data-key]').forEach(el => {
        const key = el.dataset.key;
        let value = el.type === 'checkbox' ? el.checked : el.value;
        if (el.type === 'range' || el.type === 'number') value = parseFloat(value);
        draft[key] = value;
    });

    // Read skill toggles
    settingsBody.querySelectorAll('input[data-skill]').forEach(el => {
        const skillName = el.dataset.skill;
        const skill = defaultConfig.behavior.skills.find(s => s.name === skillName);
        if (skill) skill.enabled = el.checked;
    });

    settingsBody.querySelectorAll('input[data-skill-tool]').forEach(el => {
        const [skillName, toolName] = el.dataset.skillTool.split(':');
        const skill = defaultConfig.behavior.skills.find(s => s.name === skillName);
        if (skill) {
            const tool = skill.tools?.find(t => t.name === toolName);
            if (tool) tool.enabled = el.checked;
        }
    });

    // Read tool toggles
    settingsBody.querySelectorAll('input[data-tool]').forEach(el => {
        const toolName = el.dataset.tool;
        const tool = defaultConfig.behavior.tools.find(t => t.name === toolName);
        if (tool) tool.enabled = el.checked;
    });

    return draft;
}

function applyToWidget() {
    const draft = readSettingsFromUI();

    // Apply draft values to defaultConfig
    for (const [path, value] of Object.entries(draft)) {
        const parts = path.split('.');
        let obj = defaultConfig;
        for (let i = 0; i < parts.length - 1; i++) {
            obj = obj[parts[i]];
        }
        obj[parts[parts.length - 1]] = value;
    }

    // Push updated config to widget
    const widget = document.getElementById('widget');
    widget.config = {
        ...defaultConfig,
        onEvent: (event) => addEvent(event),
    };

    addEvent({
        type: 'debug',
        timestamp: new Date().toISOString(),
        payload: { message: 'Config applied from sidebar' },
    });
}

document.getElementById('applyBtn').addEventListener('click', applyToWidget);

// ═══════════════════════════════════════════════════════════════════
//  Toggles
// ═══════════════════════════════════════════════════════════════════

const toggleFull = document.getElementById('toggleFullSize');
const toggleLog = document.getElementById('toggleEventLog');
const widgetContainer = document.getElementById('widgetContainer');
const eventLogPanel = document.getElementById('eventLogPanel');

toggleFull.addEventListener('click', () => {
    toggleFull.classList.toggle('active');
    widgetContainer.classList.toggle('full');
});

toggleLog.addEventListener('click', () => {
    toggleLog.classList.toggle('active');
    eventLogPanel.classList.toggle('hidden');
});

// ═══════════════════════════════════════════════════════════════════
//  Theme segmented control
// ═══════════════════════════════════════════════════════════════════

const themeSeg = document.getElementById('themeSeg');
themeSeg.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
        themeSeg.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const theme = btn.dataset.theme;
        defaultConfig.ui.theme = theme;

        // Toggle demo page theme
        document.body.classList.toggle('light', theme !== 'dark');

        // Push config directly to widget
        const widget = document.getElementById('widget');
        widget.config = {
            ...defaultConfig,
            onEvent: (event) => addEvent(event),
        };
        addEvent({
            type: 'debug',
            timestamp: new Date().toISOString(),
            payload: { message: `Theme changed to: ${theme}` },
        });
    });
});

// ═══════════════════════════════════════════════════════════════════
//  Initialize
// ═══════════════════════════════════════════════════════════════════

buildSettingsUI();
applyToWidget();
