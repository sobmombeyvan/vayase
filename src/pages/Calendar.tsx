import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar as CalendarIcon, Plus, MapPin, Video, Clock, Users as UsersIcon } from 'lucide-react';
import { format, isToday, isTomorrow, isThisWeek, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Appointment {
  id: string;
  title: string;
  description: string | null;
  appointment_date: string;
  duration_minutes: number;
  location: string | null;
  meeting_url: string | null;
  status: string;
  client_id: string | null;
  clients?: { full_name: string } | null;
}

const statusColors: Record<string, string> = {
  scheduled: 'bg-blue-500/15 text-blue-500',
  confirmed: 'bg-emerald-500/15 text-emerald-500',
  completed: 'bg-muted text-muted-foreground',
  cancelled: 'bg-red-500/15 text-red-500',
  no_show: 'bg-amber-500/15 text-amber-500',
};

const statusLabels: Record<string, string> = {
  scheduled: 'Planifié', confirmed: 'Confirmé', completed: 'Terminé',
  cancelled: 'Annulé', no_show: 'Absent',
};

export default function Calendar() {
  const { user, hasAnyRole } = useAuth();
  const [items, setItems] = useState<Appointment[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const canEdit = hasAnyRole(['super_admin', 'admin', 'agent', 'manager']);

  const [form, setForm] = useState({
    title: '', client_id: '', appointment_date: '', duration_minutes: 60,
    location: '', meeting_url: '', description: '',
  });

  const load = async () => {
    setLoading(true);
    const [appts, cls] = await Promise.all([
      supabase.from('appointments').select('*, clients(full_name)').order('appointment_date', { ascending: true }),
      supabase.from('clients').select('id, full_name').order('full_name'),
    ]);
    setItems(appts.data || []);
    setClients(cls.data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const submit = async () => {
    if (!form.title || !form.appointment_date) {
      toast.error('Titre et date requis');
      return;
    }
    const { error } = await supabase.from('appointments').insert({
      title: form.title,
      client_id: form.client_id || null,
      appointment_date: new Date(form.appointment_date).toISOString(),
      duration_minutes: Number(form.duration_minutes),
      location: form.location || null,
      meeting_url: form.meeting_url || null,
      description: form.description || null,
      created_by: user?.id,
      agent_id: user?.id,
    });
    if (error) { toast.error(error.message); return; }
    toast.success('Rendez-vous créé');
    setOpen(false);
    setForm({ title: '', client_id: '', appointment_date: '', duration_minutes: 60, location: '', meeting_url: '', description: '' });
    load();
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('appointments').update({ status: status as any }).eq('id', id);
    load();
  };

  const groupLabel = (date: string) => {
    const d = parseISO(date);
    if (isToday(d)) return "Aujourd'hui";
    if (isTomorrow(d)) return 'Demain';
    if (isThisWeek(d, { locale: fr })) return 'Cette semaine';
    return 'Plus tard';
  };

  const grouped = items.reduce((acc, a) => {
    const k = groupLabel(a.appointment_date);
    (acc[k] ||= []).push(a);
    return acc;
  }, {} as Record<string, Appointment[]>);

  const order = ["Aujourd'hui", 'Demain', 'Cette semaine', 'Plus tard'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Calendrier & Rendez-vous</h1>
          <p className="text-muted-foreground text-sm">Gérez vos rendez-vous clients</p>
        </div>
        {canEdit && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="w-4 h-4" />Nouveau RDV</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Nouveau rendez-vous</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Titre *</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
                <div><Label>Client</Label>
                  <Select value={form.client_id} onValueChange={v => setForm({ ...form, client_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner un client" /></SelectTrigger>
                    <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Date & heure *</Label><Input type="datetime-local" value={form.appointment_date} onChange={e => setForm({ ...form, appointment_date: e.target.value })} /></div>
                  <div><Label>Durée (min)</Label><Input type="number" value={form.duration_minutes} onChange={e => setForm({ ...form, duration_minutes: +e.target.value })} /></div>
                </div>
                <div><Label>Lieu</Label><Input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="Bureau, adresse..." /></div>
                <div><Label>Lien visio</Label><Input value={form.meeting_url} onChange={e => setForm({ ...form, meeting_url: e.target.value })} placeholder="https://..." /></div>
                <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} /></div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
                <Button onClick={submit}>Créer</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {loading ? (
        <Card className="p-12 text-center text-muted-foreground">Chargement...</Card>
      ) : items.length === 0 ? (
        <Card className="p-12 text-center">
          <CalendarIcon className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40" />
          <p className="font-semibold">Aucun rendez-vous</p>
          <p className="text-sm text-muted-foreground">Créez votre premier rendez-vous</p>
        </Card>
      ) : (
        <div className="space-y-8">
          {order.filter(k => grouped[k]?.length).map(group => (
            <div key={group}>
              <h3 className="font-display font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-3">{group}</h3>
              <div className="space-y-2">
                {grouped[group].map(a => {
                  const date = parseISO(a.appointment_date);
                  return (
                    <Card key={a.id} className="p-4 hover:border-vayase-accent/40 transition-colors">
                      <div className="flex items-start gap-4">
                        <div className="text-center w-14 shrink-0 py-2 rounded-lg bg-secondary/50">
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{format(date, 'MMM', { locale: fr })}</div>
                          <div className="text-2xl font-display font-bold text-vayase-accent">{format(date, 'dd')}</div>
                          <div className="text-[10px] text-muted-foreground">{format(date, 'HH:mm')}</div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <h4 className="font-semibold">{a.title}</h4>
                            <Badge className={cn('text-[10px] uppercase font-semibold', statusColors[a.status])}>{statusLabels[a.status]}</Badge>
                          </div>
                          {a.clients?.full_name && (
                            <div className="text-sm text-muted-foreground flex items-center gap-1.5 mb-1">
                              <UsersIcon className="w-3.5 h-3.5" /> {a.clients.full_name}
                            </div>
                          )}
                          <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{a.duration_minutes} min</span>
                            {a.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{a.location}</span>}
                            {a.meeting_url && <a href={a.meeting_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-vayase-accent hover:underline"><Video className="w-3 h-3" />Visio</a>}
                          </div>
                          {a.description && <p className="text-sm text-muted-foreground mt-2">{a.description}</p>}
                        </div>
                        {canEdit && a.status !== 'completed' && a.status !== 'cancelled' && (
                          <Select value={a.status} onValueChange={v => updateStatus(a.id, v)}>
                            <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {Object.entries(statusLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
