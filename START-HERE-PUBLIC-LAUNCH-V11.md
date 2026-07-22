# VISUAREALM Public Launch v11

This update redesigns the VISUAREALM company homepage and Creative House public experience on top of the verified v10 application.

## Files changed

- `/index.html`
- `/creative-house/index.html`
- `/pricing/index.html`
- `/realm-music/index.html`
- `/realm-pictures/index.html`
- `/public-nav.js`

`/public-nav.css` is included in the targeted package for deployment completeness, but its styling is unchanged.

## Deploy

1. Replace the files above with the v11 versions.
2. Make sure `/vendor/supabase-2.110.7.js` remains in the repository.
3. Push the update to GitHub.
4. Wait for GitHub Pages to finish deploying.
5. Hard-refresh with `Ctrl + Shift + R`.

## Launch state

- New accounts remain free and require email confirmation.
- Applicant signup routes to the applicant workspace.
- Hiring signup routes to the hiring workspace.
- Opportunity signup routes to Browse after authentication.
- House+ and Hiring Studio are clearly marked **Coming soon**.
- Paid prices and checkout actions are not exposed.
- No card, subscription, or automatic conversion is implied.

## Backend changes

None. Do not run SQL and do not redeploy Supabase Edge Functions for this update.

## Quick live check

Test these routes after deployment:

- `/`
- `/creative-house/`
- `/pricing/`
- `/realm-pictures/`
- `/realm-music/`
- `/create-account/`
- `/create-account/?mode=signup`
- `/create-account/?mode=signup&role=hiring`
- `/create-account/?view=opportunities&mode=signup`

