import React, { useEffect, useRef, useState } from 'react';
import './MusicVisualizer.css';

const MusicVisualizer = () => {
  const canvasRef = useRef(null);
  const [isActive, setIsActive] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animationFrameId;
    let particles = [];
    
    // Resize canvas to fill parent
    const resizeCanvas = () => {
      const parent = canvas.parentElement;
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
    };
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Particle class
    class Particle {
      constructor(x, y, size, color) {
        this.x = x;
        this.y = y;
        this.size = Math.random() * size + 2;
        this.color = color;
        this.speedX = Math.random() * 3 - 1.5;
        this.speedY = Math.random() * 3 - 1.5;
        this.life = 150 + Math.random() * 100;
      }
      
      update() {
        this.x += this.speedX;
        this.y += this.speedY;
        this.life--;
        if (this.life > 0) {
          this.size = this.size * 0.99;
        }
      }
      
      draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        
        // Add glow effect
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.color;
      }
    }
    
    // Create particles
    const createParticles = (x, y, amount, color) => {
      for (let i = 0; i < amount; i++) {
        particles.push(new Particle(x, y, 5, color));
      }
    };
    
    // Animation loop
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.shadowBlur = 0;
      
      // Draw particles
      particles.forEach((particle, index) => {
        particle.update();
        particle.draw(ctx);
        
        // Remove dead particles
        if (particle.life <= 0) {
          particles.splice(index, 1);
        }
      });
      
      // Create particles when active
      if (isActive) {
        createParticles(
          mousePos.x || canvas.width / 2, 
          mousePos.y || canvas.height / 2, 
          2, 
          `hsl(${Math.random() * 60 + 120}, 100%, 50%)`
        );
      }
      
      animationFrameId = requestAnimationFrame(animate);
    };
    
    animate();
    
    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animationFrameId);
    };
  }, [isActive, mousePos]);
  
  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
  };
  
  return (
    <div className="visualizer-container">
      <canvas 
        ref={canvasRef} 
        className="music-visualizer"
        onMouseEnter={() => setIsActive(true)}
        onMouseLeave={() => setIsActive(false)}
        onMouseMove={handleMouseMove}
        onClick={() => {
          // Add a burst of particles on click
          const canvas = canvasRef.current;
          const particles = 20;
          const colors = ['#00FF41', '#00FFFF', '#38FF00', '#FFD600'];
          
          for (let i = 0; i < particles; i++) {
            setTimeout(() => {
              const color = colors[Math.floor(Math.random() * colors.length)];
              const x = mousePos.x || canvas.width / 2;
              const y = mousePos.y || canvas.height / 2;
              
              // Create a burst effect
              for (let j = 0; j < 10; j++) {
                const event = new MouseEvent('mousemove', {
                  clientX: x + Math.random() * 50 - 25,
                  clientY: y + Math.random() * 50 - 25
                });
                canvas.dispatchEvent(event);
              }
            }, i * 20);
          }
        }}
      />
      <div className="visualizer-overlay">
        <h3>Interactive Music Experience</h3>
        <p>Move your mouse or tap to interact</p>
      </div>
    </div>
  );
};

export default MusicVisualizer; 