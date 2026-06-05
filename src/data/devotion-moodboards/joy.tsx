// Joy — Restoration of Joy (Psalm 126).
//
// One devotion, two art-directed arrangements (desktop `sections`, mobile
// `mobile`) sharing prose via SectionText {full, mobile?}. Geometry is verbatim
// data; the renderers in MoodBoard.tsx own the grammar. See ./_shared for the
// model + helpers. Zero visual change is the bar.
import type { DevotionMoodBoard, SectionText } from './_shared';

const joy = {
  titleIntro: {
    full: <>Let&rsquo;s explore the harvest of singing that grows in the soil of tears.</>,
  },
  openingQuestion: {
    full: <>When was the last time you really laughed?</>,
  },
  openingBody1: {
    full: (
      <>
        Can you remember the last time you laughed&mdash;really laughed? Not a polite chuckle or a
        quick smile at a text, but the kind of laughter that comes from somewhere deep, the kind
        that makes your eyes water and your chest ache in the best way? For some of us, that kind of
        joy feels like it belongs to a different version of ourselves&mdash;the person we were
        before the diagnosis, before the divorce, before the season that stripped us down to the
        studs.
      </>
    ),
  },
  openingBody2: {
    full: (
      <>
        Joy is one of the first casualties of prolonged hardship. It doesn&rsquo;t leave all at
        once. It fades slowly, like color draining from a photograph, until one day you realize you
        can&rsquo;t remember what it felt like to be light. And you begin to wonder: will it ever
        come back?
      </>
    ),
  },
  scriptureLabel: { full: <>The Scripture</> },
  scriptureBody1: {
    full: (
      <>
        Psalm 126 is a song written by the Israelites after they returned from decades of exile in
        Babylon. For seventy years, they had lived as captives in a foreign land, stripped of their
        homeland, their temple, and their way of life. And then, almost impossibly, God brought them
        home. The psalmist describes that moment of return with breathtaking language: &ldquo;We
        were like those who dreamed.&rdquo;
      </>
    ),
  },
  scriptureBody2: {
    full: (
      <>
        And what was the first sign of their restoration? Laughter. Songs of joy. Not careful
        optimism. Not cautious gratitude. Uncontainable, overflowing, mouth-filling joy. Even the
        surrounding nations took notice and said, &ldquo;The Lord has done great things for
        them.&rdquo;
      </>
    ),
  },
  negevPrayer: {
    full: (
      <>
        But the psalm doesn&rsquo;t end there. The writer then shifts to a prayer: &ldquo;Restore
        our fortunes, Lord, like streams in the Negev.&rdquo; The Negev is the southern desert of
        Israel&mdash;dry, barren, seemingly lifeless. But when the rains come, dry riverbeds called{' '}
        <em className="not-italic font-['Cormorant_Garamond'] italic">wadis</em> suddenly rush with
        water, and the desert blooms almost overnight. That is the image God gives us for restored
        joy: what looks completely dead can burst to life in a single season of His faithfulness.
      </>
    ),
    mobile: (
      <>
        But the psalm doesn&rsquo;t end there. The writer shifts to a prayer: &ldquo;Restore our
        fortunes, Lord, like streams in the Negev.&rdquo; The Negev is the southern desert of
        Israel&mdash;dry, barren, seemingly lifeless. But when the rains come, dry riverbeds called{' '}
        <em className="not-italic font-['Cormorant_Garamond'] italic">wadis</em> suddenly rush with
        water, and the desert blooms almost overnight.
      </>
    ),
  },
  principleLabel: { full: <>The Timeless Principle</> },
  principleHeading: {
    full: <>The season of weeping is not the final chapter.</>,
  },
  principleBody: {
    full: (
      <>
        God does not waste our tears&mdash;He transforms them into a harvest. Restored joy is not
        the absence of sorrow; it is the gift that grows in the very soil that sorrow tilled. The
        tears we shed in our hardest seasons are seeds, and God promises that every one of them will
        yield a return of singing.
      </>
    ),
  },
  applicationLabel: { full: <>The Application</> },
  applicationBody1: {
    full: (
      <>
        If joy has become a stranger to you, know this: its absence is not permanent. God is in the
        business of turning deserts into rivers and weeping into singing. Today, take one small step
        back toward joy. Put on a song that used to make your spirit come alive. Call someone who
        makes you laugh. Step outside and feel the sun on your face.
      </>
    ),
  },
  applicationQuote: {
    full: <>&ldquo;The harvest is coming.&rdquo;</>,
  },
  applicationBody2: {
    full: (
      <>
        These are not trivial acts&mdash;they are acts of faith, declaring that the season of sowing
        tears is giving way to the season of reaping songs. And if you&rsquo;re not there yet, if
        the tears are still falling, hold on to the promise: &ldquo;Those who go out weeping,
        carrying seed to sow, will return with songs of joy, carrying sheaves with them.&rdquo;
      </>
    ),
  },
  prayerLabel: { full: <>A Prayer for Restoration</> },
  prayerBody: {
    full: (
      <>
        Lord, I have been living in a dry season. Joy feels distant, and laughter feels foreign. But
        I know that You are the God who sends streams through the desert. I bring You my tears
        today&mdash;not as evidence of defeat, but as seeds of faith. I trust that You will turn my
        mourning into dancing and fill my mouth with laughter again. Restore the joy of my
        salvation, Lord. Let the nations&mdash;and my own weary heart&mdash;see what You have done.
        Amen.
      </>
    ),
  },
  prayerCitation: { full: <>Psalm 126:1&ndash;2 &mdash; Restoration of Joy</> },
} satisfies Record<string, SectionText>;

export const joyBoard: DevotionMoodBoard = {
  id: 'joy',
  purposeWord: 'Joy',
  sections: [
    /* ── Zone 1: Joy Title ── */
    {
      role: 'title',
      width: '120vw',
      elements: [
        {
          kind: 'image',
          src: '/restoration10/hf_20260417_160036_8cfcbbb9-be3c-41e1-90be-3a356eb8955c.png',
          alt: 'Streams in the Negev',
          pos: 'top-[10%] left-[5%] w-[42vw] h-[78vh]',
          threshold: 0.05,
        },
        {
          kind: 'text',
          tag: 'h2',
          className:
            "mb-elem absolute bottom-[24%] left-[52%] font-['Cormorant_Garamond'] italic font-light leading-[0.85] tracking-tight text-white",
          style: { fontSize: 'clamp(5rem, 14vw, 16rem)', paddingBottom: '0.22em' },
          text: { full: <>Joy</> },
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            'mb-elem mb-text absolute top-[18%] left-[52%] text-sm tracking-[0.15em] uppercase max-w-[280px] leading-relaxed text-white/70',
          text: joy.titleIntro,
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
          text: joy.openingQuestion,
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            'mb-elem mb-text absolute top-[46%] left-[5%] text-sm text-white/80 max-w-[280px] leading-[1.85] tracking-wide',
          text: joy.openingBody1,
        },
        {
          kind: 'image',
          src: '/restoration10/hf_20260417_160342_b426e452-1743-40ff-b739-089f5f1e59e4.png',
          alt: 'Color draining',
          pos: 'top-[5%] bottom-0 left-[28%] w-[50vw]',
          imgWrapClassName: 'w-full h-full object-cover',
          threshold: 0.05,
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            'mb-elem mb-text absolute top-[32%] left-[65%] text-sm text-white/70 max-w-[260px] leading-[1.85] tracking-wide',
          text: joy.openingBody2,
        },
        {
          kind: 'image',
          src: '/restoration10/hf_20260417_161445_d7a1bff7-ffb7-48fe-bc41-a67e4712319b.png',
          alt: 'Faded photograph',
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
          text: joy.scriptureLabel,
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            'mb-elem mb-text absolute top-[38%] text-sm text-white/80 max-w-[24vw] leading-[1.85] tracking-wide',
          style: { left: '3vw' },
          text: joy.scriptureBody1,
        },
        {
          kind: 'image',
          src: '/restoration10/hf_20260417_161709_3d94e62d-3112-4db0-93cd-a8e06d8f7376.png',
          alt: 'Like those who dreamed',
          pos: 'top-[4%] bottom-0',
          style: { left: '35vw', width: '35vw' },
          imgClassName: 'object-contain',
          revealed: true,
        },
        {
          kind: 'image',
          src: '/restoration10/hf_20260417_162007_2bea4cf3-9b4b-4886-946f-06536f464d08.png',
          alt: 'Mouth-filling joy',
          pos: 'top-[4%] bottom-0',
          style: { left: '73vw', width: '35vw' },
          imgClassName: 'object-contain',
          revealed: true,
        },
        {
          kind: 'image',
          src: '/restoration10/hf_20260417_165704_e7b2ba90-c2ee-47f2-a57c-2975e747b8cf.png',
          alt: 'Songs of joy',
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
          text: joy.scriptureBody2,
        },
      ],
    },

    /* ── Zone 4: Streams in the Negev + Timeless Principle ── */
    {
      role: 'principle',
      width: '200vw',
      bg: { mix: 85, toward: 'app-bg' },
      elements: [
        {
          kind: 'image',
          src: '/restoration10/hf_20260417_170545_fb1ef716-8275-4ba1-99c4-7f1a9262d680.png',
          alt: 'Wadis flowing',
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
          text: joy.negevPrayer,
        },
        {
          kind: 'image',
          src: '/restoration10/hf_20260502_013116_95da236a-b587-42d8-a38a-997e28331415.png',
          alt: 'Desert blooms',
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
          text: joy.principleLabel,
        },
        {
          kind: 'text',
          tag: 'h3',
          className:
            "mb-elem absolute top-[18%] font-['Cormorant_Garamond'] italic font-light text-white leading-[1.2] max-w-[34vw]",
          style: { left: '118vw', fontSize: 'clamp(1.5rem, 3.5vw, 3.5rem)' },
          text: joy.principleHeading,
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            'mb-elem mb-text absolute bottom-[18%] text-sm text-white/70 max-w-[340px] leading-[1.85] tracking-wide',
          style: { left: '118vw' },
          text: joy.principleBody,
        },
        {
          kind: 'image',
          src: '/restoration10/hf_20260502_013119_28d06366-03f0-4f4f-8dcb-749ff44e4bc2.png',
          alt: 'Harvest of singing',
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
          text: joy.applicationLabel,
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            'mb-elem mb-text absolute top-[28%] text-sm text-white/80 max-w-[24vw] leading-[1.85] tracking-wide',
          style: { left: '5vw' },
          text: joy.applicationBody1,
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            "mb-elem mb-text absolute bottom-[15%] font-['Cormorant_Garamond'] italic text-xl text-white/90 max-w-[24vw] leading-relaxed border-l border-white/30 pl-5",
          style: { left: '5vw' },
          text: joy.applicationQuote,
        },
        {
          kind: 'image',
          src: '/restoration10/hf_20260502_013411_c6aa1e17-c02e-484b-96da-e553e559d225.png',
          alt: 'Song that comes alive',
          pos: 'top-[4%] bottom-0',
          style: { left: '35vw', width: '35vw' },
          imgClassName: 'object-contain',
          revealed: true,
        },
        {
          kind: 'image',
          src: '/restoration10/hf_20260502_013636_fc7d80bf-5d20-46f9-8f72-26f5d82f1d8e.png',
          alt: 'Sun on your face',
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
          text: joy.applicationBody2,
        },
        {
          kind: 'image',
          src: '/restoration10/hf_20260424_202713_1125e681-9649-4065-bcfb-da5f11a7ae3c.png',
          alt: 'Carrying sheaves',
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
          text: joy.prayerLabel,
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            "mb-elem mb-text absolute top-[24%] font-['Cormorant_Garamond'] italic text-white/90 max-w-[24vw] leading-[1.7]",
          style: { left: '5vw', fontSize: 'clamp(0.95rem, 1.6vw, 1.4rem)' },
          text: joy.prayerBody,
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'mb-elem absolute bottom-[3%] text-xs tracking-widest uppercase text-white/50',
          style: { left: '5vw' },
          text: joy.prayerCitation,
        },
        {
          kind: 'image',
          src: '/restoration10/hf_20260502_080118_326dd430-55e2-47ff-b2be-50dd32a716b4.png',
          alt: 'Mourning into dancing',
          pos: 'top-[4%] bottom-0',
          style: { left: '35vw', width: '55vw' },
          imgClassName: 'object-contain',
          revealed: true,
        },
      ],
    },
  ],

  mobile: [
    /* Joy Title */
    {
      role: 'title',
      className: 'min-h-screen p-6 flex flex-col items-center justify-center text-center',
      elements: [
        {
          kind: 'text',
          tag: 'p',
          className: 'text-sm tracking-[0.2em] uppercase text-white/45 mb-8 max-w-xs',
          text: joy.titleIntro,
        },
        {
          kind: 'text',
          tag: 'h2',
          className: "font-['Cormorant_Garamond'] italic font-light text-white/90 leading-[0.9]",
          style: { fontSize: 'clamp(4rem, 18vw, 10rem)', paddingBottom: '0.18em' },
          text: { full: <>Joy</> },
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
          src: '/restoration10/hf_20260417_160036_8cfcbbb9-be3c-41e1-90be-3a356eb8955c.png',
          alt: 'Streams in the Negev',
          className: '-mx-6 w-[calc(100%+3rem)] aspect-[2/3] mb-10',
        },
        {
          kind: 'text',
          tag: 'h3',
          className:
            "font-['Cormorant_Garamond'] italic font-light text-white/90 text-3xl leading-snug mb-8",
          text: joy.openingQuestion,
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'text-sm text-white/60 leading-[1.85] mb-6',
          text: joy.openingBody1,
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'text-sm text-white/50 leading-[1.85]',
          text: joy.openingBody2,
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
          text: joy.scriptureLabel,
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'text-sm text-white/60 leading-[1.85] mb-8',
          text: joy.scriptureBody1,
        },
        {
          kind: 'image',
          src: '/restoration10/hf_20260424_202713_1125e681-9649-4065-bcfb-da5f11a7ae3c.png',
          alt: 'Like those who dreamed',
          className: '-mx-6 w-[calc(100%+3rem)] aspect-[2/3] mb-8',
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'text-sm text-white/60 leading-[1.85] mb-8',
          text: joy.scriptureBody2,
        },
        {
          kind: 'image',
          src: '/restoration10/hf_20260417_161709_3d94e62d-3112-4db0-93cd-a8e06d8f7376.png',
          alt: 'Mouth-filling joy',
          className: '-mx-6 w-[calc(100%+3rem)] aspect-video mb-8',
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'text-sm text-white/60 leading-[1.85]',
          text: joy.negevPrayer,
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
          src: '/restoration10/hf_20260417_160342_b426e452-1743-40ff-b739-089f5f1e59e4.png',
          alt: 'Color draining',
          className: 'w-full aspect-[2/3]',
        },
        {
          kind: 'image',
          src: '/restoration10/hf_20260417_170545_fb1ef716-8275-4ba1-99c4-7f1a9262d680.png',
          alt: 'Wadis flowing',
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
          text: joy.principleLabel,
        },
        {
          kind: 'text',
          tag: 'h3',
          className:
            "font-['Cormorant_Garamond'] italic font-light text-white/85 text-2xl leading-snug mb-8",
          text: joy.principleHeading,
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'text-sm text-white/50 leading-[1.85] mb-10',
          text: joy.principleBody,
        },
        {
          kind: 'image',
          src: '/restoration10/hf_20260417_161445_d7a1bff7-ffb7-48fe-bc41-a67e4712319b.png',
          alt: 'Desert blooms',
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
          text: joy.applicationLabel,
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'text-sm text-white/60 leading-[1.85] mb-8',
          text: joy.applicationBody1,
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            "font-['Cormorant_Garamond'] italic text-lg text-white/65 border-l border-white/20 pl-5 mb-8 leading-relaxed",
          text: joy.applicationQuote,
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'text-sm text-white/50 leading-[1.85] mb-10',
          text: joy.applicationBody2,
        },
        {
          kind: 'image',
          src: '/restoration10/hf_20260502_013411_c6aa1e17-c02e-484b-96da-e553e559d225.png',
          alt: 'Song that comes alive',
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
          text: joy.prayerLabel,
        },
        {
          kind: 'text',
          tag: 'p',
          className:
            "font-['Cormorant_Garamond'] italic text-lg text-white/65 leading-[1.7] max-w-sm mx-auto mb-12",
          text: joy.prayerBody,
        },
        {
          kind: 'image',
          src: '/restoration10/hf_20260502_080118_326dd430-55e2-47ff-b2be-50dd32a716b4.png',
          alt: 'Mourning into dancing',
          className: '-mx-6 w-[calc(100%+3rem)] aspect-[2/3]',
        },
      ],
    },
  ],
};
