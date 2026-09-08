'use client'

import { useState } from 'react'
import { SITE } from '@/lib/site'

/**
 * The data access / deletion request route (website.md §6).
 *
 * The spec is unusually pointed here: this "must provide a working route to
 * access and deletion… not a form that goes nowhere." So this form does not
 * post anywhere. It composes a structured email in the visitor's own mail
 * client, addressed to the privacy inbox.
 *
 * That is a deliberate choice, not a shortcut around building an endpoint:
 *
 *  - It genuinely works on day one. A POST to an endpoint nobody monitors is
 *    exactly the form-that-goes-nowhere the spec forbids, and it looks more
 *    finished while being less functional.
 *  - The request lands in a mailbox with an owner and a 30-day clock, which is
 *    what KVKK and GDPR actually require — a route to a person, not a UI.
 *  - It collects nothing on our servers. Asking someone to type their email
 *    and account id into a web form, in order to exercise a privacy right, in
 *    order for us to store it, is a poor trade. Here the identifying details
 *    never leave their device except as an email they can read first.
 *  - The visitor keeps a copy in their sent folder, which is their evidence of
 *    when they asked.
 *
 * When a request-handling backend exists, this component swaps its submit
 * target and the surrounding copy stays true.
 */

type RequestKind = 'access' | 'deletion' | 'correction' | 'portability' | 'consent'

const KINDS: { value: RequestKind; label: string; detail: string }[] = [
  {
    value: 'access',
    label: 'Access a copy of my data',
    detail: 'What you hold about me, and where it came from.',
  },
  {
    value: 'deletion',
    label: 'Delete my data and my account',
    detail: 'Including discovery records and any retained recordings.',
  },
  {
    value: 'correction',
    label: 'Correct something that is wrong',
    detail: 'Inaccurate or incomplete data held about me.',
  },
  {
    value: 'portability',
    label: 'Export my data',
    detail: 'In a portable, machine-readable format.',
  },
  {
    value: 'consent',
    label: 'Withdraw a consent',
    detail: 'For example, consent to use my recordings for model training.',
  },
]

export function DataRequestForm() {
  const [kind, setKind] = useState<RequestKind>('access')
  const [accountEmail, setAccountEmail] = useState('')
  const [notes, setNotes] = useState('')

  const selected = KINDS.find((k) => k.value === kind)!

  const subject = `Data request — ${selected.label}`
  const body = [
    `Request type: ${selected.label}`,
    '',
    `Account email or identifier: ${accountEmail || '[please fill in]'}`,
    '',
    'Additional detail:',
    notes || '[optional]',
    '',
    '---',
    'Sent from cicibird.com/data-request',
    'I am making this request under KVKK Article 11 and/or GDPR Articles 15-22.',
    'I understand you will need to verify my identity before acting on it.',
  ].join('\n')

  const mailto = `mailto:${SITE.contact.privacy}?subject=${encodeURIComponent(
    subject,
  )}&body=${encodeURIComponent(body)}`

  return (
    <div className="not-prose rounded-xl2 border border-line bg-white/60 p-5 sm:p-6">
      <fieldset>
        <legend className="text-[13px] font-semibold text-ink">
          What would you like us to do?
        </legend>
        <div className="mt-3 space-y-2">
          {KINDS.map((option) => (
            <label
              key={option.value}
              className={`flex cursor-pointer gap-3 rounded-lg border p-3 transition ${
                kind === option.value
                  ? 'border-ink bg-paper'
                  : 'border-line hover:border-ink/30'
              }`}
            >
              <input
                type="radio"
                name="request-kind"
                value={option.value}
                checked={kind === option.value}
                onChange={() => setKind(option.value)}
                className="mt-1 h-4 w-4 shrink-0 accent-ochre"
              />
              <span>
                <span className="block text-[13.5px] font-medium text-ink">
                  {option.label}
                </span>
                <span className="mt-0.5 block text-[12.5px] text-muted">
                  {option.detail}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-5">
        <label
          htmlFor="account-email"
          className="block text-[13px] font-semibold text-ink"
        >
          Your account email or identifier
        </label>
        <input
          id="account-email"
          type="text"
          inputMode="email"
          autoComplete="email"
          value={accountEmail}
          onChange={(e) => setAccountEmail(e.target.value)}
          placeholder="you@example.com"
          className="mt-2 w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-[14px] text-ink placeholder:text-muted/60"
        />
        <p className="mt-1.5 text-[12px] text-muted">
          Stays on your device — it goes into the email you send, not to us
          before then.
        </p>
      </div>

      <div className="mt-4">
        <label htmlFor="notes" className="block text-[13px] font-semibold text-ink">
          Anything else we should know
        </label>
        <textarea
          id="notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="mt-2 w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-[14px] text-ink"
        />
      </div>

      <a
        href={mailto}
        className="mt-5 inline-flex items-center justify-center rounded-full bg-ink px-6 py-3 text-[14px] font-medium text-paper transition hover:bg-ink/85"
      >
        Open this request in your email app
      </a>

      <p className="mt-3 text-[12px] leading-relaxed text-muted">
        This opens a pre-filled email to{' '}
        <a
          href={`mailto:${SITE.contact.privacy}`}
          className="underline underline-offset-2 hover:text-ink"
        >
          {SITE.contact.privacy}
        </a>
        . Read it before sending — and keep the copy in your sent folder, since
        it is your record of the date you asked. If you would rather not use a
        mail app, write to that address directly with the same details.
      </p>
    </div>
  )
}
