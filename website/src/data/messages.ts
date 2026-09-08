/**
 * Shared birdsong messages — the fixture store behind `/m/:id`.
 *
 * ---------------------------------------------------------------------------
 * THE PRIVACY MODEL THIS PAGE IMPLEMENTS (website.md §4)
 * ---------------------------------------------------------------------------
 * These four rules are not UI copy. They are constraints on the data that ever
 * reaches this route, and the shapes below encode them. When the real
 * messaging backend replaces this file, the contract it must satisfy is here.
 *
 * 1. SHARING IS OPT-IN, PER MESSAGE.
 *    Messages are private by default. A message becomes reachable at /m/:id
 *    only because its sender explicitly shared that one message. There is no
 *    account-wide or conversation-wide "make public" setting, so no message
 *    can become publicly readable as a side effect of another decision.
 *    Encoded here by `SharedMessage` being a distinct record that exists only
 *    once sharing happened — an unshared message has no representation at all.
 *
 * 2. LINKS ARE UNGUESSABLE.
 *    The `:id` is a high-entropy token, not a database row id and not a
 *    sequential counter. Enumerating /m/1, /m/2 must reveal nothing, so ids
 *    carry no ordering and no relationship to any other identifier. See
 *    `SHARE_TOKEN_BYTES`. The fixtures below use readable ids ONLY because
 *    they are fixtures; the note on `id` states the production requirement.
 *
 * 3. LINKS ARE REVOCABLE, AND EXPIRE BY DEFAULT AFTER 30 DAYS.
 *    `status` is authoritative and checked before any audio URL is emitted.
 *    Revocation and expiry are indistinguishable to the visitor in one
 *    important way: neither leaks the message content. They are distinguished
 *    in the copy only so the visitor knows whether to ask for a new link.
 *
 * 4. THE RECIPIENT IS NEVER EXPOSED.
 *    There is deliberately no recipient field on this type. Not "present but
 *    unrendered" — absent, so no future template change, no serialized prop
 *    and no OG tag can accidentally surface it. The sender is not exposed
 *    either; `senderLabel` is an optional self-chosen display name, and every
 *    fixture leaves it unset to show that the page reads fine without one.
 * ---------------------------------------------------------------------------
 */

/** Entropy for a production share token. 16 bytes ≈ 2^128 — not enumerable. */
export const SHARE_TOKEN_BYTES = 16

/** website.md §4: "expire after a configurable period (default 30 days)". */
export const DEFAULT_EXPIRY_DAYS = 30

export type MessageStatus = 'active' | 'expired' | 'revoked'

export interface SharedMessage {
  /**
   * Production: a URL-safe, high-entropy token (see SHARE_TOKEN_BYTES).
   * Never a row id, never sequential, never derived from sender or recipient.
   */
  id: string
  status: MessageStatus
  /** Which voice it was sent in. Links through to that species page. */
  speciesSlug: string
  /** Audio manifest id. Only ever read when `status === 'active'`. */
  audioId: string
  /** ISO date the sender shared it. */
  sharedAt: string
  /** ISO date the link stops working. */
  expiresAt: string
  /**
   * Optional sender display name, self-chosen. Absent in every fixture on
   * purpose: the page must be complete and legible without it.
   */
  senderLabel?: string
}

/**
 * Fixtures.
 *
 * There is no messaging backend behind this website yet, so these exercise
 * every state the real page will have to render — including the two failure
 * states, which are the ones that normally ship broken because nobody builds a
 * link they cannot click.
 */
const FIXTURES: SharedMessage[] = [
  {
    id: 'demo-nightingale',
    status: 'active',
    speciesSlug: 'nightingale',
    audioId: 'msg-nightingale',
    sharedAt: '2026-08-24T19:40:00.000Z',
    expiresAt: '2026-09-23T19:40:00.000Z',
  },
  {
    id: 'demo-blackbird',
    status: 'active',
    speciesSlug: 'blackbird',
    audioId: 'msg-blackbird',
    sharedAt: '2026-09-01T06:12:00.000Z',
    expiresAt: '2026-10-01T06:12:00.000Z',
  },
  {
    // The trained-model voice, on the page it matters most. A recipient
    // arriving from a shared link hears real DDSP output before they have
    // read a word about the product.
    id: 'demo-wren',
    status: 'active',
    speciesSlug: 'bewicks-wren',
    audioId: 'msg-bewicks-wren',
    sharedAt: '2026-09-04T17:05:00.000Z',
    expiresAt: '2026-10-04T17:05:00.000Z',
  },
  {
    // The newer of the two trained voices. Kept as a second active fixture so
    // the two models can be heard back to back on the surface a recipient
    // actually lands on, rather than only side by side on the landing demo.
    id: 'demo-sparrow',
    status: 'active',
    speciesSlug: 'song-sparrow',
    audioId: 'msg-song-sparrow',
    sharedAt: '2026-09-08T09:15:00.000Z',
    expiresAt: '2026-10-08T09:15:00.000Z',
  },
  {
    id: 'demo-expired',
    status: 'expired',
    speciesSlug: 'barn-swallow',
    audioId: 'sample-barn-swallow',
    sharedAt: '2026-06-02T11:00:00.000Z',
    expiresAt: '2026-07-02T11:00:00.000Z',
  },
  {
    id: 'demo-revoked',
    status: 'revoked',
    speciesSlug: 'house-sparrow',
    audioId: 'sample-house-sparrow',
    sharedAt: '2026-08-30T08:30:00.000Z',
    expiresAt: '2026-09-29T08:30:00.000Z',
  },
]

/** Ids the sitemap and prerender step may touch. /m/* is excluded from both. */
export function fixtureMessageIds(): string[] {
  return FIXTURES.map((m) => m.id)
}

export type MessageLookup =
  | { kind: 'found'; message: SharedMessage }
  | { kind: 'expired'; message: SharedMessage }
  | { kind: 'revoked'; message: SharedMessage }
  | { kind: 'missing' }

/**
 * Resolve a share token to a renderable state.
 *
 * Expiry is evaluated against the clock as well as the stored status, so a
 * link that ages past its window while the record still says "active" is still
 * refused. The status field is a cache; the date is the truth.
 */
export function lookupMessage(id: string, now: Date = new Date()): MessageLookup {
  const message = FIXTURES.find((m) => m.id === id)
  if (!message) return { kind: 'missing' }
  if (message.status === 'revoked') return { kind: 'revoked', message }
  if (message.status === 'expired' || new Date(message.expiresAt) <= now) {
    return { kind: 'expired', message }
  }
  return { kind: 'found', message }
}
