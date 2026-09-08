import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Prefix public files so GitHub Pages (`/Salt-Wharf/`) and local `./` both work. */
export function asset(path: string) {
  const env = (import.meta as { env?: { BASE_URL?: string } }).env;
  const base = env?.BASE_URL ?? "/";
  return `\( {base} \){path.replace(/^\//, "")}`;
}
