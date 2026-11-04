ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS other_sports text;

CREATE TABLE public.coach_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  title text NOT NULL DEFAULT 'Nouvelle discussion',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coach_threads TO authenticated;
GRANT ALL ON public.coach_threads TO service_role;
ALTER TABLE public.coach_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coach_threads owner select" ON public.coach_threads FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "coach_threads owner insert" ON public.coach_threads FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "coach_threads owner update" ON public.coach_threads FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "coach_threads owner delete" ON public.coach_threads FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX coach_threads_user_idx ON public.coach_threads (user_id, updated_at DESC);

CREATE TABLE public.coach_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.coach_threads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  message_id text NOT NULL,
  role text NOT NULL CHECK (role IN ('user','assistant')),
  parts jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (thread_id, message_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coach_messages TO authenticated;
GRANT ALL ON public.coach_messages TO service_role;
ALTER TABLE public.coach_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coach_messages owner select" ON public.coach_messages FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "coach_messages owner insert" ON public.coach_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.coach_threads t WHERE t.id = thread_id AND t.user_id = auth.uid()));
CREATE POLICY "coach_messages owner update" ON public.coach_messages FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "coach_messages owner delete" ON public.coach_messages FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX coach_messages_thread_idx ON public.coach_messages (thread_id, created_at);

CREATE OR REPLACE FUNCTION public.delete_my_data()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  DELETE FROM public.coach_messages WHERE user_id = uid;
  DELETE FROM public.coach_threads WHERE user_id = uid;
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