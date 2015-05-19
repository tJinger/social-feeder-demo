let https = require('https')
let auth = require('../../config/auth')

exports.get = function(apiPath, accesstoken, callback) {
    let options = {
        host: 'graph.facebook.com',
       // port: 443,
        path: apiPath + '?access_token=' + accesstoken
    }
    let buffer = ''
    let request = https.get(options, function(result){
      result.setEncoding('utf8')
      result.on('data', function(chunk){
        buffer += chunk
      })
      result.on('end', function(){
        callback(buffer)
      })
    })
    request.on('error', function(e){
      console.log('error from facebook.get(): '+ e.message)
    })
    request.end()
}