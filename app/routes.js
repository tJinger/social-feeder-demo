let _ = require('lodash-node')
let nodeifyit = require('nodeifyit')
let Twitter = require('twitter')
let isLoggedIn = require('./middlewares/isLoggedIn')
let posts = require('../data/posts')
let then = require('express-then')
let request = require('request')
let facebook = require('./middlewares/facebook')
let Feed = require('./models/feed')
let googleapis = require('googleapis')
let googlePlus = googleapis.plus('v1')
let oauth2 = googleapis.auth.OAuth2
let oauth2Client = new oauth2()
let networks = {
  twitter: {
    icon: 'twitter',
    name: 'Twitter',
    class: 'btn-primary'
  },
  facebook: {
    icon: 'facebook',
    name: 'Facebook',
    class: 'btn-danger'
  },
  google: {
    icon: 'google',
    name: 'Google Plus',
    class: 'btn-primary'
  }
}
require('songbird')

module.exports = (app) => {
  let passport = app.passport
  let twitterConfig = app.config.auth.twitter

  app.get('/', (req, res) => res.render('index.ejs'))

  app.get('/profile', isLoggedIn, (req, res) => {
    res.render('profile.ejs', {
      user: req.user,
      message: req.flash('error')
    })
  })

  app.get('/logout', (req, res) => {
    req.logout()
    res.redirect('/')
  })

  app.get('/login', (req, res) => {
    res.render('login.ejs', {message: req.flash('error')})
  })

  app.get('/signup', (req, res) => {
    res.render('signup.ejs', {message: req.flash('error') })
  })

  app.get('/timeline', isLoggedIn, nodeifyit(getTimeline, {spread: true}), (req, res) => {
    res.render('timeline.ejs', {
      posts: req.posts,
      message: req.flash('error')
    })
  })

  app.get('/share/:postId', isLoggedIn, (req, res) => {
    res.render('share.ejs', {
      postId: req.params.postId,
      message: req.flash('error')
    })
  })

  app.post('/share/:postId', isLoggedIn, then(async (req, res) => {
    let post = await Feed.promise.findOne({'id': req.params.postId})
    let network = post.network.icon
    let message = req.body.share

    if (message.length > 140) {
      return req.flash('error', 'Share message is over 140 characters!')
    }

    if (network === 'twitter') {
      let twitterClient = new Twitter({
        consumer_key: twitterConfig.consumerKey,
        consumer_secret: twitterConfig.consumerSecret,
        access_token_key: req.user.twitter.token,
        access_token_secret: req.user.twitter.tokenSecret
      })
      await twitterClient.promise.post('statuses/retweet/'+ post.id)
    }

    res.redirect('/timeline')
  }))

  app.get('/reply/:postId', isLoggedIn, then (async (req, res) => {
    let post = await Feed.promise.findOne({'id': req.params.postId})
    res.render('reply.ejs', {
      post: post,
      message: req.flash('error')
    })
  }))

  app.post('/reply/:postId', isLoggedIn, then (async (req, res) => {
    let reply = req.body.reply
    let post = await Feed.promise.findOne({'id': req.params.postId})
    let network = post.network.icon

    if (network === 'twitter') {
      let twitterClient = new Twitter({
        consumer_key: twitterConfig.consumerKey,
        consumer_secret: twitterConfig.consumerSecret,
        access_token_key: req.user.twitter.token,
        access_token_secret: req.user.twitter.tokenSecret
      })
      await twitterClient.promise.post('statuses/update', {
        status: '@' + req.user.twitter.username + ' ' + reply,
        in_reply_to_status_id: post.id
      })
    }

    if (network === 'facebook') {
      let url = 'https://graph.facebook.com/' + post.id + '/comments'
      let options = {
        access_token: req.user.facebook.token,
        message: reply
      }
      await request.promise.post({url: url, qs: options})
    }
    res.redirect('/timeline')
  }))

  app.get('/compose', isLoggedIn, (req, res) => {
    res.render('compose.ejs', {message: req.flash('error') })
  })

  app.post('/compose', isLoggedIn, then(async (req, res) => {
    let status = req.body.text
    let network = req.body.network
    let user = req.user
    if (network === 'twitter') {
      let twitterClient = new Twitter({
        consumer_key: twitterConfig.consumerKey,
        consumer_secret: twitterConfig.consumerSecret,
        access_token_key: req.user.twitter.token,
        access_token_secret: req.user.twitter.tokenSecret
      })
      if (status.length > 140) {
        return req.flash('error', 'Status is over 140 characters!')
      }
      if (!status) {
        return req.flash('error', 'Status cannot be empty')
      }

      await twitterClient.promise.post('statuses/update', {status})
    }
    if (network === 'facebook') {
      let url = 'https://graph.facebook.com/' + user.facebook.id + '/feed'
      let options = {
        access_token: user.facebook.token,
        message: status
      };
      await request.promise.post({url: url, qs: options})
    }
    res.redirect('/timeline')
  }))

  app.post('/like/:id', isLoggedIn, then(async (req, res) => {
    let post = await Feed.promise.findOne({'id': req.params.id})
    let network = post.network.icon
    let user = req.user

    if (network === 'twitter') {
      let twitterClient = new Twitter({
        consumer_key: twitterConfig.consumerKey,
        consumer_secret: twitterConfig.consumerSecret,
        access_token_key: req.user.twitter.token,
        access_token_secret: req.user.twitter.tokenSecret
      })
      await twitterClient.promise.post('favorites/create', {id: req.params.id})
    }
    if (network === 'facebook') {
      let url = 'https://graph.facebook.com/' + req.params.id + '/likes'
      let options = {
        access_token: user.facebook.token
      };
      await request.promise.post({url: url, qs: options})
    }
    res.end()
  }))

  app.post('/unlike/:id', isLoggedIn, then (async (req, res) => {
    let post = await Feed.promise.findOne({'id': req.params.id})
    let network = post.network.icon
    let user = req.user

    if (network === 'twitter') {
      let twitterClient = new Twitter({
        consumer_key: twitterConfig.consumerKey,
        consumer_secret: twitterConfig.consumerSecret,
        access_token_key: req.user.twitter.token,
        access_token_secret: req.user.twitter.tokenSecret
      })
      await twitterClient.promise.post('favorites/destroy', {id: req.params.id})
    }
    
    if(network === 'facebook') {
      let url = 'https://graph.facebook.com/' + req.params.id + '/likes'
      let options = {
        access_token: user.facebook.token
      };
      // Send the request
      await request.promise.del({url: url, qs: options})
    }
    res.end()
  }))

	// process the login form
	app.post('/login', passport.authenticate('local-login', {
    successRedirect: '/profile',
    failureRedirect: '/login',
    failureFlash: true
	}))

	// process the signup form
	app.post('/signup', passport.authenticate('local-signup', {
    successRedirect: '/profile',
    failureRedirect: '/signup',
    failureFlash: true
	}))

	app.get('/connect/local', (req, res) => {
    res.render('connect-local.ejs', {message: req.flash('loginMessage')})
	})
	
  app.post('/connect/local', passport.authenticate('local-signup', {
    successRedirect: '/profile', 
    failureRedirect: '/connect/local', 
    failureFlash: true 
  }))

  let scopes = {
    facebook: {scope: ['email', 'publish_actions', 'read_stream', 'user_photos', 'user_likes']},
    twitter: {scope: 'email'},
    google: {
      scope: ['email', 'profile', 'openid',
        'https://www.googleapis.com/auth/plus.me',
        'https://www.googleapis.com/auth/plus.login',
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/plus.stream.write',
        'https://www.googleapis.com/auth/plus.stream.read',
        'https://www.googleapis.com/auth/plus.circles.read',
        'https://www.googleapis.com/auth/plus.circles.write'
      ]
    },
    linkedin: {scope: ['r_emailaddress', 'r_basicprofile']}
  }
  //set up all 3rd party strategies
  _.forIn(scopes, (val, key)=> {
    app.get(`/auth/${key}`, passport.authenticate(key, val));
    app.get(`/auth/${key}/callback`,
      passport.authenticate(key, {
        successRedirect: '/profile',
        failureRedirect: '/',
        failureFlash: true
      })
    );

    app.get(`/connect/${key}`, passport.authorize(key, val));
    app.get(`/connect/${key}/callback`, passport.authorize(key, {
      successRedirect: '/profile',
      failureRedirect: '/profile',
      failureFlash: true
    }))
  })

  app.get('/unlink/:type', isLoggedIn, then(async (req, res, next) => {
    let type = req.params.type
    let user = req.user

    if (type === 'local') {
      user.local.email = undefined
      user.local.password = undefined
    } else 
      user[type].token = undefined
    await user.save()
    return res.redirect('/profile')
  }))

  async function getTimeline(req, res, next) { 
    let user = req.user
    let allFeeds = []
    //Get Tweets:
    if (req.user.twitter.token) {
      let twitterClient = new Twitter({
        consumer_key: twitterConfig.consumerKey,
        consumer_secret: twitterConfig.consumerSecret,
        access_token_key: req.user.twitter.token,
        access_token_secret: req.user.twitter.tokenSecret
      })
      let [tweets] = await twitterClient.promise.get('statuses/user_timeline')
      tweets = tweets.map(tweet => {
        return {
          id : tweet.id_str,
          image: tweet.user.profile_image_url,
          text: tweet.text,
          name: tweet.user.name,
          username: '@' + tweet.user.screen_name,
          liked: tweet.favorited,
          network: networks.twitter,
          date: new Date(Date.parse(tweet.created_at))
        }
      })
      allFeeds.push(tweets) 
    }
    //Get facebook feeds:
    if (user.facebook.token) {
      let url = 'https://graph.facebook.com/' +user.facebook.id +'/feed'
      let options = {
        access_token: user.facebook.token,
        limit: 20
      }
      let [, fbFeeds] = await request.promise.get({url:url, qs: options})
      fbFeeds = JSON.parse(fbFeeds).data
      fbFeeds = fbFeeds.map(feed => {
        return {
          id: feed.id,
          image: `//graph.facebook.com/${user['facebook'].id}/picture`,
          text: feed.message,
          name: feed.name ? feed.name : '',
          username: feed.from.name,
          liked: feed.likes ?  body.find(feed.likes.data, 'id', user.facebook.id) : false,
          network: networks.facebook,
          date: new Date(Date.parse(feed.created_time))
        }
      }) 
      allFeeds.push(fbFeeds) 
    }
    //Get Google+ feeds:
    if (user.google.token) {
      oauth2Client.setCredentials({
        access_token: user.google.token,
        refresh_token: user.google.refreshToken
      })

      let [plusFeeds] = await googlePlus.activities.promise.list({
        userId: 'me',
        collection: 'public',
        maxResults:20,
        auth: oauth2Client
      })
      plusFeeds = plusFeeds.items.map(feed => {
        return {
          id: feed.id,
          image: feed.actor.image.url,
          text: feed.object.content,
          name: '',
          username: feed.actor.displayName,
          liked:  feed.favorited,
          network: networks.google,
          date: new Date(Date.parse(feed.published))
        }
      })
      allFeeds.push(plusFeeds) 
    } 
    req.posts = _.flatten(await Promise.all(allFeeds)).sort((a, b)=>b.date - a.date).slice(0, 20)

    await Feed.promise.remove({})
    for (let post of req.posts) {
      let feed = new Feed()
      feed.id = post.id
      feed.image = post.image
      feed.text = post.text
      feed.name = post.name
      feed.username = post.username
      feed.liked = post.liked
      feed.network = post.network
      feed.date = post.date
      await feed.save()
    }
    next()
  }
}