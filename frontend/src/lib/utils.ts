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
