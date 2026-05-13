"use client";

import { receiveIncomingGoods } from "@/lib/actions/inventory";
import { receiveItems } from "@/lib/actions/purchase-orders";
import type { ActionResult } from "@/types";
import {
  enqueuePoReceive,
  enqueueQuickReceive,
  readReceiveQueue,
  replaceReceiveQueue,
} from "@/lib/receive-offline-queue-storage";
import { receiveIncomingSchema, type ReceiveIncomingInput } from "@/lib/validations/inventory";
import { receiveItemsSchema, type ReceiveItemsInput } from "@/lib/validations/purchase-order";

export function isNavigatorOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

export function isLikelyNetworkFailure(err: unknown): boolean {
  if (isNavigatorOffline()) return true;
  if (err instanceof TypeError) return true;
  const s = err instanceof Error ? err.message : String(err);
  return /\bnetwork\b|fetch|failed to fetch|load failed|abort(ed)?|connection\b/i.test(s);
}

/** PO payload with positive lines only — matches server skip logic */
export type NormalizedPoPayload = {
  purchaseOrderId: string;
  items: { itemId: string; receivedQuantity: number }[];
};

function tryEnqueueQuick(
  userId: string,
  payload: ReceiveIncomingInput
): { ok: true } | { ok: false; error: string } {
  try {
    enqueueQuickReceive(userId, payload);
    return { ok: true };
  } catch (e) {
    if (e instanceof RangeError) return { ok: false, error: e.message };
    return { ok: false, error: "Could not save this receipt on the device." };
  }
}

function tryEnqueuePo(
  userId: string,
  payload: NormalizedPoPayload,
  poLabel?: string
): { ok: true } | { ok: false; error: string } {
  try {
    enqueuePoReceive(userId, payload, poLabel);
    return { ok: true };
  } catch (e) {
    if (e instanceof RangeError) return { ok: false, error: e.message };
    return { ok: false, error: "Could not save this receipt on the device." };
  }
}

export function normalizeReceiveItemsPayload(input: ReceiveItemsInput): NormalizedPoPayload {
  const items = input.items.filter((i) => i.receivedQuantity > 0);
  return { purchaseOrderId: input.purchaseOrderId, items };
}

export async function submitQuickReceiveWithOffline(
  offlineQueueUserId: string | undefined,
  payload: unknown
): Promise<ActionResult<{ productName: string }>> {
  const parsedIn = receiveIncomingSchema.safeParse(payload);
  if (!parsedIn.success) {
    return {
      success: false,
      error: parsedIn.error.issues[0]?.message ?? "Invalid receipt data.",
    };
  }
  const data = parsedIn.data;

  if (!offlineQueueUserId) {
    return receiveIncomingGoods(data);
  }

  if (isNavigatorOffline()) {
    const eq = tryEnqueueQuick(offlineQueueUserId, data);
    if (!eq.ok) return { success: false, error: eq.error };
    return {
      success: true,
      data: { productName: "Queued locally" },
      message:
        "You appear offline — this receipt is saved on this device and will sync when you are online.",
      offlineQueued: true,
    };
  }

  try {
    return await receiveIncomingGoods(data);
  } catch (err) {
    if (isLikelyNetworkFailure(err)) {
      const eq = tryEnqueueQuick(offlineQueueUserId, data);
      if (!eq.ok) return { success: false, error: eq.error };
      return {
        success: true,
        data: { productName: "Queued locally" },
        message:
          "Connection lost — this receipt is queued on this device and will sync automatically.",
        offlineQueued: true,
      };
    }
    throw err;
  }
}

export async function submitPoReceiveWithOffline(
  offlineQueueUserId: string | undefined,
  formData: unknown,
  poLabel?: string
): Promise<ActionResult<void>> {
  const parsedIn = receiveItemsSchema.safeParse(formData);
  if (!parsedIn.success) {
    return {
      success: false,
      error: parsedIn.error.issues[0]?.message ?? "Invalid receipt data.",
    };
  }
  const normalized = normalizeReceiveItemsPayload(parsedIn.data);
  if (!normalized.items.length) {
    return { success: false, error: "Enter at least one quantity greater than zero." };
  }

  if (!offlineQueueUserId) {
    return receiveItems(normalized);
  }

  if (isNavigatorOffline()) {
    const eq = tryEnqueuePo(offlineQueueUserId, normalized, poLabel);
    if (!eq.ok) return { success: false, error: eq.error };
    return {
      success: true,
      data: undefined,
      message:
        "You appear offline — this PO receipt is saved on this device and will sync when you are online.",
      offlineQueued: true,
    };
  }

  try {
    return await receiveItems(normalized);
  } catch (err) {
    if (isLikelyNetworkFailure(err)) {
      const eq = tryEnqueuePo(offlineQueueUserId, normalized, poLabel);
      if (!eq.ok) return { success: false, error: eq.error };
      return {
        success: true,
        data: undefined,
        message:
          "Connection lost — this PO receipt is queued on this device and will sync automatically.",
        offlineQueued: true,
      };
    }
    throw err;
  }
}

export type FlushReceiveQueueResult = {
  flushedOk: number;
  droppedBusinessErrors: string[];
  stoppedEarlyForNetwork?: boolean;
};

/** FIFO sync — skips bad items server rejects; stalls on transport errors so the failing head stays. */
export async function flushReceiveOfflineQueue(userId: string): Promise<FlushReceiveQueueResult> {
  const items = [...readReceiveQueue(userId)];
  let flushedOk = 0;
  const droppedBusinessErrors: string[] = [];
  let stoppedEarlyForNetwork = false;

  while (items.length > 0) {
    const head = items[0];
    try {
      if (head.kind === "quick") {
        const r = await receiveIncomingGoods(head.payload);
        items.shift();
        if (r.success) flushedOk += 1;
        else droppedBusinessErrors.push(r.error);
        continue;
      }

      const normalizedPo = normalizeReceiveItemsPayload(head.payload);

      if (normalizedPo.items.length === 0) {
        items.shift();
        droppedBusinessErrors.push("Queued PO receipt had no line quantities.");
        continue;
      }

      const r = await receiveItems(normalizedPo);
      items.shift();
      if (r.success) flushedOk += 1;
      else droppedBusinessErrors.push(r.error);
    } catch {
      stoppedEarlyForNetwork = true;
      break;
    }
  }

  replaceReceiveQueue(userId, items);
  return {
    flushedOk,
    droppedBusinessErrors,
    stoppedEarlyForNetwork,
  };
}
