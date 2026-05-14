/**
 * Browser-local FIFO queue for receive intents (quick goods-in / PO receipts).
 * Used when offline or when the server action fails with a transport error.
 */

import { z } from "zod";
import { receiveIncomingSchema } from "@/lib/validations/inventory";
import { receiveItemsSchema } from "@/lib/validations/purchase-order";

export const RECEIVE_QUEUE_CHANGED_EVENT = "aqila-receive-queue-changed";

const MAX_ITEMS = 60;

const quickQueuedSchema = z.object({
  id: z.string().uuid(),
  kind: z.literal("quick"),
  createdAt: z.string(),
  payload: receiveIncomingSchema,
});

const poQueuedSchema = z.object({
  id: z.string().uuid(),
  kind: z.literal("po"),
  createdAt: z.string(),
  poLabel: z.string().optional(),
  payload: receiveItemsSchema,
});

const bucketSchema = z.object({
  v: z.literal(1),
  items: z.array(z.union([quickQueuedSchema, poQueuedSchema])),
});

export type QueuedQuickReceive = z.infer<typeof quickQueuedSchema>;
export type QueuedPoReceive = z.infer<typeof poQueuedSchema>;
export type QueuedReceiveItem = QueuedQuickReceive | QueuedPoReceive;

export function storageKeyReceiveQueue(userId: string): string {
  return `aqila.receiveQueue.v1:${userId}`;
}

function parseBucket(raw: string | null): QueuedReceiveItem[] {
  if (!raw) return [];
  try {
    const parsed = bucketSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data.items : [];
  } catch {
    return [];
  }
}

export function readReceiveQueue(userId: string): QueuedReceiveItem[] {
  if (typeof window === "undefined") return [];
  try {
    return parseBucket(window.localStorage.getItem(storageKeyReceiveQueue(userId)));
  } catch {
    return [];
  }
}

function writeReceiveQueue(userId: string, items: QueuedReceiveItem[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKeyReceiveQueue(userId), JSON.stringify({ v: 1, items }));
  window.dispatchEvent(
    new CustomEvent(RECEIVE_QUEUE_CHANGED_EVENT, { detail: { userId } as { userId: string } })
  );
}

/** @throws RangeError when queue is full */
export function enqueueQuickReceive(userId: string, payload: QueuedQuickReceive["payload"]): void {
  const items = readReceiveQueue(userId);
  if (items.length >= MAX_ITEMS) {
    throw new RangeError(
      `Receive queue is full (${MAX_ITEMS} items). Sync or remove older entries.`
    );
  }
  const row: QueuedQuickReceive = {
    id: crypto.randomUUID(),
    kind: "quick",
    createdAt: new Date().toISOString(),
    payload,
  };
  writeReceiveQueue(userId, [...items, row]);
}

/** @throws RangeError when queue is full */
export function enqueuePoReceive(
  userId: string,
  payload: QueuedPoReceive["payload"],
  poLabel?: string
): void {
  const items = readReceiveQueue(userId);
  if (items.length >= MAX_ITEMS) {
    throw new RangeError(
      `Receive queue is full (${MAX_ITEMS} items). Sync or remove older entries.`
    );
  }
  const row: QueuedPoReceive = {
    id: crypto.randomUUID(),
    kind: "po",
    createdAt: new Date().toISOString(),
    poLabel,
    payload,
  };
  writeReceiveQueue(userId, [...items, row]);
}

export function replaceReceiveQueue(userId: string, items: QueuedReceiveItem[]): void {
  writeReceiveQueue(userId, items);
}

export function subscribeReceiveQueue(userId: string, onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (): void => {
    onStoreChange();
  };
  const onStorage = (e: StorageEvent): void => {
    if (e.key === storageKeyReceiveQueue(userId)) handler();
  };
  window.addEventListener(RECEIVE_QUEUE_CHANGED_EVENT, handler);
  window.addEventListener("online", handler);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(RECEIVE_QUEUE_CHANGED_EVENT, handler);
    window.removeEventListener("online", handler);
    window.removeEventListener("storage", onStorage);
  };
}

export function snapshotReceiveQueueCount(userId: string): number {
  return readReceiveQueue(userId).length;
}
