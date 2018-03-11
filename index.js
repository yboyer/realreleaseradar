const axios = require('axios');
const Datastore = require('nedb');
const usersDb = require('./users/db.js');
const cron = require('node-cron');

const date = new Date();
date.setDate(date.getDate() - 15);
const fifteenDays = date.getTime();

const {refresh} = require('./tools');

const find = (db, query = {}) => new Promise((resolve, reject) => {
    db.find(query, (err, docs) => {
        if (err) {
            return reject(err);
        }
        resolve(docs.map(i => i._id));
    });
});

class SpotifyCrawler {
    constructor(username) {
        this.request = axios.create({
            baseURL: 'https://api.spotify.com/v1'
        });
        this.username = username;

        console.log(this.username);

        this.artistsDb = new Datastore({filename: `users/dbs/${this.username}/artists`, autoload: true});
        this.albumsDb = new Datastore({filename: `users/dbs/${this.username}/albums`, autoload: true});
        this.tracksDb = new Datastore({filename: `users/dbs/${this.username}/tracks`, autoload: true});
    }

    async init() {
        const token = await refresh(this.username);
        this.request.defaults.headers.common.Authorization = `Bearer ${token}`;
    }

    async getArtists(last) {
        console.log(`Getting artists for ${this.username}`);
        const artistsIds = await find(this.artistsDb);
        const doNotIncludes = e => !artistsIds.includes(e.id);

        return this.request.get(`/me/following?type=artist&limit=50${last ? `&after=${last}` : ''}`).then(({data}) => {
            if (!data.artists.items.length) {
                return artistsIds;
            }

            return new Promise((resolve, reject) => {
                this.artistsDb.insert(data.artists.items.filter(doNotIncludes).map(i => ({_id: i.id})), async (err, newDocs) => {
                    if (err) {
                        return reject(err);
                    }

                    const lastArtist = newDocs.pop();
                    if (!lastArtist) {
                        const artists = await find(this.artistsDb);
                        return resolve(artists);
                    }

                    this.getArtists(lastArtist._id).then(resolve, reject);
                });
            });
        });
    }

    async getAlbums(artist) {
        console.log(`Getting albums for ${artist}`);
        const albumsIds = await find(this.albumsDb);
        const doNotIncludes = e => !albumsIds.includes(e.id);
        const isReallyNew = e => new Date(e.release_date) > fifteenDays;

        return this.request.get(`/artists/${artist}/albums?album_type=single,album&market=FR&limit=4&offset=0`).then(({data}) => {
            if (!data.items.length) {
                return;
            }

            return new Promise((resolve, reject) => {
                this.albumsDb.insert(data.items.filter(isReallyNew).filter(doNotIncludes).map(i => ({_id: i.id})), (err, newDocs) => {
                    if (err) {
                        return reject(err);
                    }

                    resolve(newDocs.map(d => d._id));
                });
            });
        });
    }

    async getTracks(albums) {
        if (!albums.length) {
            return [];
        }
        console.log(`Getting tracks for ${albums}`);

        const tracksIds = await find(this.tracksDb);
        const doNotIncludes = e => !tracksIds.includes(e);

        return this.request.get(`/albums?ids=${albums.join(',')}`).then(({data}) => {
            const tracks = [].concat(...data.albums.map(a => a.tracks.items.map(i => i.uri)));

            return new Promise((resolve, reject) => {
                this.tracksDb.insert(tracks.filter(doNotIncludes).map(i => ({_id: i})), (err, newDocs) => {
                    if (err) {
                        return reject(err);
                    }

                    resolve(newDocs.map(d => d._id));
                });
            });
        });
    }

    async getPlaylist() {
        return this.request.get(`/users/${this.username}/playlists`).then(({data}) => {
            const playlist = data.items.filter(i => i.name === 'RealReleaseRadar')[0];

            if (playlist) {
                return playlist.id;
            }

            return this.request.post(`/users/${this.username}/playlists`, {
                name: 'RealReleaseRadar'
            }).then(({data}) => {
                return data.id;
            });
        });
    }

    async addTracks(playlist, tracks) {
        const chunkSize = 100;
        const chunks = [];
        for (let i = 0, j = tracks.length; i < j; i += chunkSize) {
            chunks.push(tracks.slice(i, i + chunkSize));
        }

        const url = `/users/${this.username}/playlists/${playlist}/tracks`;

        console.log('New tracks:', tracks.length);

        return this.request.put(url, {uris: chunks.shift() || []}).then(() => {
            return chunks.reduce((chain, m) =>
                chain.then(() =>
                    this.request.post(url, {uris: m})
                ), Promise.resolve()
            ).then(() => {});
        });
    }
}

const start = async () => {
    const users = await find(usersDb);

    return users.reduce((chain, user) =>
        chain.then(async () => {
            const crawler = new SpotifyCrawler(user);
            await crawler.init();
            console.log('yaaa');

            console.time('Process');
            return crawler.getPlaylist()
                .then(playlist => {
                    return crawler.getArtists().then(artists => {
                        return artists.reduce((chain, artist) =>
                            chain.then((alltracks = []) =>
                                crawler.getAlbums(artist)
                                    .then(albums => crawler.getTracks(albums))
                                    .then(tracks => alltracks.concat(tracks))
                            )
                        , Promise.resolve());
                    }).then(tracks => crawler.addTracks(playlist, tracks));
                })
                .then(() => console.timeEnd('Process'))
                .catch(console.error);
        }), Promise.resolve()
    );
};

if (process.env.NODE_ENV === 'production') {
    cron.schedule('0 0 * * 5', () => {
        start();
    });
} else {
    start();
}
