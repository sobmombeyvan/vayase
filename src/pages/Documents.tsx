import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { FileText, Upload, Download, Trash2, File as FileIcon, Image as ImageIcon, Search } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const categories = [
  { value: 'passport', label: 'Passeport' },
  { value: 'diploma', label: 'Diplôme' },
  { value: 'cv', label: 'CV' },
  { value: 'bank_statement', label: 'Relevé bancaire' },
  { value: 'photo', label: 'Photo' },
  { value: 'letter', label: 'Lettre' },
  { value: 'contract', label: 'Contrat' },
  { value: 'other', label: 'Autre' },
];

const categoryColors: Record<string, string> = {
  passport: 'bg-blue-500/15 text-blue-500',
  diploma: 'bg-purple-500/15 text-purple-500',
  cv: 'bg-emerald-500/15 text-emerald-500',
  bank_statement: 'bg-amber-500/15 text-amber-500',
  photo: 'bg-pink-500/15 text-pink-500',
  letter: 'bg-indigo-500/15 text-indigo-500',
  contract: 'bg-vayase-accent/15 text-vayase-accent',
  other: 'bg-muted text-muted-foreground',
};

export default function Documents() {
  const { user, hasAnyRole } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('all');
  const canManage = hasAnyRole(['super_admin', 'admin', 'agent', 'manager']);
  const canDelete = hasAnyRole(['super_admin', 'admin']);

  const [form, setForm] = useState({
    client_id: '', category: 'other', notes: '', file: null as File | null,
  });
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    setLoading(true);
    const [docs, cls] = await Promise.all([
      supabase.from('documents').select('*, clients(full_name)').order('created_at', { ascending: false }),
      supabase.from('clients').select('id, full_name').order('full_name'),
    ]);
    setItems(docs.data || []);
    setClients(cls.data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const submit = async () => {
    if (!form.client_id || !form.file) { toast.error('Client et fichier requis'); return; }
    setUploading(true);
    try {
      const ext = form.file.name.split('.').pop();
      const path = `${form.client_id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: upErr } = await supabase.storage.from('client-documents').upload(path, form.file);
      if (upErr) throw upErr;
      const { error: insErr } = await supabase.from('documents').insert({
        client_id: form.client_id,
        name: form.file.name,
        category: form.category as any,
        file_path: path,
        file_size: form.file.size,
        mime_type: form.file.type,
        uploaded_by: user?.id,
        notes: form.notes || null,
      });
      if (insErr) throw insErr;
      toast.success('Document uploadé');
      setOpen(false);
      setForm({ client_id: '', category: 'other', notes: '', file: null });
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (path: string, name: string) => {
    const { data, error } = await supabase.storage.from('client-documents').createSignedUrl(path, 60, { download: name });
    if (error) { toast.error(error.message); return; }
    window.location.href = data.signedUrl;
  };

  const remove = async (id: string, path: string) => {
    if (!confirm('Supprimer ce document ?')) return;
    await supabase.storage.from('client-documents').remove([path]);
    await supabase.from('documents').delete().eq('id', id);
    toast.success('Document supprimé');
    load();
  };

  const filtered = items.filter(d => {
    const matchSearch = !search || d.name.toLowerCase().includes(search.toLowerCase()) || d.clients?.full_name?.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCat === 'all' || d.category === filterCat;
    return matchSearch && matchCat;
  });

  const isImage = (mime?: string) => mime?.startsWith('image/');
  const fmtSize = (b?: number) => {
    if (!b) return '—';
    if (b < 1024) return b + ' B';
    if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
    return (b / 1024 / 1024).toFixed(1) + ' MB';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold">Documents</h1>
          <p className="text-muted-foreground text-sm">{items.length} document(s) stocké(s)</p>
        </div>
        {canManage && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Upload className="w-4 h-4" />Uploader</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nouveau document</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Client *</Label>
                  <Select value={form.client_id} onValueChange={v => setForm({ ...form, client_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Choisir un client" /></SelectTrigger>
                    <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Catégorie</Label>
                  <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{categories.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Fichier *</Label>
                  <Input type="file" onChange={e => setForm({ ...form, file: e.target.files?.[0] || null })} />
                </div>
                <div><Label>Notes</Label><Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
                <Button onClick={submit} disabled={uploading}>{uploading ? 'Upload...' : 'Uploader'}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={filterCat} onValueChange={setFilterCat}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes catégories</SelectItem>
              {categories.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {loading ? (
        <Card className="p-12 text-center text-muted-foreground">Chargement...</Card>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <FileText className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40" />
          <p className="font-semibold">Aucun document</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(d => (
            <Card key={d.id} className="p-4 hover:border-vayase-accent/40 transition-all hover:shadow-md group">
              <div className="flex items-start justify-between mb-3">
                <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', categoryColors[d.category])}>
                  {isImage(d.mime_type) ? <ImageIcon className="w-5 h-5" /> : <FileIcon className="w-5 h-5" />}
                </div>
                <Badge className={cn('text-[9px] uppercase font-semibold', categoryColors[d.category])}>
                  {categories.find(c => c.value === d.category)?.label}
                </Badge>
              </div>
              <h4 className="font-semibold text-sm truncate" title={d.name}>{d.name}</h4>
              <p className="text-xs text-muted-foreground mt-1">{d.clients?.full_name || '—'}</p>
              <div className="flex items-center justify-between mt-3 pt-3 border-t">
                <div className="text-[11px] text-muted-foreground">
                  <div>{fmtSize(d.file_size)}</div>
                  <div>{format(new Date(d.created_at), 'dd/MM/yyyy')}</div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => handleDownload(d.file_path, d.name)} className="h-8 w-8">
                    <Download className="w-3.5 h-3.5" />
                  </Button>
                  {canDelete && (
                    <Button variant="ghost" size="icon" onClick={() => remove(d.id, d.file_path)} className="h-8 w-8 text-destructive hover:text-destructive">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
