import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { KPICard, SectionCard } from '@/components/dashboard/KPICard';
import { Users, UserPlus, Wallet, TrendingUp, FileCheck, AlertCircle, CheckCircle2, Target, ShieldCheck } from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';

const COUNTRY_COLORS = ['#49BFFF', '#0891b2', '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];

export default function Dashboard() {
  const { t } = useTranslation();
  const { user, hasRole, hasAnyRole } = useAuth();
  const isAgent = hasRole('agent');
  const canSeeFinance = hasAnyRole(['super_admin', 'admin', 'comptable']);
  const isManager = hasRole('manager');
  const isSupport = hasRole('support');
  const [stats, setStats] = useState({
    leads: 0, clients: 0, monthlyRevenue: 0, pendingPayments: 0,
    activeFiles: 0, approvedFiles: 0, conversionRate: 0, myConvertedClients: 0,
    activePortals: 0,
  });
  const [revenueData, setRevenueData] = useState<{ month: string; revenue: number }[]>([]);
  const [countryData, setCountryData] = useState<{ name: string; value: number }[]>([]);
  const [pipelineData, setPipelineData] = useState<{ status: string; count: number }[]>([]);
  const [recent, setRecent] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      const leadsQ = supabase.from('leads').select('id, status, created_at, converted_by_user_id');
      const clientsQ = supabase.from('clients').select('id, full_name, destination_country, created_at, status, agent_id, auth_user_id');
      const paymentsQ = supabase.from('payments').select('amount, status, payment_date, created_at');
      const stepsQ = supabase.from('client_steps').select('id, status, client_id');

      const [leadsRes, clientsRes, paymentsRes, stepsRes] = await Promise.all([
        isAgent && user?.id ? leadsQ.eq('assigned_to', user.id) : leadsQ,
        isAgent && user?.id ? clientsQ.eq('agent_id', user.id) : clientsQ,
        paymentsQ,
        stepsQ,
      ]);

      const leads = leadsRes.data ?? [];
      const clients = clientsRes.data ?? [];
      const payments = paymentsRes.data ?? [];
      const stepsRaw = stepsRes.data ?? [];
      const allowedClientIds = new Set<string>(clients.map((c: any) => c.id));
      const steps = isAgent ? stepsRaw.filter((s: any) => allowedClientIds.has(s.client_id)) : stepsRaw;

      const now = new Date();
      const thisMonth = payments
        .filter(p => p.status === 'paid' && p.payment_date && new Date(p.payment_date).getMonth() === now.getMonth())
        .reduce((s, p) => s + Number(p.amount), 0);
      const pending = payments.filter(p => p.status === 'pending' || p.status === 'overdue')
        .reduce((s, p) => s + Number(p.amount), 0);
      const converted = leads.filter(l => l.status === 'converted').length;
      const conversionRate = leads.length ? (converted / leads.length) * 100 : 0;
      const myConvertedClients = user?.id ? leads.filter(l => l.status === 'converted' && l.converted_by_user_id === user.id).length : 0;

      setStats({
        leads: leads.length,
        clients: clients.length,
        monthlyRevenue: canSeeFinance ? thisMonth : 0,
        pendingPayments: canSeeFinance ? pending : 0,
        activeFiles: steps.filter(s => s.status === 'in_progress').length,
        approvedFiles: steps.filter(s => s.status === 'completed' || s.status === 'validated').length,
        conversionRate,
        myConvertedClients,
        activePortals: clients.filter((c: any) => c.auth_user_id).length,
      });

      // Revenue evolution (last 6 months)
      const months = Array.from({ length: 6 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
        return { date: d, label: d.toLocaleDateString('fr', { month: 'short' }) };
      });
      const revenue = months.map(m => ({
        month: m.label,
        revenue: canSeeFinance ? payments
          .filter(p => p.status === 'paid' && p.payment_date && new Date(p.payment_date).getMonth() === m.date.getMonth() && new Date(p.payment_date).getFullYear() === m.date.getFullYear())
          .reduce((s, p) => s + Number(p.amount), 0) : 0,
      }));
      setRevenueData(revenue);

      // Countries
      const countries: Record<string, number> = {};
      clients.forEach(c => {
        if (c.destination_country) countries[c.destination_country] = (countries[c.destination_country] || 0) + 1;
      });
      setCountryData(Object.entries(countries).sort(([,a], [,b]) => b - a).slice(0, 6).map(([name, value]) => ({ name, value })));

      // Pipeline
      const pipeline: Record<string, number> = { new: 0, contacted: 0, meeting_scheduled: 0, converted: 0, lost: 0 };
      leads.forEach(l => { pipeline[l.status] = (pipeline[l.status] || 0) + 1; });
      setPipelineData(Object.entries(pipeline).map(([status, count]) => ({ status: t(`leads.status.${status}`), count })));

      // Recent
      setRecent(clients.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5));
    };

    load();
  }, [t, isAgent, canSeeFinance, user?.id]);

  const formatCurrency = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(n);

  const greeting = user?.email?.split('@')[0] ?? '';

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="font-display font-bold text-2xl lg:text-3xl text-foreground tracking-tight">
          {t('dashboard.welcome')} <span className="vayase-gradient-text capitalize">{greeting}</span>
        </h1>
        <p className="text-muted-foreground text-sm mt-1">{new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </motion.div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label={t('dashboard.totalProspects')} value={stats.leads} icon={UserPlus} />
        <KPICard label={t('dashboard.totalClients')} value={stats.clients} icon={Users} accent="success" />
        {canSeeFinance ? (
          <>
            <KPICard label={t('dashboard.monthlyRevenue')} value={formatCurrency(stats.monthlyRevenue)} icon={Wallet} accent="success" />
            <KPICard label={t('dashboard.pendingPayments')} value={formatCurrency(stats.pendingPayments)} icon={AlertCircle} accent="warning" />
          </>
        ) : (
          <>
            <KPICard label={t('dashboard.activeFiles')} value={stats.activeFiles} icon={FileCheck} accent="default" />
            <KPICard label={t('dashboard.approvedFiles')} value={stats.approvedFiles} icon={CheckCircle2} accent="success" />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label={isSupport ? 'Dossiers suivis' : t('dashboard.activeFiles')} value={stats.activeFiles} icon={FileCheck} accent="default" />
        <KPICard label={t('dashboard.conversionRate')} value={stats.conversionRate.toFixed(1)} suffix="%" icon={Target} accent="success" />
        <KPICard label={t('dashboard.approvedFiles')} value={stats.approvedFiles} icon={CheckCircle2} accent="success" />
        <KPICard label="Portails Clients actifs" value={stats.activePortals} icon={ShieldCheck} accent="default" />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SectionCard title={canSeeFinance ? t('dashboard.revenueEvolution') : t('dashboard.salesPipeline')} className="lg:col-span-2">
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              {canSeeFinance ? (
                <AreaChart data={revenueData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--vayase-accent))" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="hsl(var(--vayase-accent))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false}
                    tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 12, fontSize: 12, boxShadow: 'var(--shadow-lg)' }}
                    formatter={(v: number) => [formatCurrency(v), t('dashboard.monthlyRevenue')]}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="hsl(var(--vayase-accent))" strokeWidth={2.5} fill="url(#revGrad)" />
                </AreaChart>
              ) : (
                <BarChart data={pipelineData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="status" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 12, fontSize: 12 }} />
                  <Bar dataKey="count" fill="hsl(var(--vayase-accent))" radius={[8, 8, 0, 0]} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title={t('dashboard.clientsByCountry')}>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={countryData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={3}>
                  {countryData.map((_, i) => <Cell key={i} fill={COUNTRY_COLORS[i % COUNTRY_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 12, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SectionCard title={t('dashboard.salesPipeline')} className="lg:col-span-2">
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pipelineData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="status" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 12, fontSize: 12 }} />
                <Bar dataKey="count" fill="hsl(var(--vayase-accent))" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title={t('dashboard.recentActivity')}>
          <div className="space-y-3">
            {recent.length === 0 && <p className="text-sm text-muted-foreground">{t('common.noData')}</p>}
            {recent.map(c => (
              <div key={c.id} className="flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-secondary/60 transition-colors">
                <div className="w-9 h-9 rounded-full bg-gradient-accent flex items-center justify-center text-vayase-night font-semibold text-sm shrink-0">
                  {c.full_name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">{c.full_name}</div>
                  <div className="text-xs text-muted-foreground truncate">{c.destination_country}</div>
                </div>
                <Badge variant="outline" className="text-[10px] uppercase tracking-wider shrink-0">
                  {t(`clients.status.${c.status}`)}
                </Badge>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
