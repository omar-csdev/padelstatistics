import type { ReactNode } from 'react';
import { useSync } from './useSync';

// Mounts the sync listeners (AppState + NetInfo) for the rest of the tree.
// Side-effect only — renders children as-is.
export function SyncBoundary({ children }: { children: ReactNode }) {
  useSync();
// TEMPORARY STUB. Owner: Agent C.
// Will be overwritten by phase2-sync. Do not add logic here.

  return <>{children}</>;
}
