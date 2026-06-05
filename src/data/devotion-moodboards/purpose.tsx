// Purpose — Restoration of Purpose (Romans 8:28).
//
// One devotion, two art-directed arrangements (desktop `sections`, mobile
// `mobile`) sharing prose via SectionText {full, mobile?}. Geometry is verbatim
// data; the renderers in MoodBoard.tsx own the grammar. See ./_shared for the
// model + helpers. Zero visual change is the bar.
import type { DevotionMoodBoard, SectionText } from './_shared';

const purpose = {
  titleIntro: {
    full: (
      <>Let&rsquo;s explore the chapters you cannot yet read, and the Author who wastes nothing.</>
    ),
  },
  openingHeading: { full: <>When your story has lost its plot.</> },
  openingBody1: {
    full: (
      <>
        There are seasons in life when nothing seems to make sense. The job loss that came out of
        nowhere. The relationship that fell apart despite every effort to save it. The illness that
        arrived uninvited and overstayed its welcome. In those seasons, purpose feels like the first
        thing to disappear.
      </>
    ),
    mobile: (
      <>
        There are seasons in life when nothing seems to make sense. The job loss that came out of
        nowhere. The relationship that fell apart despite every effort to save it. The illness that
        arrived uninvited and overstayed its welcome. In those seasons, purpose feels like the first
        thing to disappear. You start to wonder: What is the point of all this suffering? Is God
        doing anything with my pain, or am I just surviving for no reason?
      </>
    ),
  },
  openingBody2: {
    full: (
      <>
        You start to wonder: What is the point of all this suffering? Is God doing anything with my
        pain, or am I just surviving for no reason? The most disorienting part of loss is not the
        loss itself&mdash;it is the feeling that your story has lost its plot. That the chapters are
        no longer building toward anything meaningful.
      </>
    ),
    mobile: (
      <>
        The most disorienting part of loss is not the loss itself&mdash;it is the feeling that your
        story has lost its plot. That the chapters are no longer building toward anything meaningful.
      </>
    ),
  },
  scriptureLabel: { full: <>The Scripture</> },
  scriptureBody1: {
    full: (
      <>
        Romans 8:28 is one of the most quoted&mdash;and most misunderstood&mdash;verses in the
        Bible. It is not a promise that everything that happens to us is good. Paul does not say
        &ldquo;all things are good.&rdquo; He says God works{' '}
        <em className="not-italic font-['Cormorant_Garamond'] italic">in</em> all things{' '}
        <em className="not-italic font-['Cormorant_Garamond'] italic">for</em> good. The distinction
        is critical. God is not the author of your suffering; He is the Redeemer of it.
      </>
    ),
  },
  scriptureBody2: {
    full: (
      <>
        The word &ldquo;works&rdquo; here is the Greek word{' '}
        <em className="not-italic font-['Cormorant_Garamond'] italic">synergei</em>&mdash;from which
        we get the English word &ldquo;synergy.&rdquo; It suggests God actively collaborating with
        the circumstances of our lives, combining even the painful ones into a coherent, purposeful
        narrative. And notice the scope: not some things.{' '}
        <em className="not-italic font-['Cormorant_Garamond'] italic">All</em> things. The betrayal,
        the failure, the loss, the waiting&mdash;none of it is wasted in God&rsquo;s economy.
      </>
    ),
    mobile: (
      <>
        The word &ldquo;works&rdquo; here is the Greek word{' '}
        <em className="not-italic font-['Cormorant_Garamond'] italic">synergei</em>&mdash;from which
        we get the English word &ldquo;synergy.&rdquo; It suggests God actively collaborating with
        the circumstances of our lives, combining even the painful ones into a coherent, purposeful
        narrative. And notice the scope: not some things. All things. The betrayal, the failure, the
        loss, the waiting&mdash;none of it is wasted in God&rsquo;s economy.
      </>
    ),
  },
  conformedBody: {
    full: (
      <>
        Paul then reveals the ultimate purpose: to be &ldquo;conformed to the image of his
        Son.&rdquo; God&rsquo;s restoration of purpose is not about making our lives comfortable. It
        is about making us more like Christ. Every hard season is shaping something eternal in us.
      </>
    ),
  },
  principleLabel: { full: <>The Timeless Principle</> },
  principleHeading: { full: <>God does not waste suffering.</> },
  principleBody: {
    full: (
      <>
        The restoration of purpose does not mean every chapter will be painless&mdash;it means every
        chapter is being authored with intention. What feels like a meaningless detour in the moment
        is often the very road God uses to shape us into who He created us to be. Purpose is not
        found in the absence of hardship but in the presence of a God who redeems every broken piece.
      </>
    ),
  },
  applicationLabel: { full: <>The Application</> },
  applicationBody1: {
    full: (
      <>
        Think of the season in your life that felt the most purposeless&mdash;the one where you
        wondered if God had forgotten the plot of your story. Now ask yourself: did anything good
        grow from that ground? A deeper compassion? A stronger faith? A relationship that would not
        have existed otherwise? God may not have caused the pain, but He has been working in it all
        along.
      </>
    ),
  },
  applicationQuote: {
    full: (
      <>&ldquo;God is always building something, even when we cannot see the blueprint.&rdquo;</>
    ),
  },
  applicationBody2: {
    full: (
      <>
        Today, take one area of your life that currently feels purposeless or painful and
        consciously surrender it to God&rsquo;s authorship. Say out loud: &ldquo;Lord, I do not
        understand this chapter. But I trust that You are working all things together for good.
        Restore my sense of purpose. Show me what You are building.&rdquo; And then watch.
      </>
    ),
  },
  prayerLabel: { full: <>A Prayer for Restoration</> },
  prayerBody: {
    full: (
      <>
        Father, I confess that I have questioned Your purposes. There are chapters in my story that I
        do not understand&mdash;seasons that felt wasted, pain that seemed pointless. But I choose
        today to trust that You are working in all things. Nothing in my life is outside Your reach
        or beyond Your ability to redeem. Restore my sense of purpose, Lord. Help me to see that even
        the hardest seasons are shaping me into the image of Your Son. I surrender the chapters I do
        not understand to You, the Author who wastes nothing. Amen.
      </>
    ),
  },
  prayerCitation: { full: <>Romans 8:28 &mdash; Restoration of Purpose</> },
} satisfies Record<string, SectionText>;

export const purposeBoard: DevotionMoodBoard = {
  id: 'purpose',
  purposeWord: 'Purpose',
  sections: [
    /* ── Zone 1: Purpose Title ── */
    {
      role: 'title',
      width: '120vw',
      elements: [
        {
          kind: 'image',
          src: '/restoration7/hf_20260415_190342_341ba0fb-3636-4645-aa20-40f7c56ecf5c.png',
          alt: 'Purpose woven',
          pos: 'top-[10%] left-[5%] w-[42vw] h-[78vh]',
          threshold: 0.05,
        },
        {
          kind: 'text',
          tag: 'h2',
          className:
            "mb-elem absolute bottom-[24%] left-[52%] font-['Cormorant_Garamond'] italic font-light leading-[0.85] tracking-tight text-white",
          style: { fontSize: 'clamp(5rem, 14vw, 16rem)', paddingBottom: '0.22em' },
          text: { full: <>Purpose</> },
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            'mb-elem mb-text absolute top-[18%] left-[52%] text-sm tracking-[0.15em] uppercase max-w-[280px] leading-relaxed text-white/70',
          text: purpose.titleIntro,
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
          text: purpose.openingHeading,
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            'mb-elem mb-text absolute top-[46%] left-[5%] text-sm text-white/80 max-w-[280px] leading-[1.85] tracking-wide',
          text: purpose.openingBody1,
        },
        {
          kind: 'image',
          src: '/restoration7/hf_20260416_064731_22fb4afb-4e63-4379-abef-96acc59a5670.png',
          alt: 'Disorienting season',
          pos: 'top-[5%] bottom-0 left-[28%] w-[50vw]',
          imgWrapClassName: 'w-full h-full object-cover',
          threshold: 0.05,
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            'mb-elem mb-text absolute top-[32%] left-[65%] text-sm text-white/70 max-w-[260px] leading-[1.85] tracking-wide',
          text: purpose.openingBody2,
        },
        {
          kind: 'image',
          src: '/restoration7/hf_20260416_070309_7bc88c2a-8b61-45bb-8f06-0b0f971570b2.png',
          alt: 'Lost plot',
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
          text: purpose.scriptureLabel,
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            'mb-elem mb-text absolute top-[38%] text-sm text-white/80 max-w-[24vw] leading-[1.85] tracking-wide',
          style: { left: '3vw' },
          text: purpose.scriptureBody1,
        },
        {
          kind: 'image',
          src: '/restoration7/hf_20260416_071506_2111840c-d053-4190-b428-0208a1c30f2c.png',
          alt: 'Fractured pieces',
          pos: 'top-[4%] bottom-0',
          style: { left: '35vw', width: '35vw' },
          imgClassName: 'object-contain',
          revealed: true,
        },
        {
          kind: 'image',
          src: '/restoration7/hf_20260416_071544_9c8f9c5b-6a58-4f49-babb-c7ef76834478.png',
          alt: 'Synergy',
          pos: 'top-[4%] bottom-0',
          style: { left: '73vw', width: '35vw' },
          imgClassName: 'object-contain',
          revealed: true,
        },
        {
          kind: 'image',
          src: '/restoration7/hf_20260416_072744_90bc91ef-7ad6-4cdf-8316-fd216b5fdada.png',
          alt: 'Conformed',
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
          text: purpose.scriptureBody2,
        },
      ],
    },

    /* ── Zone 4: Conformed + Timeless Principle ── */
    {
      role: 'principle',
      width: '200vw',
      bg: { mix: 85, toward: 'app-bg' },
      elements: [
        {
          kind: 'image',
          src: '/restoration7/hf_20260424_195608_12a72225-2d69-48e8-941f-b0fcf617f9fc.png',
          alt: 'Image of his Son',
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
          text: purpose.conformedBody,
        },
        {
          kind: 'image',
          src: '/restoration7/hf_20260424_203154_95194a66-1867-4cd1-86fd-3d3b345047c1.png',
          alt: 'Eternal shaping',
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
          text: purpose.principleLabel,
        },
        {
          kind: 'text',
          tag: 'h3',
          className:
            "mb-elem absolute top-[18%] font-['Cormorant_Garamond'] italic font-light text-white leading-[1.2] max-w-[34vw]",
          style: { left: '118vw', fontSize: 'clamp(1.5rem, 3.5vw, 3.5rem)' },
          text: purpose.principleHeading,
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            'mb-elem mb-text absolute bottom-[18%] text-sm text-white/70 max-w-[340px] leading-[1.85] tracking-wide',
          style: { left: '118vw' },
          text: purpose.principleBody,
        },
        {
          kind: 'image',
          src: '/restoration7/hf_20260424_203247_ad629581-e993-4cae-9039-7faacb786d86.png',
          alt: 'Authored chapter',
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
          text: purpose.applicationLabel,
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            'mb-elem mb-text absolute top-[28%] text-sm text-white/80 max-w-[24vw] leading-[1.85] tracking-wide',
          style: { left: '5vw' },
          text: purpose.applicationBody1,
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            "mb-elem mb-text absolute bottom-[15%] font-['Cormorant_Garamond'] italic text-xl text-white/90 max-w-[24vw] leading-relaxed border-l border-white/30 pl-5",
          style: { left: '5vw' },
          text: purpose.applicationQuote,
        },
        {
          kind: 'image',
          src: '/restoration7/hf_20260424_203428_5f629add-9aba-4535-af57-faf03aee14d9.png',
          alt: 'Surrendering to authorship',
          pos: 'top-[4%] bottom-0',
          style: { left: '35vw', width: '35vw' },
          imgClassName: 'object-contain',
          revealed: true,
        },
        {
          kind: 'image',
          src: '/restoration7/hf_20260424_203843_58e19d09-c2b8-459c-893c-3b611752f7ca.png',
          alt: 'Watching for God',
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
          text: purpose.applicationBody2,
        },
        {
          kind: 'image',
          src: '/restoration7/hf_20260424_203937_c76b655e-dc8d-48cf-9af1-43b580f9e054.png',
          alt: 'Blueprint unfolding',
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
          text: purpose.prayerLabel,
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            "mb-elem mb-text absolute top-[24%] font-['Cormorant_Garamond'] italic text-white/90 max-w-[24vw] leading-[1.7]",
          style: { left: '5vw', fontSize: 'clamp(0.95rem, 1.6vw, 1.4rem)' },
          text: purpose.prayerBody,
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'mb-elem absolute bottom-[3%] text-xs tracking-widest uppercase text-white/50',
          style: { left: '5vw' },
          text: purpose.prayerCitation,
        },
        {
          kind: 'image',
          src: '/restoration7/hf_20260424_204928_6beb6487-8f23-4b65-8f23-733d706d309d.png',
          alt: 'Author of all things',
          pos: 'top-[4%] bottom-0',
          style: { left: '35vw', width: '55vw' },
          imgClassName: 'object-contain',
          revealed: true,
        },
      ],
    },
  ],

  mobile: [
    /* Purpose Title */
    {
      role: 'title',
      className: 'min-h-screen p-6 flex flex-col items-center justify-center text-center',
      elements: [
        {
          kind: 'text',
          tag: 'p',
          className: 'text-sm tracking-[0.2em] uppercase text-white/45 mb-8 max-w-xs',
          text: purpose.titleIntro,
        },
        {
          kind: 'text',
          tag: 'h2',
          className: "font-['Cormorant_Garamond'] italic font-light text-white/90 leading-[0.9]",
          style: { fontSize: 'clamp(4rem, 18vw, 10rem)', paddingBottom: '0.18em' },
          text: { full: <>Purpose</> },
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
          src: '/restoration7/hf_20260415_190342_341ba0fb-3636-4645-aa20-40f7c56ecf5c.png',
          alt: 'Purpose woven',
          className: '-mx-6 w-[calc(100%+3rem)] aspect-[2/3] mb-10',
        },
        {
          kind: 'text',
          tag: 'h3',
          className:
            "font-['Cormorant_Garamond'] italic font-light text-white/90 text-3xl leading-snug mb-8",
          text: purpose.openingHeading,
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'text-sm text-white/60 leading-[1.85] mb-6',
          text: purpose.openingBody1,
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'text-sm text-white/50 leading-[1.85]',
          text: purpose.openingBody2,
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
          text: purpose.scriptureLabel,
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'text-sm text-white/60 leading-[1.85] mb-8',
          text: purpose.scriptureBody1,
        },
        {
          kind: 'image',
          src: '/restoration7/hf_20260416_071506_2111840c-d053-4190-b428-0208a1c30f2c.png',
          alt: 'Fractured pieces',
          className: '-mx-6 w-[calc(100%+3rem)] aspect-[2/3] mb-8',
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'text-sm text-white/60 leading-[1.85] mb-8',
          text: purpose.scriptureBody2,
        },
        {
          kind: 'image',
          src: '/restoration7/hf_20260416_071544_9c8f9c5b-6a58-4f49-babb-c7ef76834478.png',
          alt: 'Synergy',
          className: '-mx-6 w-[calc(100%+3rem)] aspect-video mb-8',
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'text-sm text-white/60 leading-[1.85]',
          text: purpose.conformedBody,
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
          src: '/restoration7/hf_20260416_064731_22fb4afb-4e63-4379-abef-96acc59a5670.png',
          alt: 'Disorienting season',
          className: 'w-full aspect-[2/3]',
        },
        {
          kind: 'image',
          src: '/restoration7/hf_20260424_195608_12a72225-2d69-48e8-941f-b0fcf617f9fc.png',
          alt: 'Image of his Son',
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
          text: purpose.principleLabel,
        },
        {
          kind: 'text',
          tag: 'h3',
          className:
            "font-['Cormorant_Garamond'] italic font-light text-white/85 text-2xl leading-snug mb-8",
          text: purpose.principleHeading,
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'text-sm text-white/50 leading-[1.85] mb-10',
          text: purpose.principleBody,
        },
        {
          kind: 'image',
          src: '/restoration7/hf_20260424_203154_95194a66-1867-4cd1-86fd-3d3b345047c1.png',
          alt: 'Eternal shaping',
          className: '-mx-6 w-[calc(100%+3rem)] aspect-[2/3]',
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
          text: purpose.applicationLabel,
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'text-sm text-white/60 leading-[1.85] mb-8',
          text: purpose.applicationBody1,
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            "font-['Cormorant_Garamond'] italic text-lg text-white/65 border-l border-white/20 pl-5 mb-8 leading-relaxed",
          text: purpose.applicationQuote,
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'text-sm text-white/50 leading-[1.85] mb-10',
          text: purpose.applicationBody2,
        },
        {
          kind: 'image',
          src: '/restoration7/hf_20260424_203428_5f629add-9aba-4535-af57-faf03aee14d9.png',
          alt: 'Surrendering to authorship',
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
          text: purpose.prayerLabel,
        },
        {
          kind: 'text',
          tag: 'p',
          className:
            "font-['Cormorant_Garamond'] italic text-lg text-white/65 leading-[1.7] max-w-sm mx-auto mb-12",
          text: purpose.prayerBody,
        },
        {
          kind: 'image',
          src: '/restoration7/hf_20260424_204928_6beb6487-8f23-4b65-8f23-733d706d309d.png',
          alt: 'Author of all things',
          className: '-mx-6 w-[calc(100%+3rem)] aspect-[2/3]',
        },
      ],
    },
  ],
};
