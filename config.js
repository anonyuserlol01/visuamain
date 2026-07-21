/* =====================================================================
   VISUAREALM · CREATIVE HOUSE  —  CONFIG
   Already filled in for your project. If you ever rotate keys,
   replace the two values below (Supabase > Project Settings > API keys).
   ===================================================================== */

window.VISUAREALM_CONFIG = {
    // Your Supabase project URL (derived from project id: mpmjirvdtbgwoulxynwc)
    SUPABASE_URL: "https://mpmjirvdtbgwoulxynwc.supabase.co",

    // Your public / publishable key (safe in the browser — Row Level Security protects data)
    SUPABASE_ANON_KEY: "sb_publishable_huvZj3vnIqPuAN1W2hdtvA_NrF4YW8P",

    // Navigation targets
    ROUTES: {
        afterLogin:  "/dashboard/",
        afterLogout: "/create-account/",
        admin:       "/admin/",
        // Origin-relative so production, localhost and LAN testing all stay
        // on the same host and protocol.
        home:        "/"
    }
};
