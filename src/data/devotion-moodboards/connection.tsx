// Connection — Restoration of Connection (Ephesians 2:13).
//
// One devotion, two art-directed arrangements (desktop `sections`, mobile
// `mobile`) sharing prose via SectionText {full, mobile?}. Geometry is verbatim
// data; the renderers in MoodBoard.tsx own the grammar. See ./_shared for the
// model + helpers. Zero visual change is the bar.
import type { DevotionMoodBoard, SectionText } from './_shared';

const connection = {
  titleIntro: {
    full: <>Let&rsquo;s explore the wall already torn down, and the God who has brought you near.</>,
  },
  openingQuestion: {
    full: <>The disconnection that hurts the most.</>,
  },
  openingBody1: {
    full: (
      <>
        Disconnection is one of the quiet epidemics of our time. We have more ways to reach each
        other than ever before&mdash;texts, calls, social media, video chats&mdash;and yet
        loneliness is at an all-time high. But the disconnection that hurts the most is not the
        distance between us and other people. It is the distance we feel between us and God.
      </>
    ),
  },
  openingBody2: {
    full: (
      <>
        Maybe you used to feel close to Him. Maybe prayer used to come easily, worship used to move
        you, and Scripture used to feel alive. But somewhere along the way, a wall went up. Sin,
        disappointment, busyness, or pain quietly pushed you to the margins of God&rsquo;s presence.
        And now, when you try to reach Him, it feels like you are talking to the ceiling.
      </>
    ),
  },
  scriptureLabel: { full: <>The Scripture</> },
  scriptureBody1: {
    full: (
      <>
        Paul wrote to the Ephesians&mdash;a church made up largely of Gentiles, people who were
        historically outsiders to God&rsquo;s covenant promises. They had been, in Paul&rsquo;s
        words, &ldquo;far away.&rdquo; Excluded. Without hope. Without God. That was their spiritual
        r&eacute;sum&eacute; before Christ.
      </>
    ),
  },
  scriptureBody2: {
    full: (
      <>
        But then Paul uses two of the most powerful words in Scripture: &ldquo;But now.&rdquo;
        Everything changed. The distance was closed&mdash;not by human effort, not by religious
        performance, but by the blood of Christ. The dividing wall of hostility was destroyed. Access
        to God was no longer reserved for a select few; it was thrown wide open.
      </>
    ),
  },
  eggys: {
    full: (
      <>
        The Greek word Paul uses for &ldquo;brought near&rdquo; is{' '}
        <em className="not-italic font-['Cormorant_Garamond'] italic">eggys</em>&mdash;the same word
        used to describe intimate proximity. God did not merely wave at them from a distance. He
        pulled them close. And He does the same for us. Every wall that sin erected, every chasm that
        shame carved out, every distance that disappointment created&mdash;Christ has bridged it all.
        You are not far from God. You have been brought near.
      </>
    ),
    mobile: (
      <>
        The Greek word Paul uses for &ldquo;brought near&rdquo; is{' '}
        <em className="not-italic font-['Cormorant_Garamond'] italic">eggys</em>&mdash;the same word
        used to describe intimate proximity. God did not merely wave at them from a distance. He
        pulled them close. And He does the same for us. Every wall that sin erected, every chasm that
        shame carved out, every distance that disappointment created&mdash;Christ has bridged it all.
      </>
    ),
  },
  principleLabel: { full: <>The Timeless Principle</> },
  principleHeading: {
    full: <>You do not have to earn what Christ has already purchased.</>,
  },
  principleBody: {
    full: (
      <>
        No amount of distance&mdash;whether caused by sin, seasons of spiritual dryness, or the pain
        of unanswered prayer&mdash;can disqualify us from the nearness God has already purchased.
        Restoration of connection with God does not require us to earn our way back into His
        presence. It requires us to accept the invitation that Christ&rsquo;s sacrifice has already
        extended.
      </>
    ),
  },
  applicationLabel: { full: <>The Application</> },
  applicationBody1: {
    full: (
      <>
        If you have felt far from God, today is the day you stop trying to close the distance on your
        own. You do not need to pray a perfect prayer, clean up your life first, or wait until you
        &ldquo;feel&rdquo; spiritual enough. Simply come.
      </>
    ),
  },
  applicationQuote: {
    full: (
      <>
        &ldquo;You are not an outsider. You are not too far gone. You have been brought near.&rdquo;
      </>
    ),
  },
  applicationBody2: {
    full: (
      <>
        Open your Bible to Ephesians 2 and read it slowly. Speak to God honestly&mdash;tell Him where
        the distance started, where the wall went up. And then receive this truth: the blood of
        Christ has already done the work of bringing you near. You are not an outsider. You are not
        too far gone. You have been brought near&mdash;and nothing can push you back.
      </>
    ),
  },
  prayerLabel: { full: <>A Prayer for Restoration</> },
  prayerBody: {
    full: (
      <>
        Lord, I have felt so far from You. I have let sin, shame, and silence build walls between us
        that I did not know how to tear down. But today I receive the truth that You have already
        torn them down through Christ. I do not have to earn my way back to You&mdash;I have been
        brought near by Your grace. Restore the closeness I have lost. Help me to live in the nearness
        You have already given me. I am done keeping my distance. I am coming home. Amen.
      </>
    ),
  },
  prayerCitation: { full: <>Ephesians 2:13 &mdash; Restoration of Connection</> },
} satisfies Record<string, SectionText>;

export const connectionBoard: DevotionMoodBoard = {
  id: 'connection',
  purposeWord: 'Connection',
  sections: [
    /* ── Zone 1: Title ── */
    {
      role: 'title',
      width: '120vw',
      elements: [
        {
          kind: 'image',
          src: '/restoration8/hf_20260416_074854_c5387c7f-6f07-4b15-bf62-4afdddee9149.png',
          alt: 'Brought near',
          pos: 'top-[10%] left-[5%] w-[42vw] h-[78vh]',
          threshold: 0.05,
        },
        {
          kind: 'text',
          tag: 'h2',
          className:
            "mb-elem absolute bottom-[24%] left-[52%] font-['Cormorant_Garamond'] italic font-light leading-[0.85] tracking-tight text-white",
          style: { fontSize: 'clamp(4rem, 12vw, 14rem)', paddingBottom: '0.22em' },
          text: { full: <>Connection</> },
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            'mb-elem mb-text absolute top-[18%] left-[52%] text-sm tracking-[0.15em] uppercase max-w-[280px] leading-relaxed text-white/70',
          text: connection.titleIntro,
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
          text: connection.openingQuestion,
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            'mb-elem mb-text absolute top-[46%] left-[5%] text-sm text-white/80 max-w-[280px] leading-[1.85] tracking-wide',
          text: connection.openingBody1,
        },
        {
          kind: 'image',
          src: '/restoration8/hf_20260416_195643_015d73a3-67df-4a69-9ad8-6f77d45e1cc8.png',
          alt: 'Quiet distance',
          pos: 'top-[5%] bottom-0 left-[28%] w-[50vw]',
          imgWrapClassName: 'w-full h-full object-cover',
          threshold: 0.05,
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            'mb-elem mb-text absolute top-[32%] left-[65%] text-sm text-white/70 max-w-[260px] leading-[1.85] tracking-wide',
          text: connection.openingBody2,
        },
        {
          kind: 'image',
          src: '/restoration8/hf_20260416_201556_e9918730-9f10-4bd7-ac55-28573f4f5e0c.png',
          alt: 'Wall went up',
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
          text: connection.scriptureLabel,
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            'mb-elem mb-text absolute top-[38%] text-sm text-white/80 max-w-[24vw] leading-[1.85] tracking-wide',
          style: { left: '3vw' },
          text: connection.scriptureBody1,
        },
        {
          kind: 'image',
          src: '/restoration8/hf_20260416_214154_f9197cf0-dad3-451e-9fca-55f30abb7207.png',
          alt: 'Far away',
          pos: 'top-[4%] bottom-0',
          style: { left: '35vw', width: '35vw' },
          imgClassName: 'object-contain',
          revealed: true,
        },
        {
          kind: 'image',
          src: '/restoration8/hf_20260416_234232_a782f6b7-6840-445b-b011-430d273c6dbf.png',
          alt: 'But now',
          pos: 'top-[4%] bottom-0',
          style: { left: '73vw', width: '35vw' },
          imgClassName: 'object-contain',
          revealed: true,
        },
        {
          kind: 'image',
          src: '/restoration8/hf_20260416_234755_bb74295d-f794-4b96-a325-8325f1e2e21f.png',
          alt: 'Wall destroyed',
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
          text: connection.scriptureBody2,
        },
      ],
    },

    /* ── Zone 4: Brought Near + Timeless Principle ── */
    {
      role: 'principle',
      width: '200vw',
      bg: { mix: 85, toward: 'app-bg' },
      elements: [
        {
          kind: 'image',
          src: '/restoration8/hf_20260416_235046_dcaa71cc-b08e-4fe3-bf27-1e5d67a9faa7.png',
          alt: 'Eggys — pulled close',
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
          text: connection.eggys,
        },
        {
          kind: 'image',
          src: '/restoration8/hf_20260417_000744_c7a99951-4d03-4f24-a388-b078c87c4378.png',
          alt: 'Bridged distance',
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
          text: connection.principleLabel,
        },
        {
          kind: 'text',
          tag: 'h3',
          className:
            "mb-elem absolute top-[18%] font-['Cormorant_Garamond'] italic font-light text-white leading-[1.2] max-w-[34vw]",
          style: { left: '118vw', fontSize: 'clamp(1.5rem, 3.5vw, 3.5rem)' },
          text: connection.principleHeading,
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            'mb-elem mb-text absolute bottom-[18%] text-sm text-white/70 max-w-[340px] leading-[1.85] tracking-wide',
          style: { left: '118vw' },
          text: connection.principleBody,
        },
        {
          kind: 'image',
          src: '/restoration8/hf_20260425_010526_4671b4b9-4c6c-4f63-aeb3-b4bd7cc2b9ea.png',
          alt: 'Already extended',
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
          text: connection.applicationLabel,
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            'mb-elem mb-text absolute top-[28%] text-sm text-white/80 max-w-[24vw] leading-[1.85] tracking-wide',
          style: { left: '5vw' },
          text: connection.applicationBody1,
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            "mb-elem mb-text absolute bottom-[15%] font-['Cormorant_Garamond'] italic text-xl text-white/90 max-w-[24vw] leading-relaxed border-l border-white/30 pl-5",
          style: { left: '5vw' },
          text: connection.applicationQuote,
        },
        {
          kind: 'image',
          src: '/restoration8/hf_20260425_010846_2917ac8b-0653-416e-98b8-d9570990f1d7.png',
          alt: 'Open Bible',
          pos: 'top-[4%] bottom-0',
          style: { left: '35vw', width: '35vw' },
          imgClassName: 'object-contain',
          revealed: true,
        },
        {
          kind: 'image',
          src: '/restoration8/hf_20260425_061517_398527bb-bda4-4eed-ba0c-4fc2dc5e0daa.png',
          alt: 'Honest prayer',
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
          text: connection.applicationBody2,
        },
        {
          kind: 'image',
          src: '/restoration8/hf_20260425_200331_6689ba50-acae-4ea7-964e-507fe77441ed.png',
          alt: 'Brought near',
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
          text: connection.prayerLabel,
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            "mb-elem mb-text absolute top-[24%] font-['Cormorant_Garamond'] italic text-white/90 max-w-[24vw] leading-[1.7]",
          style: { left: '5vw', fontSize: 'clamp(0.95rem, 1.6vw, 1.4rem)' },
          text: connection.prayerBody,
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'mb-elem absolute bottom-[3%] text-xs tracking-widest uppercase text-white/50',
          style: { left: '5vw' },
          text: connection.prayerCitation,
        },
        {
          kind: 'image',
          src: '/restoration8/hf_20260427_015402_dc843ba6-ab87-47d1-b314-30ff86531480.png',
          alt: 'Coming home',
          pos: 'top-[4%] bottom-0',
          style: { left: '35vw', width: '55vw' },
          imgClassName: 'object-contain',
          revealed: true,
        },
      ],
    },
  ],

  mobile: [
    /* Connection Title */
    {
      role: 'title',
      className: 'min-h-screen p-6 flex flex-col items-center justify-center text-center',
      elements: [
        {
          kind: 'text',
          tag: 'p',
          className: 'text-sm tracking-[0.2em] uppercase text-white/45 mb-8 max-w-xs',
          text: connection.titleIntro,
        },
        {
          kind: 'text',
          tag: 'h2',
          className: "font-['Cormorant_Garamond'] italic font-light text-white/90 leading-[0.9]",
          style: { fontSize: 'clamp(3rem, 14vw, 8rem)', paddingBottom: '0.18em' },
          text: { full: <>Connection</> },
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
          src: '/restoration8/hf_20260416_074854_c5387c7f-6f07-4b15-bf62-4afdddee9149.png',
          alt: 'Brought near',
          className: '-mx-6 w-[calc(100%+3rem)] aspect-[2/3] mb-10',
        },
        {
          kind: 'text',
          tag: 'h3',
          className:
            "font-['Cormorant_Garamond'] italic font-light text-white/90 text-3xl leading-snug mb-8",
          text: connection.openingQuestion,
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'text-sm text-white/60 leading-[1.85] mb-6',
          text: connection.openingBody1,
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'text-sm text-white/50 leading-[1.85]',
          text: connection.openingBody2,
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
          text: connection.scriptureLabel,
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'text-sm text-white/60 leading-[1.85] mb-8',
          text: connection.scriptureBody1,
        },
        {
          kind: 'image',
          src: '/restoration8/hf_20260416_234755_bb74295d-f794-4b96-a325-8325f1e2e21f.png',
          alt: 'Far away',
          className: '-mx-6 w-[calc(100%+3rem)] aspect-[2/3] mb-8',
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'text-sm text-white/60 leading-[1.85] mb-8',
          text: connection.scriptureBody2,
        },
        {
          kind: 'image',
          src: '/restoration8/hf_20260416_214154_f9197cf0-dad3-451e-9fca-55f30abb7207.png',
          alt: 'But now',
          className: '-mx-6 w-[calc(100%+3rem)] aspect-video mb-8',
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'text-sm text-white/60 leading-[1.85]',
          text: connection.eggys,
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
          src: '/restoration8/hf_20260416_195643_015d73a3-67df-4a69-9ad8-6f77d45e1cc8.png',
          alt: 'Quiet distance',
          className: 'w-full aspect-[2/3]',
        },
        {
          kind: 'image',
          src: '/restoration8/hf_20260416_235046_dcaa71cc-b08e-4fe3-bf27-1e5d67a9faa7.png',
          alt: 'Eggys',
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
          text: connection.principleLabel,
        },
        {
          kind: 'text',
          tag: 'h3',
          className:
            "font-['Cormorant_Garamond'] italic font-light text-white/85 text-2xl leading-snug mb-8",
          text: connection.principleHeading,
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'text-sm text-white/50 leading-[1.85] mb-10',
          text: connection.principleBody,
        },
        {
          kind: 'image',
          src: '/restoration8/hf_20260417_000744_c7a99951-4d03-4f24-a388-b078c87c4378.png',
          alt: 'Bridged distance',
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
          text: connection.applicationLabel,
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'text-sm text-white/60 leading-[1.85] mb-8',
          text: connection.applicationBody1,
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            "font-['Cormorant_Garamond'] italic text-lg text-white/65 border-l border-white/20 pl-5 mb-8 leading-relaxed",
          text: connection.applicationQuote,
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'text-sm text-white/50 leading-[1.85] mb-10',
          text: connection.applicationBody2,
        },
        {
          kind: 'image',
          src: '/restoration8/hf_20260425_010846_2917ac8b-0653-416e-98b8-d9570990f1d7.png',
          alt: 'Open Bible',
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
          text: connection.prayerLabel,
        },
        {
          kind: 'text',
          tag: 'p',
          className:
            "font-['Cormorant_Garamond'] italic text-lg text-white/65 leading-[1.7] max-w-sm mx-auto mb-12",
          text: connection.prayerBody,
        },
        {
          kind: 'image',
          src: '/restoration8/hf_20260427_015402_dc843ba6-ab87-47d1-b314-30ff86531480.png',
          alt: 'Coming home',
          className: '-mx-6 w-[calc(100%+3rem)] aspect-[2/3]',
        },
      ],
    },
  ],
};
