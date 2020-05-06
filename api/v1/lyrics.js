var express = require('express');
var router = express.Router();
const path = require('path');

var lyricsData = {
    '1': '/lyrics/let-it-go.json'
}

router.get('/:id', function(req, res, next) {
    console.log('GET /api/v1/lyrics/' + req.params.id);
    var filePath = path.join(__dirname, '../../public', lyricsData[req.params.id]);
    console.log('filePath:', filePath);

    res.header("Content-Type",'application/json');
    res.sendFile(filePath);
});

router.put('/:id', function(req, res, next) {
    console.log('PUT /api/v1/lyrics/' + req.params.id, req.body);
    res.json(req.body);
});

module.exports = router;