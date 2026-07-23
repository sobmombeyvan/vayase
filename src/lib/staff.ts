import { supabase } from '@/integrations/supabase/client';

export type StaffMember = {
  id: string;
  full_name: string | null;
  user_roles: { role: string }[];
};

/** Load employees (profiles excluding users with the client portal role). */
export async function loadStaffMembers(): Promise<{ data: StaffMember[]; error: string | null }> {
  const [profilesRes, rolesRes] = await Promise.all([
    supabase.from('profiles').select('id, full_name').order('full_name'),
    supabase.from('user_roles').select('user_id, role'),
  ]);

  if (profilesRes.error) return { data: [], error: profilesRes.error.message };
  if (rolesRes.error) return { data: [], error: rolesRes.error.message };

  const rolesByUser = (rolesRes.data ?? []).reduce<Record<string, { role: string }[]>>((acc, r) => {
    if (!acc[r.user_id]) acc[r.user_id] = [];
    acc[r.user_id].push({ role: r.role });
    return acc;
  }, {});

  const clientUserIds = new Set(
    (rolesRes.data ?? []).filter(r => r.role === 'client').map(r => r.user_id),
  );

  const staff = (profilesRes.data ?? [])
    .filter(p => !clientUserIds.has(p.id))
    .map(p => ({
      id: p.id,
      full_name: p.full_name,
      user_roles: rolesByUser[p.id] ?? [],
    }));

  return { data: staff, error: null };
}

export type ReferredClient = {
  id: string;
  full_name: string;
  destination_country: string | null;
  status: string;
  created_at: string;
};

export type EmployeeReferralSummary = StaffMember & {
  referredClients: ReferredClient[];
};

export function buildEmployeeReferralSummaries(
  staff: StaffMember[],
  clients: Array<{
    id: string;
    full_name: string;
    referred_by_user_id?: string | null;
    destination_country?: string | null;
    status?: string;
    created_at: string;
  }>,
): EmployeeReferralSummary[] {
  const byReferrer = clients.reduce<Record<string, ReferredClient[]>>((acc, client) => {
    if (!client.referred_by_user_id) return acc;
    if (!acc[client.referred_by_user_id]) acc[client.referred_by_user_id] = [];
    acc[client.referred_by_user_id].push({
      id: client.id,
      full_name: client.full_name,
      destination_country: client.destination_country ?? null,
      status: client.status ?? 'standard',
      created_at: client.created_at,
    });
    return acc;
  }, {});

  return staff
    .map(member => ({
      ...member,
      referredClients: (byReferrer[member.id] ?? []).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      ),
    }))
    .sort((a, b) => b.referredClients.length - a.referredClients.length);
}
