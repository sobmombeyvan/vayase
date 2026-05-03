import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Mail, Phone, MapPin, Calendar, Briefcase, Globe, User, FileText, Wallet, CheckCircle2, Circle, Clock, AlertCircle, Loader2, Pencil, Plus, Trash2, ArrowUp, ArrowDown, Key, Shield, Eye, EyeOff, UploadCloud, Download, Printer } from 'lucide-react';
import { supabaseAdminClient } from '@/lib/supabase-admin';
import { Switch } from '@/components/ui/switch';
import { cn, formatCurrency } from '@/lib/utils';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { generatePaymentReceipt } from '@/lib/exports';
import { DESTINATION_COUNTRIES } from '@/lib/destinations';

const statusStyles: Record<string, string> = {
  vip: 'bg-gradient-accent text-vayase-night border-0',
  standard: 'bg-secondary text-secondary-foreground',
  late_payment: 'bg-destructive/10 text-destructive border-destructive/20',
  priority: 'bg-warning/15 text-warning border-warning/30',
};

const stepIcons: Record<string, any> = {
  completed: CheckCircle2, in_progress: Loader2, validated: CheckCircle2,
  blocked: AlertCircle, todo: Circle,
};

const stepColors: Record<string, string> = {
  completed: 'text-success bg-success/10',
  in_progress: 'text-vayase-accent bg-vayase-accent/10',
  validated: 'text-success bg-success/10',
  blocked: 'text-destructive bg-destructive/10',
  todo: 'text-muted-foreground bg-secondary',
};

const STEP_STATUSES = ['todo', 'in_progress', 'completed', 'blocked'] as const;
const CLIENT_STATUSES = ['standard', 'vip', 'priority', 'late_payment'] as const;

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { hasAnyRole } = useAuth();
  const canEdit = hasAnyRole(['super_admin', 'admin', 'agent', 'manager']);
  const canFinance = hasAnyRole(['super_admin', 'admin', 'comptable']);
  const isAdmin = hasAnyRole(['super_admin', 'admin']);
  const canManageProcedure = isAdmin;
  const canManageSteps = isAdmin;

  const [client, setClient] = useState<any>(null);
  const [steps, setSteps] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [stepNotes, setStepNotes] = useState<Record<string, any[]>>({});
  const [stepNoteInputs, setStepNoteInputs] = useState<Record<string, string>>({});
  const [sourceLead, setSourceLead] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [saving, setSaving] = useState(false);

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState<any>({ amount: '', due_date: '', status: 'pending', payment_method: '', reference: '' });
  const [deleting, setDeleting] = useState(false);
  const [contractOpen, setContractOpen] = useState(false);
  const [contractForm, setContractForm] = useState<any>({ total_amount: '', currency: 'XOF', status: 'active', signed_date: '', notes: '' });
  const [newStepForm, setNewStepForm] = useState<any>({ step_name: '', due_date: '', notes: '' });

  const [clientAccessOpen, setClientAccessOpen] = useState(false);
  const [clientPassword, setClientPassword] = useState('');
  const [creatingAccess, setCreatingAccess] = useState(false);
  const [templateConfirmOpen, setTemplateConfirmOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  const [requestDocOpen, setRequestDocOpen] = useState(false);
  const [requestDocForm, setRequestDocForm] = useState({ name: '' });

  const load = () => {
    if (!id) return;
    Promise.all([
      supabase.from('clients').select('*').eq('id', id).single(),
      supabase.from('client_steps').select('*').eq('client_id', id).order('step_order'),
      supabase.from('contracts').select('*').eq('client_id', id),
      supabase.from('payments').select('*').eq('client_id', id).order('due_date'),
      supabase.from('profiles').select('id, full_name, user_roles(role)').order('full_name'),
      supabase.from('client_step_notes').select('*').eq('client_id', id).order('created_at', { ascending: false }),
      supabase.from('procedure_templates').select('id, name, destination_country, visa_type, is_active').eq('is_active', true).order('name'),
      supabase.from('leads').select('id, full_name, converted_by_user_id, referred_by_user_id').eq('converted_client_id', id).maybeSingle(),
      supabase.from('documents').select('*').eq('client_id', id).order('created_at', { ascending: false }),
    ]).then(([cRes, sRes, ctRes, pRes, uRes, nRes, tplRes, leadRes, docRes]) => {
      setClient(cRes.data);
      setSteps(sRes.data ?? []);
      setContracts(ctRes.data ?? []);
      setPayments(pRes.data ?? []);
      
      const staffOnly = (uRes.data ?? []).filter((u: any) => 
        u.user_roles && u.user_roles.some((r: any) => r.role !== 'client')
      );
      setUsers(staffOnly);
      setTemplates(tplRes.data ?? []);
      setSourceLead(leadRes.data ?? null);
      setDocuments(docRes.data ?? []);
      const groupedNotes = (nRes.data ?? []).reduce((acc: Record<string, any[]>, note: any) => {
        if (!acc[note.step_id]) acc[note.step_id] = [];
        acc[note.step_id].push(note);
        return acc;
      }, {});
      setStepNotes(groupedNotes);
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, [id]);

  if (loading) {
    return <div className="flex items-center justify-center h-96"><Loader2 className="w-8 h-8 animate-spin text-vayase-accent" /></div>;
  }
  if (!client) return <div>Client introuvable</div>;

  const totalContract = contracts.reduce((s, c) => s + Number(c.total_amount), 0);
  const totalPaid = payments.filter(p => p.status === 'paid').reduce((s, p) => s + Number(p.amount), 0);
  const totalPending = payments.filter(p => p.status === 'pending' || p.status === 'overdue').reduce((s, p) => s + Number(p.amount), 0);
  const amountLeftToPay = Math.max(0, totalContract - totalPaid);
  const paymentProgress = totalContract > 0 ? Math.min(100, (totalPaid / totalContract) * 100) : 0;
  const completedSteps = steps.filter(s => s.status === 'completed').length;

  const openEdit = () => {
    setEditForm({
      full_name: client.full_name ?? '',
      email: client.email ?? '',
      phone: client.phone ?? '',
      date_of_birth: client.date_of_birth ?? '',
      nationality: client.nationality ?? '',
      profession: client.profession ?? '',
      address: client.address ?? '',
      destination_country: client.destination_country ?? '',
      visa_type: client.visa_type ?? '',
      program: client.program ?? '',
      total_fees_due: client.total_fees_due ?? '',
      urgency: client.urgency ?? 'normal',
      status: client.status ?? 'standard',
      agent_id: client.agent_id ?? null,
      procedure_template_id: client.procedure_template_id ?? 'none',
      referred_by_user_id: client.referred_by_user_id ?? 'none',
      notes: client.notes ?? '',
    });
    setEditOpen(true);
  };

  const userNameById = (uid?: string | null) => users.find(u => u.id === uid)?.full_name || 'Utilisateur';
  const procedureNameById = (pid?: string | null) => templates.find(t => t.id === pid)?.name || '—';

  const handleSave = async () => {
    if (!canEdit) return toast.error("Vous n'avez pas les permissions");
    const previousTemplateId = client.procedure_template_id ?? null;
    const nextTemplateId = editForm.procedure_template_id === 'none' ? null : editForm.procedure_template_id;
    const templateChanged = previousTemplateId !== nextTemplateId;

    if (templateChanged && !canManageProcedure) {
      return toast.error('Seul un admin peut changer la procédure');
    }

    if (templateChanged && nextTemplateId && steps.length > 0) {
      const ok = window.confirm('Changer la procédure va remplacer les étapes actuelles du client. Continuer ?');
      if (!ok) return;
    }

    setSaving(true);
    const payload = {
      ...editForm,
      procedure_template_id: nextTemplateId,
      agent_id: editForm.agent_id === 'none' ? null : editForm.agent_id,
      referred_by_user_id: editForm.referred_by_user_id === 'none' ? null : editForm.referred_by_user_id,
      date_of_birth: editForm.date_of_birth || null,
      total_fees_due: editForm.total_fees_due === '' || editForm.total_fees_due == null ? null : Number(editForm.total_fees_due),
    };
    const { error } = await supabase.from('clients').update(payload).eq('id', id);

    if (error) {
      setSaving(false);
      return toast.error(error.message);
    }

    if (templateChanged && nextTemplateId) {
      const { data: tplSteps, error: tplErr } = await supabase
        .from('procedure_template_steps')
        .select('*')
        .eq('template_id', nextTemplateId)
        .order('step_order');
      if (tplErr) {
        setSaving(false);
        return toast.error("Erreur chargement modèle: " + tplErr.message);
      }

      // Delete existing steps explicitly by their IDs using the authenticated client
      const existingStepIds = steps.map(s => s.id);
      if (existingStepIds.length > 0) {
        const { error: delErr } = await supabase.from('client_steps').delete().in('id', existingStepIds);
        if (delErr) {
          console.error("Delete error:", delErr);
          toast.error("Impossible de supprimer les anciennes étapes. " + delErr.message);
        }
      }

      const today = new Date();
      const rows = (tplSteps ?? []).map((s: any) => {
        const due = s.default_due_days != null ? new Date(today.getTime() + (Number(s.default_due_days) * 86400000)) : null;
        return {
          client_id: id,
          step_name: s.step_name,
          step_order: s.step_order ?? 0,
          status: 'todo' as const,
          due_date: due ? due.toISOString().split('T')[0] : null,
          notes: s.notes ?? null,
        };
      });
      if (rows.length > 0) {
        const { error: insErr } = await supabase.from('client_steps').insert(rows);
        if (insErr) {
          setSaving(false);
          return toast.error("Erreur insertion: " + insErr.message);
        }
      }
    }

    setSaving(false);
    toast.success('Client mis à jour');
    setEditOpen(false);
    load();
  };

  const handleDeleteClient = async () => {
    if (!isAdmin) return toast.error("Vous n'avez pas les permissions");
    const confirmed = window.confirm(`Supprimer définitivement le client "${client.full_name}" ?`);
    if (!confirmed) return;
    setDeleting(true);
    const { error } = await supabase.from('clients').delete().eq('id', client.id);
    setDeleting(false);
    if (error) return toast.error(error.message);
    toast.success('Client supprimé');
    navigate('/clients');
  };

  const addStepNote = async (step: any, clearAfter = false) => {
    if (!canManageSteps) return false;
    const content = (stepNoteInputs[step.id] || '').trim();
    if (!content) return false;
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData.user?.id;
    if (!userId) return false;
    const { error } = await supabase.from('client_step_notes').insert({
      client_id: client.id,
      step_id: step.id,
      user_id: userId,
      note: content,
    });
    if (error) {
      toast.error(error.message);
      return false;
    }
    if (clearAfter) setStepNoteInputs(s => ({ ...s, [step.id]: '' }));
    return true;
  };

  const updateStepStatus = async (step: any, newStatus: string) => {
    if (!canManageSteps) return toast.error("Seul un admin peut modifier les étapes");
    const noteBeforeValidation = (stepNoteInputs[step.id] || '').trim();
    if (newStatus === 'completed' && !noteBeforeValidation) {
      return toast.error('Ajoutez une note de suivi avant de valider cette étape');
    }
    if (newStatus === 'completed') {
      const noteSaved = await addStepNote(step, true);
      if (!noteSaved) return;
    }
    const update: any = { status: newStatus };
    if (newStatus === 'completed') update.completed_at = new Date().toISOString();
    const { error } = await supabase.from('client_steps').update(update).eq('id', step.id);
    if (error) return toast.error(error.message);
    toast.success('Étape mise à jour');
    load();
  };

  const addClientStep = async () => {
    if (!canManageSteps) return toast.error("Seul un admin peut modifier les étapes");
    const stepName = (newStepForm.step_name ?? '').trim();
    if (!stepName) return toast.error('Nom étape requis');
    const nextOrder = steps.length > 0 ? Math.max(...steps.map(s => Number(s.step_order) || 0)) + 1 : 1;
    const { error } = await supabase.from('client_steps').insert({
      client_id: client.id,
      step_name: stepName,
      step_order: nextOrder,
      status: 'todo',
      due_date: newStepForm.due_date || null,
      notes: newStepForm.notes?.trim() || null,
    });
    if (error) return toast.error(error.message);
    toast.success('Étape ajoutée');
    setNewStepForm({ step_name: '', due_date: '', notes: '' });
    load();
  };

  const normalizeClientStepOrders = async (orderedSteps: any[]) => {
    for (let i = 0; i < orderedSteps.length; i += 1) {
      const step = orderedSteps[i];
      const nextOrder = i + 1;
      if ((Number(step.step_order) || 0) !== nextOrder) {
        const { error } = await supabase.from('client_steps').update({ step_order: nextOrder }).eq('id', step.id);
        if (error) throw error;
      }
    }
  };

  const handleApplyTemplate = async (tplId: string) => {
    if (!tplId || !id) return;

    setLoading(true);
    const { data: tplSteps, error: sErr } = await supabase
      .from('procedure_template_steps')
      .select('*')
      .eq('template_id', tplId)
      .order('step_order');

    if (sErr) {
      toast.error("Erreur lors de la récupération du modèle");
      setLoading(false);
      return;
    }

    if (tplSteps && tplSteps.length > 0) {
      // 1. Delete all existing steps
      const existingStepIds = steps.map(s => s.id);
      if (existingStepIds.length > 0) {
        const { error: delErr } = await supabase.from('client_steps').delete().in('id', existingStepIds);
        if (delErr) {
          toast.error("Impossible d'effacer les anciennes étapes");
          console.error(delErr);
        }
      }

      // 2. Update client procedure_template_id
      await supabase.from('clients').update({ procedure_template_id: tplId }).eq('id', id);

      const today = new Date();
      
      const rows = tplSteps.map((s: any, idx: number) => {
        const due = s.default_due_days != null ? new Date(today.getTime() + (Number(s.default_due_days) * 86400000)) : null;
        return {
          client_id: id,
          step_name: s.step_name,
          step_order: idx + 1,
          status: 'todo' as any,
          due_date: due ? due.toISOString().split('T')[0] : null,
          notes: s.notes ?? null,
        };
      });

      const { error: iErr } = await supabase.from('client_steps').insert(rows);
      if (iErr) {
        toast.error(iErr.message);
      } else {
        toast.success(`Procédure appliquée : ${rows.length} étapes ajoutées`);
        load();
      }
    } else {
      toast.error("Ce modèle ne contient aucune étape");
    }
    setLoading(false);
    setTemplateConfirmOpen(false);
  };

  const moveClientStep = async (stepId: string, direction: 'up' | 'down') => {
    if (!canManageSteps) return toast.error("Seul un admin peut modifier les étapes");
    const sorted = [...steps].sort((a, b) => (a.step_order ?? 0) - (b.step_order ?? 0));
    const idx = sorted.findIndex(s => s.id === stepId);
    if (idx < 0) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    [sorted[idx], sorted[swapIdx]] = [sorted[swapIdx], sorted[idx]];
    try {
      await normalizeClientStepOrders(sorted);
      toast.success('Ordre des étapes mis à jour');
      load();
    } catch (err: any) {
      toast.error(err.message || 'Impossible de changer l’ordre');
    }
  };

  const deleteClientStep = async (stepId: string) => {
    if (!canManageSteps) return toast.error("Seul un admin peut modifier les étapes");
    const ok = window.confirm('Supprimer cette étape ?');
    if (!ok) return;
    const { error } = await supabase.from('client_steps').delete().eq('id', stepId);
    if (error) return toast.error(error.message);
    const remaining = steps
      .filter(s => s.id !== stepId)
      .sort((a, b) => (a.step_order ?? 0) - (b.step_order ?? 0));
    try {
      await normalizeClientStepOrders(remaining);
      toast.success('Étape supprimée');
      load();
    } catch (err: any) {
      toast.error(err.message || 'Étape supprimée, mais ordre non recalculé');
      load();
    }
  };

  const updatePaymentStatus = async (paymentId: string, status: string) => {
    if (!canFinance) return toast.error("Permissions insuffisantes");
    const update: any = { status };
    if (status === 'paid') update.payment_date = new Date().toISOString().split('T')[0];
    const { error } = await supabase.from('payments').update(update).eq('id', paymentId);
    if (error) return toast.error(error.message);
    toast.success('Paiement mis à jour');
    load();
  };

  const handlePrintReceipt = (payment: any) => {
    generatePaymentReceipt({
      reference: payment.reference || 'REF-N/A',
      clientName: client.full_name,
      amount: Number(payment.amount),
      currency: payment.currency || 'XOF',
      paymentDate: payment.payment_date || new Date().toISOString(),
      paymentMethod: payment.payment_method,
      contractNumber: contracts.find(c => c.id === payment.contract_id)?.contract_number,
    });
  };

  const handleAddPayment = async () => {
    if (!canFinance) return toast.error("Permissions insuffisantes");
    if (!paymentForm.amount) return toast.error("Montant requis");
    const contract = contracts[0];
    if (!contract) return toast.error("Aucun contrat actif pour ce client");
    const { error } = await supabase.from('payments').insert({
      client_id: id,
      contract_id: contract.id,
      amount: Number(paymentForm.amount),
      currency: 'XOF',
      status: paymentForm.status,
      due_date: paymentForm.due_date || null,
      payment_method: paymentForm.payment_method || null,
      reference: paymentForm.reference || `PAY-${Date.now()}`,
      payment_date: paymentForm.status === 'paid' ? new Date().toISOString().split('T')[0] : null,
    });
    if (error) return toast.error(error.message);
    toast.success('Paiement ajouté');
    setPaymentOpen(false);
    setPaymentForm({ amount: '', due_date: '', status: 'pending', payment_method: '', reference: '' });
    load();
  };

  const handleAddContract = async () => {
    if (!canFinance) return toast.error("Permissions insuffisantes");
    if (!contractForm.total_amount) return toast.error("Montant total requis");

    const payload = {
      client_id: id,
      contract_number: `CTR-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`,
      total_amount: Number(contractForm.total_amount),
      currency: contractForm.currency || 'XOF',
      status: contractForm.status || 'active',
      signed_date: contractForm.signed_date || null,
      notes: contractForm.notes?.trim() || null,
    };

    const { error } = await supabase.from('contracts').insert(payload);
    if (error) return toast.error(error.message);

    toast.success('Contrat créé');
    setContractOpen(false);
    setContractForm({ total_amount: '', currency: 'XOF', status: 'active', signed_date: '', notes: '' });
    load();
  };

  const handleRequestDocument = async () => {
    if (!requestDocForm.name.trim()) return toast.error("Nom du document requis");
    const { data: authData } = await supabase.auth.getUser();
    const { error } = await supabase.from('documents').insert({
      client_id: id,
      name: requestDocForm.name,
      category: 'other',
      file_path: 'pending',
      is_visible_to_client: true,
      uploaded_by: authData.user?.id
    });
    if (error) return toast.error(error.message);
    toast.success('Document demandé au client');
    setRequestDocOpen(false);
    setRequestDocForm({ name: '' });
    load();
  };

  const handleUploadDocument = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) return toast.error("Le fichier est trop volumineux (max 5MB)");

    setUploadingDoc(true);
    const { data: authData } = await supabase.auth.getUser();
    
    // 1. Upload file to storage
    const fileExt = file.name.split('.').pop();
    const cleanDocName = file.name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
    const fileName = `${id}/${cleanDocName}_${Date.now()}.${fileExt}`;
    
    const { error: uploadError } = await supabase.storage
      .from('client-documents')
      .upload(fileName, file);

    if (uploadError) {
      setUploadingDoc(false);
      return toast.error("Erreur lors de l'upload: " + uploadError.message);
    }

    // 2. Add record to documents table
    const { error: dbError } = await supabase.from('documents').insert({
      client_id: id,
      name: file.name,
      category: 'other',
      file_path: fileName,
      file_size: file.size,
      mime_type: file.type,
      is_visible_to_client: true,
      uploaded_by: authData.user?.id
    });

    setUploadingDoc(false);
    
    if (dbError) {
      return toast.error("Erreur lors de l'enregistrement: " + dbError.message);
    }
    
    toast.success('Document ajouté avec succès');
    load();
    // Reset the input
    e.target.value = '';
  };

  const handleDownloadDocument = async (doc: any) => {
    if (doc.file_path === 'pending') return;
    const { data, error } = await supabase.storage.from('client-documents').createSignedUrl(doc.file_path, 3600);
    if (error) return toast.error("Impossible d'accéder au fichier: " + error.message);
    window.open(data.signedUrl, '_blank');
  };

  const handleCreateClientAccess = async () => {
    if (!isAdmin) return toast.error("Seul un admin peut créer des accès client");
    if (!client.email) return toast.error("Le client n'a pas d'adresse email");
    if (clientPassword.length < 6) return toast.error("Le mot de passe doit contenir au moins 6 caractères");

    setCreatingAccess(true);
    
    // 1. Create auth user with supabase-admin client to avoid logging out
    const { data: authData, error: authError } = await supabaseAdminClient.auth.signUp({
      email: client.email,
      password: clientPassword,
      options: {
        data: {
          role: 'client',
          full_name: client.full_name
        }
      }
    });

    if (authError) {
      setCreatingAccess(false);
      return toast.error(authError.message);
    }

    if (authData.user) {
      // 2. Link the new auth user to this client record
      const { error: updateError } = await supabase
        .from('clients')
        .update({ auth_user_id: authData.user.id })
        .eq('id', client.id);

      // Force the role to be client and remove agent role (bypassing any backend trigger bugs)
      await supabase.from('user_roles').delete().eq('user_id', authData.user.id).eq('role', 'agent');
      await supabase.from('user_roles').insert({ user_id: authData.user.id, role: 'client' as any });

      if (updateError) {
        toast.error("Erreur lors de la liaison du compte: " + updateError.message);
      } else {
        toast.success("Accès portail client créé avec succès!");
        setClientAccessOpen(false);
        setClientPassword('');
        setCreatingAccess(false);
        load();
      }
    } else {
      setCreatingAccess(false);
    }
  };

  const toggleStepVisibility = async (stepId: string, currentVal: boolean) => {
    const { error } = await supabase.from('client_steps').update({ is_visible_to_client: !currentVal }).eq('id', stepId);
    if (!error) {
      setSteps(steps.map(s => s.id === stepId ? { ...s, is_visible_to_client: !currentVal } : s));
      toast.success(t('common.success'));
    } else toast.error(error.message);
  };

  const toggleDocVisibility = async (docId: string, currentVal: boolean) => {
    const { error } = await supabase.from('documents').update({ is_visible_to_client: !currentVal }).eq('id', docId);
    if (!error) {
      setDocuments(documents.map(d => d.id === docId ? { ...d, is_visible_to_client: !currentVal } : d));
      toast.success(t('common.success'));
    } else toast.error(error.message);
  };

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate('/clients')} className="-ml-2">
          <ArrowLeft className="w-4 h-4 mr-1.5" />{t('common.back')}
        </Button>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {isAdmin && (
            <Button onClick={handleDeleteClient} variant="destructive" size="sm" disabled={deleting}>
              <Trash2 className="w-4 h-4 mr-1.5" />{deleting ? 'Suppression...' : 'Supprimer'}
            </Button>
          )}
          {canEdit && !client.auth_user_id && client.email && (
            <Button onClick={() => setClientAccessOpen(true)} variant="outline" size="sm" className="border-vayase-accent text-vayase-accent hover:bg-vayase-accent hover:text-vayase-night">
              <Key className="w-4 h-4 mr-1.5" />Créer Accès Client
            </Button>
          )}
          {client.auth_user_id && (
            <Badge variant="outline" className="bg-success/10 text-success border-success/20">
              <Key className="w-3 h-3 mr-1" />Accès Actif
            </Badge>
          )}
          {canEdit && (
            <Button onClick={openEdit} variant="outline" size="sm">
              <Pencil className="w-4 h-4 mr-1.5" />{t('common.edit')}
            </Button>
          )}
        </div>
      </div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="vayase-card p-6 lg:p-8 bg-gradient-hero text-white border-0 relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-vayase-accent/20 rounded-full blur-3xl pointer-events-none" />
        <div className="relative flex flex-col lg:flex-row lg:items-center gap-6">
          <Avatar className="w-20 h-20 border-2 border-white/20">
            <AvatarFallback className="bg-gradient-accent text-vayase-night font-bold text-2xl">
              {client.full_name.split(' ').map((n: string) => n[0]).slice(0, 2).join('')}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <h1 className="font-display font-bold text-3xl tracking-tight">{client.full_name}</h1>
              <Badge className={cn('text-[10px] uppercase tracking-wider font-semibold', statusStyles[client.status])}>
                {t(`clients.status.${client.status}`)}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-white/70">
              <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" />{client.email || '—'}</span>
              <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" />{client.phone || '—'}</span>
              <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />{client.destination_country || '—'}</span>
              <span className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" />Assigné: {userNameById(client.agent_id)}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 sm:gap-6 lg:border-l lg:border-white/15 lg:pl-6">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-white/50 font-semibold">Contrat</div>
              <div className="font-display font-bold text-xl">{formatCurrency(totalContract)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-white/50 font-semibold">Payé</div>
              <div className="font-display font-bold text-xl text-vayase-accent">{formatCurrency(totalPaid)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-white/50 font-semibold">Reste à payer</div>
              <div className="font-display font-bold text-xl text-warning">{formatCurrency(amountLeftToPay)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-white/50 font-semibold">Étapes</div>
              <div className="font-display font-bold text-xl">{completedSteps}/{steps.length || '—'}</div>
            </div>
          </div>
        </div>
      </motion.div>

      <Tabs defaultValue="info">
        <TabsList className="bg-card border border-border w-full justify-start overflow-x-auto">
          <TabsTrigger value="info"><User className="w-4 h-4 mr-1.5" />{t('clients.personalInfo')}</TabsTrigger>
          <TabsTrigger value="procedure"><FileText className="w-4 h-4 mr-1.5" />{t('clients.procedure')}</TabsTrigger>
          <TabsTrigger value="finance" className="flex items-center gap-1.5"><Wallet className="w-4 h-4 mr-1.5" />{t('nav.finance')}</TabsTrigger>
          <TabsTrigger value="portal" className="flex items-center gap-1.5 relative">
            <Shield className="w-4 h-4 mr-1.5" />
            Espace Client
            {!client?.auth_user_id && <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5 rounded-full bg-vayase-accent animate-pulse shadow-[0_0_8px_hsl(var(--vayase-accent))]" />}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="mt-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="vayase-card p-6">
              <h3 className="font-display font-semibold text-base mb-4">{t('clients.personalInfo')}</h3>
              <dl className="space-y-3">
                {[
                  { icon: User, label: t('clients.fullName'), value: client.full_name },
                  { icon: Mail, label: t('common.email'), value: client.email || '—' },
                  { icon: Phone, label: t('common.phone'), value: client.phone || '—' },
                  { icon: Calendar, label: 'Date de naissance', value: client.date_of_birth || '—' },
                  { icon: Globe, label: t('clients.nationality'), value: client.nationality || '—' },
                  { icon: Briefcase, label: t('clients.profession'), value: client.profession || '—' },
                  { icon: MapPin, label: 'Adresse', value: client.address || '—' },
                ].map((row, i) => (
                  <div key={i} className="flex items-start gap-3 py-1">
                    <row.icon className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <dt className="text-xs text-muted-foreground">{row.label}</dt>
                      <dd className="text-sm font-medium text-foreground">{row.value}</dd>
                    </div>
                  </div>
                ))}
              </dl>
            </div>

            <div className="vayase-card p-6">
              <h3 className="font-display font-semibold text-base mb-4">{t('clients.immigrationProject')}</h3>
              <dl className="space-y-3">
                {[
                  { label: t('clients.destination'), value: client.destination_country || '—', accent: true },
                  { label: t('clients.visa'), value: client.visa_type || '—' },
                  { label: t('clients.program'), value: client.program || '—' },
                  { label: 'Procédure', value: procedureNameById(client.procedure_template_id) },
                  { label: 'Frais à payer', value: client.total_fees_due ? formatCurrency(Number(client.total_fees_due)) : '—' },
                  { label: 'Urgence', value: client.urgency || '—' },
                  { label: 'Date inscription', value: new Date(client.created_at).toLocaleDateString('fr-FR') },
                  { label: 'Client référé par', value: client.referred_by_user_id ? userNameById(client.referred_by_user_id) : '—' },
                  { label: 'Converti depuis lead', value: sourceLead?.full_name || '—' },
                  { label: 'Converti par', value: sourceLead?.converted_by_user_id ? userNameById(sourceLead.converted_by_user_id) : '—' },
                  { label: 'Référé par', value: sourceLead?.referred_by_user_id ? userNameById(sourceLead.referred_by_user_id) : '—' },
                ].map((row, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <dt className="text-xs text-muted-foreground uppercase tracking-wider">{row.label}</dt>
                    <dd className={cn('text-sm font-semibold', row.accent && 'text-vayase-accent')}>{row.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
          {client.notes && (
            <div className="vayase-card p-6 mt-4">
              <h3 className="font-display font-semibold text-base mb-2">Notes</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{client.notes}</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="procedure" className="mt-5">
          <div className="vayase-card p-4 sm:p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-display font-semibold text-base">{t('procedures.timeline')}</h3>
              <div className="text-xs text-muted-foreground">
                {completedSteps} / {steps.length} étapes complétées
              </div>
            </div>

            {canManageSteps && (
              <div className="space-y-4 mb-8">
                {/* Section Appliquer un modèle - Plus visible */}
                <div className="bg-gradient-accent/5 border border-vayase-accent/20 rounded-xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-vayase-accent/10 flex items-center justify-center text-vayase-accent">
                      <Shield className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-display font-bold text-sm text-gray-900">Appliquer une procédure standard</div>
                      <p className="text-xs text-gray-500 mt-0.5">Ajoutez automatiquement les étapes prédéfinies à la timeline</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 min-w-[240px]">
                    <Select onValueChange={(val) => { setSelectedTemplateId(val); setTemplateConfirmOpen(true); }}>
                      <SelectTrigger className="w-full h-10 bg-white border-gray-200 shadow-sm focus:ring-vayase-accent">
                        <SelectValue placeholder="Choisir un modèle..." />
                      </SelectTrigger>
                      <SelectContent>
                        {templates.map(tpl => (
                          <SelectItem key={tpl.id} value={tpl.id}>{tpl.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Section Ajouter étape manuelle */}
                <div className="rounded-lg border border-border p-4 space-y-3 bg-secondary/20">
                  <div className="font-semibold text-sm">Ajouter une étape manuelle</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label>Nom étape *</Label>
                    <Input
                      value={newStepForm.step_name}
                      onChange={e => setNewStepForm({ ...newStepForm, step_name: e.target.value })}
                      placeholder="Ex: Dépôt dossier ambassade"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Date d'échéance</Label>
                    <Input
                      type="date"
                      value={newStepForm.due_date}
                      onChange={e => setNewStepForm({ ...newStepForm, due_date: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Notes</Label>
                  <Textarea
                    rows={2}
                    value={newStepForm.notes}
                    onChange={e => setNewStepForm({ ...newStepForm, notes: e.target.value })}
                    placeholder="Détails optionnels"
                  />
                </div>
                <Button size="sm" variant="outline" onClick={addClientStep}>
                  <Plus className="w-4 h-4 mr-1.5" />Ajouter l'étape
                </Button>
                </div>
              </div>
            )}

            {steps.length === 0 && (
              <div className="text-center py-12 text-muted-foreground text-sm">Aucune étape configurée</div>
            )}

            <div className="relative space-y-1">
              {steps.map((step, i) => {
                const Icon = stepIcons[step.status];
                const isLast = i === steps.length - 1;
                return (
                  <motion.div key={step.id}
                    initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                    className="flex gap-4 relative"
                  >
                    {!isLast && <div className="absolute left-[19px] top-10 bottom-0 w-px bg-border" />}
                    <div className={cn('w-10 h-10 rounded-full flex items-center justify-center shrink-0 z-10', stepColors[step.status])}>
                      <Icon className={cn('w-5 h-5', step.status === 'in_progress' && 'animate-spin')} />
                    </div>
                    <div className="flex-1 pb-6">
                      <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                        <div>
                          <div className="font-semibold text-sm text-foreground">{step.step_name}</div>
                          {step.due_date && (
                            <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(step.due_date).toLocaleDateString('fr-FR')}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          {canManageSteps && (
                            <>
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => moveClientStep(step.id, 'up')}>
                                <ArrowUp className="w-3.5 h-3.5" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => moveClientStep(step.id, 'down')}>
                                <ArrowDown className="w-3.5 h-3.5" />
                              </Button>
                            </>
                          )}
                          <Badge variant="outline" className={cn('text-[10px] uppercase tracking-wider', stepColors[step.status])}>
                            {t(`procedures.status.${step.status}`)}
                          </Badge>
                        </div>
                      </div>
                      {step.notes && <p className="text-xs text-muted-foreground mb-2">{step.notes}</p>}
                      <div className="space-y-2 mb-3">
                        {(stepNotes[step.id] ?? []).slice(0, 4).map((note) => (
                          <div key={note.id} className="text-xs bg-secondary/50 rounded-md px-2.5 py-2">
                            <div className="font-medium text-foreground">{userNameById(note.user_id)}</div>
                            <div className="text-muted-foreground whitespace-pre-wrap">{note.note}</div>
                          </div>
                        ))}
                      </div>
                      {canManageSteps && (
                        <div className="flex gap-2 mb-3">
                          <Input
                            value={stepNoteInputs[step.id] ?? ''}
                            onChange={e => setStepNoteInputs(s => ({ ...s, [step.id]: e.target.value }))}
                            placeholder="Ajouter une note de suivi..."
                          />
                          <Button size="sm" variant="outline" onClick={async () => {
                            const saved = await addStepNote(step, true);
                            if (!saved) return toast.error('Saisissez une note');
                            toast.success('Note ajoutée');
                            load();
                          }}>
                            Ajouter
                          </Button>
                        </div>
                      )}
                      {canManageSteps && (
                        <div className="flex flex-wrap gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => deleteClientStep(step.id)}
                            className="h-7 text-[10px] uppercase tracking-wider text-destructive border-destructive/30"
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-1" />Supprimer
                          </Button>
                          {STEP_STATUSES.map(s => (
                            <Button key={s} size="sm" variant={step.status === s ? 'default' : 'outline'}
                              onClick={() => updateStepStatus(step, s)}
                              className={cn('h-7 text-[10px] uppercase tracking-wider',
                                step.status === s && 'bg-gradient-accent text-vayase-night')}
                            >
                              {t(`procedures.status.${s}`)}
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="finance" className="mt-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="vayase-card p-5">
              <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1">Total contrat</div>
              <div className="font-display font-bold text-2xl">{formatCurrency(totalContract)}</div>
            </div>
            <div className="vayase-card p-5">
              <div className="text-xs uppercase tracking-wider text-success font-semibold mb-1">Payé</div>
              <div className="font-display font-bold text-2xl text-success">{formatCurrency(totalPaid)}</div>
            </div>
            <div className="vayase-card p-5">
              <div className="text-xs uppercase tracking-wider text-warning font-semibold mb-1">Reste à payer</div>
              <div className="font-display font-bold text-2xl text-warning">{formatCurrency(amountLeftToPay)}</div>
            </div>
            <div className="vayase-card p-5">
              <div className="flex items-center justify-between mb-1">
                <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Progression paiement</div>
                <div className="text-xs font-semibold text-foreground">{paymentProgress.toFixed(0)}%</div>
              </div>
              <div className="h-2 bg-secondary rounded-full overflow-hidden mt-3">
                <div
                  className="h-full bg-gradient-accent rounded-full transition-all duration-700"
                  style={{ width: `${paymentProgress}%` }}
                />
              </div>
              <div className="text-[11px] text-muted-foreground mt-2">
                En attente (paiements): {formatCurrency(totalPending)}
              </div>
            </div>
          </div>

          <div className="vayase-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold text-base">{t('finance.payments')}</h3>
              <div className="flex gap-2">
                {canFinance && (
                  <Button size="sm" variant="outline" onClick={() => setContractOpen(true)}>
                    <Plus className="w-4 h-4 mr-1.5" />Contrat
                  </Button>
                )}
                {canFinance && (
                  <Button size="sm" onClick={() => setPaymentOpen(true)} className="bg-gradient-accent text-vayase-night font-semibold">
                    <Plus className="w-4 h-4 mr-1.5" />Paiement
                  </Button>
                )}
              </div>
            </div>
            {contracts.length === 0 && (
              <div className="mb-4 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
                Aucun contrat pour ce client. Crée un contrat pour pouvoir ajouter des paiements.
              </div>
            )}
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground py-2.5">{t('finance.reference')}</th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground py-2.5">{t('common.dueDate')}</th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground py-2.5 text-right">{t('common.amount')}</th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground py-2.5">{t('common.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map(p => (
                    <tr key={p.id} className="border-b border-border last:border-0">
                      <td className="py-3 font-mono text-xs">{p.reference}</td>
                      <td className="py-3 text-muted-foreground">{p.due_date ? new Date(p.due_date).toLocaleDateString('fr-FR') : '—'}</td>
                      <td className="py-3 text-right font-semibold">{formatCurrency(Number(p.amount), p.currency)}</td>
                      <td className="py-3 flex items-center gap-2">
                        {canFinance ? (
                          <Select value={p.status} onValueChange={(v) => updatePaymentStatus(p.id, v)}>
                            <SelectTrigger className="h-7 w-[130px] text-[10px] uppercase tracking-wider">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {['pending', 'paid', 'overdue', 'cancelled'].map(s => (
                                <SelectItem key={s} value={s}>{t(`finance.paymentStatus.${s}`)}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant="outline" className={cn('text-[10px] uppercase tracking-wider',
                            p.status === 'paid' && 'border-success/30 text-success bg-success/5',
                            p.status === 'pending' && 'border-warning/30 text-warning bg-warning/5',
                            p.status === 'overdue' && 'border-destructive/30 text-destructive bg-destructive/5',
                          )}>
                            {t(`finance.paymentStatus.${p.status}`)}
                          </Badge>
                        )}
                        {p.status === 'paid' && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-vayase-accent shrink-0" onClick={() => handlePrintReceipt(p)} title="Imprimer le reçu">
                            <Printer className="w-4 h-4" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {payments.length === 0 && (
                    <tr><td colSpan={4} className="text-center py-8 text-muted-foreground text-sm">Aucun paiement</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="portal" className="mt-5 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1 space-y-6">
              <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                <h3 className="font-display font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-vayase-accent" />
                  Accès Client
                </h3>
                {client.auth_user_id ? (
                  <div className="space-y-4">
                    <div className="bg-success/5 border border-success/20 rounded-lg p-4">
                      <div className="flex items-center gap-2 text-success font-medium mb-1">
                        <CheckCircle2 className="w-4 h-4" /> Accès Actif
                      </div>
                      <p className="text-sm text-gray-600">Le client peut se connecter à son espace avec l'adresse : <strong>{client.email}</strong></p>
                    </div>
                    
                    <Button 
                      variant="outline" 
                      onClick={() => setClientAccessOpen(true)} 
                      className="w-full border-gray-200 text-gray-600 hover:bg-gray-50"
                    >
                      <Key className="w-4 h-4 mr-2" /> Modifier le mot de passe
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-gray-600">Le client n'a pas encore d'accès à son portail. Vous pouvez lui en créer un pour qu'il puisse suivre l'avancement de son dossier.</p>
                    {client.email ? (
                      <Button onClick={() => setClientAccessOpen(true)} className="w-full bg-vayase-accent hover:bg-vayase-accent/90 text-vayase-night">
                        <Key className="w-4 h-4 mr-2" /> Générer les accès
                      </Button>
                    ) : (
                      <div className="text-sm text-warning bg-warning/10 p-3 rounded-lg border border-warning/20">
                        Le client doit avoir une adresse email renseignée pour avoir un accès.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="md:col-span-2 space-y-6">
              <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                <h3 className="font-display font-semibold text-gray-900 mb-4 flex items-center justify-between">
                  <span>Étapes de la Procédure</span>
                  <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded-full">{steps.length} étapes</span>
                </h3>
                <div className="space-y-3">
                  {steps.map((step) => (
                    <div key={step.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 bg-gray-50/50">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${step.status === 'completed' ? 'bg-success' : step.status === 'in_progress' ? 'bg-warning' : 'bg-gray-300'}`} />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{step.step_name}</p>
                          <p className="text-xs text-gray-500 capitalize">{t(`procedures.status.${step.status}`)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          {step.is_visible_to_client ? <><Eye className="w-3 h-3 text-vayase-accent" /> Visible</> : <><EyeOff className="w-3 h-3" /> Masqué</>}
                        </span>
                        <Switch 
                          checked={step.is_visible_to_client ?? true} 
                          onCheckedChange={() => toggleStepVisibility(step.id, step.is_visible_to_client ?? true)} 
                        />
                      </div>
                    </div>
                  ))}
                  {steps.length === 0 && <p className="text-sm text-gray-500 text-center py-4">Aucune étape pour le moment</p>}
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display font-semibold text-gray-900 flex items-center gap-2">
                    <span>Documents du Client</span>
                    <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded-full">{documents.length} documents</span>
                  </h3>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setRequestDocOpen(true)} className="text-gray-600">
                      <Plus className="w-4 h-4 mr-1.5" />Demander
                    </Button>
                    <div className="relative">
                      <input 
                        type="file" 
                        id="admin-doc-upload" 
                        className="hidden" 
                        onChange={handleUploadDocument}
                        disabled={uploadingDoc}
                      />
                      <Label htmlFor="admin-doc-upload" className={cn(
                        "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
                        "bg-vayase-accent text-vayase-night hover:bg-vayase-accent/90 h-9 px-3 cursor-pointer"
                      )}>
                        {uploadingDoc ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <UploadCloud className="w-4 h-4 mr-1.5" />}
                        Uploader
                      </Label>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  {documents.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 bg-gray-50/50">
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-gray-400" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{doc.name}</p>
                          <div className="flex items-center gap-2">
                            <p className="text-xs text-gray-500 uppercase">{doc.category}</p>
                            {doc.file_path === 'pending' && <Badge variant="outline" className="text-[10px] bg-warning/10 text-warning border-warning/20">Attendu</Badge>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {doc.file_path !== 'pending' && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-vayase-accent" onClick={() => handleDownloadDocument(doc)}>
                            <Download className="w-4 h-4" />
                          </Button>
                        )}
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          {doc.is_visible_to_client ? <><Eye className="w-3 h-3 text-vayase-accent" /> Visible</> : <><EyeOff className="w-3 h-3" /> Masqué</>}
                        </span>
                        <Switch 
                          checked={doc.is_visible_to_client ?? true} 
                          onCheckedChange={() => toggleDocVisibility(doc.id, doc.is_visible_to_client ?? true)} 
                        />
                      </div>
                    </div>
                  ))}
                  {documents.length === 0 && <p className="text-sm text-gray-500 text-center py-4">Aucun document pour le moment</p>}
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit client dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Modifier le client</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            <div className="space-y-2"><Label>Nom complet *</Label>
              <Input value={editForm.full_name ?? ''} onChange={e => setEditForm({ ...editForm, full_name: e.target.value })} /></div>
            <div className="space-y-2"><Label>Email</Label>
              <Input type="email" value={editForm.email ?? ''} onChange={e => setEditForm({ ...editForm, email: e.target.value })} /></div>
            <div className="space-y-2"><Label>Téléphone</Label>
              <Input value={editForm.phone ?? ''} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} /></div>
            <div className="space-y-2"><Label>Date de naissance</Label>
              <Input type="date" value={editForm.date_of_birth ?? ''} onChange={e => setEditForm({ ...editForm, date_of_birth: e.target.value })} /></div>
            <div className="space-y-2"><Label>Nationalité</Label>
              <Input value={editForm.nationality ?? ''} onChange={e => setEditForm({ ...editForm, nationality: e.target.value })} /></div>
            <div className="space-y-2"><Label>Profession</Label>
              <Input value={editForm.profession ?? ''} onChange={e => setEditForm({ ...editForm, profession: e.target.value })} /></div>
            <div className="sm:col-span-2 space-y-2"><Label>Adresse</Label>
              <Input value={editForm.address ?? ''} onChange={e => setEditForm({ ...editForm, address: e.target.value })} /></div>
            <div className="space-y-2"><Label>Destination</Label>
              <Select value={editForm.destination_country || 'none'} onValueChange={v => setEditForm({ ...editForm, destination_country: v === 'none' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="Choisir une destination" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucune</SelectItem>
                  {DESTINATION_COUNTRIES.map((country) => (
                    <SelectItem key={country} value={country}>{country}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Type de visa</Label>
              <Input value={editForm.visa_type ?? ''} onChange={e => setEditForm({ ...editForm, visa_type: e.target.value })} /></div>
            <div className="space-y-2"><Label>Programme</Label>
              <Input value={editForm.program ?? ''} onChange={e => setEditForm({ ...editForm, program: e.target.value })} /></div>
            <div className="sm:col-span-2 space-y-2"><Label>Procédure (modèle)</Label>
              <Select
                value={editForm.procedure_template_id ?? 'none'}
                onValueChange={v => setEditForm({ ...editForm, procedure_template_id: v })}
                disabled={!canManageProcedure}
              >
                <SelectTrigger><SelectValue placeholder="Choisir une procédure" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucune</SelectItem>
                  {templates.map(tpl => (
                    <SelectItem key={tpl.id} value={tpl.id}>
                      {tpl.name}{tpl.destination_country ? ` — ${tpl.destination_country}` : ''}{tpl.visa_type ? ` (${tpl.visa_type})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Frais à payer</Label>
              <Input type="number" min="0" step="0.01" value={editForm.total_fees_due ?? ''}
                onChange={e => setEditForm({ ...editForm, total_fees_due: e.target.value })} /></div>
            <div className="space-y-2"><Label>Urgence</Label>
              <Select value={editForm.urgency ?? 'normal'} onValueChange={v => setEditForm({ ...editForm, urgency: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['low', 'normal', 'high', 'critical'].map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {isAdmin && (
              <div className="sm:col-span-2 space-y-2"><Label>Utilisateur assigné</Label>
                <Select value={editForm.agent_id ?? 'none'} onValueChange={v => setEditForm({ ...editForm, agent_id: v === 'none' ? null : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun</SelectItem>
                    {users.map(u => <SelectItem key={u.id} value={u.id}>{u.full_name || u.id}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {isAdmin && (
              <div className="sm:col-span-2 space-y-2"><Label>Référé par</Label>
                <Select value={editForm.referred_by_user_id ?? 'none'} onValueChange={v => setEditForm({ ...editForm, referred_by_user_id: v === 'none' ? null : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun</SelectItem>
                    {users.map(u => <SelectItem key={u.id} value={u.id}>{u.full_name || u.id}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="sm:col-span-2 space-y-2"><Label>Statut client</Label>
              <Select value={editForm.status ?? 'standard'} onValueChange={v => setEditForm({ ...editForm, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CLIENT_STATUSES.map(s => <SelectItem key={s} value={s}>{t(`clients.status.${s}`)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2 space-y-2"><Label>Notes</Label>
              <Textarea rows={3} value={editForm.notes ?? ''} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-gradient-accent text-vayase-night font-semibold">
              {saving ? '...' : t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add payment dialog */}
      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">Nouveau paiement</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2"><Label>Montant (FCFA) *</Label>
              <Input type="number" value={paymentForm.amount}
                onChange={e => setPaymentForm({ ...paymentForm, amount: e.target.value })} /></div>
            <div className="space-y-2"><Label>Échéance</Label>
              <Input type="date" value={paymentForm.due_date}
                onChange={e => setPaymentForm({ ...paymentForm, due_date: e.target.value })} /></div>
            <div className="space-y-2"><Label>Statut</Label>
              <Select value={paymentForm.status} onValueChange={v => setPaymentForm({ ...paymentForm, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['pending', 'paid', 'overdue', 'cancelled'].map(s => (
                    <SelectItem key={s} value={s}>{t(`finance.paymentStatus.${s}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Méthode</Label>
              <Input value={paymentForm.payment_method}
                onChange={e => setPaymentForm({ ...paymentForm, payment_method: e.target.value })}
                placeholder="Carte / Virement / Espèces" /></div>
            <div className="space-y-2"><Label>Référence</Label>
              <Input value={paymentForm.reference}
                onChange={e => setPaymentForm({ ...paymentForm, reference: e.target.value })}
                placeholder="Auto si vide" /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPaymentOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleAddPayment} className="bg-gradient-accent text-vayase-night font-semibold">
              {t('common.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add contract dialog */}
      <Dialog open={contractOpen} onOpenChange={setContractOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">Nouveau contrat</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Montant total (FCFA) *</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={contractForm.total_amount}
                onChange={e => setContractForm({ ...contractForm, total_amount: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Statut</Label>
              <Select value={contractForm.status} onValueChange={v => setContractForm({ ...contractForm, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['draft', 'active', 'completed', 'cancelled'].map(s => (
                    <SelectItem key={s} value={s}>{t(`finance.contractStatus.${s}`, { defaultValue: s })}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Date de signature</Label>
              <Input
                type="date"
                value={contractForm.signed_date}
                onChange={e => setContractForm({ ...contractForm, signed_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                rows={3}
                value={contractForm.notes}
                onChange={e => setContractForm({ ...contractForm, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setContractOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleAddContract} className="bg-gradient-accent text-vayase-night font-semibold">
              {t('common.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Client Access dialog */}
      <Dialog open={clientAccessOpen} onOpenChange={setClientAccessOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Shield className="w-5 h-5 text-vayase-accent" />
              {client?.auth_user_id ? "Réinitialiser l'accès" : "Créer un accès portail"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="bg-secondary/50 p-4 rounded-lg space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Utilisateur</p>
              <p className="text-sm font-medium">{client?.full_name}</p>
              <p className="text-xs text-muted-foreground">{client?.email}</p>
            </div>
            
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Définir un mot de passe *</Label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Minimum 6 caractères"
                  value={clientPassword}
                  onChange={e => setClientPassword(e.target.value)}
                  className="pl-10"
                />
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed italic">
                {client?.auth_user_id 
                  ? "Note: Pour modifier un compte existant, le client recevra un email de confirmation ou vous devrez utiliser le tableau de bord Supabase." 
                  : "Le compte sera créé immédiatement. Communiquez ce mot de passe au client."}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setClientAccessOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleCreateClientAccess} disabled={creatingAccess} className="bg-gradient-accent text-vayase-night font-semibold">
              {creatingAccess ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Générer l'accès
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Confirm Template dialog */}
      <Dialog open={templateConfirmOpen} onOpenChange={setTemplateConfirmOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-vayase-accent" />
              Confirmer l'application
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-gray-600 leading-relaxed">
              Souhaitez-vous appliquer ce modèle de procédure ? 
              Cela ajoutera automatiquement les étapes prédéfinies à la timeline du client.
            </p>
            {selectedTemplateId && (
              <div className="mt-4 p-3 bg-secondary/50 rounded-lg border border-border">
                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Modèle sélectionné</div>
                <div className="font-semibold text-sm">
                  {templates.find(t => t.id === selectedTemplateId)?.name}
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setTemplateConfirmOpen(false)}>Annuler</Button>
            <Button 
              onClick={() => {
                if (selectedTemplateId) handleApplyTemplate(selectedTemplateId);
                setTemplateConfirmOpen(false);
              }} 
              className="bg-gradient-accent text-vayase-night font-semibold shadow-glow"
            >
              Appliquer le modèle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Request Document dialog */}
      <Dialog open={requestDocOpen} onOpenChange={setRequestDocOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">Demander un document</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nom du document attendu *</Label>
              <Input 
                value={requestDocForm.name} 
                onChange={e => setRequestDocForm({ ...requestDocForm, name: e.target.value })} 
                placeholder="Ex: Passeport, Relevé bancaire, etc." 
                onKeyDown={e => e.key === 'Enter' && handleRequestDocument()}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Le client verra cette demande dans son portail avec la mention "Action Requise" et pourra y répondre en uploadant le fichier.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRequestDocOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleRequestDocument} className="bg-gradient-accent text-vayase-night font-semibold">
              Demander au client
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
