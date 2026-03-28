import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Utilitário para combinar classes do Tailwind CSS de forma condicional.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Normaliza o texto para facilitar a busca de termos.
 * Remove acentos, converte para minúsculas e remove caracteres especiais.
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos (diacríticos)
    .replace(/[^a-z0-9\s]/g, ' '); // Substitui caracteres especiais por espaços
}
