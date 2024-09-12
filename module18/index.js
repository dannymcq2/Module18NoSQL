const express = require('express');
const mongoose = require('mongoose');

// Import routes
const userRoutes = require('./Routes/UserRoutes');
const thoughtRoutes = require('./Routes/ThoughtRoutes');

// Initialize express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse incoming JSON and URL-encoded data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Log the request method and URL for every request (useful for debugging)
app.use((req, res, next) => {
  console.log(`${req.method} request to ${req.url}`);
  next();
});

// Routes
app.use('/api/users', userRoutes);  // Route for user-related operations
app.use('/api/thoughts', thoughtRoutes);  // Route for thought-related operations

// MongoDB connection
mongoose.connect('mongodb://127.0.0.1:27017/socialNetworkDB')
  .then(() => {
    console.log('MongoDB connected successfully');
    
    // Start the server after connecting to the database
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Error connecting to MongoDB:', err.message);
  });

// Error handling middleware (in case any route throws an error)
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong on the server!' });
});