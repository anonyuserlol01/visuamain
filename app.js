/* =====================================================================
   VISUAREALM · CREATIVE HOUSE — SHARED APP HELPERS
   Requires: config.js and @supabase/supabase-js (UMD) loaded before this.
   ===================================================================== */
(function () {
    const CFG = window.VISUAREALM_CONFIG || {};
    const configured =
        CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY &&
        !CFG.SUPABASE_URL.includes("PASTE_") && !CFG.SUPABASE_ANON_KEY.includes("PASTE_");

    let client = null;
    if (configured && window.supabase) {
        client = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);
    }

    const CH = {
        cfg: CFG,
        configured,
        sb: client,
        routes: CFG.ROUTES || {},

        // Redirect unauthenticated users to the auth page. Returns the session.
        async requireAuth() {
            if (!client) { return null; }
            const { data } = await client.auth.getSession();
            if (!data.session) {
                window.location.href = (CFG.ROUTES && CFG.ROUTES.afterLogout) || "create-account.html";
                return null;
            }
            return data.session;
        },

        async getSession() {
            if (!client) return null;
            const { data } = await client.auth.getSession();
            return data.session;
        },

        // Current user's profile row (creates a fallback object if missing)
        async profile() {
            if (!client) return null;
            const s = await this.getSession();
            if (!s) return null;
            const { data, error } = await client
                .from("profiles").select("*").eq("id", s.user.id).single();
            if (error) { console.warn(error); return { id: s.user.id, email: s.user.email }; }
            return data;
        },

        async signOut() {
            if (client) await client.auth.signOut();
            window.location.href = (CFG.ROUTES && CFG.ROUTES.afterLogout) || "create-account.html";
        },

        // ---------- UI utilities ----------
        esc(v) {
            if (v == null) return "";
            return String(v).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
        },
        pill(status) {
            const s = (status || "").toLowerCase();
            const label = s.charAt(0).toUpperCase() + s.slice(1);
            return `<span class="pill ${s}">${this.esc(label)}</span>`;
        },
        fmtDate(ts) {
            if (!ts) return "—";
            try { return new Date(ts).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }); }
            catch (e) { return "—"; }
        },
        toast(el, msg, kind) {
            if (!el) { alert(msg); return; }
            el.textContent = msg;
            el.className = "alert show " + (kind === "ok" ? "ok" : "err");
        },
        clearToast(el) { if (el) el.className = "alert"; },

        // Guard: if config not filled in, show a banner and stop.
        guardConfig(targetSelector) {
            if (configured) return true;
            const host = document.querySelector(targetSelector) || document.body;
            const b = document.createElement("div");
            b.className = "alert err show";
            b.style.margin = "20px auto";
            b.style.maxWidth = "560px";
            b.innerHTML = "Setup needed: open <b>config.js</b> and paste your Supabase URL and anon key. See the README.";
            host.prepend(b);
            return false;
        }
    };

    window.CH = CH;
})();