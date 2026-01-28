import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function centavosToReais(centavos: number): string {
  return (centavos / 100).toFixed(2);
}

export function reaisToCentavos(reais: number): number {
  return Math.round(reais * 100);
}

export const formatCurrency = (value: number | string) => {
    const num = Number(value);
    if (isNaN(num)) return "R$ 0,00";
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(num); // O Intl do JS já faz o formato correto (R$ 1.000,00)
};
