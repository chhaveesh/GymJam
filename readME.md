# GymJam: Social Music for Fitness Center

<p align="center">
  <em>Where fitness meets music, powered by community.</em>
</p>

## 📱 Overview

GymJam is a mobile application that revolutionizes how music is managed in gym environments. The platform empowers gym members to participate in music selection through voting, suggesting tracks, and engaging with their fitness community. Gym owners maintain control through playlist management and Spotify integration while fostering a more interactive atmosphere.

## ⚙️ Core Features

### 🔐 Authentication & Onboarding

- **Multi-platform access**: Available on iOS and Android
- **Flexible sign-in options**:
  - Email/password
  - Phone verification (OTP)
  - Social logins (Google/Apple)
- **Role selection**:
  - Gym Owner
  - Gym Member

### 👑 Gym Owner Experience

#### Profile Management

- Create and customize gym profile
- Connect Spotify account via API integration
- Manage membership base

#### Music Control Center

- Select or create Spotify playlists
- Toggle voting system (enable/disable)
- Set music playback mode:
  - Automatic (algorithm-driven)
  - Manual (owner-controlled)

#### Community Management

- Member invitations via:
  - Unique invite codes
  - Email invitations
  - QR code scanning
- View and edit member directory

#### Song Suggestions

- Review member suggestions
- Approve/reject proposed tracks
- Configure auto-approval settings:
  - Genre-based filtering
  - Popularity thresholds
  - AI-assisted matching (based on tempo, genre, mood)

#### Communication

- Push notification system for:
  - Membership updates
  - Playlist changes
  - Special events

#### Analytics Dashboard

- Track popular music trends
- Monitor member engagement
- Identify peak activity periods

### 🏋️‍♂️ Gym Member Experience

#### Gym Connection

- Join via invite code
- Scan gym-specific QR code
- Search for registered gyms

#### Music Interaction

- Real-time view of current tracks
- Vote on queued songs (5 daily votes for free users)
- Suggest new tracks for consideration
- Live reactions to playing songs (🔥, 💪, 👎)

#### Premium Features

- Enhanced voting (unlimited)
- Playlist suggestions
- Reward point multipliers
- Fitness tracking capabilities:
  - Workout logging
  - Diet journaling
  - Progress visualization

#### Rewards System

- Point accumulation for:
  - Active voting
  - Approved suggestions
  - Regular engagement
- Competitive leaderboards
- Achievement badges
- Reward redemption options:
  - Gym merchandise
  - Complimentary sessions
  - Premium feature trials

#### Social Elements

- Profile customization
- Friend connections
- In-app messaging (private and group)

## 🔍 Advanced Capabilities

- **Intelligent Song Rotation**: AI prevention of recently played tracks
- **Smart Playlist Optimization**: Dynamic reordering based on crowd preferences
- **Workout-Synchronized Music**: Suggestions tailored to exercise type
- **Wearable Integration**: Tempo adjustment based on fitness tracker data

## 💻 Technical Architecture

| Component          | Technology                                          |
| ------------------ | --------------------------------------------------- |
| Frontend           | React css tailwind  |
| Backend            | Supabase                                            |
| Database           | Supabase                                            |
| UI Framework       | React Native Paper                                  |
| Music Service      | Spotify API                                         |
| Push Notifications | Firebase Cloud Messaging                            |
| Authentication     | Supabase Auth                                       |
| AI Processing      | DeepSeek                                            |

## 🔐 Permission Matrix

| Feature             | Gym Owner | Gym Member |
| ------------------- | --------- | ---------- |
| Spotify Integration | ✅        | ❌         |
| Member Management   | ✅        | ❌         |
| Song Approval       | ✅        | ❌         |
| Voting              | ❌        | ✅         |
| Track Suggestions   | ❌        | ✅         |
| Notifications       | ✅        | ❌         |
| Song Reactions      | ❌        | ✅         |
| Playlist Viewing    | ✅        | ✅         |
| In-App Chat         | ✅        | ✅         |
| Premium Features    | ❌        | ✅         |

## 🔮 Future Roadmap

- Multi-location gym chain management
- Enhanced gamification systems
- Smart speaker ecosystem integration (Sonos, Chromecast)
- Machine learning for personalized music recommendations
- Expanded social features

## 📊 Database Schema

```sql
-- USERS & AUTHENTICATION
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  phone TEXT UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  avatar_url TEXT,
  display_name TEXT,
  role TEXT NOT NULL CHECK (role IN ('gym_owner', 'gym_member')),
  is_premium BOOLEAN DEFAULT FALSE,
  daily_votes_remaining INTEGER DEFAULT 5,
  votes_reset_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  spotify_connected BOOLEAN DEFAULT FALSE,
  fcm_token TEXT
);

-- GYM PROFILES
CREATE TABLE gyms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  logo_url TEXT,
  address TEXT,
  invite_code TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  voting_enabled BOOLEAN DEFAULT TRUE,
  playback_mode TEXT DEFAULT 'automatic' CHECK (playback_mode IN ('automatic', 'manual')),
  spotify_access_token TEXT,
  spotify_refresh_token TEXT
);

-- GYM MEMBERSHIPS
CREATE TABLE gym_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE,
  points INTEGER DEFAULT 0,
  UNIQUE(gym_id, user_id)
);

-- PLAYLISTS
CREATE TABLE playlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  spotify_id TEXT,
  is_active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- TRACKS (SONGS)
CREATE TABLE tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spotify_id TEXT NOT NULL,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  album TEXT,
  duration_ms INTEGER,
  image_url TEXT,
  preview_url TEXT,
  explicit BOOLEAN DEFAULT FALSE,
  genre TEXT,
  tempo FLOAT,
  energy FLOAT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- PLAYLIST TRACKS
CREATE TABLE playlist_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id UUID NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  track_id UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  position INTEGER,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_played_at TIMESTAMP WITH TIME ZONE,
  play_count INTEGER DEFAULT 0,
  UNIQUE(playlist_id, track_id)
);

-- SONG QUEUE
CREATE TABLE queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  track_id UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  added_by UUID NOT NULL REFERENCES users(id),
  vote_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'playing', 'played', 'skipped')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  played_at TIMESTAMP WITH TIME ZONE
);

-- VOTES
CREATE TABLE votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id UUID NOT NULL REFERENCES queue(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(queue_id, user_id)
);

-- SONG SUGGESTIONS
CREATE TABLE suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  track_id UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  suggested_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID REFERENCES users(id)
);

-- SONG REACTIONS
CREATE TABLE reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id UUID NOT NULL REFERENCES queue(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL CHECK (reaction_type IN ('fire', 'strong', 'thumbsdown')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(queue_id, user_id, reaction_type)
);

-- CHAT MESSAGES
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id UUID REFERENCES users(id),
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_group_chat BOOLEAN DEFAULT FALSE
);

-- AUTO-APPROVAL SETTINGS
CREATE TABLE auto_approval_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  enabled BOOLEAN DEFAULT FALSE,
  genre_whitelist TEXT[],
  min_popularity FLOAT DEFAULT 0.5,
  explicit_allowed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- NOTIFICATION SETTINGS
CREATE TABLE notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  songs_approved BOOLEAN DEFAULT TRUE,
  queue_updates BOOLEAN DEFAULT TRUE,
  membership_updates BOOLEAN DEFAULT TRUE,
  messages BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- INDEXES
CREATE INDEX idx_gym_members_gym_id ON gym_members(gym_id);
CREATE INDEX idx_gym_members_user_id ON gym_members(user_id);
CREATE INDEX idx_playlist_tracks_playlist_id ON playlist_tracks(playlist_id);
CREATE INDEX idx_queue_gym_id ON queue(gym_id);
CREATE INDEX idx_votes_queue_id ON votes(queue_id);
CREATE INDEX idx_votes_user_id ON votes(user_id);
CREATE INDEX idx_suggestions_gym_id ON suggestions(gym_id);
CREATE INDEX idx_suggestions_suggested_by ON suggestions(suggested_by);
CREATE INDEX idx_messages_gym_id ON messages(gym_id);
CREATE INDEX idx_messages_sender_id ON messages(sender_id);
CREATE INDEX idx_messages_receiver_id ON messages(receiver_id);
```

## 📁 App Folder Structure

```
/app                      # Main application code (using Expo Router)
  /_layout.tsx            # Root layout component
  /index.tsx              # Entry point / landing screen
  /(auth)                 # Authentication routes
    /login.tsx            # Login screen
    /signup.tsx           # Signup screen
    /role-selection.tsx   # Role selection screen
  /(gym-owner)            # Gym owner routes
    /_layout.tsx          # Gym owner layout with tabs
    /dashboard.tsx        # Owner dashboard
    /members/             # Member management
      /index.tsx          # Member list
      /[id].tsx           # Member details
    /music/               # Music management
      /index.tsx          # Current playlist
      /playlists.tsx      # Playlist selection
      /queue.tsx          # Current queue
      /suggestions.tsx    # Song suggestions
    /settings/            # Settings
      /index.tsx          # Main settings
      /profile.tsx        # Profile settings
      /spotify.tsx        # Spotify integration
      /notifications.tsx  # Notification settings
  /(gym-member)           # Gym member routes
    /_layout.tsx          # Gym member layout with tabs
    /dashboard.tsx        # Member dashboard
    /join-gym.tsx         # Join a gym screen
    /music/               # Music interaction
      /index.tsx          # Current playlist view
      /vote.tsx           # Voting interface
      /suggest.tsx        # Suggestion interface
    /rewards/             # Rewards
      /index.tsx          # Points and leaderboard
      /redeem.tsx         # Redeem rewards
    /social/              # Social features
      /index.tsx          # Social dashboard
      /friends.tsx        # Friends list
      /chat.tsx           # Chat interface
    /premium.tsx          # Premium upgrade page
    /settings/            # Settings
      /index.tsx          # Main settings
      /profile.tsx        # Profile settings
      /notifications.tsx  # Notification settings
/components               # Shared components
  /ui/                    # UI components
    /Button.tsx
    /Card.tsx
    /Input.tsx
    /Modal.tsx
    /Typography.tsx
  /music/                 # Music-related components
    /MusicPlayer.tsx
    /SongItem.tsx
    /PlaylistItem.tsx
    /VoteButton.tsx
  /gym/                   # Gym-related components
    /GymCard.tsx
    /MemberItem.tsx
    /QRScanner.tsx
  /auth/                  # Auth components
    /AuthForm.tsx
    /RoleSelector.tsx
  /layout/                # Layout components
    /AppHeader.tsx
    /TabBar.tsx
    /SafeAreaWrapper.tsx
/hooks                    # Custom hooks
  /useAuth.ts
  /useSpotify.ts
  /useVoting.ts
  /useMessages.ts
  /usePoints.ts
/services                 # API services
  /supabase.ts            # Supabase client setup
  /spotify.ts             # Spotify API service
  /auth.ts                # Authentication service
  /deepseek.ts            # AI service
  /notifications.ts       # Push notification service
/utils                    # Utility functions
  /formatters.ts          # Date/time/number formatters
  /validators.ts          # Form validators
  /permissions.ts         # Permission helpers
  /constants.ts           # App constants
/assets                   # Static assets
  /images/                # Image assets
  /fonts/                 # Font files
  /animations/            # Lottie animations
/styles                   # Global styles
  /theme.ts               # Theme configuration
  /typography.ts          # Typography styles
  /spacing.ts             # Spacing constants
  /colors.ts              # Color palette
/config                   # App configuration
  /env.ts                 # Environment variables
  /routes.ts              # Route definitions
  /api.ts                 # API endpoints
/types                    # TypeScript type definitions
  /index.ts               # Common types
  /api.ts                 # API types
  /models.ts              # Data models
  /navigation.ts          # Navigation types
/contexts                 # React contexts
  /AuthContext.tsx        # Authentication context
  /ThemeContext.tsx       # Theme context
  /MusicContext.tsx       # Music playback context
  /NotificationContext.tsx # Notification context
/providers                # App providers
  /AppProviders.tsx       # Root providers wrapper
app.json                  # Expo configuration
babel.config.js           # Babel configuration
tsconfig.json             # TypeScript configuration
package.json              # Dependencies
eas.json                  # EAS Build configuration
```
