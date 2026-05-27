import { describe, it, expect } from 'vitest';
import {
  LAMPLIGHT_SYSTEM_FRAGMENT,
  BANNED_PHRASES,
  CONTESTED_PASSAGES,
  GROWTH_BANNED_PHRASES,
  composeSystem,
} from './voice';

describe('LAMPLIGHT_SYSTEM_FRAGMENT', () => {
  it('contains the {{voice_preference}} substitution token', () => {
    expect(LAMPLIGHT_SYSTEM_FRAGMENT).toContain('{{voice_preference}}');
  });

  it('never contains a phrase that would trip its own banned-phrase regex', () => {
    for (const re of BANNED_PHRASES) {
      expect(LAMPLIGHT_SYSTEM_FRAGMENT).not.toMatch(re);
    }
  });

  it('positively names the stance (reveal Scripture, possibility not pronouncement)', () => {
    expect(LAMPLIGHT_SYSTEM_FRAGMENT).toMatch(/reveal what scripture/i);
    expect(LAMPLIGHT_SYSTEM_FRAGMENT).toMatch(/possibility, not pronouncement/i);
  });
});

describe('BANNED_PHRASES — prophetic/oracular coverage', () => {
  const cases: Array<{ name: string; text: string }> = [
    { name: 'present-tense "is telling you"',     text: 'God is telling you to rest.' },
    { name: 'past-tense "told you"',              text: 'The Lord told you to wait.' },
    { name: 'imperative "God wants you to"',      text: 'God wants you to forgive him.' },
    { name: '"the Lord is giving you a word"',    text: 'The Lord is giving you a word about patience.' },
    { name: '"God says to you"',                  text: 'God says to you: be still.' },
    { name: '"the Spirit is saying"',             text: 'The Spirit is saying to you that this season will pass.' },
    { name: '"I sense God is"',                   text: 'I sense God is calling you into deeper rest.' },
    { name: '"God revealed to you"',              text: 'God revealed to you that this is the path.' },
    { name: '"prophetic word over you"',          text: 'A prophetic word over you: a season of new beginnings.' },
    { name: '"your destiny is"',                  text: 'Your destiny is to lead this community.' },
  ];
  for (const c of cases) {
    it(`catches ${c.name}`, () => {
      const hit = BANNED_PHRASES.some(re => re.test(c.text));
      expect(hit, `no banned-phrase regex matched: ${c.text}`).toBe(true);
    });
  }

  it('does NOT match the positive stance language', () => {
    const goodSamples = [
      'Scripture suggests that rest is a gift, not an earning.',
      'This passage may speak to the weariness you have been describing.',
      'For someone walking through what you have described, Psalm 23 often lands as comfort.',
    ];
    for (const s of goodSamples) {
      for (const re of BANNED_PHRASES) {
        expect(re.test(s), `banned regex falsely matched a positive sample: ${s}`).toBe(false);
      }
    }
  });
});

describe('CONTESTED_PASSAGES', () => {
  it('includes the explicit ref list from the spec', () => {
    expect(CONTESTED_PASSAGES).toContain('Revelation 13');
    expect(CONTESTED_PASSAGES).toContain('Romans 9:11');
    expect(CONTESTED_PASSAGES).toContain('1 Timothy 2:12');
    expect(CONTESTED_PASSAGES).toContain('1 Corinthians 11:3');
    expect(CONTESTED_PASSAGES).toContain('Ephesians 1:5');
  });
});

describe('GROWTH_BANNED_PHRASES', () => {
  const cases = [
    '14-day streak',
    "Don't break your streak",
    'keep your streak alive',
    'You missed yesterday',
    'Get back on track',
    'daily streak',
  ];
  for (const c of cases) {
    it(`catches "${c}"`, () => {
      const hit = GROWTH_BANNED_PHRASES.some(re => re.test(c));
      expect(hit).toBe(true);
    });
  }
});

describe('composeSystem', () => {
  it('substitutes {{voice_preference}} with the supplied value', () => {
    const out = composeSystem({
      base: 'Use {{voice_preference}} for the divine name.',
      artifact: '',
      voicePreference: 'Abba',
    });
    expect(out).toContain('Use Abba for the divine name.');
    expect(out).not.toContain('{{voice_preference}}');
  });

  it('replaces every occurrence of the token', () => {
    const out = composeSystem({
      base: '{{voice_preference}} and {{voice_preference}}',
      artifact: '',
      voicePreference: 'Lord',
    });
    expect(out.startsWith('Lord and Lord')).toBe(true);
  });

  it('concatenates base + artifact + stricter with double newlines', () => {
    const out = composeSystem({
      base: 'BASE',
      artifact: 'ARTIFACT',
      voicePreference: 'Lord',
      stricter: 'STRICT',
    });
    expect(out).toBe('BASE\n\nARTIFACT\n\nSTRICT');
  });

  it('omits the stricter section when not supplied', () => {
    const out = composeSystem({
      base: 'BASE',
      artifact: 'ARTIFACT',
      voicePreference: 'Lord',
    });
    expect(out).toBe('BASE\n\nARTIFACT');
  });

  it('substitutes additional {{tokens}} in base and artifact', () => {
    const out = composeSystem({
      base: 'Voice: {{voice_preference}}. Today: {{local_date}}.',
      artifact: 'Date again: {{local_date}}.',
      voicePreference: 'Lord',
      tokens: { local_date: '2026-05-27' },
    });
    expect(out).toContain('Voice: Lord');
    expect(out).toContain('Today: 2026-05-27');
    expect(out).toContain('Date again: 2026-05-27');
  });

  it('leaves unknown {{tokens}} unsubstituted when tokens omitted', () => {
    const out = composeSystem({
      base: 'Voice: {{voice_preference}}. Today: {{local_date}}.',
      artifact: 'artifact',
      voicePreference: 'Father',
    });
    expect(out).toContain('Voice: Father');
    expect(out).toContain('Today: {{local_date}}');
  });
});
