export type Mode = "readOnly" | "writable";

export interface Measurement {
  tools: number;
  chars: number;
  largest: { name: string; chars: number }[];
}

export type Budget = Record<Mode, { maxTools: number; maxChars: number }>;
