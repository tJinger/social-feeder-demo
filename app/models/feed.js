let mongoose = require('mongoose')

require('songbird')

let feedSchema = mongoose.Schema({
  id: String,
  image: String,
  text: String,
  name: String,
  username: String,
  liked: {
    type: Boolean,
    default: false
  },
  network: {
    icon: String,
    name: String,
    class: String
  },
  date: Date
})

module.exports = mongoose.model('Feed', feedSchema)