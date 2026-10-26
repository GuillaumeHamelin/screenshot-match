<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# Project rules
- App UI copy is French, informal "tu". Keep it that way across pages.
- Signed-in pages live under `src/routes/_authenticated/_shell/` (app shell + onboarding gate); onboarding sits outside `_shell` so it renders without the shell. Why: one gate for session, one for completed profile.
- Pure calculations (1RM, macros, goals, nutrition suggestions) live in `src/lib/fitness.ts` with tests in `src/lib/fitness.test.ts`. Why: correctness of numbers is a core requirement.
- Data reads use query options in `src/lib/queries.ts`; mutations invalidate the `dashboard` key so the dashboard stays live.
- Every user-owned table carries `user_id` with owner-only RLS; `exercises` with `user_id IS NULL` is the shared library. Never add cross-user reads.
- User files go in private buckets under `<user_id>/...`; display via signed URLs.
- Account deletion goes through `deleteMyAccount` (server function: `delete_my_data` RPC, then admin user delete). Add new user tables to that RPC and to the export list in Paramètres.
- Dark-only design: tokens in `src/styles.css`; no light theme.
- Workout writes (start/finish/delete session, programs, reorder) live in `src/lib/workouts.ts`; call `invalidateTraining(qc)` after them. Why: one place keeps sessions, records, performances and dashboard in sync.
- Personal records are computed only when a session is finished (`finishSession`, using `exerciseBests`/`detectRecords`); deleting a session deletes its records. Warm-ups and unvalidated sets never count. Why: records must match logged data.
- Fixed overlays inside the app shell (e.g. rest timer) render through a portal to `document.body`. Why: the shell's page wrapper is animated with a transform, which traps `position: fixed`.
