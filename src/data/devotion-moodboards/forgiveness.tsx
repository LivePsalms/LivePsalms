// Forgiveness — Serenity of Forgiveness (Ephesians 4:31–32).
//
// One devotion, two art-directed arrangements (desktop `sections`, mobile
// `mobile`) sharing prose via SectionText {full, mobile?}. Geometry is verbatim
// data; the renderers in MoodBoard.tsx own the grammar. See ./_shared for the
// model + helpers. Zero visual change is the bar.
import type { DevotionMoodBoard, SectionText } from './_shared';

const forgiveness = {
  titleIntro: {
    full: (
      <>
        Let&rsquo;s explore the weight you were never meant to carry, and the hands open enough to
        let it fall.
      </>
    ),
  },
  hookHeading: {
    full: <>Some wounds are loud. Others are quiet but just as deep.</>,
  },
  hookBody1: {
    full: (
      <>
        Maybe someone said something about you that was never true, and the memory still burns. Maybe
        a parent was harsh where they should have been tender, and you have been explaining it away
        for years. Maybe a friend walked out when you needed them most, and you have promised
        yourself you will never be that vulnerable again.
      </>
    ),
  },
  hookBody2: {
    full: (
      <>
        We tell ourselves that holding on to the offense is a way of protecting ourselves. But
        somewhere along the way, the weight we thought we were carrying to stay safe starts carrying
        us instead. Bitterness has a way of doing that. It promises justice and delivers exhaustion.
        It promises power and delivers a restless, agitated soul.
      </>
    ),
  },
  scriptureLabel: { full: <>The Scripture</> },
  scriptureBody1: {
    full: (
      <>
        Paul wrote the letter to the Ephesians from prison. He was writing to a mixed community of
        Jews and Gentiles who carried real grievances against one another&mdash;histories of
        exclusion, misunderstanding, and hurt. He does not minimize what they have felt. But he does
        call them to lay it down.
      </>
    ),
  },
  scriptureBody2: {
    full: (
      <>
        The Greek word translated &ldquo;get rid of&rdquo; is{' '}
        <em className="not-italic font-['Cormorant_Garamond'] italic">airo</em>, which means to lift
        up and carry away. Paul is describing a deliberate, active release. This is not repression. It
        is not pretending the wound didn&rsquo;t happen. It is the sacred work of choosing not to keep
        rehearsing it.
      </>
    ),
  },
  justAsInChrist: {
    full: (
      <>
        And Paul anchors it in something beautiful: &ldquo;just as in Christ God forgave you.&rdquo;
        We do not forgive from a place of moral superiority. We forgive from a place of having been
        forgiven. The cross is the deepest possible proof that our offenses were absorbed by a love
        that refused to pass the debt back to us. When we forgive, we are not being asked to
        manufacture something we don&rsquo;t have. We are being asked to give away what we have
        already received.
      </>
    ),
  },
  principleLabel: { full: <>The Timeless Principle</> },
  principleHeading: {
    full: <>The thing you thought you were holding onto was holding onto you.</>,
  },
  principleBody: {
    full: (
      <>
        Serenity is impossible to hold on to while bitterness is being nursed. Forgiveness is not a
        statement that the wound did not matter; it is a refusal to let the wound keep writing the
        next chapter of our lives. When we release the offense into the hands of a God who sees what
        we cannot fix, we discover that the thing we thought we needed to hold onto was actually the
        thing holding onto us.
      </>
    ),
  },
  applicationLabel: { full: <>The Application</> },
  applicationBody1: {
    full: (
      <>
        Bring one specific person and one specific offense to mind. Don&rsquo;t generalize&mdash;be
        honest about the name and the wound. Now imagine that offense as a weight in your hands.
        Forgiveness does not mean saying it didn&rsquo;t hurt. It means choosing to open your hands
        and let it fall.
      </>
    ),
  },
  applicationQuote: {
    full: (
      <>
        &ldquo;Your healing does not depend on their apology. It depends on your willingness to let
        Jesus carry what you were never meant to carry.&rdquo;
      </>
    ),
  },
  applicationBody2: {
    full: (
      <>
        You may need to do this more than once. You may need to do it every morning for a while. That
        is not weakness&mdash;that is how forgiveness actually works. If the person is safe and
        reconciliation is possible, ask God if there is a conversation He wants you to have. If the
        relationship is unsafe or no longer accessible, know this: your healing does not depend on
        their apology.
      </>
    ),
  },
  prayerLabel: { full: <>A Prayer for Serenity</> },
  prayerBody: {
    full: (
      <>
        Lord, You know the name and the wound without me having to explain it. You have seen every
        moment of it. Today, I bring it to You&mdash;not because it didn&rsquo;t matter, but because I
        am tired of letting it define me. Help me to release what I have been holding. Teach me to
        forgive from the deep well of Your own forgiveness toward me. Cleanse me of bitterness. Soften
        what has hardened. Restore the serenity that only an unburdened heart can know. Amen.
      </>
    ),
  },
  prayerCitation: { full: <>Ephesians 4:31&ndash;32 &mdash; Serenity of Forgiveness</> },
} satisfies Record<string, SectionText>;

export const forgivenessBoard: DevotionMoodBoard = {
  id: 'forgiveness',
  purposeWord: 'Serenity',
  sections: [
    /* ── Zone 1: Forgiveness Title ── */
    {
      role: 'title',
      width: '120vw',
      elements: [
        {
          kind: 'image',
          src: '/serenity2/hf_20260417_180057_acab57fb-74d9-469f-b29b-a1b8af56ccd9.png',
          alt: 'Open hands',
          pos: 'top-[10%] left-[5%] w-[42vw] h-[78vh]',
          threshold: 0.05,
        },
        {
          kind: 'text',
          tag: 'h2',
          className:
            "mb-elem absolute bottom-[24%] left-[52%] font-['Cormorant_Garamond'] italic font-light leading-[0.85] tracking-tight text-white",
          style: { fontSize: 'clamp(3.5rem, 11vw, 13rem)', paddingBottom: '0.22em' },
          text: { full: <>Forgiveness</> },
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            'mb-elem mb-text absolute top-[18%] left-[52%] text-sm tracking-[0.15em] uppercase max-w-[280px] leading-relaxed text-white/70',
          text: forgiveness.titleIntro,
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
          text: forgiveness.hookHeading,
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            'mb-elem mb-text absolute top-[46%] left-[5%] text-sm text-white/80 max-w-[280px] leading-[1.85] tracking-wide',
          text: forgiveness.hookBody1,
        },
        {
          kind: 'image',
          src: '/serenity2/hf_20260417_185222_2006ffa5-d241-46ab-95d8-ea9fa7b22bc6.png',
          alt: 'Quiet wound',
          pos: 'top-[5%] bottom-0 left-[28%] w-[50vw]',
          imgWrapClassName: 'w-full h-full object-cover',
          threshold: 0.05,
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            'mb-elem mb-text absolute top-[32%] left-[65%] text-sm text-white/70 max-w-[260px] leading-[1.85] tracking-wide',
          text: forgiveness.hookBody2,
        },
        {
          kind: 'image',
          src: '/serenity2/hf_20260417_210451_81d36918-c70b-4d80-8f5c-a90febb338db.png',
          alt: 'Carried weight',
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
          text: forgiveness.scriptureLabel,
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            'mb-elem mb-text absolute top-[38%] text-sm text-white/80 max-w-[24vw] leading-[1.85] tracking-wide',
          style: { left: '3vw' },
          text: forgiveness.scriptureBody1,
        },
        {
          kind: 'image',
          src: '/serenity2/hf_20260417_211444_9529204a-d9a3-41e0-9c8a-2ef0b9dc041a.png',
          alt: 'Real grievances',
          pos: 'top-[4%] bottom-0',
          style: { left: '35vw', width: '35vw' },
          imgClassName: 'object-contain',
          revealed: true,
        },
        {
          kind: 'image',
          src: '/serenity2/hf_20260417_212151_41d47271-4ac4-440c-a433-b8f3d4975a72.png',
          alt: 'Lift and carry away',
          pos: 'top-[4%] bottom-0',
          style: { left: '73vw', width: '35vw' },
          imgClassName: 'object-contain',
          revealed: true,
        },
        {
          kind: 'image',
          src: '/serenity2/hf_20260417_212321_79c2d74f-6e30-4cce-88f8-69fe676a97af.png',
          alt: 'Sacred release',
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
          text: forgiveness.scriptureBody2,
        },
      ],
    },

    /* ── Zone 4: Just as in Christ + Timeless Principle ── */
    {
      role: 'principle',
      width: '200vw',
      bg: { mix: 85, toward: 'app-bg' },
      elements: [
        {
          kind: 'image',
          src: '/serenity2/hf_20260417_212414_ef2e2e0d-2605-401e-bd0e-d24ac094815e.png',
          alt: 'The cross absorbs',
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
          text: forgiveness.justAsInChrist,
        },
        {
          kind: 'image',
          src: '/serenity2/hf_20260417_212558_184282cb-d6e3-4e51-82d8-6114cb23762d.png',
          alt: 'Already received',
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
          text: forgiveness.principleLabel,
        },
        {
          kind: 'text',
          tag: 'h3',
          className:
            "mb-elem absolute top-[18%] font-['Cormorant_Garamond'] italic font-light text-white leading-[1.2] max-w-[34vw]",
          style: { left: '118vw', fontSize: 'clamp(1.5rem, 3.5vw, 3.5rem)' },
          text: forgiveness.principleHeading,
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            'mb-elem mb-text absolute bottom-[18%] text-sm text-white/70 max-w-[340px] leading-[1.85] tracking-wide',
          style: { left: '118vw' },
          text: forgiveness.principleBody,
        },
        {
          kind: 'image',
          src: '/serenity2/hf_20260502_085359_63722552-4e69-444b-8d3a-7f081ef72c6a.png',
          alt: 'Released into His hands',
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
          text: forgiveness.applicationLabel,
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            'mb-elem mb-text absolute top-[28%] text-sm text-white/80 max-w-[24vw] leading-[1.85] tracking-wide',
          style: { left: '5vw' },
          text: forgiveness.applicationBody1,
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            "mb-elem mb-text absolute bottom-[15%] font-['Cormorant_Garamond'] italic text-xl text-white/90 max-w-[24vw] leading-relaxed border-l border-white/30 pl-5",
          style: { left: '5vw' },
          text: forgiveness.applicationQuote,
        },
        {
          kind: 'image',
          src: '/serenity2/hf_20260502_085518_7f633410-3d8a-4f18-86ba-197245d5afe4.png',
          alt: 'Open your hands',
          pos: 'top-[4%] bottom-0',
          style: { left: '35vw', width: '35vw' },
          imgClassName: 'object-contain',
          revealed: true,
        },
        {
          kind: 'image',
          src: '/serenity2/hf_20260502_085857_a46a594d-1d82-4042-b0da-2ed1be676826.png',
          alt: 'Let it fall',
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
          text: forgiveness.applicationBody2,
        },
        {
          kind: 'image',
          src: '/serenity2/hf_20260502_085911_315d48f9-a4e9-47f4-8a19-0440dd6c4152.png',
          alt: 'Carried by Jesus',
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
          text: forgiveness.prayerLabel,
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            "mb-elem mb-text absolute top-[24%] font-['Cormorant_Garamond'] italic text-white/90 max-w-[24vw] leading-[1.7]",
          style: { left: '5vw', fontSize: 'clamp(0.95rem, 1.6vw, 1.4rem)' },
          text: forgiveness.prayerBody,
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'mb-elem absolute bottom-[3%] text-xs tracking-widest uppercase text-white/50',
          style: { left: '5vw' },
          text: forgiveness.prayerCitation,
        },
        {
          kind: 'image',
          src: '/serenity2/hf_20260502_085916_c6a51648-3fd1-4aa8-b43d-28886b87440a.png',
          alt: 'Unburdened heart',
          pos: 'top-[4%] bottom-0',
          style: { left: '35vw', width: '55vw' },
          imgClassName: 'object-contain',
          revealed: true,
        },
      ],
    },
  ],

  mobile: [
    /* Forgiveness Title */
    {
      role: 'title',
      className: 'min-h-screen p-6 flex flex-col items-center justify-center text-center',
      elements: [
        {
          kind: 'text',
          tag: 'p',
          className: 'text-sm tracking-[0.2em] uppercase text-white/45 mb-8 max-w-xs',
          text: forgiveness.titleIntro,
        },
        {
          kind: 'text',
          tag: 'h2',
          className: "font-['Cormorant_Garamond'] italic font-light text-white/90 leading-[0.9]",
          style: { fontSize: 'clamp(2.5rem, 12vw, 7rem)', paddingBottom: '0.18em' },
          text: { full: <>Forgiveness</> },
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
          src: '/serenity2/hf_20260417_180057_acab57fb-74d9-469f-b29b-a1b8af56ccd9.png',
          alt: 'Open hands',
          className: '-mx-6 w-[calc(100%+3rem)] aspect-[2/3] mb-10',
        },
        {
          kind: 'text',
          tag: 'h3',
          className:
            "font-['Cormorant_Garamond'] italic font-light text-white/90 text-3xl leading-snug mb-8",
          text: forgiveness.hookHeading,
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'text-sm text-white/60 leading-[1.85] mb-6',
          text: forgiveness.hookBody1,
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'text-sm text-white/50 leading-[1.85]',
          text: forgiveness.hookBody2,
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
          text: forgiveness.scriptureLabel,
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'text-sm text-white/60 leading-[1.85] mb-8',
          text: forgiveness.scriptureBody1,
        },
        {
          kind: 'image',
          src: '/serenity2/hf_20260417_210451_81d36918-c70b-4d80-8f5c-a90febb338db.png',
          alt: 'Real grievances',
          className: '-mx-6 w-[calc(100%+3rem)] aspect-[2/3] mb-8',
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'text-sm text-white/60 leading-[1.85] mb-8',
          text: forgiveness.scriptureBody2,
        },
        {
          kind: 'image',
          src: '/serenity2/hf_20260417_212151_41d47271-4ac4-440c-a433-b8f3d4975a72.png',
          alt: 'Lift and carry away',
          className: '-mx-6 w-[calc(100%+3rem)] aspect-video mb-8',
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'text-sm text-white/60 leading-[1.85]',
          text: forgiveness.justAsInChrist,
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
          src: '/serenity2/hf_20260502_085359_63722552-4e69-444b-8d3a-7f081ef72c6a.png',
          alt: 'Quiet wound',
          className: 'w-full aspect-[2/3]',
        },
        {
          kind: 'image',
          src: '/serenity2/hf_20260417_212414_ef2e2e0d-2605-401e-bd0e-d24ac094815e.png',
          alt: 'The cross absorbs',
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
          text: forgiveness.principleLabel,
        },
        {
          kind: 'text',
          tag: 'h3',
          className:
            "font-['Cormorant_Garamond'] italic font-light text-white/85 text-2xl leading-snug mb-8",
          text: forgiveness.principleHeading,
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'text-sm text-white/50 leading-[1.85] mb-10',
          text: forgiveness.principleBody,
        },
        {
          kind: 'image',
          src: '/serenity2/hf_20260417_211444_9529204a-d9a3-41e0-9c8a-2ef0b9dc041a.png',
          alt: 'Already received',
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
          text: forgiveness.applicationLabel,
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'text-sm text-white/60 leading-[1.85] mb-8',
          text: forgiveness.applicationBody1,
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            "font-['Cormorant_Garamond'] italic text-lg text-white/65 border-l border-white/20 pl-5 mb-8 leading-relaxed",
          text: forgiveness.applicationQuote,
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'text-sm text-white/50 leading-[1.85] mb-10',
          text: forgiveness.applicationBody2,
        },
        {
          kind: 'image',
          src: '/serenity2/hf_20260502_085518_7f633410-3d8a-4f18-86ba-197245d5afe4.png',
          alt: 'Open your hands',
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
          text: forgiveness.prayerLabel,
        },
        {
          kind: 'text',
          tag: 'p',
          className:
            "font-['Cormorant_Garamond'] italic text-lg text-white/65 leading-[1.7] max-w-sm mx-auto mb-12",
          text: forgiveness.prayerBody,
        },
        {
          kind: 'image',
          src: '/serenity2/hf_20260502_085916_c6a51648-3fd1-4aa8-b43d-28886b87440a.png',
          alt: 'Unburdened heart',
          className: '-mx-6 w-[calc(100%+3rem)] aspect-[2/3]',
        },
      ],
    },
  ],
};
