import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download, FileText, Users, Wallet, TrendingUp, Globe } from 'lucide-react';
import { generateClientsReport, generateFinanceReport, exportToExcel } from '@/lib/exports';
import { BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip as ReTooltip, CartesianGrid } from 'recharts';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

const COLORS = ['#49BFFF', '#7C3AED', '#10B981', '#F59E0B', '#EF4444', '#EC4899'];

export default function Reports() {
  const { user, hasAnyRole } = useAuth();
  const isAdminView = hasAnyRole(['super_admin', 'admin']);
  const [data, setData] = useState<any>({ clients: [], payments: [], contracts: [], leads: [], users: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [c, p, ct] = await Promise.all([
        supabase.from('clients').select('*'),
        supabase.from('payments').select('*'),
        supabase.from('contracts').select('*'),
      ]);
      const [leadsRes, usersRes] = await Promise.all([
        supabase.from('leads').select('id, status, referred_by_user_id, converted_by_user_id'),
        supabase.from('profiles').select('id, full_name'),
      ]);
      setData({
        clients: c.data || [],
        payments: p.data || [],
        contracts: ct.data || [],
        leads: leadsRes.data || [],
        users: usersRes.data || [],
      });
      setLoading(false);
    })();
  }, []);

  if (loading) return <Card className="p-12 text-center">Chargement...</Card>;

  const { clients, payments, contracts, leads, users } = data;

  // Aggregations
  const byCountry = clients.reduce((acc: Record<string, number>, c: any) => {
    const k = c.destination_country || 'Non défini';
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});
  const countryData = Object.entries(byCountry).map(([name, value]) => ({ name, value }));

  const byStatus = clients.reduce((acc: Record<string, number>, c: any) => {
    acc[c.status] = (acc[c.status] || 0) + 1;
    return acc;
  }, {});
  const statusData = Object.entries(byStatus).map(([name, value]) => ({ name, value }));

  const totalRevenue = contracts.reduce((s: number, c: any) => s + Number(c.total_amount || 0), 0);
  const paidAmount = payments.filter((p: any) => p.status === 'paid').reduce((s: number, p: any) => s + Number(p.amount), 0);
  const pendingAmount = payments.filter((p: any) => p.status === 'pending').reduce((s: number, p: any) => s + Number(p.amount), 0);
  const overdueAmount = payments.filter((p: any) => p.status === 'overdue').reduce((s: number, p: any) => s + Number(p.amount), 0);

  // Monthly revenue (last 6 months)
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    return { key: format(d, 'yyyy-MM'), label: format(d, 'MMM') };
  });
  const monthlyRev = months.map(m => ({
    month: m.label,
    paid: payments.filter((p: any) => p.payment_date?.startsWith(m.key) && p.status === 'paid').reduce((s: number, p: any) => s + Number(p.amount), 0),
    pending: payments.filter((p: any) => p.due_date?.startsWith(m.key) && p.status === 'pending').reduce((s: number, p: any) => s + Number(p.amount), 0),
  }));

  const userNames = new Map<string, string>(users.map((u: any) => [u.id, u.full_name || u.id]));
  const byReferrer = leads.reduce((acc: Record<string, number>, lead: any) => {
    if (lead.status !== 'converted' || !lead.referred_by_user_id) return acc;
    acc[lead.referred_by_user_id] = (acc[lead.referred_by_user_id] || 0) + 1;
    return acc;
  }, {});
  const referralLeaderboard = Object.entries(byReferrer)
    .map(([userId, conversions]) => ({
      userId,
      name: userNames.get(userId) || userId,
      conversions,
    }))
    .sort((a, b) => b.conversions - a.conversions);

  const byConverter = leads.reduce((acc: Record<string, number>, lead: any) => {
    if (lead.status !== 'converted' || !lead.converted_by_user_id) return acc;
    acc[lead.converted_by_user_id] = (acc[lead.converted_by_user_id] || 0) + 1;
    return acc;
  }, {});
  const converterLeaderboard = Object.entries(byConverter)
    .map(([userId, conversions]) => ({
      userId,
      name: userNames.get(userId) || userId,
      conversions,
    }))
    .sort((a, b) => b.conversions - a.conversions);
  const myConversions = user?.id ? (byConverter[user.id] || 0) : 0;
  const myReferralConversions = user?.id ? (byReferrer[user.id] || 0) : 0;

  const exportClientsExcel = () => {
    exportToExcel(clients.map((c: any) => ({
      Nom: c.full_name, Email: c.email, Téléphone: c.phone,
      Pays: c.destination_country, Visa: c.visa_type,
      Programme: c.program, Statut: c.status,
      Créé: format(new Date(c.created_at), 'dd/MM/yyyy'),
    })), 'clients', 'Clients');
    toast.success('Export Excel généré');
  };

  const exportPaymentsExcel = () => {
    exportToExcel(payments.map((p: any) => ({
      Référence: p.reference, Montant: p.amount, Devise: p.currency,
      'Date paiement': p.payment_date, 'Échéance': p.due_date,
      Mode: p.payment_method, Statut: p.status,
    })), 'paiements', 'Paiements');
    toast.success('Export Excel généré');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">Rapports & Exports</h1>
        <p className="text-muted-foreground text-sm">Statistiques et exports professionnels</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: Users, label: 'Clients', value: clients.length, color: 'text-blue-500 bg-blue-500/10' },
          { icon: Wallet, label: 'Revenus contrats', value: `${totalRevenue.toLocaleString('fr-FR')} XOF`, color: 'text-emerald-500 bg-emerald-500/10' },
          { icon: TrendingUp, label: 'Encaissé', value: `${paidAmount.toLocaleString('fr-FR')} XOF`, color: 'text-vayase-accent bg-vayase-accent/10' },
          { icon: Globe, label: 'Pays', value: Object.keys(byCountry).length, color: 'text-purple-500 bg-purple-500/10' },
        ].map((s, i) => (
          <Card key={i} className="p-4">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${s.color}`}>
              <s.icon className="w-5 h-5" />
            </div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{s.label}</p>
            <p className="text-xl font-display font-bold mt-1">{s.value}</p>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Mes leads convertis</p>
          <p className="text-2xl font-display font-bold mt-1">{myConversions}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Mes referrals convertis</p>
          <p className="text-2xl font-display font-bold mt-1">{myReferralConversions}</p>
        </Card>
      </div>

      <Tabs defaultValue="exports">
        <TabsList>
          <TabsTrigger value="exports">Exports</TabsTrigger>
          <TabsTrigger value="charts">Graphiques</TabsTrigger>
        </TabsList>

        <TabsContent value="exports" className="mt-6 space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Card className="p-6">
              <Users className="w-8 h-8 text-vayase-accent mb-3" />
              <h3 className="font-display font-semibold mb-1">Rapport Clients</h3>
              <p className="text-sm text-muted-foreground mb-4">{clients.length} clients · Liste complète</p>
              <div className="flex gap-2">
                <Button onClick={() => generateClientsReport(clients)} className="gap-2"><Download className="w-4 h-4" />PDF</Button>
                <Button variant="outline" onClick={exportClientsExcel} className="gap-2"><Download className="w-4 h-4" />Excel</Button>
              </div>
            </Card>
            <Card className="p-6">
              <Wallet className="w-8 h-8 text-emerald-500 mb-3" />
              <h3 className="font-display font-semibold mb-1">Rapport Financier</h3>
              <p className="text-sm text-muted-foreground mb-4">{payments.length} paiements · Synthèse</p>
              <div className="flex gap-2">
                <Button onClick={() => generateFinanceReport(payments, { total: totalRevenue, paid: paidAmount, pending: pendingAmount, overdue: overdueAmount })} className="gap-2"><Download className="w-4 h-4" />PDF</Button>
                <Button variant="outline" onClick={exportPaymentsExcel} className="gap-2"><Download className="w-4 h-4" />Excel</Button>
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="charts" className="mt-6 grid md:grid-cols-2 gap-4">
          <Card className="p-5">
            <h3 className="font-display font-semibold mb-4">Revenus mensuels (6 mois)</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={monthlyRev}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="month" fontSize={11} />
                <YAxis fontSize={11} />
                <ReTooltip />
                <Bar dataKey="paid" fill="#10B981" name="Payé" radius={[4, 4, 0, 0]} />
                <Bar dataKey="pending" fill="#F59E0B" name="En attente" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
          <Card className="p-5">
            <h3 className="font-display font-semibold mb-4">Clients par pays</h3>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={countryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={(e) => e.name}>
                  {countryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <ReTooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>
          <Card className="p-5 md:col-span-2">
            <h3 className="font-display font-semibold mb-4">Statut clients</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={statusData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis type="number" fontSize={11} />
                <YAxis type="category" dataKey="name" fontSize={11} width={100} />
                <ReTooltip />
                <Bar dataKey="value" fill="#49BFFF" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card className="p-5 md:col-span-2">
            <h3 className="font-display font-semibold mb-4">Conversions par référent</h3>
            {referralLeaderboard.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune conversion liée à un référent pour le moment.</p>
            ) : (
              <div className="space-y-2">
                {referralLeaderboard.map((row, index) => (
                  <div
                    key={row.userId}
                    className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
                  >
                    <p className="text-sm">
                      <span className="text-muted-foreground mr-2">#{index + 1}</span>
                      <span className="font-medium">{row.name}</span>
                    </p>
                    <p className="text-sm font-semibold">{row.conversions} conversion{row.conversions > 1 ? 's' : ''}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>
          {isAdminView && (
            <Card className="p-5 md:col-span-2">
              <h3 className="font-display font-semibold mb-4">Conversions par convertisseur</h3>
              {converterLeaderboard.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune conversion enregistrée pour le moment.</p>
              ) : (
                <div className="space-y-2">
                  {converterLeaderboard.map((row, index) => (
                    <div
                      key={row.userId}
                      className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
                    >
                      <p className="text-sm">
                        <span className="text-muted-foreground mr-2">#{index + 1}</span>
                        <span className="font-medium">{row.name}</span>
                      </p>
                      <p className="text-sm font-semibold">{row.conversions} conversion{row.conversions > 1 ? 's' : ''}</p>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
