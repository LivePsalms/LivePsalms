// src/notepad-landing/sections/garden-scene/garden-scene.test.tsx
// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GardenScene } from './garden-scene';

// mount-garden depends on WebGL which jsdom does not implement. Stub it.
vi.mock('../../three/garden/mount-garden', () => ({
  mountGarden: () => ({ cleanup: () => {} }),
}));

function renderScene(prm: boolean) {
  return render(
    <MemoryRouter>
      <div className="notepad-landing">
        <GardenScene prm={prm} />
      </div>
    </MemoryRouter>,
  );
}

afterEach(cleanup);

describe('<GardenScene /> — active mode (prm=false)', () => {
  it('renders the canvas, paper overlay, progress nav, and spacer', () => {
    renderScene(false);
    expect(document.querySelector('canvas.garden-canvas')).toBeInTheDocument();
    expect(document.querySelector('.garden-paper-overlay')).toBeInTheDocument();
    expect(document.querySelector('#garden-spacer')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /go to station/i })).toHaveLength(7);
  });

  it('first station has id="section-02" for hero CTA anchor compatibility', () => {
    renderScene(false);
    const target = document.getElementById('section-02');
    expect(target).not.toBeNull();
    expect(target?.className).toContain('garden-station--three-voices');
  });

  it('first station is active on initial render', () => {
    renderScene(false);
    const first = document.querySelector('.garden-station--three-voices');
    expect(first?.className).toContain('active');
  });
});

describe('<GardenScene /> — PRM mode (prm=true)', () => {
  it('does NOT render the canvas, overlay, progress, or spacer', () => {
    renderScene(true);
    expect(document.querySelector('canvas.garden-canvas')).toBeNull();
    expect(document.querySelector('.garden-paper-overlay')).toBeNull();
    expect(document.querySelector('#garden-spacer')).toBeNull();
    expect(screen.queryAllByRole('button', { name: /go to station/i })).toHaveLength(0);
  });

  it('renders all seven section components from FallbackStack', () => {
    renderScene(true);
    // Each fallback section has a known heading from data/copy.ts
    expect(screen.getByRole('heading', { name: /three voices\. one quiet place\./i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /a map of how god has been speaking/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /a companion who’s been reading along/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /the bible, in the margin of your sentence/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /choose the paper that asks/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /the small thing, marked/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /private\. cited\. yours\./i })).toBeInTheDocument();
  });
});

describe('<GardenScene /> — Living Graph station layout', () => {
  it('wraps the Living Graph text and (future) video slot in a .garden-station-pair grid', () => {
    renderScene(false);
    const station = document.querySelector('.garden-station--living-graph');
    expect(station).not.toBeNull();
    const pair = station?.querySelector('.garden-station-pair');
    expect(pair).not.toBeNull();
    expect(pair?.querySelector('.garden-station-content--left')).not.toBeNull();
    expect(pair?.querySelector('.living-graph-video-wrap')).not.toBeNull();
  });
});
