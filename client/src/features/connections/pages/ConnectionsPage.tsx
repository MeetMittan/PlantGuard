import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/features/auth/AuthContext';
import { connectionsApi, type ConnectionRequestEntity } from '@/services/api/connectionsApi';
import type { UserProfile } from '@/services/api/authApi';
import { Users, UserPlus, Clock, Search, ShieldAlert, Check, X, UserMinus } from 'lucide-react';

export default function ConnectionsPage() {
  const { isAuthenticated } = useAuth();
  const [tab, setTab] = useState<'connections' | 'requests' | 'search'>('connections');
  const [connections, setConnections] = useState<UserProfile[]>([]);
  const [incoming, setIncoming] = useState<ConnectionRequestEntity[]>([]);
  const [outgoing, setOutgoing] = useState<ConnectionRequestEntity[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const [conns, inc, out] = await Promise.all([
        connectionsApi.listConnections(),
        connectionsApi.getIncomingRequests(),
        connectionsApi.getOutgoingRequests(),
      ]);
      setConnections(conns);
      setIncoming(inc);
      setOutgoing(out);
    } catch {
      // offline or error
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setLoading(true);
    try {
      const results = await connectionsApi.searchUsers(searchQuery.trim());
      setSearchResults(results);
    } finally {
      setLoading(false);
    }
  };

  const handleSendRequest = async (targetId: string) => {
    try {
      await connectionsApi.sendRequest(targetId);
      setMessage('Connection request sent!');
      setTimeout(() => setMessage(null), 3000);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to send request');
    }
  };

  const handleAccept = async (id: string) => {
    await connectionsApi.acceptRequest(id);
    loadData();
  };

  const handleDecline = async (id: string) => {
    await connectionsApi.declineRequest(id);
    loadData();
  };

  const handleCancel = async (id: string) => {
    await connectionsApi.cancelRequest(id);
    loadData();
  };

  const handleRemove = async (id: string) => {
    if (confirm('Are you sure you want to remove this connection?')) {
      await connectionsApi.removeConnection(id);
      loadData();
    }
  };

  const handleBlock = async (id: string) => {
    if (confirm('Are you sure you want to block this user?')) {
      await connectionsApi.blockUser(id);
      loadData();
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="rounded-3xl border border-line bg-surface p-8 text-center">
        <Users className="mx-auto size-12 text-forest/40" />
        <h2 className="mt-4 font-display text-xl font-bold">Gardener Community</h2>
        <p className="mt-2 text-sm text-ink-muted">
          Sign in to connect with other plant caretakers, share leaf observations, and collaborate.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">Community & Connections</h1>
        <p className="text-sm text-ink-muted">
          Connect with trusted gardeners to privately share plant diagnosis observations and advice.
        </p>
      </div>

      {message && (
        <div className="rounded-2xl bg-forest-soft p-3 text-xs font-medium text-forest">
          {message}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-line text-sm font-medium">
        <button
          type="button"
          onClick={() => setTab('connections')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 transition-colors ${
            tab === 'connections'
              ? 'border-forest text-forest font-semibold'
              : 'border-transparent text-ink-muted hover:text-ink'
          }`}
        >
          <Users className="size-4" />
          Connections ({connections.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('requests')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 transition-colors ${
            tab === 'requests'
              ? 'border-forest text-forest font-semibold'
              : 'border-transparent text-ink-muted hover:text-ink'
          }`}
        >
          <Clock className="size-4" />
          Requests ({incoming.length + outgoing.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('search')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 transition-colors ${
            tab === 'search'
              ? 'border-forest text-forest font-semibold'
              : 'border-transparent text-ink-muted hover:text-ink'
          }`}
        >
          <Search className="size-4" />
          Find Gardeners
        </button>
      </div>

      {/* Tab: Connections */}
      {tab === 'connections' && (
        <div className="space-y-4">
          {connections.length === 0 ? (
            <div className="rounded-2xl border border-line bg-surface/50 p-8 text-center text-ink-muted">
              <p>You haven't added any connections yet.</p>
              <button
                type="button"
                onClick={() => setTab('search')}
                className="mt-3 inline-flex items-center gap-2 rounded-xl bg-forest px-4 py-2 text-xs font-medium text-on-forest"
              >
                <UserPlus className="size-4" />
                Find gardeners to connect with
              </button>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {connections.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-2xl border border-line bg-surface p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="grid size-10 place-items-center rounded-full bg-forest-soft text-sm font-bold text-forest">
                      {c.displayName[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-ink">{c.displayName}</p>
                      <p className="text-xs text-ink-subtle">@{c.username}</p>
                      {c.bio && <p className="mt-0.5 line-clamp-1 text-xs text-ink-muted">{c.bio}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleRemove(c.id)}
                      title="Disconnect"
                      className="rounded-lg p-2 text-ink-subtle hover:bg-surface-muted hover:text-ink"
                    >
                      <UserMinus className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBlock(c.id)}
                      title="Block User"
                      className="rounded-lg p-2 text-ink-subtle hover:bg-flame-soft hover:text-flame"
                    >
                      <ShieldAlert className="size-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Requests */}
      {tab === 'requests' && (
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-ink">Incoming Requests ({incoming.length})</h3>
            {incoming.length === 0 ? (
              <p className="mt-2 text-xs text-ink-muted">No pending incoming requests.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {incoming.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between rounded-2xl border border-line bg-surface p-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-ink">{r.requesterId.displayName}</p>
                      <p className="text-xs text-ink-subtle">@{r.requesterId.username}</p>
                      {r.message && <p className="text-xs text-ink-muted">"{r.message}"</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleAccept(r.id)}
                        className="flex items-center gap-1 rounded-xl bg-forest px-3 py-1.5 text-xs font-semibold text-on-forest hover:opacity-90"
                      >
                        <Check className="size-3.5" />
                        Accept
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDecline(r.id)}
                        className="rounded-xl border border-line px-3 py-1.5 text-xs font-medium text-ink-muted hover:bg-surface-muted"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="text-sm font-semibold text-ink">Sent Requests ({outgoing.length})</h3>
            {outgoing.length === 0 ? (
              <p className="mt-2 text-xs text-ink-muted">No pending outgoing requests.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {outgoing.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between rounded-2xl border border-line bg-surface p-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-ink">{r.recipientId.displayName}</p>
                      <p className="text-xs text-ink-subtle">@{r.recipientId.username}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCancel(r.id)}
                      className="rounded-xl border border-line px-3 py-1.5 text-xs font-medium text-ink-muted hover:bg-surface-muted"
                    >
                      Cancel
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Search */}
      {tab === 'search' && (
        <div className="space-y-4">
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by username or name..."
              className="flex-1 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm focus:border-forest focus:outline-none"
            />
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-forest px-5 py-2.5 text-sm font-semibold text-on-forest hover:opacity-90 disabled:opacity-50"
            >
              Search
            </button>
          </form>

          {searchResults.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {searchResults.map((u) => {
                const isAlreadyConn = connections.some((c) => c.id === u.id);
                return (
                  <div
                    key={u.id}
                    className="flex items-center justify-between rounded-2xl border border-line bg-surface p-4"
                  >
                    <div>
                      <p className="text-sm font-semibold text-ink">{u.displayName}</p>
                      <p className="text-xs text-ink-subtle">@{u.username}</p>
                      {u.bio && <p className="mt-0.5 line-clamp-1 text-xs text-ink-muted">{u.bio}</p>}
                    </div>
                    {isAlreadyConn ? (
                      <span className="rounded-full bg-forest-soft px-3 py-1 text-xs font-medium text-forest">
                        Connected
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSendRequest(u.id)}
                        className="flex items-center gap-1.5 rounded-xl bg-forest px-3 py-1.5 text-xs font-medium text-on-forest hover:opacity-90"
                      >
                        <UserPlus className="size-3.5" />
                        Connect
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
