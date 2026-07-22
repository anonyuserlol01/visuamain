# VISUAREALM Creative House — UI Launch v10

This is a frontend-only launch hardening update. No SQL migration, Supabase
secret, Edge Function, or provider setting needs to be changed.

## Deploy

Push the public website files in this folder to the existing GitHub repository.
The included `.gitignore` keeps `/supabase/`, `/database-private/`, and
`/email-templates/` out of GitHub while keeping `/vendor/` publishable.

Confirm that this required browser file is present in GitHub:

`/vendor/supabase-2.110.7.js`

After GitHub Pages finishes deploying, hard-refresh the live site.

## Launch fixes in this update

- Hiring pricing links now preselect and create the correct hiring workspace.
- Opportunity entry links now return members to Dashboard → Browse.
- Google authentication preserves the intended safe post-authentication route.
- Public listing Back, footer, feedback, notifications, modal close, outside
  click, and Escape behavior work in every listing state.
- House-rules acceptance cannot be bypassed when the database write fails.
- Settings password updates use the same 12–72 character strength policy as
  signup.
- Age agreement cannot be submitted without a birth date.
- Unused Mission Control controls that did not operate the live email or Music
  experience were removed.
- Mission Control now accurately identifies transactional email as
  provider-managed.
- Legacy archive images and metadata were repaired and the archive is noindex.
- Sitemap URLs now match the canonical non-www production domain.
- Shared application JavaScript uses one cache-busted launch version.

## Verification completed

- Shared JavaScript syntax validation
- Local link and asset resolution
- Duplicate DOM ID scan
- Form-button default-submit scan
- External-tab opener security scan
- Applicant and hiring dashboard tab regression
- Admin section regression
- Moderation workspace regression
- Settings section regression
- Listing state and modal regression
- Mentor filters and modal regression
- Pricing controls, plan modal, and FAQ regression
- Git ignore verification for private backend material

## Final live smoke test

Use one applicant and one hiring account on the deployed site:

1. Sign up, verify email, and sign in.
2. Confirm the hiring signup link opens the hiring workspace.
3. Applicant: Browse → open listing → save → apply → Applications.
4. Hirer: create listing → open Application Manager → shortlist → notify.
5. Admin: enable and disable maintenance mode once.
6. Settings: open Privacy, Age & Data and download the private ZIP.

