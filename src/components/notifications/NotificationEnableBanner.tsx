import { useState } from 'react';
import { Bell, X, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import {
  isIosDevice,
  isStandalonePwa,
  notificationSupported,
  setupPushNotifications,
} from '@/lib/push-notifications';

const DISMISS_KEY = 'vayase-notif-banner-dismissed';

export function NotificationEnableBanner() {
  const { user } = useAuth();
  const [hidden, setHidden] = useState(() => localStorage.getItem(DISMISS_KEY) === '1');
  const [loading, setLoading] = useState(false);

  if (hidden || !notificationSupported()) return null;
  if (Notification.permission === 'granted') return null;
  if (Notification.permission === 'denied') return null;

  const ios = isIosDevice();
  const standalone = isStandalonePwa();

  const handleEnable = async () => {
    if (!user?.id) return;
    setLoading(true);
    const { permission } = await setupPushNotifications(user.id);
    setLoading(false);
    if (permission === 'granted') {
      setHidden(true);
      localStorage.setItem(DISMISS_KEY, '1');
    }
  };

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1');
    setHidden(true);
  };

  return (
    <div className={cn(
      'mx-4 mb-3 rounded-2xl border border-vayase-accent/30 bg-gradient-to-br from-vayase-night to-vayase-night-soft',
      'p-4 shadow-lg text-white relative overflow-hidden'
    )}>
      <div className="absolute top-0 right-0 w-32 h-32 bg-vayase-accent/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
      <button
        type="button"
        onClick={dismiss}
        className="absolute top-3 right-3 p-1 rounded-full text-white/50 hover:text-white hover:bg-white/10"
        aria-label="Fermer"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex gap-3 relative">
        <div className="w-10 h-10 rounded-xl bg-vayase-accent/20 flex items-center justify-center shrink-0">
          <Bell className="w-5 h-5 text-vayase-accent" />
        </div>
        <div className="flex-1 min-w-0 pr-6">
          <p className="font-semibold text-sm">Activer les notifications</p>
          {ios && !standalone ? (
            <p className="text-xs text-white/70 mt-1 leading-relaxed flex items-start gap-1.5">
              <Smartphone className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              Sur iPhone : Safari → Partager → <strong>Sur l&apos;écran d&apos;accueil</strong>, puis activez les notifications ici.
            </p>
          ) : (
            <p className="text-xs text-white/70 mt-1">
              Recevez une alerte quand votre conseiller vous écrit, même si l&apos;app est en arrière-plan.
            </p>
          )}
          <Button
            size="sm"
            onClick={handleEnable}
            disabled={loading || (ios && !standalone)}
            className="mt-3 h-8 bg-vayase-accent text-vayase-night hover:bg-vayase-accent/90 font-semibold text-xs"
          >
            {loading ? 'Activation…' : 'Autoriser les notifications'}
          </Button>
        </div>
      </div>
    </div>
  );
}
