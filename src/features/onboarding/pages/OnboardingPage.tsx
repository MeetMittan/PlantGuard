import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, ArrowRight, CloudOff, Lock, ScanLine, ShieldAlert, Smartphone } from 'lucide-react';
import { config } from '@/app/config';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { LogoMark } from '@/components/layout/Logo';
import { ModelReadinessCard } from '@/features/settings/components/ModelReadinessCard';
import { useSettings } from '@/features/settings/hooks/useSettings';
import { cn, errorMessage } from '@/lib/utils';
import { useToast } from '@/components/feedback/Toaster';

const STEPS = ['Welcome', 'Offline AI', 'Good to know'] as const;

function Point({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-forest-soft text-forest" aria-hidden>
        {icon}
      </span>
      <div>
        <p className="font-semibold">{title}</p>
        <p className="text-sm text-ink-muted">{children}</p>
      </div>
    </li>
  );
}

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const { settings, update } = useSettings();
  const [name, setName] = useState(settings.displayName);
  const navigate = useNavigate();
  const toast = useToast();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';

  const finish = async () => {
    try {
      await update({ onboardingCompleted: true, displayName: name.trim() });
      navigate(from === '/welcome' ? '/' : from, { replace: true });
    } catch (error) {
      toast.error('Setup could not be saved', errorMessage(error));
    }
  };

  return (
    <div className="min-h-dvh bg-canvas botanical-grain px-4 py-8 sm:py-14">
      <div className="mx-auto max-w-xl">
        <div className="mb-8 flex items-center gap-3">
          <LogoMark className="size-10" />
          <span className="font-display text-xl font-semibold">{config.appName}</span>
        </div>

        <ol className="mb-6 flex gap-2" aria-label="Onboarding progress">
          {STEPS.map((label, index) => (
            <li key={label} className="flex-1">
              <span className={cn('block h-1.5 rounded-full', index <= step ? 'bg-forest' : 'bg-line')} />
              <span className={cn('mt-1.5 block text-xs', index === step ? 'font-semibold text-ink' : 'text-ink-subtle')} aria-current={index === step ? 'step' : undefined}>
                {label}
              </span>
            </li>
          ))}
        </ol>

        <div className="rounded-card border border-line bg-surface p-6 shadow-card sm:p-8">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={step} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.18 }}>
              {step === 0 ? (
                <div className="space-y-6">
                  <div>
                    <h1 className="text-3xl font-semibold">Look after your plants — privately</h1>
                    <p className="mt-2 text-ink-muted">Photograph leaves, get an on-device AI description of possible problems, and keep a simple care routine.</p>
                  </div>
                  <ul className="space-y-4">
                    <Point icon={<Lock className="size-5" />} title="Your photos stay on your device">
                      There is no account and no upload. Observations are stored in this browser.
                    </Point>
                    <Point icon={<ScanLine className="size-5" />} title="Scan, save, and track">
                      Save observations, build a list of your plants, and keep a daily care streak.
                    </Point>
                  </ul>
                  <Field label="What should we call you? (optional)">
                    {(props) => <Input {...props} value={name} maxLength={40} onChange={(event) => setName(event.target.value)} />}
                  </Field>
                </div>
              ) : null}

              {step === 1 ? (
                <div className="space-y-6">
                  <div>
                    <h1 className="text-3xl font-semibold">Works offline — after one download</h1>
                    <p className="mt-2 text-ink-muted">
                      The AI model runs on your device. It needs a one-time download while you are online. You can do this now or later from Settings.
                    </p>
                  </div>
                  <ul className="space-y-4">
                    <Point icon={<CloudOff className="size-5" />} title="On the trail without signal">
                      Once downloaded, the app, the model and your saved data work without a connection. Map backgrounds still need internet.
                    </Point>
                    <Point icon={<Smartphone className="size-5" />} title="Install the app">
                      Use your browser’s “Install app” or “Add to Home Screen” option for quick access, including offline.
                    </Point>
                  </ul>
                  <ModelReadinessCard className="shadow-none" />
                </div>
              ) : null}

              {step === 2 ? (
                <div className="space-y-6">
                  <div>
                    <h1 className="text-3xl font-semibold">What the AI can and can’t do</h1>
                    <p className="mt-2 text-ink-muted">Honest expectations make it more useful.</p>
                  </div>
                  <ul className="space-y-4">
                    <Point icon={<ScanLine className="size-5" />} title="It describes what it sees">
                      It is fairly good at noticing visible signs such as spots or discoloration.
                    </Point>
                    <Point icon={<ShieldAlert className="size-5" />} title="It is not a diagnosis">
                      It is a small general-purpose model, not trained on plant diseases. Plant names and causes are often wrong. For valuable crops or
                      spreading problems, ask a local expert or extension service.
                    </Point>
                  </ul>
                </div>
              ) : null}
            </motion.div>
          </AnimatePresence>

          <div className="mt-8 flex items-center justify-between gap-2">
            {step > 0 ? (
              <Button variant="ghost" icon={<ArrowLeft className="size-4" aria-hidden />} onClick={() => setStep((s) => s - 1)}>
                Back
              </Button>
            ) : (
              <span />
            )}
            {step < STEPS.length - 1 ? (
              <Button onClick={() => setStep((s) => s + 1)}>
                Continue <ArrowRight className="size-4" aria-hidden />
              </Button>
            ) : (
              <Button onClick={() => void finish()}>Start using PlantGuard</Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
