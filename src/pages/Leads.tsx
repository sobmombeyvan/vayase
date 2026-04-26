import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Search, MessageCircle, Globe, Users as UsersIcon, Instagram, Facebook, ArrowRight, Music2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

const sourceIcons: Record<string, any> = {
  facebook: Facebook, whatsapp: MessageCircle, website: Globe, instagram: Instagram, referral: UsersIcon, other: Globe,
  tiktok: Music2,
};

const PIPELINE = ['new', 'contacted', 'meeting_scheduled', 'converted', 'lost'] as const;
const SOURCES = ['website', 'whatsapp', 'facebook', 'instagram', 'tiktok', 'referral', 'other'] as const;

const colColors: Record<string, string> = {
  new: 'border-t-vayase-accent',
  contacted: 'border-t-blue-500',
  meeting_scheduled: 'border-t-purple-500',
  converted: 'border-t-success',
  lost: 'border-t-destructive',
};

type Lead = {
  id?: string;
  full_name: string;
  email?: string | null;
  phone?: string | null;
  source: typeof SOURCES[number];
  status: typeof PIPELINE[number];
  destination_country?: string | null;
  budget?: number | null;
  interest_level?: number | null;
  notes?: string | null;
  assigned_to?: string | null;
  converted_client_id?: string | null;
  source_other?: string | null;
};

const emptyLead: Lead = {
  full_name: '', email: '', phone: '', source: 'website', status: 'new',
  destination_country: '', budget: null, interest_level: 3, notes: '',
};

export default function Leads() {
  const { t } = useTranslation();
  const { hasAnyRole } = useAuth();
  const canEdit = hasAnyRole(['super_admin', 'admin', 'agent', 'manager']);
  const [leads, setLeads] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'pipeline' | 'list'>('pipeline');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Lead>(emptyLead);
  const [saving, setSaving] = useState(false);

  const loadLeads = () => {
    supabase.from('leads').select('*').order('created_at', { ascending: false })
      .then(({ data }) => setLeads(data ?? []));
  };

  useEffect(() => { loadLeads(); }, []);

  const filtered = leads.filter(l => !search || l.full_name.toLowerCase().includes(search.toLowerCase()));

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(n);

  const openNew = () => {
    if (!canEdit) return toast.error("Vous n'avez pas les permissions");
    setEditing({ ...emptyLead });
    setDialogOpen(true);
  };

  const openEdit = (lead: any) => {
    setEditing({
      id: lead.id,
      full_name: lead.full_name,
      email: lead.email ?? '',
      phone: lead.phone ?? '',
      source: lead.source,
      status: lead.status,
      destination_country: lead.destination_country ?? '',
      budget: lead.budget ?? null,
      interest_level: lead.interest_level ?? 3,
      notes: lead.notes ?? '',
      assigned_to: lead.assigned_to ?? null,
      converted_client_id: lead.converted_client_id ?? null,
      source_other: lead.source_other ?? '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!editing.full_name.trim()) return toast.error('Le nom est requis');
    setSaving(true);
    const payload: any = {
      full_name: editing.full_name.trim(),
      email: editing.email || null,
      phone: editing.phone || null,
      source: editing.source,
      source_other: editing.source === 'other' ? (editing.source_other || null) : null,
      status: editing.status,
      destination_country: editing.destination_country || null,
      budget: editing.budget ? Number(editing.budget) : null,
      interest_level: editing.interest_level ?? 3,
      notes: editing.notes || null,
    };
    let error;
    if (editing.id) {
      ({ error } = await supabase.from('leads').update(payload).eq('id', editing.id));
    } else {
      ({ error } = await supabase.from('leads').insert(payload));
    }
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(editing.id ? 'Prospect mis à jour' : 'Prospect créé');
    setDialogOpen(false);
    loadLeads();
  };

  const handleQuickStatus = async (e: React.MouseEvent, leadId: string, newStatus: string) => {
    e.stopPropagation();
    if (!canEdit) return toast.error("Vous n'avez pas les permissions");
    const { error } = await supabase.from('leads').update({ status: newStatus as any }).eq('id', leadId);
    if (error) return toast.error(error.message);
    toast.success('Statut mis à jour');
    loadLeads();
  };

  const convertLead = async (lead: Lead) => {
    if (!lead.id) return;
    if (!canEdit) return toast.error("Vous n'avez pas les permissions");
    if (lead.status === 'converted' && lead.converted_client_id) {
      window.location.href = `/clients/${lead.converted_client_id}`;
      return;
    }
    const { data: createdClient, error: cErr } = await supabase
      .from('clients')
      .insert({
        full_name: lead.full_name,
        email: lead.email || null,
        phone: lead.phone || null,
        destination_country: lead.destination_country || null,
        agent_id: lead.assigned_to ?? null,
        notes: lead.notes || null,
        status: 'standard',
        urgency: 'normal',
      })
      .select('id')
      .single();
    if (cErr) return toast.error(cErr.message);

    await supabase
      .from('leads')
      .update({ status: 'converted', converted_client_id: createdClient?.id ?? null })
      .eq('id', lead.id);
    toast.success('Prospect converti en client');
    loadLeads();
    if (createdClient?.id) {
      window.location.href = `/clients/${createdClient.id}`;
    }
  };

  const handleConvert = async () => {
    if (!editing.id) return;
    await convertLead(editing);
    setDialogOpen(false);
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-2xl lg:text-3xl text-foreground tracking-tight">{t('leads.title')}</h1>
          <p className="text-muted-foreground text-sm mt-1">{filtered.length} prospects</p>
        </div>
        <div className="flex gap-2">
          <div className="flex bg-secondary rounded-lg p-1">
            <button onClick={() => setView('pipeline')}
              className={cn('px-3 py-1.5 rounded-md text-xs font-semibold', view === 'pipeline' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground')}>
              Pipeline
            </button>
            <button onClick={() => setView('list')}
              className={cn('px-3 py-1.5 rounded-md text-xs font-semibold', view === 'list' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground')}>
              Liste
            </button>
          </div>
          <Button onClick={openNew} className="bg-gradient-accent text-vayase-night font-semibold hover:opacity-90 shadow-glow">
            <Plus className="w-4 h-4 mr-2" />{t('leads.new')}
          </Button>
        </div>
      </div>

      <div className="vayase-card p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder={t('common.search')} value={search} onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-secondary/50 border-transparent" />
        </div>
      </div>

      {view === 'pipeline' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4">
          {PIPELINE.map((status, colIdx) => {
            const colLeads = filtered.filter(l => l.status === status);
            return (
              <div key={status} className={cn('vayase-card p-4 border-t-4', colColors[status])}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display font-semibold text-sm">{t(`leads.status.${status}`)}</h3>
                  <Badge variant="secondary" className="text-[10px]">{colLeads.length}</Badge>
                </div>
                <div className="space-y-2 min-h-[120px]">
                  {colLeads.map((lead, i) => {
                    const SrcIcon = sourceIcons[lead.source] ?? Globe;
                    const nextStatus = PIPELINE[Math.min(PIPELINE.indexOf(lead.status as any) + 1, PIPELINE.length - 1)];
                    return (
                      <motion.div key={lead.id}
                        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: (colIdx * 0.05) + (i * 0.03) }}
                        onClick={() => openEdit(lead)}
                        className="bg-card rounded-lg border border-border p-3 hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer group"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="font-semibold text-sm text-foreground truncate flex-1">{lead.full_name}</div>
                          <SrcIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        </div>
                        <div className="text-xs text-muted-foreground mb-2 truncate">{lead.destination_country}</div>
                        <div className="flex items-center justify-between">
                          {lead.budget && <div className="text-xs font-semibold text-vayase-accent">{formatCurrency(Number(lead.budget))}</div>}
                          <div className="flex gap-0.5 ml-auto">
                            {Array.from({ length: 5 }).map((_, idx) => (
                              <div key={idx} className={cn('w-1 h-3 rounded-full',
                                idx < (lead.interest_level ?? 0) ? 'bg-vayase-accent' : 'bg-secondary')} />
                            ))}
                          </div>
                        </div>
                        {canEdit && lead.status !== 'converted' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); convertLead(lead); }}
                            className="mt-2 w-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1 text-[10px] uppercase tracking-wider font-semibold text-success hover:text-foreground py-1 rounded border border-dashed border-success/30 hover:border-success/60"
                          >
                            Convertir
                          </button>
                        )}
                        {canEdit && nextStatus !== lead.status && (
                          <button
                            onClick={(e) => handleQuickStatus(e, lead.id, nextStatus)}
                            className="mt-2 w-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1 text-[10px] uppercase tracking-wider font-semibold text-vayase-accent hover:text-foreground py-1 rounded border border-dashed border-vayase-accent/30 hover:border-vayase-accent/60"
                          >
                            <ArrowRight className="w-3 h-3" />
                            {t(`leads.status.${nextStatus}`)}
                          </button>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="vayase-card overflow-hidden">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground py-3.5 px-5">{t('common.name')}</th>
                  <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground py-3.5 px-5">{t('leads.source')}</th>
                  <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground py-3.5 px-5">{t('clients.destination')}</th>
                  <th className="text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground py-3.5 px-5">{t('leads.budget')}</th>
                  <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground py-3.5 px-5">{t('common.status')}</th>
                  <th className="py-3.5 px-5"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(l => {
                  const SrcIcon = sourceIcons[l.source] ?? Globe;
                  return (
                    <tr key={l.id} onClick={() => openEdit(l)}
                      className="border-b border-border last:border-0 hover:bg-secondary/30 cursor-pointer">
                      <td className="py-3.5 px-5">
                        <div className="text-sm font-semibold">{l.full_name}</div>
                        <div className="text-xs text-muted-foreground">{l.email}</div>
                      </td>
                      <td className="py-3.5 px-5">
                        <Badge variant="outline" className="gap-1.5 capitalize"><SrcIcon className="w-3 h-3" />{l.source}</Badge>
                      </td>
                      <td className="py-3.5 px-5 text-sm">{l.destination_country}</td>
                      <td className="py-3.5 px-5 text-sm font-semibold text-right">{l.budget ? formatCurrency(Number(l.budget)) : '—'}</td>
                      <td className="py-3.5 px-5">
                        <Badge variant="outline" className="text-[10px] uppercase tracking-wider">{t(`leads.status.${l.status}`)}</Badge>
                      </td>
                      <td className="py-3.5 px-5 text-right" onClick={(e) => e.stopPropagation()}>
                        {canEdit && l.status !== 'converted' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-[11px]"
                            onClick={() => convertLead(l)}
                          >
                            Convertir
                          </Button>
                        )}
                        {canEdit && l.status === 'converted' && l.converted_client_id && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-[11px]"
                            onClick={() => window.location.href = `/clients/${l.converted_client_id}`}
                          >
                            Voir client
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">
              {editing.id ? 'Modifier le prospect' : 'Nouveau prospect'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            <div className="sm:col-span-2 space-y-2">
              <Label>Nom complet *</Label>
              <Input value={editing.full_name} onChange={e => setEditing({ ...editing, full_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={editing.email ?? ''} onChange={e => setEditing({ ...editing, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Téléphone</Label>
              <Input value={editing.phone ?? ''} onChange={e => setEditing({ ...editing, phone: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Source</Label>
              <Select
                value={editing.source}
                onValueChange={v => setEditing({ ...editing, source: v as any, source_other: v === 'other' ? (editing.source_other ?? '') : '' })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SOURCES.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {editing.source === 'other' && (
              <div className="space-y-2">
                <Label>Précisez la source</Label>
                <Input
                  value={editing.source_other ?? ''}
                  onChange={e => setEditing({ ...editing, source_other: e.target.value })}
                  placeholder="Ex: Tiktok, Salon, Partenaire..."
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>Statut</Label>
              <Select value={editing.status} onValueChange={v => setEditing({ ...editing, status: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PIPELINE.map(s => <SelectItem key={s} value={s}>{t(`leads.status.${s}`)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Destination</Label>
              <Input value={editing.destination_country ?? ''} onChange={e => setEditing({ ...editing, destination_country: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Budget (FCFA)</Label>
              <Input type="number" value={editing.budget ?? ''} onChange={e => setEditing({ ...editing, budget: e.target.value ? Number(e.target.value) : null })} />
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label>Niveau d'intérêt: {editing.interest_level}/5</Label>
              <input type="range" min={1} max={5} value={editing.interest_level ?? 3}
                onChange={e => setEditing({ ...editing, interest_level: Number(e.target.value) })}
                className="w-full accent-vayase-accent" />
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label>Notes</Label>
              <Textarea rows={3} value={editing.notes ?? ''} onChange={e => setEditing({ ...editing, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            {editing.id && editing.status !== 'converted' && (
              <Button variant="outline" onClick={handleConvert} className="mr-auto">
                Convertir en client
              </Button>
            )}
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSave} disabled={saving || !canEdit}
              className="bg-gradient-accent text-vayase-night font-semibold">
              {saving ? '...' : t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
