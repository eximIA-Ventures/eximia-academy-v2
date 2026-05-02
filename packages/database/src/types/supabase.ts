export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      analyses: {
        Row: {
          ai_detection: Json | null
          created_at: string | null
          flags: Json | null
          id: string
          message_id: string
          metrics: Json | null
          observations: Json | null
          session_id: string
          tenant_id: string
        }
        Insert: {
          ai_detection?: Json | null
          created_at?: string | null
          flags?: Json | null
          id?: string
          message_id: string
          metrics?: Json | null
          observations?: Json | null
          session_id: string
          tenant_id: string
        }
        Update: {
          ai_detection?: Json | null
          created_at?: string | null
          flags?: Json | null
          id?: string
          message_id?: string
          metrics?: Json | null
          observations?: Json | null
          session_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "analyses_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analyses_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analyses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      áreas: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          slug: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          slug: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          slug?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "areas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_history: {
        Row: {
          assessment_type: string
          completed_at: string
          id: string
          result: Json
          tenant_id: string
          user_id: string
        }
        Insert: {
          assessment_type: string
          completed_at?: string
          id?: string
          result: Json
          tenant_id: string
          user_id: string
        }
        Update: {
          assessment_type?: string
          completed_at?: string
          id?: string
          result?: Json
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_history_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      chapters: {
        Row: {
          audio_url: string | null
          content: string | null
          content_blocks: Json | null
          course_id: string
          created_at: string | null
          id: string
          learning_objective: string | null
          order: number
          status: string
          tenant_id: string
          title: string
          updated_at: string | null
          video_url: string | null
        }
        Insert: {
          audio_url?: string | null
          content?: string | null
          content_blocks?: Json | null
          course_id: string
          created_at?: string | null
          id?: string
          learning_objective?: string | null
          order?: number
          status?: string
          tenant_id: string
          title: string
          updated_at?: string | null
          video_url?: string | null
        }
        Update: {
          audio_url?: string | null
          content?: string | null
          content_blocks?: Json | null
          course_id?: string
          created_at?: string | null
          id?: string
          learning_objective?: string | null
          order?: number
          status?: string
          tenant_id?: string
          title?: string
          updated_at?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chapters_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chapters_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      content_ingestions: {
        Row: {
          ai_output: Json | null
          course_id: string | null
          created_at: string | null
          created_by: string
          error_message: string | null
          id: string
          processing_metadata: Json | null
          raw_text: string | null
          source_filename: string | null
          source_size_bytes: number | null
          source_type: string
          source_url: string | null
          status: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          ai_output?: Json | null
          course_id?: string | null
          created_at?: string | null
          created_by: string
          error_message?: string | null
          id?: string
          processing_metadata?: Json | null
          raw_text?: string | null
          source_filename?: string | null
          source_size_bytes?: number | null
          source_type: string
          source_url?: string | null
          status?: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          ai_output?: Json | null
          course_id?: string | null
          created_at?: string | null
          created_by?: string
          error_message?: string | null
          id?: string
          processing_metadata?: Json | null
          raw_text?: string | null
          source_filename?: string | null
          source_size_bytes?: number | null
          source_type?: string
          source_url?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_ingestions_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_ingestions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          área_id: string | null
          cover_image_url: string | null
          created_at: string | null
          created_by: string
          description: string | null
          id: string
          settings: Json | null
          status: string
          tenant_id: string
          title: string
          type: string
          updated_at: string | null
        }
        Insert: {
          área_id?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          created_by: string
          description?: string | null
          id?: string
          settings?: Json | null
          status?: string
          tenant_id: string
          title: string
          type?: string
          updated_at?: string | null
        }
        Update: {
          área_id?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          created_by?: string
          description?: string | null
          id?: string
          settings?: Json | null
          status?: string
          tenant_id?: string
          title?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "courses_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollments: {
        Row: {
          course_id: string
          created_at: string | null
          deleted_at: string | null
          id: string
          progress: Json | null
          status: string
          student_id: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          course_id: string
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          progress?: Json | null
          status?: string
          student_id: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          course_id?: string
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          progress?: Json | null
          status?: string
          student_id?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          created_at: string | null
          id: string
          role: string
          session_id: string
          tenant_id: string
          turn_number: number
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          role: string
          session_id: string
          tenant_id: string
          turn_number?: number
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          role?: string
          session_id?: string
          tenant_id?: string
          turn_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_audit_log: {
        Row: {
          action: string
          actor_id: string
          created_at: string | null
          details: Json | null
          id: string
          target_id: string
          target_type: string
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string | null
          details?: Json | null
          id?: string
          target_id: string
          target_type: string
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          target_id?: string
          target_type?: string
        }
        Relationships: []
      }
      qa_reports: {
        Row: {
          created_at: string | null
          criteria_results: Json | null
          id: string
          message_id: string
          recommendation: string | null
          score: number | null
          session_id: string
          tenant_id: string
          verdict: string | null
        }
        Insert: {
          created_at?: string | null
          criteria_results?: Json | null
          id?: string
          message_id: string
          recommendation?: string | null
          score?: number | null
          session_id: string
          tenant_id: string
          verdict?: string | null
        }
        Update: {
          created_at?: string | null
          criteria_results?: Json | null
          id?: string
          message_id?: string
          recommendation?: string | null
          score?: number | null
          session_id?: string
          tenant_id?: string
          verdict?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "qa_reports_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qa_reports_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qa_reports_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      questions: {
        Row: {
          chapter_id: string
          created_at: string | null
          expected_depth: string | null
          id: string
          intention: string | null
          skill: string | null
          status: string
          tenant_id: string
          text: string
          updated_at: string | null
        }
        Insert: {
          chapter_id: string
          created_at?: string | null
          expected_depth?: string | null
          id?: string
          intention?: string | null
          skill?: string | null
          status?: string
          tenant_id: string
          text: string
          updated_at?: string | null
        }
        Update: {
          chapter_id?: string
          created_at?: string | null
          expected_depth?: string | null
          id?: string
          intention?: string | null
          skill?: string | null
          status?: string
          tenant_id?: string
          text?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "questions_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          chapter_id: string
          completed_at: string | null
          created_at: string | null
          id: string
          interactions_remaining: number
          question_id: string
          status: string
          student_id: string | null
          tenant_id: string
          turn_number: number
          updated_at: string | null
        }
        Insert: {
          chapter_id: string
          completed_at?: string | null
          created_at?: string | null
          id?: string
          interactions_remaining?: number
          question_id: string
          status?: string
          student_id?: string | null
          tenant_id: string
          turn_number?: number
          updated_at?: string | null
        }
        Update: {
          chapter_id?: string
          completed_at?: string | null
          created_at?: string | null
          id?: string
          interactions_remaining?: number
          question_id?: string
          status?: string
          student_id?: string | null
          tenant_id?: string
          turn_number?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sessions_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          branding: Json | null
          created_at: string | null
          id: string
          name: string
          plan: string | null
          settings: Json | null
          slug: string
          status: string | null
          updated_at: string | null
          whitelabel_config: Json | null
          whitelabel_enabled: boolean | null
        }
        Insert: {
          branding?: Json | null
          created_at?: string | null
          id?: string
          name: string
          plan?: string | null
          settings?: Json | null
          slug: string
          status?: string | null
          updated_at?: string | null
          whitelabel_config?: Json | null
          whitelabel_enabled?: boolean | null
        }
        Update: {
          branding?: Json | null
          created_at?: string | null
          id?: string
          name?: string
          plan?: string | null
          settings?: Json | null
          slug?: string
          status?: string | null
          updated_at?: string | null
          whitelabel_config?: Json | null
          whitelabel_enabled?: boolean | null
        }
        Relationships: []
      }
      user_areas: {
        Row: {
          área_id: string
          created_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          área_id: string
          created_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          área_id?: string
          created_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_areas_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_areas_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          email: string
          full_name: string
          id: string
          learning_mode: string | null
          onboarding_completed: boolean | null
          profile: Json | null
          role: string
          status: string
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          email: string
          full_name: string
          id: string
          learning_mode?: string | null
          onboarding_completed?: boolean | null
          profile?: Json | null
          role: string
          status?: string
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          email?: string
          full_name?: string
          id?: string
          learning_mode?: string | null
          onboarding_completed?: boolean | null
          profile?: Json | null
          role?: string
          status?: string
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      auth_tenant_id: { Args: never; Returns: string }
      auth_user_area_ids: { Args: never; Returns: string[] }
      auth_user_role: { Args: never; Returns: string }
      claim_session_turn: {
        Args: { p_session_id: string; p_user_id: string }
        Returns: {
          chapter_id: string
          interactions_remaining: number
          question_id: string
          session_id: string
          tenant_id: string
          turn_number: number
        }[]
      }
      get_random_active_question: {
        Args: { p_chapter_id: string }
        Returns: {
          expected_depth: string
          id: string
          intention: string
          skill: string
          text: string
        }[]
      }
      is_super_admin: { Args: never; Returns: boolean }
      jsonb_profile_merge: {
        Args: {
          p_remove_key?: string
          p_set_key: string
          p_set_value: string
          p_user_id: string
        }
        Returns: undefined
      }
      lgpd_soft_delete_user: { Args: { p_user_id: string }; Returns: string }
      release_session_turn: {
        Args: { p_session_id: string; p_user_id: string }
        Returns: undefined
      }
      swap_onboarding_course: {
        Args: { p_new_course_id: string; p_tenant_id: string }
        Returns: undefined
      }
      update_enrollment_progress: {
        Args: { p_course_id: string; p_student_id: string }
        Returns: {
          enrollment_id: string
          new_progress: number
          new_status: string
        }[]
      }
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
