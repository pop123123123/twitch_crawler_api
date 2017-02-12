var express = require('express');
var rp = require('request-promise');
var path = require("path");
var MongoClient = require("mongodb").MongoClient;
var bodyParser = require("body-parser");
var cors = require('cors')
var app = express();

app.use(bodyParser.urlencoded({
    extended: false
}));
app.use(bodyParser.json());
app.use(cors())


const headers = {
    Accept: 'application/vnd.twitchtv.v5+json',
    'Client-ID': process.env.TWITCH_API
}

// IO functions

function addStreamerToDb(streamer) {
    MongoClient.connect("mongodb://localhost/twitch_channels", function(error, db) {
        if (error) return funcCallback(error);

        db.collection("streamers").insert(streamer, null, function(error, results) {
            if (error) throw error;

            //console.log("Streamer has been saved");
        });
    });
}

function getStreamerFromDB(name, callback) {
    MongoClient.connect("mongodb://localhost/twitch_channels", function(error, db) {
        if (error) return funcCallback(error);

        db.collection("streamers").findOne({
            name: name
        }, callback);
    });
}

function getStreamerFromTwitch(name, callback) {
    rp({
            uri: 'https://api.twitch.tv/kraken/search/channels?limit=1&query=' + name,
            headers: headers,
            json: true
        }).then(function(data) {
            var streamer = data.channels[0];

            rp({
                    uri: 'https://api.twitch.tv//api/channels/' + streamer.name + '/panels',
                    headers: headers,
                    json: true
                }).then((data) => {
                    streamer.panels = data;
                    callback(streamer);
                })
                .catch(function(err) {
                    console.log(err);
                });
        })
        .catch(function(err) {
            console.log(err);
        });
}

// Routing

app.get('/streamers', (req, res) => {
    MongoClient.connect("mongodb://localhost/twitch_channels", function(error, db) {
        if (error) return funcCallback(error);

        db.collection("streamers").find().toArray(function(error, results) {
            if (error) throw error;
            res.setHeader('Content-Type', 'text/plain');
            res.send(results);
        });
    });
});

app.get('/streamers/:username', (req, res) => {
    var name = req.params.username;
    getStreamerFromDB(name, (error, result) => {
        if (error) throw error;
        res.setHeader('Content-Type', 'text/plain');
        if (result != null) {
            res.send(result);
        } else {
            res.send({});
        }
    });
});


app.post('/streamers', function(req, res) {
    var name = req.body.username;
    getStreamerFromDB(name, (error, result) => {
        if (error) throw error;
        if (result != null) {
            res.setHeader('Content-Type', 'text/plain');
            res.send(result);
        } else {
            getStreamerFromTwitch(name, (streamer) => {
                getStreamerFromDB(streamer.name, (error, result) => {
                    if (error) throw error;
                    if (result != null) {
                        res.setHeader('Content-Type', 'text/plain');
                        res.send(result);
                    } else {
                        addStreamerToDb(streamer);

                        res.setHeader('Content-Type', 'text/plain');
                        res.send(streamer);
                    }

                });
            });
        }
    });
});

app.listen(8888);
