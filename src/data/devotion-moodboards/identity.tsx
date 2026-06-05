// Identity — Restoration of Identity (2 Corinthians 5:17).
//
// One devotion, two art-directed arrangements (desktop `sections`, mobile
// `mobile`) sharing prose via SectionText {full, mobile?}. Geometry is verbatim
// data; the renderers in MoodBoard.tsx own the grammar. See ./_shared for the
// model + helpers. Zero visual change is the bar.
import type { DevotionMoodBoard, SectionText } from './_shared';

const identity = {
  titleIntro: {
    full: (
      <>
        Let&rsquo;s explore the labels you no longer have to answer to, and the new name God has
        already given you.
      </>
    ),
  },
  hookHeading: { full: <>The labels no one else sees.</> },
  hookBody1: {
    full: (
      <>
        How do you introduce yourself? Most of us lead with what we do, where we&rsquo;re from, or
        who we&rsquo;re connected to. But if we&rsquo;re honest, the way we define ourselves in
        private is often far less polished. In the quiet of our own minds, we carry a different set
        of labels&mdash;the ones no one else sees. The addict. The failure. The one who can&rsquo;t
        keep it together. The one who was abandoned. The one who isn&rsquo;t enough.
      </>
    ),
  },
  hookBody2: {
    full: (
      <>
        These internal labels become load-bearing walls in our lives. They shape our decisions, our
        relationships, and our willingness to step into the calling God has placed on us. And the
        most damaging part? We often mistake them for truth. We believe the old story so deeply that
        it starts to feel like the only story we&rsquo;ll ever have.
      </>
    ),
  },
  scriptureLabel: { full: <>The Scripture</> },
  scriptureBody1: {
    full: (
      <>
        Paul wrote these words to the church in Corinth&mdash;a community of former idol worshippers,
        former prostitutes, former thieves, and former liars who were struggling to leave their old
        identities behind. The culture kept pulling them back toward who they used to be. And
        Paul&rsquo;s response is one of the most radical declarations in all of Scripture.
      </>
    ),
  },
  scriptureBody2: {
    full: (
      <>
        Notice that Paul doesn&rsquo;t say the new creation{' '}
        <em className="not-italic font-['Cormorant_Garamond'] italic">is coming</em>. He doesn&rsquo;t
        say it&rsquo;s a goal to work toward. He says it{' '}
        <em className="not-italic font-['Cormorant_Garamond'] italic">has come</em>. In Christ, the
        transformation is already accomplished. Your old identity&mdash;the one built on shame,
        regret, and the labels the world gave you&mdash;has been replaced. Not improved. Not
        upgraded. <em className="not-italic font-['Cormorant_Garamond'] italic">Replaced</em>.
      </>
    ),
  },
  reconciledBody: {
    full: (
      <>
        And the source of this new identity? Paul tells us: &ldquo;All this is from God, who
        reconciled us to himself through Christ.&rdquo; The restoration of your identity is not
        something you manufacture through self-help or willpower. It is a gift from the God who
        looked at your brokenness and said, &ldquo;I&rsquo;m not counting that against you.
        I&rsquo;m making you new.&rdquo;
      </>
    ),
  },
  principleLabel: { full: <>The Timeless Principle</> },
  principleHeading: {
    full: <>Your past does not get the final word over who you are.</>,
  },
  principleBody: {
    full: (
      <>
        In Christ, your identity is no longer defined by your past. Restoration of identity means
        that who you were and what was done to you no longer get the final word over who you are. You
        have been reconciled&mdash;brought back into right relationship with God&mdash;and in that
        reconciliation, you have been given a completely new name. The old labels have been stripped
        away. The new creation has already begun.
      </>
    ),
  },
  applicationLabel: { full: <>The Application</> },
  applicationBody1: {
    full: (
      <>
        Today, identify one label you&rsquo;ve been carrying that does not align with who God says
        you are. Maybe it&rsquo;s &ldquo;unworthy.&rdquo; Maybe it&rsquo;s &ldquo;beyond repair.&rdquo;
        Maybe it&rsquo;s the name of a sin you left behind years ago but still secretly answer to.
        Write it down. And then cross it out.
      </>
    ),
  },
  applicationQuote: {
    full: <>&ldquo;I am a new creation. The old is gone. The new is here.&rdquo;</>,
  },
  applicationBody2: {
    full: (
      <>
        Write over it the truth of 2 Corinthians 5:17: &ldquo;I am a new creation. The old is gone.
        The new is here.&rdquo; Put this where you will see it every morning this week. Every time the
        old label tries to reassert itself, speak the new one out loud. You are not who you were. You
        are who God says you are. And He says you are new.
      </>
    ),
  },
  prayerLabel: { full: <>A Prayer for Restoration</> },
  prayerBody: {
    full: (
      <>
        God, I have been carrying labels that were never Yours to give. I&rsquo;ve let my past define
        me, and I&rsquo;ve answered to names that You never called me. Today, I lay them down. I
        receive the identity You have given me in Christ: new creation, reconciled, beloved. Help me
        to live from this truth and not from the old story. When the old labels try to pull me back,
        anchor me in the reality of who I am in You. The old has gone. The new is here. Thank You for
        making me whole again. Amen.
      </>
    ),
  },
  prayerCitation: { full: <>2 Corinthians 5:17 &mdash; Restoration of Identity</> },
} satisfies Record<string, SectionText>;

export const identityBoard: DevotionMoodBoard = {
  id: 'identity',
  purposeWord: 'Identity',
  sections: [
    /* ── Zone 1: Identity Title ── */
    {
      role: 'title',
      width: '120vw',
      elements: [
        {
          kind: 'image',
          src: '/restoration9/hf_20260417_004042_2d78afd9-82c6-447b-93e1-d4df054daedf.png',
          alt: 'New creation',
          pos: 'top-[10%] left-[5%] w-[42vw] h-[78vh]',
          threshold: 0.05,
        },
        {
          kind: 'text',
          tag: 'h2',
          className:
            "mb-elem absolute bottom-[24%] left-[52%] font-['Cormorant_Garamond'] italic font-light leading-[0.85] tracking-tight text-white",
          style: { fontSize: 'clamp(4rem, 12vw, 14rem)', paddingBottom: '0.22em' },
          text: { full: <>Identity</> },
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            'mb-elem mb-text absolute top-[18%] left-[52%] text-sm tracking-[0.15em] uppercase max-w-[280px] leading-relaxed text-white/70',
          text: identity.titleIntro,
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
          text: identity.hookHeading,
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            'mb-elem mb-text absolute top-[46%] left-[5%] text-sm text-white/80 max-w-[280px] leading-[1.85] tracking-wide',
          text: identity.hookBody1,
        },
        {
          kind: 'image',
          src: '/restoration9/hf_20260417_004334_cd8d309f-b30a-479c-91a1-38b7c0b6fd99.png',
          alt: 'Quiet labels',
          pos: 'top-[5%] bottom-0 left-[28%] w-[50vw]',
          imgWrapClassName: 'w-full h-full object-cover',
          threshold: 0.05,
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            'mb-elem mb-text absolute top-[32%] left-[65%] text-sm text-white/70 max-w-[260px] leading-[1.85] tracking-wide',
          text: identity.hookBody2,
        },
        {
          kind: 'image',
          src: '/restoration9/hf_20260417_004454_f57f28f0-4657-4711-bdfd-c1d58dc83c88.png',
          alt: 'Old story',
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
          text: identity.scriptureLabel,
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            'mb-elem mb-text absolute top-[38%] text-sm text-white/80 max-w-[24vw] leading-[1.85] tracking-wide',
          style: { left: '3vw' },
          text: identity.scriptureBody1,
        },
        {
          kind: 'image',
          src: '/restoration9/hf_20260417_005250_c48fad4a-a8ae-469d-9dff-8f2e64035c58.png',
          alt: 'Old creation',
          pos: 'top-[4%] bottom-0',
          style: { left: '35vw', width: '35vw' },
          imgClassName: 'object-contain',
          revealed: true,
        },
        {
          kind: 'image',
          src: '/restoration9/hf_20260417_005635_c4867a6e-a71b-410f-a7a9-39f112a2603c.png',
          alt: 'The new is here',
          pos: 'top-[4%] bottom-0',
          style: { left: '73vw', width: '35vw' },
          imgClassName: 'object-contain',
          revealed: true,
        },
        {
          kind: 'image',
          src: '/restoration9/hf_20260417_011524_8824205f-faff-4afa-82bf-eab7284acbcc.png',
          alt: 'Replaced',
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
          text: identity.scriptureBody2,
        },
      ],
    },

    /* ── Zone 4: Reconciled + Timeless Principle ── */
    {
      role: 'principle',
      width: '200vw',
      bg: { mix: 85, toward: 'app-bg' },
      elements: [
        {
          kind: 'image',
          src: '/restoration9/hf_20260501_005610_3a820135-6195-4a39-b5d5-80fb493ca0a0.png',
          alt: 'Reconciled',
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
          text: identity.reconciledBody,
        },
        {
          kind: 'image',
          src: '/restoration9/hf_20260501_010534_4a47a0c3-cfe9-4567-9173-8296719d3c1a.png',
          alt: 'Made new',
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
          text: identity.principleLabel,
        },
        {
          kind: 'text',
          tag: 'h3',
          className:
            "mb-elem absolute top-[18%] font-['Cormorant_Garamond'] italic font-light text-white leading-[1.2] max-w-[34vw]",
          style: { left: '118vw', fontSize: 'clamp(1.5rem, 3.5vw, 3.5rem)' },
          text: identity.principleHeading,
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            'mb-elem mb-text absolute bottom-[18%] text-sm text-white/70 max-w-[340px] leading-[1.85] tracking-wide',
          style: { left: '118vw' },
          text: identity.principleBody,
        },
        {
          kind: 'image',
          src: '/restoration9/hf_20260501_042519_f0fa2f6c-27c6-4524-a10a-2e128544249c.png',
          alt: 'New name',
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
          text: identity.applicationLabel,
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            'mb-elem mb-text absolute top-[28%] text-sm text-white/80 max-w-[24vw] leading-[1.85] tracking-wide',
          style: { left: '5vw' },
          text: identity.applicationBody1,
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            "mb-elem mb-text absolute bottom-[15%] font-['Cormorant_Garamond'] italic text-xl text-white/90 max-w-[24vw] leading-relaxed border-l border-white/30 pl-5",
          style: { left: '5vw' },
          text: identity.applicationQuote,
        },
        {
          kind: 'image',
          src: '/restoration9/hf_20260501_060719_1ea6ca87-9a7e-4878-98d2-a34963451185.png',
          alt: 'Crossing out the label',
          pos: 'top-[4%] bottom-0',
          style: { left: '35vw', width: '35vw' },
          imgClassName: 'object-contain',
          revealed: true,
        },
        {
          kind: 'image',
          src: '/restoration9/hf_20260501_231905_79616caf-5a25-464d-8c7f-4a29e2f20d19.png',
          alt: 'The new name',
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
          text: identity.applicationBody2,
        },
        {
          kind: 'image',
          src: '/restoration9/hf_20260501_232632_a9b6641f-4be0-4da8-88e0-a9f64657bf01.png',
          alt: 'Spoken out loud',
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
          text: identity.prayerLabel,
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            "mb-elem mb-text absolute top-[24%] font-['Cormorant_Garamond'] italic text-white/90 max-w-[24vw] leading-[1.7]",
          style: { left: '5vw', fontSize: 'clamp(0.95rem, 1.6vw, 1.4rem)' },
          text: identity.prayerBody,
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'mb-elem absolute bottom-[3%] text-xs tracking-widest uppercase text-white/50',
          style: { left: '5vw' },
          text: identity.prayerCitation,
        },
        {
          kind: 'image',
          src: '/restoration9/hf_20260502_010507_ba5ab2bc-9f2b-43fa-bb1c-f05ae7b7adef.png',
          alt: 'Beloved',
          pos: 'top-[4%] bottom-0',
          style: { left: '35vw', width: '55vw' },
          imgClassName: 'object-contain',
          revealed: true,
        },
      ],
    },
  ],

  mobile: [
    /* Identity Title */
    {
      role: 'title',
      className: 'min-h-screen p-6 flex flex-col items-center justify-center text-center',
      elements: [
        {
          kind: 'text',
          tag: 'p',
          className: 'text-sm tracking-[0.2em] uppercase text-white/45 mb-8 max-w-xs',
          text: identity.titleIntro,
        },
        {
          kind: 'text',
          tag: 'h2',
          className: "font-['Cormorant_Garamond'] italic font-light text-white/90 leading-[0.9]",
          style: { fontSize: 'clamp(3rem, 14vw, 8rem)', paddingBottom: '0.18em' },
          text: { full: <>Identity</> },
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
          src: '/restoration9/hf_20260417_004454_f57f28f0-4657-4711-bdfd-c1d58dc83c88.png',
          alt: 'New creation',
          className: '-mx-6 w-[calc(100%+3rem)] aspect-[2/3] mb-10',
        },
        {
          kind: 'text',
          tag: 'h3',
          className:
            "font-['Cormorant_Garamond'] italic font-light text-white/90 text-3xl leading-snug mb-8",
          text: identity.hookHeading,
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'text-sm text-white/60 leading-[1.85] mb-6',
          text: identity.hookBody1,
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'text-sm text-white/50 leading-[1.85]',
          text: identity.hookBody2,
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
          text: identity.scriptureLabel,
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'text-sm text-white/60 leading-[1.85] mb-8',
          text: identity.scriptureBody1,
        },
        {
          kind: 'image',
          src: '/restoration9/hf_20260417_005250_c48fad4a-a8ae-469d-9dff-8f2e64035c58.png',
          alt: 'Old creation',
          className: '-mx-6 w-[calc(100%+3rem)] aspect-[2/3] mb-8',
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'text-sm text-white/60 leading-[1.85] mb-8',
          text: identity.scriptureBody2,
        },
        {
          kind: 'image',
          src: '/restoration9/hf_20260417_005635_c4867a6e-a71b-410f-a7a9-39f112a2603c.png',
          alt: 'The new is here',
          className: '-mx-6 w-[calc(100%+3rem)] aspect-video mb-8',
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'text-sm text-white/60 leading-[1.85]',
          text: identity.reconciledBody,
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
          src: '/restoration9/hf_20260417_004334_cd8d309f-b30a-479c-91a1-38b7c0b6fd99.png',
          alt: 'Quiet labels',
          className: 'w-full aspect-[2/3]',
        },
        {
          kind: 'image',
          src: '/restoration9/hf_20260501_005610_3a820135-6195-4a39-b5d5-80fb493ca0a0.png',
          alt: 'Reconciled',
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
          text: identity.principleLabel,
        },
        {
          kind: 'text',
          tag: 'h3',
          className:
            "font-['Cormorant_Garamond'] italic font-light text-white/85 text-2xl leading-snug mb-8",
          text: identity.principleHeading,
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'text-sm text-white/50 leading-[1.85] mb-10',
          text: identity.principleBody,
        },
        {
          kind: 'image',
          src: '/restoration9/hf_20260417_004042_2d78afd9-82c6-447b-93e1-d4df054daedf.png',
          alt: 'Made new',
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
          text: identity.applicationLabel,
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'text-sm text-white/60 leading-[1.85] mb-8',
          text: identity.applicationBody1,
        },
        {
          kind: 'text',
          tag: 'div',
          className:
            "font-['Cormorant_Garamond'] italic text-lg text-white/65 border-l border-white/20 pl-5 mb-8 leading-relaxed",
          text: identity.applicationQuote,
        },
        {
          kind: 'text',
          tag: 'p',
          className: 'text-sm text-white/50 leading-[1.85] mb-10',
          text: identity.applicationBody2,
        },
        {
          kind: 'image',
          src: '/restoration9/hf_20260501_060719_1ea6ca87-9a7e-4878-98d2-a34963451185.png',
          alt: 'Crossing out the label',
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
          text: identity.prayerLabel,
        },
        {
          kind: 'text',
          tag: 'p',
          className:
            "font-['Cormorant_Garamond'] italic text-lg text-white/65 leading-[1.7] max-w-sm mx-auto mb-12",
          text: identity.prayerBody,
        },
        {
          kind: 'image',
          src: '/restoration9/hf_20260502_010507_ba5ab2bc-9f2b-43fa-bb1c-f05ae7b7adef.png',
          alt: 'Beloved',
          className: '-mx-6 w-[calc(100%+3rem)] aspect-[2/3]',
        },
      ],
    },
  ],
};
