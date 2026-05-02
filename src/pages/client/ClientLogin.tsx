import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { BrandLogo } from '@/components/branding/BrandLogo';

export default function ClientLogin() {
  const { user, loading: authLoading, hasRole } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  if (authLoading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-vayase-accent" /></div>;
  }

  // If already logged in
  if (user) {
    if (hasRole('client')) {
      return <Navigate to="/client/dashboard" replace />;
    } else {
      // If admin logged in but trying to hit client login
      return <Navigate to="/" replace />;
    }
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    
    if (error) {
      toast.error('Email ou mot de passe incorrect');
    } else {
      toast.success('Connexion réussie');
      navigate('/client/dashboard');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 relative overflow-hidden p-6">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-vayase-accent/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-500/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="bg-white rounded-2xl p-8 shadow-premium-xl border border-gray-100">
          <div className="flex flex-col items-center mb-8">
            <BrandLogo size="md" className="mb-6" />
            <h1 className="font-display font-bold text-2xl text-gray-900 text-center">Espace Client</h1>
            <p className="text-gray-500 text-sm mt-2 text-center">Connectez-vous pour suivre votre dossier</p>
          </div>

          <form onSubmit={handleSignIn} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-gray-700">Adresse email</Label>
              <Input 
                id="email"
                type="email" 
                required 
                value={email} 
                onChange={e => setEmail(e.target.value)}
                placeholder="votre@email.com"
                className="focus-visible:ring-vayase-accent" 
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-gray-700">Mot de passe</Label>
              </div>
              <Input 
                id="password"
                type="password" 
                required 
                value={password} 
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="focus-visible:ring-vayase-accent" 
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full bg-vayase-night text-white font-semibold hover:bg-gray-800 h-11 mt-2">
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Se connecter
            </Button>
          </form>

          <div className="mt-8 text-center text-sm text-gray-500">
            <p>Problème de connexion ?</p>
            <p className="mt-1">Veuillez contacter votre agent VAYASE.</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
