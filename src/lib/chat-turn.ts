import "server-only";

import { planChatMessage } from "@/lib/chat-intent-router";
import { handleChatMemory, lookupSavedEmail, lookupSavedPhone, type ChatMemoryOutcome } from "@/lib/chat-memory";
import {
  getDirectChatMemoryIntent,
  getEmailRecallSubject,
  getPhoneRecallSubject,
  getStandaloneContactIntent,
  isDirectMemoryEditRequest,
  splitChatSentences,
} from "@/lib/chat-memory-intent";
import type { MemoryClient } from "@/lib/memory-store";
import { answerFromNotebook } from "@/lib/notebook-answer";
import type { ChatMemoryMode, ChatReference, QueryResult } from "@/types";

interface ChatTurnInput {
  message: string;
  mode: ChatMemoryMode;
  reference?: ChatReference;
  strictness: number;
  maxSources: number;
  models: string[];
}

const READ_REQUEST = /^(?:(?:please|and|also|then|okay|ok)[,\s]+)*(?:what|when|where|which|why|who|how|did|does|do|could|would|will|should|can|have|has|is|are|was|were|show|tell|list|find|look up|search|recall|remind|summarize|describe)\b/i;
const WRITE_REQUEST = /^(?:(?:please|and|also|then|okay|ok)[,\s]+)*(?:(?:can|could|would|will)\s+(?:you|u)\s+(?:please\s+)?)?(?:remember|save|store|record|write down|make a note|add|update|change|replace|set|edit|correct|revise|modify|delete|remove|forget)\b/i;
const WRITE_IN_LOOKUP = /\b(?:and|then|also)\s+(?:please\s+)?(?:remember|save|store|record|write down|make a note|update|change|replace|edit|delete|remove|forget)\b/i;
const CONVERSATION_REPLIES = {
  greeting: "Hi! Ask about your notes or tell me what to remember.",
  thanks: "You’re welcome.",
  other: "I couldn’t identify a question or a notebook change. Ask about your notes or tell me what you’d like to remember.",
};

function isLookupRequest(text: string): boolean {
  return READ_REQUEST.test(text) && !WRITE_REQUEST.test(text) && !WRITE_IN_LOOKUP.test(text)
    && !isDirectMemoryEditRequest(text);
}

function splitLookup(message: string): { memoryText: string; lookup?: string } {
  const clauses = splitChatSentences(message).map((clause) => clause.trim()).filter(Boolean);
  const lookups = clauses.filter(isLookupRequest);
  if (lookups.length && lookups.length < clauses.length) {
    return { memoryText: clauses.filter((clause) => !isLookupRequest(clause)).join(" "), lookup: lookups.join(" ") };
  }
  return { memoryText: message, lookup: isLookupRequest(message) ? message : undefined };
}

export async function runChatTurn(client: MemoryClient, userId: string, input: ChatTurnInput): Promise<QueryResult> {
  const { message, mode, reference } = input;
  const { memoryText, lookup } = splitLookup(message);
  const lookupOnly = lookup === message;
  const previousQuestion = reference?.question;
  const contact = lookupOnly ? null : getStandaloneContactIntent(memoryText, previousQuestion);
  const direct = getDirectChatMemoryIntent(memoryText, previousQuestion, mode === "auto");
  const plan = lookupOnly || contact ? null : await planChatMessage(message, previousQuestion, mode, input.models[0]);
  const mayUseContact = contact && (contact.explicit || mode === "auto");
  const writeRequested = !!(mayUseContact || plan?.updateRequested || direct.kind !== "none" || WRITE_REQUEST.test(memoryText));

  // Contact values come from the user's words. A model can propose other
  // mutations, but the storage layer validates and applies all of them.
  const memory: ChatMemoryOutcome = lookupOnly ? {} : mode === "read-only" && writeRequested
    ? { reply: "This replay is read-only. Send the update from the chat composer to change your notebook." }
    : await handleChatMemory(client, userId, memoryText, mode, reference, plan, contact ?? direct);

  // Only a separate question may reach retrieval. Never ask the answer model
  // to interpret an unresolved statement or speak about a database operation.
  const plannedLookup = plan?.searchText && isLookupRequest(plan.searchText) ? plan.searchText : undefined;
  const searchText = lookup ?? plannedLookup;
  const reply = memory.reply ?? (writeRequested ? "I couldn’t apply that notebook change. Tell me what to save or replace." : undefined);
  let result: QueryResult = { answer: "", sources: [] };
  if (searchText) {
    try {
      const email = getEmailRecallSubject(searchText);
      const phone = getPhoneRecallSubject(searchText);
      const contactAnswer = email ? await lookupSavedEmail(client, userId, email)
        : phone ? await lookupSavedPhone(client, userId, phone) : null;
      result = contactAnswer ?? await answerFromNotebook(client, userId, searchText, input);
    } catch {
      console.warn("[query] notebook retrieval failed");
      result = { answer: "I couldn’t read your notebook right now. Try asking again.", sources: [] };
    }
  }

  return {
    ...result,
    answer: [reply, result.answer].filter(Boolean).join("\n\n") || CONVERSATION_REPLIES[plan?.conversation ?? "other"],
    ...(memory.changes?.length ? { meta: { ...result.meta, memoryChanges: memory.changes } } : {}),
    ...(memory.memories?.length ? { changedMemories: memory.memories } : {}),
  };
}
