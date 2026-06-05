// Trust — Serenity of Trust (Proverbs 3:5–6).
//
// One devotion, two art-directed arrangements (desktop `sections`, mobile
// `mobile`) sharing prose via SectionText {full, mobile?}. Geometry is verbatim
// data; the renderers in MoodBoard.tsx own the grammar. See ./_shared for the
// model + helpers. Zero visual change is the bar.
import type { DevotionMoodBoard, SectionText } from './_shared';

const trust = {
  titleIntro: {
    full: (
      <>
        Let&rsquo;s explore the weight you were never meant to carry on your own understanding.
      </>
    ),
  },
  hookHeading: {
    full: <>The heart was never designed to carry the weight of knowing everything.</>,
  },
  hookBody1: {
    full: (
      <>
        Most of us are not struggling with whether God exists. We are struggling with whether God can
        be trusted with the specific, tender, uncertain parts of our lives. The decision that feels
        too big. The child we cannot fix. The diagnosis we did not see coming. The door that will not
        open no matter how hard we knock.
      </>
    ),
  },
  hookBody2: {
    full: (
      <>
        So we try to figure it out ourselves. We make pro-and-con lists at midnight. We rehearse
        every possible outcome. We Google symptoms at 2 a.m. We build contingency plans for our
        contingency plans. And somewhere in the middle of all that calculating, we lose our peace.
      </>
    ),
  },
  scriptureLabel: { full: <>The Scripture</> },
  scriptureBody1: {
    full: (
      <>
        Solomon wrote these words to his son, passing down wisdom he had learned at great cost. He
        was a king surrounded by advisors, wealth, and intellectual resources beyond what most people
        could imagine. If anyone could have leaned on his own understanding, it was Solomon. And yet
        the charge he gives is this: &ldquo;Lean not on your own understanding.&rdquo;
      </>
    ),
  },
  scriptureBody2: {
    full: (
      <>
        The Hebrew word for &ldquo;lean&rdquo; is{' '}
        <em className="not-italic font-['Cormorant_Garamond'] italic">sha&rsquo;an</em>, which
        pictures a person putting the full weight of their body against something for support. Solomon
        is not saying, &ldquo;Don&rsquo;t think.&rdquo; He is saying, &ldquo;Don&rsquo;t let your
        understanding be the thing you rest your whole weight on.&rdquo; Because your understanding, no
        matter how sharp, is finite. It cannot see around the corner.
      </>
    ),
  },
  straightPaths: {
    full: (
      <>
        And notice the promise that follows: &ldquo;He will make your paths straight.&rdquo; The
        Hebrew here does not mean that the road will be free of difficulty. It means He will make the
        path level enough for you to walk. He clears the way, one step at a time, for the one who
        trusts Him more than their own map.
      </>
    ),
  },
  principleLabel: { full: <>The Timeless Principle</> },
  principleHeading: {
    full: (
      <>
        Serenity does not come from knowing the whole plan; it comes from knowing the One who holds
        it.
      </>
    ),
  },
  principleBody: {
    full: (
      <>
        Trust is not the absence of questions&mdash;it is the choice to submit our questions to a God
        who is wiser than our answers. When we stop leaning on what we can figure out and lean instead
        on who He is, He quietly straightens paths we could never have engineered ourselves.
      </>
    ),
  },
  applicationLabel: { full: <>The Application</> },
  applicationBody1: {
    full: (
      <>
        Think of one decision or unknown that has been stealing your peace. Write it down. Now ask
        yourself honestly: Have I been trying to lean on my own understanding of this? Have I been
        demanding clarity from God before I will give Him trust? Today, reverse the order. Offer Him
        your trust first&mdash;before the clarity comes.
      </>
    ),
  },
  applicationQuote: {
    full: <>&ldquo;Lord, I don&rsquo;t understand. And I trust You anyway.&rdquo;</>,
  },
  applicationBody2: {
    full: (
      <>
        Speak it out loud: &ldquo;Lord, I don&rsquo;t understand. And I trust You anyway.&rdquo; Then
        take the very next small step of obedience that is in front of you, and leave the rest of the
        path in His hands. Serenity grows in the soil of surrendered understanding.
      </>
    ),
    mobile: (
      <>
        Speak it out loud, then take the very next small step of obedience that is in front of you,
        and leave the rest of the path in His hands. Serenity grows in the soil of surrendered
        understanding.
      </>
    ),
  },
  prayerLabel: { full: <>A Prayer for Serenity</> },
  prayerBody: {
    full: (
      <>
        Father, I confess that I have been trying to carry what was never mine to carry&mdash;the
        future, the outcome, the full picture. I have leaned so heavily on my own understanding that I
        have worn myself out. Today, I shift my weight onto You. I trust You with what I cannot see. I
        trust You with what I cannot fix. Make my path straight, one faithful step at a time. Teach me
        the serenity of a heart that rests in Your wisdom instead of its own. Amen.
      </>
    ),
  },
  prayerCitation: { full: <>Proverbs 3:5&ndash;6 &mdash; Serenity of Trust</> },
} satisfies Record<string, SectionText>;

export const trustBoard: DevotionMoodBoard = {
  id: 'trust',
  purposeWord: 'Serenity',
  sections: [
    /* ── Zone 1: Title ── */
    {
      role: 'title',
      width: '120vw',
      elements: [
        {
          kind: 'image',
          src: '/serenity5/IMG_3096.jpg',
          alt: 'The path made straight',
          pos: 'top-[10%] left-[5%] w-[42vw] h-[78vh]',
          threshold: 0.05,
        },
        {
          kind: 'text',
          tag: 'h2',
          className:
            "mb-elem absolute bottom-[24%] left-[52%] font-['Cormorant_Garamond'] italic font-light leading-[0.85] tracking-tight text-white",
          style: { fontSize: 'clamp(5rem, 14vw, 16rem)', paddingBottom: '0.22em' },
          text: { full: <>Trust</> },
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            'mb-elem mb-text absolute top-[18%] left-[52%] text-sm tracking-[0.15em] uppercase max-w-[280px] leading-relaxed text-white/70',
          text: trust.titleIntro,
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
          text: trust.hookHeading,
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            'mb-elem mb-text absolute top-[46%] left-[5%] text-sm text-white/80 max-w-[280px] leading-[1.85] tracking-wide',
          text: trust.hookBody1,
        },
        {
          kind: 'image',
          src: '/serenity5/IMG_3135.jpg',
          alt: 'Midnight uncertainty',
          pos: 'top-[5%] bottom-0 left-[28%] w-[50vw]',
          imgWrapClassName: 'w-full h-full object-cover',
          threshold: 0.05,
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            'mb-elem mb-text absolute top-[32%] left-[65%] text-sm text-white/70 max-w-[260px] leading-[1.85] tracking-wide',
          text: trust.hookBody2,
        },
        {
          kind: 'image',
          src: '/serenity5/IMG_3136.jpg',
          alt: 'Contingency plans',
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
          text: trust.scriptureLabel,
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            'mb-elem mb-text absolute top-[38%] text-sm text-white/80 max-w-[24vw] leading-[1.85] tracking-wide',
          style: { left: '3vw' },
          text: trust.scriptureBody1,
        },
        {
          kind: 'image',
          src: '/serenity5/hf_20260503_234251_3f56432b-dfda-4ad8-9d48-ca863023bcf7.png',
          alt: "Solomon's charge",
          pos: 'top-[4%] bottom-0',
          style: { left: '35vw', width: '35vw' },
          imgClassName: 'object-contain',
          revealed: true,
        },
        {
          kind: 'image',
          src: '/serenity5/hf_20260503_234258_eef0f2e5-d23e-49f3-b4fc-35b0e5656e4e.png',
          alt: "Sha'an — resting weight",
          pos: 'top-[4%] bottom-0',
          style: { left: '73vw', width: '35vw' },
          imgClassName: 'object-contain',
          revealed: true,
        },
        {
          kind: 'image',
          src: '/serenity5/hf_20260503_235715_5a8db31c-6ea8-49ab-9408-f85f4c166cbb.png',
          alt: 'Around the corner',
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
          text: trust.scriptureBody2,
        },
      ],
    },

    /* ── Zone 4: Straight Paths + Timeless Principle ── */
    {
      role: 'principle',
      width: '200vw',
      bg: { mix: 85, toward: 'app-bg' },
      elements: [
        {
          kind: 'image',
          src: '/serenity5/hf_20260503_235857_64c6eb21-2eb5-4ec4-a44f-fad4abb52e92.png',
          alt: 'Level enough to walk',
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
          text: trust.straightPaths,
        },
        {
          kind: 'image',
          src: '/serenity5/hf_20260504_052134_398fd85d-0d00-44c9-a1f9-981ca3154bf4.png',
          alt: 'One step at a time',
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
          text: trust.principleLabel,
        },
        {
          kind: 'text',
          tag: 'h3',
          className:
            "mb-elem absolute top-[18%] font-['Cormorant_Garamond'] italic font-light text-white leading-[1.2] max-w-[34vw]",
          style: { left: '118vw', fontSize: 'clamp(1.5rem, 3.5vw, 3.5rem)' },
          text: trust.principleHeading,
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            'mb-elem mb-text absolute bottom-[18%] text-sm text-white/70 max-w-[340px] leading-[1.85] tracking-wide',
          style: { left: '118vw' },
          text: trust.principleBody,
        },
        {
          kind: 'image',
          src: '/serenity5/hf_20260504_052436_557939ec-87e0-4673-b4a1-c8d3775201f7.png',
          alt: 'Path straightened',
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
          text: trust.applicationLabel,
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            'mb-elem mb-text absolute top-[28%] text-sm text-white/80 max-w-[24vw] leading-[1.85] tracking-wide',
          style: { left: '5vw' },
          text: trust.applicationBody1,
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            "mb-elem mb-text absolute bottom-[15%] font-['Cormorant_Garamond'] italic text-xl text-white/90 max-w-[24vw] leading-relaxed border-l border-white/30 pl-5",
          style: { left: '5vw' },
          text: trust.applicationQuote,
        },
        {
          kind: 'image',
          src: '/serenity5/hf_20260504_195637_36b88230-f7cc-4e8d-9daa-35cc8e416ad7.png',
          alt: 'Naming the unknown',
          pos: 'top-[4%] bottom-0',
          style: { left: '35vw', width: '35vw' },
          imgClassName: 'object-contain',
          revealed: true,
        },
        {
          kind: 'image',
          src: '/serenity5/hf_20260504_195644_c49ef0b9-8d32-494f-a4d4-f02484201831.png',
          alt: 'The next small step',
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
          text: trust.applicationBody2,
        },
        {
          kind: 'image',
          src: '/serenity5/hf_20260504_195806_6241875a-1034-4fe4-bf5c-90439a29804f.png',
          alt: 'Surrendered understanding',
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
          text: trust.prayerLabel,
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            "mb-elem mb-text absolute top-[24%] font-['Cormorant_Garamond'] italic text-white/90 max-w-[24vw] leading-[1.7]",
          style: { left: '5vw', fontSize: 'clamp(0.95rem, 1.6vw, 1.4rem)' },
          text: trust.prayerBody,
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'mb-elem absolute bottom-[3%] text-xs tracking-widest uppercase text-white/50',
          style: { left: '5vw' },
          text: trust.prayerCitation,
        },
        {
          kind: 'image',
          src: '/serenity5/hf_20260504_200030_b5f11ae6-25e4-448d-af8a-72e1de4f3cd7.png',
          alt: 'Rest in His wisdom',
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
          text: trust.titleIntro,
        },
        {
          kind: 'text',
          tag: 'h2',
          className: "font-['Cormorant_Garamond'] italic font-light text-white/90 leading-[0.9]",
          style: { fontSize: 'clamp(4rem, 18vw, 10rem)', paddingBottom: '0.18em' },
          text: { full: <>Trust</> },
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
          src: '/serenity5/IMG_3096.jpg',
          alt: 'The path made straight',
          className: '-mx-6 w-[calc(100%+3rem)] aspect-[2/3] mb-10',
        },
        {
          kind: 'text',
          tag: 'h3',
          className:
            "font-['Cormorant_Garamond'] italic font-light text-white/90 text-3xl leading-snug mb-8",
          text: trust.hookHeading,
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'text-sm text-white/60 leading-[1.85] mb-6',
          text: trust.hookBody1,
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'text-sm text-white/50 leading-[1.85]',
          text: trust.hookBody2,
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
          text: trust.scriptureLabel,
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'text-sm text-white/60 leading-[1.85] mb-8',
          text: trust.scriptureBody1,
        },
        {
          kind: 'image',
          src: '/serenity5/hf_20260503_234251_3f56432b-dfda-4ad8-9d48-ca863023bcf7.png',
          alt: "Solomon's charge",
          className: '-mx-6 w-[calc(100%+3rem)] aspect-[2/3] mb-8',
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'text-sm text-white/60 leading-[1.85] mb-8',
          text: trust.scriptureBody2,
        },
        {
          kind: 'image',
          src: '/serenity5/hf_20260503_234258_eef0f2e5-d23e-49f3-b4fc-35b0e5656e4e.png',
          alt: "Sha'an",
          className: '-mx-6 w-[calc(100%+3rem)] aspect-[3/4] mb-8',
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'text-sm text-white/60 leading-[1.85]',
          text: trust.straightPaths,
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
          src: '/serenity5/IMG_3135.jpg',
          alt: 'Midnight uncertainty',
          className: 'w-full aspect-[2/3]',
        },
        {
          kind: 'image',
          src: '/serenity5/hf_20260503_235857_64c6eb21-2eb5-4ec4-a44f-fad4abb52e92.png',
          alt: 'Level enough to walk',
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
          text: trust.principleLabel,
        },
        {
          kind: 'text',
          tag: 'h3',
          className:
            "font-['Cormorant_Garamond'] italic font-light text-white/85 text-2xl leading-snug mb-8",
          text: trust.principleHeading,
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'text-sm text-white/50 leading-[1.85] mb-10',
          text: trust.principleBody,
        },
        {
          kind: 'image',
          src: '/serenity5/hf_20260504_052134_398fd85d-0d00-44c9-a1f9-981ca3154bf4.png',
          alt: 'One step at a time',
          className: '-mx-6 w-[calc(100%+3rem)] aspect-[3/4]',
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
          text: trust.applicationLabel,
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'text-sm text-white/60 leading-[1.85] mb-8',
          text: trust.applicationBody1,
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            "font-['Cormorant_Garamond'] italic text-lg text-white/65 border-l border-white/20 pl-5 mb-8 leading-relaxed",
          text: trust.applicationQuote,
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'text-sm text-white/50 leading-[1.85] mb-10',
          text: trust.applicationBody2,
        },
        {
          kind: 'image',
          src: '/serenity5/hf_20260504_195637_36b88230-f7cc-4e8d-9daa-35cc8e416ad7.png',
          alt: 'Naming the unknown',
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
          text: trust.prayerLabel,
        },
        {
          kind: 'text',
          tag: 'p',
          className:
            "font-['Cormorant_Garamond'] italic text-lg text-white/65 leading-[1.7] max-w-sm mx-auto mb-12",
          text: trust.prayerBody,
        },
        {
          kind: 'image',
          src: '/serenity5/hf_20260504_200030_b5f11ae6-25e4-448d-af8a-72e1de4f3cd7.png',
          alt: 'Rest in His wisdom',
          className: '-mx-6 w-[calc(100%+3rem)] aspect-[2/3]',
        },
      ],
    },
  ],
};
