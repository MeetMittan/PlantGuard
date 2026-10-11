import React, { useState } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { useAuth } from './AuthContext';
import { Sparkles, User, Lock, Mail, AlertCircle } from 'lucide-react';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
}

export function AuthModal({ open, onClose }: AuthModalProps) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [loginInput, setLoginInput] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        await login({ login: loginInput, password });
      } else {
        await register({ username, email, password, displayName });
      }
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || err.message || 'Authentication failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDemoFill = () => {
    setMode('login');
    setLoginInput('demo@plantguard.internal');
    setPassword('PlantGuardDemo123!');
    setError(null);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={mode === 'login' ? 'Sign in to PlantGuard' : 'Create an Account'}
      size="sm"
    >
      <div className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 rounded-xl bg-flame-soft/30 p-3 text-xs text-flame">
            <AlertCircle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === 'register' && (
            <>
              <div>
                <label className="block text-xs font-medium text-ink-muted">Display Name</label>
                <div className="relative mt-1">
                  <User className="absolute left-3 top-2.5 size-4 text-ink-subtle" />
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Botanist Bob"
                    className="w-full rounded-xl border border-line bg-surface py-2 pl-9 pr-3 text-sm focus:border-forest focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-muted">Username</label>
                <div className="relative mt-1">
                  <User className="absolute left-3 top-2.5 size-4 text-ink-subtle" />
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="botanist_bob"
                    className="w-full rounded-xl border border-line bg-surface py-2 pl-9 pr-3 text-sm focus:border-forest focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-muted">Email</label>
                <div className="relative mt-1">
                  <Mail className="absolute left-3 top-2.5 size-4 text-ink-subtle" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="bob@example.com"
                    className="w-full rounded-xl border border-line bg-surface py-2 pl-9 pr-3 text-sm focus:border-forest focus:outline-none"
                  />
                </div>
              </div>
            </>
          )}

          {mode === 'login' && (
            <div>
              <label className="block text-xs font-medium text-ink-muted">Username or Email</label>
              <div className="relative mt-1">
                <Mail className="absolute left-3 top-2.5 size-4 text-ink-subtle" />
                <input
                  type="text"
                  required
                  value={loginInput}
                  onChange={(e) => setLoginInput(e.target.value)}
                  placeholder="demo@plantguard.internal"
                  className="w-full rounded-xl border border-line bg-surface py-2 pl-9 pr-3 text-sm focus:border-forest focus:outline-none"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-ink-muted">Password</label>
            <div className="relative mt-1">
              <Lock className="absolute left-3 top-2.5 size-4 text-ink-subtle" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-line bg-surface py-2 pl-9 pr-3 text-sm focus:border-forest focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-forest py-2.5 text-sm font-semibold text-on-forest transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div className="relative my-2">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-line" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-surface px-2 text-ink-subtle">Or</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleDemoFill}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-forest/30 bg-forest-soft/30 py-2 text-xs font-medium text-forest hover:bg-forest-soft/50"
        >
          <Sparkles className="size-3.5" />
          Fill Demo Account Credentials
        </button>

        <div className="text-center text-xs text-ink-muted">
          {mode === 'login' ? (
            <p>
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setError(null);
                }}
                className="font-medium text-forest hover:underline"
              >
                Sign up
              </button>
            </p>
          ) : (
            <p>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError(null);
                }}
                className="font-medium text-forest hover:underline"
              >
                Sign in
              </button>
            </p>
          )}
        </div>
      </div>
    </Dialog>
  );
}

