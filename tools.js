const request = require('request');
const usersDb = require('./users/db.js');

const config = require('./config');

exports.refresh = async _id => {
    return new Promise(resolve => {
        usersDb.findOne({_id}, (err, doc) => {
            const authOptions = {
                url: 'https://accounts.spotify.com/api/token',
                headers: {Authorization: `Basic ${new Buffer(`${config.client_id}:${config.client_secret}`).toString('base64')}`},
                form: {
                    grant_type: 'refresh_token',
                    refresh_token: doc.refresh_token
                },
                json: true
            };

            request.post(authOptions, (error, response, body) => {
                if (!error && response.statusCode === 200) {
                    const access_token = body.access_token;

                    usersDb.update({_id}, {$set: {access_token}});

                    resolve(access_token);
                }
            });
        });
    });
};
