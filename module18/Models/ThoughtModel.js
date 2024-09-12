const { Schema, model, Types } = require('mongoose');
const reactionSchema = require('./ReactionModel'); // Import reaction schema

const thoughtSchema = new Schema({
  thoughtText: {
    type: String,
    required: true,
    minlength: 1,
    maxlength: 280,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    get: (timestamp) => new Date(timestamp).toLocaleString() // Example formatting
  },
  username: {
    type: String,
    required: true,
  },
  reactions: [reactionSchema], // Use reaction schema as subdocument
}, {
  toJSON: {
    virtuals: true,
    getters: true
  },
  id: false,
});

// Virtual to calculate reaction count
thoughtSchema.virtual('reactionCount').get(function() {
  return this.reactions.length;
});

const Thought = model('Thought', thoughtSchema);
module.exports = Thought;