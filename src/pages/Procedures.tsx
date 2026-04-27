import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Loader2, AlertCircle, Search, ChevronRight, Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const STATUSES = ['todo', 'in_progress', 'completed', 'blocked'] as const;

const stepStatusStyles: Record<string, string> = {
  todo: 'bg-secondary text-muted-foreground border-border',
  in_progress: 'bg-vayase-accent/10 text-vayase-accent border-vayase-accent/30',
  completed: 'bg-success/10 text-success border-success/30',
  validated: 'bg-success/10 text-success border-success/30',
  blocked: 'bg-destructive/10 text-destructive border-destructive/30',
};

export default function Procedures() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { hasAnyRole } = useAuth();
  const canEdit = hasAnyRole(['super_admin', 'admin', 'agent', 'manager']);
  const isAdmin = hasAnyRole(['super_admin', 'admin']);
  const [data, setData] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [openClient, setOpenClient] = useState<any>(null);
  const [openSteps, setOpenSteps] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [stepNotes, setStepNotes] = useState<Record<string, any[]>>({});
  const [stepNoteInputs, setStepNoteInputs] = useState<Record<string, string>>({});

  // Templates (admin)
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('none');
  const [templateForm, setTemplateForm] = useState<any>({ name: '', destination_country: '', visa_type: '' });
  const [templateSteps, setTemplateSteps] = useState<any[]>([]);
  const [newTplStep, setNewTplStep] = useState<any>({ step_name: '', step_order: 0, default_due_days: '', notes: '' });

  const load = () => {
    Promise.all([
      supabase.from('clients').select('id, full_name, destination_country, status'),
      supabase.from('client_steps').select('client_id, status'),
      supabase.from('profiles').select('id, full_name').order('full_name'),
      supabase.from('procedure_templates').select('*').order('name'),
    ]).then(([cRes, sRes, uRes, tplRes]) => {
      const clients = cRes.data ?? [];
      const steps = sRes.data ?? [];
      setUsers(uRes.data ?? []);
      setTemplates(tplRes.data ?? []);
      const grouped = clients.map(c => {
        const cs = steps.filter(s => s.client_id === c.id);
        return {
          ...c,
          total: cs.length,
          completed: cs.filter(s => s.status === 'completed').length,
          inProgress: cs.filter(s => s.status === 'in_progress').length,
          blocked: cs.filter(s => s.status === 'blocked').length,
        };
      }).filter(c => c.total > 0);
      setData(grouped);
    });
  };

  useEffect(() => { load(); }, []);

  const loadTemplateSteps = async (tplId: string) => {
    if (!tplId || tplId === 'none') {
      setTemplateSteps([]);
      return;
    }
    const { data } = await supabase.from('procedure_template_steps').select('*').eq('template_id', tplId).order('step_order');
    setTemplateSteps(data ?? []);
  };

  const createTemplate = async () => {
    if (!isAdmin) return toast.error("Permissions insuffisantes");
    if (!templateForm.name.trim()) return toast.error('Nom requis');
    const { data, error } = await supabase.from('procedure_templates').insert({
      name: templateForm.name.trim(),
      destination_country: templateForm.destination_country.trim() || null,
      visa_type: templateForm.visa_type.trim() || null,
      is_active: true,
    }).select('*').single();
    if (error) return toast.error(error.message);
    toast.success('Procédure créée');
    setTemplateForm({ name: '', destination_country: '', visa_type: '' });
    load();
    setSelectedTemplateId(data.id);
    await loadTemplateSteps(data.id);
  };

  const addTemplateStep = async () => {
    if (!isAdmin) return toast.error("Permissions insuffisantes");
    if (selectedTemplateId === 'none') return toast.error('Choisis une procédure');
    if (!newTplStep.step_name.trim()) return toast.error('Nom étape requis');
    const { error } = await supabase.from('procedure_template_steps').insert({
      template_id: selectedTemplateId,
      step_name: newTplStep.step_name.trim(),
      step_order: Number(newTplStep.step_order) || 0,
      default_due_days: newTplStep.default_due_days === '' ? null : Number(newTplStep.default_due_days),
      notes: newTplStep.notes?.trim() || null,
    });
    if (error) return toast.error(error.message);
    toast.success('Étape ajoutée');
    setNewTplStep({ step_name: '', step_order: 0, default_due_days: '', notes: '' });
    await loadTemplateSteps(selectedTemplateId);
  };

  const deleteTemplateStep = async (stepId: string) => {
    if (!isAdmin) return toast.error("Permissions insuffisantes");
    const { error } = await supabase.from('procedure_template_steps').delete().eq('id', stepId);
    if (error) return toast.error(error.message);
    toast.success('Étape supprimée');
    await loadTemplateSteps(selectedTemplateId);
  };

  const moveTemplateStep = async (stepId: string, direction: 'up' | 'down') => {
    if (!isAdmin) return toast.error("Permissions insuffisantes");
    const current = templateSteps.find(s => s.id === stepId);
    if (!current) return;
    const sorted = [...templateSteps].sort((a, b) => (a.step_order ?? 0) - (b.step_order ?? 0));
    const idx = sorted.findIndex(s => s.id === stepId);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const target = sorted[swapIdx];
    const currentOrder = current.step_order ?? 0;
    const targetOrder = target.step_order ?? 0;

    const { error: err1 } = await supabase.from('procedure_template_steps').update({ step_order: -999999 }).eq('id', current.id);
    if (err1) return toast.error(err1.message);
    const { error: err2 } = await supabase.from('procedure_template_steps').update({ step_order: currentOrder }).eq('id', target.id);
    if (err2) return toast.error(err2.message);
    const { error: err3 } = await supabase.from('procedure_template_steps').update({ step_order: targetOrder }).eq('id', current.id);
    if (err3) return toast.error(err3.message);

    await loadTemplateSteps(selectedTemplateId);
  };

  const openClientSteps = async (client: any) => {
    setOpenClient(client);
    const [{ data: steps }, { data: notes }] = await Promise.all([
      supabase.from('client_steps').select('*').eq('client_id', client.id).order('step_order'),
      supabase.from('client_step_notes').select('*').eq('client_id', client.id).order('created_at', { ascending: false }),
    ]);
    setOpenSteps(steps ?? []);
    const groupedNotes = (notes ?? []).reduce((acc: Record<string, any[]>, note: any) => {
      if (!acc[note.step_id]) acc[note.step_id] = [];
      acc[note.step_id].push(note);
      return acc;
    }, {});
    setStepNotes(groupedNotes);
  };

  const userNameById = (uid?: string | null) => users.find(u => u.id === uid)?.full_name || 'Utilisateur';

  const addStepNote = async (step: any, clearAfter = false) => {
    const content = (stepNoteInputs[step.id] || '').trim();
    if (!content) return false;
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData.user?.id;
    if (!userId) return false;
    const { error } = await supabase.from('client_step_notes').insert({
      client_id: openClient.id,
      step_id: step.id,
      user_id: userId,
      note: content,
    });
    if (error) {
      toast.error(error.message);
      return false;
    }
    if (clearAfter) setStepNoteInputs(s => ({ ...s, [step.id]: '' }));
    return true;
  };

  const updateStepStatus = async (step: any, newStatus: string) => {
    if (!isAdmin) return toast.error("Seul un admin peut modifier les étapes");
    const noteBeforeValidation = (stepNoteInputs[step.id] || '').trim();
    if (newStatus === 'completed' && !noteBeforeValidation) {
      return toast.error('Ajoutez une note de suivi avant de valider cette étape');
    }
    if (newStatus === 'completed') {
      const noteSaved = await addStepNote(step, true);
      if (!noteSaved) return;
    }
    const update: any = { status: newStatus };
    if (newStatus === 'completed') update.completed_at = new Date().toISOString();
    const { error } = await supabase.from('client_steps').update(update).eq('id', step.id);
    if (error) return toast.error(error.message);
    toast.success('Étape mise à jour');
    await openClientSteps(openClient);
    setOpenSteps(s => s.map(x => x.id === step.id ? { ...x, ...update } : x));
    load();
  };

  const filtered = data.filter(d => !search || d.full_name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display font-bold text-2xl lg:text-3xl text-foreground tracking-tight">{t('procedures.title')}</h1>
          <p className="text-muted-foreground text-sm mt-1">{filtered.length} dossiers en cours</p>
        </div>
      </div>

      {isAdmin && (
        <div className="vayase-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Plus className="w-4 h-4 text-vayase-accent" />
            <h3 className="font-display font-semibold text-base">Création procédures et étapes (Admin)</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Créez les modèles par pays + type. Ensuite, lors de la création d’un client, choisissez ce modèle pour générer automatiquement les étapes.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Procédure existante</Label>
                <Select value={selectedTemplateId} onValueChange={async (v) => { setSelectedTemplateId(v); await loadTemplateSteps(v); }}>
                  <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {templates.map(tpl => (
                      <SelectItem key={tpl.id} value={tpl.id}>
                        {tpl.name}{tpl.destination_country ? ` — ${tpl.destination_country}` : ''}{tpl.visa_type ? ` (${tpl.visa_type})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded-lg border border-border p-3">
                <div className="font-semibold text-sm mb-2">Créer une nouvelle procédure</div>
                <div className="space-y-2">
                  <Label>Nom *</Label>
                  <Input value={templateForm.name} onChange={e => setTemplateForm({ ...templateForm, name: e.target.value })} />
                  <Label>Pays</Label>
                  <Input value={templateForm.destination_country} onChange={e => setTemplateForm({ ...templateForm, destination_country: e.target.value })} />
                  <Label>Type procédure</Label>
                  <Input value={templateForm.visa_type} onChange={e => setTemplateForm({ ...templateForm, visa_type: e.target.value })} />
                  <Button onClick={createTemplate} className="w-full bg-gradient-accent text-vayase-night font-semibold">Créer</Button>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="font-semibold text-sm">Étapes du modèle</div>
              {selectedTemplateId === 'none' ? (
                <div className="text-sm text-muted-foreground">Choisis une procédure pour gérer ses étapes.</div>
              ) : (
                <>
                  <div className="space-y-2 rounded-lg border border-border p-3">
                    <div className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Ajouter une étape</div>
                    <div className="space-y-2">
                      <Label>Nom étape *</Label>
                      <Input value={newTplStep.step_name} onChange={e => setNewTplStep({ ...newTplStep, step_name: e.target.value })} />
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-2">
                          <Label>Ordre</Label>
                          <Input type="number" value={newTplStep.step_order} onChange={e => setNewTplStep({ ...newTplStep, step_order: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                          <Label>Délai (jours)</Label>
                          <Input type="number" value={newTplStep.default_due_days} onChange={e => setNewTplStep({ ...newTplStep, default_due_days: e.target.value })} />
                        </div>
                      </div>
                      <Label>Notes</Label>
                      <Textarea rows={2} value={newTplStep.notes} onChange={e => setNewTplStep({ ...newTplStep, notes: e.target.value })} />
                      <Button onClick={addTemplateStep} className="w-full" variant="outline">Ajouter</Button>
                    </div>
                  </div>

                  <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                    {templateSteps.length === 0 && (
                      <div className="text-sm text-muted-foreground">Aucune étape dans ce modèle.</div>
                    )}
                    {templateSteps.map((s) => (
                      <div key={s.id} className="flex items-start justify-between gap-3 border border-border rounded-lg p-3">
                        <div className="min-w-0">
                          <div className="font-semibold text-sm">{s.step_order}. {s.step_name}</div>
                          <div className="text-xs text-muted-foreground">
                            {s.default_due_days != null ? `Échéance +${s.default_due_days} jours` : 'Sans échéance'}{s.notes ? ` · ${s.notes}` : ''}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button size="icon" variant="ghost" onClick={() => moveTemplateStep(s.id, 'up')}>
                            <ArrowUp className="w-4 h-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => moveTemplateStep(s.id, 'down')}>
                            <ArrowDown className="w-4 h-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => deleteTemplateStep(s.id)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="vayase-card p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder={t('clients.searchPlaceholder')} value={search} onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-secondary/50 border-transparent" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((d, i) => {
          const progress = d.total ? (d.completed / d.total) * 100 : 0;
          return (
            <motion.div key={d.id}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              onClick={() => openClientSteps(d)}
              className="vayase-card vayase-card-hover p-5 cursor-pointer"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="font-display font-semibold text-base text-foreground">{d.full_name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{d.destination_country}</div>
                </div>
                <Badge variant="outline" className="text-[10px] uppercase tracking-wider">{t(`clients.status.${d.status}`)}</Badge>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Progression</span>
                  <span className="font-semibold text-foreground">{d.completed}/{d.total}</span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-accent rounded-full transition-all duration-700"
                    style={{ width: `${progress}%` }} />
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1.5 text-success">
                  <CheckCircle2 className="w-3.5 h-3.5" /> {d.completed}
                </div>
                <div className="flex items-center gap-1.5 text-vayase-accent">
                  <Loader2 className="w-3.5 h-3.5" /> {d.inProgress}
                </div>
                {d.blocked > 0 && (
                  <div className="flex items-center gap-1.5 text-destructive">
                    <AlertCircle className="w-3.5 h-3.5" /> {d.blocked}
                  </div>
                )}
                <ChevronRight className="w-4 h-4 ml-auto text-muted-foreground" />
              </div>
            </motion.div>
          );
        })}
      </div>

      <Dialog open={!!openClient} onOpenChange={(o) => !o && setOpenClient(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-3">
              {openClient?.full_name}
              <Badge variant="outline" className="text-[10px]">{openClient?.destination_country}</Badge>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {openSteps.map(step => (
              <div key={step.id} className="border border-border rounded-lg p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1">
                    <div className="font-semibold text-sm text-foreground">{step.step_name}</div>
                    {step.due_date && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Échéance: {new Date(step.due_date).toLocaleDateString('fr-FR')}
                      </div>
                    )}
                    {step.notes && <p className="text-xs text-muted-foreground mt-1">{step.notes}</p>}
                    <div className="space-y-2 mt-2">
                      {(stepNotes[step.id] ?? []).slice(0, 3).map((note) => (
                        <div key={note.id} className="text-xs bg-secondary/50 rounded-md px-2 py-1.5">
                          <div className="font-medium text-foreground">{userNameById(note.user_id)}</div>
                          <div className="text-muted-foreground whitespace-pre-wrap">{note.note}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <Badge variant="outline" className={cn('text-[10px] uppercase tracking-wider', stepStatusStyles[step.status])}>
                    {t(`procedures.status.${step.status}`)}
                  </Badge>
                </div>
                {isAdmin && (
                  <>
                    <div className="flex gap-2 mb-2">
                      <Input
                        value={stepNoteInputs[step.id] ?? ''}
                        onChange={e => setStepNoteInputs(s => ({ ...s, [step.id]: e.target.value }))}
                        placeholder="Ajouter une note de suivi..."
                      />
                      <Button size="sm" variant="outline" onClick={async () => {
                        const saved = await addStepNote(step, true);
                        if (!saved) return toast.error('Saisissez une note');
                        toast.success('Note ajoutée');
                        await openClientSteps(openClient);
                      }}>
                        Ajouter
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {STATUSES.map(s => (
                        <Button key={s} size="sm" variant={step.status === s ? 'default' : 'outline'}
                          onClick={() => updateStepStatus(step, s)}
                          className={cn('h-7 text-[10px] uppercase tracking-wider',
                            step.status === s && 'bg-gradient-accent text-vayase-night')}
                        >
                          {t(`procedures.status.${s}`)}
                        </Button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between border-t border-border pt-3">
            <Button variant="ghost" onClick={() => navigate(`/clients/${openClient?.id}`)}>
              Voir le dossier complet →
            </Button>
            <Button variant="outline" onClick={() => setOpenClient(null)}>Fermer</Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
