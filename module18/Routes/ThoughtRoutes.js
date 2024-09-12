const router = require('express').Router();
const { getThoughts, createThought, getSingleThought, updateThought, deleteThought, addReaction, removeReaction } = require('../Controllers/ThoughtController');

// Thought routes
router.route('/')
  .get(getThoughts)
  .post(createThought);

router.route('/:id')
  .get(getSingleThought)
  .put(updateThought)
  .delete(deleteThought);

// Reaction routes
router.route('/:thoughtId/reactions')
  .post(addReaction);

router.route('/:thoughtId/reactions/:reactionId')
  .delete(removeReaction);

module.exports = router;