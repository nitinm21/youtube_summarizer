import { Suspense } from 'react';
import { LoadingSpinner } from './components/common/LoadingSpinner';
import HomeClient from './HomeClient';

export default function Page() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: '100vh',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <LoadingSpinner />
        </div>
      }
    >
      <HomeClient />
    </Suspense>
  );
}

