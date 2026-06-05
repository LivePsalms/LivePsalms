// Surrender — Serenity of Surrender (Psalm 46:10).
//
// One devotion, two art-directed arrangements (desktop `sections`, mobile
// `mobile`) sharing prose via SectionText {full, mobile?}. Geometry is verbatim
// data; the renderers in MoodBoard.tsx own the grammar. See ./_shared for the
// model + helpers. Zero visual change is the bar.
import type { DevotionMoodBoard, SectionText } from './_shared';

const surrender = {
  titleIntro: {
    full: <>Let&rsquo;s explore the open hands that come after the white-knuckled fists.</>,
  },
  openingQuestion: {
    full: <>Serenity has never been the fruit of control.</>,
  },
  openingBody1: {
    full: (
      <>
        There is a particular kind of restlessness that modern life breeds. It is the hum beneath our
        thoughts, the compulsion to check our phones one more time, the inability to sit in silence
        without reaching for a distraction. Even in our quietest moments, our minds are often
        loud&mdash;replaying conversations, rehearsing tomorrow&rsquo;s worries, and cataloging
        everything that feels out of our control.
      </>
    ),
  },
  openingBody2: {
    full: (
      <>
        We long for serenity, but we keep trying to manufacture it through control. If we can just
        answer every email, solve every problem, anticipate every outcome&mdash;then, we tell
        ourselves, we will finally feel at peace. But serenity has never been the fruit of control. It
        is the fruit of surrender.
      </>
    ),
  },
  scriptureLabel: { full: <>The Scripture</> },
  scriptureBody1: {
    full: (
      <>
        Psalm 46 was written against the backdrop of catastrophe. The psalmist describes mountains
        falling into the heart of the sea, waters roaring and foaming, kingdoms shaking. This is not a
        psalm composed in a quiet garden on a sunny afternoon. It is a psalm born in the middle of
        upheaval. And yet, in the midst of that chaos, God speaks a single command: &ldquo;Be still,
        and know that I am God.&rdquo;
      </>
    ),
  },
  scriptureBody2: {
    full: (
      <>
        The Hebrew phrase translated &ldquo;be still&rdquo; is{' '}
        <em className="not-italic font-['Cormorant_Garamond'] italic">raphah</em>, which carries the
        meaning of &ldquo;to let go&rdquo; or &ldquo;to cease striving.&rdquo; It is not simply an
        invitation to silence. It is a command to release your grip. To stop trying to hold the world
        together with your own two hands.
      </>
    ),
    mobile: (
      <>
        The Hebrew phrase translated &ldquo;be still&rdquo; is{' '}
        <em className="not-italic font-['Cormorant_Garamond'] italic">raphah</em>, which carries the
        meaning of &ldquo;to let go&rdquo; or &ldquo;to cease striving.&rdquo; It is not simply an
        invitation to silence. It is a command to release your grip. To stop trying to hold the world
        together with your own two hands. To relax the white-knuckled fists you have been clenching
        for far too long.
      </>
    ),
  },
  sovereignty: {
    full: (
      <>
        To relax the white-knuckled fists you have been clenching for far too long. And the reason
        given is not that the storm has passed&mdash;but that God is still God. His sovereignty has
        not been shaken by anything that is shaking you.
      </>
    ),
    mobile: (
      <>
        And the reason given is not that the storm has passed&mdash;but that God is still God. His
        sovereignty has not been shaken by anything that is shaking you.
      </>
    ),
  },
  principleLabel: { full: <>The Timeless Principle</> },
  principleHeading: {
    full: <>True peace begins where our striving ends.</>,
  },
  principleBody: {
    full: (
      <>
        Serenity is not found by controlling our circumstances; it is found by surrendering them to
        the God who is already in control. When we release our grip on what we were never meant to
        carry, we discover that God has been holding it&mdash;and us&mdash;all along.
      </>
    ),
  },
  applicationLabel: { full: <>The Application</> },
  applicationBody1: {
    full: (
      <>
        Consider the tight grip you have been keeping on something today. Perhaps it is a relationship
        you are trying to fix, a future you are trying to secure, or an outcome you are trying to
        force. Name it honestly before God. Then, as a physical act of surrender, open your
        hands&mdash;palms up&mdash;and whisper the words of the psalm: &ldquo;Be still, and know that I
        am God.&rdquo;
      </>
    ),
  },
  applicationQuote: {
    full: (
      <>&ldquo;Let your body preach to your soul what your mind has been slow to believe.&rdquo;</>
    ),
  },
  applicationBody2: {
    full: (
      <>
        Let your body preach to your soul what your mind has been slow to believe. Serenity is not an
        emotion you conjure. It is a gift that flows from trusting the One who holds all things
        together.
      </>
    ),
    mobile: (
      <>
        Serenity is not an emotion you conjure. It is a gift that flows from trusting the One who holds
        all things together.
      </>
    ),
  },
  prayerLabel: { full: <>A Prayer for Serenity</> },
  prayerBody: {
    full: (
      <>
        Father, I confess that I have been striving when I should have been surrendering. I have been
        gripping tightly to things that were never mine to control. Today, I release them into Your
        hands. Quiet the noise in my mind. Settle the unrest in my spirit. Help me to be still long
        enough to remember that You are God&mdash;and that is enough. Fill me with the serenity that
        only comes from trusting You. Amen.
      </>
    ),
  },
  prayerCitation: { full: <>Psalm 46:10 &mdash; Serenity of Surrender</> },
} satisfies Record<string, SectionText>;

export const surrenderBoard: DevotionMoodBoard = {
  id: 'surrender',
  purposeWord: 'Serenity',
  sections: [
    /* ── Zone 1: Title ── */
    {
      role: 'title',
      width: '120vw',
      elements: [
        {
          kind: 'image',
          src: '/serenity3/hf_20260417_220039_093609a2-929e-4c7f-9cc7-a61440c6a2fa.png',
          alt: 'Be still',
          pos: 'top-[10%] left-[5%] w-[42vw] h-[78vh]',
          threshold: 0.05,
        },
        {
          kind: 'text',
          tag: 'h2',
          className:
            "mb-elem absolute bottom-[24%] left-[52%] font-['Cormorant_Garamond'] italic font-light leading-[0.85] tracking-tight text-white",
          style: { fontSize: 'clamp(3.5rem, 11vw, 13rem)', paddingBottom: '0.22em' },
          text: { full: <>Surrender</> },
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            'mb-elem mb-text absolute top-[18%] left-[52%] text-sm tracking-[0.15em] uppercase max-w-[280px] leading-relaxed text-white/70',
          text: surrender.titleIntro,
        },
      ],
    },

    /* ── Zone 2: The Hook ── */
    {
      role: 'opening',
      width: '200vw',
      bg: { mix: 80, toward: 'app-bg' },
      elements: [
        {
          kind: 'text',
          tag: 'h3',
          className:
            "mb-elem absolute top-[12%] left-[5%] font-['Cormorant_Garamond'] italic font-light text-white leading-[1.15] max-w-[30vw]",
          style: { fontSize: 'clamp(1.5rem, 3.8vw, 3.8rem)' },
          text: surrender.openingQuestion,
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            'mb-elem mb-text absolute top-[46%] left-[5%] text-sm text-white/80 max-w-[280px] leading-[1.85] tracking-wide',
          text: surrender.openingBody1,
        },
        {
          kind: 'image',
          src: '/serenity3/hf_20260418_213303_2c7208e9-a034-4456-9a9f-da42dba4900e.png',
          alt: 'Restless hum',
          pos: 'top-[5%] bottom-0 left-[28%] w-[50vw]',
          imgWrapClassName: 'w-full h-full object-cover',
          threshold: 0.05,
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            'mb-elem mb-text absolute top-[32%] left-[65%] text-sm text-white/70 max-w-[260px] leading-[1.85] tracking-wide',
          text: surrender.openingBody2,
        },
        {
          kind: 'image',
          src: '/serenity3/hf_20260503_210659_6a1c5433-4ad6-4513-8ee5-07aa6d2ff55c.png',
          alt: "Hands that won't let go",
          pos: 'top-[5%] bottom-0 right-[5%] w-[35vw]',
          imgClassName: 'object-contain',
          threshold: 0.05,
        },
      ],
    },

    /* ── Zone 3: The Scripture ── */
    {
      role: 'scripture',
      width: '195vw',
      bg: { mix: 70, toward: 'black', amount: 8 },
      elements: [
        {
          kind: 'text',
          tag: 'p',
          className: 'mb-elem absolute top-[30%] text-xs tracking-[0.3em] uppercase text-white/60',
          style: { left: '3vw' },
          text: surrender.scriptureLabel,
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            'mb-elem mb-text absolute top-[38%] text-sm text-white/80 max-w-[24vw] leading-[1.85] tracking-wide',
          style: { left: '3vw' },
          text: surrender.scriptureBody1,
        },
        {
          kind: 'image',
          src: '/serenity3/hf_20260503_211252_83c86a1b-fa20-456c-8419-3449c1fdf14b.png',
          alt: 'Mountains falling',
          pos: 'top-[4%] bottom-0',
          style: { left: '35vw', width: '35vw' },
          imgClassName: 'object-contain',
          revealed: true,
        },
        {
          kind: 'image',
          src: '/serenity3/hf_20260503_212601_05bebb34-1f95-42c9-bc30-49cecf97aeab.png',
          alt: 'Waters roaring',
          pos: 'top-[4%] bottom-0',
          style: { left: '73vw', width: '35vw' },
          imgClassName: 'object-contain',
          revealed: true,
        },
        {
          kind: 'image',
          src: '/serenity3/hf_20260503_212827_b4ef4c61-b7e4-4cb2-9753-0672c8c1700b.png',
          alt: 'Cease striving',
          pos: 'top-[4%] bottom-0',
          style: { left: '111vw', width: '35vw' },
          imgClassName: 'object-contain',
          revealed: true,
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            'mb-elem mb-text absolute bottom-[10%] text-sm text-white/80 max-w-[24vw] leading-[1.85] tracking-wide',
          style: { left: '149vw' },
          text: surrender.scriptureBody2,
        },
      ],
    },

    /* ── Zone 4: God's Sovereignty + Timeless Principle ── */
    {
      role: 'principle',
      width: '200vw',
      bg: { mix: 85, toward: 'app-bg' },
      elements: [
        {
          kind: 'image',
          src: '/serenity3/hf_20260503_212955_5cdf0cc4-20b4-4709-bccb-439de6b1872b.png',
          alt: 'White-knuckled fists',
          pos: 'top-[4%] bottom-0',
          style: { left: '5vw', width: '35vw' },
          imgClassName: 'object-contain',
          revealed: true,
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            'mb-elem mb-text absolute top-[30%] text-sm text-white/80 max-w-[24vw] leading-[1.85] tracking-wide',
          style: { left: '43vw' },
          text: surrender.sovereignty,
        },
        {
          kind: 'image',
          src: '/serenity3/hf_20260503_212959_2b175f35-39d4-47ca-97d6-befe7c47a7a7.png',
          alt: 'Sovereignty unshaken',
          pos: 'top-[4%] bottom-0',
          style: { left: '70vw', width: '35vw' },
          imgClassName: 'object-contain',
          revealed: true,
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'mb-elem absolute top-[10%] text-xs tracking-[0.3em] uppercase text-white/60',
          style: { left: '118vw' },
          text: surrender.principleLabel,
        },
        {
          kind: 'text',
          tag: 'h3',
          className:
            "mb-elem absolute top-[18%] font-['Cormorant_Garamond'] italic font-light text-white leading-[1.2] max-w-[34vw]",
          style: { left: '118vw', fontSize: 'clamp(1.5rem, 3.5vw, 3.5rem)' },
          text: surrender.principleHeading,
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            'mb-elem mb-text absolute bottom-[18%] text-sm text-white/70 max-w-[340px] leading-[1.85] tracking-wide',
          style: { left: '118vw' },
          text: surrender.principleBody,
        },
        {
          kind: 'image',
          src: '/serenity3/hf_20260503_213117_34d23e3c-edea-4222-b8d5-e90281b8dfe9.png',
          alt: 'Held all along',
          pos: 'top-[4%] bottom-0',
          style: { left: '155vw', width: '35vw' },
          imgClassName: 'object-contain',
          revealed: true,
        },
      ],
    },

    /* ── Zone 5: The Application ── */
    {
      role: 'application',
      width: '190vw',
      bg: { mix: 75, toward: 'black', amount: 5 },
      elements: [
        {
          kind: 'text',
          tag: 'p',
          className: 'mb-elem absolute top-[20%] text-xs tracking-[0.3em] uppercase text-white/60',
          style: { left: '5vw' },
          text: surrender.applicationLabel,
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            'mb-elem mb-text absolute top-[28%] text-sm text-white/80 max-w-[24vw] leading-[1.85] tracking-wide',
          style: { left: '5vw' },
          text: surrender.applicationBody1,
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            "mb-elem mb-text absolute bottom-[15%] font-['Cormorant_Garamond'] italic text-xl text-white/90 max-w-[24vw] leading-relaxed border-l border-white/30 pl-5",
          style: { left: '5vw' },
          text: surrender.applicationQuote,
        },
        {
          kind: 'image',
          src: '/serenity3/hf_20260503_213134_7f564fd0-ed51-49ab-86b3-57706efe5699.png',
          alt: 'Open hands, palms up',
          pos: 'top-[4%] bottom-0',
          style: { left: '35vw', width: '35vw' },
          imgClassName: 'object-contain',
          revealed: true,
        },
        {
          kind: 'image',
          src: '/serenity3/hf_20260503_213652_ebf66dbf-1b27-40cd-92ee-44adf241c584.png',
          alt: 'Whispered psalm',
          pos: 'top-[4%] bottom-0',
          style: { left: '73vw', width: '35vw' },
          imgClassName: 'object-contain',
          revealed: true,
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            'mb-elem mb-text absolute top-[38%] text-sm text-white/70 max-w-[24vw] leading-[1.85] tracking-wide',
          style: { left: '114vw' },
          text: surrender.applicationBody2,
        },
        {
          kind: 'image',
          src: '/serenity3/hf_20260503_224132_d797566b-9e26-4281-a0c3-3fa97888bc26.png',
          alt: 'All things held',
          pos: 'top-[4%] bottom-0',
          style: { left: '141vw', width: '35vw' },
          imgClassName: 'object-contain',
          revealed: true,
        },
      ],
    },

    /* ── Zone 6: Prayer ── */
    {
      role: 'prayer',
      width: '100vw',
      bg: { mix: 90, toward: 'black', amount: 5 },
      elements: [
        {
          kind: 'text',
          tag: 'p',
          className: 'mb-elem absolute top-[18%] text-xs tracking-[0.3em] uppercase text-white/60',
          style: { left: '5vw' },
          text: surrender.prayerLabel,
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            "mb-elem mb-text absolute top-[24%] font-['Cormorant_Garamond'] italic text-white/90 max-w-[24vw] leading-[1.7]",
          style: { left: '5vw', fontSize: 'clamp(0.95rem, 1.6vw, 1.4rem)' },
          text: surrender.prayerBody,
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'mb-elem absolute bottom-[3%] text-xs tracking-widest uppercase text-white/50',
          style: { left: '5vw' },
          text: surrender.prayerCitation,
        },
        {
          kind: 'image',
          src: '/serenity3/hf_20260503_224542_44fc23d7-5722-41d8-addd-580c38dc133f.png',
          alt: 'That is enough',
          pos: 'top-[4%] bottom-0',
          style: { left: '35vw', width: '55vw' },
          imgClassName: 'object-contain',
          revealed: true,
        },
      ],
    },
  ],

  mobile: [
    /* Title */
    {
      role: 'title',
      className: 'min-h-screen p-6 flex flex-col items-center justify-center text-center',
      elements: [
        {
          kind: 'text',
          tag: 'p',
          className: 'text-sm tracking-[0.2em] uppercase text-white/45 mb-8 max-w-xs',
          text: surrender.titleIntro,
        },
        {
          kind: 'text',
          tag: 'h2',
          className: "font-['Cormorant_Garamond'] italic font-light text-white/90 leading-[0.9]",
          style: { fontSize: 'clamp(2.5rem, 12vw, 7rem)', paddingBottom: '0.18em' },
          text: { full: <>Surrender</> },
        },
        { kind: 'divider', className: 'w-10 h-px bg-white/20 mt-10' },
      ],
    },

    /* Opening — image + text */
    {
      role: 'opening',
      className: 'p-6 pb-16',
      bg: { mix: 85, toward: 'app-bg' },
      elements: [
        {
          kind: 'image',
          src: '/serenity3/hf_20260417_220039_093609a2-929e-4c7f-9cc7-a61440c6a2fa.png',
          alt: 'Be still',
          className: '-mx-6 w-[calc(100%+3rem)] aspect-[2/3] mb-10',
        },
        {
          kind: 'text',
          tag: 'h3',
          className:
            "font-['Cormorant_Garamond'] italic font-light text-white/90 text-3xl leading-snug mb-8",
          text: surrender.openingQuestion,
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'text-sm text-white/60 leading-[1.85] mb-6',
          text: surrender.openingBody1,
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'text-sm text-white/50 leading-[1.85]',
          text: surrender.openingBody2,
        },
      ],
    },

    /* Scripture */
    {
      role: 'scripture',
      className: 'p-6 pb-16',
      bg: { mix: 75, toward: 'black', amount: 8 },
      elements: [
        {
          kind: 'text',
          tag: 'p',
          className: 'text-xs tracking-[0.3em] uppercase text-white/35 mb-10',
          text: surrender.scriptureLabel,
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'text-sm text-white/60 leading-[1.85] mb-8',
          text: surrender.scriptureBody1,
        },
        {
          kind: 'image',
          src: '/serenity3/hf_20260503_211252_83c86a1b-fa20-456c-8419-3449c1fdf14b.png',
          alt: 'Mountains falling',
          className: '-mx-6 w-[calc(100%+3rem)] aspect-[2/3] mb-8',
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'text-sm text-white/60 leading-[1.85] mb-8',
          text: surrender.scriptureBody2,
        },
        {
          kind: 'image',
          src: '/serenity3/hf_20260503_212601_05bebb34-1f95-42c9-bc30-49cecf97aeab.png',
          alt: 'Waters roaring',
          className: '-mx-6 w-[calc(100%+3rem)] aspect-[3/4] mb-8',
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'text-sm text-white/60 leading-[1.85]',
          text: surrender.sovereignty,
        },
      ],
    },

    /* Image pair */
    {
      role: 'gallery',
      className: 'grid grid-cols-2 gap-2 py-6',
      bg: 'base',
      elements: [
        {
          kind: 'image',
          src: '/serenity3/hf_20260503_213652_ebf66dbf-1b27-40cd-92ee-44adf241c584.png',
          alt: 'Restless hum',
          className: 'w-full aspect-[2/3]',
        },
        {
          kind: 'image',
          src: '/serenity3/hf_20260503_212955_5cdf0cc4-20b4-4709-bccb-439de6b1872b.png',
          alt: 'White-knuckled fists',
          className: 'w-full aspect-[2/3]',
        },
      ],
    },

    /* Timeless Principle */
    {
      role: 'principle',
      className: 'p-6 py-20',
      bg: { mix: 85, toward: 'app-bg' },
      elements: [
        {
          kind: 'text',
          tag: 'p',
          className: 'text-xs tracking-[0.3em] uppercase text-white/35 mb-10',
          text: surrender.principleLabel,
        },
        {
          kind: 'text',
          tag: 'h3',
          className:
            "font-['Cormorant_Garamond'] italic font-light text-white/85 text-2xl leading-snug mb-8",
          text: surrender.principleHeading,
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'text-sm text-white/50 leading-[1.85] mb-10',
          text: surrender.principleBody,
        },
        {
          kind: 'image',
          src: '/serenity3/hf_20260418_213303_2c7208e9-a034-4456-9a9f-da42dba4900e.png',
          alt: 'Sovereignty unshaken',
          className: '-mx-6 w-[calc(100%+3rem)] aspect-[3/2]',
        },
      ],
    },

    /* Application */
    {
      role: 'application',
      className: 'p-6 pb-16',
      bg: { mix: 75, toward: 'black', amount: 8 },
      elements: [
        {
          kind: 'text',
          tag: 'p',
          className: 'text-xs tracking-[0.3em] uppercase text-white/35 mb-10',
          text: surrender.applicationLabel,
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'text-sm text-white/60 leading-[1.85] mb-8',
          text: surrender.applicationBody1,
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            "font-['Cormorant_Garamond'] italic text-lg text-white/65 border-l border-white/20 pl-5 mb-8 leading-relaxed",
          text: surrender.applicationQuote,
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'text-sm text-white/50 leading-[1.85] mb-10',
          text: surrender.applicationBody2,
        },
        {
          kind: 'image',
          src: '/serenity3/hf_20260503_213134_7f564fd0-ed51-49ab-86b3-57706efe5699.png',
          alt: 'Open hands, palms up',
          className: '-mx-6 w-[calc(100%+3rem)] aspect-[2/3]',
        },
      ],
    },

    /* Prayer */
    {
      role: 'prayer',
      className: 'p-6 py-20 text-center',
      bg: 'base',
      elements: [
        {
          kind: 'text',
          tag: 'p',
          className: 'text-xs tracking-[0.3em] uppercase text-white/35 mb-12',
          text: surrender.prayerLabel,
        },
        {
          kind: 'text',
          tag: 'p',
          className:
            "font-['Cormorant_Garamond'] italic text-lg text-white/65 leading-[1.7] max-w-sm mx-auto mb-12",
          text: surrender.prayerBody,
        },
        {
          kind: 'image',
          src: '/serenity3/hf_20260503_224542_44fc23d7-5722-41d8-addd-580c38dc133f.png',
          alt: 'That is enough',
          className: '-mx-6 w-[calc(100%+3rem)] aspect-[2/3]',
        },
      ],
    },
  ],
};
