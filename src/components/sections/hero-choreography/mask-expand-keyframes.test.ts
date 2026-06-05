import { describe, it, expect } from 'vitest';
import { maskExpandKeyframes, VIDEO_PLAY_AT } from './mask-expand-keyframes';
import { projectFinalFrame } from './keyframes';

describe('maskExpandKeyframes', () => {
  const kfs = maskExpandKeyframes();

  it('grows the clip from 75/45% to 100/100% over the first 0.55', () => {
    const clip = kfs.find((k) => k.target === 'clip');
    expect(clip).toMatchObject({
      from: { width: '75%', height: '45%' },
      to: { width: '100%', height: '100%' },
      at: 0,
      duration: 0.55,
    });
  });

  it('scales the image 1.15 → 1 over the same window', () => {
    const img = kfs.find((k) => k.target === 'img');
    expect(img).toMatchObject({ from: { scale: 1.15 }, to: { scale: 1 }, at: 0, duration: 0.55 });
  });

  it('crossfades the video in at 0.70', () => {
    const video = kfs.find((k) => k.target === 'video' && k.to.opacity === 1);
    expect(video?.at).toBe(0.70);
  });

  it('PLAY-BEFORE-CROSSFADE INVARIANT: playback kicks before the visual crossfade', () => {
    const crossfade = kfs.find((k) => k.target === 'video' && k.to.opacity === 1)!;
    expect(VIDEO_PLAY_AT).toBeLessThan(crossfade.at);
  });

  it('reduced projection = clip full, image at rest, video visible', () => {
    const final = projectFinalFrame(kfs);
    expect(final.clip).toMatchObject({ width: '100%', height: '100%' });
    expect(final.img).toMatchObject({ scale: 1 });
    expect(final.video).toMatchObject({ opacity: 1 });
  });
});
