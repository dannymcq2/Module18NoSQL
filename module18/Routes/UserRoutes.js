const express = require('express');
const router = express.Router(); // Initialize the router

const { getUsers, createUser, updateUser, deleteUser, addFriend, removeFriend } = require('../Controllers/UserController');

router.route('/')
  .get(getUsers)
  .post(createUser);

router.route('/:id')
  .put(updateUser)
  .delete(deleteUser);

// Friends routes
router.route('/:userId/friends/:friendId')
  .post(addFriend)
  .delete(removeFriend);

module.exports = router;