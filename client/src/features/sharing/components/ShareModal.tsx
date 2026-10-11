import React, { useEffect, useState } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { connectionsApi } from '@/services/api/connectionsApi';
import { sharingApi } from '@/services/api/sharingApi';
import type { UserProfile } from '@/services/api/authApi';
import { Share2, Check } from 'lucide-react';

interface ShareModalProps {
  open: boolean;
  onClose: () => void;
  observationId: string;
}

export function ShareModal({ open, onClose, observationId }: ShareModalProps) {
  const [connections, setConnections] = useState<UserProfile[]>([]);
  const [selectedRecipientId, setSelectedRecipientId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      connectionsApi.listConnections().then((conns) => {
        setConnections(conns);
        if (conns.length > 0 && conns[0]?.id) {
          setSelectedRecipientId(conns[0].id);
        }
      });
      setSuccess(false);
      setError(null);
      setNotes('');
    }
  }, [open]);

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecipientId) return;
    setLoading(true);
    setError(null);

    try {
      await sharingApi.shareObservation(observationId, selectedRecipientId, notes);
      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to share observation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="Share Observation" size="sm">
      {success ? (
        <div className="py-6 text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-full bg-forest-soft text-forest">
            <Check className="size-6" />
          </div>
          <p className="mt-3 text-sm font-semibold text-ink">Observation shared successfully!</p>
        </div>
      ) : (
        <form onSubmit={handleShare} className="space-y-4">
          {error && <div className="rounded-xl bg-flame-soft/30 p-3 text-xs text-flame">{error}</div>}

          {connections.length === 0 ? (
            <div className="rounded-xl border border-line bg-surface/50 p-4 text-center text-xs text-ink-muted">
              You do not have any connections yet. Add friends from the Community tab to share observations!
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs font-medium text-ink-muted">Select Connection</label>
                <select
                  value={selectedRecipientId}
                  onChange={(e) => setSelectedRecipientId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm focus:border-forest focus:outline-none"
                >
                  {connections.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.displayName} (@{c.username})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-muted">Optional Note</label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Hey, could you take a look at these yellowing margins?"
                  className="mt-1 w-full rounded-xl border border-line bg-surface p-3 text-sm focus:border-forest focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !selectedRecipientId}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-forest py-2.5 text-sm font-semibold text-on-forest hover:opacity-90 disabled:opacity-50"
              >
                <Share2 className="size-4" />
                {loading ? 'Sharing...' : 'Share with Connection'}
              </button>
            </>
          )}
        </form>
      )}
    </Dialog>
  );
}
