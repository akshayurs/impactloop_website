import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Echo of Light Privacy Policy',
  description:
    'How Echo of Light handles your data. The game is offline-first — your progress stays on your device unless you choose to sign in to Play Games.',
}

const EMAIL = 'impactloopapps@gmail.com'
const DEVELOPER_URL = 'https://play.google.com/store/apps/developer?id=ImpactLoop&hl=en_IN'

export default function EchoOfLightPrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <span className="kicker">Echo of Light · Legal</span>
      <h1 className="mt-4 font-display text-4xl font-bold text-fg sm:text-5xl">Echo of Light Privacy Policy</h1>
      <p className="mt-3 font-mono text-xs uppercase tracking-[0.1em] text-muted">Last updated: 12 August 2026</p>

      <p className="mt-8 text-muted">
        Echo of Light is an Android game by <strong className="text-fg">Impact Loop</strong>, an indie app studio operated
        by an individual (sole proprietor) based in India (&ldquo;Impact Loop&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;).
        You play a spirit-firefly navigating dark caverns by emitting echoes of light. The game is{' '}
        <strong className="text-fg">offline-first</strong>: it needs no account to play, we run no server of our own, and
        your progress is saved on your device.
      </p>

      <h2 className="mt-10 border-b border-line pb-2 font-display text-xl font-semibold text-fg">1. The short version</h2>
      <p className="mt-3 text-muted">
        Echo of Light collects no personal data of its own and has no backend database of players. Your progress,
        settings, and best scores live in local storage on your device. Data leaves your phone in only three cases, each
        handled by Google rather than by us: the ads shown in the free version (§4), a purchase if you remove ads (§5),
        and — <strong className="text-fg">only if you choose to sign in</strong> — Google Play Games for leaderboards,
        achievements, and cloud saves (§6).
      </p>

      <h2 className="mt-10 border-b border-line pb-2 font-display text-xl font-semibold text-fg">
        2. What Echo of Light stores on your device
      </h2>
      <ul className="mt-3 space-y-2 text-muted">
        <li className="flex items-start gap-2">
          <span aria-hidden className="mt-1 text-accent">↳</span>
          <span>
            <strong className="text-fg">Your progress.</strong> Which depths you have cleared, your stars and scores,
            your best endless climb, your daily-challenge streak, and which world elements you have encountered. Stored
            in the app&rsquo;s own local preferences.
          </span>
        </li>
        <li className="flex items-start gap-2">
          <span aria-hidden className="mt-1 text-accent">↳</span>
          <span>
            <strong className="text-fg">Your settings.</strong> Control scheme, sound and haptics, high-contrast mode,
            and your chosen glow theme.
          </span>
        </li>
        <li className="flex items-start gap-2">
          <span aria-hidden className="mt-1 text-accent">↳</span>
          <span>
            <strong className="text-fg">Play pacing.</strong> Timestamps used to regenerate your play energy over time,
            and a flag recording whether you have purchased the ad-free unlock.
          </span>
        </li>
      </ul>
      <p className="mt-3 text-muted">
        None of this is transmitted to Impact Loop. It is removed when you clear the app&rsquo;s data or uninstall it.
      </p>

      <h2 className="mt-10 border-b border-line pb-2 font-display text-xl font-semibold text-fg">
        3. Data Echo of Light collects about you
      </h2>
      <p className="mt-3 text-muted">
        <strong className="text-fg">None.</strong> The game&rsquo;s own code does not collect personal information, does
        not require an account, and sends nothing about you or how you play to Impact Loop. There is{' '}
        <strong className="text-fg">no analytics and no crash-reporting SDK</strong> in the app. The only third parties
        that process any data are the Google services described below, each governed by Google&rsquo;s own privacy
        policy.
      </p>

      <h2 className="mt-10 border-b border-line pb-2 font-display text-xl font-semibold text-fg">4. Advertising (Google AdMob)</h2>
      <p className="mt-3 text-muted">
        The free version shows ads through <strong className="text-fg">Google AdMob</strong>: an occasional full-screen ad
        between runs, and optional rewarded ads you can choose to watch to refill your play energy. Ads never interrupt a
        run in progress. To serve ads, AdMob may process data such as your advertising identifier, IP address, and general
        device information, under{' '}
        <a className="text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent" href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">
          Google&rsquo;s Privacy Policy
        </a>
        . In the EEA and UK we show a Google-certified consent prompt (UMP) before personalised ads. Buying the ad-free
        unlock removes these ads.
      </p>

      <h2 className="mt-10 border-b border-line pb-2 font-display text-xl font-semibold text-fg">5. Purchases (ad-free unlock)</h2>
      <p className="mt-3 text-muted">
        The one-time ad-free unlock is processed by <strong className="text-fg">Google Play Billing</strong>. Your payment
        details are handled by Google, not by us — the game only learns whether the unlock is active on your account.
      </p>

      <h2 className="mt-10 border-b border-line pb-2 font-display text-xl font-semibold text-fg">
        6. Google Play Games Services (optional)
      </h2>
      <p className="mt-3 text-muted">
        Echo of Light can connect to <strong className="text-fg">Google Play Games Services</strong> for leaderboards,
        achievements, and cloud saves. This is the one part of the game that sends your progress off your device, and it
        happens <strong className="text-fg">only if you sign in</strong> — the game is fully playable without it.
      </p>
      <ul className="mt-3 space-y-2 text-muted">
        <li className="flex items-start gap-2">
          <span aria-hidden className="mt-1 text-accent">↳</span>
          <span>
            <strong className="text-fg">Leaderboards.</strong> If you sign in, your score is submitted to Google&rsquo;s
            leaderboards, where it appears under your Play Games profile name.
          </span>
        </li>
        <li className="flex items-start gap-2">
          <span aria-hidden className="mt-1 text-accent">↳</span>
          <span>
            <strong className="text-fg">Achievements.</strong> Achievements you earn are recorded against your Play Games
            profile.
          </span>
        </li>
        <li className="flex items-start gap-2">
          <span aria-hidden className="mt-1 text-accent">↳</span>
          <span>
            <strong className="text-fg">Cloud saves.</strong> Your progress can be stored in Google&rsquo;s saved-games
            service so it survives a reinstall or moves to a new device. We do not receive or store a copy ourselves.
          </span>
        </li>
      </ul>
      <p className="mt-3 text-muted">
        This data is processed by Google under{' '}
        <a className="text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent" href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">
          Google&rsquo;s Privacy Policy
        </a>
        . You can review or delete it from the Google Play Games app, under your profile settings.
      </p>

      <h2 className="mt-10 border-b border-line pb-2 font-display text-xl font-semibold text-fg">
        7. Permissions and device sensors
      </h2>
      <ul className="mt-3 space-y-2 text-muted">
        <li className="flex items-start gap-2">
          <span aria-hidden className="mt-1 text-accent">↳</span>
          <span>
            <strong className="text-fg">Internet access.</strong> Used only for ads, purchases, and Play Games. The game
            itself plays entirely offline.
          </span>
        </li>
        <li className="flex items-start gap-2">
          <span aria-hidden className="mt-1 text-accent">↳</span>
          <span>
            <strong className="text-fg">Motion sensor (accelerometer).</strong> Read only to support the optional tilt
            control scheme. The readings are used to steer the spirit in the moment and are never recorded or
            transmitted. Tilt is off unless you select it.
          </span>
        </li>
      </ul>
      <p className="mt-3 text-muted">
        Echo of Light requests no access to your camera, microphone, contacts, location, photos, or files.
      </p>

      <h2 className="mt-10 border-b border-line pb-2 font-display text-xl font-semibold text-fg">8. Children</h2>
      <p className="mt-3 text-muted">
        Echo of Light is a general-audience game and is not directed to children under 13. We do not knowingly collect
        personal information from children. The game shows ads and offers an in-app purchase, so parents may wish to use
        Google Play&rsquo;s parental controls and purchase authentication.
      </p>

      <h2 className="mt-10 border-b border-line pb-2 font-display text-xl font-semibold text-fg">9. Retention &amp; deletion</h2>
      <p className="mt-3 text-muted">
        Because the game&rsquo;s data lives on your device, you are in control: clear the app&rsquo;s data or uninstall it
        to remove everything Echo of Light stores locally. If you signed in to Play Games, leaderboard entries,
        achievements, and cloud saves are held by Google — delete them from the Google Play Games app. We hold no player
        records to delete, because we never receive any.
      </p>

      <h2 className="mt-10 border-b border-line pb-2 font-display text-xl font-semibold text-fg">10. Security</h2>
      <p className="mt-3 text-muted">
        Keeping data on your device is our primary safeguard. For the limited ads, billing, and Play Games functions we
        rely on Google. No system is perfectly secure, but Echo of Light is designed to hold as little data as possible.
      </p>

      <h2 className="mt-10 border-b border-line pb-2 font-display text-xl font-semibold text-fg">11. Changes to this policy</h2>
      <p className="mt-3 text-muted">
        We may update this policy from time to time and will revise the &ldquo;Last updated&rdquo; date above. Continued
        use of Echo of Light after a change constitutes acceptance of the updated policy.
      </p>

      <h2 className="mt-10 border-b border-line pb-2 font-display text-xl font-semibold text-fg">12. Contact</h2>
      <p className="mt-3 text-muted">
        Questions about privacy in Echo of Light? Email us at{' '}
        <a className="text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent" href={`mailto:${EMAIL}`}>
          {EMAIL}
        </a>
        .
      </p>

      <div className="mt-12 border-t border-line pt-8">
        <a
          className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-3 font-medium text-bg transition hover:opacity-90"
          href={DEVELOPER_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          More apps by Impact Loop →
        </a>
      </div>
    </div>
  )
}
