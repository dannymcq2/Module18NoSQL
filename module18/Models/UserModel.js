const { Schema, model } = require('mongoose');

// Define the User schema
const userSchema = new Schema({
  username: {
    type: String,
    unique: true,
    required: true,
    trim: true, // Removes extra spaces
  },
  email: {
    type: String,
    required: true,
    unique: true,
    match: [/.+@.+\..+/, 'Must match a valid email address!'], // Mongoose email validation
  },
  thoughts: [
    {
      type: Schema.Types.ObjectId,
      ref: 'Thought', // Reference to Thought model
    }
  ],
  friends: [
    {
      type: Schema.Types.ObjectId,
      ref: 'User', // Self-reference to User model
    }
  ]
}, {
  toJSON: {
    virtuals: true, // Include virtual fields
  },
  id: false, // Prevent virtual 'id' field creation
});

// Virtual to calculate the number of friends
userSchema.virtual('friendCount').get(function() {
  return this.friends.length;
});

// Create and export the User model
const User = model('User', userSchema);

module.exports = User;