import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './HomePage.css';

const HomePage = () => {
  const { isAuthenticated, user } = useAuth();

  const redirectToDashboard = () => {
    if (user && user.role === 'gym_owner') {
      return '/owner/dashboard';
    } else if (user && user.role === 'gym_member') {
      return '/member/dashboard';
    } else {
      return '/register';
    }
  };

  return (
    <div className="home-page">
      {/* Hero Section */}
      <section className="hero">
        <div className="hero-content">
          <h1>Where Fitness Meets Music</h1>
          <p>
            Empower your gym experience with member-driven music selection through
            voting, suggesting tracks, and engaging with your fitness community.
          </p>
          <div className="hero-buttons">
            {isAuthenticated ? (
              <Link to={redirectToDashboard()} className="btn btn-primary">
                Go to Dashboard
              </Link>
            ) : (
              <>
                <Link to="/register" className="btn">
                  Get Started
                </Link>
                <Link to="/login" className="btn btn-outline">
                  Login
                </Link>
              </>
            )}
          </div>
        </div>
        <div className="hero-image">
          <div className="image-placeholder">
            <div className="music-wave">
              <span></span>
              <span></span>
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features">
        <h2>Why Choose GymJam?</h2>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">🎵</div>
            <h3>Democratic Music Selection</h3>
            <p>
              Let members vote on music, creating a more engaging workout
              environment that everyone enjoys.
            </p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">💪</div>
            <h3>Boost Member Engagement</h3>
            <p>
              Foster a stronger community with interactive music participation and
              real-time reactions.
            </p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🏆</div>
            <h3>Reward Active Participation</h3>
            <p>
              Gamify the experience with points for voting and suggesting popular
              tracks that members love.
            </p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🔄</div>
            <h3>Seamless Spotify Integration</h3>
            <p>
              Connect your Spotify account for easy access to millions of tracks and
              automatic playback.
            </p>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="how-it-works">
        <h2>How It Works</h2>
        <div className="steps">
          <div className="step">
            <div className="step-number">1</div>
            <h3>Gym Owner Creates Account</h3>
            <p>
              Sign up as a gym owner, connect your Spotify account, and customize
              your gym profile.
            </p>
          </div>
          <div className="step">
            <div className="step-number">2</div>
            <h3>Members Join Via Invite</h3>
            <p>
              Invite members using a unique code, email, or QR code for quick
              access.
            </p>
          </div>
          <div className="step">
            <div className="step-number">3</div>
            <h3>Members Vote & Suggest</h3>
            <p>
              Members participate by voting on queued songs and suggesting new
              tracks.
            </p>
          </div>
          <div className="step">
            <div className="step-number">4</div>
            <h3>Music Plays Automatically</h3>
            <p>
              The system automatically plays the most popular songs based on votes
              and gym preferences.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta">
        <div className="cta-content">
          <h2>Ready to Transform Your Gym's Music Experience?</h2>
          <p>
            Join thousands of gyms already using GymJam to create a more engaging
            fitness environment.
          </p>
          <Link to="/register" className="btn btn-accent">
            Start Your Free Trial
          </Link>
        </div>
      </section>
    </div>
  );
};

export default HomePage; 