// @vitest-environment jsdom
import { afterEach, describe, it, expect, beforeEach } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FakeLamplightAdapter } from '@/notepad/storage/fake-lamplight-adapter';
import { LamplightSettingsSection } from './LamplightSettingsSection';

afterEach(() => cleanup());

describe('LamplightSettingsSection', () => {
  let adapter: FakeLamplightAdapter;

  beforeEach(() => {
    adapter = new FakeLamplightAdapter();
  });

  it('renders the master toggle off when no settings row exists', async () => {
    render(<LamplightSettingsSection adapter={adapter} userId="user-1" />);
    await waitFor(() => expect(screen.getByLabelText(/lamplight on/i)).toBeInTheDocument());
    expect(screen.getByLabelText(/lamplight on/i)).not.toBeChecked();
  });

  it('upserts settings when the master toggle is flipped on', async () => {
    render(<LamplightSettingsSection adapter={adapter} userId="user-1" />);
    await waitFor(() => screen.getByLabelText(/lamplight on/i));
    fireEvent.click(screen.getByLabelText(/lamplight on/i));
    await waitFor(() => {
      const row = adapter.settings.get('user-1');
      expect(row?.enabled).toBe(true);
    });
  });

  it('opens confirm + calls deleteAllUserData when Forget is confirmed', async () => {
    await adapter.upsertSettings('user-1', { enabled: true });
    render(<LamplightSettingsSection adapter={adapter} userId="user-1" />);
    await waitFor(() => screen.getByRole('button', { name: /forget my lamplight history/i }));
    fireEvent.click(screen.getByRole('button', { name: /forget my lamplight history/i }));
    fireEvent.click(await screen.findByRole('button', { name: /^delete everything$/i }));
    await waitFor(() => {
      expect(adapter.deleteAllUserDataCalls).toEqual(['user-1']);
    });
  });
});
