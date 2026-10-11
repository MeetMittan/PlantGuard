import { Leaf } from 'lucide-react';
import { useObjectUrl } from '@/hooks/useObjectUrl';
import { cn } from '@/lib/utils';

/** Lazily decoded thumbnail; only the small stored thumbnail is ever rendered in lists. */
export function ObservationThumb({ blob, alt, className }: { blob: Blob | null; alt: string; className?: string }) {
  const url = useObjectUrl(blob);
  if (!url) {
    return (
      <div className={cn('grid place-items-center bg-forest-soft text-forest', className)} aria-hidden>
        <Leaf className="size-1/3" />
      </div>
    );
  }
  return <img src={url} alt={alt} loading="lazy" decoding="async" className={cn('object-cover', className)} />;
}
