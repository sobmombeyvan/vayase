import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(n: number, currency: string = 'XOF') {
  if (isNaN(n)) return `0 ${currency}`;
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " " + currency;
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Administrateur',
  agent: 'Agent',
  marketing_agent: 'Marketing',
  comptable: 'Comptable',
  manager: 'Manager',
  support: 'Support',
};

export function staffDisplayName(u: { full_name?: string | null; id: string; user_roles?: { role: string }[] }) {
  const roles = (u.user_roles ?? [])
    .map(r => r.role)
    .filter(r => r !== 'client')
    .map(r => ROLE_LABELS[r] || r);
  const name = u.full_name || u.id;
  return roles.length ? `${name} — ${roles.join(', ')}` : name;
}

export function isMissingClientsReferralColumnError(message?: string | null) {
  return (message || '').toLowerCase().includes("could not find the 'referred_by_user_id' column of 'clients'");
}
