// TypeScript definitions for the Supabase database schema

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          phone: string | null
          created_at: string
          updated_at: string
          avatar_url: string | null
          display_name: string | null
          role: 'gym_owner' | 'gym_member'
          is_premium: boolean
          daily_votes_remaining: number
          votes_reset_at: string
          spotify_connected: boolean
          fcm_token: string | null
        }
        Insert: {
          id?: string
          email: string
          phone?: string | null
          created_at?: string
          updated_at?: string
          avatar_url?: string | null
          display_name?: string | null
          role: 'gym_owner' | 'gym_member'
          is_premium?: boolean
          daily_votes_remaining?: number
          votes_reset_at?: string
          spotify_connected?: boolean
          fcm_token?: string | null
        }
        Update: {
          id?: string
          email?: string
          phone?: string | null
          created_at?: string
          updated_at?: string
          avatar_url?: string | null
          display_name?: string | null
          role?: 'gym_owner' | 'gym_member'
          is_premium?: boolean
          daily_votes_remaining?: number
          votes_reset_at?: string
          spotify_connected?: boolean
          fcm_token?: string | null
        }
      }
      gyms: {
        Row: {
          id: string
          owner_id: string
          name: string
          description: string | null
          logo_url: string | null
          address: string | null
          invite_code: string
          created_at: string
          updated_at: string
          voting_enabled: boolean
          playback_mode: 'automatic' | 'manual'
          spotify_access_token: string | null
          spotify_refresh_token: string | null
        }
        Insert: {
          id?: string
          owner_id: string
          name: string
          description?: string | null
          logo_url?: string | null
          address?: string | null
          invite_code: string
          created_at?: string
          updated_at?: string
          voting_enabled?: boolean
          playback_mode?: 'automatic' | 'manual'
          spotify_access_token?: string | null
          spotify_refresh_token?: string | null
        }
        Update: {
          id?: string
          owner_id?: string
          name?: string
          description?: string | null
          logo_url?: string | null
          address?: string | null
          invite_code?: string
          created_at?: string
          updated_at?: string
          voting_enabled?: boolean
          playback_mode?: 'automatic' | 'manual'
          spotify_access_token?: string | null
          spotify_refresh_token?: string | null
        }
      }
      gym_members: {
        Row: {
          id: string
          gym_id: string
          user_id: string
          joined_at: string
          is_active: boolean
          points: number
        }
        Insert: {
          id?: string
          gym_id: string
          user_id: string
          joined_at?: string
          is_active?: boolean
          points?: number
        }
        Update: {
          id?: string
          gym_id?: string
          user_id?: string
          joined_at?: string
          is_active?: boolean
          points?: number
        }
      }
      playlists: {
        Row: {
          id: string
          gym_id: string
          name: string
          description: string | null
          spotify_id: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          gym_id: string
          name: string
          description?: string | null
          spotify_id?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          gym_id?: string
          name?: string
          description?: string | null
          spotify_id?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      tracks: {
        Row: {
          id: string
          spotify_id: string
          title: string
          artist: string
          album: string | null
          duration_ms: number | null
          image_url: string | null
          preview_url: string | null
          explicit: boolean
          genre: string | null
          tempo: number | null
          energy: number | null
          created_at: string
        }
        Insert: {
          id?: string
          spotify_id: string
          title: string
          artist: string
          album?: string | null
          duration_ms?: number | null
          image_url?: string | null
          preview_url?: string | null
          explicit?: boolean
          genre?: string | null
          tempo?: number | null
          energy?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          spotify_id?: string
          title?: string
          artist?: string
          album?: string | null
          duration_ms?: number | null
          image_url?: string | null
          preview_url?: string | null
          explicit?: boolean
          genre?: string | null
          tempo?: number | null
          energy?: number | null
          created_at?: string
        }
      }
      playlist_tracks: {
        Row: {
          id: string
          playlist_id: string
          track_id: string
          position: number | null
          added_at: string
          last_played_at: string | null
          play_count: number
        }
        Insert: {
          id?: string
          playlist_id: string
          track_id: string
          position?: number | null
          added_at?: string
          last_played_at?: string | null
          play_count?: number
        }
        Update: {
          id?: string
          playlist_id?: string
          track_id?: string
          position?: number | null
          added_at?: string
          last_played_at?: string | null
          play_count?: number
        }
      }
      queue: {
        Row: {
          id: string
          gym_id: string
          track_id: string
          added_by: string
          vote_count: number
          status: 'pending' | 'playing' | 'played' | 'skipped'
          created_at: string
          played_at: string | null
        }
        Insert: {
          id?: string
          gym_id: string
          track_id: string
          added_by: string
          vote_count?: number
          status?: 'pending' | 'playing' | 'played' | 'skipped'
          created_at?: string
          played_at?: string | null
        }
        Update: {
          id?: string
          gym_id?: string
          track_id?: string
          added_by?: string
          vote_count?: number
          status?: 'pending' | 'playing' | 'played' | 'skipped'
          created_at?: string
          played_at?: string | null
        }
      }
      votes: {
        Row: {
          id: string
          queue_id: string
          user_id: string
          created_at: string
        }
        Insert: {
          id?: string
          queue_id: string
          user_id: string
          created_at?: string
        }
        Update: {
          id?: string
          queue_id?: string
          user_id?: string
          created_at?: string
        }
      }
      suggestions: {
        Row: {
          id: string
          gym_id: string
          track_id: string
          suggested_by: string
          status: 'pending' | 'approved' | 'rejected'
          created_at: string
          reviewed_at: string | null
          reviewed_by: string | null
        }
        Insert: {
          id?: string
          gym_id: string
          track_id: string
          suggested_by: string
          status?: 'pending' | 'approved' | 'rejected'
          created_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
        }
        Update: {
          id?: string
          gym_id?: string
          track_id?: string
          suggested_by?: string
          status?: 'pending' | 'approved' | 'rejected'
          created_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
        }
      }
      reactions: {
        Row: {
          id: string
          queue_id: string
          user_id: string
          reaction_type: 'fire' | 'strong' | 'thumbsdown'
          created_at: string
        }
        Insert: {
          id?: string
          queue_id: string
          user_id: string
          reaction_type: 'fire' | 'strong' | 'thumbsdown'
          created_at?: string
        }
        Update: {
          id?: string
          queue_id?: string
          user_id?: string
          reaction_type?: 'fire' | 'strong' | 'thumbsdown'
          created_at?: string
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
      [_ in never]: never
    }
  }
} 