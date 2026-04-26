import { ChangeEvent, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DatabaseBackup, FileDown, FileUp, FileText } from 'lucide-react';
import { generateClientsReport, generateFinanceReport, generateGlobalSummaryReport } from '@/lib/exports';

const BACKUP_TABLES = [
  'profiles',
  'user_roles',
  'leads',
  'clients',
  'client_steps',
  'client_step_notes',
  'contracts',
  'payments',
  'appointments',
  'documents',
  'notifications',
  'tasks',
  'procedure_templates',
  'procedure_template_steps',
  'agent_country_permissions',
] as const;

type BackupPayload = {
  version: number;
  exported_at: string;
  tables: Record<string, any[]>;
};

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminOps() {
  const { hasAnyRole } = useAuth();
  const isAdmin = hasAnyRole(['super_admin', 'admin']);
  const [tab, setTab] = useState('backup');
  const [busy, setBusy] = useState(false);
  const [restoreFileName, setRestoreFileName] = useState('');

  const title = useMemo(() => (busy ? 'Traitement en cours...' : 'Administration avancée'), [busy]);

  if (!isAdmin) {
    return (
      <Card className="p-12 text-center">
        <h3 className="font-display font-semibold">Acces restreint</h3>
        <p className="text-sm text-muted-foreground">Cette page est reservee aux administrateurs.</p>
      </Card>
    );
  }

  const exportBackup = async () => {
    setBusy(true);
    try {
      const tables: Record<string, any[]> = {};
      for (const table of BACKUP_TABLES) {
        const { data, error } = await supabase.from(table).select('*');
        if (error) throw error;
        tables[table] = data || [];
      }
      const payload: BackupPayload = {
        version: 1,
        exported_at: new Date().toISOString(),
        tables,
      };
      downloadJson(`vayase-backup-${new Date().toISOString().slice(0, 10)}.json`, payload);
      toast.success('Backup JSON exporte');
    } catch (error: any) {
      toast.error(error.message || 'Erreur export backup');
    } finally {
      setBusy(false);
    }
  };

  const restoreBackupContent = async (payload: BackupPayload) => {
    if (!payload?.tables) {
      toast.error('Backup invalide');
      return;
    }
    if (!confirm('La restauration va ecraser les donnees actuelles des tables applicatives. Continuer ?')) return;

    setBusy(true);
    try {
      const restoreOrder = [...BACKUP_TABLES].reverse();
      for (const table of restoreOrder) {
        const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
        if (error) throw error;
      }

      for (const table of BACKUP_TABLES) {
        const rows = payload.tables[table] || [];
        if (!rows.length) continue;
        const { error } = await supabase.from(table).insert(rows as any);
        if (error) throw error;
      }
      toast.success('Restauration terminee');
    } catch (error: any) {
      toast.error(error.message || 'Erreur restauration');
    } finally {
      setBusy(false);
    }
  };

  const handleRestoreFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRestoreFileName(file.name);
    const text = await file.text();
    try {
      const payload = JSON.parse(text) as BackupPayload;
      await restoreBackupContent(payload);
    } catch {
      toast.error('Fichier JSON invalide');
    }
  };

  const exportClientsPdf = async () => {
    setBusy(true);
    const { data, error } = await supabase.from('clients').select('*').order('created_at', { ascending: false });
    setBusy(false);
    if (error) return toast.error(error.message);
    generateClientsReport(data || []);
  };

  const exportFinancePdf = async () => {
    setBusy(true);
    const [paymentsRes, contractsRes] = await Promise.all([
      supabase.from('payments').select('*'),
      supabase.from('contracts').select('*'),
    ]);
    setBusy(false);
    if (paymentsRes.error || contractsRes.error) return toast.error(paymentsRes.error?.message || contractsRes.error?.message);
    const payments = paymentsRes.data || [];
    const contracts = contractsRes.data || [];
    const total = contracts.reduce((sum, c) => sum + Number(c.total_amount || 0), 0);
    const paid = payments.filter((p) => p.status === 'paid').reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const pending = payments.filter((p) => p.status === 'pending').reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const overdue = payments.filter((p) => p.status === 'overdue').reduce((sum, p) => sum + Number(p.amount || 0), 0);
    generateFinanceReport(payments, { total, paid, pending, overdue });
  };

  const exportSummaryPdf = async () => {
    setBusy(true);
    const [leadsRes, clientsRes, contractsRes, paymentsRes] = await Promise.all([
      supabase.from('leads').select('id'),
      supabase.from('clients').select('id'),
      supabase.from('contracts').select('id, total_amount'),
      supabase.from('payments').select('id, amount, status'),
    ]);
    setBusy(false);
    if (leadsRes.error || clientsRes.error || contractsRes.error || paymentsRes.error) {
      return toast.error(leadsRes.error?.message || clientsRes.error?.message || contractsRes.error?.message || paymentsRes.error?.message);
    }
    const contracts = contractsRes.data || [];
    const payments = paymentsRes.data || [];
    generateGlobalSummaryReport({
      leadsCount: (leadsRes.data || []).length,
      clientsCount: (clientsRes.data || []).length,
      contractsCount: contracts.length,
      paymentsCount: payments.length,
      totalRevenue: contracts.reduce((sum, c) => sum + Number(c.total_amount || 0), 0),
      paidRevenue: payments.filter((p) => p.status === 'paid').reduce((sum, p) => sum + Number(p.amount || 0), 0),
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">{title}</h1>
        <p className="text-sm text-muted-foreground">Backup/restauration complete et exports PDF administratifs.</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="backup" className="gap-2">
            <DatabaseBackup className="w-4 h-4" />
            Backup & Restore
          </TabsTrigger>
          <TabsTrigger value="pdf" className="gap-2">
            <FileText className="w-4 h-4" />
            Exports PDF
          </TabsTrigger>
        </TabsList>

        <TabsContent value="backup" className="mt-4">
          <Card className="p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Button onClick={exportBackup} disabled={busy} className="gap-2">
                <FileDown className="w-4 h-4" />
                Exporter backup complet (JSON)
              </Button>
              <label className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium cursor-pointer hover:bg-secondary transition-colors gap-2">
                <FileUp className="w-4 h-4" />
                Restaurer depuis un fichier JSON
                <input type="file" accept="application/json" className="hidden" onChange={handleRestoreFile} />
              </label>
            </div>
            <p className="text-xs text-muted-foreground">
              Fichier choisi: {restoreFileName || 'Aucun'}.
              La restauration remplace les donnees applicatives du schema public.
            </p>
          </Card>
        </TabsContent>

        <TabsContent value="pdf" className="mt-4">
          <Card className="p-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Button onClick={exportClientsPdf} disabled={busy}>
                PDF clients
              </Button>
              <Button onClick={exportFinancePdf} disabled={busy}>
                PDF finance
              </Button>
              <Button onClick={exportSummaryPdf} disabled={busy}>
                PDF resume global
              </Button>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
