import { Suspense, useState } from 'react';
import { RouterProvider } from 'react-router';
import { PageFallback } from '@/components/layout/PageFallback';
import { AppProviders } from './providers';
import { createAppRouter } from './router';

export function App() {
  const [router] = useState(createAppRouter);
  return (
    <AppProviders>
      <Suspense fallback={<PageFallback />}>
        <RouterProvider router={router} />
      </Suspense>
    </AppProviders>
  );
}
