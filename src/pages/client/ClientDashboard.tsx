import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Loader2, FileText, CheckCircle2, Clock, UploadCloud,
  ShieldCheck, Download, Mail, AlertCircle, Info, MessageSquare, ChevronRight,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';

export default function ClientDashboard() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const [uploadingDocId, setUploadingDocId] = useState<string | null>(null);

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

  const handleUploadDocument = async (e: React.ChangeEvent<HTMLInputElement>, pendingDocId?: string) => {
    if (!e.target.files?.length || !clientInfo) return;
    const file = e.target.files[0];
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Le fichier est trop volumineux (max 5MB)');
      e.target.value = '';
      return;
    }

    const docName = pendingDocId
      ? documents?.find((d) => d.id === pendingDocId)?.name
      : prompt('Nom du document (ex: Passeport) :', file.name);
    if (!docName) {
      e.target.value = '';
      return;
    }

    setUploadingDocId(pendingDocId || 'new');
    const fileExt = file.name.split('.').pop();
    const cleanDocName = docName.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
    const fileName = `${clientInfo.id}/${cleanDocName}_${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('client-documents')
      .upload(fileName, file);

    if (uploadError) {
      setUploadingDocId(null);
      e.target.value = '';
      toast.error("Erreur lors de l'upload: " + uploadError.message);
      return;
    }

    if (pendingDocId) {
      const { error: dbError } = await supabase.from('documents').update({
        file_path: fileName,
        file_size: file.size,
        mime_type: file.type,
      }).eq('id', pendingDocId);
      if (dbError) toast.error("Erreur d'enregistrement: " + dbError.message);
      else toast.success('Document soumis avec succès !');
    } else {
      const { error: dbError } = await supabase.from('documents').insert({
        client_id: clientInfo.id,
        name: docName,
        category: 'other',
        file_path: fileName,
        file_size: file.size,
        mime_type: file.type,
        is_visible_to_client: true,
        uploaded_by: user?.id,
      });
      if (dbError) toast.error("Erreur d'enregistrement: " + dbError.message);
      else toast.success('Document envoyé avec succès !');
    }

    setUploadingDocId(null);
    queryClient.invalidateQueries({ queryKey: ['client-documents'] });
    e.target.value = '';
  };

  const handleDownloadDocument = async (doc: { file_path: string; name: string }) => {
    if (doc.file_path === 'pending') return;
    const { data, error } = await supabase.storage
      .from('client-documents')
      .createSignedUrl(doc.file_path, 3600, { download: doc.name });
    if (error) return toast.error("Impossible d'accéder au fichier: " + error.message);
    window.location.href = data.signedUrl;
  };

  if (isLoadingClient || isLoadingSteps || isLoadingDocs) {
    return (
      <div className="flex flex-col gap-4 justify-center items-center min-h-[60dvh]">
        <Loader2 className="w-10 h-10 animate-spin text-vayase-accent" />
        <p className="text-sm text-muted-foreground">Préparation de votre espace...</p>
      </div>
    );
  }

  const completedSteps = steps?.filter((s) => s.status === 'completed' || s.status === 'validated').length || 0;
  const progressPercent = steps?.length ? Math.round((completedSteps / steps.length) * 100) : 0;
  const firstName = clientInfo?.full_name?.split(' ')[0] || 'Client';
  const hasBlocked = steps?.some((s) => s.status === 'blocked');
  const pendingDocs = documents?.filter((d) => d.file_path === 'pending').length || 0;

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'completed':
      case 'validated':
        return { icon: CheckCircle2, color: 'text-success', bg: 'bg-success/10', label: 'Terminé' };
      case 'in_progress':
        return { icon: Clock, color: 'text-vayase-accent', bg: 'bg-vayase-accent/10', label: 'En cours' };
      default:
        return { icon: Clock, color: 'text-muted-foreground', bg: 'bg-secondary', label: 'À venir' };
    }
  };

  const alertsBlock = (
    <>
      {clientInfo?.notes && (
        <Alert className="bg-blue-50 border-blue-200 text-blue-800 rounded-2xl">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertTitle className="text-blue-900 font-semibold text-sm">Message conseiller</AlertTitle>
          <AlertDescription className="text-xs leading-relaxed whitespace-pre-wrap mt-1">
            {clientInfo.notes}
          </AlertDescription>
        </Alert>
      )}
      {hasBlocked && (
        <Alert variant="destructive" className="rounded-2xl">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle className="text-sm font-semibold">Action requise</AlertTitle>
          <AlertDescription className="text-xs mt-1">
            Certaines étapes nécessitent votre attention. Consultez la procédure ou contactez votre conseiller.
          </AlertDescription>
        </Alert>
      )}
    </>
  );

  const stepsBlock = (
    <div className="space-y-3">
      {steps && steps.length > 0 ? (
        steps.map((step) => {
          const config = getStatusConfig(step.status);
          const StatusIcon = config.icon;
          return (
            <div
              key={step.id}
              className={cn(
                'flex gap-3 p-4 rounded-2xl border bg-card transition-colors',
                step.status === 'in_progress' && 'border-vayase-accent/30 bg-vayase-accent/5'
              )}
            >
              <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', config.bg, config.color)}>
                <StatusIcon className={cn('w-5 h-5', step.status === 'in_progress' && 'animate-pulse')} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-semibold text-sm leading-tight">{step.step_name}</h4>
                  <Badge variant="secondary" className={cn('text-[9px] shrink-0', config.bg, config.color, 'border-0')}>
                    {config.label}
                  </Badge>
                </div>
                {step.notes && (
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{step.notes}</p>
                )}
                {step.due_date && (
                  <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {format(new Date(step.due_date), 'dd MMM yyyy', { locale: fr })}
                  </p>
                )}
              </div>
            </div>
          );
        })
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Aucune étape pour le moment</p>
        </div>
      )}
    </div>
  );

  const docsBlock = (
    <div className="space-y-3">
      {documents && documents.length > 0 ? (
        documents.map((doc) => (
          <div
            key={doc.id}
            className="flex items-center gap-3 p-3.5 rounded-2xl border bg-card active:scale-[0.98] transition-transform"
          >
            <div className="w-11 h-11 rounded-xl bg-secondary flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5 text-vayase-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{doc.name}</p>
              <p className="text-[10px] text-muted-foreground">
                {format(new Date(doc.created_at), 'dd MMM yyyy', { locale: fr })}
                {doc.file_path === 'pending' && (
                  <Badge variant="outline" className="ml-2 text-[9px] h-4">À envoyer</Badge>
                )}
              </p>
            </div>
            {doc.file_path === 'pending' ? (
              <>
                <input
                  type="file"
                  id={`upload-${doc.id}`}
                  className="hidden"
                  onChange={(e) => handleUploadDocument(e, doc.id)}
                  disabled={uploadingDocId === doc.id}
                />
                <label
                  htmlFor={`upload-${doc.id}`}
                  className="flex items-center justify-center h-10 px-3 rounded-xl bg-vayase-accent text-vayase-night text-xs font-semibold cursor-pointer shrink-0"
                >
                  {uploadingDocId === doc.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <UploadCloud className="w-4 h-4" />
                  )}
                </label>
              </>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 shrink-0"
                onClick={() => handleDownloadDocument(doc)}
              >
                <Download className="w-4 h-4" />
              </Button>
            )}
          </div>
        ))
      ) : (
        <div className="text-center py-10 text-muted-foreground border border-dashed rounded-2xl">
          <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Aucun document</p>
        </div>
      )}

      <div className="pt-2">
        <input
          type="file"
          id="client-doc-upload"
          className="hidden"
          onChange={(e) => handleUploadDocument(e)}
          disabled={uploadingDocId === 'new'}
        />
        <label
          htmlFor="client-doc-upload"
          className="flex items-center justify-center gap-2 w-full h-12 rounded-2xl bg-vayase-accent/10 text-vayase-accent font-semibold text-sm cursor-pointer active:scale-[0.98] transition-transform"
        >
          {uploadingDocId === 'new' ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <UploadCloud className="w-4 h-4" />
          )}
          Envoyer un document
        </label>
      </div>
    </div>
  );

  const progressCard = (
    <Card className="border-0 shadow-md overflow-hidden rounded-2xl bg-gradient-hero text-white">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="w-4 h-4 text-vayase-accent" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-vayase-accent">
            Espace sécurisé
          </span>
        </div>
        <h1 className="text-xl font-display font-bold leading-tight">
          Bonjour, <span className="text-vayase-accent">{firstName}</span>
        </h1>
        <p className="text-white/60 text-xs mt-1 mb-4">
          {clientInfo?.destination_country || 'Votre dossier'} · {clientInfo?.visa_type || 'En cours'}
        </p>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-white/70">Progression</span>
          <span className="text-lg font-bold text-vayase-accent">{progressPercent}%</span>
        </div>
        <Progress value={progressPercent} className="h-2 bg-white/20" />
        <p className="text-[10px] text-white/50 mt-2">
          {completedSteps}/{steps?.length || 0} étapes validées
        </p>
      </CardContent>
    </Card>
  );

  const quickActions = (
    <div className="grid grid-cols-2 gap-3">
      <Link
        to="/client/messages"
        className="flex items-center gap-3 p-4 rounded-2xl bg-card border shadow-sm active:scale-[0.98] transition-transform"
      >
        <div className="w-10 h-10 rounded-xl bg-vayase-accent/15 flex items-center justify-center">
          <MessageSquare className="w-5 h-5 text-vayase-accent" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">Messages</p>
          <p className="text-[10px] text-muted-foreground">Conseiller</p>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
      </Link>
      <a
        href="mailto:contact@vayaseconsulting.com"
        className="flex items-center gap-3 p-4 rounded-2xl bg-card border shadow-sm active:scale-[0.98] transition-transform"
      >
        <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
          <Mail className="w-5 h-5 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">Contact</p>
          <p className="text-[10px] text-muted-foreground truncate">VAYASE</p>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
      </a>
    </div>
  );

  if (isMobile) {
    return (
      <div className="space-y-4 pb-2 animate-fade-in">
        <Tabs defaultValue="home" className="w-full">
          <TabsList className="grid w-full grid-cols-3 h-11 rounded-xl p-1 bg-secondary/60 sticky top-0 z-10">
            <TabsTrigger value="home" className="rounded-lg text-xs font-semibold">Accueil</TabsTrigger>
            <TabsTrigger value="steps" className="rounded-lg text-xs font-semibold">
              Étapes
              {hasBlocked && <span className="ml-1 w-1.5 h-1.5 rounded-full bg-destructive inline-block" />}
            </TabsTrigger>
            <TabsTrigger value="docs" className="rounded-lg text-xs font-semibold">
              Documents
              {pendingDocs > 0 && (
                <span className="ml-1 min-w-[16px] h-4 px-1 rounded-full bg-vayase-accent text-vayase-night text-[9px] font-bold inline-flex items-center justify-center">
                  {pendingDocs}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="home" className="space-y-4 mt-4">
            {progressCard}
            {alertsBlock}
            {quickActions}
          </TabsContent>

          <TabsContent value="steps" className="mt-4">
            {stepsBlock}
          </TabsContent>

          <TabsContent value="docs" className="mt-4">
            {docsBlock}
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  /* Desktop layout */
  return (
    <div className="space-y-8 animate-fade-in">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-hero p-8 md:p-12 text-white border-0 shadow-xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-vayase-accent/20 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="space-y-4 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/10 text-xs font-semibold uppercase tracking-wider text-vayase-accent">
              <ShieldCheck className="w-3.5 h-3.5" />
              Espace Sécurisé
            </div>
            <h1 className="text-3xl md:text-5xl font-display font-bold tracking-tight">
              Ravi de vous revoir, <span className="text-vayase-accent">{firstName}</span>
            </h1>
            <p className="text-white/70 text-lg font-medium max-w-lg leading-relaxed">
              Votre dossier est en cours de traitement. Voici l&apos;état d&apos;avancement.
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/10 min-w-[240px]">
            <div className="flex justify-between items-end mb-2">
              <span className="text-sm font-semibold text-white/80 uppercase">Progression</span>
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

      {alertsBlock}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-xl font-display font-bold flex items-center gap-2">
            <Clock className="w-5 h-5 text-vayase-accent" />
            Timeline de la Procédure
          </h3>
          {stepsBlock}
        </div>

        <div className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-xl font-display font-bold flex items-center gap-2">
              <FileText className="w-5 h-5 text-vayase-accent" />
              Mes Documents
            </h3>
            <Card className="border-none shadow-card">
              <CardContent className="p-4">{docsBlock}</CardContent>
            </Card>
          </div>

          <Card className="bg-vayase-night text-white border-0 shadow-xl overflow-hidden">
            <CardContent className="p-6 space-y-4">
              <div>
                <h4 className="font-semibold">Besoin d&apos;aide ?</h4>
                <p className="text-white/60 text-xs mt-1">Contactez votre conseiller</p>
              </div>
              <Link to="/client/messages">
                <Button className="w-full bg-vayase-accent text-vayase-night font-bold mb-2">
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Envoyer un message
                </Button>
              </Link>
              <Button
                variant="outline"
                className="w-full border-white/20 text-white hover:bg-white/10"
                onClick={() => { window.location.href = 'mailto:contact@vayaseconsulting.com'; }}
              >
                <Mail className="w-4 h-4 mr-2" />
                contact@vayaseconsulting.com
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
