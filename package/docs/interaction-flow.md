Aura-AI-Chat: Intelligent Request Handling & Interaction Flow
Overview
For every user request, the AI follows a structured skill-and-tool resolution pipeline to determine the best way to respond and act. All side-effecting operations require explicit user confirmation before execution.

1. Context Initialization (System Prompt)
At the start of every session, Aura injects the Skills Summary directly into the system prompt. This means the AI already knows the full list of available skills and their capabilities before any user message arrives. The AI should use this pre-loaded summary as its primary reference when interpreting user intent — no dynamic skill lookup is needed.

2. Request Resolution Pipeline
Step 1 — Match Request to a Skill
Upon receiving a user request, the AI scans the Skills Summary already in its context to find the best matching skill.
If a matching skill is found:

The AI instructs Aura to load the full skill detail into context (including all linked tool definitions).
The AI follows the skill's instructions/prompt.
If the skill requires a tool to be executed, the AI first determines whether the operation is risky:
Non-risky operation:

The AI sends a tool-execution instruction to Aura.
Aura executes the tool immediately on the AI's behalf.
If the tool is not found, Aura notifies the user directly.

Risky operation:

The AI does not execute the tool directly.
The AI composes a description of what the tool will do and its potential impact, and sends this to Aura to enter the Confirmation Bubble workflow (see Section 3).
Execution only proceeds after the user explicitly approves.



If no matching skill is found → proceed to Step 2.

Step 2 — Direct Tool Lookup
The AI instructs Aura to load the Tools Summary into context and searches for a suitable tool.
If a matching tool is found:

The AI requests the full tool detail from Aura.
The AI attempts to populate all required tool parameters using information already available in the conversation.
If any required information is missing, the AI asks the user to provide it before proceeding.
Once all parameters are resolved, the AI applies the same risky/non-risky check before instructing Aura to execute.

If no matching tool is found:

The AI responds using its general knowledge or informs the user that no suitable capability exists.


3. Risky Operation Confirmation Flow
Any operation that could have a significant or irreversible impact must never be executed without explicit user approval.
When a risky operation is identified, the AI pauses, communicates the operation intent and impact to Aura, and Aura renders a Confirmation Bubble in the chat — a structured interactive message with three parts:
Part A — Explanation Message
A clear, plain-language description of:

What the AI is about to do
What the expected outcome or impact is
Why this is considered a significant action

Part B — Preview Component (conditional)
A visual preview of what will be created, modified, or deleted.

Preferred: Use a Host App component with real app data to render a preview of the target (e.g., if the AI is modifying a form, render that form in its new state). This is preferred because the AI is operating on host app entities.
Fallback: If no suitable host component is available, the AI constructs its own preview representation.
Omit entirely if a preview adds no meaningful value.

Part C — Confirmation Buttons
Two fixed action buttons:

✅ Approve — Executes the tool immediately.
❌ Cancel — Aborts; no changes are made.


4. Behavioral Rules Summary
SituationBehaviorSession startsSkill summaries already loaded via system promptUser sends requestAI matches against pre-loaded skill summariesSkill matchedAI requests full skill detail + linked tools from AuraSkill requires tool, not riskyAI instructs Aura to execute immediatelySkill requires tool, not risky, tool not foundAura notifies user directlySkill requires tool, riskyAI sends impact description to Aura → Confirmation Bubble shownUser cancels risky operationDo nothing, no side effectsUser approves risky operationAura executes the tool immediatelyNo skill matchedAI requests Tools Summary from Aura and searchesTool matched directlyLoad full detail, fill params, apply same risky/non-risky checkMissing paramsAsk user before executing

5. Implementation Notes for Developers
When reviewing and implementing the aura-ai-chat package:

System prompt construction must always include the Skills Summary on session init — this is Aura's responsibility, not the AI's.
The AI must classify every tool call as risky or non-risky before instructing Aura. The AI should communicate this classification explicitly in its instruction payload.
For risky operations, the AI's instruction to Aura must include a structured impact description (what will change, what is affected, severity) so Aura can populate the Confirmation Bubble correctly.
Confirmation Bubble is a first-class message type with its own rendering pipeline, not a styled chat message.
Host app must provide a mechanism to inject Preview Components into the Confirmation Bubble at runtime.
The AI-to-Aura communication protocol must support distinct message intents: LOAD_SKILL_DETAIL, LOAD_TOOLS_SUMMARY, LOAD_TOOL_DETAIL, EXECUTE_TOOL, EXECUTE_TOOL_RISKY (triggers Confirmation Bubble).
Aura must handle tool-not-found errors gracefully without exposing internal errors to the user.
The full interactive flow — skill matching → detail loading → tool resolution → parameter collection → risk classification → confirmation (if needed) → execution — must be implemented and tested as one coherent end-to-end workflow.