import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { KPICard } from '@/components/dashboard/KPICard';
import { Wallet, TrendingUp, Clock, AlertCircle, Receipt, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { generatePaymentReceipt } from '@/lib/exports';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

const statusBadge: Record<string, string> = {
  paid: 'border-success/30 text-success bg-success/5',
  pending: 'border-warning/30 text-warning bg-warning/5',
  overdue: 'border-destructive/30 text-destructive bg-destructive/5',
  cancelled: 'border-muted text-muted-foreground bg-muted/30',
};

export default function Finance() {
  const { t } = useTranslation();
  const { hasAnyRole } = useAuth();
  const canFinance = hasAnyRole(['super_admin', 'admin', 'comptable']);
  const canDeletePayment = hasAnyRole(['super_admin', 'admin']);
  const [payments, setPayments] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [clients, setClients] = useState<Record<string, string>>({});

  const loadFinanceData = () => {
    Promise.all([
      supabase.from('payments').select('*').order('created_at', { ascending: false }),
      supabase.from('contracts').select('*'),
      supabase.from('clients').select('id, full_name'),
    ]).then(([pRes, ctRes, cRes]) => {
      setPayments(pRes.data ?? []);
      setContracts(ctRes.data ?? []);
      const map: Record<string, string> = {};
      (cRes.data ?? []).forEach(c => { map[c.id] = c.full_name; });
      setClients(map);
    });
  };

  useEffect(() => {
    if (!canFinance) return;
    loadFinanceData();
  }, [canFinance]);

  const deletePayment = async (paymentId: string) => {
    if (!canDeletePayment) return toast.error("Seuls les admins peuvent supprimer un paiement");
    const ok = window.confirm('Supprimer ce paiement ?');
    if (!ok) return;
    const { error } = await supabase.from('payments').delete().eq('id', paymentId);
    if (error) return toast.error(error.message);
    toast.success('Paiement supprimé');
    loadFinanceData();
  };

  if (!canFinance) {
    return (
      <div className="vayase-card p-6 max-w-[900px] mx-auto">
        <h1 className="font-display font-bold text-xl">Accès restreint</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Cette page est réservée aux rôles Admin/Super Admin/Comptable.
        </p>
      </div>
    );
  }

  const formatCurrency = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(n);
  const totalRevenue = payments.filter(p => p.status === 'paid').reduce((s, p) => s + Number(p.amount), 0);
  const pending = payments.filter(p => p.status === 'pending').reduce((s, p) => s + Number(p.amount), 0);
  const overdue = payments.filter(p => p.status === 'overdue').reduce((s, p) => s + Number(p.amount), 0);
  const totalContracts = contracts.reduce((s, c) => s + Number(c.total_amount), 0);
  const amountLeftToPay = Math.max(0, totalContracts - totalRevenue);
  const paidByContractId = payments.reduce((acc: Record<string, number>, p: any) => {
    if (p.status !== 'paid' || !p.contract_id) return acc;
    acc[p.contract_id] = (acc[p.contract_id] || 0) + Number(p.amount || 0);
    return acc;
  }, {});
  const remainingByClientId = contracts.reduce((acc: Record<string, number>, contract: any) => {
    const contractTotal = Number(contract.total_amount || 0);
    const paid = Number(paidByContractId[contract.id] || 0);
    const remaining = Math.max(0, contractTotal - paid);
    acc[contract.client_id] = (acc[contract.client_id] || 0) + remaining;
    return acc;
  }, {});

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <div>
        <h1 className="font-display font-bold text-2xl lg:text-3xl text-foreground tracking-tight">{t('finance.title')}</h1>
        <p className="text-muted-foreground text-sm mt-1">Vue d'ensemble financière</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label={t('finance.totalRevenue')} value={formatCurrency(totalRevenue)} icon={Wallet} accent="success" trend={15.3} />
        <KPICard label="Volume contrats" value={formatCurrency(totalContracts)} icon={TrendingUp} accent="default" trend={9.1} />
        <KPICard label="Reste à payer" value={formatCurrency(amountLeftToPay)} icon={Clock} accent="warning" />
        <KPICard label={t('finance.overdueAmount')} value={formatCurrency(overdue)} icon={AlertCircle} accent="destructive" />
      </div>

      <div className="vayase-card overflow-hidden">
        <div className="p-5 border-b border-border">
          <h3 className="font-display font-semibold text-base">{t('finance.payments')}</h3>
        </div>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground py-3.5 px-5">{t('finance.reference')}</th>
                <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground py-3.5 px-5">Client</th>
                <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground py-3.5 px-5 hidden md:table-cell">{t('common.dueDate')}</th>
                <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground py-3.5 px-5 hidden lg:table-cell">{t('finance.paymentMethod')}</th>
                <th className="text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground py-3.5 px-5">{t('common.amount')}</th>
                <th className="text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground py-3.5 px-5 hidden xl:table-cell">Reste client</th>
                <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground py-3.5 px-5">{t('common.status')}</th>
                <th className="py-3.5 px-5"></th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 && (
                <tr><td colSpan={8} className="text-center py-12 text-muted-foreground text-sm">{t('common.noData')}</td></tr>
              )}
              {payments.map((p, i) => (
                <motion.tr key={p.id}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.015 }}
                  className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors group"
                >
                  <td className="py-3.5 px-5 font-mono text-xs">{p.reference}</td>
                  <td className="py-3.5 px-5 text-sm font-semibold">{clients[p.client_id] ?? '—'}</td>
                  <td className="py-3.5 px-5 text-sm text-muted-foreground hidden md:table-cell">
                    {p.due_date ? new Date(p.due_date).toLocaleDateString('fr-FR') : '—'}
                  </td>
                  <td className="py-3.5 px-5 text-sm text-muted-foreground hidden lg:table-cell capitalize">{p.payment_method ?? '—'}</td>
                  <td className="py-3.5 px-5 text-sm font-semibold text-right">{formatCurrency(Number(p.amount))}</td>
                  <td className="py-3.5 px-5 text-sm font-semibold text-right hidden xl:table-cell">
                    {formatCurrency(remainingByClientId[p.client_id] ?? 0)}
                  </td>
                  <td className="py-3.5 px-5">
                    <Badge variant="outline" className={cn('text-[10px] uppercase tracking-wider', statusBadge[p.status])}>
                      {t(`finance.paymentStatus.${p.status}`)}
                    </Badge>
                  </td>
                  <td className="py-3.5 px-5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {p.status === 'paid' && (
                        <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity h-7 gap-1 text-xs"
                          onClick={() => {
                            generatePaymentReceipt({
                              reference: p.reference || p.id.slice(0, 8),
                              clientName: clients[p.client_id] || 'Client',
                              amount: Number(p.amount),
                              currency: p.currency,
                              paymentDate: p.payment_date || p.created_at,
                              paymentMethod: p.payment_method,
                            });
                            toast.success('Reçu généré');
                          }}>
                          <Receipt className="w-3 h-3" />Reçu
                        </Button>
                      )}
                      {canDeletePayment && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="opacity-0 group-hover:opacity-100 transition-opacity h-7 gap-1 text-xs text-destructive hover:text-destructive"
                          onClick={() => deletePayment(p.id)}
                        >
                          <Trash2 className="w-3 h-3" />Supprimer
                        </Button>
                      )}
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
