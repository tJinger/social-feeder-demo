let passport = require('passport')
let nodeifyit = require('nodeifyit')
let LocalStrategy = require('passport-local').Strategy
let FacebookStrategy = require('passport-facebook').Strategy
let LinkedInStrategy = require('passport-linkedin-oauth2').Strategy
let TwitterStrategy = require('passport-twitter').Strategy
let GoogleStrategy = require('passport-google-oauth').OAuth2Strategy
let User = require('../models/user')
require('songbird')

function useExternalPassportStrategy(OauthStrategy, config, field) {
  config.passReqToCallback = true

  passport.use(field, new OauthStrategy(config, nodeifyit(authCB, {spread: true})))

  async function authCB(req, token, refreshToken, profile) {
    let query = {}
    query[`${field}.id`] = profile.id

    let user = await User.promise.findOne(query)

    //check if the user is already logged in 
    if (!req.user) {
      //if the user is found, then log them in 
      if (!user) {
        //if there is no user found with id, create them
        user = new User()
      }
    } else {
      //user already exists and is logged in, we have to link accounts
      user = req.user
    }

    user[field].id = profile.id
    user[field].token = token

    switch (field) {
      case 'facebook':
        user[field].name = profile.name.givenName + ' ' + profile.name.familyName
        user[field].email = profile.emails[0].value
        break;
      case 'google':
        user[field].name = profile.name.givenName + ' ' + profile.name.familyName
        user[field].email = profile.emails[0].value
        user[field].refreshToken = refreshToken
        break;
      case 'linkedin':
        user[field].name = profile.displayName
        user[field].email = profile.emails[0].value
        break;
      case 'twitter':
        user[field].username = profile.username
        user[field].displayName = profile.displayName
        user[field].tokenSecret = refreshToken
        break;
      default:
        console.log('Unknow field')
    }
    return await user.promise.save()
  }
}

function configure(config) {
  // Required for session support / persistent login sessions
  passport.serializeUser(nodeifyit(async (user) => user._id))
  passport.deserializeUser(nodeifyit(async (_id) => {
    return await User.promise.findById(_id)
  }))

  useExternalPassportStrategy(FacebookStrategy, {
    clientID: config.facebook.clientID,
    clientSecret: config.facebook.clientSecret,
    callbackURL: config.facebook.callbackUrl
  }, 'facebook')

  useExternalPassportStrategy(LinkedInStrategy, {
    clientID: config.linkedin.clientID,
    clientSecret: config.linkedin.clientSecret,
    callbackURL: config.linkedin.callbackUrl,
    state: true
  }, 'linkedin')

  useExternalPassportStrategy(GoogleStrategy, {
    clientID: config.google.clientID,
    clientSecret: config.google.clientSecret,
    callbackURL: config.google.callbackUrl
  }, 'google')
  
  useExternalPassportStrategy(TwitterStrategy, {
    consumerKey: config.twitter.consumerKey,
    consumerSecret: config.twitter.consumerSecret,
    callbackURL: config.twitter.callbackUrl
  }, 'twitter')
  
  passport.use('local-login', new LocalStrategy({
      usernameField: 'email',
      failureFlash: true
  }, nodeifyit(async (email, password) => {
      let user = await User.promise.findOne({'local.email': email})

      if (!user || email !== user.local.email) {
          return [false, {message: 'Invalid username'}]
      }
      if (!await user.validatePassword(password)) {
          return [false, {message: 'Invalid password'}]
      }
      return user
  }, {spread: true})))

  passport.use('local-signup', new LocalStrategy({
     usernameField: 'email',
     failureFlash: true,
     passReqToCallback: true
  }, nodeifyit(async (req, email, password) => {
      email = (email || '').toLowerCase()
      if (await User.promise.findOne({'local.email': email})) {
          return [false, {message: 'That email is already taken.'}]
      }

      if (req.user) {
        let user = req.user
        user.local.email = email
        user.local.password =  await user.generateHash(password)
        return await user.save()
      } else {
        let user = new User()
        user.local.email = email
        user.local.password =  await user.generateHash(password)
        return await user.save()
      }
  }, {spread: true})))

  return passport
}

module.exports = {passport, configure}
