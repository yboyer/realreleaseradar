const Datastore = require('@yetzt/nedb')

module.exports = new Datastore({
  filename: `${__dirname}/dbs/db`,
  autoload: true,
})
