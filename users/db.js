const Datastore = require('@seald-io/nedb')

module.exports = new Datastore({
  filename: `${__dirname}/dbs/db`,
  autoload: true,
})
