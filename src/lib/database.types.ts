
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "damages": {
                  Row: {
                    "area": string,"created_at": string,"description": string,"handover_id": string,"id": string,"organization_id": string,"vehicle_id": string
                  }
                  Insert: {
                    "area": string,"created_at"?: string,"description": string,"handover_id": string,"id"?: string,"organization_id": string,"vehicle_id": string
                  }
                  Update: {
                    "area"?: string,"created_at"?: string,"description"?: string,"handover_id"?: string,"id"?: string,"organization_id"?: string,"vehicle_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "damages_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "damages_organization_id_handover_id_fkey"
      columns: ["organization_id","handover_id"]
isOneToOne: false
      referencedRelation: "handovers"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "damages_organization_id_vehicle_id_fkey"
      columns: ["organization_id","vehicle_id"]
isOneToOne: false
      referencedRelation: "vehicles"
      referencedColumns: ["organization_id","id"]
    }
                  ]
                },"drivers": {
                  Row: {
                    "email": string,"id": string,"license_valid_until": string,"name": string,"organization_id": string,"phone": string,"revision": number,"user_id": string | null
                  }
                  Insert: {
                    "email": string,"id"?: string,"license_valid_until": string,"name": string,"organization_id": string,"phone": string,"revision"?: number,"user_id"?: string | null
                  }
                  Update: {
                    "email"?: string,"id"?: string,"license_valid_until"?: string,"name"?: string,"organization_id"?: string,"phone"?: string,"revision"?: number,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "drivers_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "drivers_organization_id_user_id_fkey"
      columns: ["organization_id","user_id"]
isOneToOne: false
      referencedRelation: "memberships"
      referencedColumns: ["organization_id","user_id"]
    }
                  ]
                },"handover_photos": {
                  Row: {
                    "handover_id": string,"id": string,"organization_id": string,"path": string,"sequence": number,"slot": string
                  }
                  Insert: {
                    "handover_id": string,"id"?: string,"organization_id": string,"path": string,"sequence"?: number,"slot": string
                  }
                  Update: {
                    "handover_id"?: string,"id"?: string,"organization_id"?: string,"path"?: string,"sequence"?: number,"slot"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "handover_photos_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "handover_photos_organization_id_handover_id_fkey"
      columns: ["organization_id","handover_id"]
isOneToOne: false
      referencedRelation: "handovers"
      referencedColumns: ["organization_id","id"]
    }
                  ]
                },"handovers": {
                  Row: {
                    "created_at": string,"created_by": string,"fuel": number,"id": string,"kind": string,"mileage": number,"notes": string,"order_id": string,"organization_id": string,"signature": string,"signer": string,"snapshot": NonNullable<Json>
                  }
                  Insert: {
                    "created_at"?: string,"created_by": string,"fuel": number,"id": string,"kind": string,"mileage": number,"notes"?: string,"order_id": string,"organization_id": string,"signature": string,"signer": string,"snapshot": NonNullable<Json>
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string,"fuel"?: number,"id"?: string,"kind"?: string,"mileage"?: number,"notes"?: string,"order_id"?: string,"organization_id"?: string,"signature"?: string,"signer"?: string,"snapshot"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "handovers_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "handovers_organization_id_order_id_fkey"
      columns: ["organization_id","order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["organization_id","id"]
    }
                  ]
                },"memberships": {
                  Row: {
                    "id": string,"name": string,"organization_id": string,"role": string,"user_id": string
                  }
                  Insert: {
                    "id"?: string,"name": string,"organization_id": string,"role": string,"user_id": string
                  }
                  Update: {
                    "id"?: string,"name"?: string,"organization_id"?: string,"role"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "memberships_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"orders": {
                  Row: {
                    "cancellation_reason": string | null,"cancelled_at": string | null,"contact": string,"destination": string,"driver_id": string,"id": string,"organization_id": string,"pickup": string,"reference": string,"revision": number,"scheduled_at": string,"status": string,"vehicle_id": string
                  }
                  Insert: {
                    "cancellation_reason"?: string | null,"cancelled_at"?: string | null,"contact"?: string,"destination": string,"driver_id": string,"id"?: string,"organization_id": string,"pickup": string,"reference": string,"revision"?: number,"scheduled_at": string,"status"?: string,"vehicle_id": string
                  }
                  Update: {
                    "cancellation_reason"?: string | null,"cancelled_at"?: string | null,"contact"?: string,"destination"?: string,"driver_id"?: string,"id"?: string,"organization_id"?: string,"pickup"?: string,"reference"?: string,"revision"?: number,"scheduled_at"?: string,"status"?: string,"vehicle_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "orders_organization_id_driver_id_fkey"
      columns: ["organization_id","driver_id"]
isOneToOne: false
      referencedRelation: "drivers"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "orders_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orders_organization_id_vehicle_id_fkey"
      columns: ["organization_id","vehicle_id"]
isOneToOne: false
      referencedRelation: "vehicles"
      referencedColumns: ["organization_id","id"]
    }
                  ]
                },"organizations": {
                  Row: {
                    "created_at": string,"id": string,"name": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"name": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"team_invitations": {
                  Row: {
                    "accepted_at": string | null,"created_at": string,"created_by": string,"email": string,"expires_at": string,"id": string,"name": string,"organization_id": string,"revoked_at": string | null,"role": string,"token_hash": string
                  }
                  Insert: {
                    "accepted_at"?: string | null,"created_at"?: string,"created_by": string,"email": string,"expires_at"?: string,"id"?: string,"name": string,"organization_id": string,"revoked_at"?: string | null,"role": string,"token_hash": string
                  }
                  Update: {
                    "accepted_at"?: string | null,"created_at"?: string,"created_by"?: string,"email"?: string,"expires_at"?: string,"id"?: string,"name"?: string,"organization_id"?: string,"revoked_at"?: string | null,"role"?: string,"token_hash"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "team_invitations_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"vehicle_events": {
                  Row: {
                    "created_at": string,"description": string,"id": string,"order_id": string | null,"organization_id": string,"vehicle_id": string
                  }
                  Insert: {
                    "created_at"?: string,"description": string,"id"?: string,"order_id"?: string | null,"organization_id": string,"vehicle_id": string
                  }
                  Update: {
                    "created_at"?: string,"description"?: string,"id"?: string,"order_id"?: string | null,"organization_id"?: string,"vehicle_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "vehicle_events_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "vehicle_events_organization_id_order_id_fkey"
      columns: ["organization_id","order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "vehicle_events_organization_id_vehicle_id_fkey"
      columns: ["organization_id","vehicle_id"]
isOneToOne: false
      referencedRelation: "vehicles"
      referencedColumns: ["organization_id","id"]
    }
                  ]
                },"vehicles": {
                  Row: {
                    "color": string,"equipment": (string)[],"equipment_notes": string,"id": string,"location": string,"make": string,"mileage": number,"model": string,"organization_id": string,"plate": string,"revision": number,"variant": string,"vin": string
                  }
                  Insert: {
                    "color": string,"equipment"?: (string)[],"equipment_notes"?: string,"id"?: string,"location": string,"make": string,"mileage": number,"model": string,"organization_id": string,"plate": string,"revision"?: number,"variant"?: string,"vin": string
                  }
                  Update: {
                    "color"?: string,"equipment"?: (string)[],"equipment_notes"?: string,"id"?: string,"location"?: string,"make"?: string,"mileage"?: number,"model"?: string,"organization_id"?: string,"plate"?: string,"revision"?: number,"variant"?: string,"vin"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "vehicles_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "accept_team_invitation":
{ Args: { "p_token": string }; Returns: string
                           },
"add_member":
{ Args: { "p_name": string,"p_org": string,"p_role": string,"p_user": string }; Returns: undefined
                           },
"cancel_order":
{ Args: { "p_expected_revision": number,"p_id": string,"p_reason": string }; Returns: undefined
                           },
"create_organization":
{ Args: { "p_member_name": string,"p_name": string }; Returns: string
                           },
"create_team_invitation":
{ Args: { "p_email": string,"p_name": string,"p_org": string,"p_role": string }; Returns: Json
                           },
"finalize_handover":
{ Args: { "p_damages": Json,"p_expected_revision": number,"p_fuel": number,"p_id": string,"p_kind": string,"p_mileage": number,"p_notes": string,"p_order_id": string,"p_photos": Json,"p_signature": string,"p_signer": string }; Returns: string
                           },
"manage_team_member":
{ Args: { "p_expected_role": string,"p_id": string,"p_remove": boolean,"p_role": string }; Returns: undefined
                           },
"preview_team_invitation":
{ Args: { "p_token": string }; Returns: Json
                           },
"revoke_team_invitation":
{ Args: { "p_id": string }; Returns: undefined
                           },
"update_driver":
{ Args: { "p_expected_revision": number,"p_id": string,"p_values": Json }; Returns: undefined
                           },
"update_order":
{ Args: { "p_expected_revision": number,"p_id": string,"p_values": Json }; Returns: undefined
                           },
"update_vehicle":
{ Args: { "p_expected_revision": number,"p_id": string,"p_values": Json }; Returns: undefined
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

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
