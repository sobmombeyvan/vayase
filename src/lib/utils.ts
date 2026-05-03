import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(n: number, currency: string = 'XOF') {
  if (isNaN(n)) return `0 ${currency}`;
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " " + currency;
}
