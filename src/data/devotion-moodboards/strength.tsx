// Strength — Restoration of Strength (Isaiah 40:31).
//
// One devotion, two art-directed arrangements (desktop `sections`, mobile
// `mobile`) sharing prose via SectionText {full, mobile?}. Geometry is verbatim
// data; the renderers in MoodBoard.tsx own the grammar. See ./_shared for the
// model + helpers. Zero visual change is the bar.
import type { DevotionMoodBoard, SectionText } from './_shared';

const strength = {
  titleIntro: {
    full: (
      <>
        Let&rsquo;s explore the strength that meets you when you&rsquo;ve reached the end of your own.
      </>
    ),
  },
  openingHook: {
    full: <>There&rsquo;s a kind of tired that sleep can&rsquo;t fix.</>,
  },
  openingBody1: {
    full: (
      <>
        You know the one. It&rsquo;s the weariness that settles in after months of caregiving with no
        end in sight. It&rsquo;s the heaviness you feel when you&rsquo;ve been praying the same prayer
        for years and the answer hasn&rsquo;t come. It&rsquo;s the exhaustion of holding it together
        for everyone around you while quietly wondering who is holding you together.
      </>
    ),
  },
  openingBody2: {
    full: (
      <>
        This is not laziness. This is depletion. And if you&rsquo;re there today, you need to hear
        something: you are not weak for being tired. Even the strongest among us reach the end of
        themselves.
      </>
    ),
  },
  scriptureLabel: { full: <>The Scripture</> },
  scriptureBody1: {
    full: (
      <>
        Isaiah wrote these words to the people of Israel during one of the darkest chapters in their
        history. They were in exile, far from home, watching everything they had built crumble around
        them. They were asking the question so many of us ask in seasons of depletion: &ldquo;Has God
        forgotten me?&rdquo;
      </>
    ),
  },
  scriptureBody2: {
    full: (
      <>
        And God&rsquo;s response through Isaiah is remarkable. He doesn&rsquo;t scold them for being
        tired. He doesn&rsquo;t tell them to try harder. Instead, He points them to His own
        inexhaustible nature: &ldquo;The Lord is the everlasting God, the Creator of the ends of the
        earth. He will not grow tired or weary.&rdquo; The God who sustains the galaxies does not run
        out of strength&mdash;and He offers that same limitless power to the depleted.
      </>
    ),
  },
  condition: {
    full: (
      <>
        But notice the condition: &ldquo;those who hope in the Lord.&rdquo; The Hebrew word for
        &ldquo;hope&rdquo; here is{' '}
        <em className="not-italic font-['Cormorant_Garamond'] italic">qavah</em>, which means
        &ldquo;to wait with eager expectation.&rdquo; It&rsquo;s not passive resignation. It&rsquo;s
        active trust. It&rsquo;s choosing to believe that God&rsquo;s strength will meet you exactly
        where your own runs out. And when it does, you don&rsquo;t just survive&mdash;you soar.
      </>
    ),
  },
  principleLabel: { full: <>The Timeless Principle</> },
  principleHeading: {
    full: (
      <>When we reach the end of our own resources, we arrive at the beginning of His.</>
    ),
  },
  principleBody: {
    full: (
      <>
        God&rsquo;s restoration of strength does not depend on our ability to generate it ourselves.
        It depends on our willingness to wait on Him. The renewed strength God promises is not a
        return to self-sufficiency&mdash;it is a deeper dependence on the One whose power never
        diminishes.
      </>
    ),
  },
  applicationLabel: { full: <>The Application</> },
  applicationBody1: {
    full: (
      <>
        If you&rsquo;re feeling depleted today, resist the urge to push harder. Instead, pause and
        acknowledge where you&rsquo;ve been trying to manufacture strength on your own. Then, bring
        that specific area of exhaustion to God in prayer. Tell Him exactly where you&rsquo;re running
        on empty&mdash;your marriage, your parenting, your health, your faith.
      </>
    ),
  },
  applicationQuote: {
    full: (
      <>
        &ldquo;Your emptiness is not the end of the story. It&rsquo;s the place where God&rsquo;s
        restoration begins.&rdquo;
      </>
    ),
  },
  applicationBody2: {
    full: (
      <>
        Ask Him not for the energy to keep performing, but for the renewed strength that comes from
        resting in His power. Write down Isaiah 40:31 and place it somewhere you&rsquo;ll see it this
        week. Let it remind you: your emptiness is not the end of the story. It&rsquo;s the place where
        God&rsquo;s restoration begins.
      </>
    ),
  },
  prayerLabel: { full: <>A Prayer for Restoration</> },
  prayerBody: {
    full: (
      <>
        Father, I am tired. Not the kind of tired that a good night&rsquo;s sleep can fix, but the
        kind that reaches down into my spirit. I confess that I&rsquo;ve been trying to run on my own
        fuel, and I have nothing left. Today, I choose to wait on You. I place my hope&mdash;my eager
        expectation&mdash;in Your unfailing strength. Renew me, Lord. Restore what depletion has taken.
        Lift me up so I can soar again. Amen.
      </>
    ),
  },
  prayerCitation: { full: <>Isaiah 40:31 &mdash; Restoration of Strength</> },
} satisfies Record<string, SectionText>;

export const strengthBoard: DevotionMoodBoard = {
  id: 'strength',
  purposeWord: 'Strength',
  sections: [
    /* ── Zone 1: Strength Title ── */
    {
      role: 'title',
      width: '120vw',
      elements: [
        {
          kind: 'image',
          src: '/restoration5/hf_20260414_210624_51692a60-f0b4-4235-8fe5-ebf51bae7dff.png',
          alt: 'Strength horizon',
          pos: 'top-[10%] left-[5%] w-[42vw] h-[78vh]',
          threshold: 0.05,
        },
        {
          kind: 'text',
          tag: 'h2',
          className:
            "mb-elem absolute bottom-[24%] left-[52%] font-['Cormorant_Garamond'] italic font-light leading-[0.85] tracking-tight text-white",
          style: { fontSize: 'clamp(5rem, 14vw, 16rem)', paddingBottom: '0.22em' },
          text: { full: <>Strength</> },
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            'mb-elem mb-text absolute top-[18%] left-[52%] text-sm tracking-[0.15em] uppercase max-w-[280px] leading-relaxed text-white/70',
          text: strength.titleIntro,
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
          style: { fontSize: 'clamp(1.8rem, 4.5vw, 4.5rem)' },
          text: strength.openingHook,
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            'mb-elem mb-text absolute top-[46%] left-[5%] text-sm text-white/80 max-w-[280px] leading-[1.85] tracking-wide',
          text: strength.openingBody1,
        },
        {
          kind: 'image',
          src: '/restoration5/hf_20260414_211704_fc37cef0-b61a-463d-95c7-07387941a8d2.png',
          alt: 'Weariness landscape',
          pos: 'top-[5%] bottom-0 left-[28%] w-[50vw]',
          imgWrapClassName: 'w-full h-full object-cover',
          threshold: 0.05,
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            'mb-elem mb-text absolute top-[32%] left-[65%] text-sm text-white/70 max-w-[260px] leading-[1.85] tracking-wide',
          text: strength.openingBody2,
        },
        {
          kind: 'image',
          src: '/restoration5/hf_20260414_221611_185b9639-c6a6-4755-8f23-6c64e49f54c2.png',
          alt: 'Depleted detail',
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
          text: strength.scriptureLabel,
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            'mb-elem mb-text absolute top-[38%] text-sm text-white/80 max-w-[24vw] leading-[1.85] tracking-wide',
          style: { left: '3vw' },
          text: strength.scriptureBody1,
        },
        {
          kind: 'image',
          src: '/restoration5/hf_20260414_221922_5aa18e0b-2c70-42ab-9c2e-f9b835aea1ae.png',
          alt: 'Scripture scene',
          pos: 'top-[4%] bottom-0',
          style: { left: '35vw', width: '35vw' },
          imgClassName: 'object-contain',
          revealed: true,
        },
        {
          kind: 'image',
          src: '/restoration5/hf_20260414_221941_0acfb11f-754d-4b65-b6b7-7d7a65eae2a6.png',
          alt: 'Exile horizon',
          pos: 'top-[4%] bottom-0',
          style: { left: '73vw', width: '35vw' },
          imgClassName: 'object-contain',
          revealed: true,
        },
        {
          kind: 'image',
          src: '/restoration5/hf_20260422_004340_90e40904-8a89-4b94-8269-a532f5f9ee59.png',
          alt: 'Inexhaustible nature',
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
          text: strength.scriptureBody2,
        },
      ],
    },

    /* ── Zone 4: The Condition + Timeless Principle ── */
    {
      role: 'principle',
      width: '200vw',
      bg: { mix: 85, toward: 'app-bg' },
      elements: [
        {
          kind: 'image',
          src: '/restoration5/hf_20260422_004943_aaf3ce07-611f-4167-97ba-c53b7a2fdeeb.png',
          alt: 'Wait with eager expectation',
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
          text: strength.condition,
        },
        {
          kind: 'image',
          src: '/restoration5/hf_20260422_005319_1e5c95fa-f83d-4514-83a3-be8120e33a06.png',
          alt: 'Strength renewed',
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
          text: strength.principleLabel,
        },
        {
          kind: 'text',
          tag: 'h3',
          className:
            "mb-elem absolute top-[18%] font-['Cormorant_Garamond'] italic font-light text-white leading-[1.2] max-w-[34vw]",
          style: { left: '118vw', fontSize: 'clamp(1.5rem, 3.5vw, 3.5rem)' },
          text: strength.principleHeading,
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            'mb-elem mb-text absolute bottom-[18%] text-sm text-white/70 max-w-[340px] leading-[1.85] tracking-wide',
          style: { left: '118vw' },
          text: strength.principleBody,
        },
        {
          kind: 'image',
          src: '/restoration5/hf_20260422_040515_0d5e58e0-0729-4ad5-a060-e7c229a7c94a.png',
          alt: 'Wings rising',
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
          text: strength.applicationLabel,
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            'mb-elem mb-text absolute top-[28%] text-sm text-white/80 max-w-[24vw] leading-[1.85] tracking-wide',
          style: { left: '5vw' },
          text: strength.applicationBody1,
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            "mb-elem mb-text absolute bottom-[15%] font-['Cormorant_Garamond'] italic text-xl text-white/90 max-w-[24vw] leading-relaxed border-l border-white/30 pl-5",
          style: { left: '5vw' },
          text: strength.applicationQuote,
        },
        {
          kind: 'image',
          src: '/restoration5/hf_20260422_040639_2bb12f30-fcba-4622-90f2-5a4dd64fc088.png',
          alt: 'Resting in His power',
          pos: 'top-[4%] bottom-0',
          style: { left: '35vw', width: '35vw' },
          imgClassName: 'object-contain',
          revealed: true,
        },
        {
          kind: 'image',
          src: '/restoration5/hf_20260422_042245_369a0645-1591-4ce4-b27b-d6de33220a2d.png',
          alt: 'Verse on the wall',
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
          text: strength.applicationBody2,
        },
        {
          kind: 'image',
          src: '/restoration5/hf_20260422_043245_9b7eb58b-22bb-48a8-8764-c5da757d39d5.png',
          alt: 'Restoration begins',
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
          text: strength.prayerLabel,
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            "mb-elem mb-text absolute top-[24%] font-['Cormorant_Garamond'] italic text-white/90 max-w-[24vw] leading-[1.7]",
          style: { left: '5vw', fontSize: 'clamp(0.95rem, 1.6vw, 1.4rem)' },
          text: strength.prayerBody,
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'mb-elem absolute bottom-[3%] text-xs tracking-widest uppercase text-white/50',
          style: { left: '5vw' },
          text: strength.prayerCitation,
        },
        {
          kind: 'image',
          src: '/restoration5/hf_20260422_044321_b65108ba-fea3-486a-91bd-e055572c9bg3.png',
          alt: 'Soar like eagles',
          pos: 'top-[4%] bottom-0',
          style: { left: '35vw', width: '55vw' },
          imgClassName: 'object-contain',
          revealed: true,
        },
      ],
    },
  ],

  mobile: [
    /* Strength Title */
    {
      role: 'title',
      className: 'min-h-screen p-6 flex flex-col items-center justify-center text-center',
      elements: [
        {
          kind: 'text',
          tag: 'p',
          className: 'text-sm tracking-[0.2em] uppercase text-white/45 mb-8 max-w-xs',
          text: strength.titleIntro,
        },
        {
          kind: 'text',
          tag: 'h2',
          className: "font-['Cormorant_Garamond'] italic font-light text-white/90 leading-[0.9]",
          style: { fontSize: 'clamp(4rem, 18vw, 10rem)' },
          text: { full: <>Strength</> },
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
          src: '/restoration5/hf_20260414_210624_51692a60-f0b4-4235-8fe5-ebf51bae7dff.png',
          alt: 'Strength horizon',
          className: '-mx-6 w-[calc(100%+3rem)] aspect-[2/3] mb-10',
        },
        {
          kind: 'text',
          tag: 'h3',
          className:
            "font-['Cormorant_Garamond'] italic font-light text-white/90 text-3xl leading-snug mb-8",
          text: strength.openingHook,
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'text-sm text-white/60 leading-[1.85] mb-6',
          text: strength.openingBody1,
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'text-sm text-white/50 leading-[1.85]',
          text: strength.openingBody2,
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
          text: strength.scriptureLabel,
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'text-sm text-white/60 leading-[1.85] mb-8',
          text: strength.scriptureBody1,
        },
        {
          kind: 'image',
          src: '/restoration5/hf_20260414_221922_5aa18e0b-2c70-42ab-9c2e-f9b835aea1ae.png',
          alt: 'Scripture scene',
          className: '-mx-6 w-[calc(100%+3rem)] aspect-[2/3] mb-8',
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'text-sm text-white/60 leading-[1.85] mb-8',
          text: strength.scriptureBody2,
        },
        {
          kind: 'image',
          src: '/restoration5/hf_20260414_221611_185b9639-c6a6-4755-8f23-6c64e49f54c2.png',
          alt: 'Exile horizon',
          className: '-mx-6 w-[calc(100%+3rem)] aspect-video mb-8',
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'text-sm text-white/60 leading-[1.85]',
          text: strength.condition,
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
          src: '/restoration5/hf_20260414_221941_0acfb11f-754d-4b65-b6b7-7d7a65eae2a6.png',
          alt: 'Weariness landscape',
          className: 'w-full aspect-[2/3]',
        },
        {
          kind: 'image',
          src: '/restoration5/hf_20260422_004943_aaf3ce07-611f-4167-97ba-c53b7a2fdeeb.png',
          alt: 'Wait with eager expectation',
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
          text: strength.principleLabel,
        },
        {
          kind: 'text',
          tag: 'h3',
          className:
            "font-['Cormorant_Garamond'] italic font-light text-white/85 text-2xl leading-snug mb-8",
          text: strength.principleHeading,
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'text-sm text-white/50 leading-[1.85] mb-10',
          text: strength.principleBody,
        },
        {
          kind: 'image',
          src: '/restoration5/hf_20260414_211704_fc37cef0-b61a-463d-95c7-07387941a8d2.png',
          alt: 'Strength renewed',
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
          text: strength.applicationLabel,
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'text-sm text-white/60 leading-[1.85] mb-8',
          text: strength.applicationBody1,
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            "font-['Cormorant_Garamond'] italic text-lg text-white/65 border-l border-white/20 pl-5 mb-8 leading-relaxed",
          text: strength.applicationQuote,
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'text-sm text-white/50 leading-[1.85] mb-10',
          text: strength.applicationBody2,
        },
        {
          kind: 'image',
          src: '/restoration5/hf_20260422_040639_2bb12f30-fcba-4622-90f2-5a4dd64fc088.png',
          alt: 'Resting in His power',
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
          text: strength.prayerLabel,
        },
        {
          kind: 'text',
          tag: 'p',
          className:
            "font-['Cormorant_Garamond'] italic text-lg text-white/65 leading-[1.7] max-w-sm mx-auto mb-12",
          text: strength.prayerBody,
        },
        {
          kind: 'image',
          src: '/restoration5/hf_20260422_044321_b65108ba-fea3-486a-91bd-e055572c9bg3.png',
          alt: 'Soar like eagles',
          className: '-mx-6 w-[calc(100%+3rem)] aspect-[2/3]',
        },
      ],
    },
  ],
};
