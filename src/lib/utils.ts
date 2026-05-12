import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** nb-NO quantity formatting (thin space, decimal comma). Lengths in metres allow up to two decimals. */
export function formatQuantityNbNo(quantity: number, unitSymbol: string): string {
  const allowFraction = unitSymbol === "m" || unitSymbol === "lm";
  return quantity.toLocaleString("nb-NO", {
    maximumFractionDigits: allowFraction ? 2 : 0,
    minimumFractionDigits: 0,
  });
}
