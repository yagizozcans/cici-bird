import { SITE } from '@/lib/site'

/**
 * Privacy policy body.
 *
 * website.md §6 names six things this document MUST specifically cover, and
 * each has its own numbered section below so a reviewer can check them off:
 *   microphone use (§3) · location capture at recording time (§4) ·
 *   retention of audio submitted for identification (§5) ·
 *   whether recordings are used for model training (§6) ·
 *   third-party processors (§8) · KVKK and GDPR rights (§9)
 *
 * Every retention period and processor below is a PLACEHOLDER marked as such.
 * Publishing a specific number we have not committed to operationally is how a
 * privacy policy becomes a liability rather than a disclosure.
 */
export const PRIVACY_LAST_UPDATED = '2026-09-07'

export function PrivacyBody() {
  return (
    <>
      <p>
        This policy explains what {SITE.name} collects, why, how long it is
        kept, and what you can require us to do about it. It covers the{' '}
        {SITE.name} mobile application and {SITE.domain}.
      </p>
      <p>
        <strong>Controller.</strong> CICI (
        <span className="font-mono text-[13px]">TODO: registered legal entity name, address and registration number</span>
        ) is the data controller for the purposes of the Turkish Personal Data
        Protection Law (KVKK, Law No. 6698) and the EU/UK General Data
        Protection Regulation (GDPR).
      </p>

      <h2>1. What this product does, in data terms</h2>
      <p>
        {SITE.name} does two separate things, and they collect different data:
      </p>
      <ul>
        <li>
          <strong>Messaging.</strong> You speak; the app transcribes your speech
          to text, encodes that text into birdsong audio, and delivers both to
          the person you sent it to.
        </li>
        <li>
          <strong>Identification.</strong> You record a bird you hear outdoors;
          the app identifies the species and, if verification succeeds, unlocks
          that voice for you.
        </li>
      </ul>
      <p>
        These are deliberately separate systems. They share only the list of
        species you have unlocked. Identification never reads your messages, and
        messaging never reads your recordings or your location.
      </p>

      <h2>2. Categories of data we process</h2>
      <ul>
        <li>
          <strong>Account data</strong> — an account identifier and the sign-in
          method you chose. Legal basis: performance of a contract.
        </li>
        <li>
          <strong>Message data</strong> — the generated birdsong audio, the
          transcribed text sent alongside it, sender and recipient account
          identifiers, and delivery and read state. Legal basis: performance of
          a contract.
        </li>
        <li>
          <strong>Identification recordings</strong> — the ambient audio you
          record when you use Identify. Legal basis: performance of a contract
          for the identification itself; consent for any further use (see §6).
        </li>
        <li>
          <strong>Location snapshots</strong> — see §4. Legal basis: legitimate
          interest in preventing fraudulent unlocks, and your consent to the
          device permission.
        </li>
        <li>
          <strong>Entitlements</strong> — which species you own and how each was
          unlocked. Legal basis: performance of a contract.
        </li>
        <li>
          <strong>Diagnostics and aggregate measurement</strong> — see §7.
        </li>
      </ul>

      <h2>3. Microphone</h2>
      <p>
        The microphone is used in exactly two situations, and both begin with
        you: holding the record button to speak a message, and tapping Identify
        to record a bird. There is no background listening, no always-on
        wake-word, and no recording when the app is not in the foreground.
      </p>
      <p>
        We ask for microphone permission the first time you record or identify —
        not during onboarding — and explain why immediately before the system
        dialog appears. If you refuse, both features stop working and the rest
        of the app continues to.
      </p>
      <p>
        Your spoken message audio is transcribed and then discarded. What is
        delivered to the recipient is the synthesized birdsong and the
        transcribed text. Your actual voice recording is not sent, not stored on
        our servers, and not retained after the message is generated.
      </p>

      <h2>4. Location</h2>
      <p>
        Location is used for one purpose: checking whether the species you just
        recorded is plausible where and when you recorded it. That check is what
        stops someone unlocking a nightingale by playing a recording indoors in
        another hemisphere.
      </p>
      <ul>
        <li>
          <strong>Foreground only.</strong> We request &ldquo;When In Use&rdquo;
          on iOS and foreground location on Android. We never request background
          location.
        </li>
        <li>
          <strong>A single snapshot.</strong> Location is read once, at the
          moment you make an identification recording. It is not a track, a
          history, or a continuous feed. Between recordings we do not read your
          location at all.
        </li>
        <li>
          <strong>Asked late.</strong> We request it at your first identification
          attempt, not at signup, with an explanation shown first.
        </li>
        <li>
          <strong>Refusable without penalty to the core feature.</strong> If you
          decline, identification still runs and still tells you what bird it
          heard. Only the free or discounted unlock is unavailable, and the app
          says so plainly.
        </li>
      </ul>
      <p>
        <strong>Retention of location.</strong> A location snapshot is attached
        to the discovery record it verified.{' '}
        <span className="font-mono text-[13px]">
          TODO: confirm the retention period for discovery records containing
          location, and whether coarse rounding is applied at rest.
        </span>{' '}
        If we later build a discovery history or map feature, retained location
        becomes personal data with a longer life than a single verification, and
        we will seek separate consent and publish the retention period before
        shipping it.
      </p>

      <h2>5. Retention of audio submitted for identification</h2>
      <p>
        An identification recording is processed to produce a species result and
        a verification score. After that it serves two residual purposes:
        resolving a disputed or queued verification, and detecting the same
        recording being submitted from multiple accounts.
      </p>
      <p>
        <span className="font-mono text-[13px]">
          TODO: set and state the retention period for identification audio
          (proposed: 90 days for the recording itself, with the derived
          fingerprint retained longer for deduplication). Confirm before launch.
        </span>
      </p>
      <p>
        The audio fingerprint we derive for deduplication is a one-way summary.
        It cannot be turned back into audio and cannot be listened to.
      </p>

      <h2>6. Model training</h2>
      <p>
        Identification recordings are <strong>not</strong> used to train or
        improve our models by default.
      </p>
      <p>
        If we want to use your recordings for model improvement, we will ask for
        separate, explicit, opt-in consent for that specific purpose. It will not
        be bundled into these terms, it will not be a pre-ticked box, and
        declining it will not reduce what the app does for you. You will be able
        to withdraw that consent later, and withdrawal will apply to future use.
      </p>

      <h2>7. Analytics and the website</h2>
      <p>
        Measurement is limited to aggregate, non-identifying counts: how many
        people played a demo, followed a shared link, or opened a species page.
        We do not build advertising profiles, we do not sell data, and we do not
        share it with advertising networks.
      </p>
      <p>
        On {SITE.domain}, nothing is stored on your device and no measurement
        event is recorded until you accept in the consent banner. Declining is a
        single click and leaves the site fully functional.
      </p>
      <p>
        Shared message links (<span className="font-mono text-[13px]">/m/…</span>
        ) are excluded from search indexing. The recipient of a message is never
        named on a public page.
      </p>

      <h2>8. Third-party processors</h2>
      <p>
        <span className="font-mono text-[13px]">
          TODO: list every processor before launch with its role, the data it
          receives, and its processing location. This list must be complete and
          must be kept current — an out-of-date processor list is a compliance
          finding.
        </span>
      </p>
      <p>Expected categories, to be filled in with named vendors:</p>
      <ul>
        <li>Cloud hosting and storage for messages, entitlements and assets</li>
        <li>Speech-to-text, where on-device transcription is unavailable</li>
        <li>Server-side species classification for the extended catalog</li>
        <li>Crash and performance diagnostics</li>
        <li>Aggregate product analytics</li>
        <li>Transactional email for data requests and support</li>
      </ul>
      <p>
        Where a processor is outside Türkiye or the EEA, the transfer mechanism
        (adequacy decision, standard contractual clauses, or an explicit KVKK
        undertaking) will be named alongside it.
      </p>
      <p>
        Purchases are processed by Apple and Google under their own privacy
        policies. We receive a validated receipt and the resulting entitlement.
        We never receive your card details.
      </p>

      <h2>9. Your rights</h2>
      <p>
        Under KVKK Article 11 and GDPR Articles 15–22 you may ask us to:
      </p>
      <ul>
        <li>confirm whether we hold data about you, and get a copy of it</li>
        <li>correct data that is wrong or incomplete</li>
        <li>delete your data, including your account</li>
        <li>restrict or object to certain processing</li>
        <li>receive your data in a portable, machine-readable format</li>
        <li>withdraw a consent you previously gave, at any time</li>
        <li>
          object to a decision made solely by automated means, and ask for it to
          be reviewed by a person
        </li>
      </ul>
      <p>
        That last one is not theoretical here. A rejected field discovery is an
        automated decision about you, so a rejection can be reviewed by a person
        on request. It is also why verification produces graded outcomes rather
        than a silent pass or fail.
      </p>
      <p>
        Make a request at{' '}
        <a href="/data-request">{SITE.domain}/data-request</a> or by writing to{' '}
        <a href={`mailto:${SITE.contact.privacy}`}>{SITE.contact.privacy}</a>. We
        respond within 30 days, and within the shorter period KVKK requires where
        it applies.
      </p>
      <p>
        If you are not satisfied, you may complain to the Turkish Personal Data
        Protection Authority (KVKK Kurumu) or to your local EU/UK supervisory
        authority.
      </p>

      <h2>10. Children</h2>
      <p>
        <span className="font-mono text-[13px]">
          TODO: set the minimum age and confirm it against the app store age
          rating and the KVKK/GDPR position on children&rsquo;s consent in each
          launch market.
        </span>
      </p>

      <h2>11. Changes</h2>
      <p>
        We will post changes here and update the date at the top. Where a change
        materially affects how we use your data, we will tell you in the app
        before it takes effect, and where the law requires it we will ask for
        your consent again rather than assume it.
      </p>
    </>
  )
}
