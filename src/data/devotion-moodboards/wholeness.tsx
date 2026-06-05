// Wholeness — Restoration of Wholeness (Joel 2:25–26).
//
// One devotion, two art-directed arrangements (desktop `sections`, mobile
// `mobile`) sharing prose via SectionText {full, mobile?}. Geometry is verbatim
// data; the renderers in MoodBoard.tsx own the grammar. See ./_shared for the
// model + helpers. Zero visual change is the bar.
import type { DevotionMoodBoard, SectionText } from './_shared';

const wholeness = {
  titleIntro: {
    full: <>Let&rsquo;s explore the years restored, and the God who repays what was lost.</>,
  },
  openingQuestion: {
    full: <>Some losses leave a mark you cannot see.</>,
  },
  openingBody1: {
    full: (
      <>
        Some losses leave a mark you can see&mdash;a house destroyed, a relationship ended, a career
        derailed. But some of the deepest losses are invisible. They&rsquo;re the years you spent in
        a fog of grief that swallowed your joy. They&rsquo;re the seasons of your life that were
        consumed by an addiction, a toxic relationship, or a crisis that took everything you had just
        to survive.
      </>
    ),
  },
  openingBody2: {
    full: (
      <>
        And when you finally come through on the other side, there&rsquo;s a quiet ache that
        whispers: &ldquo;You can&rsquo;t get those years back.&rdquo; The missed milestones. The joy
        you should have felt. The person you could have become if life hadn&rsquo;t taken such a
        devastating detour. It&rsquo;s one of the heaviest burdens a person can carry&mdash;the grief
        of lost time.
      </>
    ),
  },
  scriptureLabel: { full: <>The Scripture</> },
  scriptureBody1: {
    full: (
      <>
        The people of Israel knew this grief intimately. In the book of Joel, a devastating plague of
        locusts had swept through the land, consuming everything&mdash;crops, vineyards, orchards.
        What had taken years to cultivate was devoured in days. The destruction was total. The people
        were left staring at bare fields and empty storehouses, wondering if anything could ever grow
        again.
      </>
    ),
  },
  scriptureBody2: {
    full: (
      <>
        And it is into this desolation that God speaks one of the most breathtaking promises in all
        of Scripture: &ldquo;I will repay you for the years the locusts have eaten.&rdquo; Not just
        the crops. The years. God doesn&rsquo;t just promise to replace what was lost&mdash;He
        promises to restore the time that was consumed by destruction.
      </>
    ),
  },
  redemptionBody: {
    full: (
      <>
        This is a promise that defies human logic. We cannot rewind the clock. We cannot unlive our
        hardest seasons. But God operates outside the boundaries of time. His restoration doesn&rsquo;t
        mean He erases the past&mdash;it means He redeems it. He takes the very years that were
        devoured and fills the space with abundance, purpose, and praise. David echoed this same
        longing in Psalm 51 when he cried out, &ldquo;Restore to me the joy of your salvation.&rdquo;
        The joy hadn&rsquo;t been destroyed forever. It was waiting to be given back.
      </>
    ),
    mobile: (
      <>
        This is a promise that defies human logic. We cannot rewind the clock. We cannot unlive our
        hardest seasons. But God operates outside the boundaries of time. His restoration doesn&rsquo;t
        mean He erases the past&mdash;it means He redeems it. He takes the very years that were
        devoured and fills the space with abundance, purpose, and praise. David echoed this same
        longing in Psalm 51 when he cried out, &ldquo;Restore to me the joy of your salvation.&rdquo;
      </>
    ),
  },
  principleLabel: { full: <>The Timeless Principle</> },
  principleHeading: {
    full: <>No season of loss is beyond the reach of God&rsquo;s restoration.</>,
  },
  principleBody: {
    full: (
      <>
        He is not limited by the damage that has been done or the time that has passed. God&rsquo;s
        promise to repay the years is not about turning back the clock&mdash;it is about filling what
        remains with such abundance and purpose that the coming chapters of your story will overflow
        with the goodness that was missing from the ones before. Wholeness does not require a perfect
        past. It requires a faithful God.
      </>
    ),
  },
  applicationLabel: { full: <>The Application</> },
  applicationBody1: {
    full: (
      <>
        Take a moment to name the &ldquo;locusts&rdquo; in your story. What consumed the years? Was it
        illness? Regret? A season of wandering from God? Whatever it is, bring it to Him&mdash;not
        with shame, but with expectation. God doesn&rsquo;t ask you to pretend the loss didn&rsquo;t
        happen. He asks you to believe that He is able to fill the space those years left behind with
        something only He can give.
      </>
    ),
  },
  applicationQuote: {
    full: <>&ldquo;God is restoring what was lost.&rdquo;</>,
  },
  applicationBody2: {
    full: (
      <>
        Write this truth somewhere personal&mdash;in your journal, on a note beside your bed:
        &ldquo;God is restoring what was lost.&rdquo; And then begin to look for evidence of it. Watch
        for the small mercies, the unexpected open doors, the moments of joy that catch you off guard.
        That is restoration at work.
      </>
    ),
  },
  prayerLabel: { full: <>A Prayer for Restoration</> },
  prayerBody: {
    full: (
      <>
        God, You know the years that have been taken from me. You know the seasons I grieve, the joy I
        missed, and the person I wish I had been. I bring all of it to You today&mdash;not with
        bitterness, but with hope. You promised to repay what the locusts have eaten, and I am
        choosing to believe that promise. Restore my wholeness. Redeem my story. Fill what remains
        with Your abundance and purpose. Create in me a clean heart and renew a steadfast spirit
        within me. I trust that my best days are still ahead because You are in them. Amen.
      </>
    ),
  },
  prayerCitation: { full: <>Joel 2:25&ndash;26 &mdash; Restoration of Wholeness</> },
} satisfies Record<string, SectionText>;

export const wholenessBoard: DevotionMoodBoard = {
  id: 'wholeness',
  purposeWord: 'Wholeness',
  sections: [
    /* ── Zone 1: Wholeness Title ── */
    {
      role: 'title',
      width: '120vw',
      elements: [
        {
          kind: 'image',
          src: '/restoration6/hf_20260414_231106_4132533c-178d-4385-a431-2def24758ac8.png',
          alt: 'Restored harvest',
          pos: 'top-[10%] left-[5%] w-[42vw] h-[78vh]',
          threshold: 0.05,
        },
        {
          kind: 'text',
          tag: 'h2',
          className:
            "mb-elem absolute bottom-[24%] left-[52%] font-['Cormorant_Garamond'] italic font-light leading-[0.85] tracking-tight text-white",
          style: { fontSize: 'clamp(4rem, 12vw, 14rem)', paddingBottom: '0.22em' },
          text: { full: <>Wholeness</> },
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            'mb-elem mb-text absolute top-[18%] left-[52%] text-sm tracking-[0.15em] uppercase max-w-[280px] leading-relaxed text-white/70',
          text: wholeness.titleIntro,
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
          text: wholeness.openingQuestion,
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            'mb-elem mb-text absolute top-[46%] left-[5%] text-sm text-white/80 max-w-[280px] leading-[1.85] tracking-wide',
          text: wholeness.openingBody1,
        },
        {
          kind: 'image',
          src: '/restoration6/hf_20260414_233247_67c86046-3081-43e4-8fd2-22035aa30a55.png',
          alt: 'Lost years',
          pos: 'top-[5%] bottom-0 left-[28%] w-[50vw]',
          imgWrapClassName: 'w-full h-full object-cover',
          threshold: 0.05,
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            'mb-elem mb-text absolute top-[32%] left-[65%] text-sm text-white/70 max-w-[260px] leading-[1.85] tracking-wide',
          text: wholeness.openingBody2,
        },
        {
          kind: 'image',
          src: '/restoration6/hf_20260414_234114_46a4b300-ba2c-471b-8949-4a4d8e23b74a.png',
          alt: 'Quiet ache',
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
          text: wholeness.scriptureLabel,
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            'mb-elem mb-text absolute top-[38%] text-sm text-white/80 max-w-[24vw] leading-[1.85] tracking-wide',
          style: { left: '3vw' },
          text: wholeness.scriptureBody1,
        },
        {
          kind: 'image',
          src: '/restoration6/hf_20260415_054031_db02be36-4c89-4222-9c51-cdf5bb36136a.png',
          alt: 'Bare fields',
          pos: 'top-[4%] bottom-0',
          style: { left: '35vw', width: '35vw' },
          imgClassName: 'object-contain',
          revealed: true,
        },
        {
          kind: 'image',
          src: '/restoration6/hf_20260415_055252_fdb27a18-6f29-4f2c-8580-f042a3c9be7b.png',
          alt: 'Empty storehouse',
          pos: 'top-[4%] bottom-0',
          style: { left: '73vw', width: '35vw' },
          imgClassName: 'object-contain',
          revealed: true,
        },
        {
          kind: 'image',
          src: '/restoration6/hf_20260415_055335_1322b651-3288-4fa8-8992-e262f9c9b745.png',
          alt: 'Years repaid',
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
          text: wholeness.scriptureBody2,
        },
      ],
    },

    /* ── Zone 4: Redemption + Timeless Principle ── */
    {
      role: 'principle',
      width: '200vw',
      bg: { mix: 85, toward: 'app-bg' },
      elements: [
        {
          kind: 'image',
          src: '/restoration6/hf_20260415_060619_127522a4-5ed7-450d-b74a-45142a1e37b7.png',
          alt: 'Outside of time',
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
          text: wholeness.redemptionBody,
        },
        {
          kind: 'image',
          src: '/restoration6/hf_20260415_060715_0cbc7fcb-5dea-4bbf-9259-5593f0efe53d.png',
          alt: 'Joy returning',
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
          text: wholeness.principleLabel,
        },
        {
          kind: 'text',
          tag: 'h3',
          className:
            "mb-elem absolute top-[18%] font-['Cormorant_Garamond'] italic font-light text-white leading-[1.2] max-w-[34vw]",
          style: { left: '118vw', fontSize: 'clamp(1.5rem, 3.5vw, 3.5rem)' },
          text: wholeness.principleHeading,
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            'mb-elem mb-text absolute bottom-[18%] text-sm text-white/70 max-w-[340px] leading-[1.85] tracking-wide',
          style: { left: '118vw' },
          text: wholeness.principleBody,
        },
        {
          kind: 'image',
          src: '/restoration6/hf_20260415_061227_61d807e8-0881-4869-a4f5-cd2249a83f21.png',
          alt: 'Faithful God',
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
          text: wholeness.applicationLabel,
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            'mb-elem mb-text absolute top-[28%] text-sm text-white/80 max-w-[24vw] leading-[1.85] tracking-wide',
          style: { left: '5vw' },
          text: wholeness.applicationBody1,
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            "mb-elem mb-text absolute bottom-[15%] font-['Cormorant_Garamond'] italic text-xl text-white/90 max-w-[24vw] leading-relaxed border-l border-white/30 pl-5",
          style: { left: '5vw' },
          text: wholeness.applicationQuote,
        },
        {
          kind: 'image',
          src: '/restoration6/hf_20260423_214546_cc8117a5-3beb-481b-9d34-50562700a165.png',
          alt: 'Naming the locusts',
          pos: 'top-[4%] bottom-0',
          style: { left: '35vw', width: '35vw' },
          imgClassName: 'object-contain',
          revealed: true,
        },
        {
          kind: 'image',
          src: '/restoration6/hf_20260423_221822_470ed8d3-2e93-448b-a218-4199a5c29d0e.png',
          alt: 'Truth on a note',
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
          text: wholeness.applicationBody2,
        },
        {
          kind: 'image',
          src: '/restoration6/hf_20260423_222545_997ab4b3-0907-4a4f-b8d7-13674a9f0bd8.png',
          alt: 'Restoration at work',
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
          text: wholeness.prayerLabel,
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            "mb-elem mb-text absolute top-[24%] font-['Cormorant_Garamond'] italic text-white/90 max-w-[24vw] leading-[1.7]",
          style: { left: '5vw', fontSize: 'clamp(0.95rem, 1.6vw, 1.4rem)' },
          text: wholeness.prayerBody,
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'mb-elem absolute bottom-[3%] text-xs tracking-widest uppercase text-white/50',
          style: { left: '5vw' },
          text: wholeness.prayerCitation,
        },
        {
          kind: 'image',
          src: '/restoration6/hf_20260423_222700_af42d740-e95b-41d9-9aa5-a60229e96638.png',
          alt: 'Years redeemed',
          pos: 'top-[4%] bottom-0',
          style: { left: '35vw', width: '55vw' },
          imgClassName: 'object-contain',
          revealed: true,
        },
      ],
    },
  ],

  mobile: [
    /* Wholeness Title */
    {
      role: 'title',
      className: 'min-h-screen p-6 flex flex-col items-center justify-center text-center',
      elements: [
        {
          kind: 'text',
          tag: 'p',
          className: 'text-sm tracking-[0.2em] uppercase text-white/45 mb-8 max-w-xs',
          text: wholeness.titleIntro,
        },
        {
          kind: 'text',
          tag: 'h2',
          className: "font-['Cormorant_Garamond'] italic font-light text-white/90 leading-[0.9]",
          style: { fontSize: 'clamp(3rem, 14vw, 8rem)', paddingBottom: '0.18em' },
          text: { full: <>Wholeness</> },
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
          src: '/restoration6/hf_20260414_231106_4132533c-178d-4385-a431-2def24758ac8.png',
          alt: 'Restored harvest',
          className: '-mx-6 w-[calc(100%+3rem)] aspect-[2/3] mb-10',
        },
        {
          kind: 'text',
          tag: 'h3',
          className:
            "font-['Cormorant_Garamond'] italic font-light text-white/90 text-3xl leading-snug mb-8",
          text: wholeness.openingQuestion,
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'text-sm text-white/60 leading-[1.85] mb-6',
          text: wholeness.openingBody1,
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'text-sm text-white/50 leading-[1.85]',
          text: wholeness.openingBody2,
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
          text: wholeness.scriptureLabel,
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'text-sm text-white/60 leading-[1.85] mb-8',
          text: wholeness.scriptureBody1,
        },
        {
          kind: 'image',
          src: '/restoration6/hf_20260414_234114_46a4b300-ba2c-471b-8949-4a4d8e23b74a.png',
          alt: 'Bare fields',
          className: '-mx-6 w-[calc(100%+3rem)] aspect-[2/3] mb-8',
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'text-sm text-white/60 leading-[1.85] mb-8',
          text: wholeness.scriptureBody2,
        },
        {
          kind: 'image',
          src: '/restoration6/hf_20260415_054031_db02be36-4c89-4222-9c51-cdf5bb36136a.png',
          alt: 'Empty storehouse',
          className: '-mx-6 w-[calc(100%+3rem)] aspect-video mb-8',
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'text-sm text-white/60 leading-[1.85]',
          text: wholeness.redemptionBody,
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
          src: '/restoration6/hf_20260414_233247_67c86046-3081-43e4-8fd2-22035aa30a55.png',
          alt: 'Lost years',
          className: 'w-full aspect-[2/3]',
        },
        {
          kind: 'image',
          src: '/restoration6/hf_20260415_060619_127522a4-5ed7-450d-b74a-45142a1e37b7.png',
          alt: 'Outside of time',
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
          text: wholeness.principleLabel,
        },
        {
          kind: 'text',
          tag: 'h3',
          className:
            "font-['Cormorant_Garamond'] italic font-light text-white/85 text-2xl leading-snug mb-8",
          text: wholeness.principleHeading,
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'text-sm text-white/50 leading-[1.85] mb-10',
          text: wholeness.principleBody,
        },
        {
          kind: 'image',
          src: '/restoration6/hf_20260415_061227_61d807e8-0881-4869-a4f5-cd2249a83f21.png',
          alt: 'Joy returning',
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
          text: wholeness.applicationLabel,
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'text-sm text-white/60 leading-[1.85] mb-8',
          text: wholeness.applicationBody1,
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            "font-['Cormorant_Garamond'] italic text-lg text-white/65 border-l border-white/20 pl-5 mb-8 leading-relaxed",
          text: wholeness.applicationQuote,
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'text-sm text-white/50 leading-[1.85] mb-10',
          text: wholeness.applicationBody2,
        },
        {
          kind: 'image',
          src: '/restoration6/hf_20260423_214546_cc8117a5-3beb-481b-9d34-50562700a165.png',
          alt: 'Naming the locusts',
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
          text: wholeness.prayerLabel,
        },
        {
          kind: 'text',
          tag: 'p',
          className:
            "font-['Cormorant_Garamond'] italic text-lg text-white/65 leading-[1.7] max-w-sm mx-auto mb-12",
          text: wholeness.prayerBody,
        },
        {
          kind: 'image',
          src: '/restoration6/hf_20260423_222700_af42d740-e95b-41d9-9aa5-a60229e96638.png',
          alt: 'Years redeemed',
          className: '-mx-6 w-[calc(100%+3rem)] aspect-[2/3]',
        },
      ],
    },
  ],
};
