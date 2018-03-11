const Datastore = require('nedb');
module.exports = new Datastore({filename: `${__dirname}/db`, autoload: true});
