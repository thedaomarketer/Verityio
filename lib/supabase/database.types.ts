/**
 * Hand-written types mirroring supabase/migrations/*.sql, shaped to match
 * what `supabase gen types typescript` would generate (including the
 * `Relationships` arrays the postgrest-js query builder needs to type
 * embedded resource selects like `.select("*, breaks(*)")`).
 *
 * When a live Supabase project is connected, regenerate this file with:
 *   npx supabase gen types typescript --project-id <id> > lib/supabase/database.types.ts
 */

export type EntryType =
  | "general"
  | "task"
  | "instruction"
  | "workplace_issue"
  | "safety_issue"
  | "schedule_change"
  | "pay_issue"
  | "break_issue"
  | "incident"
  | "other";

export type ShiftStatus = "scheduled" | "active" | "completed" | "cancelled" | "missed";
export type ExpenseCategory = "meals" | "transport" | "supplies" | "equipment" | "lodging" | "other";
export type ScheduleStatus = "scheduled" | "confirmed" | "cancelled" | "time_off";
export type NotificationKind = "long_shift" | "long_break" | "payday" | "test";
export type AttachmentEntityType = "shift" | "journal_entry" | "expense" | "mileage_entry" | "job";
export type AuditAction =
  | "created"
  | "updated"
  | "deleted"
  | "clocked_in"
  | "clocked_out"
  | "break_started"
  | "break_ended";

type JobRelationship<FkName extends string> = {
  foreignKeyName: FkName;
  columns: ["job_id"];
  isOneToOne: false;
  referencedRelation: "jobs";
  referencedColumns: ["id"];
};

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          email: string | null;
          phone: string | null;
          avatar_url: string | null;
          country: string | null;
          timezone: string;
          currency: string;
          date_format: string;
          default_hourly_rate: number | null;
          locale: "en" | "fr" | "es";
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["profiles"]["Row"]> & { id: string };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]>;
        Relationships: [];
      };
      jobs: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          company_name: string | null;
          job_title: string | null;
          description: string | null;
          hourly_rate: number | null;
          overtime_rate: number | null;
          overtime_threshold_minutes: number | null;
          daily_overtime_threshold_minutes: number | null;
          double_time_threshold_minutes: number | null;
          double_time_rate: number | null;
          start_date: string | null;
          end_date: string | null;
          is_active: boolean;
          color: string;
          notes: string | null;
          pay_frequency: "weekly" | "biweekly" | "semi_monthly" | "monthly" | null;
          pay_anchor_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["jobs"]["Row"]> & {
          user_id: string;
          name: string;
        };
        Update: Partial<Database["public"]["Tables"]["jobs"]["Row"]>;
        Relationships: [];
      };
      shifts: {
        Row: {
          id: string;
          user_id: string;
          job_id: string;
          scheduled_start: string | null;
          scheduled_end: string | null;
          actual_start: string | null;
          actual_end: string | null;
          status: ShiftStatus;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["shifts"]["Row"]> & {
          user_id: string;
          job_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["shifts"]["Row"]>;
        Relationships: [JobRelationship<"shifts_job_id_fkey">];
      };
      breaks: {
        Row: {
          id: string;
          shift_id: string;
          user_id: string;
          started_at: string;
          ended_at: string | null;
          is_paid: boolean;
          notes: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["breaks"]["Row"]> & {
          shift_id: string;
          user_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["breaks"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "breaks_shift_id_fkey";
            columns: ["shift_id"];
            isOneToOne: false;
            referencedRelation: "shifts";
            referencedColumns: ["id"];
          },
        ];
      };
      journal_entries: {
        Row: {
          id: string;
          user_id: string;
          job_id: string | null;
          shift_id: string | null;
          entry_type: EntryType;
          title: string | null;
          content: string | null;
          event_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["journal_entries"]["Row"]> & {
          user_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["journal_entries"]["Row"]>;
        Relationships: [JobRelationship<"journal_entries_job_id_fkey">];
      };
      expenses: {
        Row: {
          id: string;
          user_id: string;
          job_id: string | null;
          amount: number;
          currency: string;
          category: ExpenseCategory;
          description: string | null;
          expense_date: string;
          receipt_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["expenses"]["Row"]> & {
          user_id: string;
          amount: number;
        };
        Update: Partial<Database["public"]["Tables"]["expenses"]["Row"]>;
        Relationships: [JobRelationship<"expenses_job_id_fkey">];
      };
      mileage_entries: {
        Row: {
          id: string;
          user_id: string;
          job_id: string | null;
          date: string;
          start_location: string | null;
          end_location: string | null;
          distance: number;
          unit: "km" | "mi";
          rate: number;
          reimbursement: number;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["mileage_entries"]["Row"]> & {
          user_id: string;
          distance: number;
        };
        Update: Partial<Database["public"]["Tables"]["mileage_entries"]["Row"]>;
        Relationships: [JobRelationship<"mileage_entries_job_id_fkey">];
      };
      schedule_entries: {
        Row: {
          id: string;
          user_id: string;
          job_id: string | null;
          start_at: string;
          end_at: string;
          status: ScheduleStatus;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["schedule_entries"]["Row"]> & {
          user_id: string;
          start_at: string;
          end_at: string;
        };
        Update: Partial<Database["public"]["Tables"]["schedule_entries"]["Row"]>;
        Relationships: [JobRelationship<"schedule_entries_job_id_fkey">];
      };
      attachments: {
        Row: {
          id: string;
          user_id: string;
          entity_type: AttachmentEntityType;
          entity_id: string;
          file_name: string;
          storage_path: string;
          mime_type: string | null;
          file_size: number | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["attachments"]["Row"]> & {
          user_id: string;
          entity_type: AttachmentEntityType;
          entity_id: string;
          file_name: string;
          storage_path: string;
        };
        Update: Partial<Database["public"]["Tables"]["attachments"]["Row"]>;
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: string;
          user_id: string;
          entity_type: string;
          entity_id: string | null;
          action: AuditAction;
          old_data: Record<string, unknown> | null;
          new_data: Record<string, unknown> | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["audit_logs"]["Row"]> & {
          user_id: string;
          entity_type: string;
          action: AuditAction;
        };
        Update: Partial<Database["public"]["Tables"]["audit_logs"]["Row"]>;
        Relationships: [];
      };
      user_settings: {
        Row: {
          id: string;
          user_id: string;
          week_starts_on: number;
          default_break_minutes: number;
          overtime_enabled: boolean;
          overtime_threshold_minutes: number;
          notifications_enabled: boolean;
          dark_mode: boolean;
          tax_country: "CA" | "US" | null;
          tax_region: string | null;
          tax_city: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["user_settings"]["Row"]> & {
          user_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["user_settings"]["Row"]>;
        Relationships: [];
      };
      push_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          onesignal_id: string;
          user_agent: string | null;
          created_at: string;
          last_seen_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["push_subscriptions"]["Row"]> & {
          user_id: string;
          onesignal_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["push_subscriptions"]["Row"]>;
        Relationships: [];
      };
      notification_deliveries: {
        Row: {
          id: string;
          user_id: string;
          kind: NotificationKind;
          dedupe_key: string;
          sent_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["notification_deliveries"]["Row"]> & {
          user_id: string;
          kind: NotificationKind;
          dedupe_key: string;
        };
        Update: Partial<Database["public"]["Tables"]["notification_deliveries"]["Row"]>;
        Relationships: [];
      };
      subscriptions: {
        Row: {
          user_id: string;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          status: string;
          plan_interval: "month" | "year" | null;
          plan_tier: "plus" | "pro" | null;
          current_period_end: string | null;
          cancel_at_period_end: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["subscriptions"]["Row"]> & {
          user_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["subscriptions"]["Row"]>;
        Relationships: [];
      };
      bank_items: {
        Row: {
          id: string;
          user_id: string;
          plaid_item_id: string;
          institution_id: string | null;
          institution_name: string | null;
          status: "active" | "login_required" | "error";
          last_synced_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["bank_items"]["Row"]> & {
          user_id: string;
          plaid_item_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["bank_items"]["Row"]>;
        Relationships: [];
      };
      bank_item_secrets: {
        Row: {
          item_id: string;
          user_id: string;
          access_token_ciphertext: string;
          sync_cursor: string | null;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["bank_item_secrets"]["Row"]> & {
          item_id: string;
          user_id: string;
          access_token_ciphertext: string;
        };
        Update: Partial<Database["public"]["Tables"]["bank_item_secrets"]["Row"]>;
        Relationships: [];
      };
      bank_accounts: {
        Row: {
          id: string;
          user_id: string;
          item_id: string;
          plaid_account_id: string;
          name: string;
          mask: string | null;
          type: string | null;
          subtype: string | null;
          current_balance: number | null;
          available_balance: number | null;
          iso_currency_code: string | null;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["bank_accounts"]["Row"]> & {
          user_id: string;
          item_id: string;
          plaid_account_id: string;
          name: string;
        };
        Update: Partial<Database["public"]["Tables"]["bank_accounts"]["Row"]>;
        Relationships: [];
      };
      bank_transactions: {
        Row: {
          id: string;
          user_id: string;
          account_id: string;
          plaid_transaction_id: string;
          date: string;
          name: string;
          merchant_name: string | null;
          amount: number;
          iso_currency_code: string | null;
          category_primary: string | null;
          category_detailed: string | null;
          pending: boolean;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["bank_transactions"]["Row"]> & {
          user_id: string;
          account_id: string;
          plaid_transaction_id: string;
          date: string;
          name: string;
          amount: number;
        };
        Update: Partial<Database["public"]["Tables"]["bank_transactions"]["Row"]>;
        Relationships: [];
      };
      ai_conversations: {
        Row: {
          id: string;
          user_id: string;
          title: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["ai_conversations"]["Row"]> & {
          user_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["ai_conversations"]["Row"]>;
        Relationships: [];
      };
      ai_messages: {
        Row: {
          id: string;
          conversation_id: string;
          user_id: string;
          role: "user" | "assistant" | "system" | "tool";
          content: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["ai_messages"]["Row"]> & {
          conversation_id: string;
          user_id: string;
          role: "user" | "assistant" | "system" | "tool";
          content: string;
        };
        Update: Partial<Database["public"]["Tables"]["ai_messages"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "ai_conversations";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
