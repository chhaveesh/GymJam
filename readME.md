# GymJam: Social Music for Fitness Center

<p align="center">
  <em>Where fitness meets music, powered by community.</em>
</p>

## 📱 Overview

GymJam is a mobile application that revolutionizes how music is managed in gym environments. The platform empowers gym members to participate in music selection through voting, suggesting tracks, and engaging with their fitness community. Gym owners maintain control through playlist management and Spotify integration while fostering a more interactive atmosphere.

## 🚀 Getting Started

### Prerequisites

- Node.js (v14.0.0 or later)
- npm (v6.0.0 or later)
- MongoDB (local or Atlas)
- React Native CLI
- Xcode (for iOS development)
- Android Studio (for Android development)
- iOS Simulator or Android Emulator

### Installation

1. Clone the repository

   ```
   git clone https://github.com/yourusername/gymjam.git
   cd gymjam
   ```

2. Install server dependencies

   ```
   npm install
   ```

3. Install React Native dependencies

   ```
   npm install
   ```

4. Install iOS dependencies (for iOS development)

   ```
   cd ios && pod install && cd ..
   ```

5. Create a `.env` file in the root directory with the following content:

   ```
   PORT=5000
   MONGO_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret_key
   SPOTIFY_CLIENT_ID=your_spotify_client_id
   SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
   NODE_ENV=development
   ```

6. Run the development server (backend and mobile app)

   For iOS:
   ```
   npm run ios
   ```

   For Android:
   ```
   npm run android
   ```

   For backend server:
   ```
   npm run server
   ```

## 🔨 Project Structure

```
/
├── src/                     # React Native source code
│   ├── components/          # Reusable components
│   ├── screens/             # Screen components
│   ├── navigation/          # Navigation configuration
│   ├── context/             # Context API for state management
│   ├── hooks/               # Custom React hooks
│   ├── utils/               # Utility functions
│   ├── services/            # API service calls
│   ├── assets/              # Images, fonts, and other assets
│   └── theme/               # Styling and theming
├── ios/                     # iOS native code
├── android/                 # Android native code
├── config/                  # Configuration files
├── controllers/             # Request handlers
├── middleware/              # Express middleware
├── models/                  # Mongoose models
├── routes/                  # Express routes
├── server.js                # Express app entry point
└── package.json             # Project dependencies
```

## ⚙️ Core Features

### 🔐 Authentication & Onboarding

- **Mobile-first experience**: Optimized for iOS and Android
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

## 🔄 App Workflow

### Gym Owner Workflow

1. **Initial Setup**
   - Download and install GymJam app
   - Sign up as a Gym Owner
   - Create gym profile with basic information
   - Connect Spotify account

2. **Gym Configuration**
   - Set up music preferences and rules
   - Configure voting system settings
   - Generate unique invite codes/QR codes
   - Set up member management policies

3. **Daily Operations**
   - Monitor current playlist and voting
   - Review and approve song suggestions
   - Manage member requests and communications
   - Track engagement metrics

### Gym Member Workflow

1. **Onboarding**
   - Download and install GymJam app
   - Sign up as a Gym Member
   - Join gym using:
     - Invite code
     - QR code scan
     - Gym search and request

2. **Daily Usage**
   - View current playing song
   - Cast votes on upcoming tracks
   - Suggest new songs
   - Track personal points and achievements
   - Interact with other members

3. **Premium Features**
   - Upgrade to premium membership
   - Access unlimited voting
   - Use advanced workout tracking
   - Redeem reward points

### Music Management Flow

1. **Playlist Creation**
   - Gym owner creates/selects Spotify playlist
   - Configure playback rules
   - Set up voting parameters

2. **Song Queue Management**
   - Automatic queue generation
   - Member voting influence
   - Owner override capabilities
   - Smart rotation to prevent repetition

3. **Suggestion System**
   - Members suggest songs
   - AI-assisted filtering
   - Owner review and approval
   - Automatic addition to queue

### Social Interaction Flow

1. **Community Building**
   - Member profile creation
   - Friend connections
   - Group chat formation
   - Achievement sharing

2. **Engagement Features**
   - Live reactions to songs
   - Leaderboard participation
   - Reward point earning
   - Achievement unlocking

## 🔍 Advanced Capabilities

- **Intelligent Song Rotation**: AI prevention of recently played tracks
- **Smart Playlist Optimization**: Dynamic reordering based on crowd preferences
- **Workout-Synchronized Music**: Suggestions tailored to exercise type
- **Wearable Integration**: Tempo adjustment based on fitness tracker data

## 💻 Technical Architecture

| Component          | Technology                                              |
| ------------------ | ------------------------------------------------------- |
| Frontend           | React.js, React Router v6, Modern CSS                   |
| UI Design          | Apple Fitness+ inspired with custom black & green theme |
| Backend            | Express.js, Node.js                                     |
| Database           | MongoDB with Mongoose ODM                               |
| Authentication     | JWT (JSON Web Tokens) with bcryptjs                     |
| State Management   | React Context API                                       |
| Form Handling      | Custom form validation                                  |
| API Communication  | Axios HTTP client                                       |
| Icons              | React Icons library                                     |
| Development Tools  | Nodemon, Concurrently                                   |
| Music Service      | Spotify API (planned integration)                       |
| Push Notifications | Firebase Cloud Messaging (planned)                      |
| Deployment         | Heroku compatible                                       |

## 🚧 Current Development Status

- ✅ Backend API structure setup
- ✅ MongoDB models and schemas
- ✅ Authentication system
- ✅ Homepage and basic UI components
- 🔄 Working on Gym management features
- 🔄 Working on Music playback integration
- 🔄 Working on Voting system

## 🔮 Future Roadmap

- Multi-location gym chain management
- Enhanced gamification systems
- Smart speaker ecosystem integration (Sonos, Chromecast)
- Machine learning for personalized music recommendations
- Expanded social features

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](https://github.com/yourusername/gymjam/issues).

## 📊 Database Schema

The application uses MongoDB with Mongoose schemas that mirror the structure detailed in the original project plan. Key models include:

- User (gym owners and members)
- Gym (fitness center profiles)
- Track (song metadata)
- Playlist (collections of tracks)
- Queue (pending songs)
- Suggestion (member track suggestions)

## 📄 License

This project is licensed under the MIT License - see the LICENSE.md file for details.
