import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Mail, Phone, MapPin, Calendar, Briefcase, Globe, User, FileText, Wallet, CheckCircle2, Circle, Clock, AlertCircle, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

const statusStyles: Record<string, string> = {
  vip: 'bg-gradient-accent text-vayase-night border-0',
  standard: 'bg-secondary text-secondary-foreground',
  late_payment: 'bg-destructive/10 text-destructive border-destructive/20',
  priority: 'bg-warning/15 text-warning border-warning/30',
};

const stepIcons: Record<string, any> = {
  completed: CheckCircle2, in_progress: Loader2, validated: CheckCircle2,
  blocked: AlertCircle, todo: Circle,
};

const stepColors: Record<string, string> = {
  completed: 'text-success bg-success/10',
  in_progress: 'text-vayase-accent bg-vayase-accent/10',
  validated: 'text-success bg-success/10',
  blocked: 'text-destructive bg-destructive/10',
  todo: 'text-muted-foreground bg-secondary',
};

const STEP_STATUSES = ['todo', 'in_progress', 'completed', 'blocked'] as const;
const CLIENT_STATUSES = ['standard', 'vip', 'priority', 'late_payment'] as const;

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { hasAnyRole } = useAuth();
  const canEdit = hasAnyRole(['super_admin', 'admin', 'agent', 'manager']);
  const canFinance = hasAnyRole(['super_admin', 'admin', 'comptable']);
  const isAdmin = hasAnyRole(['super_admin', 'admin']);

  const [client, setClient] = useState<any>(null);
  const [steps, setSteps] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [stepNotes, setStepNotes] = useState<Record<string, any[]>>({});
  const [stepNoteInputs, setStepNoteInputs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [saving, setSaving] = useState(false);

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState<any>({ amount: '', due_date: '', status: 'pending', payment_method: '', reference: '' });
  const [deleting, setDeleting] = useState(false);
  const [contractOpen, setContractOpen] = useState(false);
  const [contractForm, setContractForm] = useState<any>({ total_amount: '', currency: 'XOF', status: 'active', signed_date: '', notes: '' });

  const load = () => {
    if (!id) return;
    Promise.all([
      supabase.from('clients').select('*').eq('id', id).single(),
      supabase.from('client_steps').select('*').eq('client_id', id).order('step_order'),
      supabase.from('contracts').select('*').eq('client_id', id),
      supabase.from('payments').select('*').eq('client_id', id).order('due_date'),
      supabase.from('profiles').select('id, full_name').order('full_name'),
      supabase.from('client_step_notes').select('*').eq('client_id', id).order('created_at', { ascending: false }),
      supabase.from('procedure_templates').select('id, name, destination_country, visa_type, is_active').eq('is_active', true).order('name'),
    ]).then(([cRes, sRes, ctRes, pRes, uRes, nRes, tplRes]) => {
      setClient(cRes.data);
      setSteps(sRes.data ?? []);
      setContracts(ctRes.data ?? []);
      setPayments(pRes.data ?? []);
      setUsers(uRes.data ?? []);
      setTemplates(tplRes.data ?? []);
      const groupedNotes = (nRes.data ?? []).reduce((acc: Record<string, any[]>, note: any) => {
        if (!acc[note.step_id]) acc[note.step_id] = [];
        acc[note.step_id].push(note);
        return acc;
      }, {});
      setStepNotes(groupedNotes);
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, [id]);

  if (loading) {
    return <div className="flex items-center justify-center h-96"><Loader2 className="w-8 h-8 animate-spin text-vayase-accent" /></div>;
  }
  if (!client) return <div>Client introuvable</div>;

  const formatCurrency = (n: number, c = 'XOF') => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: c, maximumFractionDigits: 0 }).format(n);
  const totalContract = contracts.reduce((s, c) => s + Number(c.total_amount), 0);
  const totalPaid = payments.filter(p => p.status === 'paid').reduce((s, p) => s + Number(p.amount), 0);
  const totalPending = payments.filter(p => p.status === 'pending' || p.status === 'overdue').reduce((s, p) => s + Number(p.amount), 0);
  const completedSteps = steps.filter(s => s.status === 'completed').length;

  const openEdit = () => {
    setEditForm({
      full_name: client.full_name ?? '',
      email: client.email ?? '',
      phone: client.phone ?? '',
      date_of_birth: client.date_of_birth ?? '',
      nationality: client.nationality ?? '',
      profession: client.profession ?? '',
      address: client.address ?? '',
      destination_country: client.destination_country ?? '',
      visa_type: client.visa_type ?? '',
      program: client.program ?? '',
      total_fees_due: client.total_fees_due ?? '',
      urgency: client.urgency ?? 'normal',
      status: client.status ?? 'standard',
      agent_id: client.agent_id ?? null,
      procedure_template_id: client.procedure_template_id ?? 'none',
      notes: client.notes ?? '',
    });
    setEditOpen(true);
  };

  const userNameById = (uid?: string | null) => users.find(u => u.id === uid)?.full_name || 'Utilisateur';
  const procedureNameById = (pid?: string | null) => templates.find(t => t.id === pid)?.name || '—';

  const handleSave = async () => {
    if (!canEdit) return toast.error("Vous n'avez pas les permissions");
    const previousTemplateId = client.procedure_template_id ?? null;
    const nextTemplateId = editForm.procedure_template_id === 'none' ? null : editForm.procedure_template_id;
    const templateChanged = previousTemplateId !== nextTemplateId;

    if (templateChanged && nextTemplateId && steps.length > 0) {
      const ok = window.confirm('Changer la procédure va remplacer les étapes actuelles du client. Continuer ?');
      if (!ok) return;
    }

    setSaving(true);
    const payload = {
      ...editForm,
      procedure_template_id: nextTemplateId,
      date_of_birth: editForm.date_of_birth || null,
      total_fees_due: editForm.total_fees_due === '' || editForm.total_fees_due == null ? null : Number(editForm.total_fees_due),
    };
    const { error } = await supabase.from('clients').update(payload).eq('id', id);

    if (error) {
      setSaving(false);
      return toast.error(error.message);
    }

    if (templateChanged && nextTemplateId) {
      const { data: tplSteps, error: tplErr } = await supabase
        .from('procedure_template_steps')
        .select('*')
        .eq('template_id', nextTemplateId)
        .order('step_order');
      if (tplErr) {
        setSaving(false);
        return toast.error(tplErr.message);
      }

      await supabase.from('client_steps').delete().eq('client_id', id);
      const today = new Date();
      const rows = (tplSteps ?? []).map((s: any) => {
        const due = s.default_due_days != null ? new Date(today.getTime() + (Number(s.default_due_days) * 86400000)) : null;
        return {
          client_id: id,
          step_name: s.step_name,
          step_order: s.step_order ?? 0,
          status: 'todo',
          due_date: due ? due.toISOString().split('T')[0] : null,
          notes: s.notes ?? null,
        };
      });
      if (rows.length > 0) {
        const { error: insErr } = await supabase.from('client_steps').insert(rows);
        if (insErr) {
          setSaving(false);
          return toast.error(insErr.message);
        }
      }
    }

    setSaving(false);
    toast.success('Client mis à jour');
    setEditOpen(false);
    load();
  };

  const handleDeleteClient = async () => {
    if (!isAdmin) return toast.error("Vous n'avez pas les permissions");
    const confirmed = window.confirm(`Supprimer définitivement le client "${client.full_name}" ?`);
    if (!confirmed) return;
    setDeleting(true);
    const { error } = await supabase.from('clients').delete().eq('id', client.id);
    setDeleting(false);
    if (error) return toast.error(error.message);
    toast.success('Client supprimé');
    navigate('/clients');
  };

  const addStepNote = async (step: any, clearAfter = false) => {
    if (!canEdit) return false;
    const content = (stepNoteInputs[step.id] || '').trim();
    if (!content) return false;
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData.user?.id;
    if (!userId) return false;
    const { error } = await supabase.from('client_step_notes').insert({
      client_id: client.id,
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
    if (!canEdit) return toast.error("Vous n'avez pas les permissions");
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
    load();
  };

  const updatePaymentStatus = async (paymentId: string, newStatus: string) => {
    if (!canFinance) return toast.error("Permissions insuffisantes");
    const update: any = { status: newStatus };
    if (newStatus === 'paid') update.payment_date = new Date().toISOString().split('T')[0];
    const { error } = await supabase.from('payments').update(update).eq('id', paymentId);
    if (error) return toast.error(error.message);
    toast.success('Paiement mis à jour');
    load();
  };

  const handleAddPayment = async () => {
    if (!canFinance) return toast.error("Permissions insuffisantes");
    if (!paymentForm.amount) return toast.error("Montant requis");
    const contract = contracts[0];
    if (!contract) return toast.error("Aucun contrat actif pour ce client");
    const { error } = await supabase.from('payments').insert({
      client_id: id,
      contract_id: contract.id,
      amount: Number(paymentForm.amount),
      currency: 'XOF',
      status: paymentForm.status,
      due_date: paymentForm.due_date || null,
      payment_method: paymentForm.payment_method || null,
      reference: paymentForm.reference || `PAY-${Date.now()}`,
      payment_date: paymentForm.status === 'paid' ? new Date().toISOString().split('T')[0] : null,
    });
    if (error) return toast.error(error.message);
    toast.success('Paiement ajouté');
    setPaymentOpen(false);
    setPaymentForm({ amount: '', due_date: '', status: 'pending', payment_method: '', reference: '' });
    load();
  };

  const handleAddContract = async () => {
    if (!canFinance) return toast.error("Permissions insuffisantes");
    if (!contractForm.total_amount) return toast.error("Montant total requis");

    const payload = {
      client_id: id,
      contract_number: `CTR-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`,
      total_amount: Number(contractForm.total_amount),
      currency: contractForm.currency || 'XOF',
      status: contractForm.status || 'active',
      signed_date: contractForm.signed_date || null,
      notes: contractForm.notes?.trim() || null,
    };

    const { error } = await supabase.from('contracts').insert(payload);
    if (error) return toast.error(error.message);

    toast.success('Contrat créé');
    setContractOpen(false);
    setContractForm({ total_amount: '', currency: 'XOF', status: 'active', signed_date: '', notes: '' });
    load();
  };

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate('/clients')} className="-ml-2">
          <ArrowLeft className="w-4 h-4 mr-1.5" />{t('common.back')}
        </Button>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button onClick={handleDeleteClient} variant="destructive" size="sm" disabled={deleting}>
              <Trash2 className="w-4 h-4 mr-1.5" />{deleting ? 'Suppression...' : 'Supprimer'}
            </Button>
          )}
          {canEdit && (
            <Button onClick={openEdit} variant="outline" size="sm">
              <Pencil className="w-4 h-4 mr-1.5" />{t('common.edit')}
            </Button>
          )}
        </div>
      </div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="vayase-card p-6 lg:p-8 bg-gradient-hero text-white border-0 relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-vayase-accent/20 rounded-full blur-3xl pointer-events-none" />
        <div className="relative flex flex-col lg:flex-row lg:items-center gap-6">
          <Avatar className="w-20 h-20 border-2 border-white/20">
            <AvatarFallback className="bg-gradient-accent text-vayase-night font-bold text-2xl">
              {client.full_name.split(' ').map((n: string) => n[0]).slice(0, 2).join('')}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <h1 className="font-display font-bold text-3xl tracking-tight">{client.full_name}</h1>
              <Badge className={cn('text-[10px] uppercase tracking-wider font-semibold', statusStyles[client.status])}>
                {t(`clients.status.${client.status}`)}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-white/70">
              <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" />{client.email || '—'}</span>
              <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" />{client.phone || '—'}</span>
              <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />{client.destination_country || '—'}</span>
              <span className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" />Assigné: {userNameById(client.agent_id)}</span>
            </div>
          </div>
          <div className="flex gap-6 lg:border-l lg:border-white/15 lg:pl-6">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-white/50 font-semibold">Contrat</div>
              <div className="font-display font-bold text-xl">{formatCurrency(totalContract)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-white/50 font-semibold">Payé</div>
              <div className="font-display font-bold text-xl text-vayase-accent">{formatCurrency(totalPaid)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-white/50 font-semibold">Étapes</div>
              <div className="font-display font-bold text-xl">{completedSteps}/{steps.length || '—'}</div>
            </div>
          </div>
        </div>
      </motion.div>

      <Tabs defaultValue="info">
        <TabsList className="bg-card border border-border">
          <TabsTrigger value="info"><User className="w-4 h-4 mr-1.5" />{t('clients.personalInfo')}</TabsTrigger>
          <TabsTrigger value="procedure"><FileText className="w-4 h-4 mr-1.5" />{t('clients.procedure')}</TabsTrigger>
          <TabsTrigger value="finance"><Wallet className="w-4 h-4 mr-1.5" />{t('clients.finance')}</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="mt-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="vayase-card p-6">
              <h3 className="font-display font-semibold text-base mb-4">{t('clients.personalInfo')}</h3>
              <dl className="space-y-3">
                {[
                  { icon: User, label: t('clients.fullName'), value: client.full_name },
                  { icon: Mail, label: t('common.email'), value: client.email || '—' },
                  { icon: Phone, label: t('common.phone'), value: client.phone || '—' },
                  { icon: Calendar, label: 'Date de naissance', value: client.date_of_birth || '—' },
                  { icon: Globe, label: t('clients.nationality'), value: client.nationality || '—' },
                  { icon: Briefcase, label: t('clients.profession'), value: client.profession || '—' },
                  { icon: MapPin, label: 'Adresse', value: client.address || '—' },
                ].map((row, i) => (
                  <div key={i} className="flex items-start gap-3 py-1">
                    <row.icon className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <dt className="text-xs text-muted-foreground">{row.label}</dt>
                      <dd className="text-sm font-medium text-foreground">{row.value}</dd>
                    </div>
                  </div>
                ))}
              </dl>
            </div>

            <div className="vayase-card p-6">
              <h3 className="font-display font-semibold text-base mb-4">{t('clients.immigrationProject')}</h3>
              <dl className="space-y-3">
                {[
                  { label: t('clients.destination'), value: client.destination_country || '—', accent: true },
                  { label: t('clients.visa'), value: client.visa_type || '—' },
                  { label: t('clients.program'), value: client.program || '—' },
                  { label: 'Procédure', value: procedureNameById(client.procedure_template_id) },
                  { label: 'Frais à payer', value: client.total_fees_due ? formatCurrency(Number(client.total_fees_due)) : '—' },
                  { label: 'Urgence', value: client.urgency || '—' },
                  { label: 'Date inscription', value: new Date(client.created_at).toLocaleDateString('fr-FR') },
                ].map((row, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <dt className="text-xs text-muted-foreground uppercase tracking-wider">{row.label}</dt>
                    <dd className={cn('text-sm font-semibold', row.accent && 'text-vayase-accent')}>{row.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
          {client.notes && (
            <div className="vayase-card p-6 mt-4">
              <h3 className="font-display font-semibold text-base mb-2">Notes</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{client.notes}</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="procedure" className="mt-5">
          <div className="vayase-card p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-display font-semibold text-base">{t('procedures.timeline')}</h3>
              <div className="text-xs text-muted-foreground">
                {completedSteps} / {steps.length} étapes complétées
              </div>
            </div>

            {steps.length === 0 && (
              <div className="text-center py-12 text-muted-foreground text-sm">Aucune étape configurée</div>
            )}

            <div className="relative space-y-1">
              {steps.map((step, i) => {
                const Icon = stepIcons[step.status];
                const isLast = i === steps.length - 1;
                return (
                  <motion.div key={step.id}
                    initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                    className="flex gap-4 relative"
                  >
                    {!isLast && <div className="absolute left-[19px] top-10 bottom-0 w-px bg-border" />}
                    <div className={cn('w-10 h-10 rounded-full flex items-center justify-center shrink-0 z-10', stepColors[step.status])}>
                      <Icon className={cn('w-5 h-5', step.status === 'in_progress' && 'animate-spin')} />
                    </div>
                    <div className="flex-1 pb-6">
                      <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                        <div>
                          <div className="font-semibold text-sm text-foreground">{step.step_name}</div>
                          {step.due_date && (
                            <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(step.due_date).toLocaleDateString('fr-FR')}
                            </div>
                          )}
                        </div>
                        <Badge variant="outline" className={cn('text-[10px] uppercase tracking-wider', stepColors[step.status])}>
                          {t(`procedures.status.${step.status}`)}
                        </Badge>
                      </div>
                      {step.notes && <p className="text-xs text-muted-foreground mb-2">{step.notes}</p>}
                      <div className="space-y-2 mb-3">
                        {(stepNotes[step.id] ?? []).slice(0, 4).map((note) => (
                          <div key={note.id} className="text-xs bg-secondary/50 rounded-md px-2.5 py-2">
                            <div className="font-medium text-foreground">{userNameById(note.user_id)}</div>
                            <div className="text-muted-foreground whitespace-pre-wrap">{note.note}</div>
                          </div>
                        ))}
                      </div>
                      {canEdit && (
                        <div className="flex gap-2 mb-3">
                          <Input
                            value={stepNoteInputs[step.id] ?? ''}
                            onChange={e => setStepNoteInputs(s => ({ ...s, [step.id]: e.target.value }))}
                            placeholder="Ajouter une note de suivi..."
                          />
                          <Button size="sm" variant="outline" onClick={async () => {
                            const saved = await addStepNote(step, true);
                            if (!saved) return toast.error('Saisissez une note');
                            toast.success('Note ajoutée');
                            load();
                          }}>
                            Ajouter
                          </Button>
                        </div>
                      )}
                      {canEdit && (
                        <div className="flex flex-wrap gap-1.5">
                          {STEP_STATUSES.map(s => (
                            <Button key={s} size="sm" variant={step.status === s ? 'default' : 'outline'}
                              onClick={() => updateStepStatus(step, s)}
                              className={cn('h-7 text-[10px] uppercase tracking-wider',
                                step.status === s && 'bg-gradient-accent text-vayase-night')}
                            >
                              {t(`procedures.status.${s}`)}
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="finance" className="mt-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="vayase-card p-5">
              <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1">Total contrat</div>
              <div className="font-display font-bold text-2xl">{formatCurrency(totalContract)}</div>
            </div>
            <div className="vayase-card p-5">
              <div className="text-xs uppercase tracking-wider text-success font-semibold mb-1">Payé</div>
              <div className="font-display font-bold text-2xl text-success">{formatCurrency(totalPaid)}</div>
            </div>
            <div className="vayase-card p-5">
              <div className="text-xs uppercase tracking-wider text-warning font-semibold mb-1">En attente</div>
              <div className="font-display font-bold text-2xl text-warning">{formatCurrency(totalPending)}</div>
            </div>
          </div>

          <div className="vayase-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold text-base">{t('finance.payments')}</h3>
              <div className="flex gap-2">
                {canFinance && (
                  <Button size="sm" variant="outline" onClick={() => setContractOpen(true)}>
                    <Plus className="w-4 h-4 mr-1.5" />Contrat
                  </Button>
                )}
                {canFinance && (
                  <Button size="sm" onClick={() => setPaymentOpen(true)} className="bg-gradient-accent text-vayase-night font-semibold">
                    <Plus className="w-4 h-4 mr-1.5" />Paiement
                  </Button>
                )}
              </div>
            </div>
            {contracts.length === 0 && (
              <div className="mb-4 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
                Aucun contrat pour ce client. Crée un contrat pour pouvoir ajouter des paiements.
              </div>
            )}
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground py-2.5">{t('finance.reference')}</th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground py-2.5">{t('common.dueDate')}</th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground py-2.5 text-right">{t('common.amount')}</th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground py-2.5">{t('common.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map(p => (
                    <tr key={p.id} className="border-b border-border last:border-0">
                      <td className="py-3 font-mono text-xs">{p.reference}</td>
                      <td className="py-3 text-muted-foreground">{p.due_date ? new Date(p.due_date).toLocaleDateString('fr-FR') : '—'}</td>
                      <td className="py-3 text-right font-semibold">{formatCurrency(Number(p.amount), p.currency)}</td>
                      <td className="py-3">
                        {canFinance ? (
                          <Select value={p.status} onValueChange={(v) => updatePaymentStatus(p.id, v)}>
                            <SelectTrigger className="h-7 w-[130px] text-[10px] uppercase tracking-wider">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {['pending', 'paid', 'overdue', 'cancelled'].map(s => (
                                <SelectItem key={s} value={s}>{t(`finance.paymentStatus.${s}`)}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant="outline" className={cn('text-[10px] uppercase tracking-wider',
                            p.status === 'paid' && 'border-success/30 text-success bg-success/5',
                            p.status === 'pending' && 'border-warning/30 text-warning bg-warning/5',
                            p.status === 'overdue' && 'border-destructive/30 text-destructive bg-destructive/5',
                          )}>
                            {t(`finance.paymentStatus.${p.status}`)}
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                  {payments.length === 0 && (
                    <tr><td colSpan={4} className="text-center py-8 text-muted-foreground text-sm">Aucun paiement</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit client dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Modifier le client</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            <div className="space-y-2"><Label>Nom complet *</Label>
              <Input value={editForm.full_name ?? ''} onChange={e => setEditForm({ ...editForm, full_name: e.target.value })} /></div>
            <div className="space-y-2"><Label>Email</Label>
              <Input type="email" value={editForm.email ?? ''} onChange={e => setEditForm({ ...editForm, email: e.target.value })} /></div>
            <div className="space-y-2"><Label>Téléphone</Label>
              <Input value={editForm.phone ?? ''} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} /></div>
            <div className="space-y-2"><Label>Date de naissance</Label>
              <Input type="date" value={editForm.date_of_birth ?? ''} onChange={e => setEditForm({ ...editForm, date_of_birth: e.target.value })} /></div>
            <div className="space-y-2"><Label>Nationalité</Label>
              <Input value={editForm.nationality ?? ''} onChange={e => setEditForm({ ...editForm, nationality: e.target.value })} /></div>
            <div className="space-y-2"><Label>Profession</Label>
              <Input value={editForm.profession ?? ''} onChange={e => setEditForm({ ...editForm, profession: e.target.value })} /></div>
            <div className="sm:col-span-2 space-y-2"><Label>Adresse</Label>
              <Input value={editForm.address ?? ''} onChange={e => setEditForm({ ...editForm, address: e.target.value })} /></div>
            <div className="space-y-2"><Label>Destination</Label>
              <Input value={editForm.destination_country ?? ''} onChange={e => setEditForm({ ...editForm, destination_country: e.target.value })} /></div>
            <div className="space-y-2"><Label>Type de visa</Label>
              <Input value={editForm.visa_type ?? ''} onChange={e => setEditForm({ ...editForm, visa_type: e.target.value })} /></div>
            <div className="space-y-2"><Label>Programme</Label>
              <Input value={editForm.program ?? ''} onChange={e => setEditForm({ ...editForm, program: e.target.value })} /></div>
            <div className="sm:col-span-2 space-y-2"><Label>Procédure (modèle)</Label>
              <Select value={editForm.procedure_template_id ?? 'none'} onValueChange={v => setEditForm({ ...editForm, procedure_template_id: v })}>
                <SelectTrigger><SelectValue placeholder="Choisir une procédure" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucune</SelectItem>
                  {templates.map(tpl => (
                    <SelectItem key={tpl.id} value={tpl.id}>
                      {tpl.name}{tpl.destination_country ? ` — ${tpl.destination_country}` : ''}{tpl.visa_type ? ` (${tpl.visa_type})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Frais à payer</Label>
              <Input type="number" min="0" step="0.01" value={editForm.total_fees_due ?? ''}
                onChange={e => setEditForm({ ...editForm, total_fees_due: e.target.value })} /></div>
            <div className="space-y-2"><Label>Urgence</Label>
              <Select value={editForm.urgency ?? 'normal'} onValueChange={v => setEditForm({ ...editForm, urgency: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['low', 'normal', 'high', 'critical'].map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {isAdmin && (
              <div className="sm:col-span-2 space-y-2"><Label>Utilisateur assigné</Label>
                <Select value={editForm.agent_id ?? 'none'} onValueChange={v => setEditForm({ ...editForm, agent_id: v === 'none' ? null : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun</SelectItem>
                    {users.map(u => <SelectItem key={u.id} value={u.id}>{u.full_name || u.id}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="sm:col-span-2 space-y-2"><Label>Statut client</Label>
              <Select value={editForm.status ?? 'standard'} onValueChange={v => setEditForm({ ...editForm, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CLIENT_STATUSES.map(s => <SelectItem key={s} value={s}>{t(`clients.status.${s}`)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2 space-y-2"><Label>Notes</Label>
              <Textarea rows={3} value={editForm.notes ?? ''} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-gradient-accent text-vayase-night font-semibold">
              {saving ? '...' : t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add payment dialog */}
      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">Nouveau paiement</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2"><Label>Montant (FCFA) *</Label>
              <Input type="number" value={paymentForm.amount}
                onChange={e => setPaymentForm({ ...paymentForm, amount: e.target.value })} /></div>
            <div className="space-y-2"><Label>Échéance</Label>
              <Input type="date" value={paymentForm.due_date}
                onChange={e => setPaymentForm({ ...paymentForm, due_date: e.target.value })} /></div>
            <div className="space-y-2"><Label>Statut</Label>
              <Select value={paymentForm.status} onValueChange={v => setPaymentForm({ ...paymentForm, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['pending', 'paid', 'overdue', 'cancelled'].map(s => (
                    <SelectItem key={s} value={s}>{t(`finance.paymentStatus.${s}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Méthode</Label>
              <Input value={paymentForm.payment_method}
                onChange={e => setPaymentForm({ ...paymentForm, payment_method: e.target.value })}
                placeholder="Carte / Virement / Espèces" /></div>
            <div className="space-y-2"><Label>Référence</Label>
              <Input value={paymentForm.reference}
                onChange={e => setPaymentForm({ ...paymentForm, reference: e.target.value })}
                placeholder="Auto si vide" /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPaymentOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleAddPayment} className="bg-gradient-accent text-vayase-night font-semibold">
              {t('common.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add contract dialog */}
      <Dialog open={contractOpen} onOpenChange={setContractOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">Nouveau contrat</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Montant total (FCFA) *</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={contractForm.total_amount}
                onChange={e => setContractForm({ ...contractForm, total_amount: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Statut</Label>
              <Select value={contractForm.status} onValueChange={v => setContractForm({ ...contractForm, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['draft', 'active', 'completed', 'cancelled'].map(s => (
                    <SelectItem key={s} value={s}>{t(`finance.contractStatus.${s}`, { defaultValue: s })}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Date de signature</Label>
              <Input
                type="date"
                value={contractForm.signed_date}
                onChange={e => setContractForm({ ...contractForm, signed_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                rows={3}
                value={contractForm.notes}
                onChange={e => setContractForm({ ...contractForm, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setContractOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleAddContract} className="bg-gradient-accent text-vayase-night font-semibold">
              {t('common.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
