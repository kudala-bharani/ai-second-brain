import { createHash } from "node:crypto";
import type { ChatMessagePlan } from "@/lib/chat-intent-router";
import {
  findEmailAddresses,
  findPhoneNumbers,
  getDirectChatMemoryIntent,
  getPhoneRecallSubject,
  getStandaloneContactIntent,
  hasEmailTopic,
  isDirectMemoryEditRequest,
  isEmailSubject,
  isPhoneSubject,
  literalEmailReplacement,
  parsePhoneNumber,
  referencedEmailReplacementSubject,
  type ChatMemoryIntent,
  type ContactChatIntent,
} from "@/lib/chat-memory-intent";
import {
  createMemory,
  MEMORY_COLUMNS,
  updateMemory,
  type MemoryClient,
} from "@/lib/memory-store";
import type { ChatMemoryChange, ChatMemoryMode, ChatReference, Memory, QueryResult } from "@/types";

type UpdateIntent = Extract<ChatMemoryIntent, { kind: "update" }> & { allowCreate?: boolean };
type Fact = Extract<ChatMemoryIntent, { kind: "save" }>["facts"][number];
type Draft = { title: string | null; content: string; tags: string[] };
type EditCandidate = { memory: Memory; draft: Draft };
export type ChatMemoryOutcome = {
  reply?: string;
  changes?: ChatMemoryChange[];
  memories?: Memory[];
};

const MAX_CANDIDATES = 100;
const SINGLE_VALUE_TITLES = new Set(["name", "full name", "first name", "last name", "preferred name", "where i live", "employer"]);
const ASK_FOR_NEW_EMAIL = "Which new email address should I use? Send the update with the full address.";
const PHONE_KEYWORDS = ["phone", "mobile", "cell", "contact number"];

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
  return /^(?:(?:my|primary|secondary|school|work|business|office|personal|home)\s+){0,2}e[ -]?mail(?:\s+(?:id|address))?$/i
    .test(normalize(subject));
}

function emailFields(memory: Memory, subject: string): string[] {
  const scope = emailScope(subject);
  const title = memory.title ?? "";
  const titleMatches = isEmailField(title) && (!scope || emailScope(title) === scope);
  const matchingLines = memory.content.split("\n").filter((line) => {
    const label = /^\s*(?:[-*]\s+)?((?:(?:my|primary|secondary|school|work|business|office|personal|home)\s+){0,2}e[ -]?mail(?:\s+(?:id|address))?)\s*(?:is\b|[:=])/i
      .exec(line)?.[1];
    return label && (!scope || emailScope(label) === scope);
  });
  const text = matchingLines.length > 0
    ? matchingLines.join("\n")
    : titleMatches ? memory.content : "";
  return findEmailAddresses(text);
}

function phoneScope(subject: string): string | undefined {
  const title = subjectName(subject);
  if (/\b(?:work|business|office)\b/.test(title)) return "work";
  return title.match(/\b(?:home|personal|school|primary|secondary)\b/)?.[0]
    ?? (/\b(?:mobile|cell)(?:[ -]?phone)?\b/.test(title) ? "mobile" : undefined);
}

function phoneNumberKey(number: string): string {
  return number.replace(/[^\d+]/g, "");
}

function phoneFields(memory: Memory, subject: string): string[] {
  const scope = phoneScope(subject);
  const title = memory.title ?? "";
  const titleIsPhone = isPhoneSubject(title);
  const titleScope = titleIsPhone ? phoneScope(title) : undefined;
  const numbers = memory.content.split(/\r?\n/).flatMap((line) => {
    const field = /^\s*(?:[-*]\s+)?(.+?)\s*(?:[:=]|\s+is\b)\s*(.*)$/i.exec(line);
    if (!field || !isPhoneSubject(field[1])) return [];
    if (scope && (phoneScope(field[1]) ?? titleScope) !== scope) return [];
    return findPhoneNumbers(field[2]);
  });
  if (numbers.length || !titleIsPhone || (scope && titleScope !== scope)) return numbers;
  const bare = parsePhoneNumber(memory.content);
  return bare ? [bare] : [];
}

function replaceOnce(text: string, original: string, replacement: string): string | null {
  if (!original) return null;
  const start = text.indexOf(original);
  if (start < 0 || text.indexOf(original, start + original.length) >= 0) return null;
  return text.slice(0, start) + replacement + text.slice(start + original.length);
}

function buildEdit(memory: Memory, intent: UpdateIntent, barePhone?: string): EditCandidate | null {
  const { subject, value, previousValue } = intent;
  let original = previousValue;
  const matchesTitle = subjectName(memory.title ?? "") === subjectName(subject);
  const email = isEmailSubject(subject);
  const phone = isPhoneSubject(subject);
  const replacement = phone ? parsePhoneNumber(value) : value;
  if (!replacement) return null;
  if (email) {
    const addresses = emailFields(memory, subject);
    if (addresses.length > 1 && !previousValue) return null;
    original = previousValue
      ? addresses.find((address) => normalize(address) === normalize(previousValue))
      : addresses[0];
    if (!original) return null;
  }
  if (phone) {
    const numbers = barePhone ? [barePhone] : phoneFields(memory, subject);
    if (numbers.length > 1 && !previousValue) return null;
    const previous = previousValue && parsePhoneNumber(previousValue);
    if (previousValue && !previous) return null;
    original = previous
      ? numbers.find((number) => phoneNumberKey(number) === phoneNumberKey(previous))
      : numbers[0];
    if (!original) return null;
  }

  let content: string | null = null;
  if (original) {
    content = replaceOnce(memory.content, original, replacement);
    if (barePhone && content) {
      content = content.replace(/^\s*/, (spacing) => `${spacing}${subject}: `);
    }
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
      title: !phone && original && memory.title
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
  const phone = isPhoneSubject(subject);
  const titleText = email && !emailScope(subject) ? "mail" : escapePattern(subjectName(subject));
  // PostgREST receives each filter independently. Check matches in the returned rows
  // before using any of them for a write.
  const lookups = phone ? PHONE_KEYWORDS.flatMap((keyword) => [
    owned().ilike("title", `%${keyword}%`).limit(MAX_CANDIDATES),
    owned().ilike("content", `%${keyword}%`).limit(MAX_CANDIDATES),
  ]) : [
    owned().ilike("title", "%" + titleText + "%").limit(MAX_CANDIDATES),
    email || text
      ? owned().ilike("content", email ? "%@%" : "%" + escapePattern(text) + "%").limit(MAX_CANDIDATES)
      : null,
  ].filter((lookup) => lookup !== null);
  if (referenceIds.length) lookups.push(owned().in("id", referenceIds).limit(referenceIds.length));
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

export async function lookupSavedEmail(
  client: MemoryClient,
  userId: string,
  subject: string,
): Promise<QueryResult> {
  const scope = emailScope(subject);
  const field = scope ? `${scope} email address` : "email address";
  const { notes, incomplete } = await findCandidates(client, userId, subject, "");

  const matches = new Map<string, { address: string; note: Memory }>();
  for (const note of notes) {
    for (const address of emailFields(note, subject)) {
      const key = normalize(address);
      if (!matches.has(key) || subjectName(note.title ?? "") === subjectName(subject)) {
        matches.set(key, { address, note });
      }
    }
  }

  if (matches.size > 1 || incomplete) {
    const titles = [...new Set([...matches.values()].map(({ note }) => note.title).filter(Boolean))].slice(0, 4);
    const locations = titles.length ? ` Check ${titles.map((title) => `“${title}”`).join(", ")}.` : "";
    return {
      answer: `I couldn’t identify a single saved ${field}.${locations} Ask for a specific email label, such as work or personal email.`,
      sources: [],
    };
  }

  const match = matches.values().next().value;
  if (!match) return { answer: `I couldn’t find a saved ${field} in your notes.`, sources: [] };

  const { address, note } = match;
  return {
    answer: `Your saved ${field} is \`${address}\`.`,
    sources: [{ ...note, similarity: 1, evidence_snippet: address, evidence_terms: [address] }],
    meta: { retrievalCount: 1 },
  };
}

export async function lookupSavedPhone(
  client: MemoryClient,
  userId: string,
  subject: string,
): Promise<QueryResult | null> {
  const { notes, incomplete } = await findCandidates(client, userId, subject, "");
  const matches = new Map<string, { number: string; note: Memory }>();
  for (const note of notes) {
    for (const number of phoneFields(note, subject)) {
      const key = phoneNumberKey(number);
      if (!matches.has(key) || subjectName(note.title ?? "") === subjectName(subject)) {
        matches.set(key, { number, note });
      }
    }
  }

  if (matches.size > 1 || incomplete) {
    return {
      answer: "I couldn’t identify a single saved phone number. Tell me which note or label to use, such as work phone or mobile.",
      sources: [],
    };
  }
  const match = matches.values().next().value;
  if (!match) return null;
  const { number, note } = match;
  return {
    answer: `Your saved ${subject.toLowerCase()} is \`${number}\`.`,
    sources: [{ ...note, similarity: 1, evidence_snippet: number, evidence_terms: [number] }],
    meta: { retrievalCount: 1 },
  };
}

function changed(action: ChatMemoryChange["action"], memories: Memory[]): ChatMemoryOutcome {
  return {
    memories,
    changes: memories.map(({ id, title }) => ({ id, title, action })),
  };
}

async function verifyPhoneReferences(
  client: MemoryClient,
  userId: string,
  notes: Memory[],
  reference: ChatReference,
  subject: string,
): Promise<Map<string, { bareNumber?: string }>> {
  const candidates = notes.flatMap((note) => {
    if (!reference.sourceIds.includes(note.id)) return [];
    const numbers = phoneFields(note, subject);
    const bareNumber = !note.title?.trim() && !numbers.length ? parsePhoneNumber(note.content) : undefined;
    return numbers.length || bareNumber ? [{ note, numbers, bareNumber }] : [];
  });
  const verified = new Map<string, { bareNumber?: string }>();
  if (!candidates.length) return verified;

  // The client points to an earlier answer. Ground that reference in the
  // server's saved citations before treating a bare number as a phone field
  // or replacing a value that may have changed in another chat.
  const { data: previous, error } = await client
    .from("query_history")
    .select("answer, sources, meta")
    .eq("user_id", userId)
    .eq("question", reference.question)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || typeof previous?.answer !== "string" || !Array.isArray(previous.sources)) return verified;
  const answered = new Set(findPhoneNumbers(previous.answer).map(phoneNumberKey));
  const hasModelAnswer = typeof previous.meta?.modelUsed === "string" && !!previous.meta.modelUsed;
  for (const { note, numbers, bareNumber } of candidates) {
    // The provider-error response can list bare values as raw search results.
    // It did not identify any of them as the user's phone number.
    if (bareNumber && !hasModelAnswer) continue;
    const cited = previous.sources.some((source: Partial<Memory> | null) =>
      source?.id === note.id && source.user_id === userId
      && source.title === note.title && source.content === note.content);
    const values = bareNumber ? [bareNumber] : numbers;
    if (cited && values.some((number) => answered.has(phoneNumberKey(number)))) {
      verified.set(note.id, { bareNumber });
    }
  }
  return verified;
}

async function editFromChat(
  client: MemoryClient,
  userId: string,
  message: string,
  intent: UpdateIntent,
  reference?: ChatReference,
): Promise<ChatMemoryOutcome> {
  const referringToPriorNote = /\b(?:change|update|replace|edit|correct|set)\s+(?:it|that|this|the\s+(?:memory|note))\b/i.test(message);
  const phone = isPhoneSubject(intent.subject);
  const priorPhoneTopic = phone && getPhoneRecallSubject(reference?.question ?? "");
  const referenceIds = referringToPriorNote || priorPhoneTopic ? (reference?.sourceIds ?? []) : [];
  const identifiesPhone = phone && (!!intent.previousValue || (!!phoneScope(intent.subject)
    && getDirectChatMemoryIntent(message, undefined, false).kind === "update"));
  const priorPhone = phone && !identifiesPhone && referringToPriorNote && reference
    ? getPhoneRecallSubject(reference.question) : undefined;
  if (priorPhone && phoneScope(priorPhone)) {
    if (phoneScope(intent.subject) && phoneScope(intent.subject) !== phoneScope(priorPhone)) {
      return { reply: "The last answer used a different phone label. Tell me which note you want to update." };
    }
    intent = { ...intent, subject: priorPhone };
  }
  const { notes, incomplete } = await findCandidates(
    client,
    userId,
    intent.subject,
    (intent.previousValue ?? subjectName(intent.subject)).slice(0, 120),
    referenceIds,
  );
  const subject = subjectName(intent.subject);
  const email = isEmailSubject(intent.subject);
  const contactFields = (note: Memory) => phone ? phoneFields(note, intent.subject)
    : email ? emailFields(note, intent.subject) : [];
  const labeledContacts = notes.some((note) => contactFields(note).length > 0);
  const trustPriorAnswer = priorPhone || (!labeledContacts && priorPhoneTopic);
  const phoneReferences = trustPriorAnswer && reference && referenceIds.length
    ? await verifyPhoneReferences(client, userId, notes, reference, intent.subject) : undefined;
  const availableNotes = phoneReferences ? notes.filter((note) => phoneReferences.has(note.id)) : notes;
  const ambiguousPhone = phone && !intent.previousValue && availableNotes.some((note) => contactFields(note).length > 1);
  const candidates = availableNotes
    .filter((note) => email || phone || !intent.previousValue
      || referenceIds.includes(note.id)
      || normalize(note.title ?? "").includes(subject)
      || normalize(note.content).includes(subject))
    .map((note) => buildEdit(note, intent, phoneReferences?.get(note.id)?.bareNumber))
    .filter((candidate): candidate is EditCandidate => candidate !== null);

  const exactMatches = candidates.filter(({ memory }) =>
    subjectName(memory.title ?? "") === subjectName(intent.subject));
  const referenced = candidates.filter(({ memory }) => referenceIds.includes(memory.id));
  const referredEmail = email && hasEmailTopic(reference?.question ?? "") && referenced.length > 0;
  const likely = phone ? candidates
    : referredEmail ? referenced : exactMatches.length ? exactMatches : referenced.length ? referenced : candidates;
  const uncertain = incomplete && (phone ? !phoneReferences : !exactMatches.length && !referenced.length);

  if (!likely.length && intent.allowCreate && !labeledContacts && !incomplete && !referenceIds.length) {
    const title = intent.subject;
    const content = `${title}: ${intent.value}`;
    const id = factId(userId, `contact field: ${subject}`);
    const created = await createMemory(client, userId, { title, content, tags: [] }, { id, allowUnindexed: true });
    if (created?.id === id && created.title === title && created.content === content) {
      return { ...changed("saved", [created]), reply: "I saved that to your notebook." };
    }
    if (!created) {
      const { data: existing, error } = await client.from("memories").select(MEMORY_COLUMNS)
        .eq("user_id", userId).eq("id", id).maybeSingle();
      if (!error && existing?.user_id === userId && existing.title === title && existing.content === content) {
        return { reply: "That memory already has this value.", memories: [existing] };
      }
    }
    return { reply: "I couldn’t verify the saved change. Ask for the saved value, then try again." };
  }

  if (likely.length !== 1 || uncertain || ambiguousPhone) {
    if (likely.length > 1 || uncertain || ambiguousPhone) {
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
  directIntent?: ChatMemoryIntent | ContactChatIntent,
): Promise<ChatMemoryOutcome> {
  if (mode === "read-only") return {};

  const direct = directIntent ?? getStandaloneContactIntent(message, reference?.question)
    ?? getDirectChatMemoryIntent(message, reference?.question, mode === "auto");
  if ("explicit" in direct && !direct.explicit && mode !== "auto") {
    return { reply: "Automatic saving is off. Start with “Remember” to save this detail." };
  }
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
  const editedPhone = update && isPhoneSubject(update.subject) && parsePhoneNumber(update.value);
  const unresolvedPhoneEdit = !update && editRequested && findPhoneNumbers(message).length > 0
    && !!getPhoneRecallSubject(reference?.question ?? "");
  for (const fact of proposedFacts) {
    const content = normalize(fact.content);
    // An edit already accounts for its replacement value. Failed edits should
    // leave existing facts in place without creating a conflicting note.
    if ((update && content.includes(normalize(update.value)))
      || (unresolvedEmailEdit && findEmailAddresses(fact.content).length > 0)
      || (unresolvedPhoneEdit && isPhoneSubject(fact.title))
      || (editedPhone && findPhoneNumbers(fact.content).some((number) =>
        phoneNumberKey(number) === phoneNumberKey(editedPhone)))) continue;
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
          : isPhoneSubject(fact.title)
            ? phoneFields(note, fact.title).length > 0
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
      }, { id: factId(userId, fact.content), allowUnindexed: true });
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
