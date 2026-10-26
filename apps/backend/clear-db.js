const batchSize = 1000

module.exports = async db => {
  while (true) {
    const docs = await db.findAsync({}).projection({ _id: 1 }).limit(batchSize)
    if (!docs.length) return

    await db.removeAsync({ _id: { $in: docs.map(doc => doc._id) } }, { multi: true })
  }
}
