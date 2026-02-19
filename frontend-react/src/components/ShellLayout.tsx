import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { AppShell } from '@/components/AppShell.js';
import { GuidedTour } from '@/tour/index.js';

export function ShellLayout() {
  return (
    <AppShell>
      <GuidedTour />
      <Suspense
        fallback={
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 200,
              color: 'var(--color-text-muted, #94a3b8)',
            }}
          >
            Loading…
          </div>
        }
      >
        <Outlet />
      </Suspense>
    </AppShell>
  );
}
