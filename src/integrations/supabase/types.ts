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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string | null
          id: string
          ip_address: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      agent_country_permissions: {
        Row: {
          country: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          country: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          country?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      appointments: {
        Row: {
          agent_id: string | null
          appointment_date: string
          client_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          duration_minutes: number | null
          id: string
          location: string | null
          meeting_url: string | null
          notes: string | null
          status: Database["public"]["Enums"]["appointment_status"]
          title: string
          updated_at: string
        }
        Insert: {
          agent_id?: string | null
          appointment_date: string
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          location?: string | null
          meeting_url?: string | null
          notes?: string | null
          status?: Database["public"]["Enums"]["appointment_status"]
          title: string
          updated_at?: string
        }
        Update: {
          agent_id?: string | null
          appointment_date?: string
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          location?: string | null
          meeting_url?: string | null
          notes?: string | null
          status?: Database["public"]["Enums"]["appointment_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_steps: {
        Row: {
          client_id: string
          completed_at: string | null
          created_at: string
          due_date: string | null
          id: string
          is_visible_to_client: boolean
          notes: string | null
          priority: number | null
          responsible_id: string | null
          status: Database["public"]["Enums"]["step_status"]
          step_name: string
          step_order: number
          updated_at: string
        }
        Insert: {
          client_id: string
          completed_at?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          is_visible_to_client?: boolean
          notes?: string | null
          priority?: number | null
          responsible_id?: string | null
          status?: Database["public"]["Enums"]["step_status"]
          step_name: string
          step_order?: number
          updated_at?: string
        }
        Update: {
          client_id?: string
          completed_at?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          is_visible_to_client?: boolean
          notes?: string | null
          priority?: number | null
          responsible_id?: string | null
          status?: Database["public"]["Enums"]["step_status"]
          step_name?: string
          step_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_steps_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      procedure_templates: {
        Row: {
          created_at: string
          destination_country: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
          visa_type: string | null
        }
        Insert: {
          created_at?: string
          destination_country?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
          visa_type?: string | null
        }
        Update: {
          created_at?: string
          destination_country?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
          visa_type?: string | null
        }
        Relationships: []
      }
      procedure_template_steps: {
        Row: {
          created_at: string
          default_due_days: number | null
          default_responsible_role:
            | Database["public"]["Enums"]["app_role"]
            | null
          id: string
          notes: string | null
          step_name: string
          step_order: number
          template_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_due_days?: number | null
          default_responsible_role?:
            | Database["public"]["Enums"]["app_role"]
            | null
          id?: string
          notes?: string | null
          step_name: string
          step_order?: number
          template_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_due_days?: number | null
          default_responsible_role?:
            | Database["public"]["Enums"]["app_role"]
            | null
          id?: string
          notes?: string | null
          step_name?: string
          step_order?: number
          template_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "procedure_template_steps_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "procedure_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      client_step_notes: {
        Row: {
          client_id: string
          created_at: string
          id: string
          note: string
          step_id: string
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          note: string
          step_id: string
          user_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          note?: string
          step_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_step_notes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_step_notes_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "client_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          attachment_mime: string | null
          attachment_name: string | null
          attachment_path: string | null
          attachment_size: number | null
          body: string
          client_id: string
          created_at: string
          id: string
          read_at: string | null
          sender_id: string
        }
        Insert: {
          attachment_mime?: string | null
          attachment_name?: string | null
          attachment_path?: string | null
          attachment_size?: number | null
          body: string
          client_id: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id: string
        }
        Update: {
          attachment_mime?: string | null
          attachment_name?: string | null
          attachment_path?: string | null
          attachment_size?: number | null
          body?: string
          client_id?: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          agent_id: string | null
          auth_user_id: string | null
          created_at: string
          date_of_birth: string | null
          destination_country: string | null
          email: string | null
          full_name: string
          gender: string | null
          id: string
          marital_status: string | null
          nationality: string | null
          notes: string | null
          phone: string | null
          profession: string | null
          program: string | null
          procedure_template_id: string | null
          referred_by_user_id: string | null
          status: Database["public"]["Enums"]["client_status"]
          total_fees_due: number | null
          updated_at: string
          urgency: string | null
          visa_type: string | null
        }
        Insert: {
          address?: string | null
          agent_id?: string | null
          auth_user_id?: string | null
          created_at?: string
          date_of_birth?: string | null
          destination_country?: string | null
          email?: string | null
          full_name: string
          gender?: string | null
          id?: string
          marital_status?: string | null
          nationality?: string | null
          notes?: string | null
          phone?: string | null
          profession?: string | null
          program?: string | null
          procedure_template_id?: string | null
          referred_by_user_id?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          total_fees_due?: number | null
          updated_at?: string
          urgency?: string | null
          visa_type?: string | null
        }
        Update: {
          address?: string | null
          agent_id?: string | null
          auth_user_id?: string | null
          created_at?: string
          date_of_birth?: string | null
          destination_country?: string | null
          email?: string | null
          full_name?: string
          gender?: string | null
          id?: string
          marital_status?: string | null
          nationality?: string | null
          notes?: string | null
          phone?: string | null
          profession?: string | null
          program?: string | null
          procedure_template_id?: string | null
          referred_by_user_id?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          total_fees_due?: number | null
          updated_at?: string
          urgency?: string | null
          visa_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_referred_by_user_id_fkey"
            columns: ["referred_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          client_id: string
          contract_number: string
          created_at: string
          currency: string
          id: string
          notes: string | null
          signed_date: string | null
          status: Database["public"]["Enums"]["contract_status"]
          total_amount: number
          updated_at: string
        }
        Insert: {
          client_id: string
          contract_number: string
          created_at?: string
          currency?: string
          id?: string
          notes?: string | null
          signed_date?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          total_amount: number
          updated_at?: string
        }
        Update: {
          client_id?: string
          contract_number?: string
          created_at?: string
          currency?: string
          id?: string
          notes?: string | null
          signed_date?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          category: Database["public"]["Enums"]["document_category"]
          client_id: string
          created_at: string
          file_path: string
          file_size: number | null
          id: string
          is_visible_to_client: boolean
          mime_type: string | null
          name: string
          notes: string | null
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          category?: Database["public"]["Enums"]["document_category"]
          client_id: string
          created_at?: string
          file_path: string
          file_size?: number | null
          id?: string
          is_visible_to_client?: boolean
          mime_type?: string | null
          name: string
          notes?: string | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          category?: Database["public"]["Enums"]["document_category"]
          client_id?: string
          created_at?: string
          file_path?: string
          file_size?: number | null
          id?: string
          is_visible_to_client?: boolean
          mime_type?: string | null
          name?: string
          notes?: string | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          assigned_to: string | null
          budget: number | null
          converted_by_user_id: string | null
          converted_client_id: string | null
          created_at: string
          destination_country: string | null
          email: string | null
          full_name: string
          id: string
          interest_level: number | null
          notes: string | null
          phone: string | null
          referred_by_user_id: string | null
          source_other: string | null
          source: Database["public"]["Enums"]["lead_source"]
          status: Database["public"]["Enums"]["lead_status"]
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          budget?: number | null
          converted_by_user_id?: string | null
          converted_client_id?: string | null
          created_at?: string
          destination_country?: string | null
          email?: string | null
          full_name: string
          id?: string
          interest_level?: number | null
          notes?: string | null
          phone?: string | null
          referred_by_user_id?: string | null
          source_other?: string | null
          source?: Database["public"]["Enums"]["lead_source"]
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          budget?: number | null
          converted_by_user_id?: string | null
          converted_client_id?: string | null
          created_at?: string
          destination_country?: string | null
          email?: string | null
          full_name?: string
          id?: string
          interest_level?: number | null
          notes?: string | null
          phone?: string | null
          referred_by_user_id?: string | null
          source_other?: string | null
          source?: Database["public"]["Enums"]["lead_source"]
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_converted_by_user_id_fkey"
            columns: ["converted_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_referred_by_user_id_fkey"
            columns: ["referred_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          link: string | null
          message: string | null
          read: boolean
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string | null
          read?: boolean
          title: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string | null
          read?: boolean
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth_key: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth_key: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth_key?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          client_id: string
          contract_id: string
          created_at: string
          currency: string
          due_date: string | null
          id: string
          notes: string | null
          payment_date: string | null
          payment_method: string | null
          reference: string | null
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          client_id: string
          contract_id: string
          created_at?: string
          currency?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          payment_date?: string | null
          payment_method?: string | null
          reference?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          client_id?: string
          contract_id?: string
          created_at?: string
          currency?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          payment_date?: string | null
          payment_method?: string | null
          reference?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          preferred_language: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          preferred_language?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          preferred_language?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          assigned_to: string | null
          client_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          priority: Database["public"]["Enums"]["task_priority"]
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_client: { Args: { _client_id: string }; Returns: boolean }
      can_manage_clients: { Args: { _user_id: string }; Returns: boolean }
      can_manage_finance: { Args: { _user_id: string }; Returns: boolean }
      get_user_roles: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"][]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "admin"
        | "agent"
        | "marketing_agent"
        | "comptable"
        | "manager"
        | "support"
        | "client"
      appointment_status:
        | "scheduled"
        | "confirmed"
        | "completed"
        | "cancelled"
        | "no_show"
      client_status: "vip" | "standard" | "late_payment" | "priority"
      contract_status: "draft" | "active" | "completed" | "cancelled"
      document_category:
        | "passport"
        | "diploma"
        | "cv"
        | "bank_statement"
        | "photo"
        | "letter"
        | "contract"
        | "other"
      lead_source:
        | "facebook"
        | "whatsapp"
        | "referral"
        | "website"
        | "instagram"
        | "other"
      lead_status:
        | "new"
        | "contacted"
        | "meeting_scheduled"
        | "converted"
        | "lost"
      notification_type:
        | "info"
        | "success"
        | "warning"
        | "error"
        | "client"
        | "payment"
        | "document"
        | "appointment"
      payment_status: "pending" | "paid" | "overdue" | "cancelled"
      step_status:
        | "todo"
        | "in_progress"
        | "validated"
        | "blocked"
        | "completed"
      task_priority: "low" | "medium" | "high" | "urgent"
      task_status: "todo" | "in_progress" | "done" | "cancelled"
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
  public: {
    Enums: {
      app_role: [
        "super_admin",
        "admin",
        "agent",
        "marketing_agent",
        "comptable",
        "manager",
        "support",
      ],
      appointment_status: [
        "scheduled",
        "confirmed",
        "completed",
        "cancelled",
        "no_show",
      ],
      client_status: ["vip", "standard", "late_payment", "priority"],
      contract_status: ["draft", "active", "completed", "cancelled"],
      document_category: [
        "passport",
        "diploma",
        "cv",
        "bank_statement",
        "photo",
        "letter",
        "contract",
        "other",
      ],
      lead_source: [
        "facebook",
        "whatsapp",
        "referral",
        "website",
        "instagram",
        "other",
      ],
      lead_status: [
        "new",
        "contacted",
        "meeting_scheduled",
        "converted",
        "lost",
      ],
      notification_type: [
        "info",
        "success",
        "warning",
        "error",
        "client",
        "payment",
        "document",
        "appointment",
      ],
      payment_status: ["pending", "paid", "overdue", "cancelled"],
      step_status: ["todo", "in_progress", "validated", "blocked", "completed"],
      task_priority: ["low", "medium", "high", "urgent"],
      task_status: ["todo", "in_progress", "done", "cancelled"],
    },
  },
} as const
