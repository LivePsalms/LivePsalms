// TODO(handoff): values for `label`, `title`, `scriptureRef`, and
// `firstMoodboardImage` are duplicated from PurposeDetail.tsx and the
// per-devotion image-map consts in MoodBoard.tsx. A follow-up cleanup should
// make those files consume this data instead. Until then, keep this file in
// sync if you change the originals.

export interface Devotion {
  id: string;
  label: string;
  title: string;
  scriptureRef: string;
  monogram: string;
  firstMoodboardImage: string;
}

export const devotions: Record<string, Devotion> = {
  restoration1: {
    id: 'restoration1',
    label: 'Restoration of Peace',
    title: 'Beside Still Waters',
    scriptureRef: 'Psalm 23:2–3',
    monogram: 'PE',
    firstMoodboardImage: '/restoration1/image1.png',
  },
  restoration3: {
    id: 'restoration3',
    label: 'The Restoration of Hope',
    title: 'A Future You Cannot See Yet',
    scriptureRef: 'Jeremiah 29:11',
    monogram: 'HO',
    firstMoodboardImage: '/restoration3/image1.png',
  },
  strength: {
    id: 'strength',
    label: 'The Restoration of Strength',
    title: 'Wings Like Eagles',
    scriptureRef: 'Isaiah 40:31',
    monogram: 'ST',
    firstMoodboardImage: '/restoration5/hf_20260414_210624_51692a60-f0b4-4235-8fe5-ebf51bae7dff.png',
  },
  wholeness: {
    id: 'wholeness',
    label: 'The Restoration of Wholeness',
    title: 'The Years Restored',
    scriptureRef: 'Joel 2:25–26',
    monogram: 'WH',
    firstMoodboardImage: '/restoration6/hf_20260414_231106_4132533c-178d-4385-a431-2def24758ac8.png',
  },
  purpose: {
    id: 'purpose',
    label: 'The Restoration of Purpose',
    title: 'All Things Working',
    scriptureRef: 'Romans 8:28',
    monogram: 'PU',
    firstMoodboardImage: '/restoration7/hf_20260415_190342_341ba0fb-3636-4645-aa20-40f7c56ecf5c.png',
  },
  connection: {
    id: 'connection',
    label: 'The Restoration of Connection',
    title: 'Brought Near',
    scriptureRef: 'Ephesians 2:13',
    monogram: 'CN',
    firstMoodboardImage: '/restoration8/hf_20260416_074854_c5387c7f-6f07-4b15-bf62-4afdddee9149.png',
  },
  identity: {
    id: 'identity',
    label: 'The Restoration of Identity',
    title: 'The New Has Come',
    scriptureRef: '2 Corinthians 5:17',
    monogram: 'ID',
    firstMoodboardImage: '/restoration9/hf_20260417_004042_2d78afd9-82c6-447b-93e1-d4df054daedf.png',
  },
  joy: {
    id: 'joy',
    label: 'The Restoration of Joy',
    title: 'Mouths Filled with Laughter',
    scriptureRef: 'Psalm 126:1–2',
    monogram: 'JY',
    firstMoodboardImage: '/restoration10/hf_20260417_160036_8cfcbbb9-be3c-41e1-90be-3a356eb8955c.png',
  },
  forgiveness: {
    id: 'forgiveness',
    label: 'The Serenity of Forgiveness',
    title: 'Let It Fall From Your Hands',
    scriptureRef: 'Ephesians 4:31–32',
    monogram: 'FG',
    firstMoodboardImage: '/serenity2/hf_20260417_180057_acab57fb-74d9-469f-b29b-a1b8af56ccd9.png',
  },
  surrender: {
    id: 'surrender',
    label: 'The Serenity of Surrender',
    title: 'Be Still and Know',
    scriptureRef: 'Psalm 46:10',
    monogram: 'SR',
    firstMoodboardImage: '/serenity3/hf_20260417_220039_093609a2-929e-4c7f-9cc7-a61440c6a2fa.png',
  },
  trust: {
    id: 'trust',
    label: 'The Serenity of Trust',
    title: 'The Path He Makes Straight',
    scriptureRef: 'Proverbs 3:5–6',
    monogram: 'TR',
    firstMoodboardImage: '/serenity5/IMG_3096.jpg',
  },
};
