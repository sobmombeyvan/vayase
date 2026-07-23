import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Eye, MapPin, Briefcase } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn, staffDisplayName, isMissingClientsReferralColumnError } from '@/lib/utils';
import { motion } from 'framer-motion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DESTINATION_COUNTRIES } from '@/lib/destinations';
import { loadStaffMembers, type StaffMember } from '@/lib/staff';

const statusStyles: Record<string, string> = {
  vip: 'bg-gradient-accent text-vayase-night border-0',
  standard: 'bg-secondary text-secondary-foreground',
  late_payment: 'bg-destructive/10 text-destructive border-destructive/20',
  priority: 'bg-warning/15 text-warning border-warning/30',
};

export default function Clients() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { hasAnyRole, user } = useAuth();
  const canEditPriority = hasAnyRole(['super_admin', 'admin', 'agent', 'manager']);
  const isStaff = hasAnyRole(['super_admin', 'admin', 'agent', 'manager', 'marketing_agent', 'comptable', 'support']);
  const [clients, setClients] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [users, setUsers] = useState<StaffMember[]>([]);
  const [createForm, setCreateForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    destination_country: '',
    visa_type: '',
    total_fees_due: '',
    notes: '',
    agent_id: 'none',
    procedure_template_id: 'none',
    referred_by_user_id: 'none',
  });
  const [templates, setTemplates] = useState<any[]>([]);
  const [hasReferralColumn, setHasReferralColumn] = useState(true);
  const filteredTemplates = templates.filter((tpl) => {
    if (!createForm.destination_country) return true;
    return !tpl.destination_country || tpl.destination_country === createForm.destination_country;
  });

  const loadStaff = async () => {
    const { data, error } = await loadStaffMembers();
    if (error) {
      toast.error(error);
      setUsers([]);
      return;
    }
    setUsers(data);
  };

  const loadClients = async () => {
    setLoading(true);
    const [clientsRes, tplRes] = await Promise.all([
      supabase.from('clients').select('*').order('created_at', { ascending: false }),
      supabase.from('procedure_templates').select('id, name, destination_country, visa_type, is_active').eq('is_active', true).order('name'),
    ]);
    const { data, error } = clientsRes;
    if (!tplRes.error) setTemplates(tplRes.data ?? []);
    if (error) {
      toast.error(error.message);
      setClients([]);
    } else {
      setClients(data ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadClients();
    loadStaff();
  }, []);

  const filtered = clients.filter(c => {
    const matchSearch = !search || c.full_name.toLowerCase().includes(search.toLowerCase()) ||
      c.email?.toLowerCase().includes(search.toLowerCase()) ||
      c.destination_country?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || c.status === statusFilter;
    const matchPriority = priorityFilter === 'all' || (c.urgency ?? 'normal') === priorityFilter;
    return matchSearch && matchStatus && matchPriority;
  });

  const statusCounts = {
    all: clients.length,
    vip: clients.filter(c => c.status === 'vip').length,
    priority: clients.filter(c => c.status === 'priority').length,
    standard: clients.filter(c => c.status === 'standard').length,
    late_payment: clients.filter(c => c.status === 'late_payment').length,
  };

  const priorityLabel = (p?: string) => {
    switch (p) {
      case 'low': return 'Basse';
      case 'high': return 'Haute';
      case 'critical': return 'Critique';
      default: return 'Normale';
    }
  };

  const priorityStyles: Record<string, string> = {
    low: 'bg-secondary text-secondary-foreground',
    normal: 'bg-vayase-accent/10 text-vayase-accent border-vayase-accent/30',
    high: 'bg-warning/15 text-warning border-warning/30',
    critical: 'bg-destructive/10 text-destructive border-destructive/30',
  };

  const updateClientPriority = async (clientId: string, urgency: string) => {
    if (!canEditPriority) return;
    const { error } = await supabase.from('clients').update({ urgency }).eq('id', clientId);
    if (error) return toast.error(error.message);
    setClients(prev => prev.map(c => c.id === clientId ? { ...c, urgency } : c));
    toast.success('Priorité client mise à jour');
  };

  const openCreateDialog = async () => {
    await loadStaff();
    setCreateForm({
      full_name: '',
      email: '',
      phone: '',
      destination_country: '',
      visa_type: '',
      total_fees_due: '',
      notes: '',
      agent_id: 'none',
      procedure_template_id: 'none',
      referred_by_user_id: isStaff && user?.id ? user.id : 'none',
    });
    setCreateOpen(true);
  };

  const handleCreateClient = async () => {
    if (!createForm.full_name.trim()) return toast.error('Le nom du client est requis');
    setCreating(true);
    const payload: Record<string, unknown> = {
      full_name: createForm.full_name.trim(),
      email: createForm.email.trim() || null,
      phone: createForm.phone.trim() || null,
      destination_country: createForm.destination_country.trim() || null,
      visa_type: createForm.visa_type.trim() || null,
      total_fees_due: createForm.total_fees_due ? Number(createForm.total_fees_due) : null,
      notes: createForm.notes.trim() || null,
      agent_id: createForm.agent_id === 'none' ? null : createForm.agent_id,
      procedure_template_id: createForm.procedure_template_id === 'none' ? null : createForm.procedure_template_id,
      status: 'standard' as any,
      urgency: 'normal' as any,
    };
    if (hasReferralColumn) {
      payload.referred_by_user_id = createForm.referred_by_user_id === 'none' ? null : createForm.referred_by_user_id;
    }

    let { data: createdClient, error } = await supabase.from('clients').insert(payload).select('id').single();
    if (error && isMissingClientsReferralColumnError(error.message) && hasReferralColumn) {
      delete payload.referred_by_user_id;
      setHasReferralColumn(false);
      toast.warning('Migration referral manquante en base — le client est créé sans parrain.');
      ({ data: createdClient, error } = await supabase.from('clients').insert(payload).select('id').single());
    }
    setCreating(false);
    if (error) return toast.error(error.message);

    // If a template is selected, generate client_steps automatically
    if (createdClient?.id && createForm.procedure_template_id !== 'none') {
      const tplId = createForm.procedure_template_id;
      const { data: tplSteps, error: sErr } = await supabase
        .from('procedure_template_steps')
        .select('*')
        .eq('template_id', tplId)
        .order('step_order');
      if (!sErr && (tplSteps?.length ?? 0) > 0) {
        const today = new Date();
        const rows = (tplSteps ?? []).map((s: any) => {
          const due = s.default_due_days != null ? new Date(today.getTime() + (Number(s.default_due_days) * 86400000)) : null;
          return {
            client_id: createdClient.id,
            step_name: s.step_name,
            step_order: s.step_order ?? 0,
            status: 'todo' as any,
            due_date: due ? due.toISOString().split('T')[0] : null,
            notes: s.notes ?? null,
          };
        });
        await supabase.from('client_steps').insert(rows);
      }
    }

    toast.success('Client créé');
    setCreateOpen(false);
    setCreateForm({
      full_name: '',
      email: '',
      phone: '',
      destination_country: '',
      visa_type: '',
      total_fees_due: '',
      notes: '',
      agent_id: 'none',
      procedure_template_id: 'none',
      referred_by_user_id: 'none',
    });
    await loadClients();
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-2xl lg:text-3xl text-foreground tracking-tight">{t('clients.title')}</h1>
          <p className="text-muted-foreground text-sm mt-1">{filtered.length} {t('clients.title').toLowerCase()}</p>
        </div>
        <Button className="bg-gradient-accent text-vayase-night font-semibold hover:opacity-90 shadow-glow" onClick={openCreateDialog}>
          <Plus className="w-4 h-4 mr-2" />{t('clients.new')}
        </Button>
      </div>

      {/* Filters */}
      <div className="vayase-card p-4 flex flex-col lg:flex-row gap-3 items-start lg:items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder={t('clients.searchPlaceholder')} value={search} onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-secondary/50 border-transparent" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {(['all', 'vip', 'priority', 'standard', 'late_payment'] as const).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                statusFilter === s ? 'bg-vayase-night text-white shadow-sm' : 'bg-secondary text-muted-foreground hover:bg-secondary/80')}
            >
              {s === 'all' ? t('common.all') : t(`clients.status.${s}`)}
              <span className="ml-1.5 opacity-70">{statusCounts[s]}</span>
            </button>
          ))}
        </div>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-[170px] h-9 bg-secondary/50 border-transparent">
            <SelectValue placeholder="Priorité" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes priorités</SelectItem>
            <SelectItem value="low">Basse</SelectItem>
            <SelectItem value="normal">Normale</SelectItem>
            <SelectItem value="high">Haute</SelectItem>
            <SelectItem value="critical">Critique</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="vayase-card overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground py-3.5 px-5">{t('clients.fullName')}</th>
                <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground py-3.5 px-5 hidden md:table-cell">{t('clients.destination')}</th>
                <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground py-3.5 px-5 hidden lg:table-cell">{t('clients.profession')}</th>
                <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground py-3.5 px-5 hidden xl:table-cell">Portail</th>
                <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground py-3.5 px-5">{t('common.status')}</th>
                <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground py-3.5 px-5">Priorité</th>
                <th className="w-12"></th>
              </tr>
            </thead>
            <tbody>
              {loading && Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td colSpan={6} className="p-5"><div className="h-10 rounded animate-shimmer" /></td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={6} className="text-center py-16 text-muted-foreground text-sm">{t('common.noData')}</td></tr>
              )}
              {!loading && filtered.map((c, i) => (
                <motion.tr
                  key={c.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02 }}
                  className="border-b border-border last:border-0 hover:bg-secondary/40 transition-colors cursor-pointer"
                  onClick={() => navigate(`/clients/${c.id}`)}
                >
                  <td className="py-3.5 px-5">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-9 h-9">
                        <AvatarFallback className="bg-gradient-accent text-vayase-night font-semibold text-xs">
                          {c.full_name.split(' ').map((n: string) => n[0]).slice(0, 2).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-foreground truncate">{c.full_name}</div>
                        <div className="text-xs text-muted-foreground truncate">{c.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-5 hidden md:table-cell">
                    <div className="flex items-center gap-1.5 text-sm text-foreground">
                      <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>{c.destination_country}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">{c.visa_type}</div>
                  </td>
                  <td className="py-3.5 px-5 hidden lg:table-cell">
                    <div className="flex items-center gap-1.5 text-sm text-foreground">
                      <Briefcase className="w-3.5 h-3.5 text-muted-foreground" />
                      {c.profession}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">{c.nationality}</div>
                  </td>
                  <td className="py-3.5 px-5 hidden xl:table-cell">
                    {c.auth_user_id ? (
                      <Badge variant="outline" className="bg-success/10 text-success border-success/20 gap-1 px-1.5 py-0.5">
                        <Plus className="w-3 h-3 rotate-45 hidden" /> {/* dummy for spacing if needed */}
                        Actif
                      </Badge>
                    ) : (
                      <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Non créé</span>
                    )}
                  </td>
                  <td className="py-3.5 px-5">
                    <Badge className={cn('text-[10px] uppercase tracking-wider font-semibold', statusStyles[c.status])}>
                      {t(`clients.status.${c.status}`)}
                    </Badge>
                  </td>
                  <td className="py-3.5 px-5" onClick={(e) => e.stopPropagation()}>
                    {canEditPriority ? (
                      <Select value={c.urgency ?? 'normal'} onValueChange={(v) => updateClientPriority(c.id, v)}>
                        <SelectTrigger className="h-8 w-[130px] text-[11px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Basse</SelectItem>
                          <SelectItem value="normal">Normale</SelectItem>
                          <SelectItem value="high">Haute</SelectItem>
                          <SelectItem value="critical">Critique</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="outline" className={cn('text-[10px] uppercase tracking-wider', priorityStyles[c.urgency ?? 'normal'])}>
                        {priorityLabel(c.urgency)}
                      </Badge>
                    )}
                  </td>
                  <td className="py-3.5 px-5">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); navigate(`/clients/${c.id}`); }}>
                      <Eye className="w-4 h-4" />
                    </Button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Nouveau client</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
            <div className="space-y-2">
              <Label>Nom complet *</Label>
              <Input value={createForm.full_name} onChange={e => setCreateForm({ ...createForm, full_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={createForm.email} onChange={e => setCreateForm({ ...createForm, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Téléphone</Label>
              <Input value={createForm.phone} onChange={e => setCreateForm({ ...createForm, phone: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Destination</Label>
              <Select
                value={createForm.destination_country || 'none'}
                onValueChange={(v) => setCreateForm({
                  ...createForm,
                  destination_country: v === 'none' ? '' : v,
                  procedure_template_id: 'none',
                })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choisir une destination" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucune</SelectItem>
                  {DESTINATION_COUNTRIES.map((country) => (
                    <SelectItem key={country} value={country}>{country}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Type de procédure</Label>
              <Input value={createForm.visa_type} onChange={e => setCreateForm({ ...createForm, visa_type: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Procédure (modèle)</Label>
              <Select
                value={createForm.procedure_template_id}
                onValueChange={v => {
                  const tpl = templates.find((t) => t.id === v);
                  setCreateForm({
                    ...createForm,
                    procedure_template_id: v,
                    destination_country: v !== 'none' && tpl?.destination_country ? tpl.destination_country : createForm.destination_country,
                    visa_type: v !== 'none' && tpl?.visa_type ? tpl.visa_type : createForm.visa_type,
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choisir un modèle" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun</SelectItem>
                  {filteredTemplates.map(tpl => (
                    <SelectItem key={tpl.id} value={tpl.id}>
                      {tpl.name}{tpl.destination_country ? ` — ${tpl.destination_country}` : ''}{tpl.visa_type ? ` (${tpl.visa_type})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Frais à payer</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={createForm.total_fees_due}
                onChange={e => setCreateForm({ ...createForm, total_fees_due: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label>Référé par</Label>
              <p className="text-xs text-muted-foreground">Membre de l'équipe qui a amené ce client</p>
              <Select value={createForm.referred_by_user_id} onValueChange={v => setCreateForm({ ...createForm, referred_by_user_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir qui a référé" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun / Inconnu</SelectItem>
                  {users.length === 0 ? (
                    <SelectItem value="__empty" disabled>Aucun employé trouvé</SelectItem>
                  ) : users.map(u => (
                    <SelectItem key={u.id} value={u.id}>{staffDisplayName(u)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Responsable du client</Label>
              <Select value={createForm.agent_id} onValueChange={v => setCreateForm({ ...createForm, agent_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir un responsable" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun</SelectItem>
                  {users.map(u => <SelectItem key={u.id} value={u.id}>{staffDisplayName(u)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label>Notes client</Label>
              <Textarea
                rows={3}
                value={createForm.notes}
                onChange={e => setCreateForm({ ...createForm, notes: e.target.value })}
                placeholder="Informations importantes sur ce client..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Annuler</Button>
            <Button onClick={handleCreateClient} disabled={creating} className="bg-gradient-accent text-vayase-night font-semibold">
              {creating ? '...' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
