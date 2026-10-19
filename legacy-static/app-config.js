/* Fill these in after you create your Supabase project (see README-SETUP.md).
   Leave them empty to run in demo mode: the admin panel then stores garments in this browser only. */
window.APP_CONFIG = {
  supabaseUrl: '',          // https://xxxx.supabase.co
  supabaseKey: '',          // the "anon" public key (never the service_role key)
  aiEndpoint: '',           // https://xxxx.supabase.co/functions/v1/ai   (leave empty for built-in demo answers)
  originCity: { fa: 'مسقط', ar: 'مسقط', en: 'Muscat' },
  prepDays: 2,              // days to prepare an order
  shipDays: 3,              // days for delivery
  bufferDays: 2             // safety margin before the event
};
