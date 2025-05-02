import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AnimatedElement from '../components/ui/AnimatedElement';
import MusicVisualizer from '../components/ui/MusicVisualizer';
import HeroVisualizer from '../components/ui/HeroVisualizer';
import './HomePage.css';

const HomePage = () => {
  const { isAuthenticated, user } = useAuth();
  const [activeFeature, setActiveFeature] = useState(null);
  const [scrollPosition, setScrollPosition] = useState(0);
  
  // Reference to the hero visualizer component
  const heroVisualizerRef = useRef(null);

  // Handle scroll events for parallax effects
  useEffect(() => {
    const handleScroll = () => {
      setScrollPosition(window.scrollY);
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const redirectToDashboard = () => {
    if (user && user.role === 'gym_owner') {
      return '/owner/dashboard';
    } else if (user && user.role === 'gym_member') {
      return '/member/dashboard';
    } else {
      return '/register';
    }
  };

  // Feature card click handler
  const handleFeatureClick = (index) => {
    setActiveFeature(index === activeFeature ? null : index);
  };
  
  // Handler for button hover to create particle effect
  const handleButtonHover = (e) => {
    if (heroVisualizerRef.current) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      heroVisualizerRef.current.createBurst(x, y);
    }
  };

  return (
    <div className="home-page">
      {/* Hero Section */}
      <section className="hero" style={{ 
        transform: `translateY(${scrollPosition * 0.1}px)` 
      }}>
        <HeroVisualizer ref={heroVisualizerRef} />
        <AnimatedElement animation="fade-in">
          <div className="hero-content">
            <h1>Where Fitness Meets Music</h1>
            <p>
              Empower your gym experience with member-driven music selection through
              voting, suggesting tracks, and engaging with your fitness community.
            </p>
            <div className="hero-buttons">
              {isAuthenticated ? (
                <Link 
                  to={redirectToDashboard()} 
                  className="btn btn-primary pulse-button"
                  onMouseEnter={handleButtonHover}
                >
                  Go to Dashboard
                </Link>
              ) : (
                <>
                  <Link 
                    to="/register" 
                    className="btn pulse-button"
                    onMouseEnter={handleButtonHover}
                  >
                    Get Started
                  </Link>
                  <Link 
                    to="/login" 
                    className="btn btn-outline"
                    onMouseEnter={handleButtonHover}
                  >
                    Login
                  </Link>
                </>
              )}
            </div>
          </div>
        </AnimatedElement>
      </section>

      {/* Features Section */}
      <AnimatedElement animation="fade-in">
        <section className="features" style={{ 
          transform: `translateY(${scrollPosition * 0.05}px)` 
        }}>
          <h2>Why Choose GymJam?</h2>
          <div className="features-grid">
            {[
              {
                icon: '🎵',
                title: 'Democratic Music Selection',
                description: 'Let members vote on music, creating a more engaging workout environment that everyone enjoys.'
              },
              {
                icon: '💪',
                title: 'Boost Member Engagement',
                description: 'Foster a stronger community with interactive music participation and real-time reactions.'
              },
              {
                icon: '🏆',
                title: 'Reward Active Participation',
                description: 'Gamify the experience with points for voting and suggesting popular tracks that members love.'
              },
              {
                icon: '🔄',
                title: 'Seamless Spotify Integration',
                description: 'Connect your Spotify account for easy access to millions of tracks and automatic playback.'
              }
            ].map((feature, index) => (
              <AnimatedElement key={index} animation="zoom-in" delay={index * 0.1}>
                <div 
                  className={`feature-card ${activeFeature === index ? 'feature-active' : ''}`}
                  onClick={() => handleFeatureClick(index)}
                >
                  <div className="feature-icon">{feature.icon}</div>
                  <h3>{feature.title}</h3>
                  <p>{feature.description}</p>
                  {activeFeature === index && (
                    <div className="feature-details">
                      <p>Click again to collapse</p>
                    </div>
                  )}
                </div>
              </AnimatedElement>
            ))}
          </div>
        </section>
      </AnimatedElement>

      {/* How It Works Section */}
      <AnimatedElement animation="fade-in">
        <section className="how-it-works">
          <h2>How It Works</h2>
          <div className="steps">
            {[
              {
                number: 1,
                title: 'Gym Owner Creates Account',
                description: 'Sign up as a gym owner, connect your Spotify account, and customize your gym profile.'
              },
              {
                number: 2,
                title: 'Members Join Via Invite',
                description: 'Invite members using a unique code, email, or QR code for quick access.'
              },
              {
                number: 3,
                title: 'Members Vote & Suggest',
                description: 'Members participate by voting on queued songs and suggesting new tracks.'
              },
              {
                number: 4,
                title: 'Music Plays Automatically',
                description: 'The system automatically plays the most popular songs based on votes and gym preferences.'
              }
            ].map((step, index) => (
              <AnimatedElement key={index} animation="slide-up" delay={index * 0.2}>
                <div className="step" onMouseEnter={() => setActiveFeature(null)}>
                  <div className="step-number">{step.number}</div>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                </div>
              </AnimatedElement>
            ))}
          </div>
        </section>
      </AnimatedElement>

      {/* Music Visualizer Section */}
      <AnimatedElement animation="fade-in">
        <section className="music-visualizer-section">
          <h2>Experience the Vibe</h2>
          <p className="section-description">
            Interact with our music visualizer for a taste of the GymJam experience
          </p>
          <MusicVisualizer />
        </section>
      </AnimatedElement>

      {/* CTA Section */}
      <AnimatedElement animation="fade-in">
        <section className="cta">
          <div className="cta-content">
            <h2>Ready to Transform Your Gym's Music Experience?</h2>
            <p>
              Join thousands of gyms already using GymJam to create a more engaging
              fitness environment.
            </p>
            <Link 
              to="/register" 
              className="btn btn-accent pulse-button"
              onMouseEnter={handleButtonHover}
            >
              Start Your Free Trial
            </Link>
          </div>
        </section>
      </AnimatedElement>
    </div>
  );
};

export default HomePage; 