export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      body_measurements: {
        Row: {
          arm_cm: number | null
          body_fat_pct: number | null
          calf_cm: number | null
          chest_cm: number | null
          created_at: string
          custom: Json
          height_cm: number | null
          id: string
          measured_on: string
          muscle_mass_kg: number | null
          notes: string | null
          thigh_cm: number | null
          user_id: string
          waist_cm: number | null
          weight_kg: number | null
        }
        Insert: {
          arm_cm?: number | null
          body_fat_pct?: number | null
          calf_cm?: number | null
          chest_cm?: number | null
          created_at?: string
          custom?: Json
          height_cm?: number | null
          id?: string
          measured_on?: string
          muscle_mass_kg?: number | null
          notes?: string | null
          thigh_cm?: number | null
          user_id?: string
          waist_cm?: number | null
          weight_kg?: number | null
        }
        Update: {
          arm_cm?: number | null
          body_fat_pct?: number | null
          calf_cm?: number | null
          chest_cm?: number | null
          created_at?: string
          custom?: Json
          height_cm?: number | null
          id?: string
          measured_on?: string
          muscle_mass_kg?: number | null
          notes?: string | null
          thigh_cm?: number | null
          user_id?: string
          waist_cm?: number | null
          weight_kg?: number | null
        }
        Relationships: []
      }
      exercises: {
        Row: {
          created_at: string
          description: string | null
          equipment: string | null
          id: string
          image_url: string | null
          muscle_group: string
          name: string
          secondary_muscles: string[]
          tips: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          equipment?: string | null
          id?: string
          image_url?: string | null
          muscle_group: string
          name: string
          secondary_muscles?: string[]
          tips?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          equipment?: string | null
          id?: string
          image_url?: string | null
          muscle_group?: string
          name?: string
          secondary_muscles?: string[]
          tips?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      foods: {
        Row: {
          barcode: string | null
          brand: string | null
          calories_per_100g: number
          carbs_per_100g: number
          created_at: string
          external_id: string | null
          fat_per_100g: number
          id: string
          name: string
          protein_per_100g: number
          source: string
          user_id: string
        }
        Insert: {
          barcode?: string | null
          brand?: string | null
          calories_per_100g: number
          carbs_per_100g?: number
          created_at?: string
          external_id?: string | null
          fat_per_100g?: number
          id?: string
          name: string
          protein_per_100g?: number
          source?: string
          user_id?: string
        }
        Update: {
          barcode?: string | null
          brand?: string | null
          calories_per_100g?: number
          carbs_per_100g?: number
          created_at?: string
          external_id?: string | null
          fat_per_100g?: number
          id?: string
          name?: string
          protein_per_100g?: number
          source?: string
          user_id?: string
        }
        Relationships: []
      }
      goals: {
        Row: {
          category: string
          created_at: string
          current_value: number | null
          exercise_id: string | null
          id: string
          metric: string | null
          start_value: number | null
          status: string
          target_date: string | null
          target_value: number
          title: string
          unit: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string
          current_value?: number | null
          exercise_id?: string | null
          id?: string
          metric?: string | null
          start_value?: number | null
          status?: string
          target_date?: string | null
          target_value: number
          title: string
          unit?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          category?: string
          created_at?: string
          current_value?: number | null
          exercise_id?: string | null
          id?: string
          metric?: string | null
          start_value?: number | null
          status?: string
          target_date?: string | null
          target_value?: number
          title?: string
          unit?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goals_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_items: {
        Row: {
          calories: number
          carbs_g: number
          created_at: string
          fat_g: number
          food_id: string | null
          food_name: string
          id: string
          meal_id: string
          protein_g: number
          quantity_g: number
          user_id: string
        }
        Insert: {
          calories?: number
          carbs_g?: number
          created_at?: string
          fat_g?: number
          food_id?: string | null
          food_name: string
          id?: string
          meal_id: string
          protein_g?: number
          quantity_g: number
          user_id?: string
        }
        Update: {
          calories?: number
          carbs_g?: number
          created_at?: string
          fat_g?: number
          food_id?: string | null
          food_name?: string
          id?: string
          meal_id?: string
          protein_g?: number
          quantity_g?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_items_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "foods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_items_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "meals"
            referencedColumns: ["id"]
          },
        ]
      }
      meals: {
        Row: {
          created_at: string
          eaten_on: string
          id: string
          meal_type: string
          notes: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          eaten_on?: string
          id?: string
          meal_type: string
          notes?: string | null
          user_id?: string
        }
        Update: {
          created_at?: string
          eaten_on?: string
          id?: string
          meal_type?: string
          notes?: string | null
          user_id?: string
        }
        Relationships: []
      }
      personal_records: {
        Row: {
          achieved_at: string
          exercise_id: string
          id: string
          record_type: string
          reps: number | null
          session_id: string | null
          set_id: string | null
          user_id: string
          value: number
          weight_kg: number | null
        }
        Insert: {
          achieved_at?: string
          exercise_id: string
          id?: string
          record_type: string
          reps?: number | null
          session_id?: string | null
          set_id?: string | null
          user_id?: string
          value: number
          weight_kg?: number | null
        }
        Update: {
          achieved_at?: string
          exercise_id?: string
          id?: string
          record_type?: string
          reps?: number | null
          session_id?: string | null
          set_id?: string | null
          user_id?: string
          value?: number
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "personal_records_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personal_records_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "workout_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personal_records_set_id_fkey"
            columns: ["set_id"]
            isOneToOne: false
            referencedRelation: "workout_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          activity_level: string | null
          avatar_url: string | null
          birth_date: string | null
          calorie_goal: number
          carbs_goal: number
          created_at: string
          fat_goal: number
          height_cm: number | null
          id: string
          main_goal: string | null
          notifications_enabled: boolean
          onboarding_completed: boolean
          protein_goal: number
          sex: string | null
          terms_accepted_at: string | null
          unit_system: string
          updated_at: string
          username: string | null
          water_goal_ml: number
          weekly_sessions_goal: number
        }
        Insert: {
          activity_level?: string | null
          avatar_url?: string | null
          birth_date?: string | null
          calorie_goal?: number
          carbs_goal?: number
          created_at?: string
          fat_goal?: number
          height_cm?: number | null
          id: string
          main_goal?: string | null
          notifications_enabled?: boolean
          onboarding_completed?: boolean
          protein_goal?: number
          sex?: string | null
          terms_accepted_at?: string | null
          unit_system?: string
          updated_at?: string
          username?: string | null
          water_goal_ml?: number
          weekly_sessions_goal?: number
        }
        Update: {
          activity_level?: string | null
          avatar_url?: string | null
          birth_date?: string | null
          calorie_goal?: number
          carbs_goal?: number
          created_at?: string
          fat_goal?: number
          height_cm?: number | null
          id?: string
          main_goal?: string | null
          notifications_enabled?: boolean
          onboarding_completed?: boolean
          protein_goal?: number
          sex?: string | null
          terms_accepted_at?: string | null
          unit_system?: string
          updated_at?: string
          username?: string | null
          water_goal_ml?: number
          weekly_sessions_goal?: number
        }
        Relationships: []
      }
      progress_photos: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          pose: string | null
          storage_path: string
          taken_on: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          pose?: string | null
          storage_path: string
          taken_on?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          pose?: string | null
          storage_path?: string
          taken_on?: string
          user_id?: string
        }
        Relationships: []
      }
      saved_recipe_items: {
        Row: {
          calories_per_100g: number
          carbs_per_100g: number
          fat_per_100g: number
          food_id: string | null
          food_name: string
          id: string
          protein_per_100g: number
          quantity_g: number
          recipe_id: string
          user_id: string
        }
        Insert: {
          calories_per_100g: number
          carbs_per_100g?: number
          fat_per_100g?: number
          food_id?: string | null
          food_name: string
          id?: string
          protein_per_100g?: number
          quantity_g: number
          recipe_id: string
          user_id?: string
        }
        Update: {
          calories_per_100g?: number
          carbs_per_100g?: number
          fat_per_100g?: number
          food_id?: string | null
          food_name?: string
          id?: string
          protein_per_100g?: number
          quantity_g?: number
          recipe_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_recipe_items_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "foods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_recipe_items_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "saved_recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_recipes: {
        Row: {
          created_at: string
          id: string
          is_favorite: boolean
          name: string
          notes: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_favorite?: boolean
          name: string
          notes?: string | null
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_favorite?: boolean
          name?: string
          notes?: string | null
          user_id?: string
        }
        Relationships: []
      }
      water_intake: {
        Row: {
          amount_ml: number
          created_at: string
          drank_on: string
          id: string
          user_id: string
        }
        Insert: {
          amount_ml: number
          created_at?: string
          drank_on?: string
          id?: string
          user_id?: string
        }
        Update: {
          amount_ml?: number
          created_at?: string
          drank_on?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      workout_exercises: {
        Row: {
          exercise_id: string
          id: string
          notes: string | null
          position: number
          rest_seconds: number
          session_id: string
          user_id: string
        }
        Insert: {
          exercise_id: string
          id?: string
          notes?: string | null
          position?: number
          rest_seconds?: number
          session_id: string
          user_id?: string
        }
        Update: {
          exercise_id?: string
          id?: string
          notes?: string | null
          position?: number
          rest_seconds?: number
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_exercises_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "workout_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_programs: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      workout_sessions: {
        Row: {
          created_at: string
          duration_seconds: number | null
          ended_at: string | null
          id: string
          name: string
          notes: string | null
          program_id: string | null
          scheduled_date: string | null
          started_at: string | null
          status: string
          template_id: string | null
          total_volume_kg: number
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          name: string
          notes?: string | null
          program_id?: string | null
          scheduled_date?: string | null
          started_at?: string | null
          status?: string
          template_id?: string | null
          total_volume_kg?: number
          user_id?: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          name?: string
          notes?: string | null
          program_id?: string | null
          scheduled_date?: string | null
          started_at?: string | null
          status?: string
          template_id?: string | null
          total_volume_kg?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_sessions_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "workout_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_sessions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "workout_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_sets: {
        Row: {
          comment: string | null
          completed: boolean
          created_at: string
          id: string
          reps: number | null
          rir: number | null
          rpe: number | null
          set_number: number
          set_type: string
          user_id: string
          weight_kg: number | null
          workout_exercise_id: string
        }
        Insert: {
          comment?: string | null
          completed?: boolean
          created_at?: string
          id?: string
          reps?: number | null
          rir?: number | null
          rpe?: number | null
          set_number: number
          set_type?: string
          user_id?: string
          weight_kg?: number | null
          workout_exercise_id: string
        }
        Update: {
          comment?: string | null
          completed?: boolean
          created_at?: string
          id?: string
          reps?: number | null
          rir?: number | null
          rpe?: number | null
          set_number?: number
          set_type?: string
          user_id?: string
          weight_kg?: number | null
          workout_exercise_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_sets_workout_exercise_id_fkey"
            columns: ["workout_exercise_id"]
            isOneToOne: false
            referencedRelation: "workout_exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_template_exercises: {
        Row: {
          exercise_id: string
          id: string
          notes: string | null
          position: number
          rest_seconds: number
          target_reps: string | null
          target_sets: number
          target_weight_kg: number | null
          template_id: string
          user_id: string
        }
        Insert: {
          exercise_id: string
          id?: string
          notes?: string | null
          position?: number
          rest_seconds?: number
          target_reps?: string | null
          target_sets?: number
          target_weight_kg?: number | null
          template_id: string
          user_id?: string
        }
        Update: {
          exercise_id?: string
          id?: string
          notes?: string | null
          position?: number
          rest_seconds?: number
          target_reps?: string | null
          target_sets?: number
          target_weight_kg?: number | null
          template_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_template_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_template_exercises_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "workout_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_templates: {
        Row: {
          created_at: string
          id: string
          name: string
          notes: string | null
          position: number
          program_id: string
          user_id: string
          weekdays: number[]
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          position?: number
          program_id: string
          user_id?: string
          weekdays?: number[]
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          position?: number
          program_id?: string
          user_id?: string
          weekdays?: number[]
        }
        Relationships: [
          {
            foreignKeyName: "workout_templates_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "workout_programs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_my_data: { Args: never; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
