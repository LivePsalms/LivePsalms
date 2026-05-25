export const copy = {
  section01: {
    eyebrow: '— THE NOTEPAD —',
    h1: 'For what you cannot afford to forget.',
    sub: 'The notepad that remembers what God has been saying — across your devotions, your sermons, the threads you’ve been walking with for months.',
    activeFormLabel: 'ACTIVE FORM',
    shapeNames: ['Pencil', 'Heart', 'Journal'] as const,
    ctaPrimary: 'Open your notepad →',
    ctaGhost: 'Read what it does',
  },
  section02: {
    eyebrow: '— ONE NOTEPAD —',
    h2: 'One Quiet Place.',
    body: 'The devotion you wrote this morning. The sermon you jotted down Sunday. The emotions you’ve been walking with for months. They were never separate, only stored that way.',
    supporting:
      'Each note knows which kind of writing it is. The Notepad threads them together by what they share — a verse, a word, an unanswered question.',
  },
  section03: {
    eyebrow: '— THE LIVING GRAPH —',
    h2: 'A map of how God has been speaking.',
    body: 'Every scripture you’ve returned to. Every theme you’ve kept circling. Every prayer that found its echo somewhere else. The graph draws the lines you couldn’t see while you were writing.',
    supporting: 'Not a productivity diagram. An illuminated record of being walked with.',
    caption: 'Each connection traced through scripture. Click any verse to see the notes that share it.',
  },
  section04: {
    eyebrow: '— LAMPLIGHT —',
    h2: 'A companion who’s been reading along.',
    body: 'Lamplight is not a chatbot. It is the long quiet finally given a voice. It reads what you have already written and gives you back today’s devotion — drawn from your own pages, anchored in scripture, written for the season you are in.',
    cards: [
      {
        title: 'Today’s Lamp.',
        body: 'A morning card, written from your own writing — not a verse-of-the-day, but a word for where you actually are.',
      },
      {
        title: 'What God seems to be saying.',
        body: 'A weekly synthesis, drawn from the threads your notes have already started.',
      },
      {
        title: 'Your journey, told back to you.',
        body: 'Seasonal Reflections that draw a line through what you walked, what carried you, what changed.',
      },
    ],
    trust: 'Off until you invite it. Private by default. Never trains on your notes. Always cited. One click to quiet.',
  },
  section05: {
    eyebrow: '— SCRIPTURE INLINE —',
    h2: 'The Bible, in the margin of your sentence.',
    body: 'Type the reference. Hover. The verse is there — full text, in the translation you read. The flow you were in does not have to break.',
    supporting: 'Every scripture you cite becomes a thread. Every thread keeps the next note close.',
  },
  section06: {
    eyebrow: '— SEVEN PAPERS —',
    h2: 'Choose the paper that asks the right thing of you.',
    body: 'Some mornings want a clean page. Some want lined. Some want a page the color of communion bread. Seven paper styles — each one a different way of being met.',
    papers: [
      { name: 'Linen', blurb: 'the morning before the day arrives', clip: '/notepad-landing/templates/t1' },
      { name: 'Vellum', blurb: 'for long-form devotional writing', clip: '/notepad-landing/templates/t2' },
      { name: 'Margin', blurb: 'for sermon capture, fast', clip: '/notepad-landing/templates/t3' },
      { name: 'Dotted Crème', blurb: 'for thinking in lists', clip: '/notepad-landing/templates/t4' },
      { name: 'Ruled Walnut', blurb: 'for the heavier writing', clip: '/notepad-landing/templates/t1' },
      { name: 'Communion', blurb: 'for the lament psalms', clip: '/notepad-landing/templates/t2' },
      { name: 'Folio', blurb: 'for the slow morning, the long quiet', clip: '/notepad-landing/templates/t3' },
    ] as const,
  },
  section07: {
    eyebrow: '— MARKED IN SCRIPTURE —',
    h2: 'The small thing, marked.',
    body: 'Eight tiers, from New Flame to Glory. Each one rooted in a verse, each one a refusal of the lie that your slow, faithful work doesn’t count.',
    pullQuote: '“Do not despise the day of small beginnings.” — Zechariah 4:10',
    bodyContinued: 'This is not a verse you frame on a wall. It is a verse the Notepad keeps reading over you.',
  },
  section08: {
    eyebrow: '— WHAT IS YOURS, STAYS YOURS —',
    h2: 'Private. Cited. Yours.',
    lines: [
      'Lamplight never trains on your notes.',
      'Every insight cites the source — the note, the verse, the date.',
      'Bring in what you already have. PDFs, Word, markdown — your sermon notes auto-link by the scripture they share.',
    ] as const,
  },
  section09: {
    h2: 'The first page is open.',
    sub: 'No account required to begin. Sign in to sync. Write offline. Come back to yourself.',
    ctaPrimary: 'Open your notepad →',
    ctaSecondary: 'Already writing? Sign in →',
  },
} as const;

export type Copy = typeof copy;
