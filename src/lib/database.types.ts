
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
                },"external_listings": {
                  Row: {
                    "account_id": string,"created_at": string,"environment": string,"id": string,"metadata": NonNullable<Json>,"organization_id": string,"platform": string,"remote_id": string,"source_run": string,"vehicle_id": string
                  }
                  Insert: {
                    "account_id": string,"created_at"?: string,"environment": string,"id"?: string,"metadata"?: NonNullable<Json>,"organization_id": string,"platform"?: string,"remote_id": string,"source_run": string,"vehicle_id": string
                  }
                  Update: {
                    "account_id"?: string,"created_at"?: string,"environment"?: string,"id"?: string,"metadata"?: NonNullable<Json>,"organization_id"?: string,"platform"?: string,"remote_id"?: string,"source_run"?: string,"vehicle_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "external_listings_source_run_organization_id_fkey"
      columns: ["source_run","organization_id"]
isOneToOne: false
      referencedRelation: "platform_import_runs"
      referencedColumns: ["id","organization_id"]
    },{
      foreignKeyName: "external_listings_vehicle_id_organization_id_fkey"
      columns: ["vehicle_id","organization_id"]
isOneToOne: false
      referencedRelation: "vehicles"
      referencedColumns: ["id","organization_id"]
    }
                  ]
                },"fleet_sites": {
                  Row: {
                    "address": string,"archived_at": string | null,"id": string,"name": string,"organization_id": string,"revision": number
                  }
                  Insert: {
                    "address"?: string,"archived_at"?: string | null,"id": string,"name": string,"organization_id": string,"revision"?: number
                  }
                  Update: {
                    "address"?: string,"archived_at"?: string | null,"id"?: string,"name"?: string,"organization_id"?: string,"revision"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "fleet_sites_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"handover_photos": {
                  Row: {
                    "bucket": string,"handover_id": string,"id": string,"organization_id": string,"path": string,"sequence": number,"slot": string
                  }
                  Insert: {
                    "bucket"?: string,"handover_id": string,"id"?: string,"organization_id": string,"path": string,"sequence"?: number,"slot": string
                  }
                  Update: {
                    "bucket"?: string,"handover_id"?: string,"id"?: string,"organization_id"?: string,"path"?: string,"sequence"?: number,"slot"?: string
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
                    "created_at": string,"created_by": string,"fuel": number,"id": string,"key_snapshot": Json | null,"kind": string,"mileage": number,"notes": string,"order_id": string | null,"organization_id": string,"parties": Json | null,"position": Json | null,"purpose": string,"request_hash": string | null,"signature": string,"signature_bucket": string,"signer": string,"snapshot": NonNullable<Json>,"transport_plate": string | null,"vehicle_id": string,"version": number
                  }
                  Insert: {
                    "created_at"?: string,"created_by": string,"fuel": number,"id": string,"key_snapshot"?: Json | null,"kind": string,"mileage": number,"notes"?: string,"order_id"?: string | null,"organization_id": string,"parties"?: Json | null,"position"?: Json | null,"purpose"?: string,"request_hash"?: string | null,"signature": string,"signature_bucket"?: string,"signer": string,"snapshot": NonNullable<Json>,"transport_plate"?: string | null,"vehicle_id": string,"version"?: number
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string,"fuel"?: number,"id"?: string,"key_snapshot"?: Json | null,"kind"?: string,"mileage"?: number,"notes"?: string,"order_id"?: string | null,"organization_id"?: string,"parties"?: Json | null,"position"?: Json | null,"purpose"?: string,"request_hash"?: string | null,"signature"?: string,"signature_bucket"?: string,"signer"?: string,"snapshot"?: NonNullable<Json>,"transport_plate"?: string | null,"vehicle_id"?: string,"version"?: number
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
    },{
      foreignKeyName: "handovers_vehicle_id_organization_id_fkey"
      columns: ["vehicle_id","organization_id"]
isOneToOne: false
      referencedRelation: "vehicles"
      referencedColumns: ["id","organization_id"]
    }
                  ]
                },"key_movements": {
                  Row: {
                    "action": string,"actor_name": string,"created_at": string,"handover_id": string | null,"id": string,"key_id": string,"key_label": string,"location": string,"organization_id": string,"person": string,"vehicle_id": string
                  }
                  Insert: {
                    "action": string,"actor_name": string,"created_at"?: string,"handover_id"?: string | null,"id"?: string,"key_id": string,"key_label": string,"location"?: string,"organization_id": string,"person"?: string,"vehicle_id": string
                  }
                  Update: {
                    "action"?: string,"actor_name"?: string,"created_at"?: string,"handover_id"?: string | null,"id"?: string,"key_id"?: string,"key_label"?: string,"location"?: string,"organization_id"?: string,"person"?: string,"vehicle_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "key_movements_handover_id_organization_id_fkey"
      columns: ["handover_id","organization_id"]
isOneToOne: false
      referencedRelation: "handovers"
      referencedColumns: ["id","organization_id"]
    },{
      foreignKeyName: "key_movements_key_id_organization_id_fkey"
      columns: ["key_id","organization_id"]
isOneToOne: false
      referencedRelation: "vehicle_keys"
      referencedColumns: ["id","organization_id"]
    },{
      foreignKeyName: "key_movements_vehicle_id_organization_id_fkey"
      columns: ["vehicle_id","organization_id"]
isOneToOne: false
      referencedRelation: "vehicles"
      referencedColumns: ["id","organization_id"]
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
                    "cancellation_reason": string | null,"cancelled_at": string | null,"contact": string,"destination": string,"destination_address": string,"destination_site_id": string | null,"destination_space_id": string | null,"driver_id": string,"id": string,"organization_id": string,"pickup": string,"pickup_address": string,"pickup_site_id": string | null,"reference": string,"revision": number,"scheduled_at": string,"status": string,"transport_plate": string | null,"vehicle_id": string
                  }
                  Insert: {
                    "cancellation_reason"?: string | null,"cancelled_at"?: string | null,"contact"?: string,"destination": string,"destination_address"?: string,"destination_site_id"?: string | null,"destination_space_id"?: string | null,"driver_id": string,"id"?: string,"organization_id": string,"pickup": string,"pickup_address"?: string,"pickup_site_id"?: string | null,"reference": string,"revision"?: number,"scheduled_at": string,"status"?: string,"transport_plate"?: string | null,"vehicle_id": string
                  }
                  Update: {
                    "cancellation_reason"?: string | null,"cancelled_at"?: string | null,"contact"?: string,"destination"?: string,"destination_address"?: string,"destination_site_id"?: string | null,"destination_space_id"?: string | null,"driver_id"?: string,"id"?: string,"organization_id"?: string,"pickup"?: string,"pickup_address"?: string,"pickup_site_id"?: string | null,"reference"?: string,"revision"?: number,"scheduled_at"?: string,"status"?: string,"transport_plate"?: string | null,"vehicle_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "order_destination_site_fk"
      columns: ["destination_site_id","organization_id"]
isOneToOne: false
      referencedRelation: "fleet_sites"
      referencedColumns: ["id","organization_id"]
    },{
      foreignKeyName: "order_destination_space_fk"
      columns: ["destination_space_id","destination_site_id","organization_id"]
isOneToOne: false
      referencedRelation: "parking_spaces"
      referencedColumns: ["id","site_id","organization_id"]
    },{
      foreignKeyName: "order_pickup_site_fk"
      columns: ["pickup_site_id","organization_id"]
isOneToOne: false
      referencedRelation: "fleet_sites"
      referencedColumns: ["id","organization_id"]
    },{
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
                    "business_type": string,"created_at": string,"id": string,"logo_path": string | null,"name": string,"profile": NonNullable<Json>,"revision": number,"vehicle_counter": number
                  }
                  Insert: {
                    "business_type"?: string,"created_at"?: string,"id"?: string,"logo_path"?: string | null,"name": string,"profile"?: NonNullable<Json>,"revision"?: number,"vehicle_counter"?: number
                  }
                  Update: {
                    "business_type"?: string,"created_at"?: string,"id"?: string,"logo_path"?: string | null,"name"?: string,"profile"?: NonNullable<Json>,"revision"?: number,"vehicle_counter"?: number
                  }
                  Relationships: [

                  ]
                },"parking_spaces": {
                  Row: {
                    "archived_at": string | null,"id": string,"label": string,"organization_id": string,"revision": number,"site_id": string
                  }
                  Insert: {
                    "archived_at"?: string | null,"id": string,"label": string,"organization_id": string,"revision"?: number,"site_id": string
                  }
                  Update: {
                    "archived_at"?: string | null,"id"?: string,"label"?: string,"organization_id"?: string,"revision"?: number,"site_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "parking_spaces_site_id_organization_id_fkey"
      columns: ["site_id","organization_id"]
isOneToOne: false
      referencedRelation: "fleet_sites"
      referencedColumns: ["id","organization_id"]
    }
                  ]
                },"platform_import_runs": {
                  Row: {
                    "account_id": string,"created_at": string,"created_by": string,"created_count": number,"environment": string,"id": string,"linked_count": number,"organization_id": string,"platform": string,"request_hash": string
                  }
                  Insert: {
                    "account_id": string,"created_at"?: string,"created_by": string,"created_count"?: number,"environment": string,"id": string,"linked_count"?: number,"organization_id": string,"platform"?: string,"request_hash": string
                  }
                  Update: {
                    "account_id"?: string,"created_at"?: string,"created_by"?: string,"created_count"?: number,"environment"?: string,"id"?: string,"linked_count"?: number,"organization_id"?: string,"platform"?: string,"request_hash"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "platform_import_runs_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"protocol_sessions": {
                  Row: {
                    "closed": boolean,"created_at": string,"created_by": string,"id": string,"kind": string,"order_id": string | null,"order_revision": number | null,"organization_id": string,"vehicle_id": string,"vehicle_revision": number
                  }
                  Insert: {
                    "closed"?: boolean,"created_at"?: string,"created_by": string,"id": string,"kind": string,"order_id"?: string | null,"order_revision"?: number | null,"organization_id": string,"vehicle_id": string,"vehicle_revision": number
                  }
                  Update: {
                    "closed"?: boolean,"created_at"?: string,"created_by"?: string,"id"?: string,"kind"?: string,"order_id"?: string | null,"order_revision"?: number | null,"organization_id"?: string,"vehicle_id"?: string,"vehicle_revision"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "protocol_sessions_order_id_organization_id_fkey"
      columns: ["order_id","organization_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id","organization_id"]
    },{
      foreignKeyName: "protocol_sessions_vehicle_id_organization_id_fkey"
      columns: ["vehicle_id","organization_id"]
isOneToOne: false
      referencedRelation: "vehicles"
      referencedColumns: ["id","organization_id"]
    }
                  ]
                },"stock_events": {
                  Row: {
                    "actor_name": string,"created_at": string,"handover_id": string | null,"id": string,"next_kind": string,"next_status": string | null,"organization_id": string,"previous_kind": string | null,"previous_status": string | null,"reason": string,"vehicle_id": string
                  }
                  Insert: {
                    "actor_name": string,"created_at"?: string,"handover_id"?: string | null,"id"?: string,"next_kind": string,"next_status"?: string | null,"organization_id": string,"previous_kind"?: string | null,"previous_status"?: string | null,"reason": string,"vehicle_id": string
                  }
                  Update: {
                    "actor_name"?: string,"created_at"?: string,"handover_id"?: string | null,"id"?: string,"next_kind"?: string,"next_status"?: string | null,"organization_id"?: string,"previous_kind"?: string | null,"previous_status"?: string | null,"reason"?: string,"vehicle_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "stock_events_handover_id_organization_id_fkey"
      columns: ["handover_id","organization_id"]
isOneToOne: false
      referencedRelation: "handovers"
      referencedColumns: ["id","organization_id"]
    },{
      foreignKeyName: "stock_events_vehicle_id_organization_id_fkey"
      columns: ["vehicle_id","organization_id"]
isOneToOne: false
      referencedRelation: "vehicles"
      referencedColumns: ["id","organization_id"]
    }
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
                },"vehicle_assets": {
                  Row: {
                    "created_at": string,"id": string,"kind": string,"mime": string,"name": string,"organization_id": string,"path": string,"size": number,"vehicle_id": string
                  }
                  Insert: {
                    "created_at"?: string,"id": string,"kind": string,"mime": string,"name": string,"organization_id": string,"path": string,"size": number,"vehicle_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"kind"?: string,"mime"?: string,"name"?: string,"organization_id"?: string,"path"?: string,"size"?: number,"vehicle_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "vehicle_assets_vehicle_id_organization_id_fkey"
      columns: ["vehicle_id","organization_id"]
isOneToOne: false
      referencedRelation: "vehicles"
      referencedColumns: ["id","organization_id"]
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
                },"vehicle_holders": {
                  Row: {
                    "address": string,"contact": string,"name": string,"organization_id": string,"revision": number,"vehicle_id": string
                  }
                  Insert: {
                    "address"?: string,"contact"?: string,"name"?: string,"organization_id": string,"revision"?: number,"vehicle_id": string
                  }
                  Update: {
                    "address"?: string,"contact"?: string,"name"?: string,"organization_id"?: string,"revision"?: number,"vehicle_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "vehicle_holders_vehicle_id_organization_id_fkey"
      columns: ["vehicle_id","organization_id"]
isOneToOne: false
      referencedRelation: "vehicles"
      referencedColumns: ["id","organization_id"]
    }
                  ]
                },"vehicle_keys": {
                  Row: {
                    "custodian": string,"id": string,"identifier": string,"label": string,"location": string,"organization_id": string,"state": string,"vehicle_id": string
                  }
                  Insert: {
                    "custodian"?: string,"id": string,"identifier"?: string,"label": string,"location"?: string,"organization_id": string,"state"?: string,"vehicle_id": string
                  }
                  Update: {
                    "custodian"?: string,"id"?: string,"identifier"?: string,"label"?: string,"location"?: string,"organization_id"?: string,"state"?: string,"vehicle_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "vehicle_keys_vehicle_id_organization_id_fkey"
      columns: ["vehicle_id","organization_id"]
isOneToOne: false
      referencedRelation: "vehicles"
      referencedColumns: ["id","organization_id"]
    }
                  ]
                },"vehicle_movements": {
                  Row: {
                    "actor_name": string,"created_at": string,"from_location": string,"from_site_id": string | null,"from_space_id": string | null,"handover_id": string | null,"id": string,"organization_id": string,"reason": string,"source": string,"to_location": string,"to_site_id": string | null,"to_space_id": string | null,"vehicle_id": string
                  }
                  Insert: {
                    "actor_name": string,"created_at"?: string,"from_location": string,"from_site_id"?: string | null,"from_space_id"?: string | null,"handover_id"?: string | null,"id"?: string,"organization_id": string,"reason": string,"source": string,"to_location": string,"to_site_id"?: string | null,"to_space_id"?: string | null,"vehicle_id": string
                  }
                  Update: {
                    "actor_name"?: string,"created_at"?: string,"from_location"?: string,"from_site_id"?: string | null,"from_space_id"?: string | null,"handover_id"?: string | null,"id"?: string,"organization_id"?: string,"reason"?: string,"source"?: string,"to_location"?: string,"to_site_id"?: string | null,"to_space_id"?: string | null,"vehicle_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "vehicle_movements_handover_id_organization_id_fkey"
      columns: ["handover_id","organization_id"]
isOneToOne: false
      referencedRelation: "handovers"
      referencedColumns: ["id","organization_id"]
    },{
      foreignKeyName: "vehicle_movements_vehicle_id_organization_id_fkey"
      columns: ["vehicle_id","organization_id"]
isOneToOne: false
      referencedRelation: "vehicles"
      referencedColumns: ["id","organization_id"]
    }
                  ]
                },"vehicles": {
                  Row: {
                    "build_year": number | null,"color": string,"cover_id": string | null,"cover_kind": string | null,"equipment": (string)[],"equipment_notes": string,"first_registration": string | null,"generation": string,"id": string,"inventory_kind": string,"inventory_status": string | null,"keys_recorded": boolean,"keys_revision": number,"location": string,"make": string,"mileage": number,"model": string,"organization_id": string,"parking_space_id": string | null,"plate": string | null,"revision": number,"site_id": string | null,"stock_number": string,"variant": string,"vin": string
                  }
                  Insert: {
                    "build_year"?: number | null,"color": string,"cover_id"?: string | null,"cover_kind"?: string | null,"equipment"?: (string)[],"equipment_notes"?: string,"first_registration"?: string | null,"generation"?: string,"id"?: string,"inventory_kind"?: string,"inventory_status"?: string | null,"keys_recorded"?: boolean,"keys_revision"?: number,"location": string,"make": string,"mileage": number,"model": string,"organization_id": string,"parking_space_id"?: string | null,"plate"?: string | null,"revision"?: number,"site_id"?: string | null,"stock_number": string,"variant"?: string,"vin": string
                  }
                  Update: {
                    "build_year"?: number | null,"color"?: string,"cover_id"?: string | null,"cover_kind"?: string | null,"equipment"?: (string)[],"equipment_notes"?: string,"first_registration"?: string | null,"generation"?: string,"id"?: string,"inventory_kind"?: string,"inventory_status"?: string | null,"keys_recorded"?: boolean,"keys_revision"?: number,"location"?: string,"make"?: string,"mileage"?: number,"model"?: string,"organization_id"?: string,"parking_space_id"?: string | null,"plate"?: string | null,"revision"?: number,"site_id"?: string | null,"stock_number"?: string,"variant"?: string,"vin"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "vehicle_site_fk"
      columns: ["site_id","organization_id"]
isOneToOne: false
      referencedRelation: "fleet_sites"
      referencedColumns: ["id","organization_id"]
    },{
      foreignKeyName: "vehicle_space_fk"
      columns: ["parking_space_id","site_id","organization_id"]
isOneToOne: false
      referencedRelation: "parking_spaces"
      referencedColumns: ["id","site_id","organization_id"]
    },{
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
"add_parking_spaces":
{ Args: { "p_labels": (string)[],"p_org": string,"p_site": string }; Returns: number
                           },
"cancel_order":
{ Args: { "p_expected_revision": number,"p_id": string,"p_reason": string }; Returns: undefined
                           },
"change_vehicle_key":
{ Args: { "p_action": string,"p_expected_revision": number,"p_key": string,"p_values": Json,"p_vehicle": string }; Returns: undefined
                           },
"create_fleet_site_with_spaces":
{ Args: { "p_address": string,"p_id": string,"p_labels": (string)[],"p_name": string,"p_org": string }; Returns: number
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
"finalize_handover_v2":
{ Args: { "p_damages": Json,"p_expected_revision": number,"p_fuel": number,"p_id": string,"p_keys": Json,"p_kind": string,"p_mileage": number,"p_notes": string,"p_order_id": string,"p_photos": Json,"p_signature": string,"p_signer": string }; Returns: string
                           },
"finalize_protocol":
{ Args: { "p_id": string,"p_values": Json }; Returns: string
                           },
"import_mobile_stock":
{ Args: { "p_id": string,"p_org": string,"p_values": Json }; Returns: Json
                           },
"manage_team_member":
{ Args: { "p_expected_role": string,"p_id": string,"p_remove": boolean,"p_role": string }; Returns: undefined
                           },
"move_vehicle":
{ Args: { "p_location": string,"p_reason": string,"p_revision": number,"p_site": string,"p_space": string,"p_vehicle": string }; Returns: undefined
                           },
"preview_team_invitation":
{ Args: { "p_token": string }; Returns: Json
                           },
"register_vehicle_asset":
{ Args: { "p_id": string,"p_kind": string,"p_name": string,"p_path": string,"p_vehicle": string }; Returns: undefined
                           },
"remove_vehicle_asset":
{ Args: { "p_id": string }; Returns: string
                           },
"revoke_team_invitation":
{ Args: { "p_id": string }; Returns: undefined
                           },
"save_company":
{ Args: { "p_logo": string,"p_name": string,"p_org": string,"p_profile": Json,"p_revision": number,"p_type": string }; Returns: undefined
                           },
"save_fleet_site":
{ Args: { "p_address": string,"p_id": string,"p_name": string,"p_org": string,"p_revision": number }; Returns: undefined
                           },
"save_parking_space":
{ Args: { "p_id": string,"p_label": string,"p_org": string,"p_revision": number,"p_site": string }; Returns: undefined
                           },
"save_vehicle_holder":
{ Args: { "p_expected_revision": number,"p_values": Json,"p_vehicle": string }; Returns: undefined
                           },
"save_vehicle_record":
{ Args: { "p_holder": Json,"p_holder_revision": number,"p_id": string,"p_org": string,"p_revision": number,"p_values": Json }; Returns: undefined
                           },
"set_fleet_archived":
{ Args: { "p_archived": boolean,"p_id": string,"p_kind": string,"p_org": string,"p_revision": number }; Returns: undefined
                           },
"set_vehicle_cover":
{ Args: { "p_id": string,"p_kind": string,"p_revision": number,"p_vehicle": string }; Returns: undefined
                           },
"start_protocol":
{ Args: { "p_id": string,"p_kind": string,"p_order": string,"p_vehicle": string }; Returns: string
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
