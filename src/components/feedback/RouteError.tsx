import { isRouteErrorResponse, Link, useRouteError } from 'react-router';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';
import { Button, buttonClasses } from '@/components/ui/Button';
import { errorMessage } from '@/lib/utils';

/** Route-level error boundary: a crash in one screen never blanks the whole app. */
export function RouteError() {
  const error = useRouteError();
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  const chunkFailed = error instanceof Error && /dynamically imported module|Loading chunk|Failed to fetch/i.test(error.message);

  return (
    <div className="mx-auto flex min-h-[60dvh] max-w-md flex-col items-center justify-center px-6 text-center">
      <div className="grid size-14 place-items-center rounded-2xl bg-clay-soft text-clay" aria-hidden>
        <AlertTriangle className="size-7" />
      </div>
      <h1 className="mt-4 text-2xl font-semibold">{notFound ? 'Page not found' : 'Something went wrong'}</h1>
      <p className="mt-2 text-sm text-ink-muted">
        {notFound
          ? 'This page does not exist.'
          : chunkFailed
            ? 'Part of the app could not be loaded. If you are offline, open PlantGuard once while online so every screen is cached.'
            : errorMessage(error, 'An unexpected error occurred. Your saved data is safe.')}
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Link to="/" className={buttonClasses('secondary')}>
          <Home className="size-4" aria-hidden /> Home
        </Link>
        <Button icon={<RefreshCw className="size-4" aria-hidden />} onClick={() => window.location.reload()}>
          Reload
        </Button>
      </div>
    </div>
  );
}
