import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, FileText, CheckCircle2, Clock, UploadCloud, ArrowRight, ShieldCheck, Download, ExternalLink, Mail, AlertCircle, Info } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export default function ClientDashboard() {
  const { user } = useAuth();

  const { data: clientInfo, isLoading: isLoadingClient } = useQuery({
    queryKey: ['client-info', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('auth_user_id', user?.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: steps, isLoading: isLoadingSteps } = useQuery({
    queryKey: ['client-steps', clientInfo?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_steps')
        .select('*')
        .eq('client_id', clientInfo?.id)
        .eq('is_visible_to_client', true)
        .order('step_order', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!clientInfo?.id,
  });

  const { data: documents, isLoading: isLoadingDocs } = useQuery({
    queryKey: ['client-documents', clientInfo?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('client_id', clientInfo?.id)
        .eq('is_visible_to_client', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!clientInfo?.id,
  });

  if (isLoadingClient || isLoadingSteps || isLoadingDocs) {
    return (
      <div className="flex flex-col gap-4 justify-center items-center h-[60vh]">
        <Loader2 className="w-12 h-12 animate-spin text-vayase-accent" />
        <p className="text-muted-foreground animate-pulse font-medium">Préparation de votre espace...</p>
      </div>
    );
  }

  const completedSteps = steps?.filter(s => s.status === 'completed' || s.status === 'validated').length || 0;
  const progressPercent = steps?.length ? Math.round((completedSteps / steps.length) * 100) : 0;

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'completed':
      case 'validated':
        return { 
          icon: CheckCircle2, 
          color: 'text-success', 
          bg: 'bg-success/10',
          border: 'border-success/20',
          label: 'Terminé'
        };
      case 'in_progress':
        return { 
          icon: Clock, 
          color: 'text-vayase-accent', 
          bg: 'bg-vayase-accent/10',
          border: 'border-vayase-accent/20',
          label: 'En cours'
        };
      default:
        return { 
          icon: Clock, 
          color: 'text-muted-foreground', 
          bg: 'bg-secondary',
          border: 'border-border',
          label: 'À venir'
        };
    }
  };

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <div className="space-y-10 animate-fade-in">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-hero p-8 md:p-12 text-white border-0 shadow-xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-vayase-accent/20 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="space-y-4 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/10 backdrop-blur-sm text-xs font-semibold uppercase tracking-wider text-vayase-accent">
              <ShieldCheck className="w-3.5 h-3.5" />
              Espace Sécurisé
            </div>
            <h1 className="text-3xl md:text-5xl font-display font-bold tracking-tight">
              Ravi de vous revoir, <span className="text-vayase-accent">{clientInfo?.full_name?.split(' ')[0]}</span>
            </h1>
            <p className="text-white/70 text-lg md:text-xl font-medium max-w-lg leading-relaxed">
              Votre dossier est actuellement en cours de traitement. Voici l'état d'avancement de votre procédure.
            </p>
          </div>
          
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/10 w-full md:w-auto min-w-[240px]">
            <div className="flex justify-between items-end mb-2">
              <span className="text-sm font-semibold text-white/80 uppercase tracking-wide">Progression</span>
              <span className="text-2xl font-display font-bold text-vayase-accent">{progressPercent}%</span>
            </div>
            <Progress value={progressPercent} className="h-3 bg-white/20 mb-4" />
            <div className="flex items-center gap-2 text-sm text-white/60">
              <CheckCircle2 className="w-4 h-4" />
              <span>{completedSteps} sur {steps?.length || 0} étapes validées</span>
            </div>
          </div>
        </div>
      </section>

      {clientInfo?.notes && (
        <Alert className="bg-blue-50 border-blue-200 text-blue-800 animate-fade-in shadow-sm">
          <Info className="h-5 w-5 text-blue-600" />
          <AlertTitle className="text-blue-900 font-semibold">Message de votre conseiller</AlertTitle>
          <AlertDescription className="mt-2 text-sm leading-relaxed whitespace-pre-wrap">
            {clientInfo.notes}
          </AlertDescription>
        </Alert>
      )}

      {steps?.some((s: any) => s.status === 'blocked') && (
        <Alert variant="destructive" className="animate-fade-in shadow-sm">
          <AlertCircle className="h-5 w-5" />
          <AlertTitle className="font-semibold">Action Requise de votre part</AlertTitle>
          <AlertDescription className="mt-2 text-sm leading-relaxed">
            Certaines étapes de votre procédure sont actuellement bloquées ou en attente d'une action de votre part (ex: documents manquants, paiement requis). 
            Veuillez consulter les détails dans la timeline ci-dessous ou contacter votre conseiller.
          </AlertDescription>
        </Alert>
      )}

      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 lg:grid-cols-3 gap-8"
      >
        {/* Timeline Section */}
        <motion.div variants={item} className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-xl font-display font-bold text-gray-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-vayase-accent" />
              Timeline de la Procédure
            </h3>
            <Badge variant="outline" className="bg-white">{steps?.length || 0} Étapes</Badge>
          </div>
          
          <Card className="border-none shadow-card overflow-hidden">
            <CardContent className="p-0">
              {steps && steps.length > 0 ? (
                <div className="divide-y divide-border/50">
                  {steps.map((step: any, index: number) => {
                    const config = getStatusConfig(step.status);
                    const StatusIcon = config.icon;
                    return (
                      <div key={step.id} className="group p-6 hover:bg-gray-50/80 transition-colors flex gap-6">
                        <div className="flex flex-col items-center">
                          <div className={cn(
                            "w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-sm",
                            config.bg, config.color, config.border, "border"
                          )}>
                            <StatusIcon className={cn("w-6 h-6", step.status === 'in_progress' && "animate-spin")} />
                          </div>
                          {index !== steps.length - 1 && (
                            <div className="w-px h-full bg-border my-2 group-hover:bg-vayase-accent/30 transition-colors" />
                          )}
                        </div>
                        <div className="flex-1 space-y-2 py-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <h4 className="font-display font-bold text-gray-900 text-lg">
                              {step.step_name}
                            </h4>
                            <Badge className={cn("text-[10px] uppercase tracking-tighter", config.bg, config.color, "border-0")}>
                              {config.label}
                            </Badge>
                          </div>
                          {step.notes ? (
                            <p className="text-muted-foreground leading-relaxed text-sm">
                              {step.notes}
                            </p>
                          ) : (
                            <p className="text-muted-foreground/50 italic text-sm">Aucun détail supplémentaire pour cette étape.</p>
                          )}
                          {step.due_date && (
                            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground/80 pt-1">
                              <Clock className="w-3.5 h-3.5" />
                              Échéance: {format(new Date(step.due_date), 'dd MMMM yyyy', { locale: fr })}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-12 text-center space-y-4">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto text-gray-400">
                    <Clock className="w-8 h-8" />
                  </div>
                  <p className="text-muted-foreground font-medium">Aucune étape définie pour le moment.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Sidebar content */}
        <motion.div variants={item} className="space-y-8">
          {/* Documents Card */}
          <div className="space-y-4">
            <h3 className="text-xl font-display font-bold text-gray-900 flex items-center gap-2 px-2">
              <FileText className="w-5 h-5 text-vayase-accent" />
              Mes Documents
            </h3>
            <Card className="border-none shadow-card">
              <CardContent className="p-4 space-y-4">
                {documents && documents.length > 0 ? (
                  <div className="space-y-2">
                    {documents.map((doc: any) => (
                      <div key={doc.id} className="group flex items-center justify-between p-3 bg-secondary/30 rounded-xl border border-transparent hover:border-vayase-accent/20 hover:bg-white transition-all">
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className="w-10 h-10 rounded-lg bg-white shadow-sm border border-border flex items-center justify-center text-gray-400 group-hover:text-vayase-accent transition-colors">
                            <FileText className="w-5 h-5" />
                          </div>
                          <div className="overflow-hidden">
                            <p className="font-semibold text-sm text-gray-900 truncate">{doc.name}</p>
                            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                              {format(new Date(doc.created_at), 'dd MMM yyyy', { locale: fr })}
                            </p>
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8 text-muted-foreground hover:text-vayase-accent">
                          <Download className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
                    <p className="text-xs text-muted-foreground font-medium">Aucun document disponible</p>
                  </div>
                )}
                
                <Button className="w-full bg-vayase-accent/10 text-vayase-accent hover:bg-vayase-accent hover:text-vayase-night transition-all font-bold border-0 group shadow-none">
                  <UploadCloud className="w-4 h-4 mr-2" />
                  Envoyer un document
                  <ArrowRight className="w-4 h-4 ml-auto opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Quick Contact Card */}
          <Card className="bg-vayase-night text-white border-0 shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-vayase-accent/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
            <CardHeader className="pb-2 relative z-10">
              <CardTitle className="text-lg">Besoin d'aide ?</CardTitle>
              <CardDescription className="text-white/60 text-xs">
                Contactez votre agent assigné pour toute question sur votre dossier.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 relative z-10">
              <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-vayase-accent/20 flex items-center justify-center text-vayase-accent">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs text-white/50 font-medium">Email de contact</p>
                    <p className="text-sm font-semibold truncate">support@vayase.com</p>
                  </div>
                </div>
              </div>
              <Button className="w-full bg-vayase-accent text-vayase-night font-bold hover:bg-white transition-all shadow-glow">
                Contacter VAYASE
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  );
}
