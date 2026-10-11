import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/features/auth/AuthContext';
import { notificationsApi, type NotificationEntity } from '@/services/api/notificationsApi';
import { Bell, CheckCheck, Trash2 } from 'lucide-react';
import { formatDate } from '@/lib/format';

export default function NotificationsPage() {
  const { isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState<NotificationEntity[]>([]);

  const loadNotifications = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const data = await notificationsApi.list();
      setNotifications(data);
    } catch {
      // ignore
    }
  }, [isAuthenticated]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleMarkAllRead = async () => {
    await notificationsApi.markAllAsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const handleMarkRead = async (id: string) => {
    await notificationsApi.markAsRead(id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
  };

  const handleDelete = async (id: string) => {
    await notificationsApi.delete(id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  if (!isAuthenticated) {
    return (
      <div className="rounded-3xl border border-line bg-surface p-8 text-center">
        <Bell className="mx-auto size-12 text-forest/40" />
        <h2 className="mt-4 font-display text-xl font-bold">Notifications Inbox</h2>
        <p className="mt-2 text-sm text-ink-muted">Sign in to view your garden activity and alerts.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">Inbox & Alerts</h1>
          <p className="text-sm text-ink-muted">Stay informed on care tasks, shared observations, and connection updates.</p>
        </div>
        {notifications.some((n) => !n.isRead) && (
          <button
            type="button"
            onClick={handleMarkAllRead}
            className="flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface-muted"
          >
            <CheckCheck className="size-4 text-forest" />
            Mark all as read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface/50 p-8 text-center text-ink-muted">
          <p>You have no notifications right now.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`flex items-start justify-between rounded-2xl border p-4 transition-colors ${
                n.isRead ? 'border-line bg-surface' : 'border-forest/30 bg-forest-soft/20'
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-ink">{n.title}</h3>
                  {!n.isRead && (
                    <span className="size-2 rounded-full bg-forest" />
                  )}
                </div>
                <p className="text-xs text-ink-muted">{n.message}</p>
                <p className="text-[11px] text-ink-subtle">{formatDate(n.createdAt)}</p>
              </div>
              <div className="flex items-center gap-1">
                {!n.isRead && (
                  <button
                    type="button"
                    onClick={() => handleMarkRead(n.id)}
                    title="Mark as read"
                    className="rounded-lg p-2 text-ink-subtle hover:bg-surface-muted hover:text-ink"
                  >
                    <CheckCheck className="size-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleDelete(n.id)}
                  title="Delete"
                  className="rounded-lg p-2 text-ink-subtle hover:bg-surface-muted hover:text-ink"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

