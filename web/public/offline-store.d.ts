export interface OfflinePack {
  key: string; owner: number; epoch: string; tripId: number; savedAt: string;
  timeline: unknown; documents: { id: number; name: string; blob: Blob }[]; bytes: number;
}
export const DB_NAME: string;
export const EPOCH_KEY: string;
export function session(): { owner: number; epoch: string };
export function readPacks(): Promise<OfflinePack[]>;
export function savePack(pack: OfflinePack): Promise<void>;
export function removePack(key: string): Promise<void>;
export function clearOffline(): Promise<void>;
