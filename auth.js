const express = require('express');
const request = require('request');
const querystring = require('querystring');
const cookieParser = require('cookie-parser');
const usersDb = require('./users/db.js');

const config = require('./config');

const stateKey = 'spotify_auth_state';
const generateRandomString = function(length) {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
};

const app = express();
app.use(cookieParser());

app.get('/login', (req, res) => {
    const state = generateRandomString(16);
    res.cookie(stateKey, state);

    const scope = 'user-follow-read playlist-modify-public';
    res.redirect(`https://accounts.spotify.com/authorize?${
        querystring.stringify({
            response_type: 'code',
            client_id: config.client_id,
            scope,
            redirect_uri: config.redirect_uri,
            state
        })}`
    );
});

app.get('/callback', (req, res) => {
    const code = req.query.code || null;
    const state = req.query.state || null;
    const storedState = req.cookies ? req.cookies[stateKey] : null;

    if (state === null || state !== storedState) {
        return res.end(`state_mismatch`);
    }

    res.clearCookie(stateKey);
    const authOptions = {
        url: 'https://accounts.spotify.com/api/token',
        form: {
            code,
            redirect_uri: config.redirect_uri,
            grant_type: 'authorization_code'
        },
        headers: {
            Authorization: `Basic ${new Buffer(`${config.client_id}:${config.client_secret}`).toString('base64')}`
        },
        json: true
    };

    request.post(authOptions, (error, response, body) => {
        res.clearCookie(stateKey);

        if (!error && response.statusCode === 200) {
            const access_token = body.access_token;
            const refresh_token = body.refresh_token;

            const options = {
                url: 'https://api.spotify.com/v1/me',
                headers: {Authorization: `Bearer ${access_token}`},
                json: true
            };

            request.get(options, (error, response, body) => {
                console.log('Logged user', body);
                usersDb.update({_id: body.id}, {access_token, refresh_token}, {upsert: true});
            });

            res.end('ok');
        } else {
            res.end('invalid_token');
        }
    });
});

module.exports = app;
