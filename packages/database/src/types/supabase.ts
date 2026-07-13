export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
      api_key_usage_log: {
        Row: {
          api_key_id: string
          created_at: string | null
          id: string
          ip_address: string | null
          method: string
          path: string
          response_time_ms: number | null
          status_code: number
          tenant_id: string
          user_agent: string | null
        }
        Insert: {
          api_key_id: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          method: string
          path: string
          response_time_ms?: number | null
          status_code: number
          tenant_id: string
          user_agent?: string | null
        }
        Update: {
          api_key_id?: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          method?: string
          path?: string
          response_time_ms?: number | null
          status_code?: number
          tenant_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_key_usage_log_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_key_usage_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          cors_origins: string[] | null
          created_at: string | null
          created_by: string
          expires_at: string | null
          id: string
          is_active: boolean | null
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          rate_limit_rpd: number | null
          rate_limit_rpm: number | null
          scopes: string[]
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          cors_origins?: string[] | null
          created_at?: string | null
          created_by: string
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          rate_limit_rpd?: number | null
          rate_limit_rpm?: number | null
          scopes?: string[]
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          cors_origins?: string[] | null
          created_at?: string | null
          created_by?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          rate_limit_rpd?: number | null
          rate_limit_rpm?: number | null
          scopes?: string[]
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_keys_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      areas: {
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
      assignment_submissions: {
        Row: {
          chapter_id: string
          content: string
          created_at: string
          evaluated_at: string | null
          evaluation: Json | null
          grade: string | null
          id: string
          overall_score: number | null
          status: string
          student_id: string
          submitted_at: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          chapter_id: string
          content?: string
          created_at?: string
          evaluated_at?: string | null
          evaluation?: Json | null
          grade?: string | null
          id?: string
          overall_score?: number | null
          status?: string
          student_id: string
          submitted_at?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          chapter_id?: string
          content?: string
          created_at?: string
          evaluated_at?: string | null
          evaluation?: Json | null
          grade?: string | null
          id?: string
          overall_score?: number | null
          status?: string
          student_id?: string
          submitted_at?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignment_submissions_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_submissions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      blueprint_assessments: {
        Row: {
          assessment_type: string
          blueprint_id: string
          created_at: string | null
          estimated_duration_min: number | null
          format: string | null
          id: string
          kirkpatrick_level: number | null
          module_id: string | null
          objective_id: string
          rubric_required: boolean | null
          rubrics: Json | null
          timing: string
        }
        Insert: {
          assessment_type: string
          blueprint_id: string
          created_at?: string | null
          estimated_duration_min?: number | null
          format?: string | null
          id?: string
          kirkpatrick_level?: number | null
          module_id?: string | null
          objective_id: string
          rubric_required?: boolean | null
          rubrics?: Json | null
          timing: string
        }
        Update: {
          assessment_type?: string
          blueprint_id?: string
          created_at?: string | null
          estimated_duration_min?: number | null
          format?: string | null
          id?: string
          kirkpatrick_level?: number | null
          module_id?: string | null
          objective_id?: string
          rubric_required?: boolean | null
          rubrics?: Json | null
          timing?: string
        }
        Relationships: [
          {
            foreignKeyName: "blueprint_assessments_blueprint_id_fkey"
            columns: ["blueprint_id"]
            isOneToOne: false
            referencedRelation: "course_blueprints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blueprint_assessments_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "blueprint_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      blueprint_generation_jobs: {
        Row: {
          blueprint_id: string | null
          completed_at: string | null
          course_id: string | null
          created_at: string | null
          current_phase: number | null
          error_message: string | null
          id: string
          phase_results: Json | null
          progress: Json | null
          requested_by: string
          started_at: string | null
          status: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          blueprint_id?: string | null
          completed_at?: string | null
          course_id?: string | null
          created_at?: string | null
          current_phase?: number | null
          error_message?: string | null
          id?: string
          phase_results?: Json | null
          progress?: Json | null
          requested_by: string
          started_at?: string | null
          status?: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          blueprint_id?: string | null
          completed_at?: string | null
          course_id?: string | null
          created_at?: string | null
          current_phase?: number | null
          error_message?: string | null
          id?: string
          phase_results?: Json | null
          progress?: Json | null
          requested_by?: string
          started_at?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blueprint_generation_jobs_blueprint_id_fkey"
            columns: ["blueprint_id"]
            isOneToOne: false
            referencedRelation: "course_blueprints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blueprint_generation_jobs_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      blueprint_modules: {
        Row: {
          blueprint_id: string
          chunks: Json | null
          cognitive_load: Json | null
          created_at: string | null
          description: string | null
          duration_minutes: number | null
          framework_stages: Json
          id: string
          interaction_type: string | null
          order: number
          problema_motor: Json | null
          rubrics: Json | null
          spiral_level: number | null
          tenant_id: string
          title: string
        }
        Insert: {
          blueprint_id: string
          chunks?: Json | null
          cognitive_load?: Json | null
          created_at?: string | null
          description?: string | null
          duration_minutes?: number | null
          framework_stages?: Json
          id?: string
          interaction_type?: string | null
          order: number
          problema_motor?: Json | null
          rubrics?: Json | null
          spiral_level?: number | null
          tenant_id: string
          title: string
        }
        Update: {
          blueprint_id?: string
          chunks?: Json | null
          cognitive_load?: Json | null
          created_at?: string | null
          description?: string | null
          duration_minutes?: number | null
          framework_stages?: Json
          id?: string
          interaction_type?: string | null
          order?: number
          problema_motor?: Json | null
          rubrics?: Json | null
          spiral_level?: number | null
          tenant_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "blueprint_modules_blueprint_id_fkey"
            columns: ["blueprint_id"]
            isOneToOne: false
            referencedRelation: "course_blueprints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blueprint_modules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      blueprint_objectives: {
        Row: {
          abcd: Json | null
          behavior: string
          bloom_level: string
          blueprint_id: string
          condition: string
          created_at: string | null
          degree: string
          id: string
          module_id: string | null
          module_number: number
          objective_id: string
          objective_statement: string
        }
        Insert: {
          abcd?: Json | null
          behavior: string
          bloom_level: string
          blueprint_id: string
          condition: string
          created_at?: string | null
          degree: string
          id?: string
          module_id?: string | null
          module_number: number
          objective_id: string
          objective_statement: string
        }
        Update: {
          abcd?: Json | null
          behavior?: string
          bloom_level?: string
          blueprint_id?: string
          condition?: string
          created_at?: string | null
          degree?: string
          id?: string
          module_id?: string | null
          module_number?: number
          objective_id?: string
          objective_statement?: string
        }
        Relationships: [
          {
            foreignKeyName: "blueprint_objectives_blueprint_id_fkey"
            columns: ["blueprint_id"]
            isOneToOne: false
            referencedRelation: "course_blueprints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blueprint_objectives_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "blueprint_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      book_chapters: {
        Row: {
          book_id: string
          chapter_order: number
          content: string
          content_type: string
          created_at: string
          id: string
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          book_id: string
          chapter_order?: number
          content?: string
          content_type?: string
          created_at?: string
          id?: string
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          book_id?: string
          chapter_order?: number
          content?: string
          content_type?: string
          created_at?: string
          id?: string
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "book_chapters_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_chapters_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      books: {
        Row: {
          author: string
          author_bio: string | null
          category: string
          cover_color: string | null
          cover_url: string | null
          created_at: string
          created_by: string
          description: string | null
          file_url: string | null
          id: string
          pages: number | null
          processing_error: string | null
          processing_status: string
          rating: number
          synopsis: string | null
          tags: string[]
          tenant_id: string
          title: string
          updated_at: string
          year: number | null
        }
        Insert: {
          author: string
          author_bio?: string | null
          category?: string
          cover_color?: string | null
          cover_url?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          file_url?: string | null
          id?: string
          pages?: number | null
          processing_error?: string | null
          processing_status?: string
          rating?: number
          synopsis?: string | null
          tags?: string[]
          tenant_id: string
          title: string
          updated_at?: string
          year?: number | null
        }
        Update: {
          author?: string
          author_bio?: string | null
          category?: string
          cover_color?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          file_url?: string | null
          id?: string
          pages?: number | null
          processing_error?: string | null
          processing_status?: string
          rating?: number
          synopsis?: string | null
          tags?: string[]
          tenant_id?: string
          title?: string
          updated_at?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "books_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      certificates: {
        Row: {
          course_id: string
          course_title: string
          created_at: string
          enrollment_id: string | null
          id: string
          instructor_name: string | null
          issued_at: string
          pdf_path: string | null
          student_name: string
          tenant_id: string
          user_id: string
          verification_code: string
          workload_hours: number | null
        }
        Insert: {
          course_id: string
          course_title: string
          created_at?: string
          enrollment_id?: string | null
          id?: string
          instructor_name?: string | null
          issued_at?: string
          pdf_path?: string | null
          student_name: string
          tenant_id: string
          user_id: string
          verification_code?: string
          workload_hours?: number | null
        }
        Update: {
          course_id?: string
          course_title?: string
          created_at?: string
          enrollment_id?: string | null
          id?: string
          instructor_name?: string | null
          issued_at?: string
          pdf_path?: string | null
          student_name?: string
          tenant_id?: string
          user_id?: string
          verification_code?: string
          workload_hours?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "certificates_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: true
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      chapter_slides: {
        Row: {
          audio_end_ms: number | null
          audio_start_ms: number | null
          chapter_id: string
          created_at: string | null
          id: string
          image_storage_path: string | null
          image_url: string | null
          metadata: Json | null
          order: number
          tenant_id: string
          text_content: string | null
          text_status: string | null
          updated_at: string | null
        }
        Insert: {
          audio_end_ms?: number | null
          audio_start_ms?: number | null
          chapter_id: string
          created_at?: string | null
          id?: string
          image_storage_path?: string | null
          image_url?: string | null
          metadata?: Json | null
          order?: number
          tenant_id: string
          text_content?: string | null
          text_status?: string | null
          updated_at?: string | null
        }
        Update: {
          audio_end_ms?: number | null
          audio_start_ms?: number | null
          chapter_id?: string
          created_at?: string | null
          id?: string
          image_storage_path?: string | null
          image_url?: string | null
          metadata?: Json | null
          order?: number
          tenant_id?: string
          text_content?: string | null
          text_status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chapter_slides_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chapter_slides_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      chapters: {
        Row: {
          audio_url: string | null
          bloom_target: string | null
          content: string | null
          content_blocks: Json | null
          course_id: string
          created_at: string | null
          created_by: string | null
          estimated_duration_minutes: number | null
          estimated_reading_time_min: number | null
          id: string
          interaction_config: Json | null
          interaction_type: string | null
          key_concepts: string[] | null
          learning_objective: string | null
          order: number
          slide_audio_url: string | null
          status: string
          tenant_id: string
          title: string
          updated_at: string | null
          video_url: string | null
        }
        Insert: {
          audio_url?: string | null
          bloom_target?: string | null
          content?: string | null
          content_blocks?: Json | null
          course_id: string
          created_at?: string | null
          created_by?: string | null
          estimated_duration_minutes?: number | null
          estimated_reading_time_min?: number | null
          id?: string
          interaction_config?: Json | null
          interaction_type?: string | null
          key_concepts?: string[] | null
          learning_objective?: string | null
          order?: number
          slide_audio_url?: string | null
          status?: string
          tenant_id: string
          title: string
          updated_at?: string | null
          video_url?: string | null
        }
        Update: {
          audio_url?: string | null
          bloom_target?: string | null
          content?: string | null
          content_blocks?: Json | null
          course_id?: string
          created_at?: string | null
          created_by?: string | null
          estimated_duration_minutes?: number | null
          estimated_reading_time_min?: number | null
          id?: string
          interaction_config?: Json | null
          interaction_type?: string | null
          key_concepts?: string[] | null
          learning_objective?: string | null
          order?: number
          slide_audio_url?: string | null
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
            foreignKeyName: "chapters_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
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
      consciousness_responses: {
        Row: {
          challenge_text: string | null
          commitment: string | null
          course_id: string
          created_at: string | null
          enrollment_id: string
          id: string
          learning_goal: string | null
          phase: string
          rating_change: number | null
          self_rating: number | null
          student_id: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          challenge_text?: string | null
          commitment?: string | null
          course_id: string
          created_at?: string | null
          enrollment_id: string
          id?: string
          learning_goal?: string | null
          phase: string
          rating_change?: number | null
          self_rating?: number | null
          student_id: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          challenge_text?: string | null
          commitment?: string | null
          course_id?: string
          created_at?: string | null
          enrollment_id?: string
          id?: string
          learning_goal?: string | null
          phase?: string
          rating_change?: number | null
          self_rating?: number | null
          student_id?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consciousness_responses_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consciousness_responses_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consciousness_responses_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consciousness_responses_tenant_id_fkey"
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
      course_areas: {
        Row: {
          area_id: string
          course_id: string
          created_at: string
          id: string
          tenant_id: string
        }
        Insert: {
          area_id: string
          course_id: string
          created_at?: string
          id?: string
          tenant_id: string
        }
        Update: {
          area_id?: string
          course_id?: string
          created_at?: string
          id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_areas_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_areas_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_areas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      course_blueprints: {
        Row: {
          applied_at: string | null
          applied_to_course: boolean | null
          approved_at: string | null
          approved_by: string | null
          audience_profile: Json | null
          bloom_progression: string[] | null
          blueprint_data: Json
          complementary_frameworks: string[] | null
          course_id: string | null
          created_at: string | null
          evaluation_plan: Json | null
          framework: string
          generated_at: string | null
          id: string
          interaction_strategy: string | null
          neuroscience_score: number | null
          primary_framework: string | null
          quality_score: number | null
          quality_verdict: string | null
          source_course_id: string | null
          status: string
          tenant_id: string
          total_assessments: number
          total_objectives: number
          updated_at: string | null
          version: string | null
        }
        Insert: {
          applied_at?: string | null
          applied_to_course?: boolean | null
          approved_at?: string | null
          approved_by?: string | null
          audience_profile?: Json | null
          bloom_progression?: string[] | null
          blueprint_data: Json
          complementary_frameworks?: string[] | null
          course_id?: string | null
          created_at?: string | null
          evaluation_plan?: Json | null
          framework: string
          generated_at?: string | null
          id?: string
          interaction_strategy?: string | null
          neuroscience_score?: number | null
          primary_framework?: string | null
          quality_score?: number | null
          quality_verdict?: string | null
          source_course_id?: string | null
          status?: string
          tenant_id: string
          total_assessments: number
          total_objectives: number
          updated_at?: string | null
          version?: string | null
        }
        Update: {
          applied_at?: string | null
          applied_to_course?: boolean | null
          approved_at?: string | null
          approved_by?: string | null
          audience_profile?: Json | null
          bloom_progression?: string[] | null
          blueprint_data?: Json
          complementary_frameworks?: string[] | null
          course_id?: string | null
          created_at?: string | null
          evaluation_plan?: Json | null
          framework?: string
          generated_at?: string | null
          id?: string
          interaction_strategy?: string | null
          neuroscience_score?: number | null
          primary_framework?: string | null
          quality_score?: number | null
          quality_verdict?: string | null
          source_course_id?: string | null
          status?: string
          tenant_id?: string
          total_assessments?: number
          total_objectives?: number
          updated_at?: string | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_blueprints_source_course_id_fkey"
            columns: ["source_course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          area_id: string | null
          cover_image_url: string | null
          created_at: string | null
          created_by: string
          deadline_days: number | null
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
          area_id?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          created_by: string
          deadline_days?: number | null
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
          area_id?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          created_by?: string
          deadline_days?: number | null
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
      email_notifications: {
        Row: {
          body: string
          course_id: string | null
          created_at: string
          deadline: string | null
          id: string
          recipient_count: number
          recipients: Json
          resend_batch_id: string | null
          sender_id: string
          sent_at: string | null
          status: string
          subject: string
          tenant_id: string
          trail_id: string | null
        }
        Insert: {
          body: string
          course_id?: string | null
          created_at?: string
          deadline?: string | null
          id?: string
          recipient_count?: number
          recipients?: Json
          resend_batch_id?: string | null
          sender_id: string
          sent_at?: string | null
          status?: string
          subject: string
          tenant_id: string
          trail_id?: string | null
        }
        Update: {
          body?: string
          course_id?: string | null
          created_at?: string
          deadline?: string | null
          id?: string
          recipient_count?: number
          recipients?: Json
          resend_batch_id?: string | null
          sender_id?: string
          sent_at?: string | null
          status?: string
          subject?: string
          tenant_id?: string
          trail_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_notifications_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_notifications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_notifications_trail_id_fkey"
            columns: ["trail_id"]
            isOneToOne: false
            referencedRelation: "learning_trails"
            referencedColumns: ["id"]
          },
        ]
      }
      enrichment_jobs: {
        Row: {
          course_id: string
          created_at: string | null
          error_message: string | null
          id: string
          progress: Json | null
          sources_approved: number | null
          sources_rejected: number | null
          status: string
          tenant_id: string
          total_sources_found: number | null
          triggered_by: string
          updated_at: string | null
        }
        Insert: {
          course_id: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          progress?: Json | null
          sources_approved?: number | null
          sources_rejected?: number | null
          status?: string
          tenant_id: string
          total_sources_found?: number | null
          triggered_by: string
          updated_at?: string | null
        }
        Update: {
          course_id?: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          progress?: Json | null
          sources_approved?: number | null
          sources_rejected?: number | null
          status?: string
          tenant_id?: string
          total_sources_found?: number | null
          triggered_by?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enrichment_jobs_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrichment_jobs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      enrichment_sources: {
        Row: {
          action: string | null
          ai_rationale: string | null
          applied_at: string | null
          chapter_id: string
          created_at: string | null
          id: string
          job_id: string
          relevance_score: number | null
          search_query: string | null
          snippet: string | null
          status: string
          tenant_id: string
          title: string
          updated_at: string | null
          url: string
        }
        Insert: {
          action?: string | null
          ai_rationale?: string | null
          applied_at?: string | null
          chapter_id: string
          created_at?: string | null
          id?: string
          job_id: string
          relevance_score?: number | null
          search_query?: string | null
          snippet?: string | null
          status?: string
          tenant_id: string
          title: string
          updated_at?: string | null
          url: string
        }
        Update: {
          action?: string | null
          ai_rationale?: string | null
          applied_at?: string | null
          chapter_id?: string
          created_at?: string | null
          id?: string
          job_id?: string
          relevance_score?: number | null
          search_query?: string | null
          snippet?: string | null
          status?: string
          tenant_id?: string
          title?: string
          updated_at?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrichment_sources_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrichment_sources_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "enrichment_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrichment_sources_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollments: {
        Row: {
          area_id: string | null
          course_id: string
          created_at: string | null
          deleted_at: string | null
          id: string
          progress: Json | null
          status: string
          student_id: string
          tenant_id: string
          trail_course_order: number | null
          trail_id: string | null
          updated_at: string | null
        }
        Insert: {
          area_id?: string | null
          course_id: string
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          progress?: Json | null
          status?: string
          student_id: string
          tenant_id: string
          trail_course_order?: number | null
          trail_id?: string | null
          updated_at?: string | null
        }
        Update: {
          area_id?: string | null
          course_id?: string
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          progress?: Json | null
          status?: string
          student_id?: string
          tenant_id?: string
          trail_course_order?: number | null
          trail_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
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
          {
            foreignKeyName: "enrollments_trail_id_fkey"
            columns: ["trail_id"]
            isOneToOne: false
            referencedRelation: "learning_trails"
            referencedColumns: ["id"]
          },
        ]
      }
      instructor_permissions: {
        Row: {
          assigned_area_ids: string[] | null
          can_create_courses: boolean
          can_create_quizzes: boolean
          can_manage_enrollments: boolean
          can_manage_trails: boolean
          can_view_analytics: boolean
          created_at: string
          id: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          assigned_area_ids?: string[] | null
          can_create_courses?: boolean
          can_create_quizzes?: boolean
          can_manage_enrollments?: boolean
          can_manage_trails?: boolean
          can_view_analytics?: boolean
          created_at?: string
          id?: string
          tenant_id: string
          user_id: string
        }
        Update: {
          assigned_area_ids?: string[] | null
          can_create_courses?: boolean
          can_create_quizzes?: boolean
          can_manage_enrollments?: boolean
          can_manage_trails?: boolean
          can_view_analytics?: boolean
          created_at?: string
          id?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "instructor_permissions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instructor_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_keys: {
        Row: {
          app_name: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          key_hash: string
          key_prefix: string
          last_used: string | null
          scopes: string[] | null
          status: string
          tenant_id: string | null
        }
        Insert: {
          app_name: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          key_hash: string
          key_prefix: string
          last_used?: string | null
          scopes?: string[] | null
          status?: string
          tenant_id?: string | null
        }
        Update: {
          app_name?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          key_hash?: string
          key_prefix?: string
          last_used?: string | null
          scopes?: string[] | null
          status?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integration_keys_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_keys_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_logs: {
        Row: {
          created_at: string
          direction: string
          duration_ms: number
          endpoint: string
          entity: string | null
          id: string
          method: string
          remote_app: string | null
          status_code: number
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          direction: string
          duration_ms: number
          endpoint: string
          entity?: string | null
          id?: string
          method: string
          remote_app?: string | null
          status_code: number
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          direction?: string
          duration_ms?: number
          endpoint?: string
          entity?: string | null
          id?: string
          method?: string
          remote_app?: string | null
          status_code?: number
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integration_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_outbound: {
        Row: {
          api_key_encrypted: string
          catalog_cache: Json | null
          created_at: string
          created_by: string | null
          entities: string[] | null
          id: string
          last_error: string | null
          last_sync: string | null
          remote_app: string
          remote_url: string
          status: string
          tenant_id: string | null
        }
        Insert: {
          api_key_encrypted: string
          catalog_cache?: Json | null
          created_at?: string
          created_by?: string | null
          entities?: string[] | null
          id?: string
          last_error?: string | null
          last_sync?: string | null
          remote_app: string
          remote_url: string
          status?: string
          tenant_id?: string | null
        }
        Update: {
          api_key_encrypted?: string
          catalog_cache?: Json | null
          created_at?: string
          created_by?: string | null
          entities?: string[] | null
          id?: string
          last_error?: string | null
          last_sync?: string | null
          remote_app?: string
          remote_url?: string
          status?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integration_outbound_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_outbound_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      job_roles: {
        Row: {
          area_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          seniority_level: string
          slug: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          area_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          seniority_level?: string
          slug: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          area_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          seniority_level?: string
          slug?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_roles_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_roles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      leader_comments: {
        Row: {
          comment: string
          created_at: string
          id: string
          leader_id: string
          reflection_id: string
          tenant_id: string
        }
        Insert: {
          comment: string
          created_at?: string
          id?: string
          leader_id: string
          reflection_id: string
          tenant_id: string
        }
        Update: {
          comment?: string
          created_at?: string
          id?: string
          leader_id?: string
          reflection_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leader_comments_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leader_comments_reflection_id_fkey"
            columns: ["reflection_id"]
            isOneToOne: false
            referencedRelation: "slide_reflections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leader_comments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      learner_profiles: {
        Row: {
          adaptation_hints: string[] | null
          avg_depth_achieved: number | null
          avg_qa_score: number | null
          comprehension_trend: string | null
          confidence: number | null
          created_at: string | null
          detail_orientation: string | null
          engagement_style: string | null
          growth_areas: string[] | null
          id: string
          kolb_dominant_style: string | null
          kolb_grasping_axis: number | null
          kolb_style_confidence: number | null
          kolb_transforming_axis: number | null
          preferred_question_types: string[] | null
          reasoning_style: string | null
          session_count: number | null
          strengths: string[] | null
          student_id: string
          summary: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          adaptation_hints?: string[] | null
          avg_depth_achieved?: number | null
          avg_qa_score?: number | null
          comprehension_trend?: string | null
          confidence?: number | null
          created_at?: string | null
          detail_orientation?: string | null
          engagement_style?: string | null
          growth_areas?: string[] | null
          id?: string
          kolb_dominant_style?: string | null
          kolb_grasping_axis?: number | null
          kolb_style_confidence?: number | null
          kolb_transforming_axis?: number | null
          preferred_question_types?: string[] | null
          reasoning_style?: string | null
          session_count?: number | null
          strengths?: string[] | null
          student_id: string
          summary?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          adaptation_hints?: string[] | null
          avg_depth_achieved?: number | null
          avg_qa_score?: number | null
          comprehension_trend?: string | null
          confidence?: number | null
          created_at?: string | null
          detail_orientation?: string | null
          engagement_style?: string | null
          growth_areas?: string[] | null
          id?: string
          kolb_dominant_style?: string | null
          kolb_grasping_axis?: number | null
          kolb_style_confidence?: number | null
          kolb_transforming_axis?: number | null
          preferred_question_types?: string[] | null
          reasoning_style?: string | null
          session_count?: number | null
          strengths?: string[] | null
          student_id?: string
          summary?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "learner_profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_trails: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          estimated_hours: number | null
          id: string
          is_mandatory: boolean
          is_sequential: boolean
          status: string
          target_job_role_id: string | null
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          estimated_hours?: number | null
          id?: string
          is_mandatory?: boolean
          is_sequential?: boolean
          status?: string
          target_job_role_id?: string | null
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          estimated_hours?: number | null
          id?: string
          is_mandatory?: boolean
          is_sequential?: boolean
          status?: string
          target_job_role_id?: string | null
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_trails_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_trails_target_job_role_id_fkey"
            columns: ["target_job_role_id"]
            isOneToOne: false
            referencedRelation: "job_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_trails_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      live_events: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          ended_at: string | null
          host_name: string
          id: string
          max_participants: number | null
          meeting_url: string | null
          recording_url: string | null
          scheduled_at: string
          started_at: string | null
          status: string
          tags: string[] | null
          tenant_id: string
          thumbnail_url: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          ended_at?: string | null
          host_name: string
          id?: string
          max_participants?: number | null
          meeting_url?: string | null
          recording_url?: string | null
          scheduled_at: string
          started_at?: string | null
          status?: string
          tags?: string[] | null
          tenant_id: string
          thumbnail_url?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          ended_at?: string | null
          host_name?: string
          id?: string
          max_participants?: number | null
          meeting_url?: string | null
          recording_url?: string | null
          scheduled_at?: string
          started_at?: string | null
          status?: string
          tags?: string[] | null
          tenant_id?: string
          thumbnail_url?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "live_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      live_registrations: {
        Row: {
          attended: boolean
          id: string
          live_event_id: string
          registered_at: string | null
          tenant_id: string
          user_id: string
        }
        Insert: {
          attended?: boolean
          id?: string
          live_event_id: string
          registered_at?: string | null
          tenant_id: string
          user_id: string
        }
        Update: {
          attended?: boolean
          id?: string
          live_event_id?: string
          registered_at?: string | null
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_registrations_live_event_id_fkey"
            columns: ["live_event_id"]
            isOneToOne: false
            referencedRelation: "live_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_registrations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_registrations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      manager_group_members: {
        Row: {
          added_by: string | null
          created_at: string
          group_id: string
          id: string
          student_id: string
          tenant_id: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          group_id: string
          id?: string
          student_id: string
          tenant_id: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          group_id?: string
          id?: string
          student_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "manager_group_members_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manager_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "manager_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manager_group_members_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manager_group_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      manager_group_units: {
        Row: {
          created_at: string
          group_id: string
          id: string
          tenant_id: string
          unit_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          tenant_id: string
          unit_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          tenant_id?: string
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "manager_group_units_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "manager_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manager_group_units_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manager_group_units_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
        ]
      }
      manager_groups: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_corporate: boolean
          manager_id: string | null
          name: string
          slug: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_corporate?: boolean
          manager_id?: string | null
          name: string
          slug: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_corporate?: boolean
          manager_id?: string | null
          name?: string
          slug?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "manager_groups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manager_groups_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manager_groups_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      materials: {
        Row: {
          created_at: string
          created_by: string
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          tenant_id: string
          title: string
        }
        Insert: {
          created_at?: string
          created_by: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          tenant_id: string
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          tenant_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "materials_tenant_id_fkey"
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
      notification_audiences: {
        Row: {
          created_at: string
          created_by: string | null
          criteria: Json
          id: string
          name: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          criteria?: Json
          id?: string
          name: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          criteria?: Json
          id?: string
          name?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_audiences_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_audiences_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_templates: {
        Row: {
          body_inapp: string | null
          category: string
          channel_email: boolean
          channel_inapp: boolean
          created_at: string
          created_by: string | null
          email_html: string | null
          email_subject: string | null
          id: string
          is_active: boolean
          key: string
          name: string
          tenant_id: string
          title: string
          updated_at: string
          variables: Json
        }
        Insert: {
          body_inapp?: string | null
          category?: string
          channel_email?: boolean
          channel_inapp?: boolean
          created_at?: string
          created_by?: string | null
          email_html?: string | null
          email_subject?: string | null
          id?: string
          is_active?: boolean
          key: string
          name: string
          tenant_id: string
          title: string
          updated_at?: string
          variables?: Json
        }
        Update: {
          body_inapp?: string | null
          category?: string
          channel_email?: boolean
          channel_inapp?: boolean
          created_at?: string
          created_by?: string | null
          email_html?: string | null
          email_subject?: string | null
          id?: string
          is_active?: boolean
          key?: string
          name?: string
          tenant_id?: string
          title?: string
          updated_at?: string
          variables?: Json
        }
        Relationships: [
          {
            foreignKeyName: "notification_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          acted_at: string | null
          body: string | null
          channel: string
          context: Json
          created_at: string
          cta_url: string | null
          id: string
          origin: string
          read_at: string | null
          recipient_id: string
          returned_at: string | null
          sent_at: string | null
          status: string
          template_id: string | null
          tenant_id: string
          title: string
        }
        Insert: {
          acted_at?: string | null
          body?: string | null
          channel?: string
          context?: Json
          created_at?: string
          cta_url?: string | null
          id?: string
          origin?: string
          read_at?: string | null
          recipient_id: string
          returned_at?: string | null
          sent_at?: string | null
          status?: string
          template_id?: string | null
          tenant_id: string
          title: string
        }
        Update: {
          acted_at?: string | null
          body?: string | null
          channel?: string
          context?: Json
          created_at?: string
          cta_url?: string | null
          id?: string
          origin?: string
          read_at?: string | null
          recipient_id?: string
          returned_at?: string | null
          sent_at?: string | null
          status?: string
          template_id?: string | null
          tenant_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "notification_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      nudge_suggestions: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          id: string
          rationale: string | null
          status: string
          suggested_at: string
          target_student_ids: Json
          template_key: string | null
          tenant_id: string
          type: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          id?: string
          rationale?: string | null
          status?: string
          suggested_at?: string
          target_student_ids?: Json
          template_key?: string | null
          tenant_id: string
          type: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          id?: string
          rationale?: string | null
          status?: string
          suggested_at?: string
          target_student_ids?: Json
          template_key?: string | null
          tenant_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "nudge_suggestions_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nudge_suggestions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_features: {
        Row: {
          created_at: string
          feature_key: string
          id: string
          is_enabled: boolean
          plan: string
          quota: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          feature_key: string
          id?: string
          is_enabled?: boolean
          plan: string
          quota?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          feature_key?: string
          id?: string
          is_enabled?: boolean
          plan?: string
          quota?: number | null
          updated_at?: string
        }
        Relationships: []
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
      question_generation_jobs: {
        Row: {
          chapter_ids: string[] | null
          course_id: string
          created_at: string | null
          error_message: string | null
          id: string
          progress: Json | null
          questions_approved: number | null
          questions_generated: number | null
          questions_rejected: number | null
          scope: string
          status: string
          tenant_id: string
          triggered_by: string
          updated_at: string | null
        }
        Insert: {
          chapter_ids?: string[] | null
          course_id: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          progress?: Json | null
          questions_approved?: number | null
          questions_generated?: number | null
          questions_rejected?: number | null
          scope?: string
          status?: string
          tenant_id: string
          triggered_by: string
          updated_at?: string | null
        }
        Update: {
          chapter_ids?: string[] | null
          course_id?: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          progress?: Json | null
          questions_approved?: number | null
          questions_generated?: number | null
          questions_rejected?: number | null
          scope?: string
          status?: string
          tenant_id?: string
          triggered_by?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "question_generation_jobs_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_generation_jobs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_generation_jobs_triggered_by_fkey"
            columns: ["triggered_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      questions: {
        Row: {
          chapter_id: string
          correct_answer: string | null
          correct_option_id: string | null
          created_at: string | null
          expected_depth: string | null
          explanation: string | null
          id: string
          intention: string | null
          job_id: string | null
          options: Json | null
          question_type: string
          skill: string | null
          status: string
          tenant_id: string
          text: string
          updated_at: string | null
        }
        Insert: {
          chapter_id: string
          correct_answer?: string | null
          correct_option_id?: string | null
          created_at?: string | null
          expected_depth?: string | null
          explanation?: string | null
          id?: string
          intention?: string | null
          job_id?: string | null
          options?: Json | null
          question_type?: string
          skill?: string | null
          status?: string
          tenant_id: string
          text: string
          updated_at?: string | null
        }
        Update: {
          chapter_id?: string
          correct_answer?: string | null
          correct_option_id?: string | null
          created_at?: string | null
          expected_depth?: string | null
          explanation?: string | null
          id?: string
          intention?: string | null
          job_id?: string | null
          options?: Json | null
          question_type?: string
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
            foreignKeyName: "questions_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "question_generation_jobs"
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
      quiz_attempts: {
        Row: {
          answers: Json
          completed_at: string | null
          correct_answers: number
          created_at: string
          feedback: Json | null
          id: string
          quiz_session_id: string
          score: number | null
          started_at: string
          status: string
          student_id: string
          tenant_id: string
          total_questions: number
        }
        Insert: {
          answers?: Json
          completed_at?: string | null
          correct_answers?: number
          created_at?: string
          feedback?: Json | null
          id?: string
          quiz_session_id: string
          score?: number | null
          started_at?: string
          status?: string
          student_id: string
          tenant_id: string
          total_questions?: number
        }
        Update: {
          answers?: Json
          completed_at?: string | null
          correct_answers?: number
          created_at?: string
          feedback?: Json | null
          id?: string
          quiz_session_id?: string
          score?: number | null
          started_at?: string
          status?: string
          student_id?: string
          tenant_id?: string
          total_questions?: number
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_quiz_session_id_fkey"
            columns: ["quiz_session_id"]
            isOneToOne: false
            referencedRelation: "quiz_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_attempts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_sessions: {
        Row: {
          chapter_id: string | null
          course_id: string
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          max_attempts: number | null
          passing_score: number | null
          question_ids: string[]
          quiz_type: string
          show_answers_after: string
          shuffle_questions: boolean
          tenant_id: string
          time_limit_minutes: number | null
          title: string
          updated_at: string
        }
        Insert: {
          chapter_id?: string | null
          course_id: string
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean
          max_attempts?: number | null
          passing_score?: number | null
          question_ids?: string[]
          quiz_type: string
          show_answers_after?: string
          shuffle_questions?: boolean
          tenant_id: string
          time_limit_minutes?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          chapter_id?: string | null
          course_id?: string
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          max_attempts?: number | null
          passing_score?: number | null
          question_ids?: string[]
          quiz_type?: string
          show_answers_after?: string
          shuffle_questions?: boolean
          tenant_id?: string
          time_limit_minutes?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_sessions_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_sessions_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_sessions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      scenario_attempts: {
        Row: {
          chapter_id: string
          completed_at: string | null
          created_at: string
          evaluation: Json | null
          id: string
          overall_score: number | null
          scenario_title: string | null
          started_at: string
          status: string
          step_responses: Json | null
          student_id: string
          tenant_id: string
        }
        Insert: {
          chapter_id: string
          completed_at?: string | null
          created_at?: string
          evaluation?: Json | null
          id?: string
          overall_score?: number | null
          scenario_title?: string | null
          started_at?: string
          status?: string
          step_responses?: Json | null
          student_id: string
          tenant_id: string
        }
        Update: {
          chapter_id?: string
          completed_at?: string | null
          created_at?: string
          evaluation?: Json | null
          id?: string
          overall_score?: number | null
          scenario_title?: string | null
          started_at?: string
          status?: string
          step_responses?: Json | null
          student_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scenario_attempts_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scenario_attempts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          analytics: Json | null
          chapter_id: string
          completed_at: string | null
          created_at: string | null
          id: string
          interactions_remaining: number
          question_id: string | null
          status: string
          student_id: string | null
          tenant_id: string
          turn_number: number
          updated_at: string | null
        }
        Insert: {
          analytics?: Json | null
          chapter_id: string
          completed_at?: string | null
          created_at?: string | null
          id?: string
          interactions_remaining?: number
          question_id?: string | null
          status?: string
          student_id?: string | null
          tenant_id: string
          turn_number?: number
          updated_at?: string | null
        }
        Update: {
          analytics?: Json | null
          chapter_id?: string
          completed_at?: string | null
          created_at?: string | null
          id?: string
          interactions_remaining?: number
          question_id?: string | null
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
      slide_reflections: {
        Row: {
          ai_response: string | null
          created_at: string
          id: string
          response: string
          slide_id: string
          student_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          ai_response?: string | null
          created_at?: string
          id?: string
          response: string
          slide_id: string
          student_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          ai_response?: string | null
          created_at?: string
          id?: string
          response?: string
          slide_id?: string
          student_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "slide_reflections_slide_id_fkey"
            columns: ["slide_id"]
            isOneToOne: false
            referencedRelation: "chapter_slides"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slide_reflections_tenant_id_fkey"
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
          deployment_url: string | null
          id: string
          name: string
          plan: string
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
          deployment_url?: string | null
          id?: string
          name: string
          plan?: string
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
          deployment_url?: string | null
          id?: string
          name?: string
          plan?: string
          settings?: Json | null
          slug?: string
          status?: string | null
          updated_at?: string | null
          whitelabel_config?: Json | null
          whitelabel_enabled?: boolean | null
        }
        Relationships: []
      }
      trail_courses: {
        Row: {
          course_id: string
          estimated_hours: number | null
          id: string
          is_required: boolean
          order: number
          trail_id: string
        }
        Insert: {
          course_id: string
          estimated_hours?: number | null
          id?: string
          is_required?: boolean
          order?: number
          trail_id: string
        }
        Update: {
          course_id?: string
          estimated_hours?: number | null
          id?: string
          is_required?: boolean
          order?: number
          trail_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trail_courses_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trail_courses_trail_id_fkey"
            columns: ["trail_id"]
            isOneToOne: false
            referencedRelation: "learning_trails"
            referencedColumns: ["id"]
          },
        ]
      }
      user_areas: {
        Row: {
          area_id: string
          created_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          area_id: string
          created_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          area_id?: string
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
      user_gamification: {
        Row: {
          badges: Json
          current_streak: number
          last_activity_date: string | null
          level: number
          max_streak: number
          tenant_id: string
          updated_at: string
          user_id: string
          xp: number
        }
        Insert: {
          badges?: Json
          current_streak?: number
          last_activity_date?: string | null
          level?: number
          max_streak?: number
          tenant_id: string
          updated_at?: string
          user_id: string
          xp?: number
        }
        Update: {
          badges?: Json
          current_streak?: number
          last_activity_date?: string | null
          level?: number
          max_streak?: number
          tenant_id?: string
          updated_at?: string
          user_id?: string
          xp?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_gamification_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_gamification_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          granted_by: string | null
          id: string
          role: string
          tenant_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          id?: string
          role: string
          tenant_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string | null
          id?: string
          role?: string
          tenant_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_tenant_memberships: {
        Row: {
          created_at: string | null
          id: string
          role: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role?: string
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_tenant_memberships_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
          is_test: boolean
          job_role_id: string | null
          learning_mode: string | null
          onboarding_completed: boolean | null
          profile: Json | null
          reports_to: string | null
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
          is_test?: boolean
          job_role_id?: string | null
          learning_mode?: string | null
          onboarding_completed?: boolean | null
          profile?: Json | null
          reports_to?: string | null
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
          is_test?: boolean
          job_role_id?: string | null
          learning_mode?: string | null
          onboarding_completed?: boolean | null
          profile?: Json | null
          reports_to?: string | null
          role?: string
          status?: string
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_job_role_id_fkey"
            columns: ["job_role_id"]
            isOneToOne: false
            referencedRelation: "job_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_reports_to_fkey"
            columns: ["reports_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      verso_posts: {
        Row: {
          author: string
          category: string
          content: string
          cover_color: string | null
          cover_url: string | null
          created_at: string
          created_by: string | null
          excerpt: string | null
          id: string
          published_at: string | null
          reading_time: number | null
          slug: string
          sources: Json | null
          status: string
          tags: string[] | null
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          author?: string
          category?: string
          content?: string
          cover_color?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          excerpt?: string | null
          id?: string
          published_at?: string | null
          reading_time?: number | null
          slug: string
          sources?: Json | null
          status?: string
          tags?: string[] | null
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          author?: string
          category?: string
          content?: string
          cover_color?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          excerpt?: string | null
          id?: string
          published_at?: string | null
          reading_time?: number | null
          slug?: string
          sources?: Json | null
          status?: string
          tags?: string[] | null
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "verso_posts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_deliveries: {
        Row: {
          attempts: number | null
          completed_at: string | null
          created_at: string | null
          event_type: string
          id: string
          last_error: string | null
          last_status_code: number | null
          next_retry_at: string | null
          payload: Json
          status: string
          tenant_id: string
          webhook_id: string
        }
        Insert: {
          attempts?: number | null
          completed_at?: string | null
          created_at?: string | null
          event_type: string
          id?: string
          last_error?: string | null
          last_status_code?: number | null
          next_retry_at?: string | null
          payload?: Json
          status?: string
          tenant_id: string
          webhook_id: string
        }
        Update: {
          attempts?: number | null
          completed_at?: string | null
          created_at?: string | null
          event_type?: string
          id?: string
          last_error?: string | null
          last_status_code?: number | null
          next_retry_at?: string | null
          payload?: Json
          status?: string
          tenant_id?: string
          webhook_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_deliveries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_deliveries_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "webhooks"
            referencedColumns: ["id"]
          },
        ]
      }
      webhooks: {
        Row: {
          created_at: string | null
          created_by: string
          events: string[]
          failure_count: number | null
          id: string
          is_active: boolean | null
          secret: string
          tenant_id: string
          updated_at: string | null
          url: string
        }
        Insert: {
          created_at?: string | null
          created_by: string
          events?: string[]
          failure_count?: number | null
          id?: string
          is_active?: boolean | null
          secret: string
          tenant_id: string
          updated_at?: string | null
          url: string
        }
        Update: {
          created_at?: string | null
          created_by?: string
          events?: string[]
          failure_count?: number | null
          id?: string
          is_active?: boolean | null
          secret?: string
          tenant_id?: string
          updated_at?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhooks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhooks_tenant_id_fkey"
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
      auth_managed_group_ids: { Args: never; Returns: string[] }
      auth_reachable_student_ids: { Args: never; Returns: string[] }
      auth_subtree_user_ids: { Args: never; Returns: string[] }
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
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
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
      has_any_role: {
        Args: { _roles: string[]; _uid: string }
        Returns: boolean
      }
      has_role: { Args: { _role: string; _uid: string }; Returns: boolean }
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
      recompute_primary_role: { Args: { _uid: string }; Returns: undefined }
      release_session_turn: {
        Args: { p_session_id: string; p_user_id: string }
        Returns: undefined
      }
      subtree_student_ids: { Args: { _node: string }; Returns: string[] }
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

