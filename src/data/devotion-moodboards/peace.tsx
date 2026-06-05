// Peace — Restoration of Peace (Psalm 23).
//
// One devotion, two art-directed arrangements (desktop `sections`, mobile
// `mobile`) sharing prose via SectionText {full, mobile?}. Geometry is verbatim
// data; the renderers in MoodBoard.tsx own the grammar. See ./_shared for the
// model + helpers. Zero visual change is the bar.
import type { DevotionMoodBoard, SectionText } from './_shared';

const peace = {
  titleIntro: {
    full: <>Let&rsquo;s take a moment and let God restore the peace in and around you.</>,
  },
  openingQuestion: {
    full: <>When was the last time you truly felt at rest?</>,
  },
  openingBody1: {
    full: (
      <>
        Not just asleep, but at rest&mdash;deep in your bones, quiet in your thoughts, unhurried in
        your spirit? For most of us, that kind of stillness feels like a distant memory. We carry
        tension in our shoulders before our feet even hit the floor in the morning.
      </>
    ),
  },
  openingBody2: {
    full: (
      <>
        We live in a world that rewards constant motion. Productivity is praised. Busyness is a
        badge. And somewhere along the way, rest became something we felt guilty about instead of
        something we were created for.
      </>
    ),
  },
  scriptureLabel: { full: <>The Scripture</> },
  scriptureBody1: {
    full: (
      <>
        David, the writer of Psalm 23, was no stranger to chaos. He had been hunted by a king,
        betrayed by friends, and burdened by war. Yet in the middle of all that turmoil, he wrote
        what may be the most peaceful passage in all of Scripture. He didn&rsquo;t write about rest
        from a place of leisure&mdash;he wrote about it from a place of lived experience with
        God&rsquo;s faithfulness.
      </>
    ),
    mobile: (
      <>
        David, the writer of Psalm 23, was no stranger to chaos. He had been hunted by a king,
        betrayed by friends, and burdened by war. Yet in the middle of all that turmoil, he wrote
        what may be the most peaceful passage in all of Scripture.
      </>
    ),
  },
  scriptureBody2: {
    full: (
      <>
        Notice the language: &ldquo;He makes me lie down.&rdquo; God doesn&rsquo;t suggest rest. He
        doesn&rsquo;t pencil it into our calendar if we have time. He makes us lie down. Like a
        shepherd who knows that an exhausted sheep will wander into danger, God sometimes brings us
        to a full stop because He knows what we need more than we do.
      </>
    ),
    mobile: (
      <>
        Notice the language: &ldquo;He makes me lie down.&rdquo; God doesn&rsquo;t suggest rest. He
        makes us lie down. Like a shepherd who knows that an exhausted sheep will wander into
        danger, God sometimes brings us to a full stop because He knows what we need more than we
        do.
      </>
    ),
  },
  quietWaters: {
    full: (
      <>
        And then He leads us beside &ldquo;quiet waters.&rdquo; Not raging rivers. Not crashing
        waves. Quiet waters. The Hebrew word for &ldquo;refreshes&rdquo; here is the word{' '}
        <em>shub</em>&mdash;which literally means &ldquo;to return&rdquo; or &ldquo;to
        restore.&rdquo; God&rsquo;s rest isn&rsquo;t just about stopping. It&rsquo;s about returning.
        Returning to the person you were before the anxiety took hold. Before the grief rewired your
        thinking. Before the burnout hollowed you out. God&rsquo;s restoration brings you back to
        wholeness.
      </>
    ),
    mobile: (
      <>
        And then He leads us beside &ldquo;quiet waters.&rdquo; Not raging rivers. Not crashing
        waves. Quiet waters. The Hebrew word for &ldquo;refreshes&rdquo; here is the word{' '}
        <em>shub</em>&mdash;which literally means &ldquo;to return&rdquo; or &ldquo;to
        restore.&rdquo; God&rsquo;s restoration brings you back to wholeness.
      </>
    ),
  },
  principleLabel: { full: <>The Timeless Principle</> },
  principleHeading: {
    full: (
      <>
        God&rsquo;s restoration begins not with doing more, but with allowing ourselves to be led
        into stillness.
      </>
    ),
  },
  principleBody: {
    full: (
      <>
        Peace is not the absence of problems; it is the presence of a Shepherd who knows exactly
        where to take us when we are depleted. Restoration of the soul starts when we stop striving
        and start trusting the One who never grows weary of caring for us.
      </>
    ),
    mobile: (
      <>
        Peace is not the absence of problems; it is the presence of a Shepherd who knows exactly
        where to take us when we are depleted.
      </>
    ),
  },
  applicationLabel: { full: <>The Application</> },
  applicationBody1: {
    full: (
      <>
        Maybe you&rsquo;re reading this in the middle of a packed schedule, on your phone between
        meetings, or late at night when the house is finally quiet. Wherever you are, consider this
        an invitation from your Shepherd. He is not asking you to earn rest&mdash;He is leading you
        to it.
      </>
    ),
  },
  applicationQuote: {
    full: <>&ldquo;Lord, lead me beside still waters. Refresh my soul.&rdquo;</>,
  },
  applicationBody2: {
    full: (
      <>
        Today, set aside just ten minutes. No phone. No agenda. No noise. Sit somewhere quiet and
        say it out loud. And then let Him. Don&rsquo;t rush it. Don&rsquo;t fill the silence with a
        to-do list. Just be led.
      </>
    ),
    mobile: (
      <>
        Today, set aside just ten minutes. No phone. No agenda. No noise. And then let Him.
        Don&rsquo;t rush it. Just be led.
      </>
    ),
  },
  prayerLabel: { full: <>A Prayer for Restoration</> },
  prayerBody: {
    full: (
      <>
        Lord, I confess that I have been running on empty. I have searched for rest in places that
        cannot give it. Today, I come to You, the Shepherd of my soul. Lead me to the green pastures
        and the quiet waters that only You can provide. Refresh what is weary in me. Restore what has
        been lost. Bring me back to wholeness, peace, and strength. I trust Your leading. Amen.
      </>
    ),
  },
  prayerCitation: { full: <>Psalm 23 &mdash; Restoration of Peace</> },
} satisfies Record<string, SectionText>;

export const peaceBoard: DevotionMoodBoard = {
  id: 'peace',
  purposeWord: 'Peace',
  sections: [
    /* ── Zone 1: Title ── */
    {
      role: 'title',
      width: '120vw',
      elements: [
        {
          kind: 'image',
          src: '/restoration1/image1.png',
          alt: 'Courtyard doorway',
          pos: 'top-[10%] left-[5%] w-[42vw] h-[78vh]',
          threshold: 0.05,
        },
        {
          kind: 'text',
          tag: 'h2',
          className:
            "mb-elem absolute bottom-[24%] left-[52%] font-['Cormorant_Garamond'] italic font-light leading-[0.85] tracking-tight text-white",
          style: { fontSize: 'clamp(5rem, 14vw, 16rem)' },
          text: { full: <>Peace</> },
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            'mb-elem mb-text absolute top-[18%] left-[52%] text-sm tracking-[0.15em] uppercase max-w-[280px] leading-relaxed text-white/70',
          text: peace.titleIntro,
        },
      ],
    },

    /* ── Zone 2: Opening ── */
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
          text: peace.openingQuestion,
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            'mb-elem mb-text absolute top-[46%] left-[5%] text-sm text-white/80 max-w-[280px] leading-[1.85] tracking-wide',
          text: peace.openingBody1,
        },
        {
          kind: 'image',
          src: '/restoration1/image2.png',
          alt: 'Serene bath with lush plants',
          pos: 'top-[5%] bottom-0 left-[28%] w-[50vw]',
          imgWrapClassName: 'w-full h-full object-cover',
          threshold: 0.05,
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            'mb-elem mb-text absolute top-[32%] left-[65%] text-sm text-white/70 max-w-[260px] leading-[1.85] tracking-wide',
          text: peace.openingBody2,
        },
        {
          kind: 'image',
          src: '/restoration1/image3.png',
          alt: 'Restoration detail',
          pos: 'top-[5%] bottom-0 right-[5%] w-[35vw]',
          imgClassName: 'object-contain',
          threshold: 0.05,
        },
      ],
    },

    /* ── Zone 3: Scripture ── */
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
          text: peace.scriptureLabel,
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            'mb-elem mb-text absolute top-[38%] text-sm text-white/80 max-w-[24vw] leading-[1.85] tracking-wide',
          style: { left: '3vw' },
          text: peace.scriptureBody1,
        },
        {
          kind: 'image',
          src: '/restoration1/image4.png',
          alt: 'Outdoor shower with plants',
          pos: 'top-[4%] bottom-0',
          style: { left: '35vw', width: '35vw' },
          imgClassName: 'object-contain',
          revealed: true,
        },
        {
          kind: 'image',
          src: '/restoration1/image5.png',
          alt: 'Shelf with mirror and bottles',
          pos: 'top-[4%] bottom-0',
          style: { left: '73vw', width: '35vw' },
          imgClassName: 'object-contain',
          revealed: true,
        },
        {
          kind: 'image',
          src: '/restoration1/image6.png',
          alt: 'Arch doorway with stone basin',
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
          text: peace.scriptureBody2,
        },
      ],
    },

    /* ── Zone 4: Principle ── */
    {
      role: 'principle',
      width: '200vw',
      bg: { mix: 85, toward: 'app-bg' },
      elements: [
        {
          kind: 'image',
          src: '/restoration1/image7.png',
          alt: 'Still waters',
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
          text: peace.quietWaters,
        },
        {
          kind: 'image',
          src: '/restoration1/image8.png',
          alt: 'Restoration detail',
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
          text: peace.principleLabel,
        },
        {
          kind: 'text',
          tag: 'h3',
          className:
            "mb-elem absolute top-[18%] font-['Cormorant_Garamond'] italic font-light text-white leading-[1.2] max-w-[34vw]",
          style: { left: '118vw', fontSize: 'clamp(1.5rem, 3.5vw, 3.5rem)' },
          text: peace.principleHeading,
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            'mb-elem mb-text absolute bottom-[18%] text-sm text-white/70 max-w-[340px] leading-[1.85] tracking-wide',
          style: { left: '118vw' },
          text: peace.principleBody,
        },
        {
          kind: 'image',
          src: '/restoration1/image9.png',
          alt: 'Restoration space',
          pos: 'top-[4%] bottom-0',
          style: { left: '155vw', width: '35vw' },
          imgClassName: 'object-contain',
          revealed: true,
        },
      ],
    },

    /* ── Zone 5: Application ── */
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
          text: peace.applicationLabel,
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            'mb-elem mb-text absolute top-[28%] text-sm text-white/80 max-w-[24vw] leading-[1.85] tracking-wide',
          style: { left: '5vw' },
          text: peace.applicationBody1,
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            "mb-elem mb-text absolute bottom-[28%] font-['Cormorant_Garamond'] italic text-xl text-white/90 max-w-[24vw] leading-relaxed border-l border-white/30 pl-5",
          style: { left: '5vw' },
          text: peace.applicationQuote,
        },
        {
          kind: 'image',
          src: '/restoration1/image10.png',
          alt: 'Application space',
          pos: 'top-[4%] bottom-0',
          style: { left: '35vw', width: '35vw' },
          imgClassName: 'object-contain',
          revealed: true,
        },
        {
          kind: 'image',
          src: '/restoration1/image11.png',
          alt: 'Peaceful retreat',
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
          text: peace.applicationBody2,
        },
        {
          kind: 'image',
          src: '/restoration1/image12.png',
          alt: 'Restoration moment',
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
          text: peace.prayerLabel,
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            "mb-elem mb-text absolute top-[24%] font-['Cormorant_Garamond'] italic text-white/90 max-w-[24vw] leading-[1.7]",
          style: { left: '5vw', fontSize: 'clamp(0.95rem, 1.6vw, 1.4rem)' },
          text: peace.prayerBody,
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'mb-elem absolute bottom-[8%] text-xs tracking-widest uppercase text-white/50',
          style: { left: '5vw' },
          text: peace.prayerCitation,
        },
        {
          kind: 'image',
          src: '/restoration1/image13.png',
          alt: 'Window nook with orchids',
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
          text: peace.titleIntro,
        },
        {
          kind: 'text',
          tag: 'h2',
          className: "font-['Cormorant_Garamond'] italic font-light text-white/90 leading-[0.9]",
          style: { fontSize: 'clamp(4rem, 18vw, 10rem)' },
          text: { full: <>Peace</> },
        },
        { kind: 'divider', className: 'w-10 h-px bg-white/20 mt-10' },
      ],
    },

    /* Opening */
    {
      role: 'opening',
      className: 'p-6 pb-16',
      bg: { mix: 85, toward: 'app-bg' },
      elements: [
        {
          kind: 'image',
          src: '/restoration1/image1.png',
          alt: 'Courtyard doorway',
          className: '-mx-6 w-[calc(100%+3rem)] aspect-[2/3] mb-10',
        },
        {
          kind: 'text',
          tag: 'h3',
          className:
            "font-['Cormorant_Garamond'] italic font-light text-white/90 text-3xl leading-snug mb-8",
          text: peace.openingQuestion,
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'text-sm text-white/60 leading-[1.85] mb-6',
          text: peace.openingBody1,
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'text-sm text-white/50 leading-[1.85]',
          text: peace.openingBody2,
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
          text: peace.scriptureLabel,
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'text-sm text-white/60 leading-[1.85] mb-8',
          text: peace.scriptureBody1,
        },
        {
          kind: 'image',
          src: '/restoration1/image4.png',
          alt: 'Outdoor shower',
          className: '-mx-6 w-[calc(100%+3rem)] aspect-[2/3] mb-8',
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'text-sm text-white/60 leading-[1.85] mb-8',
          text: peace.scriptureBody2,
        },
        {
          kind: 'image',
          src: '/restoration1/image11.png',
          alt: 'Stone bed',
          className: '-mx-6 w-[calc(100%+3rem)] aspect-video mb-8',
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'text-sm text-white/60 leading-[1.85]',
          text: peace.quietWaters,
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
          src: '/restoration1/image2.png',
          alt: 'Bath with plants',
          className: 'w-full aspect-[2/3]',
        },
        {
          kind: 'image',
          src: '/restoration1/image6.png',
          alt: 'Warm sauna',
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
          text: peace.principleLabel,
        },
        {
          kind: 'text',
          tag: 'h3',
          className:
            "font-['Cormorant_Garamond'] italic font-light text-white/85 text-2xl leading-snug mb-8",
          text: peace.principleHeading,
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'text-sm text-white/50 leading-[1.85] mb-10',
          text: peace.principleBody,
        },
        {
          kind: 'image',
          src: '/restoration1/image8.png',
          alt: 'Tranquil pool',
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
          text: peace.applicationLabel,
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'text-sm text-white/60 leading-[1.85] mb-8',
          text: peace.applicationBody1,
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            "font-['Cormorant_Garamond'] italic text-lg text-white/65 border-l border-white/20 pl-5 mb-8 leading-relaxed",
          text: peace.applicationQuote,
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'text-sm text-white/50 leading-[1.85] mb-10',
          text: peace.applicationBody2,
        },
        {
          kind: 'image',
          src: '/restoration1/image12.png',
          alt: 'Resting couch',
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
          text: peace.prayerLabel,
        },
        {
          kind: 'text',
          tag: 'p',
          className:
            "font-['Cormorant_Garamond'] italic text-lg text-white/65 leading-[1.7] max-w-sm mx-auto mb-12",
          text: peace.prayerBody,
        },
        {
          kind: 'image',
          src: '/restoration1/image7.png',
          alt: 'Peaceful nook',
          className: '-mx-6 w-[calc(100%+3rem)] aspect-[2/3]',
        },
      ],
    },
  ],
};
