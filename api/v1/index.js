var express = require('express');
var router = express.Router();

// TODO api paths
var lyricsRouter = require('./lyrics');
var tracksRouter = require('./tracks');

router.use('/lyrics', lyricsRouter);
router.use('/tracks', tracksRouter);

module.exports = router;