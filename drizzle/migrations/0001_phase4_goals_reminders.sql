ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS reference_weight_kg numeric;

CREATE TABLE public.reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  kind text NOT NULL DEFAULT 'custom',
  label text NOT NULL,
  time_of_day time NOT NULL DEFAULT '18:00',
  weekdays integer[] NOT NULL DEFAULT '{1,2,3,4,5,6,7}',
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reminders_kind_chk CHECK (kind IN ('workout', 'weigh_in', 'water', 'meals', 'photo', 'custom')),
  CONSTRAINT reminders_label_len CHECK (char_length(label) BETWEEN 1 AND 120),
  CONSTRAINT reminders_weekdays_chk CHECK (weekdays <@ ARRAY[1,2,3,4,5,6,7])
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reminders TO authenticated;
GRANT ALL ON public.reminders TO service_role;

ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own reminders select" ON public.reminders FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own reminders insert" ON public.reminders FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own reminders update" ON public.reminders FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own reminders delete" ON public.reminders FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX reminders_user_idx ON public.reminders (user_id);
CREATE INDEX IF NOT EXISTS workout_sessions_user_scheduled_idx ON public.workout_sessions (user_id, scheduled_date);

CREATE OR REPLACE FUNCTION public.delete_my_data()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  DELETE FROM public.personal_records WHERE user_id = uid;
  DELETE FROM public.workout_sessions WHERE user_id = uid;
  DELETE FROM public.workout_programs WHERE user_id = uid;
  DELETE FROM public.goals WHERE user_id = uid;
  DELETE FROM public.meals WHERE user_id = uid;
  DELETE FROM public.saved_recipes WHERE user_id = uid;
  DELETE FROM public.foods WHERE user_id = uid;
  DELETE FROM public.water_intake WHERE user_id = uid;
  DELETE FROM public.body_measurements WHERE user_id = uid;
  DELETE FROM public.progress_photos WHERE user_id = uid;
  DELETE FROM public.reminders WHERE user_id = uid;
  DELETE FROM public.exercises WHERE user_id = uid;
END;
$function$;