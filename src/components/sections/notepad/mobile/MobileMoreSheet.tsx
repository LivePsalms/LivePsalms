// src/components/sections/notepad/mobile/MobileMoreSheet.tsx
import { useState } from 'react';
import { WifiOff, Wifi } from 'lucide-react';
import { BacklinksPanel } from '../../../../notepad/components/BacklinksPanel';
import { InfoPanel } from '../../../../notepad/components/InfoPanel';
import { GraphPane } from '../GraphPane';
import { useOnlineStatus } from '../../../../notepad/hooks/useOnlineStatus';
import { Segmented } from './Segmented';

type DetailSegment = 'backlinks' | 'info' | 'graph';

export interface MobileMoreSheetProps {
  open: boolean;
  onClose: () => void;
}

export function MobileMoreSheet({ open, onClose }: MobileMoreSheetProps) {
  const [segment, setSegment] = useState<DetailSegment>('backlinks');
  const isOnline = useOnlineStatus();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" style={{ fontFamily: 'Outfit, sans-serif' }}>
      <button
        aria-label="Close details"
        onClick={onClose}
        className="absolute inset-0"
        style={{ background: 'rgba(0,0,0,0.35)' }}
      />
      <div
        className="relative rounded-t-2xl flex flex-col"
        style={{
          background: 'var(--plaster)',
          maxHeight: '80vh',
          paddingBottom: 'env(safe-area-inset-bottom)',
          boxShadow: '0 -8px 28px rgba(0,0,0,0.18)',
        }}
      >
        <div className="flex justify-center pt-2">
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--pale-stone)' }} />
        </div>

        <div className="px-4 pt-3 pb-2">
          <Segmented<DetailSegment>
            options={[
              { value: 'backlinks', label: 'Backlinks' },
              { value: 'info', label: 'Info' },
              { value: 'graph', label: 'Graph' },
            ]}
            value={segment}
            onChange={setSegment}
          />
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {segment === 'backlinks' && <BacklinksPanel />}
          {segment === 'info' && <InfoPanel />}
          {segment === 'graph' && <GraphPane graphOpen expanded={false} onToggleExpand={() => {}} />}
        </div>

        <footer
          className="shrink-0 flex items-center gap-2 px-4 py-2 text-[11px]"
          style={{ borderTop: '1px solid var(--pale-stone)', color: 'var(--silica)' }}
        >
          {isOnline ? <Wifi size={13} /> : <WifiOff size={13} />}
          {isOnline ? 'Synced' : 'Offline — changes saved locally'}
        </footer>
      </div>
    </div>
  );
}
