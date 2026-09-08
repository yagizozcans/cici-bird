import { DataRequestForm } from '@/components/DataRequestForm'
import { SITE } from '@/lib/site'

export const DATA_REQUEST_LAST_UPDATED = '2026-09-07'

/**
 * Data access and deletion (website.md §6).
 *
 * The spec's warning is the design brief: if discovery history with location
 * is retained, this page is "a real operational obligation, not a form that
 * goes nowhere". So the page states the obligation in operational terms — what
 * happens, who does it, how long it takes, what survives deletion and why —
 * rather than presenting a submit button and an implied promise.
 */
export function DataRequestBody() {
  return (
    <>
      <p>
        Under the Turkish Personal Data Protection Law (KVKK) and the GDPR you
        can ask us what we hold about you, ask us to correct it, and ask us to
        delete it. This page is how you do that, and the request reaches a person
        with a deadline attached.
      </p>

      <h2>Make a request</h2>
      <DataRequestForm />

      <h2>What happens next</h2>
      <ol>
        <li>
          <strong>We acknowledge it</strong>, normally within two working days.
        </li>
        <li>
          <strong>We verify it is you.</strong> We will ask you to confirm from
          the email address on the account, or to complete a check inside the
          app. This step is not bureaucracy — acting on an unverified deletion
          request would let anyone delete your account.
        </li>
        <li>
          <strong>We complete it within 30 days</strong> of verifying your
          identity, and sooner where KVKK requires a shorter period. If a request
          is genuinely complex we will tell you before the deadline, explain why,
          and give a new date.
        </li>
        <li>
          <strong>We confirm what we did</strong>, in writing, including anything
          we could not delete and the legal reason.
        </li>
      </ol>

      <h2>What an access request returns</h2>
      <p>Machine-readable, and covering:</p>
      <ul>
        <li>your account record and sign-in method</li>
        <li>
          your messages — the transmitted text, the species used, and timestamps
        </li>
        <li>
          your entitlements: which species you own and how each was unlocked
        </li>
        <li>
          your discovery records, including the verification outcome and{' '}
          <strong>any location snapshot attached to each one</strong>
        </li>
        <li>
          which consents you have given or withdrawn, and when
        </li>
      </ul>
      <p>
        The location snapshots are called out because they are the part people do
        not expect to still exist. If we hold one, an access request returns it.
      </p>

      <h2>What deletion actually deletes</h2>
      <p>Deleting your account removes:</p>
      <ul>
        <li>your account record and profile</li>
        <li>your messages and their audio</li>
        <li>your discovery records, including every location snapshot</li>
        <li>any identification recordings still within their retention window</li>
      </ul>

      <h3>What survives, and why</h3>
      <ul>
        <li>
          <strong>Messages you sent to other people.</strong> A conversation
          belongs to both participants. Deleting your account does not reach into
          someone else&rsquo;s inbox and remove what they received, any more than
          closing an email account unsends your old email. The copy in their
          conversation loses its link to your identity.
        </li>
        <li>
          <strong>Purchase records required for tax and accounting.</strong> We
          are legally obliged to keep transaction records for a statutory period.
          These are financial records, not behavioural ones.
        </li>
        <li>
          <strong>Anonymous audio fingerprints.</strong> These cannot be turned
          back into audio and are not linked to you after deletion. They exist so
          the same recording cannot be reused across accounts.
        </li>
        <li>
          <strong>Aggregate counts</strong> that were never identifying and
          cannot be traced back to an individual.
        </li>
      </ul>
      <p>
        <span className="font-mono text-[13px]">
          TODO: confirm the statutory retention period for transaction records in
          each launch market, and state it here as a number.
        </span>
      </p>

      <h2>Deletion is not reversible</h2>
      <p>
        Once your account is deleted, your unlocked species go with it — including
        ones you paid for and ones you spent a season finding. We cannot restore
        them, and a later purchase does not bring back your discovery history.
        This is worth a moment&rsquo;s thought before you ask.
      </p>
      <p>
        If what you actually want is to stop using the app rather than erase it,
        signing out achieves that and is reversible.
      </p>

      <h2>If you are not satisfied</h2>
      <p>
        Tell us first — most problems are a misunderstanding about what we hold.
        If that does not resolve it, you can complain to the Turkish Personal
        Data Protection Authority (KVKK Kurumu) or to your local EU/UK
        supervisory authority. You do not need our permission to do so.
      </p>
      <p>
        Direct contact for anything on this page:{' '}
        <a href={`mailto:${SITE.contact.privacy}`}>{SITE.contact.privacy}</a>.
      </p>
    </>
  )
}
