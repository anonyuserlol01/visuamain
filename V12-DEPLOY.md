# VISUAREALM public shell + dashboard access v12

Replace every file included in the targeted archive, preserving its folder path, then push the update in one commit.

No SQL, Supabase migration, Edge Function, secret, SMTP, or database change is required.

After GitHub Pages finishes deploying, hard-refresh with `Ctrl + Shift + R`.

## Quick checks

1. Open VISUAREALM, Realm Pictures, Realm Music, and Creative House. Their header and footer should match.
2. Confirm Sign in/Create account appears only on Creative House.
3. While signed in, revisit Creative House and confirm an initials avatar replaces those two actions.
4. Open the avatar and test Dashboard, My profile, and Sign out.
5. In both applicant and hiring workspaces, open **Plans & access** and use its Return button.

The `vendor` directory remains required for live authentication. Private `supabase`, Functions, SQL, and email-template setup folders are not part of the targeted update.
