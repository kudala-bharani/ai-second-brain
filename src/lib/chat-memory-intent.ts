export type ChatMemoryIntent =
  | { kind: "none" }
  | { kind: "clarify"; message: string }
  | { kind: "update"; subject: string; value: string; previousValue?: string }
  | { kind: "save"; facts: { title: string; content: string }[] };

type MemoryFact = Extract<ChatMemoryIntent, { kind: "save" }>["facts"][number];

const NO_INTENT: ChatMemoryIntent = { kind: "none" };
const CLARIFY_UPDATE: ChatMemoryIntent = {
  kind: "clarify",
  message: "Which memory should I update, and what should it say?",
};

const EMAIL = /[a-z\d.!#$%&'*+/=?^_{|}~-]+@[a-z\d](?:[a-z\d-]*[a-z\d])?(?:\.[a-z\d](?:[a-z\d-]*[a-z\d])?)+/gi;
const EMAIL_TOPIC = /\be-?mail(?:\s+(?:address|id))?\b/i;
const EMAIL_SUBJECT = /^(?:(?:my|the)\s+)?(?:(?:personal|work|school|primary|secondary|new|old)\s+)?e-?mail(?:\s+(?:address|id))?(?:\s+(?:note|memory)|\s+in\s+(?:my|the)\s+(?:saved\s+)?(?:note|notes|memory|notebook))?$/i;
const CHAT_PREAMBLE = /^(?:(?:ok(?:ay)?|hi|hey|yes|yeah|sure|actually|now)\b\s*(?:[,.!:]\s*|\s+))+/i;
const EDIT_START = /^(?:please\s+)?(?:(?:can|could|would|will)\s+you\s+|i\s+want\s+you\s+to\s+)?(?:please\s+)?(change|update|replace|set|edit|correct|revise|modify)\s+/i;
const EDIT_END = /(?:\s*[,;]\s*|\s+)(?:and\s+)?(?:please\s+)?(?:update|change|edit|correct)(?:\s+(?:it|this|that)(?:\s+(?:in|as|is)\s+(?:(?:my|the|your)\s+)?(?:memory|memroy|notes?|notebook))?|\s+(?:my|the|this|that)\s+(?:memory|memroy|notes?))(?:\s+in\s+(?:my|the)\s+notebook)?[.!?]*$/i;
const EMAIL_DECLARATION = /^(?:(?:this|here)\s+is\s+|here['’]s\s+)?((?:(?:my|the|this|that)\s+)?(?:(?:new|updated|current|correct)\s+)?(?:(?:personal|work|school|primary|secondary)\s+)?e-?mail(?:\s+(?:address|id))?)(?:\s+is\s+|\s*[:=]\s*|\s+)([\s\S]+)$/i;
const EDIT_WRAPPER = /^(?:(?:my|the|this|that)\s+)?(?:memory|memroy|note|notebook)\s+to\s+/i;
const UNNAMED_MEMORY = /^(?:(?:my|the|this|that)\s+)?(?:memory|memroy|note|notebook)$/i;
const REPLACEMENT = /^([\s\S]+?)\s+(?:to|with|as)\s+([\s\S]+)$/i;
const REMEMBER_START = /^(?:please\s+)?(?:(?:can|could|would)\s+you\s+)?(?:please\s+)?(?:remember\s+(?:that\s+|to\s+|(?=i(?:'m| am|\s)|my\s))|(?:remember|save\s+this|add\s+to\s+memory)\s*[:–—]\s*)/i;
const NO_SAVE = /\b(?:do not|don't|don’t|never|not to)\s+(?:save|remember|record|store|update|change|replace|edit|correct|revise|modify)\b/i;
const NOT_A_FACT = /\b(?:what if|hypothetically|for example|as an example|suppose|pretend|imagine if|if i|fictional|made.up|i might|i may|maybe i|i think|i'm not sure|i’m not sure)\b/i;
const SECRET = /\b(?:passwords?|passcodes?|passphrases?|api\s*(?:keys?|tokens?|secrets?)|access\s*tokens?|secret\s*keys?|private\s*keys?|verification\s*codes?|one[- ]time\s*(?:passwords?|codes?)|recovery\s*(?:code|phrase|key)s?|(?:my|your|account)\s+pin|social\s+security|ssn|(?:credit|debit)\s+card)\b|(?:\b(?:gh[pousr]_|github_pat_|sk-(?:proj-|or-v1-)?|AKIA|hf_|xox[baprs]-)[a-z0-9_-]{12,})|-----BEGIN [A-Z ]*PRIVATE KEY-----/i;
const QUOTED_OR_PASTED = /^(?:["“‘'\x60]|>\s*|(?:user|assistant|system|example|sample|quote|transcript)\s*:)/i;
const QUESTION_START = /^(?:hi[,.]?\s+)?(?:what|where|when|why|who|how|do|does|did|is|are|am|can|could|would|will|should|have|has|was|were)\s+/i;
const PRONOUN_SUBJECT = /^(?:that|it|this|the memory|the note|this memory|that memory|this note|that note)$/i;

export function findEmailAddresses(text: string): string[] {
  const addresses = text.match(EMAIL) ?? [];
  return [...new Map(addresses.map((address) => [address.toLowerCase(), address])).values()];
}

export function isEmailSubject(subject: string): boolean {
  return EMAIL_SUBJECT.test(subject.trim());
}

function emailSubject(text: string): string {
  const qualifier = text.match(/\b(personal|work|school|primary|secondary)\s+e-?mail\b/i)?.[1];
  return qualifier ? qualifier.charAt(0).toUpperCase() + qualifier.slice(1).toLowerCase() + " email" : "Email address";
}

function trimValue(input: string): string {
  const trimmed = input.trim().replace(/[.!?]+$/, "").trim();
  return trimmed.replace(/^(?:["“‘]+|')|(?:["”’]+|')$/g, "").trim();
}

function trimSubject(input: string): string {
  return trimValue(input.replace(/^(?:the\s+)?(?:note|memory)\s+(?:titled|named|called)\s+/i, ""));
}

function previousField(question: string | undefined): string {
  const match = question?.match(/^what(?:['’]s|\s+(?:is|was))\s+(?:my|the)\s+([\p{L}\p{N}][\p{L}\p{N}\s'-]{1,79})\s*\??$/iu);
  return match?.[1].trim() ?? "";
}

export function canWriteFromMessage(message: string): boolean {
  const current = message.trim();
  return !!current && !QUOTED_OR_PASTED.test(current.replace(CHAT_PREAMBLE, ""))
    && !NO_SAVE.test(current) && !NOT_A_FACT.test(current) && !SECRET.test(current);
}

function getExplicitEdit(message: string) {
  const current = message.replace(CHAT_PREAMBLE, "");
  if (QUOTED_OR_PASTED.test(current)) return null;
  const prefix = current.match(EDIT_START);
  const suffix = current.match(EDIT_END);
  if (!prefix && !suffix) return null;

  // A trailing instruction can qualify a statement such as "My email is x, update the memory."
  const statement = current.slice(prefix?.[0].length ?? 0, suffix?.index ?? current.length);
  const wrapper = prefix && statement.match(EDIT_WRAPPER);
  if (wrapper) {
    const wrapped = statement.slice(wrapper[0].length);
    const command = wrapped.match(EDIT_START);
    if (command) return { verb: command[1].toLowerCase(), statement: wrapped.slice(command[0].length) };
  }
  return { verb: prefix?.[1].toLowerCase(), statement };
}

export function referencedEmailReplacementSubject(message: string): string | null {
  const current = message.trim();
  if (!canWriteFromMessage(current)) return null;
  const edit = getExplicitEdit(current);
  if (!edit?.verb) return null;
  const replacement = edit.statement.match(REPLACEMENT);
  if (!replacement) return null;
  const target = trimSubject(replacement[1]);
  const reference = trimValue(replacement[2]);
  const subject = isEmailSubject(target)
    ? target
    : UNNAMED_MEMORY.test(target) && EMAIL_TOPIC.test(reference) ? reference : null;
  if (!subject) return null;
  if (!/^(?:(?:this|that|the)\s+(?:new\s+)?(?:one|e-?mail(?:\s+(?:address|id))?|address)|the\s+(?:one|e-?mail(?:\s+(?:address|id))?|address)\s+i\s+(?:just\s+)?(?:gave|sent|mentioned)(?:\s+you)?)$/i
    .test(reference)) return null;
  return emailSubject(subject);
}

function literalEmail(value: string): string | undefined {
  const text = trimValue(value);
  return findEmailAddresses(text).find((address) => address === text);
}

function checkDirectUpdate(edit: ReturnType<typeof getExplicitEdit>, previousQuestion: string | undefined): ChatMemoryIntent | null {
  if (!edit) return null;
  const { verb, statement } = edit;
  const declaration = !verb && statement.match(EMAIL_DECLARATION);
  if (declaration) {
    const value = literalEmail(declaration[2]);
    return value
      ? { kind: "update", subject: emailSubject(declaration[1]), value }
      : CLARIFY_UPDATE;
  }
  if (verb === "replace") {
    const findReplace = statement.match(/^["“']([^"”']+)["”']\s+with\s+["“']([^"”']+)["”']\s+in\s+(.+)$/i)
      ?? statement.match(/^(.+?)\s+with\s+(.+?)\s+in\s+((?:the\s+)?(?:note|memory)\s+(?:titled|named|called)\s+.+)$/i);
    if (findReplace) {
      const subject = trimSubject(findReplace[3]);
      const previousValue = trimValue(findReplace[1]);
      const value = trimValue(findReplace[2]);
      if (subject && subject.length <= 120 && previousValue && value) {
        if (isEmailSubject(subject) && (!literalEmail(previousValue) || !literalEmail(value))) {
          return CLARIFY_UPDATE;
        }
        return { kind: "update", subject, previousValue, value };
      }
    }
  }
  const replacement = statement.match(REPLACEMENT);
  const subjectText = trimSubject(replacement?.[1] ?? "");
  const isPriorEmail = !!previousQuestion && EMAIL_TOPIC.test(previousQuestion);
  const wrappedEmail = replacement && UNNAMED_MEMORY.test(subjectText)
    ? replacement[2].match(EMAIL_DECLARATION)
    : null;
  if (wrappedEmail) {
    const value = literalEmail(wrappedEmail[2]);
    if (!value) return CLARIFY_UPDATE;
    const subject = emailSubject(wrappedEmail[1]);
    return {
      kind: "update",
      subject: subject === "Email address" && isPriorEmail ? emailSubject(previousQuestion) : subject,
      value,
    };
  }
  const from = subjectText.match(/^(.+?)\s+from\s+(.+)$/i);
  const previousEmail = from && isEmailSubject(from[1]) ? literalEmail(from[2]) : literalEmail(subjectText);
  const assignment = replacement ? null : statement.match(/^(.+?)(?:\s+is\s+|\s*[:=]\s*)(.+)$/i);
  const assignedEmail = assignment && isEmailSubject(trimSubject(assignment[1])) ? literalEmail(assignment[2]) : undefined;
  const emailEdit = isEmailSubject(subjectText) || !!previousEmail || !!assignedEmail ||
    (isPriorEmail && (PRONOUN_SUBJECT.test(subjectText) || !subjectText));

  if (emailEdit) {
    const value = replacement ? literalEmail(replacement[2]) : assignedEmail;
    if (!value) return CLARIFY_UPDATE;
    const topic = from?.[1] || (isEmailSubject(subjectText) ? subjectText : assignment?.[1] || previousQuestion || statement);
    return {
      kind: "update",
      subject: emailSubject(topic),
      value,
      ...(previousEmail ? { previousValue: previousEmail } : {}),
    };
  }

  const refersToPrevious = PRONOUN_SUBJECT.test(subjectText);
  const previousPreference = refersToPrevious && previousQuestion
    ? /^i\s+(?:prefer|love|enjoy|like)\s+(.+)$/i.exec(previousQuestion.trim())?.[1]
    : undefined;
  const namedSubject = refersToPrevious
    ? previousPreference ? preferenceTitle(previousPreference) : previousField(previousQuestion)
    : subjectText;
  if (replacement && verb !== "replace" && namedSubject.length > 0 && namedSubject.length <= 120) {
    const value = trimValue(replacement[2]);
    if (value && !/^(?:change|replace|update|edit|set|remove|delete|rename|add)\s+/i.test(value)) {
      return {
        kind: "update",
        subject: namedSubject,
        value,
        ...(previousPreference ? { previousValue: trimValue(previousPreference) } : {}),
      };
    }
  }

  return CLARIFY_UPDATE;
}

export function literalEmailReplacement(message: string): Extract<ChatMemoryIntent, { kind: "update" }> | null {
  const current = message.trim();
  if (!canWriteFromMessage(current)) return null;
  const intent = checkDirectUpdate(getExplicitEdit(current), undefined);
  return intent?.kind === "update" && isEmailSubject(intent.subject) && literalEmail(intent.value) === intent.value
    ? { ...intent, subject: emailSubject(intent.subject) }
    : null;
}

export function splitChatSentences(message: string): string[] {
  return message.split(/(?<=[.!?])\s+|[\r\n]+|[,;]\s+(?=(?:what|where|when|why|who|how|can|could|should|do|does|did|is|are)\s)/i);
}

function factSentences(message: string): string[] {
  return splitChatSentences(message)
    .map((sentence) => sentence.trim().replace(/^(?:by the way|for context|also|actually|yes|yeah|sure)[,:]\s+/i, ""))
    .filter((sentence) => sentence.length > 3 && sentence.length <= 500 &&
      !sentence.endsWith("?") && !QUESTION_START.test(sentence) && !QUOTED_OR_PASTED.test(sentence));
}

function preferenceTitle(preference: string): string {
  const subject = trimValue(preference.split(/\s+(?:over|instead of|because|when)\s+/i)[0]);
  return subject && subject.length <= 45 ? "Preference for " + subject : "Preference";
}

function directFacts(sentences: string[]): MemoryFact[] {
  const facts: MemoryFact[] = [];
  for (const sentence of sentences) {
    const email = sentence.match(/^(?:my\s+)?(?:(?:personal|work|school|primary|secondary)\s+)?e-?mail(?:\s+(?:address|id))?\s*(?:is\b|:|=)\s*(.+)$/i);
    const namedPreference = sentence.match(/^my\s+((?:favou?rite|preferred)\s+[^.!?]{1,38}?)\s+(?:is|are)\s+\S/i);
    const preference = sentence.match(/^i\s+(?:prefer|love|enjoy|like)\s+(\S.*)$/i);
    if (email && !/^not\b/i.test(email[1]) && findEmailAddresses(email[1]).length === 1) {
      facts.push({ title: emailSubject(sentence), content: sentence });
    } else if (/^my\s+(?:(?:full|first|last|preferred)\s+)?name\s+is\s+\S/i.test(sentence)) {
      facts.push({ title: "Name", content: sentence });
    } else if (/^i\s+(?:live|am based|moved)\s+in\s+\S/i.test(sentence)) {
      facts.push({ title: "Where I live", content: sentence });
    } else if (/^i\s+work\s+(?:for|at|as)\s+\S/i.test(sentence)) {
      facts.push({ title: "Work", content: sentence });
    } else if (namedPreference) {
      const subject = namedPreference[1];
      facts.push({ title: subject.charAt(0).toUpperCase() + subject.slice(1), content: sentence });
    } else if (preference && !/^(?:this\b|that\b|it\b|how you\b|your (?:answer|reply|response)\b)/i.test(preference[1])) {
      facts.push({ title: preferenceTitle(preference[1]), content: sentence });
    }
  }
  return facts;
}

export function getDirectChatMemoryIntent(
  message: string,
  previousQuestion: string | undefined,
  autoRemember: boolean,
): ChatMemoryIntent {
  const current = message.trim();
  if (!canWriteFromMessage(current)) return NO_INTENT;

  const context = previousQuestion && canWriteFromMessage(previousQuestion) ? previousQuestion.slice(0, 500) : undefined;
  const directUpdate = checkDirectUpdate(getExplicitEdit(current), context);
  if (directUpdate) return directUpdate;

  const content = current.replace(CHAT_PREAMBLE, "");
  const remember = content.match(REMEMBER_START);
  if (!autoRemember && !remember) return NO_INTENT;
  const explicitText = remember ? content.slice(remember[0].length).trim().replace(/\?$/, "") : content;
  const sentences = factSentences(explicitText);
  const strongFacts = directFacts(sentences);
  if (strongFacts.length > 0) return { kind: "save", facts: strongFacts.slice(0, 2) };

  if (remember && sentences.length === 1 &&
      (!/^my\s+\S/i.test(explicitText) || /\b(?:is|are|was|were|has|have|uses|needs|lives)\b/i.test(explicitText))) {
    return { kind: "save", facts: [{ title: "Remembered from chat", content: sentences[0] }] };
  }

  return NO_INTENT;
}
