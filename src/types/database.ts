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
      profiles: {
        Row: {
          id: string
          role: 'normal' | 'moderator' | 'admin'
          full_name: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          role?: 'normal' | 'moderator' | 'admin'
          full_name?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          role?: 'normal' | 'moderator' | 'admin'
          full_name?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      events: {
        Row: {
          id: string
          title: string
          description: string | null
          start_datetime: string
          end_datetime: string
          location: string | null
          color: string | null
          is_all_day: boolean
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          start_datetime: string
          end_datetime: string
          location?: string | null
          color?: string | null
          is_all_day?: boolean
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          start_datetime?: string
          end_datetime?: string
          location?: string | null
          color?: string | null
          is_all_day?: boolean
          created_by?: string
          created_at?: string
          updated_at?: string
        }
      }
      vacations: {
        Row: {
          id: string
          user_id: string
          start_date: string
          end_date: string
          note: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          start_date: string
          end_date: string
          note?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          start_date?: string
          end_date?: string
          note?: string | null
          created_at?: string
        }
      }
      unavailable_days: {
        Row: {
          id: string
          user_id: string
          date: string
          reason: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          date: string
          reason?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          date?: string
          reason?: string | null
          created_at?: string
        }
      }
      event_attendances: {
        Row: {
          id: string
          event_id: string
          user_id: string
          status: 'attending_onsite' | 'attending_hybrid' | 'absent'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          event_id: string
          user_id: string
          status: 'attending_onsite' | 'attending_hybrid' | 'absent'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          event_id?: string
          user_id?: string
          status?: 'attending_onsite' | 'attending_hybrid' | 'absent'
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      user_role: 'normal' | 'moderator' | 'admin'
      attendance_status: 'attending_onsite' | 'attending_hybrid' | 'absent'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}