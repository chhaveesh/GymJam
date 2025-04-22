import React from 'react';
import './Footer.css';

const Footer = () => {
  return (
    <footer className="footer">
      <div className="container footer-container">
        <div className="footer-logo">
          <span className="primary">Gym</span>
          <span className="accent">Jam</span>
        </div>
        <div className="footer-content">
          <div className="footer-section">
            <h3>About</h3>
            <p>
              GymJam is a social music platform for fitness centers that empowers
              gym members to participate in music selection through voting and
              suggestions.
            </p>
          </div>
          <div className="footer-section">
            <h3>Quick Links</h3>
            <ul>
              <li><a href="/">Home</a></li>
              <li><a href="/login">Login</a></li>
              <li><a href="/register">Register</a></li>
            </ul>
          </div>
          <div className="footer-section">
            <h3>Contact</h3>
            <p>
              Email: info@gymjam.com<br />
              Phone: (123) 456-7890
            </p>
          </div>
        </div>
        <div className="footer-bottom">
          <p>&copy; {new Date().getFullYear()} GymJam. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer; 