import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Loader2, Globe } from 'lucide-react';
import { motion } from 'framer-motion';
import { BrandLogo } from '@/components/branding/BrandLogo';

export default function Auth() {
  const { user, loading: authLoading } = useAuth();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');

  if (authLoading) {
    return <div className="min-h-screen bg-vayase-night" />;
  }

  if (user) return <Navigate to="/" replace />;

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(t('auth.signInError'));
    } else {
      toast.success(t('auth.welcomeBack'));
      navigate('/');
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const redirectUrl = `${window.location.origin}/`;
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: redirectUrl, data: { full_name: fullName } },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(t('auth.signUpSuccess'));
      navigate('/');
    }
  };

  const toggleLang = () => i18n.changeLanguage(i18n.language === 'fr' ? 'en' : 'fr');

  return (
    <div className="min-h-screen flex bg-gradient-hero relative overflow-hidden">
      {/* Decorative orbs */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-vayase-accent/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-vayase-accent/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none" />

      {/* Left side - Brand */}
      <motion.div 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="hidden lg:flex flex-col justify-between p-12 w-1/2 relative z-10"
      >
        <BrandLogo size="lg" textClassName="text-white text-xl" subtitleClassName="text-white/60 text-xs" />

        <div className="space-y-6">
          <h1 className="font-display font-bold text-5xl text-white leading-[1.05] tracking-tight">
            La plateforme<br />
            <span className="vayase-gradient-text">premium</span> de gestion<br />
            d'agence d'immigration
          </h1>
          <p className="text-white/70 text-lg max-w-md leading-relaxed">
            Pilotez vos prospects, clients, dossiers et finances dans un environnement sécurisé et élégant.
          </p>
          <div className="flex gap-8 pt-4">
            {[
              { value: '100%', label: 'Sécurisé' },
              { value: 'RBAC', label: 'Permissions' },
              { value: '24/7', label: 'Disponible' },
            ].map(s => (
              <div key={s.label}>
                <div className="font-display font-bold text-2xl text-white">{s.value}</div>
                <div className="text-white/50 text-xs uppercase tracking-wider">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="text-white/40 text-sm">© {new Date().getFullYear()} VAYASE Consulting. Tous droits réservés.</div>
      </motion.div>

      {/* Right side - Form */}
      <motion.div 
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        className="flex-1 flex items-center justify-center p-6 lg:p-12 relative z-10"
      >
        <div className="w-full max-w-md">
          <div className="flex items-center justify-between mb-8">
            <div className="lg:hidden flex items-center gap-2.5">
              <BrandLogo size="sm" textClassName="text-white text-lg" subtitleClassName="text-white/50" />
            </div>
            <Button variant="ghost" size="sm" onClick={toggleLang} className="text-white/70 hover:text-white hover:bg-white/10 ml-auto">
              <Globe className="w-4 h-4 mr-2" />
              {i18n.language.toUpperCase()}
            </Button>
          </div>

          <div className="vayase-glass rounded-2xl p-8 shadow-premium-xl">
            <Tabs defaultValue="signin">
              <TabsList className="grid grid-cols-2 mb-6 bg-white/5 border border-white/10">
                <TabsTrigger value="signin" className="data-[state=active]:bg-white data-[state=active]:text-vayase-night">
                  {t('auth.signIn')}
                </TabsTrigger>
                <TabsTrigger value="signup" className="data-[state=active]:bg-white data-[state=active]:text-vayase-night">
                  {t('auth.signUp')}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <div className="mb-6">
                  <h2 className="font-display font-bold text-2xl text-white mb-1">{t('auth.welcomeBack')}</h2>
                  <p className="text-white/60 text-sm">{t('auth.signInSubtitle')}</p>
                </div>
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div>
                    <Label className="text-white/80">{t('auth.email')}</Label>
                    <Input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                      className="mt-1.5 bg-white/5 border-white/10 text-white placeholder:text-white/40 focus-visible:ring-vayase-accent" />
                  </div>
                  <div>
                    <Label className="text-white/80">{t('auth.password')}</Label>
                    <Input type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)}
                      className="mt-1.5 bg-white/5 border-white/10 text-white placeholder:text-white/40 focus-visible:ring-vayase-accent" />
                  </div>
                  <Button type="submit" disabled={loading} className="w-full bg-gradient-accent text-vayase-night font-semibold hover:opacity-90 shadow-glow">
                    {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {t('auth.signIn')}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <div className="mb-6">
                  <h2 className="font-display font-bold text-2xl text-white mb-1">{t('auth.signUp')}</h2>
                  <p className="text-white/60 text-sm">{t('auth.signUpSubtitle')}</p>
                </div>
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div>
                    <Label className="text-white/80">{t('auth.fullName')}</Label>
                    <Input required value={fullName} onChange={e => setFullName(e.target.value)}
                      className="mt-1.5 bg-white/5 border-white/10 text-white placeholder:text-white/40 focus-visible:ring-vayase-accent" />
                  </div>
                  <div>
                    <Label className="text-white/80">{t('auth.email')}</Label>
                    <Input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                      className="mt-1.5 bg-white/5 border-white/10 text-white placeholder:text-white/40 focus-visible:ring-vayase-accent" />
                  </div>
                  <div>
                    <Label className="text-white/80">{t('auth.password')}</Label>
                    <Input type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)}
                      className="mt-1.5 bg-white/5 border-white/10 text-white placeholder:text-white/40 focus-visible:ring-vayase-accent" />
                  </div>
                  <Button type="submit" disabled={loading} className="w-full bg-gradient-accent text-vayase-night font-semibold hover:opacity-90 shadow-glow">
                    {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {t('auth.signUp')}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
