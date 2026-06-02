// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TodaysLampCard, formatLocalDate } from './TodaysLampCard';
import { FakeLamplightAdapter } from '../../storage/fake-lamplight-adapter';
import type { DailyDevotion } from '../../storage/lamplight-artifacts';

afterEach(cleanup);

function renderCard(
  adapter: FakeLamplightAdapter,
  overrides: { autoGenerate?: boolean; firstName?: string | null } = {},
) {
  const { autoGenerate = true, firstName = null } = overrides;
  return render(
    <MemoryRouter>
      <TodaysLampCard
        adapter={adapter}
        userId="user-1"
        localDate="2026-05-27"
        voicePreference="Lord"
        traditionHint="unspecified"
        firstName={firstName}
        autoGenerate={autoGenerate}
      />
    </MemoryRouter>,
  );
}

const devotion: DailyDevotion = {
  opening: 'A quiet greeting, friend.',
  scripture: { ref: 'Psalm 23:4', text: 'Even though I walk through the valley…' },
  reflection: 'This passage may speak to weariness.',
  prompt: 'What part of this verse reaches you today?',
  note_citations: [
    { note_id: 'n1', reason: 'recurring rest' },
    { note_id: 'n2', reason: 'evening anxiety' },
  ],
};

describe('TodaysLampCard', () => {
  it('renders all sections when an artifact exists', async () => {
    const adapter = new FakeLamplightAdapter();
    adapter.__seedDailyDevotion('user-1', '2026-05-27', devotion);
    renderCard(adapter);
    await waitFor(() => expect(screen.getByText(/A quiet greeting/)).toBeInTheDocument());
    expect(screen.getByText(/Psalm 23:4/)).toBeInTheDocument();
    expect(screen.getByText(/Even though I walk/)).toBeInTheDocument();
    expect(screen.getByText(/This passage may speak/)).toBeInTheDocument();
    expect(screen.getByText(/What part of this verse/)).toBeInTheDocument();
    expect(screen.getByText(/recurring rest/)).toBeInTheDocument();
    expect(screen.getByText(/evening anxiety/)).toBeInTheDocument();
  });

  it('renders the voice/tradition footer + edit-prefs link', async () => {
    const adapter = new FakeLamplightAdapter();
    adapter.__seedDailyDevotion('user-1', '2026-05-27', devotion);
    renderCard(adapter);
    await waitFor(() => expect(screen.getByText(/A quiet greeting/)).toBeInTheDocument());
    expect(screen.getByText(/Voice: Lord/)).toBeInTheDocument();
    expect(screen.getByText(/Tradition: unspecified/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Edit preferences/i })).toHaveAttribute('href', '/profile');
  });

  it('formatLocalDate is timezone-safe across boundary months', () => {
    expect(formatLocalDate('2026-05-27')).toBe('May 27');
    expect(formatLocalDate('2026-12-31')).toBe('December 31');
    expect(formatLocalDate('2026-01-01')).toBe('January 1');
  });

  it('shows the error state with retry when generation fails', async () => {
    const adapter = new FakeLamplightAdapter();
    adapter.__queueGenerateResult({ ok: false, reason: 'validators_failed' });
    renderCard(adapter);
    await waitFor(() => expect(screen.getByText(/Lamplight had trouble/i)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /Try again/i })).toBeInTheDocument();
  });
});

const manualDevotion: DailyDevotion = {
  opening: 'op',
  scripture: { ref: 'Psalm 23:4', text: 'though I walk' },
  reflection: 'r',
  prompt: 'p',
  note_citations: [{ note_id: 'n1', reason: 'rest' }],
};

describe('TodaysLampCard (manual start)', () => {
  it('shows the intro instead of generating when autoGenerate=false and nothing is cached', async () => {
    const adapter = new FakeLamplightAdapter();
    const generateSpy = vi.spyOn(adapter, 'generateDailyDevotion');
    renderCard(adapter, { autoGenerate: false });
    expect(await screen.findByRole('button', { name: /Show Me Today's Lamp/i })).toBeInTheDocument();
    expect(generateSpy).not.toHaveBeenCalled();
  });

  it('tapping the button generates once and renders the devotion', async () => {
    const adapter = new FakeLamplightAdapter();
    adapter.__queueGenerateResult({ ok: true, artifact: manualDevotion, cached: false });
    const generateSpy = vi.spyOn(adapter, 'generateDailyDevotion');
    renderCard(adapter, { autoGenerate: false });
    fireEvent.click(await screen.findByRole('button', { name: /Show Me Today's Lamp/i }));
    await waitFor(() => expect(screen.getByText(/though I walk/i)).toBeInTheDocument());
    expect(generateSpy).toHaveBeenCalledTimes(1);
  });
});
