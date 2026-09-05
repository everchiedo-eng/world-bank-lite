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
      chain_settings: {
        Row: {
          chain: Database["public"]["Enums"]["chain_kind"]
          disburser_address: string | null
          enabled: boolean
          rpc_url: string | null
          treasury_address: string | null
          updated_at: string
        }
        Insert: {
          chain: Database["public"]["Enums"]["chain_kind"]
          disburser_address?: string | null
          enabled?: boolean
          rpc_url?: string | null
          treasury_address?: string | null
          updated_at?: string
        }
        Update: {
          chain?: Database["public"]["Enums"]["chain_kind"]
          disburser_address?: string | null
          enabled?: boolean
          rpc_url?: string | null
          treasury_address?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      collateral_deposits: {
        Row: {
          amount: number
          asset: string
          chain: Database["public"]["Enums"]["chain_kind"]
          created_at: string
          deposit_tx_hash: string | null
          from_address: string | null
          id: string
          status: Database["public"]["Enums"]["deposit_status"]
          to_address: string | null
          usd_value_at_deposit: number
          user_id: string
        }
        Insert: {
          amount: number
          asset: string
          chain: Database["public"]["Enums"]["chain_kind"]
          created_at?: string
          deposit_tx_hash?: string | null
          from_address?: string | null
          id?: string
          status?: Database["public"]["Enums"]["deposit_status"]
          to_address?: string | null
          usd_value_at_deposit: number
          user_id: string
        }
        Update: {
          amount?: number
          asset?: string
          chain?: Database["public"]["Enums"]["chain_kind"]
          created_at?: string
          deposit_tx_hash?: string | null
          from_address?: string | null
          id?: string
          status?: Database["public"]["Enums"]["deposit_status"]
          to_address?: string | null
          usd_value_at_deposit?: number
          user_id?: string
        }
        Relationships: []
      }
      connected_wallets: {
        Row: {
          address: string
          chain: Database["public"]["Enums"]["chain_kind"]
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          address: string
          chain: Database["public"]["Enums"]["chain_kind"]
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          address?: string
          chain?: Database["public"]["Enums"]["chain_kind"]
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      loans: {
        Row: {
          admin_notes: string | null
          borrow_asset: string
          borrow_chain: Database["public"]["Enums"]["chain_kind"]
          collateral_deposit_id: string | null
          created_at: string
          decided_at: string | null
          destination_address: string
          disbursed_at: string | null
          disbursement_tx_hash: string | null
          id: string
          leverage_multiplier: number
          ltv_percent: number
          repayment_due_at: string | null
          requested_amount_usd: number
          status: Database["public"]["Enums"]["loan_status"]
          term_months: number
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          borrow_asset: string
          borrow_chain: Database["public"]["Enums"]["chain_kind"]
          collateral_deposit_id?: string | null
          created_at?: string
          decided_at?: string | null
          destination_address: string
          disbursed_at?: string | null
          disbursement_tx_hash?: string | null
          id?: string
          leverage_multiplier?: number
          ltv_percent: number
          repayment_due_at?: string | null
          requested_amount_usd: number
          status?: Database["public"]["Enums"]["loan_status"]
          term_months?: number
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          borrow_asset?: string
          borrow_chain?: Database["public"]["Enums"]["chain_kind"]
          collateral_deposit_id?: string | null
          created_at?: string
          decided_at?: string | null
          destination_address?: string
          disbursed_at?: string | null
          disbursement_tx_hash?: string | null
          id?: string
          leverage_multiplier?: number
          ltv_percent?: number
          repayment_due_at?: string | null
          requested_amount_usd?: number
          status?: Database["public"]["Enums"]["loan_status"]
          term_months?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loans_collateral_deposit_id_fkey"
            columns: ["collateral_deposit_id"]
            isOneToOne: false
            referencedRelation: "collateral_deposits"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
        }
        Relationships: []
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      chain_kind: "ethereum" | "polygon" | "bnb" | "solana"
      deposit_status: "locked" | "released"
      loan_status: "pending" | "approved" | "rejected" | "disbursed" | "repaid"
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
      app_role: ["admin", "user"],
      chain_kind: ["ethereum", "polygon", "bnb", "solana"],
      deposit_status: ["locked", "released"],
      loan_status: ["pending", "approved", "rejected", "disbursed", "repaid"],
    },
  },
} as const
