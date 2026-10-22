-- Shared updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- PROFILES
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text,
  avatar_url text,
  birth_date date,
  sex text,
  height_cm numeric(5,1),
  main_goal text,
  activity_level text,
  unit_system text NOT NULL DEFAULT 'metric',
  calorie_goal integer NOT NULL DEFAULT 2200,
  protein_goal integer NOT NULL DEFAULT 140,
  carbs_goal integer NOT NULL DEFAULT 250,
  fat_goal integer NOT NULL DEFAULT 70,
  water_goal_ml integer NOT NULL DEFAULT 2500,
  weekly_sessions_goal integer NOT NULL DEFAULT 4,
  notifications_enabled boolean NOT NULL DEFAULT true,
  terms_accepted_at timestamptz,
  onboarding_completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own profile select" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, username, avatar_url, terms_accepted_at)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'username', ''), NULLIF(NEW.raw_user_meta_data->>'full_name', ''), split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    CASE WHEN (NEW.raw_user_meta_data->>'terms_accepted') = 'true' THEN now() ELSE NULL END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- EXERCISES (user_id NULL = shared library)
CREATE TABLE public.exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  name text NOT NULL,
  muscle_group text NOT NULL,
  secondary_muscles text[] NOT NULL DEFAULT '{}',
  equipment text,
  description text,
  tips text,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX exercises_user_idx ON public.exercises(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exercises TO authenticated;
GRANT ALL ON public.exercises TO service_role;
ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read library and own exercises" ON public.exercises FOR SELECT TO authenticated USING (user_id IS NULL OR user_id = auth.uid());
CREATE POLICY "Insert own exercises" ON public.exercises FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Update own exercises" ON public.exercises FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Delete own exercises" ON public.exercises FOR DELETE TO authenticated USING (user_id = auth.uid());

-- WORKOUT PROGRAMS
CREATE TABLE public.workout_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  description text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX workout_programs_user_idx ON public.workout_programs(user_id);
CREATE TRIGGER workout_programs_updated_at BEFORE UPDATE ON public.workout_programs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.workout_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  program_id uuid NOT NULL REFERENCES public.workout_programs(id) ON DELETE CASCADE,
  name text NOT NULL,
  weekdays smallint[] NOT NULL DEFAULT '{}',
  position integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX workout_templates_program_idx ON public.workout_templates(program_id);

CREATE TABLE public.workout_template_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  template_id uuid NOT NULL REFERENCES public.workout_templates(id) ON DELETE CASCADE,
  exercise_id uuid NOT NULL REFERENCES public.exercises(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  target_sets integer NOT NULL DEFAULT 3,
  target_reps text,
  target_weight_kg numeric(6,2),
  rest_seconds integer NOT NULL DEFAULT 90,
  notes text
);
CREATE INDEX wte_template_idx ON public.workout_template_exercises(template_id);

-- WORKOUT SESSIONS
CREATE TABLE public.workout_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  program_id uuid REFERENCES public.workout_programs(id) ON DELETE SET NULL,
  template_id uuid REFERENCES public.workout_templates(id) ON DELETE SET NULL,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'scheduled',
  scheduled_date date,
  started_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer,
  total_volume_kg numeric(10,2) NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workout_sessions_status_chk CHECK (status IN ('scheduled','in_progress','completed','skipped'))
);
CREATE INDEX workout_sessions_user_idx ON public.workout_sessions(user_id, started_at DESC);
CREATE INDEX workout_sessions_sched_idx ON public.workout_sessions(user_id, scheduled_date);

CREATE TABLE public.workout_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  session_id uuid NOT NULL REFERENCES public.workout_sessions(id) ON DELETE CASCADE,
  exercise_id uuid NOT NULL REFERENCES public.exercises(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  rest_seconds integer NOT NULL DEFAULT 90,
  notes text
);
CREATE INDEX workout_exercises_session_idx ON public.workout_exercises(session_id);
CREATE INDEX workout_exercises_ex_idx ON public.workout_exercises(user_id, exercise_id);

CREATE TABLE public.workout_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  workout_exercise_id uuid NOT NULL REFERENCES public.workout_exercises(id) ON DELETE CASCADE,
  set_number integer NOT NULL,
  weight_kg numeric(6,2),
  reps integer,
  rpe numeric(3,1),
  rir integer,
  set_type text NOT NULL DEFAULT 'normal',
  completed boolean NOT NULL DEFAULT false,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workout_sets_type_chk CHECK (set_type IN ('normal','warmup','dropset','failure'))
);
CREATE INDEX workout_sets_we_idx ON public.workout_sets(workout_exercise_id);

CREATE TABLE public.personal_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  exercise_id uuid NOT NULL REFERENCES public.exercises(id) ON DELETE CASCADE,
  record_type text NOT NULL,
  value numeric(10,2) NOT NULL,
  weight_kg numeric(6,2),
  reps integer,
  set_id uuid REFERENCES public.workout_sets(id) ON DELETE SET NULL,
  session_id uuid REFERENCES public.workout_sessions(id) ON DELETE SET NULL,
  achieved_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT personal_records_type_chk CHECK (record_type IN ('max_weight','est_1rm','max_reps','max_volume'))
);
CREATE INDEX personal_records_user_idx ON public.personal_records(user_id, achieved_at DESC);

-- NUTRITION
CREATE TABLE public.foods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  brand text,
  barcode text,
  source text NOT NULL DEFAULT 'custom',
  external_id text,
  calories_per_100g numeric(7,2) NOT NULL,
  protein_per_100g numeric(6,2) NOT NULL DEFAULT 0,
  carbs_per_100g numeric(6,2) NOT NULL DEFAULT 0,
  fat_per_100g numeric(6,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT foods_source_chk CHECK (source IN ('custom','openfoodfacts'))
);
CREATE INDEX foods_user_idx ON public.foods(user_id);

CREATE TABLE public.meals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  eaten_on date NOT NULL DEFAULT CURRENT_DATE,
  meal_type text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT meals_type_chk CHECK (meal_type IN ('breakfast','lunch','dinner','snack'))
);
CREATE INDEX meals_user_date_idx ON public.meals(user_id, eaten_on);

CREATE TABLE public.meal_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  meal_id uuid NOT NULL REFERENCES public.meals(id) ON DELETE CASCADE,
  food_id uuid REFERENCES public.foods(id) ON DELETE SET NULL,
  food_name text NOT NULL,
  quantity_g numeric(7,2) NOT NULL,
  calories numeric(8,2) NOT NULL DEFAULT 0,
  protein_g numeric(7,2) NOT NULL DEFAULT 0,
  carbs_g numeric(7,2) NOT NULL DEFAULT 0,
  fat_g numeric(7,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX meal_items_meal_idx ON public.meal_items(meal_id);

CREATE TABLE public.saved_recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  is_favorite boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX saved_recipes_user_idx ON public.saved_recipes(user_id);

CREATE TABLE public.saved_recipe_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  recipe_id uuid NOT NULL REFERENCES public.saved_recipes(id) ON DELETE CASCADE,
  food_id uuid REFERENCES public.foods(id) ON DELETE SET NULL,
  food_name text NOT NULL,
  quantity_g numeric(7,2) NOT NULL,
  calories_per_100g numeric(7,2) NOT NULL,
  protein_per_100g numeric(6,2) NOT NULL DEFAULT 0,
  carbs_per_100g numeric(6,2) NOT NULL DEFAULT 0,
  fat_per_100g numeric(6,2) NOT NULL DEFAULT 0
);
CREATE INDEX saved_recipe_items_recipe_idx ON public.saved_recipe_items(recipe_id);

CREATE TABLE public.water_intake (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  drank_on date NOT NULL DEFAULT CURRENT_DATE,
  amount_ml integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT water_amount_chk CHECK (amount_ml > 0 AND amount_ml <= 5000)
);
CREATE INDEX water_intake_user_date_idx ON public.water_intake(user_id, drank_on);

-- BODY
CREATE TABLE public.body_measurements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  measured_on date NOT NULL DEFAULT CURRENT_DATE,
  weight_kg numeric(5,2),
  height_cm numeric(5,1),
  body_fat_pct numeric(4,1),
  muscle_mass_kg numeric(5,2),
  waist_cm numeric(5,1),
  chest_cm numeric(5,1),
  arm_cm numeric(5,1),
  thigh_cm numeric(5,1),
  calf_cm numeric(5,1),
  custom jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX body_measurements_user_date_idx ON public.body_measurements(user_id, measured_on DESC);

CREATE TABLE public.progress_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  taken_on date NOT NULL DEFAULT CURRENT_DATE,
  storage_path text NOT NULL,
  pose text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX progress_photos_user_idx ON public.progress_photos(user_id, taken_on DESC);

-- GOALS
CREATE TABLE public.goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  category text NOT NULL,
  title text NOT NULL,
  metric text,
  exercise_id uuid REFERENCES public.exercises(id) ON DELETE SET NULL,
  start_value numeric(10,2),
  current_value numeric(10,2),
  target_value numeric(10,2) NOT NULL,
  unit text,
  target_date date,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT goals_category_chk CHECK (category IN ('strength','body','nutrition','training')),
  CONSTRAINT goals_status_chk CHECK (status IN ('active','completed','abandoned'))
);
CREATE INDEX goals_user_idx ON public.goals(user_id);
CREATE TRIGGER goals_updated_at BEFORE UPDATE ON public.goals FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Grants + owner-only RLS for every user-owned table
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'workout_programs','workout_templates','workout_template_exercises','workout_sessions',
    'workout_exercises','workout_sets','personal_records','foods','meals','meal_items',
    'saved_recipes','saved_recipe_items','water_intake','body_measurements','progress_photos','goals'
  ] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "Own rows select" ON public.%I FOR SELECT TO authenticated USING (user_id = auth.uid())', t);
    EXECUTE format('CREATE POLICY "Own rows insert" ON public.%I FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid())', t);
    EXECUTE format('CREATE POLICY "Own rows update" ON public.%I FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())', t);
    EXECUTE format('CREATE POLICY "Own rows delete" ON public.%I FOR DELETE TO authenticated USING (user_id = auth.uid())', t);
  END LOOP;
END $$;

-- Wipe all personal data for the calling user (used before account deletion)
CREATE OR REPLACE FUNCTION public.delete_my_data()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
  DELETE FROM public.exercises WHERE user_id = uid;
END;
$$;
REVOKE ALL ON FUNCTION public.delete_my_data() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_my_data() TO authenticated;

-- Storage policies: files live under "<user_id>/..." in private buckets
CREATE POLICY "Own avatar read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Own avatar insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Own avatar update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Own avatar delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Own progress photo read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'progress-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Own progress photo insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'progress-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Own progress photo delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'progress-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Shared exercise library
INSERT INTO public.exercises (user_id, name, muscle_group, secondary_muscles, equipment, description, tips) VALUES
(NULL,'Développé couché','Pectoraux','{Triceps,Épaules}','Barre','Allongé sur un banc plat, descendre la barre jusqu''à la poitrine puis la pousser à bout de bras.','Omoplates serrées, pieds ancrés au sol, trajectoire légèrement oblique.'),
(NULL,'Développé incliné haltères','Pectoraux','{Épaules,Triceps}','Haltères','Sur banc incliné à 30°, pousser les haltères au-dessus de la poitrine.','Contrôler la descente, coudes à environ 45° du buste.'),
(NULL,'Écarté à la poulie','Pectoraux','{Épaules}','Poulie','Bras légèrement fléchis, ramener les poignées devant la poitrine en arc de cercle.','Garder la même flexion de coude sur toute l''amplitude.'),
(NULL,'Dips','Pectoraux','{Triceps,Épaules}','Poids du corps','Aux barres parallèles, descendre en fléchissant les coudes puis remonter.','Buste penché vers l''avant pour cibler les pectoraux.'),
(NULL,'Pompes','Pectoraux','{Triceps,Épaules,Abdominaux}','Poids du corps','En planche, descendre la poitrine vers le sol puis repousser.','Corps gainé et aligné du talon à la tête.'),
(NULL,'Tractions','Dos','{Biceps}','Poids du corps','Suspendu à une barre, tirer jusqu''à passer le menton au-dessus.','Initier le mouvement avec les omoplates, éviter de se balancer.'),
(NULL,'Rowing barre','Dos','{Biceps,Lombaires}','Barre','Buste penché, tirer la barre vers le bas du ventre.','Dos plat, coudes le long du corps.'),
(NULL,'Tirage vertical','Dos','{Biceps}','Machine','Assis, tirer la barre vers le haut de la poitrine.','Poitrine sortie, ne pas tirer avec les bras uniquement.'),
(NULL,'Rowing haltère unilatéral','Dos','{Biceps}','Haltères','Un genou sur le banc, tirer l''haltère vers la hanche.','Garder les épaules parallèles au sol.'),
(NULL,'Soulevé de terre','Dos','{Ischio-jambiers,Fessiers,Lombaires}','Barre','Soulever la barre du sol jusqu''à l''extension complète des hanches.','Barre collée aux tibias, dos neutre, pousser le sol avec les jambes.'),
(NULL,'Tirage horizontal','Dos','{Biceps}','Poulie','Assis, tirer la poignée vers le nombril.','Serrer les omoplates en fin de mouvement.'),
(NULL,'Développé militaire','Épaules','{Triceps}','Barre','Debout, pousser la barre du haut de la poitrine au-dessus de la tête.','Gainage abdominal fort, ne pas cambrer.'),
(NULL,'Développé haltères assis','Épaules','{Triceps}','Haltères','Assis, pousser les haltères au-dessus de la tête.','Ne pas verrouiller brutalement les coudes.'),
(NULL,'Élévations latérales','Épaules','{}','Haltères','Bras tendus, lever les haltères sur les côtés jusqu''à hauteur des épaules.','Mouvement lent, légère flexion des coudes.'),
(NULL,'Oiseau','Épaules','{Dos}','Haltères','Buste penché, ouvrir les bras sur les côtés pour cibler l''arrière d''épaule.','Charges légères, contrôle total.'),
(NULL,'Face pull','Épaules','{Dos}','Poulie','Tirer la corde vers le visage en écartant les mains.','Coudes hauts, rotation externe en fin de mouvement.'),
(NULL,'Curl barre','Biceps','{Avant-bras}','Barre','Debout, fléchir les coudes pour monter la barre.','Coudes fixes le long du corps.'),
(NULL,'Curl haltères alterné','Biceps','{Avant-bras}','Haltères','Fléchir un bras après l''autre en supinant le poignet.','Ne pas balancer le buste.'),
(NULL,'Curl marteau','Biceps','{Avant-bras}','Haltères','Curl avec prise neutre, pouces vers le haut.','Contrôler la phase de descente.'),
(NULL,'Curl pupitre','Biceps','{}','Machine','Bras posés sur le pupitre, fléchir les coudes.','Amplitude complète sans décoller les bras.'),
(NULL,'Extension triceps poulie','Triceps','{}','Poulie','Coudes collés au corps, tendre les bras vers le bas.','Seuls les avant-bras bougent.'),
(NULL,'Barre au front','Triceps','{}','Barre','Allongé, descendre la barre vers le front puis tendre les bras.','Coudes pointés vers le plafond.'),
(NULL,'Développé couché prise serrée','Triceps','{Pectoraux}','Barre','Développé couché avec les mains à largeur d''épaules.','Coudes près du corps.'),
(NULL,'Extension nuque haltère','Triceps','{}','Haltères','Haltère derrière la tête, tendre les bras vers le haut.','Garder les coudes serrés.'),
(NULL,'Squat','Quadriceps','{Fessiers,Ischio-jambiers}','Barre','Barre sur le haut du dos, descendre en fléchissant hanches et genoux.','Genoux dans l''axe des pieds, dos neutre.'),
(NULL,'Presse à cuisses','Quadriceps','{Fessiers}','Machine','Pousser la plateforme avec les pieds.','Ne pas décoller le bas du dos du dossier.'),
(NULL,'Fentes','Quadriceps','{Fessiers}','Haltères','Grand pas en avant, descendre le genou arrière vers le sol.','Buste droit, genou avant au-dessus de la cheville.'),
(NULL,'Leg extension','Quadriceps','{}','Machine','Assis, tendre les jambes contre la résistance.','Marquer une pause en contraction.'),
(NULL,'Squat bulgare','Quadriceps','{Fessiers}','Haltères','Pied arrière sur un banc, descendre sur la jambe avant.','Contrôler la descente, poids sur le talon avant.'),
(NULL,'Soulevé de terre jambes tendues','Ischio-jambiers','{Fessiers,Lombaires}','Barre','Jambes quasi tendues, descendre la barre le long des cuisses.','Pousser les hanches vers l''arrière, dos plat.'),
(NULL,'Leg curl allongé','Ischio-jambiers','{}','Machine','Allongé, fléchir les jambes pour ramener le boudin vers les fessiers.','Bassin plaqué contre le banc.'),
(NULL,'Leg curl assis','Ischio-jambiers','{}','Machine','Assis, fléchir les genoux contre la résistance.','Mouvement contrôlé en phase négative.'),
(NULL,'Hip thrust','Fessiers','{Ischio-jambiers}','Barre','Dos appuyé sur un banc, pousser les hanches vers le haut avec la barre.','Menton rentré, serrer les fessiers en haut.'),
(NULL,'Abduction machine','Fessiers','{}','Machine','Assis, écarter les jambes contre la résistance.','Buste légèrement penché pour cibler le moyen fessier.'),
(NULL,'Kickback poulie','Fessiers','{}','Poulie','Tendre la jambe vers l''arrière avec la cheville attachée.','Ne pas cambrer le bas du dos.'),
(NULL,'Mollets debout','Mollets','{}','Machine','Monter sur la pointe des pieds contre la charge.','Amplitude complète, pause en haut.'),
(NULL,'Mollets assis','Mollets','{}','Machine','Assis, lever les talons en poussant sur la pointe des pieds.','Cible le soléaire, tempo lent.'),
(NULL,'Crunch','Abdominaux','{}','Poids du corps','Allongé, enrouler le buste vers les genoux.','Expirer en montant, ne pas tirer sur la nuque.'),
(NULL,'Gainage','Abdominaux','{Épaules}','Poids du corps','Maintenir la position de planche sur les avant-bras.','Bassin aligné, abdominaux contractés.'),
(NULL,'Relevés de jambes suspendu','Abdominaux','{}','Poids du corps','Suspendu à une barre, monter les jambes devant soi.','Éviter le balancement, enrouler le bassin.'),
(NULL,'Crunch à la poulie','Abdominaux','{}','Poulie','À genoux, enrouler le buste en tirant la corde vers le bas.','Le mouvement vient de la flexion du buste, pas des bras.');
