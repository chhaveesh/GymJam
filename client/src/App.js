import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

// Layout components
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';

// Pages
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';

// Spinner component
import Spinner from './components/ui/Spinner';

// 404 Page
const NotFoundPage = () => (
  <div style={{ 
    textAlign: 'center', 
    padding: '80px 20px',
    minHeight: '70vh',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    background: '#000000',
    color: '#00FF41'
  }}>
    <h2 style={{
      fontSize: '28px',
      marginBottom: '20px',
      letterSpacing: '-0.5px',
      fontWeight: '600'
    }}>404 - Page Not Found</h2>
    <p style={{
      fontSize: '18px',
      marginBottom: '30px',
      maxWidth: '500px',
      color: '#CCCCCC'
    }}>The page you are looking for doesn't exist or has been moved.</p>
    <a href="/" style={{ 
      marginTop: '20px',
      padding: '12px 30px',
      background: '#00FF41',
      color: '#000000',
      borderRadius: '50px',
      textDecoration: 'none',
      fontWeight: '600',
      transition: 'all 0.3s ease'
    }}>Return Home</a>
  </div>
);

// Layout component to apply container class conditionally
const AppLayout = () => {
  const location = useLocation();
  const isAuthPage = ['/login', '/register'].includes(location.pathname);
  
  return (
    <div className="app">
      <Navbar />
      <main className={isAuthPage ? '' : 'container'}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
};

function App() {
  const { isLoading } = useAuth();

  if (isLoading) {
    return <Spinner />;
  }

  return (
    <Router>
      <Routes>
        <Route path="*" element={<AppLayout />} />
      </Routes>
    </Router>
  );
}

export default App;