import type { AssistantRequest, AssistantResponse, PlannedAction } from './assistant';
import { assistantRequestSchema, assistantResponseSchema } from './assistant';
import { isRecord } from './protocol';
import { ValidationError, type Schema } from './schemas';
import { requestedNavigation, stripBuddyPrefix } from './navigation';

export interface ConversationMessage { role: 'user' | 'assistant' | 'result'; text: string }
export interface CompanionRequest extends AssistantRequest { history?: ConversationMessage[]; pageTabId?: number }
export interface EmailDraft { to: string; subject: string; body: string }
export interface CompanionResponse extends AssistantResponse { draft?: EmailDraft }
function check(value: unknown): asserts value { if (!value) throw new ValidationError('Invalid companion schema'); }
const text = (v: unknown, max: number, empty = false): v is string => typeof v === 'string' && (empty || !!v.trim()) && v.length <= max && !/[\u0000-\u0008<>]/.test(v);
export const emailDraftSchema: Schema<EmailDraft> = { parse(v) {
 check(isRecord(v) && Object.keys(v).sort().join() === 'body,subject,to');
 check(text(v.to, 254, true) && (!v.to || /^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)+$/i.test(v.to)));
 check(text(v.subject, 160) && !/[\r\n]/.test(v.subject) && text(v.body, 4000)); return v as unknown as EmailDraft;
} };
export const conversationalRequestSchema: Schema<CompanionRequest> = { parse(v) {
 check(isRecord(v)); const { history, pageTabId, ...base } = v; const r = assistantRequestSchema.parse(base);
 check(r.instruction === stripBuddyPrefix(r.instruction));
 if (history !== undefined) { check(Array.isArray(history) && history.length <= 6); for (const m of history) check(isRecord(m) && Object.keys(m).sort().join() === 'role,text' && ['user','assistant','result'].includes(m.role as string) && text(m.text, 1200)); }
 if (pageTabId !== undefined) check(Number.isInteger(pageTabId) && r.tabs.some(t => t.tabId === pageTabId && !!t.text));
 check(r.tabs.every(t => !t.text || t.tabId === pageTabId));
 return v as unknown as CompanionRequest;
} };
export const companionResponseSchema: Schema<CompanionResponse> = { parse(v) {
 check(isRecord(v)); const { draft, ...base } = v; assistantResponseSchema.parse(base);
 if (draft !== undefined) { emailDraftSchema.parse(draft); check((base.plan as AssistantResponse['plan']).actions.length === 0); }
 return v as unknown as CompanionResponse;
} };
export function isSummaryRequest(instruction: string) { return /\b(?:summari[sz]e|summary)\b/i.test(instruction); }
export function isEmailRequest(instruction: string) { return /\b(?:draft|write|compose)\b.*\b(?:email|e-mail)\b/i.test(instruction); }
export function requestedRecipient(instruction: string) {
 const matches = instruction.match(/[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)+/gi) ?? [];
 return matches.length === 1 ? matches[0]! : '';
}
/** History is evidence, never a permission. Only confirmed user turns can resolve a site/query. */
export function companionDestination(input: CompanionRequest): string | null {
 const s = input.instruction.trim(); const direct = requestedNavigation(s); if (direct) return direct;
 let query = /^(?:please\s+)?(?:search(?:\s+for)?|find|play)\s+(.+?)(?:\s+on\s+youtube)[.!]?$/i.exec(s)?.[1];
 if (!query && /^(?:please\s+)?(?:find|play)\s+/i.test(s)) query = s.replace(/^(?:please\s+)?(?:find|play)\s+/i, '');
 if (!query && /^(?:please\s+)?search(?:\s+for)?\s+/i.test(s)) {
  const previous = [...(input.history ?? [])].reverse().find(m => m.role === 'user' && (/\b(?:open|visit|go to|search|find|play)\b/i.test(m.text)));
  if (previous && /youtube|^(?:find|play)\s/i.test(previous.text)) query = s.replace(/^(?:please\s+)?search(?:\s+for)?\s+/i, '');
 }
 if (/^(?:open|play)\s+(?:that|the)\s+song[.!]?$/i.test(s)) {
  const previous = [...(input.history ?? [])].reverse().find(m => m.role === 'user' && /^(?:find|play)\s/i.test(m.text) && !/that song/i.test(m.text));
  query = previous?.text.replace(/^(?:find|play)\s+/i, '').replace(/\s+on\s+youtube[.!]?$/i, '');
 }
 if (!query || /^(?:that|this|the)\s+(?:song|video|one)[.!]?$/i.test(query)) return null;
 query = query.trim(); if (!query || query.length > 200 || /[\r\n<>]/.test(query)) return null;
 return 'https://www.youtube.com/results?search_query=' + encodeURIComponent(query);
}
export function explicitTabAction(input: CompanionRequest): PlannedAction | null {
 const match = /^(switch(?:\s+to)?|close)\s+(?:my\s+)?(?:tab\s*#?\s*)?(.+?)[.!]?$/i.exec(input.instruction.trim());
 if (!match) return null; const needle = match[2]!.trim().toLowerCase().replace(/\s+tab$/, '');
 const matches = input.tabs.filter(t => /^\d+$/.test(needle) ? t.tabId === Number(needle) : needle.length >= 3 && t.title.toLowerCase().includes(needle));
 return matches.length === 1 ? {type: match[1]!.toLowerCase() === 'close' ? 'close_tab' : 'switch_tab', tabId: matches[0]!.tabId} : null;
}
export function gmailComposeUrl(value: EmailDraft): string {
 const draft = emailDraftSchema.parse(value); if (!draft.to) throw new ValidationError('Enter a recipient email address before opening Gmail.');
 const u = new URL('https://mail.google.com/mail/'); u.searchParams.set('view','cm'); u.searchParams.set('fs','1'); u.searchParams.set('to',draft.to); u.searchParams.set('su',draft.subject); u.searchParams.set('body',draft.body); return u.href;
}
