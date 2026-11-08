/* One read of each list per request, shared by the panel layout (counts, notices) and the page under it. */
import { cache } from 'react';
import { db } from './db';

export const ordersOnce = cache(() => db().listOrders());
export const garmentsOnce = cache(() => db().listGarments());
export const adminSettingsOnce = cache(() => db().getSettings());
