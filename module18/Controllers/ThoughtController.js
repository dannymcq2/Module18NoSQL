const Thought = require('../Models/ThoughtModel');
const User = require('../Models/UserModel');

const thoughtController = {
  // GET all thoughts
  getThoughts(req, res) {
    Thought.find({})
      .then(dbThoughtData => res.json(dbThoughtData))
      .catch(err => res.status(500).json(err));
  },

  // GET single thought by ID
  getSingleThought(req, res) {
    Thought.findById(req.params.id)
      .then(dbThoughtData => {
        if (!dbThoughtData) {
          return res.status(404).json({ message: 'No thought found with this ID' });
        }
        res.json(dbThoughtData);
      })
      .catch(err => res.status(500).json(err));
  },

  // POST new thought
  createThought({ body }, res) {
    Thought.create(body)
      .then(({ _id }) => {
        return User.findOneAndUpdate(
          { _id: body.userId },
          { $push: { thoughts: _id } },
          { new: true }
        );
      })
      .then(dbUserData => res.json(dbUserData))
      .catch(err => res.status(400).json(err));
  },

  // PUT update thought by ID
  updateThought(req, res) {
    Thought.findByIdAndUpdate(req.params.id, req.body, { new: true })
      .then(dbThoughtData => {
        if (!dbThoughtData) {
          return res.status(404).json({ message: 'No thought found with this ID' });
        }
        res.json(dbThoughtData);
      })
      .catch(err => res.status(500).json(err));
  },

  // DELETE thought by ID
  deleteThought(req, res) {
    Thought.findByIdAndDelete(req.params.id)
      .then(dbThoughtData => {
        if (!dbThoughtData) {
          return res.status(404).json({ message: 'No thought found with this ID' });
        }
        res.json({ message: 'Thought deleted' });
      })
      .catch(err => res.status(500).json(err));
  },

  // POST a reaction
  addReaction(req, res) {
    Thought.findByIdAndUpdate(
      req.params.thoughtId,
      { $push: { reactions: req.body } },
      { new: true }
    )
      .then(dbThoughtData => res.json(dbThoughtData))
      .catch(err => res.status(500).json(err));
  },

  // DELETE a reaction
  removeReaction(req, res) {
    Thought.findByIdAndUpdate(
      req.params.thoughtId,
      { $pull: { reactions: { reactionId: req.params.reactionId } } },
      { new: true }
    )
      .then(dbThoughtData => res.json(dbThoughtData))
      .catch(err => res.status(500).json(err));
  },
};

module.exports = thoughtController;