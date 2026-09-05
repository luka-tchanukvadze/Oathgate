'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { KeyMode } from '@/types';

interface ModeContextValue {
  mode: KeyMode;
  setMode: (mode: KeyMode) => void;
  isTest: boolean;
}

const ModeContext = createContext<ModeContextValue | null>(null);

// Test or live is the one piece of genuinely global client state in this app.
// Everything else is server state and belongs to the query cache
export function ModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<KeyMode>('TEST');

  // Mainnet is not activated, so LIVE is not a state this app can be in
  // A stored LIVE from a build where the switch still worked would otherwise
  // create live payments while the header carried on showing Testnet
  useEffect(() => {
    const stored = localStorage.getItem('oathgate-mode');
    if (stored === 'TEST') return;
    if (stored) localStorage.removeItem('oathgate-mode');
  }, []);

  const setMode = useCallback((next: KeyMode) => {
    setModeState(next);
    localStorage.setItem('oathgate-mode', next);
  }, []);

  const value = useMemo(() => ({ mode, setMode, isTest: mode === 'TEST' }), [mode, setMode]);

  return <ModeContext.Provider value={value}>{children}</ModeContext.Provider>;
}

export function useMode() {
  const context = useContext(ModeContext);
  if (!context) throw new Error('useMode must be used inside ModeProvider');
  return context;
}
