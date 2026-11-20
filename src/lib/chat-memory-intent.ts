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
const CLARIFY_EMAIL_REPLACEMENT: ChatMemoryIntent = {
  kind: "clarify",
  message: "What is the new email address? Include the full replacement address in your update.",
};
const CLARIFY_PHONE_REPLACEMENT: ChatMemoryIntent = {
  kind: "clarify",
  message: "What is the new phone number? Include one complete phone number in your update.",
};

const EMAIL = /[a-z\d.!#$%&'*+/=?^_{|}~-]+@[a-z\d](?:[a-z\d-]*[a-z\d])?(?:\.[a-z\d](?:[a-z\d-]*[a-z\d])?)+/gi;
const EMAIL_TOPIC = /\be[ -]?mail\b/i;
const LABELLED_EMAIL_TYPO = /\b(?:new|updated|current|correct(?:ed)?|personal|work|school|primary|secondary)\s+(?:(?:personal|work|school|primary|secondary)\s+)?emil\b|\bemil\s+(?:address|id)\b/i;
const EMAIL_SUBJECT = /^(?:(?:my|the)\s+)?(?:(?:new|old|updated|current|correct(?:ed)?)\s+)?(?:(?:personal|work|school|primary|secondary)\s+)?(?:e[ -]?mail|emil)(?:\s+(?:address|id))?(?:\s+(?:note|memory)|\s+in\s+(?:my|the)\s+(?:saved\s+)?(?:note|notes|memory|notebook))?$/i;
const CHAT_PREAMBLE = /^(?:(?:ok(?:ay)?|hi|hey|yes|yeah|sure|actually|now)\b\s*(?:[,.!:]\s*|\s+))+/i;
const EDIT_START = /^(?:please\s+)?(?:(?:can|could|would|will)\s+(?:you|u)\s+|i\s+want\s+(?:you|u)\s+to\s+)?(?:please\s+)?(change|update|replace|set|edit|correct|revise|modify)\s+/i;
const EDIT_END = /(?:\s*[,;]\s*|\s+)(?:and\s+)?(?:please\s+)?(?:update|change|edit|correct)(?:\s+(?:it|this|that)(?:\s+(?:in|as|is)\s+(?:(?:my|the|your)\s+)?(?:memory|memroy|notes?|notebook))?|\s+(?:my|the|this|that)\s+(?:memory|memroy|notes?))(?:\s+in\s+(?:my|the)\s+notebook)?[.!?]*$/i;
const EMAIL_DECLARATION = /^(?:(?:this|here)\s+is\s+|here['’]s\s+)?((?:(?:my|the|this|that)\s+)?(?:(?:new|updated|current|correct(?:ed)?)\s+)?(?:(?:personal|work|school|primary|secondary)\s+)?(?:e[ -]?mail|emil)(?:\s+(?:address|id))?)(?:\s+is\s+|\s*[:=]\s*|\s+)([\s\S]+)$/i;
const EMAIL_FIELD = "(?:(?:personal|work|school|primary|secondary)\\s+)?(?:e[ -]?mail|emil)(?:\\s+(?:address|id))?";
const OWN_EMAIL_FIELD = "my\\s+" + EMAIL_FIELD;
const CONTACT_CHANGE_VERB = "(?:changed|updated|switched|corrected)";
const EMAIL_CHANGE_DECLARATION = new RegExp(
  "^(?:i(?:['’]ve)?\\s+(?:(?:have|just|recently)\\s+){0,2}" + CONTACT_CHANGE_VERB + "\\s+(" + OWN_EMAIL_FIELD + ")"
    + "|(" + OWN_EMAIL_FIELD + ")\\s+(?:(?:has|been|just|recently)\\s+){0,3}" + CONTACT_CHANGE_VERB + ")\\b([\\s\\S]*)$",
  "i",
);
const EMAIL_RECALL = new RegExp(
  "^(?:please\\s+)?(?:what(?:['’]s|\\s+is)\\s+"
    + "|(?:(?:can|could|would)\\s+(?:you|u)\\s+)?(?:tell|show|remind)\\s+me\\s+(?:of\\s+)?)"
    + "(my\\s+(?:(?:current|saved|stored)\\s+)?" + EMAIL_FIELD + ")(?:\\s+please)?[.!?]*$",
  "i",
);
const PHONE_SCOPE = "(?:personal|home|work|office|school|primary|secondary)";
const PHONE_SCOPE_WORD = new RegExp(String.raw`\b(${PHONE_SCOPE})\s+`, "i");
const PHONE_FIELD = String.raw`(?:${PHONE_SCOPE}\s+)?(?:(?:phone|telephone|(?:mobile|cell)(?:[ -]?phone)?)(?:\s+(?:number|no\.?))?|contact\s+number)`;
const PHONE_SUBJECT = new RegExp(String.raw`^(?:(?:my|the)\s+)?(?:(?:new|old|updated|current|correct(?:ed)?)\s+)?${PHONE_FIELD}(?:\s+(?:note|memory)|\s+in\s+(?:my|the)\s+(?:saved\s+)?(?:note|notes|memory|notebook))?$`, "i");
const PHONE_RECALL = new RegExp(
  String.raw`^(?:please\s+)?(?:what(?:['’]s|\s+is)\s+|(?:(?:can|could|would)\s+(?:you|u)\s+)?(?:tell|show|remind)\s+me\s+(?:of\s+)?)(my\s+(?:(?:current|saved|stored)\s+)?${PHONE_FIELD})(?:\s+please)?[.!?]*$`,
  "i",
);
const PHONE_DECLARATION = new RegExp(
  String.raw`^(?:(?:this|here)\s+is\s+|here['’]s\s+)?((?:(?:my|the|this|that)\s+)?(?:(?:new|updated|current|correct(?:ed)?)\s+)?${PHONE_FIELD})(?:\s+is\s+|\s*[:=]\s*|\s+)([\s\S]+)$`,
  "i",
);
const PHONE_CHANGE_DECLARATION = new RegExp(
  String.raw`^(?:i(?:['’]ve)?\s+(?:(?:have|just|recently)\s+){0,2}${CONTACT_CHANGE_VERB}\s+(my\s+${PHONE_FIELD})|(my\s+${PHONE_FIELD})\s+(?:(?:has|been|just|recently)\s+){0,3}${CONTACT_CHANGE_VERB})\b([\s\S]*)$`,
  "i",
);
const NUMBER_REFERENCE = new RegExp(
  String.raw`^(?:(?:my|the|this|that)\s+)?(?:(?:new|updated|current|correct(?:ed)?)\s+)?(?:(?:${PHONE_SCOPE}|mobile|cell)\s+)?number\b`,
  "i",
);
const PHONE_SPACE = String.raw`[ \t\u00a0\u202f]`;
const PHONE_GROUP = String.raw`(?:\d+|\(\d+\))`;
const PHONE_PATTERN = String.raw`(?:\+${PHONE_SPACE}*)?${PHONE_GROUP}(?:(?:${PHONE_SPACE}*[-.\u2010\u2011\u2013]${PHONE_SPACE}*|${PHONE_SPACE}+|(?<=\))(?=\d)|(?<=\d)(?=\())${PHONE_GROUP})*`;
const PHONE_LITERAL = new RegExp(`^${PHONE_PATTERN}$`);
const PHONE_SPAN = new RegExp(String.raw`(?<![\p{L}\p{N}+])${PHONE_PATTERN}`, "gu");
const PHONE_SUFFIX = new RegExp(String.raw`^(?:[\p{L}\p{N}]|${PHONE_SPACE}*(?:(?:ext(?:ension)?\.?|x|#)${PHONE_SPACE}*\d))`, "iu");
const DATE_LITERAL = /^\d{4}[-.](?:0?[1-9]|1[0-2])[-.](?:0?[1-9]|[12]\d|3[01])$/;
const MULTIPLE_NUMBER_GROUPS = /\d{6,}[^\d]+\d{6,}/;
const EDIT_WRAPPER = /^(?:(?:my|the|this|that)\s+)?(?:memory|memroy|note|notebook)\s+to\s+/i;
const UNNAMED_MEMORY = /^(?:(?:my|the|this|that)\s+)?(?:memory|memroy|note|notebook)$/i;
const REPLACEMENT = /^([\s\S]+?)\s+(?:to|with|as)\s+([\s\S]+)$/i;
const REMEMBER_START = /^(?:please\s+)?(?:(?:can|could|would)\s+you\s+)?(?:please\s+)?(?:remember\s+(?:that\s+|to\s+|(?=i(?:'m| am|\s)|my\s))|(?:remember|save\s+this|add\s+to\s+memory)\s*[:–—]\s*)/i;
const NO_SAVE = /\b(?:do not|don't|don’t|never|not to)\s+(?:save|remember|record|store|update|change|replace|edit|correct|revise|modify)\b/i;
const NOT_A_FACT = /\b(?:what if|hypothetically|for example|as an example|suppose|pretend|imagine if|if i|fictional|made.up|i might|i may|maybe i|i think|i'm not sure|i’m not sure)\b/i;
const SECRET = /\b(?:passwords?|passcodes?|passphrases?|api\s*(?:keys?|tokens?|secrets?)|access\s*tokens?|secret\s*keys?|private\s*keys?|verification\s*codes?|one[- ]time\s*(?:passwords?|codes?)|recovery\s*(?:code|phrase|key)s?|(?:my|your|account)\s+pin|social\s+security|ssn|(?:credit|debit)\s+card)\b|(?:\b(?:gh[pousr]_|github_pat_|sk-(?:proj-|or-v1-)?|AKIA|hf_|xox[baprs]-)[a-z0-9_-]{12,})|-----BEGIN [A-Z ]*PRIVATE KEY-----/i;
const QUOTED_OR_PASTED = /^(?:["“‘'\x60]|>\s*|(?:user|assistant|system|example|sample|quote|transcript)\s*:)/i;
const QUESTION_START = /^(?:hi[,.]?\s+)?(?:what|where|when|why|who|how|do|does|did|is|are|am|can|could|would|will|should|have|has|was|were)\s+/i;
const EDIT_ADVICE = /\b(?:how|instructions?|explain|tutorial|is it possible|(?:can|could|would|should|do|will)\s+(?:i|we))\b/i;
const PRONOUN_SUBJECT = /^(?:that|it|this|the memory|the note|this memory|that memory|this note|that note)$/i;

export function findEmailAddresses(text: string): string[] {
  const addresses = text.match(EMAIL) ?? [];
  return [...new Map(addresses.map((address) => [address.toLowerCase(), address])).values()];
}

export function hasEmailTopic(text: string): boolean {
  const words = text.replace(EMAIL, " ");
  return EMAIL_TOPIC.test(words) || LABELLED_EMAIL_TYPO.test(words);
}

export function isEmailSubject(subject: string): boolean {
  return hasEmailTopic(subject) && EMAIL_SUBJECT.test(subject.trim());
}

function emailSubject(text: string): string {
  const qualifier = text.match(/\b(personal|work|school|primary|secondary)\s+(?:e[ -]?mail|emil)\b/i)?.[1];
  return qualifier ? qualifier.charAt(0).toUpperCase() + qualifier.slice(1).toLowerCase() + " email" : "Email address";
}

export function getEmailRecallSubject(message: string): string | undefined {
  const field = message.trim().replace(CHAT_PREAMBLE, "").match(EMAIL_RECALL)?.[1];
  return field && hasEmailTopic(field) ? emailSubject(field) : undefined;
}

export function isPhoneSubject(subject: string): boolean {
  return PHONE_SUBJECT.test(subject.trim());
}

function phoneSubject(field: string): string {
  const qualifier = field.match(PHONE_SCOPE_WORD)?.[1].toLowerCase();
  if (qualifier === "office") return "Work phone";
  if (qualifier) return qualifier.charAt(0).toUpperCase() + qualifier.slice(1) + " phone";
  return /\b(?:mobile|cell)(?:[ -]?phone)?\b/i.test(field) ? "Mobile phone" : "Phone number";
}

export function getPhoneRecallSubject(message: string): string | undefined {
  const field = message.trim().replace(CHAT_PREAMBLE, "").match(PHONE_RECALL)?.[1];
  return field ? phoneSubject(field) : undefined;
}

export function parsePhoneNumber(value: string): string | undefined {
  const trimmed = value.trim().replace(/[,.!?;]+$/, "").trim();
  const quoted = trimmed.match(/^(?:"(.*)"|“(.*)”|'(.*)'|‘(.*)’)$/);
  const literal = (quoted ? quoted.slice(1).find((part) => part !== undefined) ?? "" : trimmed)
    .trim().replace(/[,.!?;]+$/, "").trim();
  if (!PHONE_LITERAL.test(literal) || DATE_LITERAL.test(literal) || MULTIPLE_NUMBER_GROUPS.test(literal)) {
    return undefined;
  }
  const digits = literal.replace(/\D/g, "");
  return digits.length >= 6 && digits.length <= 15 ? literal : undefined;
}

export function findPhoneNumbers(text: string): string[] {
  return [...text.matchAll(PHONE_SPAN)]
    .filter(({ 0: value, index }) => parsePhoneNumber(value) && !PHONE_SUFFIX.test(text.slice(index + value.length)))
    .map(([value]) => value);
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
  if (!prefix && EDIT_ADVICE.test(splitChatSentences(statement).at(-1) ?? "")) {
    return null;
  }
  const wrapper = prefix && statement.match(EDIT_WRAPPER);
  if (wrapper) {
    const wrapped = statement.slice(wrapper[0].length);
    const command = wrapped.match(EDIT_START);
    if (command) return { verb: command[1].toLowerCase(), statement: wrapped.slice(command[0].length) };
  }
  return { verb: prefix?.[1].toLowerCase(), statement };
}

export function isDirectMemoryEditRequest(message: string): boolean {
  const current = message.trim();
  return canWriteFromMessage(current)
    && (getExplicitEdit(current) !== null || declaredEmailCorrection(current) !== null || declaredPhoneCorrection(current) !== null);
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
    : UNNAMED_MEMORY.test(target) && hasEmailTopic(reference) ? reference : null;
  if (!subject) return null;
  if (!/^(?:(?:this|that|the)\s+(?:new\s+)?(?:one|e-?mail(?:\s+(?:address|id))?|address)|the\s+(?:one|e-?mail(?:\s+(?:address|id))?|address)\s+i\s+(?:just\s+)?(?:gave|sent|mentioned)(?:\s+you)?)$/i
    .test(reference)) return null;
  return emailSubject(subject);
}

function literalEmail(value: string): string | undefined {
  const text = trimValue(value);
  return findEmailAddresses(text).find((address) => address === text);
}

function emailDeclaration(text: string): RegExpMatchArray | null {
  const match = text.match(EMAIL_DECLARATION);
  return match && hasEmailTopic(match[1]) ? match : null;
}

function declaredEmailCorrection(message: string): ChatMemoryIntent | null {
  if (message.endsWith("?")) return null;
  const current = message.replace(CHAT_PREAMBLE, "");
  const change = current.match(EMAIL_CHANGE_DECLARATION);
  const field = change?.[1] ?? change?.[2];
  if (change && field && hasEmailTopic(field)) {
    const subject = emailSubject(field);
    const tail = change[3].trim();
    if (tail && !/^(?:[,;:.—–-]|(?:from|to|now|and|so)\b)/i.test(tail)) return null;
    const transition = tail.match(/^from\s+(.+?)\s+to\s+(.+)$/i);
    if (transition) {
      const previousValue = literalEmail(transition[1]);
      const value = literalEmail(transition[2]);
      return previousValue && value
        ? { kind: "update", subject, value, previousValue }
        : CLARIFY_EMAIL_REPLACEMENT;
    }

    const to = tail.match(/^to\s+(.+)$/i);
    const rest = tail.replace(/^[,;:.—–-]\s*/, "").replace(/^(?:(?:and|so)\s+)?(?:now\s+)?/i, "");
    const declaration = emailDeclaration(rest);
    const mentionedSubject = declaration && /^my\s+/i.test(declaration[1]) ? emailSubject(declaration[1]) : null;
    if (mentionedSubject && subject !== "Email address"
      && mentionedSubject !== "Email address" && subject !== mentionedSubject) return CLARIFY_EMAIL_REPLACEMENT;

    const replacement = to?.[1] ?? (mentionedSubject ? declaration?.[2] : undefined)
      ?? rest.match(/^it(?:['’]s|\s+is)\s+(.+)$/i)?.[1];
    const value = replacement && literalEmail(replacement.replace(/^now\s+/i, ""));
    return value
      ? { kind: "update", subject: subject === "Email address" ? mentionedSubject ?? subject : subject, value }
      : CLARIFY_EMAIL_REPLACEMENT;
  }

  const declaration = emailDeclaration(current);
  if (!declaration || !/^my\s+/i.test(declaration[1])
    || (!/^my\s+(?:new|updated|correct(?:ed)?)\s+/i.test(declaration[1])
      && !/^now\s+/i.test(declaration[2]))) return null;
  const value = literalEmail(declaration[2].replace(/^now\s+/i, ""));
  return value
    ? { kind: "update", subject: emailSubject(declaration[1]), value }
    : CLARIFY_EMAIL_REPLACEMENT;
}

function compatiblePhoneSubject(subject: string, mentioned: string | undefined): string | undefined {
  if (!mentioned || mentioned === "Phone number") return subject;
  return subject === "Phone number" || subject === mentioned ? mentioned : undefined;
}

function phoneUpdate(subject: string | undefined, replacement: string, previous?: string): ChatMemoryIntent {
  const value = parsePhoneNumber(replacement);
  const previousValue = previous === undefined ? undefined : parsePhoneNumber(previous);
  if (!subject || !value || (previous !== undefined && !previousValue)) return CLARIFY_PHONE_REPLACEMENT;
  return { kind: "update", subject, value, ...(previousValue ? { previousValue } : {}) };
}

function declaredPhoneCorrection(message: string): ChatMemoryIntent | null {
  if (message.endsWith("?")) return null;
  const current = message.replace(CHAT_PREAMBLE, "");
  const change = current.match(PHONE_CHANGE_DECLARATION);
  const field = change?.[1] ?? change?.[2];
  if (change && field) {
    const subject = phoneSubject(field);
    const tail = change[3].trim();
    const transition = tail.match(/^from\s+(.+?)\s+to\s+(.+)$/i);
    if (transition) return phoneUpdate(subject, transition[2], transition[1]);

    const rest = tail.replace(/^[,;:.—–-]\s*/, "").replace(/^(?:(?:and|so)\s+)?(?:now\s+)?/i, "");
    const direct = rest.match(/^(?:to\s+|it(?:['’]s|\s+is)\s+)(.+)$/i);
    if (direct) return phoneUpdate(subject, direct[1]);
    const declaration = rest.match(PHONE_DECLARATION);
    if (declaration && /^my\s+/i.test(declaration[1])) {
      return phoneUpdate(compatiblePhoneSubject(subject, phoneSubject(declaration[1])), declaration[2]);
    }
    return tail && !/^[.!]+$/.test(tail) ? null : CLARIFY_PHONE_REPLACEMENT;
  }

  const declaration = current.match(PHONE_DECLARATION);
  if (!declaration || !/^my\s+/i.test(declaration[1])
    || (!/^my\s+(?:new|updated|correct(?:ed)?)\s+/i.test(declaration[1]) && !/^now\s+/i.test(declaration[2]))) {
    return null;
  }
  return phoneUpdate(phoneSubject(declaration[1]), declaration[2].replace(/^now\s+/i, ""));
}

function checkPhoneReplacement(
  targetText: string,
  replacement: string,
  previousQuestion: string | undefined,
): ChatMemoryIntent | null {
  const target = trimSubject(targetText);
  const prior = previousQuestion && getPhoneRecallSubject(previousQuestion);
  const from = target.match(/^(.+?)\s+from\s+(.+)$/i);
  const field = from?.[1] ?? target;
  const namedPhone = isPhoneSubject(field) ? phoneSubject(field) : undefined;
  const refersBack = UNNAMED_MEMORY.test(field) || PRONOUN_SUBJECT.test(field);
  const explicit = replacement.match(PHONE_DECLARATION);
  if (explicit && (refersBack || namedPhone)) {
    const mentioned = phoneSubject(explicit[1]);
    const subject = namedPhone ? compatiblePhoneSubject(namedPhone, mentioned)
      : mentioned === "Phone number" ? prior || mentioned : mentioned;
    return phoneUpdate(subject, explicit[2], from?.[2]);
  }

  const reference = replacement.match(NUMBER_REFERENCE);
  if (reference && (refersBack || namedPhone)) {
    const contextualSubject = namedPhone ?? prior;
    if (!contextualSubject) return CLARIFY_UPDATE;
    const value = replacement.slice(reference[0].length).trim().replace(/^(?:is\s+|[:=]\s*)/i, "");
    return phoneUpdate(compatiblePhoneSubject(contextualSubject, phoneSubject(reference[0])), value, from?.[2]);
  }

  const bareTarget = !namedPhone && targetText.trim() === target && field.match(NUMBER_REFERENCE)?.[0] === field;
  if (bareTarget) {
    return prior ? phoneUpdate(compatiblePhoneSubject(prior, phoneSubject(field)), replacement, from?.[2]) : CLARIFY_UPDATE;
  }
  if (namedPhone || (prior && refersBack)) {
    return phoneUpdate(namedPhone || prior || undefined, replacement, from?.[2]);
  }
  return null;
}

function checkDirectUpdate(edit: ReturnType<typeof getExplicitEdit>, previousQuestion: string | undefined): ChatMemoryIntent | null {
  if (!edit) return null;
  const { verb, statement } = edit;
  const declaration = !verb && emailDeclaration(statement);
  if (declaration) {
    const value = literalEmail(declaration[2]);
    return value
      ? { kind: "update", subject: emailSubject(declaration[1]), value }
      : CLARIFY_UPDATE;
  }
  const phoneDeclaration = !verb && statement.match(PHONE_DECLARATION);
  if (phoneDeclaration) return phoneUpdate(phoneSubject(phoneDeclaration[1]), phoneDeclaration[2]);
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
        if (isPhoneSubject(subject)) return phoneUpdate(phoneSubject(subject), value, previousValue);
        return { kind: "update", subject, previousValue, value };
      }
    }
  }
  const replacement = statement.match(REPLACEMENT);
  const subjectText = trimSubject(replacement?.[1] ?? "");
  const isPriorEmail = !!previousQuestion && hasEmailTopic(previousQuestion);
  const wrappedEmail = replacement && (UNNAMED_MEMORY.test(subjectText) || PRONOUN_SUBJECT.test(subjectText))
    ? emailDeclaration(replacement[2])
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
  if (replacement) {
    const phone = checkPhoneReplacement(replacement[1], replacement[2], previousQuestion);
    if (phone) return phone;
  }
  const from = subjectText.match(/^(.+?)\s+from\s+(.+)$/i);
  const previousEmail = from && isEmailSubject(from[1]) ? literalEmail(from[2]) : literalEmail(subjectText);
  const assignment = replacement ? null : statement.match(/^(.+?)(?:\s+is\s+|\s*[:=]\s*)(.+)$/i);
  if (assignment && isPhoneSubject(trimSubject(assignment[1]))) {
    return phoneUpdate(phoneSubject(assignment[1]), assignment[2]);
  }
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
  const intent = checkDirectUpdate(getExplicitEdit(current), undefined) ?? declaredEmailCorrection(current);
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
  const directUpdate = checkDirectUpdate(getExplicitEdit(current), context)
    ?? declaredEmailCorrection(current) ?? declaredPhoneCorrection(current);
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
