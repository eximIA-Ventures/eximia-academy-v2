/**
 * eximIA Academy v2 — Database Types
 *
 * Scaffolding manual. Substitua pelo gerado via:
 *   npx supabase gen types typescript --local > packages/supabase/src/types.ts
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      tenants: {
        Row: {
          id: string
          name: string
          slug: string
          plan: "essencial" | "standard" | "premium"
          status: "active" | "inactive"
          branding: Json | null
          settings: Json | null
          whitelabel_enabled: boolean
          whitelabel_config: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          plan?: "essencial" | "standard" | "premium"
          status?: "active" | "inactive"
          branding?: Json | null
          settings?: Json | null
          whitelabel_enabled?: boolean
          whitelabel_config?: Json | null
        }
        Update: Partial<Database["public"]["Tables"]["tenants"]["Insert"]>
      }
      operational_units: {
        Row: {
          id: string
          tenant_id: string
          name: string
          slug: string
          description: string | null
          parent_id: string | null
          settings: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          name: string
          slug: string
          description?: string | null
          parent_id?: string | null
          settings?: Json | null
        }
        Update: Partial<Database["public"]["Tables"]["operational_units"]["Insert"]>
      }
      users: {
        Row: {
          id: string
          tenant_id: string
          unit_id: string | null
          email: string
          full_name: string | null
          avatar_url: string | null
          role: "student" | "instructor" | "manager" | "admin" | "super_admin"
          status: "active" | "inactive"
          streak_days: number
          streak_last_date: string | null
          total_xp: number
          deleted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          tenant_id: string
          unit_id?: string | null
          email: string
          full_name?: string | null
          avatar_url?: string | null
          role?: "student" | "instructor" | "manager" | "admin" | "super_admin"
          status?: "active" | "inactive"
          streak_days?: number
          streak_last_date?: string | null
          total_xp?: number
          deleted_at?: string | null
        }
        Update: Partial<Database["public"]["Tables"]["users"]["Insert"]>
      }
      courses: {
        Row: {
          id: string
          tenant_id: string
          instructor_id: string | null
          unit_id: string | null
          title: string
          description: string | null
          thumbnail_url: string | null
          status: "draft" | "published" | "archived"
          total_chapters: number
          settings: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          instructor_id?: string | null
          unit_id?: string | null
          title: string
          description?: string | null
          thumbnail_url?: string | null
          status?: "draft" | "published" | "archived"
          total_chapters?: number
          settings?: Json | null
        }
        Update: Partial<Database["public"]["Tables"]["courses"]["Insert"]>
      }
      chapters: {
        Row: {
          id: string
          course_id: string
          title: string
          description: string | null
          order_index: number
          status: "draft" | "published" | "archived"
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          course_id: string
          title: string
          description?: string | null
          order_index?: number
          status?: "draft" | "published" | "archived"
        }
        Update: Partial<Database["public"]["Tables"]["chapters"]["Insert"]>
      }
      enrollments: {
        Row: {
          id: string
          course_id: string
          student_id: string
          status: "active" | "completed" | "cancelled"
          enrolled_at: string
          completed_at: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          course_id: string
          student_id: string
          status?: "active" | "completed" | "cancelled"
          enrolled_at?: string
          completed_at?: string | null
        }
        Update: Partial<Database["public"]["Tables"]["enrollments"]["Insert"]>
      }
      progress: {
        Row: {
          id: string
          student_id: string
          chapter_id: string
          started_at: string
          completed_at: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          student_id: string
          chapter_id: string
          started_at?: string
          completed_at?: string | null
        }
        Update: Partial<Database["public"]["Tables"]["progress"]["Insert"]>
      }
      sessions: {
        Row: {
          id: string
          chapter_id: string
          student_id: string
          status: "active" | "completed" | "abandoned"
          current_turn: number
          current_turn_claimed_by: string | null
          started_at: string
          completed_at: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          chapter_id: string
          student_id: string
          status?: "active" | "completed" | "abandoned"
          current_turn?: number
          current_turn_claimed_by?: string | null
        }
        Update: Partial<Database["public"]["Tables"]["sessions"]["Insert"]>
      }
    }
    Views: Record<string, never>
    Functions: {
      auth_tenant_id: {
        Args: Record<string, never>
        Returns: string
      }
      auth_user_role: {
        Args: Record<string, never>
        Returns: string
      }
      is_super_admin: {
        Args: Record<string, never>
        Returns: boolean
      }
      is_tenant_admin: {
        Args: Record<string, never>
        Returns: boolean
      }
      claim_session_turn: {
        Args: { p_session_id: string; p_worker_id: string }
        Returns: boolean
      }
    }
    Enums: {
      user_role: "student" | "instructor" | "manager" | "admin" | "super_admin"
      tenant_plan: "essencial" | "standard" | "premium"
      session_status: "active" | "completed" | "abandoned"
      course_status: "draft" | "published" | "archived"
      chapter_status: "draft" | "published" | "archived"
      enrollment_status: "active" | "completed" | "cancelled"
    }
  }
}
