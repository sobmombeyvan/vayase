import { Outlet, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { BrandLogo } from '@/components/branding/BrandLogo';
import { LogOut, User } from 'lucide-react';

export function ClientLayout() {
  const { user, hasRole, signOut, loading } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center">Chargement...</div>;
  }

  if (!user) {
    return <Navigate to="/client/login" replace />;
  }

  if (!hasRole('client')) {
    // If not a client, they might be an admin, redirect them to admin dashboard
    return <Navigate to="/" replace />;
  }

  const handleSignOut = async () => {
    await signOut();
    navigate('/client/login');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans selection:bg-vayase-accent/30">
      <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <BrandLogo size="sm" />
          
          <div className="flex items-center gap-3 md:gap-6">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/50 border border-border">
              <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
              <span className="text-xs font-medium text-muted-foreground truncate max-w-[150px]">
                {user.email}
              </span>
            </div>
            
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleSignOut} 
              className="text-muted-foreground hover:text-foreground transition-colors group"
            >
              <LogOut className="w-4 h-4 mr-2 group-hover:translate-x-0.5 transition-transform" />
              <span className="hidden xs:inline">Déconnexion</span>
            </Button>
          </div>
        </div>
      </header>
      
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-6 sm:px-6 sm:py-10">
        <Outlet />
      </main>
      
      <footer className="border-t py-6 bg-white/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Vayase Consulting. Tous droits réservés.
          </p>
        </div>
      </footer>
    </div>
  );
}
