import { SITE } from '@/lib/site'

/**
 * Support / FAQ body.
 *
 * website.md §6: this "should address the questions the app itself will
 * generate" and names four — why a discovery was rejected, why location is
 * requested, what happens if permission is denied, and how to restore
 * purchases. All four are answered below, first, before anything general.
 *
 * §9 counts support deflection as a success metric, which only works if the
 * answers are specific enough to actually resolve the question. Hence the
 * detail on rejection causes rather than "try again in better conditions".
 */
export const SUPPORT_LAST_UPDATED = '2026-09-07'

export function SupportBody() {
  return (
    <>
      <h2>Field discovery</h2>

      <h3>Why was my discovery rejected?</h3>
      <p>
        Verification scores a recording across several independent signals and
        bands the result. A rejection means the combined score was low — it does
        not mean we think you cheated. The usual causes, roughly in order of how
        often they occur:
      </p>
      <ul>
        <li>
          <strong>The bird was too far away or too quiet</strong> relative to
          wind, traffic or conversation. The classifier needs a reasonably clean
          few seconds of the call itself.
        </li>
        <li>
          <strong>Several birds were singing at once.</strong> A dawn chorus is
          wonderful and hard to score, because no single species dominates.
        </li>
        <li>
          <strong>The species is implausible where or when you recorded.</strong>{' '}
          A swallow in Türkiye in January, or a species outside its range, scores
          low on the contextual check even when the audio is clear.
        </li>
        <li>
          <strong>It sounded like playback rather than a live bird.</strong>{' '}
          Audio from a speaker carries characteristic artefacts. A genuine
          recording made next to a loud speaker playing something else can
          occasionally trip this.
        </li>
        <li>
          <strong>The recording was too short.</strong> Give it a few seconds of
          actual song.
        </li>
      </ul>
      <p>
        What to do: record again, closer and with less background noise, and try
        for a longer stretch of song. If you believe the rejection was wrong, ask
        for a human review at{' '}
        <a href={`mailto:${SITE.contact.support}`}>{SITE.contact.support}</a> —
        include the approximate time and place. You have a right to that review;
        it is not a favour.
      </p>

      <h3>I got a partial unlock instead of a full one</h3>
      <p>
        That is the middle band, and it is deliberate. A recording that is
        probably genuine but not clearly so gets you a reduced discount or a
        queued review rather than a rejection. A borderline recording should not
        be treated the same as a fake one.
      </p>

      <h3>Can I unlock a species from a recording someone sent me?</h3>
      <p>
        No. We fingerprint identification audio, so the same recording submitted
        from more than one account is detected. Unlocks come from a recording you
        made, where you were.
      </p>

      <h3>What about birds in a zoo or aviary?</h3>
      <p>
        They count. If your recording location falls inside a known zoo, aviary
        or bird park, the &ldquo;is this species plausible here?&rdquo; check is
        bypassed — finding an exotic species there is expected, not suspicious.
        All the other checks still apply.
      </p>

      <h2>Permissions</h2>

      <h3>Why do you want my location?</h3>
      <p>
        To check that the species you just recorded is plausible where and when
        you recorded it. That single check is most of what stops someone
        unlocking a rare bird by playing a recording indoors.
      </p>
      <p>
        It is read <strong>once, at the moment you record</strong>. It is not
        tracking. We ask for foreground permission only and never request
        background location. Between recordings the app does not read your
        location at all.
      </p>

      <h3>What happens if I deny location?</h3>
      <p>
        Identification still works. You record, and the app tells you what bird
        it heard. What you cannot get without location is the free or discounted
        unlock, because we cannot run the plausibility check that unlock depends
        on. The purchase route stays open, and the app tells you this at the
        moment it matters rather than failing silently.
      </p>

      <h3>What happens if I deny the microphone?</h3>
      <p>
        Recording and identifying both stop working — there is no way around
        that one. Everything else, including reading messages you have been sent,
        continues to work. You can grant it later in your device settings.
      </p>

      <h2>Purchases</h2>

      <h3>How do I restore my purchases?</h3>
      <p>
        Sign in with the same account you used originally, then open{' '}
        <strong>Settings → Restore purchases</strong>. Entitlements are bound to
        your {SITE.name} account, not to a device, so a reinstall or a new phone
        does not lose them.
      </p>
      <p>If a species is still missing after restoring:</p>
      <ul>
        <li>
          Check you are signed into the same {SITE.name} account, and the same
          App Store or Google Play account, as at the time of purchase.
        </li>
        <li>
          Confirm the purchase completed — look for the receipt email from Apple
          or Google.
        </li>
        <li>
          Write to{' '}
          <a href={`mailto:${SITE.contact.support}`}>{SITE.contact.support}</a>{' '}
          with the receipt and we will sort it out.
        </li>
      </ul>

      <h3>Do I lose a species if I stop paying?</h3>
      <p>
        There is nothing to stop paying. Species are one-off unlocks, not a
        subscription, and they are permanent. See{' '}
        <a href="/terms">the terms</a>, section 5.
      </p>

      <h3>Can I get a refund?</h3>
      <p>
        Refunds are handled by Apple and Google under their own policies, because
        that is where the purchase happened. We cannot issue one directly, but we
        can help you make the claim.
      </p>

      <h2>Messages</h2>

      <h3>The decoded text is wrong</h3>
      <p>
        The text shown to your recipient is what the app transcribed from your
        speech, and you see it on the preview screen before sending. If it was
        wrong there, edit it or re-record — that screen exists precisely so a
        transcription slip does not become a wrong message.
      </p>

      <h3>Can I read a message without playing the sound?</h3>
      <p>
        Yes. Every message carries its text, and there is a text-only toggle.
        Meetings, libraries and buses are exactly why.
      </p>

      <h3>I shared a message link and want it back</h3>
      <p>
        Open the message and revoke the link. It stops working immediately.
        Links also expire on their own after 30 days. Revoking prevents future
        access — it cannot recall what someone has already heard.
      </p>

      <h3>Someone sent me a link and it says expired</h3>
      <p>
        Shared links last 30 days by default. The message itself still exists in
        the sender&rsquo;s conversation, so ask them to share it again.
      </p>

      <h2>Data and privacy</h2>

      <h3>What happens to my voice recording?</h3>
      <p>
        It is transcribed, encoded into birdsong, and then discarded. Your actual
        voice is not sent to the recipient and not stored on our servers. What
        travels is the synthesized birdsong and the text.
      </p>

      <h3>Do you use my recordings to train your models?</h3>
      <p>
        Not unless you explicitly opt in to that, separately. It is not bundled
        into the terms and declining does not reduce what the app does.
      </p>

      <h3>How do I get a copy of my data, or delete it?</h3>
      <p>
        Use <a href="/data-request">{SITE.domain}/data-request</a>. It is a real
        route with a real response, not a form that goes nowhere.
      </p>

      <h2>Still stuck</h2>
      <p>
        Write to{' '}
        <a href={`mailto:${SITE.contact.support}`}>{SITE.contact.support}</a>.
        Tell us what you did, what happened, your device and OS version, and
        roughly when. That last detail is what lets us find the request in the
        logs, and it is usually the difference between a same-day answer and a
        week of back-and-forth.
      </p>
    </>
  )
}
