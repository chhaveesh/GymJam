import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './Navbar.css';

const Navbar = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const onLogout = () => {
    logout();
    navigate('/');
  };

  const authLinks = (
    <>
      {user && user.role === 'gym_owner' && (
        <li>
          <Link to="/owner/dashboard" onClick={() => setIsMenuOpen(false)}>
            Dashboard
          </Link>
        </li>
      )}
      {user && user.role === 'gym_member' && (
        <li>
          <Link to="/member/dashboard" onClick={() => setIsMenuOpen(false)}>
            Dashboard
          </Link>
        </li>
      )}
      <li>
        <a href="#!" onClick={onLogout}>
          Logout
        </a>
      </li>
    </>
  );

  const guestLinks = (
    <>
      <li>
        <Link to="/login" onClick={() => setIsMenuOpen(false)}>
          Login
        </Link>
      </li>
      <li>
        <Link to="/register" onClick={() => setIsMenuOpen(false)}>
          Register
        </Link>
      </li>
    </>
  );

  return (
    <nav className="navbar">
      <div className="container navbar-container">
        <h1 className="logo">
          <Link to="/">
            <span className="primary">Gym</span>
            <span className="accent">Jam</span>
          </Link>
        </h1>
        <button className="menu-toggle" onClick={toggleMenu}>
          <span className="bar"></span>
          <span className="bar"></span>
          <span className="bar"></span>
        </button>
        <ul className={`nav-menu ${isMenuOpen ? 'active' : ''}`}>
          <li>
            <Link to="/" onClick={() => setIsMenuOpen(false)}>
              Home
            </Link>
          </li>
          {isAuthenticated ? authLinks : guestLinks}
        </ul>
      </div>
    </nav>
  );
};

export default Navbar; 