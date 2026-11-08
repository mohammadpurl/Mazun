import type { CustomerTotals } from '@/lib/customers';

/** Totals of a customer with no orders yet. */
export const customerOrderSummary = (): CustomerTotals => ({ orders: 0, spent: 0, owed: 0, lastOrderAt: null, firstOrderAt: null, open: 0 });
