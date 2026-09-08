import { SITE } from '@/lib/site'

/**
 * Terms of service body.
 *
 * website.md §6 requires this document to cover "the nature of purchased
 * species entitlements — what a user is buying, whether it is permanent, and
 * what happens if a species is removed from the catalog." That is §5 below,
 * and it is the section that most needs a lawyer's eye, because it is where a
 * collectible-goods product usually over-promises.
 */
export const TERMS_LAST_UPDATED = '2026-09-07'

export function TermsBody() {
  return (
    <>
      <p>
        These terms govern your use of the {SITE.name} app and {SITE.domain}. By
        using either, you agree to them.
      </p>
      <p>
        <span className="font-mono text-[13px]">
          TODO: confirm the contracting entity, governing law and forum. Drafted
          assuming Turkish law and Istanbul courts, with mandatory consumer
          protections in a user&rsquo;s home jurisdiction unaffected.
        </span>
      </p>

      <h2>1. The service</h2>
      <p>
        {SITE.name} encodes a spoken message into synthesized birdsong and
        delivers it, with the decoded text, to another user. It also identifies
        bird species from recordings you make, and unlocks voices when that
        identification is verified.
      </p>
      <p>
        It is a playful product, not a professional communication tool. Do not
        use it where a message failing to arrive, arriving late, or being
        mis-transcribed would cause harm.
      </p>

      <h2>2. Accounts</h2>
      <p>
        You are responsible for activity on your account. Tell us promptly if you
        believe someone else is using it. We may suspend an account that is being
        used to abuse other users or to defraud the unlock system, and where we
        do we will say why.
      </p>

      <h2>3. Your content</h2>
      <p>
        Messages you send and recordings you make remain yours. You grant us only
        the licence we need to run the service: to transcribe, encode,
        synthesize, transmit, store and display your content for the purpose of
        delivering it. That licence ends when the content is deleted.
      </p>
      <p>
        We do not use your recordings to train models unless you separately opt
        in. See the <a href="/privacy">privacy policy</a>.
      </p>

      <h2>4. Sharing outside the app</h2>
      <p>
        Messages are private by default. You may create a public link for an
        individual message; doing so is a deliberate, per-message action.
      </p>
      <ul>
        <li>A public link is long and random, and is not listed or indexed.</li>
        <li>You can revoke a link at any time, and it stops working.</li>
        <li>
          Links expire automatically after 30 days by default, whether or not you
          revoke them.
        </li>
        <li>
          Once you share a link, anyone holding it can open it while it is live.
          Revoking stops future access; it cannot recover what someone already
          heard or saved.
        </li>
      </ul>

      <h2>5. Species entitlements — what you are actually buying</h2>
      <p>
        This section matters more than its length suggests. Read it before you
        buy anything.
      </p>

      <h3>What you get</h3>
      <p>
        Buying a species grants you a <strong>personal, non-exclusive,
        non-transferable licence</strong> to use that voice inside {SITE.name}.
        You are not buying the audio files, the bird, a copy of anything, or any
        asset that exists outside the app. There is no ownership stake, no
        resale, no transfer to another person, and no trading.
      </p>

      <h3>How long it lasts</h3>
      <p>
        An entitlement is <strong>permanent and account-bound</strong>: it is
        attached to your account, not to a device, and it does not expire, lapse,
        or require a subscription to keep. Reinstall the app, change phone, or
        sign in somewhere else, and your unlocked species come with you.
      </p>
      <p>
        &ldquo;Permanent&rdquo; means for as long as {SITE.name} operates. It is
        not a promise that the service will run forever, and nobody can honestly
        make that promise. See &ldquo;If the service closes&rdquo; below.
      </p>
      <p>
        <span className="font-mono text-[13px]">
          TODO: confirm whether entitlements survive a platform switch (iOS to
          Android). Open question in app.md §11; the terms must state the answer
          before launch rather than leave it ambiguous.
        </span>
      </p>

      <h3>Species unlocked by field discovery</h3>
      <p>
        A species unlocked by a verified recording is permanent on the same
        terms as a purchased one. We will not revoke it because verification
        methods later improved, unless the unlock was obtained fraudulently.
      </p>

      <h3>If a species is removed from the catalog</h3>
      <p>
        Species can leave the catalog — a licence for the reference audio may
        end, a seasonal release may close, or taxonomy may change.
      </p>
      <ul>
        <li>
          <strong>If you already own it, you keep it.</strong> Removal stops a
          species being offered to new users. It does not take a voice out of the
          library of anyone who bought or found it, and messages already sent in
          that voice continue to play.
        </li>
        <li>
          <strong>The single exception is a legal obligation.</strong> If we lose
          the right to distribute an asset and must withdraw it, we will remove
          it, tell affected users what happened and why, and offer either a
          replacement species of the same tier or a refund of what you paid for
          it. We will not do this quietly.
        </li>
        <li>
          A limited or seasonal species that stops being <em>offered</em> at the
          end of its window has not been removed. You keep it.
        </li>
      </ul>

      <h3>Purchases and refunds</h3>
      <p>
        All purchases are made through Apple&rsquo;s App Store or Google Play and
        are governed by those platforms&rsquo; terms. Refunds are handled by them,
        under their policies. We cannot process a refund directly, but we can
        help you with a claim — write to{' '}
        <a href={`mailto:${SITE.contact.support}`}>{SITE.contact.support}</a>.
      </p>
      <p>
        We do not sell digital goods for the app through this website. Prices may
        change; a change never affects something you already own.
      </p>

      <h2>6. Field discovery and verification</h2>
      <p>
        Unlocking by discovery requires a recording you made yourself, in the
        place you were standing. Submitting a recording you did not make, playing
        audio through a speaker to fool identification, or sharing a recording
        between accounts is a breach of these terms.
      </p>
      <p>
        Verification is automated and produces a graded result. It is not perfect
        in either direction: a genuine recording can score poorly in bad
        conditions. A rejection is not an accusation, the purchase route stays
        open, and you can ask for a person to review the decision.
      </p>
      <p>
        Where we find deliberate fraud, we may reverse the unlocks obtained by it
        and, for repeated abuse, suspend the account. Legitimately purchased
        entitlements are not affected by a reversal of a fraudulent unlock.
      </p>

      <h2>7. Acceptable use</h2>
      <p>Do not use {SITE.name} to:</p>
      <ul>
        <li>harass, threaten or abuse anyone</li>
        <li>send unlawful content, or content you have no right to send</li>
        <li>impersonate another person</li>
        <li>
          interfere with the service, or attempt to extract the encoding
          alphabet, models or assets for use elsewhere
        </li>
        <li>disturb wildlife in order to obtain a recording (see §8)</li>
      </ul>

      <h2>8. Recording birds responsibly</h2>
      <p>
        The collection loop asks you to go outside and record birds. Do it
        without harming them. Do not play calls to provoke a response, approach
        nests, or enter protected areas you are not permitted to enter. Local
        wildlife law applies to you, not to us, and it takes precedence over any
        species you are trying to unlock.
      </p>

      <h2>9. Availability, and if the service closes</h2>
      <p>
        We do not guarantee uninterrupted availability. Features may change, and
        the catalog will change.
      </p>
      <p>
        If we discontinue {SITE.name}, we will give as much notice as we
        reasonably can, provide a way to export your messages, and
        <span className="font-mono text-[13px]">
          {' '}TODO: state the position on refunds for recently purchased
          entitlements in a shutdown scenario. This is a consumer-protection
          question in several launch markets and needs a real answer, not
          silence.
        </span>
      </p>

      <h2>10. Liability</h2>
      <p>
        Nothing here limits liability that cannot lawfully be limited, including
        for death or personal injury caused by negligence, for fraud, or under
        mandatory consumer protection law.
      </p>
      <p>
        <span className="font-mono text-[13px]">
          TODO: liability cap, warranty disclaimer and indemnity wording to be
          drafted by counsel for each launch market.
        </span>
      </p>

      <h2>11. Changes to these terms</h2>
      <p>
        We will post changes here and update the date. For material changes we
        will notify you in the app before they take effect. If you do not accept
        a change, you may stop using the service; entitlements you already own
        remain subject to §5.
      </p>
    </>
  )
}
