import { createHash } from "node:crypto";
import type { ChatMessagePlan } from "@/lib/chat-intent-router";
import {
  findEmailAddresses,
  getDirectChatMemoryIntent,
  hasEmailTopic,
  isDirectMemoryEditRequest,
  isEmailSubject,
  literalEmailReplacement,
  referencedEmailReplacementSubject,
  type ChatMemoryIntent,
} from "@/lib/chat-memory-intent";
import {
  createMemory,
  MEMORY_COLUMNS,
  updateMemory,
  type MemoryClient,
} from "@/lib/memory-store";
import type { ChatMemoryChange, ChatMemoryMode, ChatReference, Memory } from "@/types";

type UpdateIntent = Extract<ChatMemoryIntent, { kind: "update" }>;
type Fact = Extract<ChatMemoryIntent, { kind: "save" }>["facts"][number];
type Draft = { title: string | null; content: string; tags: string[] };
type EditCandidate = { memory: Memory; draft: Draft };
type ChatMemoryOutcome = {
  reply?: string;
  changes?: ChatMemoryChange[];
  memories?: Memory[];
};

const MAX_CANDIDATES = 100;
const SINGLE_VALUE_TITLES = new Set(["name", "full name", "first name", "last name", "preferred name", "where i live", "employer"]);
const ASK_FOR_NEW_EMAIL = "Which new email address should I use? Send the update with the full address.";

function hasSingleValue(title: string): boolean {
  return SINGLE_VALUE_TITLES.has(title) || /^(?:favou?rite|preferred)\s+/.test(title);
}

function normalize(text: string): string {
  return text.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

function subjectName(text: string): string {
  return normalize(text).replace(/^(?:my|the)\s+/, "");
}

function escapePattern(text: string): string {
  return text.replace(/[\\%_*]/g, "\\$&");
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^\${}()|[\]\\]/g, "\\$&");
}

function emailScope(subject: string): string | null {
  if (/\b(?:work|business|office)\b/i.test(subject)) return "work";
  if (/\b(?:personal|home)\b/i.test(subject)) return "personal";
  return normalize(subject).match(/\b(?:school|primary|secondary)\b/)?.[0] ?? null;
}

function isEmailField(subject: string): boolean {
  return /^(?:(?:my|primary|secondary|school|work|business|office|personal|home)\s+){0,2}e-?mail(?:\s+(?:id|address))?$/i
    .test(normalize(subject));
}

function emailFields(memory: Memory, subject: string): string[] {
  const scope = emailScope(subject);
  const title = memory.title ?? "";
  const titleMatches = isEmailField(title) && (!scope || emailScope(title) === scope);
  const matchingLines = memory.content.split("\n").filter((line) => {
    const label = /^\s*(?:[-*]\s+)?((?:(?:my|primary|secondary|school|work|business|office|personal|home)\s+){0,2}e-?mail(?:\s+(?:id|address))?)\s*(?:is\b|[:=])/i
      .exec(line)?.[1];
    return label && (!scope || emailScope(label) === scope);
  });
  const text = matchingLines.length > 0
    ? matchingLines.join("\n")
    : titleMatches ? memory.content : "";
  return findEmailAddresses(text);
}

function replaceOnce(text: string, original: string, replacement: string): string | null {
  if (!original) return null;
  const start = text.indexOf(original);
  if (start < 0 || text.indexOf(original, start + original.length) >= 0) return null;
  return text.slice(0, start) + replacement + text.slice(start + original.length);
}

function buildEdit(memory: Memory, intent: UpdateIntent): EditCandidate | null {
  const { subject, value, previousValue } = intent;
  let original = previousValue;
  const matchesTitle = subjectName(memory.title ?? "") === subjectName(subject);
  const email = isEmailSubject(subject);
  if (email) {
    const addresses = emailFields(memory, subject);
    if (addresses.length > 1 && !previousValue) return null;
    original = previousValue
      ? addresses.find((address) => normalize(address) === normalize(previousValue))
      : addresses[0];
    if (!original) return null;
  }

  let content: string | null = null;
  if (original) {
    content = replaceOnce(memory.content, original, value);
  } else {
    const label = escapeRegex(subjectName(subject)).replace(/\s+/g, "\\s+");
    const field = new RegExp(
      "^(\\s*(?:(?:my|the)\\s+)?" + label
        + "\\s*(?:is\\b|[:=])\\s*)([^\\r\\n;]+)(?=[\\r\\n;]|$)",
      "im",
    ).exec(memory.content);
    if (field) {
      const start = field.index + field[1].length;
      const fieldValue = field[2].trimEnd().replace(/[.!?]$/, "");
      if (!fieldValue || /[.!?]\s+\S/.test(fieldValue)) return null;
      content = memory.content.slice(0, start) + value
        + memory.content.slice(start + fieldValue.length);
    } else if (matchesTitle && !/[\r\n]|[.;!?]\s+\S/.test(memory.content)) {
      content = value;
    }
  }

  if (!content || content.length > 10_000) return null;
  return {
    memory,
    draft: {
      title: original && memory.title
        ? replaceOnce(memory.title, original, value) ?? memory.title
        : memory.title,
      content,
      tags: memory.tags ?? [],
    },
  };
}

function factId(owner: string, content: string): string {
  const hash = createHash("sha256").update(JSON.stringify([owner, normalize(content)])).digest("hex");
  return [
    hash.slice(0, 8), hash.slice(8, 12), "8" + hash.slice(13, 16),
    "8" + hash.slice(17, 20), hash.slice(20, 32),
  ].join("-");
}

async function findCandidates(
  client: MemoryClient,
  userId: string,
  subject: string,
  text: string,
  referenceIds: string[] = [],
) {
  const owned = () => client.from("memories").select(MEMORY_COLUMNS).eq("user_id", userId);
  const email = isEmailSubject(subject);
  const exact = escapePattern(subjectName(subject));
  // PostgREST receives each filter independently. Check matches in the returned rows
  // before using any of them for a write.
  const lookups = [
    owned().ilike("title", "%" + exact + "%").limit(MAX_CANDIDATES),
    email || text
      ? owned().ilike("content", email ? "%@%" : "%" + escapePattern(text) + "%").limit(MAX_CANDIDATES)
      : null,
    referenceIds.length ? owned().in("id", referenceIds).limit(referenceIds.length) : null,
  ].filter((lookup) => lookup !== null);
  const results = await Promise.all(lookups);
  const notes = new Map<string, Memory>();
  let incomplete = false;
  for (const result of results) {
    if (result.error) throw new Error("Could not read candidate memories");
    const rows = result.data as Memory[];
    incomplete ||= rows.length >= MAX_CANDIDATES;
    for (const row of rows) {
      if (row.user_id === userId) notes.set(row.id, row);
    }
  }
  return { notes: Array.from(notes.values()), incomplete };
}

function changed(action: ChatMemoryChange["action"], memories: Memory[]): ChatMemoryOutcome {
  return {
    memories,
    changes: memories.map(({ id, title }) => ({ id, title, action })),
  };
}

async function editFromChat(
  client: MemoryClient,
  userId: string,
  message: string,
  intent: UpdateIntent,
  reference?: ChatReference,
): Promise<ChatMemoryOutcome> {
  const referringToPriorNote = /\b(?:change|update|replace|edit|correct|set)\s+(?:it|that|this|the\s+(?:memory|note))\b/i.test(message);
  const referenceIds = referringToPriorNote ? (reference?.sourceIds ?? []) : [];
  const { notes, incomplete } = await findCandidates(
    client,
    userId,
    intent.subject,
    (intent.previousValue ?? subjectName(intent.subject)).slice(0, 120),
    referenceIds,
  );
  const subject = subjectName(intent.subject);
  const email = isEmailSubject(intent.subject);
  const candidates = notes
    .filter((note) => email || !intent.previousValue
      || referenceIds.includes(note.id)
      || normalize(note.title ?? "").includes(subject)
      || normalize(note.content).includes(subject))
    .map((note) => buildEdit(note, intent))
    .filter((candidate): candidate is EditCandidate => candidate !== null);

  const exactMatches = candidates.filter(({ memory }) =>
    subjectName(memory.title ?? "") === subjectName(intent.subject));
  const referenced = candidates.filter(({ memory }) => referenceIds.includes(memory.id));
  const referredEmail = email && hasEmailTopic(reference?.question ?? "") && referenced.length > 0;
  const likely = referredEmail ? referenced : exactMatches.length ? exactMatches : referenced.length ? referenced : candidates;

  if (likely.length !== 1 || (incomplete && !exactMatches.length && !referenced.length)) {
    if (likely.length > 1 || incomplete) {
      const titles = [...new Set(likely.map(({ memory }) => memory.title || "Untitled memory"))].slice(0, 4);
      const choices = titles.length ? " I found " + titles.map((title) => "“" + title + "”").join(", ") + "." : "";
      return { reply: "Which memory should I update?" + choices + " Include its title or the exact text to replace in your update request." };
    }
    return { reply: "I couldn’t find a memory I can update safely. Include the note’s exact title or the text you want to replace." };
  }

  const { memory, draft } = likely[0];
  if (draft.title === memory.title && draft.content === memory.content) {
    return { reply: "That memory already has this value.", memories: [memory] };
  }
  const updated = await updateMemory(client, userId, memory.id, draft, memory);
  if (!updated) {
    return { reply: "That memory changed while I was updating it. Open it to check the latest text, then try again." };
  }
  if (updated.id !== memory.id || updated.title !== draft.title || updated.content !== draft.content) {
    return { reply: "I couldn’t verify the saved change. Open the memory to check its current value." };
  }
  return { ...changed("updated", [updated]), reply: "I updated your memory." };
}

async function editReferencedEmail(
  client: MemoryClient,
  userId: string,
  message: string,
  subject: string,
  reference?: ChatReference,
): Promise<ChatMemoryOutcome> {
  if (!reference?.question) return { reply: ASK_FOR_NEW_EMAIL };

  // Use the latest user-authored request, since citations and saved answers can
  // still contain the old address. A replay from History cannot supply a value.
  const { data: previous, error } = await client
    .from("query_history")
    .select("question, answer, meta, settings")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || previous?.question !== reference.question) return { reply: ASK_FOR_NEW_EMAIL };

  const previousMode = previous.settings?.memoryMode;
  const legacyClarification = previousMode === undefined
    && previous.answer === "Which memory should I update, and what should it say?";
  if (previousMode !== "auto" && previousMode !== "manual" && !legacyClarification) {
    return { reply: ASK_FOR_NEW_EMAIL };
  }

  const priorIntent = literalEmailReplacement(previous.question);
  const currentScope = emailScope(subject);
  const previousScope = priorIntent && emailScope(priorIntent.subject);
  if (!priorIntent || (currentScope && previousScope && currentScope !== previousScope)) {
    return { reply: ASK_FOR_NEW_EMAIL };
  }

  const intent = { ...priorIntent, subject: currentScope ? subject : priorIntent.subject };
  const receipts = previous.meta?.memoryChanges;
  const applied = Array.isArray(receipts)
    ? receipts.find((receipt: ChatMemoryChange) => receipt?.action === "updated" && typeof receipt.id === "string")
    : undefined;
  if (!applied) return editFromChat(client, userId, message, intent);

  // An edit already acknowledged by chat is a no-op. Do not undo a newer edit.
  const { data: note, error: noteError } = await client
    .from("memories").select(MEMORY_COLUMNS)
    .eq("user_id", userId).eq("id", applied.id).maybeSingle();
  if (!noteError && note?.user_id === userId
    && emailFields(note, intent.subject).some((address) => normalize(address) === normalize(intent.value))) {
    return { reply: "That memory already has this value.", memories: [note] };
  }
  return { reply: "That memory has changed since the last update. Send the update with the full address to confirm." };
}

export async function handleChatMemory(
  client: MemoryClient,
  userId: string,
  message: string,
  mode: ChatMemoryMode,
  reference?: ChatReference,
  plan?: ChatMessagePlan | null,
): Promise<ChatMemoryOutcome> {
  if (mode === "read-only") return {};

  const direct = getDirectChatMemoryIntent(message, reference?.question, mode === "auto");
  const referencedEmail = referencedEmailReplacementSubject(message);
  const update = direct.kind === "update" ? direct
    : plan?.update ? { kind: "update" as const, ...plan.update } : undefined;
  const editRequested = !!(update || referencedEmail || direct.kind === "clarify"
    || plan?.updateRequested || isDirectMemoryEditRequest(message));

  let edit: ChatMemoryOutcome = {};
  try {
    if (referencedEmail) {
      edit = await editReferencedEmail(client, userId, message, referencedEmail, reference);
    } else if (update) {
      edit = await editFromChat(client, userId, message, update, reference);
    } else if (editRequested) {
      edit = { reply: direct.kind === "clarify" ? direct.message : "Tell me which memory to update and what new value to use." };
    }
  } catch {
    edit = { reply: "I couldn’t update the memory. You can retry or open the note and edit it directly." };
  }

  const facts = new Map<string, Fact>();
  const proposedFacts = [...(direct.kind === "save" ? direct.facts : []), ...(plan?.facts ?? [])];
  const unresolvedEmailEdit = !update && editRequested
    && (hasEmailTopic(message) || findEmailAddresses(message).length > 0);
  for (const fact of proposedFacts) {
    const content = normalize(fact.content);
    // The edit already accounts for its replacement value. A rejected email
    // edit must not be converted into a second, conflicting email note.
    if ((update && content.includes(normalize(update.value)))
      || (unresolvedEmailEdit && findEmailAddresses(fact.content).length > 0)) continue;
    if (!facts.has(content)) facts.set(content, fact);
  }

  if (!facts.size) return edit;
  const capture = await rememberFacts(client, userId, Array.from(facts.values()).slice(0, 3));
  return {
    reply: [edit.reply, capture.reply].filter(Boolean).join("\n\n") || undefined,
    changes: [...(edit.changes ?? []), ...(capture.changes ?? [])],
    memories: [...(edit.memories ?? []), ...(capture.memories ?? [])],
  };
}

async function rememberFacts(
  client: MemoryClient,
  userId: string,
  facts: Fact[],
): Promise<ChatMemoryOutcome> {
  const saved: Memory[] = [];
  const existing: Memory[] = [];
  let hasExisting = false;
  let failed = false;
  for (const fact of facts) {
    try {
      const { notes, incomplete } = await findCandidates(
        client, userId, fact.title, fact.content.slice(0, 120),
      );
      const title = subjectName(fact.title);
      const matching = notes.find((note) =>
        normalize(note.content) === normalize(fact.content)
        || (isEmailSubject(fact.title)
          ? emailFields(note, fact.title).length > 0
          : hasSingleValue(title) && subjectName(note.title ?? "") === title));
      if (matching || incomplete) {
        hasExisting = true;
        if (matching) existing.push(matching);
        continue;
      }

      const memory = await createMemory(client, userId, {
        title: fact.title,
        content: fact.content,
        tags: [],
      }, { id: factId(userId, fact.content) });
      if (!memory) hasExisting = true;
      else if (memory.title === fact.title && memory.content === fact.content) saved.push(memory);
      else failed = true;
    } catch {
      failed = true;
    }
  }
  const outcome = changed("saved", saved);
  if (saved.length) {
    const reply = saved.length === 1 ? "I saved that to your notebook." : "I saved those facts to your notebook.";
    return { ...outcome, reply: failed ? reply + " One other fact couldn’t be saved." : reply };
  }
  if (failed) return { reply: "I couldn’t save that fact to your notebook. Please try again." };
  return hasExisting
    ? { reply: "I found a memory for that detail already. To change it, tell me which memory to update and give me the new value.", memories: existing }
    : {};
}
