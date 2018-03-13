const Datastore = require('nedb');
module.exports = new Datastore({filename: `${__dirname}/dbs/db`, autoload: true});
