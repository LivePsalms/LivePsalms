// Hope — Restoration of Hope (Jeremiah 29:11).
//
// One devotion, two art-directed arrangements (desktop `sections`, mobile
// `mobile`) sharing prose via SectionText {full, mobile?}. Geometry is verbatim
// data; the renderers in MoodBoard.tsx own the grammar. See ./_shared for the
// model + helpers. Zero visual change is the bar.
import type { DevotionMoodBoard, SectionText } from './_shared';

const hope = {
  titleIntro: {
    full: <>Let&rsquo;s explore a future you cannot see yet, and the God who holds it.</>,
  },
  openingHeading: {
    full: <>Hope is a fragile thing.</>,
  },
  openingBody1: {
    full: (
      <>
        It can survive extraordinary hardship, but it can also be slowly suffocated by the weight of
        unanswered prayers, closed doors, and the quiet fear that maybe things will never get better.
        Perhaps you&rsquo;re in a season where hope feels more like a word on a greeting card than
        something real&mdash;a concept that sounds beautiful in theory but feels impossible in your
        actual life.
      </>
    ),
  },
  openingBody2: {
    full: (
      <>
        You&rsquo;ve prayed. You&rsquo;ve waited. You&rsquo;ve tried to be faithful. And yet the
        breakthrough hasn&rsquo;t come. The healing hasn&rsquo;t happened. The relationship
        hasn&rsquo;t been reconciled. And in the silence, a dangerous whisper creeps in: &ldquo;What
        if this is all there is?&rdquo;
      </>
    ),
  },
  scriptureLabel: { full: <>The Scripture</> },
  scriptureBody1: {
    full: (
      <>
        Jeremiah 29:11 is one of the most beloved verses in Scripture, but its full power is lost if
        we don&rsquo;t understand when God spoke it. This was not a promise delivered in a season of
        triumph. It was a letter&mdash;written by the prophet Jeremiah&mdash;to a people in exile. The
        Israelites had been ripped from their homeland and carried off to Babylon.
      </>
    ),
    mobile: (
      <>
        Jeremiah 29:11 is one of the most beloved verses in Scripture, but its full power is lost if
        we don&rsquo;t understand when God spoke it. This was not a promise delivered in a season of
        triumph. It was a letter&mdash;written by the prophet Jeremiah&mdash;to a people in exile.
      </>
    ),
  },
  scriptureBody2: {
    full: (
      <>
        False prophets were telling them the exile would be brief, that God would rescue them any day
        now. But God&rsquo;s actual message through Jeremiah was far more challenging: settle in.
        Build houses. Plant gardens. The exile would last seventy years. And it is into that crushing
        news that God speaks this promise of hope.
      </>
    ),
  },
  scriptureMobileBody2: {
    full: (
      <>
        False prophets were telling them the exile would be brief. But God&rsquo;s actual message was
        far more challenging: settle in. Build houses. Plant gardens. The exile would last seventy
        years. And it is into that crushing news that God speaks this promise of hope. He
        doesn&rsquo;t deny the difficulty. He doesn&rsquo;t promise a quick fix. He says: &ldquo;I
        have not abandoned you. I have plans for you&mdash;and those plans end in flourishing, not
        destruction.&rdquo;
      </>
    ),
  },
  promiseBody: {
    full: (
      <>
        He doesn&rsquo;t deny the difficulty. He doesn&rsquo;t promise a quick fix. He says, in
        essence: &ldquo;I know this is not what you wanted to hear. But I have not abandoned you. I
        have plans for you&mdash;and those plans end in flourishing, not destruction.&rdquo; The hope
        God offers is not tied to a timeline we control. It is anchored in a future He has already
        secured. And then comes the invitation: &ldquo;You will seek me and find me when you seek me
        with all your heart. I will be found by you,&rdquo; declares the Lord. Restoration
        doesn&rsquo;t begin with a change in circumstances. It begins with a turning of the heart.
      </>
    ),
  },
  scriptureMobileBody3: {
    full: (
      <>
        And then comes the invitation: &ldquo;You will seek me and find me when you seek me with all
        your heart. I will be found by you,&rdquo; declares the Lord. Restoration doesn&rsquo;t begin
        with a change in circumstances. It begins with a turning of the heart&mdash;toward the God who
        has been there all along, even in exile.
      </>
    ),
  },
  principleLabel: { full: <>The Timeless Principle</> },
  principleHeading: {
    full: <>God&rsquo;s plans for us do not expire in seasons of waiting.</>,
  },
  principleBody: {
    full: (
      <>
        Hope is not wishful thinking&mdash;it is the confident assurance that God&rsquo;s intentions
        toward us are good, even when our circumstances suggest otherwise. Restoration of hope does
        not require an escape from the hard season. It requires a redirecting of our gaze toward the
        One who holds the future we cannot yet see.
      </>
    ),
  },
  applicationLabel: { full: <>The Application</> },
  applicationBody1: {
    full: (
      <>
        If you are in a season of waiting and your hope is wearing thin, do something countercultural
        today: plant something. Not because the exile is over, but because you believe God when He
        says it won&rsquo;t last forever. This could be literal&mdash;plant a seed, tend a garden. Or
        it could be metaphorical&mdash;invest in a friendship, start that project you&rsquo;ve been
        putting off, sign up for the class.
      </>
    ),
  },
  applicationQuote: {
    full: <>&ldquo;Planting in exile is an act of defiant hope.&rdquo;</>,
  },
  applicationBody2: {
    full: (
      <>
        It declares that you trust God&rsquo;s future more than your present feelings. And as you
        plant, seek Him. Not casually. With all your heart. Because He has promised: when you search
        for Him wholeheartedly, you will find Him. And finding Him is the beginning of every
        restoration.
      </>
    ),
  },
  prayerLabel: { full: <>A Prayer for Restoration</> },
  prayerBody: {
    full: (
      <>
        Father, I confess that my hope has grown thin. I&rsquo;ve been waiting, and the waiting has
        worn me down. But today I choose to believe Your word over my weariness. You said You have
        plans for me&mdash;plans for a hope and a future. I can&rsquo;t see that future yet, but I
        trust the One who holds it. Restore my hope, Lord. Give me the courage to plant in exile, to
        build in the waiting, and to seek You with everything I have. I believe that You will be
        found. Bring me back, Lord. Bring me home. Amen.
      </>
    ),
  },
  prayerCitation: { full: <>Jeremiah 29:11 &mdash; Restoration of Hope</> },
} satisfies Record<string, SectionText>;

export const hopeBoard: DevotionMoodBoard = {
  id: 'hope',
  purposeWord: 'Hope',
  sections: [
    /* ── Zone 1: Hope Title ── */
    {
      role: 'title',
      width: '120vw',
      elements: [
        {
          kind: 'image',
          src: '/restoration3/image1.png',
          alt: 'Hope doorway',
          pos: 'top-[10%] left-[5%] w-[42vw] h-[78vh]',
          threshold: 0.05,
        },
        {
          kind: 'text',
          tag: 'h2',
          className:
            "mb-elem absolute bottom-[24%] left-[52%] font-['Cormorant_Garamond'] italic font-light leading-[0.85] tracking-tight text-white",
          style: { fontSize: 'clamp(5rem, 14vw, 16rem)' },
          text: { full: <>Hope</> },
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            'mb-elem mb-text absolute top-[18%] left-[52%] text-sm tracking-[0.15em] uppercase max-w-[280px] leading-relaxed text-white/70',
          text: hope.titleIntro,
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
          text: hope.openingHeading,
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            'mb-elem mb-text absolute top-[46%] left-[5%] text-sm text-white/80 max-w-[280px] leading-[1.85] tracking-wide',
          text: hope.openingBody1,
        },
        {
          kind: 'image',
          src: '/restoration3/image2.png',
          alt: 'Hope landscape',
          pos: 'top-[5%] bottom-0 left-[28%] w-[50vw]',
          imgWrapClassName: 'w-full h-full object-cover',
          threshold: 0.05,
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            'mb-elem mb-text absolute top-[32%] left-[65%] text-sm text-white/70 max-w-[260px] leading-[1.85] tracking-wide',
          text: hope.openingBody2,
        },
        {
          kind: 'image',
          src: '/restoration3/image3.png',
          alt: 'Hope detail',
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
          text: hope.scriptureLabel,
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            'mb-elem mb-text absolute top-[38%] text-sm text-white/80 max-w-[24vw] leading-[1.85] tracking-wide',
          style: { left: '3vw' },
          text: hope.scriptureBody1,
        },
        {
          kind: 'image',
          src: '/restoration3/image4.png',
          alt: 'Scripture scene',
          pos: 'top-[4%] bottom-0',
          style: { left: '35vw', width: '35vw' },
          imgClassName: 'object-contain',
          revealed: true,
        },
        {
          kind: 'image',
          src: '/restoration3/image5.png',
          alt: 'Exile landscape',
          pos: 'top-[4%] bottom-0',
          style: { left: '73vw', width: '35vw' },
          imgClassName: 'object-contain',
          revealed: true,
        },
        {
          kind: 'image',
          src: '/restoration3/image6.png',
          alt: 'Promise fulfilled',
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
          text: hope.scriptureBody2,
        },
      ],
    },

    /* ── Zone 4: God's Promise + Timeless Principle ── */
    {
      role: 'principle',
      width: '200vw',
      bg: { mix: 85, toward: 'app-bg' },
      elements: [
        {
          kind: 'image',
          src: '/restoration3/image7.png',
          alt: "God's plans",
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
          text: hope.promiseBody,
        },
        {
          kind: 'image',
          src: '/restoration3/image8.png',
          alt: 'Hope restored',
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
          text: hope.principleLabel,
        },
        {
          kind: 'text',
          tag: 'h3',
          className:
            "mb-elem absolute top-[18%] font-['Cormorant_Garamond'] italic font-light text-white leading-[1.2] max-w-[34vw]",
          style: { left: '118vw', fontSize: 'clamp(1.5rem, 3.5vw, 3.5rem)' },
          text: hope.principleHeading,
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            'mb-elem mb-text absolute bottom-[18%] text-sm text-white/70 max-w-[340px] leading-[1.85] tracking-wide',
          style: { left: '118vw' },
          text: hope.principleBody,
        },
        {
          kind: 'image',
          src: '/restoration3/image11.png',
          alt: 'Future hope',
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
          text: hope.applicationLabel,
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            'mb-elem mb-text absolute top-[28%] text-sm text-white/80 max-w-[24vw] leading-[1.85] tracking-wide',
          style: { left: '5vw' },
          text: hope.applicationBody1,
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            "mb-elem mb-text absolute bottom-[15%] font-['Cormorant_Garamond'] italic text-xl text-white/90 max-w-[24vw] leading-relaxed border-l border-white/30 pl-5",
          style: { left: '5vw' },
          text: hope.applicationQuote,
        },
        {
          kind: 'image',
          src: '/restoration3/image10.png',
          alt: 'Planting in exile',
          pos: 'top-[4%] bottom-0',
          style: { left: '35vw', width: '35vw' },
          imgClassName: 'object-contain',
          revealed: true,
        },
        {
          kind: 'image',
          src: '/restoration3/image13.png',
          alt: 'Defiant hope',
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
          text: hope.applicationBody2,
        },
        {
          kind: 'image',
          src: '/restoration3/image12.png',
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
          text: hope.prayerLabel,
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            "mb-elem mb-text absolute top-[24%] font-['Cormorant_Garamond'] italic text-white/90 max-w-[24vw] leading-[1.7]",
          style: { left: '5vw', fontSize: 'clamp(0.95rem, 1.6vw, 1.4rem)' },
          text: hope.prayerBody,
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'mb-elem absolute bottom-[3%] text-xs tracking-widest uppercase text-white/50',
          style: { left: '5vw' },
          text: hope.prayerCitation,
        },
        {
          kind: 'image',
          src: '/restoration3/image14.png',
          alt: 'Hope fulfilled',
          pos: 'top-[4%] bottom-0',
          style: { left: '35vw', width: '55vw' },
          imgClassName: 'object-contain',
          revealed: true,
        },
      ],
    },
  ],

  mobile: [
    /* Hope Title */
    {
      role: 'title',
      className: 'min-h-screen p-6 flex flex-col items-center justify-center text-center',
      elements: [
        {
          kind: 'text',
          tag: 'p',
          className: 'text-sm tracking-[0.2em] uppercase text-white/45 mb-8 max-w-xs',
          text: hope.titleIntro,
        },
        {
          kind: 'text',
          tag: 'h2',
          className: "font-['Cormorant_Garamond'] italic font-light text-white/90 leading-[0.9]",
          style: { fontSize: 'clamp(4rem, 18vw, 10rem)' },
          text: { full: <>Hope</> },
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
          src: '/restoration3/image1.png',
          alt: 'Hope doorway',
          className: '-mx-6 w-[calc(100%+3rem)] aspect-[2/3] mb-10',
        },
        {
          kind: 'text',
          tag: 'h3',
          className:
            "font-['Cormorant_Garamond'] italic font-light text-white/90 text-3xl leading-snug mb-8",
          text: hope.openingHeading,
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'text-sm text-white/60 leading-[1.85] mb-6',
          text: hope.openingBody1,
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'text-sm text-white/50 leading-[1.85]',
          text: hope.openingBody2,
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
          text: hope.scriptureLabel,
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'text-sm text-white/60 leading-[1.85] mb-8',
          text: hope.scriptureBody1,
        },
        {
          kind: 'image',
          src: '/restoration3/image4.png',
          alt: 'Scripture scene',
          className: '-mx-6 w-[calc(100%+3rem)] aspect-[2/3] mb-8',
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'text-sm text-white/60 leading-[1.85] mb-8',
          text: hope.scriptureMobileBody2,
        },
        {
          kind: 'image',
          src: '/restoration3/image12.png',
          alt: 'Exile landscape',
          className: '-mx-6 w-[calc(100%+3rem)] aspect-video mb-8',
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'text-sm text-white/60 leading-[1.85]',
          text: hope.scriptureMobileBody3,
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
          src: '/restoration3/image2.png',
          alt: 'Hope landscape',
          className: 'w-full aspect-[2/3]',
        },
        {
          kind: 'image',
          src: '/restoration3/image7.png',
          alt: "God's plans",
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
          text: hope.principleLabel,
        },
        {
          kind: 'text',
          tag: 'h3',
          className:
            "font-['Cormorant_Garamond'] italic font-light text-white/85 text-2xl leading-snug mb-8",
          text: hope.principleHeading,
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'text-sm text-white/50 leading-[1.85] mb-10',
          text: hope.principleBody,
        },
        {
          kind: 'image',
          src: '/restoration3/image14.png',
          alt: 'Hope restored',
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
          text: hope.applicationLabel,
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'text-sm text-white/60 leading-[1.85] mb-8',
          text: hope.applicationBody1,
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            "font-['Cormorant_Garamond'] italic text-lg text-white/65 border-l border-white/20 pl-5 mb-8 leading-relaxed",
          text: hope.applicationQuote,
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'text-sm text-white/50 leading-[1.85] mb-10',
          text: hope.applicationBody2,
        },
        {
          kind: 'image',
          src: '/restoration3/image10.png',
          alt: 'Planting in exile',
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
          text: hope.prayerLabel,
        },
        {
          kind: 'text',
          tag: 'p',
          className:
            "font-['Cormorant_Garamond'] italic text-lg text-white/65 leading-[1.7] max-w-sm mx-auto mb-12",
          text: hope.prayerBody,
        },
        {
          kind: 'image',
          src: '/restoration3/image13.png',
          alt: 'Hope fulfilled',
          className: '-mx-6 w-[calc(100%+3rem)] aspect-[2/3]',
        },
      ],
    },
  ],
};
