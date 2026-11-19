import { createHash } from "node:crypto";
import {
  detectChatMemoryIntent,
  findEmailAddresses,
  isEmailSubject,
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
type Draft = { title: string | null; content: string; tags: string[] };
type EditCandidate = { memory: Memory; draft: Draft };
type ChatMemoryOutcome = {
  reply?: string;
  changes?: ChatMemoryChange[];
  memories?: Memory[];
};

const MAX_CANDIDATES = 100;
const SINGLE_VALUE_TITLES = new Set(["name", "full name", "first name", "last name", "preferred name", "where i live", "employer"]);

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
  const referringToPriorNote = /\b(?:change|update|replace|edit|correct|set)\s+(?:it|that|this)\b/i.test(message);
  const referenceIds = referringToPriorNote ? (reference?.sourceIds ?? []) : [];
  const { notes, incomplete } = await findCandidates(
    client,
    userId,
    intent.subject,
    (intent.previousValue ?? subjectName(intent.subject)).slice(0, 120),
    referenceIds,
  );
  const subject = subjectName(intent.subject);
  const candidates = notes
    .filter((note) => isEmailSubject(intent.subject) || !intent.previousValue
      || referenceIds.includes(note.id)
      || normalize(note.title ?? "").includes(subject)
      || normalize(note.content).includes(subject))
    .map((note) => buildEdit(note, intent))
    .filter((candidate): candidate is EditCandidate => candidate !== null);

  const exactMatches = candidates.filter(({ memory }) =>
    subjectName(memory.title ?? "") === subjectName(intent.subject));
  const referenced = candidates.filter(({ memory }) => referenceIds.includes(memory.id));
  const likely = exactMatches.length ? exactMatches : referenced.length ? referenced : candidates;

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
  return { ...changed("updated", [updated]), reply: "I updated your memory." };
}

export async function handleChatMemory(
  client: MemoryClient,
  userId: string,
  message: string,
  mode: ChatMemoryMode,
  reference?: ChatReference,
): Promise<ChatMemoryOutcome> {
  if (mode === "read-only") return {};
  const intent = await detectChatMemoryIntent(message, reference?.question, mode === "auto");
  if (intent.kind === "none") return {};
  if (intent.kind === "clarify") return { reply: intent.message };
  if (intent.kind === "update") {
    try {
      return await editFromChat(client, userId, message, intent, reference);
    } catch {
      return { reply: "I couldn’t update the memory. You can retry or open the note and edit it directly." };
    }
  }

  const saved: Memory[] = [];
  const existing: Memory[] = [];
  let hasExisting = false;
  let failed = false;
  for (const fact of intent.facts.slice(0, 3)) {
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
      if (memory) saved.push(memory);
      else hasExisting = true;
    } catch {
      failed = true;
    }
  }
  const outcome = changed("saved", saved);
  const explicitSave = /^(?:please\s+)?(?:(?:can|could|would)\s+you\s+)?(?:remember|save|add)\b/i.test(message);
  if (message.endsWith("?") && !explicitSave) return saved.length ? outcome : {};
  if (saved.length) {
    const reply = saved.length === 1 ? "I saved that to your notebook." : "I saved those facts to your notebook.";
    return { ...outcome, reply: failed ? reply + " One other fact couldn’t be saved." : reply };
  }
  if (failed) return { reply: "I couldn’t save that fact to your notebook. Please try again." };
  return hasExisting
    ? { reply: "I found a memory for that detail already. To change it, tell me which memory to update and give me the new value.", memories: existing }
    : {};
}
