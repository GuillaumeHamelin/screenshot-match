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
- Nutrition writes (meal items, foods, saved meals, water) live in `src/lib/nutrition.ts`; call `invalidateNutrition(qc)` after them. Open Food Facts is only reached through the authenticated server function in `src/lib/nutrition.functions.ts`. Why: one cache-sync point, and the external API gets a proper User-Agent without browser CORS issues.
- Meal items store computed totals for their quantity; products whose kcal/protein/carbs/fat are missing are hidden, never filled in. Why: nutrition values must never be invented.
- Advanced-tracking writes (goals, calendar planning/moves, progress photos, reminders) live in `src/lib/tracking.ts`; call `invalidateTracking(qc)` after them, plus `invalidateTraining(qc)` when sessions change. Why: same single cache-sync point as the other modules.
- Goal "current" values are computed live from logged data via `goalCurrentValue` (only `manual` goals store `current_value`). Why: goals must always match what was actually logged.
- Planned sessions are `workout_sessions` rows with status `scheduled`/`skipped` and a `scheduled_date`; "missed" is derived (planned date before today), never stored. Starting one converts the same row (`startSession({ scheduledId })`).
- Progress photos are re-encoded to JPEG in the browser before upload (strips EXIF/GPS) and stored in the private `progress-photos` bucket.
- Reminders fire in-app only while the app is open (`ReminderWatcher` in the shell, toast + browser Notification when the tab is hidden); there is no server push. Already-shown reminders are tracked per day in localStorage.

