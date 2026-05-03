import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Shield, Plus, X, Globe, ScrollText } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const allRoles = [
  { value: 'super_admin', label: 'Super Admin', color: 'bg-red-500/15 text-red-500' },
  { value: 'admin', label: 'Administrateur', color: 'bg-purple-500/15 text-purple-500' },
  { value: 'agent', label: 'Agent', color: 'bg-blue-500/15 text-blue-500' },
  { value: 'marketing_agent', label: 'Marketing Agent', color: 'bg-pink-500/15 text-pink-500' },
  { value: 'comptable', label: 'Comptable', color: 'bg-emerald-500/15 text-emerald-500' },
  { value: 'manager', label: 'Manager', color: 'bg-amber-500/15 text-amber-500' },
  { value: 'support', label: 'Support', color: 'bg-muted text-muted-foreground' },
];

const allCountries = ['Canada', 'Germany', 'France', 'United Kingdom', 'United States', 'Australia', 'Belgium', 'Spain'];

export default function Employees() {
  const { hasAnyRole, user: currentUser } = useAuth();
  const [employees, setEmployees] = useState<any[]>([]);
  const [allRolesData, setAllRolesData] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<any[]>([]);
  const [activityLog, setActivityLog] = useState<any[]>([]);
  const [assignedClients, setAssignedClients] = useState<any[]>([]);
  const [completedSteps, setCompletedSteps] = useState<any[]>([]);
  const [stepNotes, setStepNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('employees');
  const isAdmin = hasAnyRole(['super_admin', 'admin']);

  const [permDialog, setPermDialog] = useState<{ open: boolean; userId: string | null; userName: string }>({ open: false, userId: null, userName: '' });
  const [newCountry, setNewCountry] = useState('');
  const [newRole, setNewRole] = useState('');

  const load = async () => {
    setLoading(true);
    const [profs, urs, perms, log, cls, steps, notes] = await Promise.all([
      supabase.from('profiles').select('*, user_roles(role)').order('created_at', { ascending: false }),
      supabase.from('user_roles').select('*'),
      supabase.from('agent_country_permissions').select('*'),
      supabase.from('activity_log').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('clients').select('id, agent_id'),
      supabase.from('client_steps').select('id, responsible_id, status'),
      supabase.from('client_step_notes').select('id, user_id'),
    ]);
    
    // Filtrer pour ne garder que le personnel (exclure ceux qui ont uniquement ou le rôle 'client')
    const allProfs = profs.data || [];
    const staffOnly = allProfs.filter((u: any) => {
      const roles = u.user_roles || [];
      const hasClientRole = roles.some((r: any) => r.role === 'client');
      // On exclut les utilisateurs qui ont le rôle 'client'
      return !hasClientRole;
    });

    setEmployees(staffOnly);
    setAllRolesData(urs.data || []);
    setPermissions(perms.data || []);
    setActivityLog(log.data || []);
    setAssignedClients(cls.data || []);
    setCompletedSteps(steps.data || []);
    setStepNotes(notes.data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const userRoles = (uid: string) => allRolesData.filter(r => r.user_id === uid);
  const userCountries = (uid: string) => permissions.filter(p => p.user_id === uid);
  const assignedCount = (uid: string) => assignedClients.filter(c => c.agent_id === uid).length;
  const completedCount = (uid: string) => completedSteps.filter(s => s.responsible_id === uid && s.status === 'completed').length;
  const notesCount = (uid: string) => stepNotes.filter(n => n.user_id === uid).length;

  const addRole = async (uid: string, role: string) => {
    if (!isAdmin) return;
    const { error } = await supabase.from('user_roles').insert({ user_id: uid, role: role as any });
    if (error) { toast.error(error.message); return; }
    toast.success('Rôle ajouté');
    load();
  };

  const removeRole = async (id: string) => {
    if (!isAdmin) return;
    await supabase.from('user_roles').delete().eq('id', id);
    toast.success('Rôle retiré');
    load();
  };

  const addCountry = async () => {
    if (!permDialog.userId || !newCountry) return;
    const { error } = await supabase.from('agent_country_permissions').insert({
      user_id: permDialog.userId, country: newCountry,
    });
    if (error) { toast.error(error.message); return; }
    toast.success('Permission ajoutée');
    setNewCountry('');
    load();
  };

  const removeCountry = async (id: string) => {
    await supabase.from('agent_country_permissions').delete().eq('id', id);
    load();
  };

  if (!isAdmin) {
    return (
      <Card className="p-12 text-center">
        <Shield className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40" />
        <h3 className="font-display font-semibold">Accès restreint</h3>
        <p className="text-sm text-muted-foreground">Seuls les administrateurs peuvent gérer les employés.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">Employés & Permissions</h1>
        <p className="text-muted-foreground text-sm">Gérez les accès et rôles de l'équipe</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="employees" className="gap-2"><Users className="w-4 h-4" />Employés ({employees.length})</TabsTrigger>
          <TabsTrigger value="permissions" className="gap-2"><Shield className="w-4 h-4" />Permissions pays</TabsTrigger>
          <TabsTrigger value="activity" className="gap-2"><ScrollText className="w-4 h-4" />Journal d'activité</TabsTrigger>
        </TabsList>

        <TabsContent value="employees" className="mt-6">
          {loading ? (
            <Card className="p-12 text-center text-muted-foreground">Chargement...</Card>
          ) : (
            <div className="space-y-3">
              {employees.map(emp => {
                const roles = userRoles(emp.id);
                const countries = userCountries(emp.id);
                const initials = (emp.full_name || 'U').slice(0, 2).toUpperCase();
                const roleLabels = roles
                  .map(r => allRoles.find(a => a.value === r.role)?.label)
                  .filter(Boolean)
                  .join(', ');
                return (
                  <Card key={emp.id} className="p-4">
                    <div className="flex items-start gap-4">
                      <Avatar className="w-12 h-12">
                        <AvatarFallback className="bg-gradient-accent text-vayase-night font-bold">{initials}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-semibold">{emp.full_name || 'Sans nom'}</h4>
                          {emp.id === currentUser?.id && <Badge variant="outline" className="text-[9px]">VOUS</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground">Inscrit le {format(new Date(emp.created_at), 'dd/MM/yyyy')}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Roles: {roleLabels || 'Aucun role'}
                        </p>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          {roles.map(r => {
                            const cfg = allRoles.find(a => a.value === r.role);
                            return (
                              <Badge key={r.id} className={cn('gap-1.5', cfg?.color)}>
                                {cfg?.label}
                                {emp.id !== currentUser?.id && (
                                  <button onClick={() => removeRole(r.id)} className="hover:text-foreground">
                                    <X className="w-3 h-3" />
                                  </button>
                                )}
                              </Badge>
                            );
                          })}
                          {roles.length === 0 && <span className="text-xs text-muted-foreground italic">Aucun rôle</span>}
                        </div>
                        {countries.length > 0 && (
                          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                            <Globe className="w-3 h-3 text-muted-foreground" />
                            {countries.map(c => (
                              <Badge key={c.id} variant="secondary" className="text-[10px]">{c.country}</Badge>
                            ))}
                          </div>
                        )}
                        <div className="grid grid-cols-3 gap-2 mt-3">
                          <div className="rounded-md bg-secondary/50 px-2 py-1.5">
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Clients</div>
                            <div className="text-sm font-semibold">{assignedCount(emp.id)}</div>
                          </div>
                          <div className="rounded-md bg-secondary/50 px-2 py-1.5">
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Étapes</div>
                            <div className="text-sm font-semibold">{completedCount(emp.id)}</div>
                          </div>
                          <div className="rounded-md bg-secondary/50 px-2 py-1.5">
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Notes</div>
                            <div className="text-sm font-semibold">{notesCount(emp.id)}</div>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Select value="" onValueChange={(v) => addRole(emp.id, v)}>
                          <SelectTrigger className="w-[160px] h-8 text-xs">
                            <span className="text-muted-foreground"><Plus className="w-3 h-3 inline mr-1" />Ajouter role</span>
                          </SelectTrigger>
                          <SelectContent>
                            {allRoles.filter(r => !roles.find(ur => ur.role === r.value)).map(r => (
                              <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button variant="outline" size="sm" className="h-8 text-xs"
                          onClick={() => setPermDialog({ open: true, userId: emp.id, userName: emp.full_name || 'Employé' })}>
                          <Globe className="w-3 h-3 mr-1" />Pays
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="permissions" className="mt-6">
          <Card className="p-6">
            <h3 className="font-display font-semibold mb-2">Restrictions par pays</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Affectez des pays spécifiques aux agents. Si aucun pays n'est défini, l'agent voit tous les clients (selon ses rôles).
            </p>
            <div className="space-y-3">
              {employees.filter(e => userCountries(e.id).length > 0).map(emp => (
                <div key={emp.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/40">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-8 h-8"><AvatarFallback className="text-xs bg-gradient-accent text-vayase-night">{(emp.full_name || 'U').slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
                    <span className="font-medium text-sm">{emp.full_name}</span>
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    {userCountries(emp.id).map(c => (
                      <Badge key={c.id} variant="secondary" className="text-[10px] gap-1">
                        {c.country}
                        <button onClick={() => removeCountry(c.id)}><X className="w-2.5 h-2.5" /></button>
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
              {employees.filter(e => userCountries(e.id).length > 0).length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-8">Aucune restriction configurée</p>
              )}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="mt-6">
          <Card className="overflow-hidden">
            <div className="p-4 border-b">
              <h3 className="font-display font-semibold">Journal d'activité</h3>
              <p className="text-xs text-muted-foreground">50 dernières actions</p>
            </div>
            {activityLog.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">Aucune activité enregistrée</div>
            ) : (
              <div className="divide-y">
                {activityLog.map(a => (
                  <div key={a.id} className="p-3 hover:bg-secondary/30 text-sm flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-vayase-accent shrink-0" />
                    <div className="flex-1">
                      <span className="font-medium">{a.action}</span>
                      {a.entity_type && <span className="text-muted-foreground"> · {a.entity_type}</span>}
                    </div>
                    <span className="text-xs text-muted-foreground">{format(new Date(a.created_at), 'dd/MM HH:mm')}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={permDialog.open} onOpenChange={(o) => setPermDialog({ ...permDialog, open: o })}>
        <DialogContent>
          <DialogHeader><DialogTitle>Pays autorisés — {permDialog.userName}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {permDialog.userId && userCountries(permDialog.userId).map(c => (
                <Badge key={c.id} variant="secondary" className="gap-1">
                  {c.country}
                  <button onClick={() => removeCountry(c.id)}><X className="w-3 h-3" /></button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Select value={newCountry} onValueChange={setNewCountry}>
                <SelectTrigger><SelectValue placeholder="Choisir un pays" /></SelectTrigger>
                <SelectContent>
                  {allCountries.filter(c => !permDialog.userId || !userCountries(permDialog.userId).find(uc => uc.country === c)).map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={addCountry}>Ajouter</Button>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setPermDialog({ ...permDialog, open: false })}>Fermer</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
