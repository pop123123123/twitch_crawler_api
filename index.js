var express = require('express');
var rp = require('request-promise');
var path = require("path");
var mongoose = require('mongoose');
var bodyParser = require("body-parser");
var cors = require('cors')
var app = express();


const db_path = 'mongodb://localhost/twitch_channels';

const headers = {
    Accept: 'application/vnd.twitchtv.v5+json',
    'Client-ID': process.env.TWITCH_API
}

app.use(bodyParser.urlencoded({
    extended: false
}));
app.use(bodyParser.json());
app.use(cors())
mongoose.connect(db_path);

// Models definitions

var Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId;

let ChannelSchema = new Schema({
    mature: {
        type: Boolean,
        default: false
    },
    broadcaster_language: {
        type: String,
        default: 'en'
    },
    display_name: {
        type: String,
        default: 'None'
    },
    game: {
        type: String,
        default: 'None'
    },
    language: {
        type: String,
        default: 'en'
    },
    _id: Number,
    name: String,
    logo: String,
    video_banner: String,
    profile_banner: String,
    url: String,
    views: Number,
    followers: Number,
});
var Channel = mongoose.model('Channel', ChannelSchema);

let PanelSchema = new Schema({
    _id: Number,
    display_order: Number,
    kind: String,
    html_description: String,
    user_id: Number,
    data: {
        link: String,
        image: String,
        title: String
    },
    channel: String
});
var Panel = mongoose.model('Panel', PanelSchema);

// IO functions

function addStreamerToDb(streamer) {
    (new Channel(streamer)).save((err) => {
        console.log(err);
    });
    for (let i = 0; i < streamer.panels.length; i++) {
        (new Panel(streamer.panels[i])).save((err) => {
            console.log(err);
        });
    }
}

function getStreamerFromDB(name, callback) {
    Channel.findOne({
        name: name
    }).lean().exec().then((docs) => {
        if (docs == null) {
            callback(null)
        } else {
            var streamer = docs;
            Panel.find({
                channel: streamer.name
            }).lean().exec().then((docs) => {
                streamer.panels = docs;
                callback(streamer);
            })
            .catch(function(err) {
                console.log(err);
            });
        }
    })
    .catch(function(err) {
        console.log(err);
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
    Channel.find({}, function(err, docs) {
        if (err) return funcCallback(err);
        var streamer = docs;
        res.setHeader('Content-Type', 'text/plain');
        res.send(docs);

    });
});

app.get('/streamers/:username', (req, res) => {
    var name = req.params.username;
    getStreamerFromDB(name, (result) => {
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
    getStreamerFromDB(name, (result) => {
        if (result != null) {
            res.setHeader('Content-Type', 'text/plain');
            res.send(result);
        } else {
            getStreamerFromTwitch(name, (streamer) => {
                getStreamerFromDB(streamer.name, (result) => {
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
