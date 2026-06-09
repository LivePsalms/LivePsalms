export const copy = {
  section01: {
    eyebrow: '— THE NOTEPAD —',
    h1: 'Everything God’s said to you. In one place that remembers.',
    sub: 'Your devotions, your sermon notes, the verses you keep coming back to — written down, connected, and quietly read back to you when you need it.',
    activeFormLabel: 'ACTIVE FORM',
    shapeNames: ['Pencil', 'Heart', 'Journal'] as const,
    ctaPrimary: 'Open your notepad →',
    ctaGhost: 'Read what it does',
    ctaNote: 'No account needed to start. Works offline.',
  },
  section02: {
    eyebrow: '— ONE NOTEPAD —',
    h2: 'You wrote it down. Find it anytime.',
    body: 'The word from that conference. The verse that got you through last spring. It’s scattered across a notes app, three journals, and a sermon bulletin in a drawer.',
    supporting:
      'You don’t need another app to write in. You need one that keeps what you write — and shows you how it all connects.',
  },
  section03: {
    eyebrow: '— THE CONNECTION —',
    h2: 'Three kinds of writing. One thread running through them.',
    body: 'Mark each note a Devotion, Sermon, or Theme. Type a verse and it stays live — hover any time for the full text, all 66 books, without leaving the page.',
    supporting: 'Then click a verse to see every note that shares it.',
    caption: 'That’s the moment in your reading that meets you: months of your own writing, suddenly in conversation.',
  },
  section04: {
    eyebrow: '— LAMPLIGHT —',
    h2: 'Most apps wait for you to type. This one already knows.',
    body: 'Today’s Lamp is a single morning, afternoon, or evening card — built from your own recent notes, anchored in scripture, written for the season you’re actually in.',
    supporting: 'Not a verse-of-the-day. A word for where you are.',
    detail: 'It shows its work: every line names the note and the verse it came from.',
    cta: 'Open your notepad →',
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
    h2: 'Your work counts',
    supporting: 'Measured in scripture, never in streaks.',
    body: 'Eight tiers from New Flame to Glory, each rooted in a verse. No shame for the day you missed — the count only climbs.',
    pullQuote: '“Do not despise the day of small beginnings.” — Zechariah 4:10',
  },
  section08: {
    eyebrow: '— WHAT IS YOURS, STAYS YOURS —',
    h2: 'It’s your personal journey. Your prayer life. Your intimate walk with God.',
    supporting: 'We built it to stay that way.',
    lines: [
      'Lamplight stays off until you invite it.',
      'It never trains on your notes.',
      'Every insight is cited — note, verse, date.',
      'One tap deletes everything it’s ever read.',
      'Start with no account. Write fully offline.',
    ] as const,
  },
  section09: {
    h2: 'The first page is open.',
    ctaPrimary: 'Open your notepad →',
    ctaSecondary: 'Already writing? Sign in →',
  },
} as const;

export type Copy = typeof copy;
