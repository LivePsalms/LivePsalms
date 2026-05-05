export interface Tier {
  name: string;
  threshold: number;
  scripture: string;
  reference: string;
}

export const TIERS: Tier[] = [
  {
    name: 'New Flame',
    threshold: 0,
    scripture: 'Do not despise these small beginnings, for the Lord rejoices to see the work begin',
    reference: 'Zechariah 4:10',
  },
  {
    name: 'Spark',
    threshold: 10,
    scripture: 'The Lord is my light and my salvation',
    reference: 'Psalm 27:1',
  },
  {
    name: 'Ember',
    threshold: 50,
    scripture: 'Fan into flame the gift of God',
    reference: '2 Timothy 1:6',
  },
  {
    name: 'Flame',
    threshold: 150,
    scripture: 'He makes His ministers a flame of fire',
    reference: 'Hebrews 1:7',
  },
  {
    name: 'Lamp',
    threshold: 300,
    scripture: 'Your word is a lamp to my feet',
    reference: 'Psalm 119:105',
  },
  {
    name: 'Pillar of Fire',
    threshold: 500,
    scripture: 'A pillar of fire by night to give them light',
    reference: 'Exodus 13:21',
  },
  {
    name: 'Refiner',
    threshold: 1000,
    scripture: 'He will sit as a refiner and purifier',
    reference: 'Malachi 3:3',
  },
  {
    name: 'Glory',
    threshold: 5000,
    scripture: 'The glory of the Lord shone around them',
    reference: 'Luke 2:9',
  },
];

/**
 * Get the current tier for a given highest note count.
 * Always returns a tier — defaults to TIERS[0] (New Flame, threshold 0).
 */
export function getTierForCount(highestNoteCount: number): Tier {
  let current: Tier = TIERS[0];
  for (const tier of TIERS) {
    if (highestNoteCount >= tier.threshold) {
      current = tier;
    } else {
      break;
    }
  }
  return current;
}

/**
 * Get the next tier after the current one, or null if at max.
 */
export function getNextTier(highestNoteCount: number): Tier | null {
  for (const tier of TIERS) {
    if (highestNoteCount < tier.threshold) {
      return tier;
    }
  }
  return null;
}
