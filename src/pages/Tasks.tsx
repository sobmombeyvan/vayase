import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle2, ClipboardList, Clock3, Plus, Trash2 } from 'lucide-react';

type TaskStatus = 'todo' | 'in_progress' | 'done' | 'cancelled';
type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

const statusLabel: Record<TaskStatus, string> = {
  todo: 'A faire',
  in_progress: 'En cours',
  done: 'Termine',
  cancelled: 'Annule',
};

const priorityLabel: Record<TaskPriority, string> = {
  low: 'Basse',
  medium: 'Moyenne',
  high: 'Haute',
  urgent: 'Urgente',
};

const priorityClass: Record<TaskPriority, string> = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-blue-500/15 text-blue-600',
  high: 'bg-amber-500/15 text-amber-600',
  urgent: 'bg-red-500/15 text-red-600',
};

export default function Tasks() {
  const { user, hasAnyRole } = useAuth();
  const isAdmin = hasAnyRole(['super_admin', 'admin']);
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Array<{ id: string; full_name: string | null }>>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [tab, setTab] = useState('mine');
  const [createForm, setCreateForm] = useState({
    title: '',
    description: '',
    assigned_to: '',
    due_date: '',
    priority: 'medium' as TaskPriority,
  });

  const profileNameById = useMemo(
    () =>
      profiles.reduce<Record<string, string>>((acc, p) => {
        acc[p.id] = p.full_name || 'Utilisateur';
        return acc;
      }, {}),
    [profiles]
  );

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [profilesRes, rolesRes, tasksRes] = await Promise.all([
      supabase.from('profiles').select('id, full_name').order('full_name'),
      supabase.from('user_roles').select('user_id, role'),
      isAdmin
        ? supabase.from('tasks').select('*').order('created_at', { ascending: false })
        : supabase.from('tasks').select('*').eq('assigned_to', user.id).order('created_at', { ascending: false }),
    ]);

    if (profilesRes.error) toast.error(profilesRes.error.message);
    if (rolesRes.error) toast.error(rolesRes.error.message);
    if (tasksRes.error) toast.error(tasksRes.error.message);

    const clientUserIds = new Set(
      (rolesRes.data || [])
        .filter(r => r.role === 'client')
        .map(r => r.user_id)
    );

    const staffProfiles = (profilesRes.data || []).filter(p => !clientUserIds.has(p.id));

    setProfiles(staffProfiles);
    setTasks(tasksRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [user?.id, isAdmin]);

  const createTask = async () => {
    if (!createForm.title.trim() || !createForm.assigned_to) {
      toast.error('Titre et utilisateur obligatoire');
      return;
    }
    const { error } = await supabase.from('tasks').insert({
      title: createForm.title.trim(),
      description: createForm.description.trim() || null,
      assigned_to: createForm.assigned_to,
      due_date: createForm.due_date || null,
      priority: createForm.priority,
      created_by: user?.id ?? null,
      status: 'todo',
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Tache creee');
    setCreateForm({ title: '', description: '', assigned_to: '', due_date: '', priority: 'medium' });
    load();
  };

  const updateTaskStatus = async (taskId: string, status: TaskStatus) => {
    const payload: any = { status };
    if (status === 'done') payload.completed_at = new Date().toISOString();
    if (status !== 'done') payload.completed_at = null;
    const { error } = await supabase.from('tasks').update(payload).eq('id', taskId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Statut mis a jour');
    load();
  };

  const deleteTask = async (taskId: string) => {
    if (!isAdmin) return;
    const { error } = await supabase.from('tasks').delete().eq('id', taskId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Tache supprimee');
    load();
  };

  const myTasks = tasks.filter((t) => t.assigned_to === user?.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">Taches quotidiennes</h1>
        <p className="text-sm text-muted-foreground">
          {isAdmin ? 'Attribuez des taches avec deadline a chaque utilisateur.' : 'Suivez et terminez vos taches assignees.'}
        </p>
      </div>

      {isAdmin && (
        <Card className="p-5 space-y-4">
          <h3 className="font-display font-semibold flex items-center gap-2">
            <Plus className="w-4 h-4 text-vayase-accent" />
            Nouvelle tache
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Titre</Label>
              <Input
                value={createForm.title}
                onChange={(e) => setCreateForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="Ex: Relancer les prospects de la semaine"
              />
            </div>
            <div className="space-y-1">
              <Label>Assigne a</Label>
              <Select value={createForm.assigned_to} onValueChange={(v) => setCreateForm((p) => ({ ...p, assigned_to: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir un utilisateur" />
                </SelectTrigger>
                <SelectContent>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name || p.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Deadline</Label>
              <Input
                type="date"
                value={createForm.due_date}
                onChange={(e) => setCreateForm((p) => ({ ...p, due_date: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Priorite</Label>
              <Select value={createForm.priority} onValueChange={(v: TaskPriority) => setCreateForm((p) => ({ ...p, priority: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Basse</SelectItem>
                  <SelectItem value="medium">Moyenne</SelectItem>
                  <SelectItem value="high">Haute</SelectItem>
                  <SelectItem value="urgent">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Description</Label>
            <Textarea
              value={createForm.description}
              onChange={(e) => setCreateForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="Instructions detaillees pour l'utilisateur"
              rows={3}
            />
          </div>
          <div className="flex justify-end">
            <Button onClick={createTask}>Envoyer la tache</Button>
          </div>
        </Card>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="mine" className="gap-2">
            <ClipboardList className="w-4 h-4" />
            Mes taches ({myTasks.length})
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="all" className="gap-2">
              <Clock3 className="w-4 h-4" />
              Toutes les taches ({tasks.length})
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="mine" className="mt-4">
          <TaskList
            loading={loading}
            tasks={myTasks}
            profileNameById={profileNameById}
            isAdmin={isAdmin}
            onStatusChange={updateTaskStatus}
            onDelete={deleteTask}
          />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="all" className="mt-4">
            <TaskList
              loading={loading}
              tasks={tasks}
              profileNameById={profileNameById}
              isAdmin={isAdmin}
              onStatusChange={updateTaskStatus}
              onDelete={deleteTask}
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function TaskList({
  loading,
  tasks,
  profileNameById,
  isAdmin,
  onStatusChange,
  onDelete,
}: {
  loading: boolean;
  tasks: any[];
  profileNameById: Record<string, string>;
  isAdmin: boolean;
  onStatusChange: (taskId: string, status: TaskStatus) => void;
  onDelete: (taskId: string) => void;
}) {
  if (loading) return <Card className="p-8 text-center text-muted-foreground">Chargement...</Card>;
  if (tasks.length === 0) return <Card className="p-8 text-center text-muted-foreground">Aucune tache</Card>;

  return (
    <div className="space-y-3">
      {tasks.map((task) => (
        <Card key={task.id} className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="font-semibold">{task.title}</h4>
                <Badge className={priorityClass[task.priority as TaskPriority]}>
                  {priorityLabel[task.priority as TaskPriority]}
                </Badge>
                <Badge variant="outline">{statusLabel[task.status as TaskStatus]}</Badge>
              </div>
              {task.description && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{task.description}</p>}
              <div className="text-xs text-muted-foreground flex flex-wrap gap-3">
                <span>Assigne a: {task.assigned_to ? profileNameById[task.assigned_to] || task.assigned_to : 'Non assigne'}</span>
                <span>Deadline: {task.due_date ? format(new Date(task.due_date), 'dd/MM/yyyy') : 'Aucune'}</span>
                <span>Cree le: {format(new Date(task.created_at), 'dd/MM/yyyy HH:mm')}</span>
              </div>
            </div>
            <div className="flex flex-col gap-2 w-[170px] shrink-0">
              <Select value={task.status} onValueChange={(v: TaskStatus) => onStatusChange(task.id, v)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">A faire</SelectItem>
                  <SelectItem value="in_progress">En cours</SelectItem>
                  <SelectItem value="done">Termine</SelectItem>
                  <SelectItem value="cancelled">Annule</SelectItem>
                </SelectContent>
              </Select>
              {task.status !== 'done' && (
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => onStatusChange(task.id, 'done')}>
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Marquer termine
                </Button>
              )}
              {isAdmin && (
                <Button size="sm" variant="destructive" className="h-8 text-xs" onClick={() => onDelete(task.id)}>
                  <Trash2 className="w-3 h-3 mr-1" />
                  Supprimer
                </Button>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
