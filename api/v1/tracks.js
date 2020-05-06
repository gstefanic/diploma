var express = require('express');
var router = express.Router();

var tracksData = [
    {
        'id': '0',
        'title': 'Let It Go',
        'src': '/mp3/let-it-go.mp3',
        'lyrics': '/api/v1/lyrics/1',
        'speechLayout': 'false'
    }
];

router.get('/', function(req, res, next) {
    console.log('GET /api/v1/tracks/')
    res.json(tracksData);
});

router.get('/:id', function(req, res, next) {
    console.log('GET /api/v1/tracks/' + req.params.id)
    var track = tracksData.find(function(track) {
        console.log('track.id:', track.id);
        return track.id == req.params.id;
    });
    console.log('track:', track);
    if (!track) {
        res.status(404);
        res.json(null);
    } else {
        res.json(track);
    }
});

module.exports = router;