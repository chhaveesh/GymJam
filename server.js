const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
// const connectDB = require('./config/db');

// Load environment variables
dotenv.config();

// Connect to database
// connectDB();
console.log('Database connection bypassed for testing');

// Initialize Express
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// API Routes
// app.use('/api/auth', require('./routes/authRoutes'));
// TODO: Add more routes as they are created

// Test route
app.get('/api/test', (req, res) => {
  res.json({ message: 'API is running!' });
});

// Serve static assets in production
if (process.env.NODE_ENV === 'production') {
  // Set static folder
  app.use(express.static('client/build'));

  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'client', 'build', 'index.html'));
  });
}

// Define port
const PORT = process.env.PORT || 5001;

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.log(`Error: ${err.message}`);
  // Close server & exit process
  // server.close(() => process.exit(1));
}); 