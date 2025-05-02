import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import './HeroVisualizer.css';

// Particle class defined outside of useEffect to be accessible throughout the component
class Particle {
  constructor(x, y, size, color) {
    this.x = x;
    this.y = y;
    this.size = Math.random() * size + 2;
    this.color = color;
    this.speedX = Math.random() * 2 - 1;
    this.speedY = Math.random() * 2 - 1;
    this.life = 200 + Math.random() * 200;
    this.alpha = 1;
  }
  
  update() {
    this.x += this.speedX;
    this.y += this.speedY;
    this.life--;
    if (this.life > 0) {
      this.size = this.size * 0.998;
      this.alpha = this.life / 400;
    }
  }
  
  draw(ctx) {
    ctx.globalAlpha = this.alpha;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    
    // Add glow effect
    ctx.shadowBlur = 15;
    ctx.shadowColor = this.color;
    ctx.globalAlpha = 1;
  }
}

const HeroVisualizer = forwardRef((props, ref) => {
  const canvasRef = useRef(null);
  const [isActive, setIsActive] = useState(true);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  
  // Particle storage
  const particlesRef = useRef([]);
  
  // Create particles function accessible both from useEffect and exposed methods
  const createParticles = (x, y, amount, color) => {
    if (!canvasRef.current) return;
    
    // Create and add particles to the ref
    for (let i = 0; i < amount; i++) {
      particlesRef.current.push(new Particle(x, y, 5, color));
    }
  };
  
  // Expose functions to the parent component via ref
  useImperativeHandle(ref, () => ({
    createBurst: (x, y) => {
      if (!canvasRef.current) return;
      
      const particles = 30;
      const colors = ['#00FF41', '#00FFFF', '#38FF00', '#00FF84'];
      
      for (let i = 0; i < particles; i++) {
        setTimeout(() => {
          const color = colors[Math.floor(Math.random() * colors.length)];
          
          // Create a burst effect
          for (let j = 0; j < 5; j++) {
            const randomX = x + Math.random() * 100 - 50;
            const randomY = y + Math.random() * 100 - 50;
            createParticles(randomX, randomY, 3, color);
          }
        }, i * 10);
      }
    }
  }));
  
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animationFrameId;
    
    // Resize canvas to fill parent
    const resizeCanvas = () => {
      const parent = canvas.parentElement;
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
    };
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Create automatic particles
    const createRandomParticles = () => {
      if (Math.random() > 0.8) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const color = `hsl(${Math.random() * 60 + 120}, 100%, 50%)`;
        createParticles(x, y, 1, color);
      }
    }
    
    // Animation loop
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.shadowBlur = 0;
      
      // Create random particles
      createRandomParticles();
      
      // Draw particles
      particlesRef.current.forEach((particle, index) => {
        particle.update();
        particle.draw(ctx);
        
        // Remove dead particles
        if (particle.life <= 0) {
          particlesRef.current.splice(index, 1);
        }
      });
      
      // Create particles when active
      if (isActive && mousePos.x && mousePos.y) {
        createParticles(
          mousePos.x, 
          mousePos.y, 
          1, 
          `hsl(${Math.random() * 60 + 120}, 100%, 50%)`
        );
      }
      
      animationFrameId = requestAnimationFrame(animate);
    };
    
    animate();
    
    // Initial bursts to draw attention
    setTimeout(() => {
      for (let i = 0; i < 5; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        createParticles(x, y, 20, `hsl(${Math.random() * 60 + 120}, 100%, 50%)`);
      }
    }, 500);
    
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
    <div className="hero-visualizer-container">
      <canvas 
        ref={canvasRef} 
        className="hero-visualizer"
        onMouseEnter={() => setIsActive(true)}
        onMouseLeave={() => setIsActive(true)} // Keep active even when mouse leaves
        onMouseMove={handleMouseMove}
        onClick={(e) => {
          // Add a burst of particles on click
          const canvas = canvasRef.current;
          const rect = canvas.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          
          const particles = 30;
          const colors = ['#00FF41', '#00FFFF', '#38FF00', '#00FF84'];
          
          for (let i = 0; i < particles; i++) {
            setTimeout(() => {
              const color = colors[Math.floor(Math.random() * colors.length)];
              
              // Create a burst effect
              for (let j = 0; j < 5; j++) {
                const randomX = x + Math.random() * 100 - 50;
                const randomY = y + Math.random() * 100 - 50;
                createParticles(randomX, randomY, 3, color);
              }
            }, i * 10);
          }
        }}
      />
    </div>
  );
});

export default HeroVisualizer; 