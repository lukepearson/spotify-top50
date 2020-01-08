const express = require('express') // Express web server framework
const request = require('request') // "Request" library
const querystring = require('querystring')
const cookieParser = require('cookie-parser')
const path = require('path')
const { execSync } = require('child_process')

var os = require('os');
var ifaces = os.networkInterfaces();

const ip = ifaces.en0.find(n => n.family === 'IPv4').address;
console.log('IP address is ' + ip);

var client_id = process.env.SPOTIFY_APP_CLIENT_ID || '[YOUR_SPOTIFY_APP_CLIENT_ID]'; // Your client id
var client_secret = process.env.SPOTIFY_APP_CLIENT_SECRET || '[YOUR_SPOTIFY_APP_CLIENT_SECRET]'; // Your secret
var appUrl = process.env.APP_URL || '[YOUR_APP_URL]';
var port = process.env.PORT || 8888;
var redirect_uri = `http://${appUrl}:${port}/callback`; // Your redirect uri

/**
 * Generates a random string containing numbers and letters
 * @param  {number} length The length of the string
 * @return {string} The generated string
 */
var generateRandomString = function (length) {
  var text = ''
  var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

  for (var i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length))
  }
  return text
}

var stateKey = 'spotify_auth_state'

var app = express()

app.use(express.static(path.join(__dirname, 'public')))
  .use(cookieParser())

app.get('/login', function (req, res) {
  var state = generateRandomString(16)
  res.cookie(stateKey, state)

  // your application requests authorization
  var scope =
    'playlist-read-private user-read-private user-read-email user-read-recently-played user-top-read playlist-modify-public playlist-modify-private'
  res.redirect('https://accounts.spotify.com/authorize?' +
    querystring.stringify({
      response_type: 'code',
      client_id: client_id,
      scope: scope,
      redirect_uri: redirect_uri,
      state: state
    }))
})

app.get('/create-playlist', function (req, res) {
  var options = {
    url: 'https://api.spotify.com/v1/users/' + req.query.userId + '/playlists',
    headers: {
      'Authorization': 'Bearer ' + req.query.token
    },
    body: {
      'description': 'Top 50 songs',
      'public': false,
      'name': req.query.name + ' Top 50'
    },
    json: true
  }

  request.post(options, function (error, response, body) {
    console.log(body)
    addTracks(req.query.userId, req.query.token, body.id, req.query.songs, function () {
      res.send(body)
    })
  })
})

function addTracks (userId, token, playlist, songs, cb) {
  var options = {
    url: 'https://api.spotify.com/v1/users/' + userId + '/playlists/' + playlist + '/tracks',
    headers: {
      'Authorization': 'Bearer ' + token
    },
    body: {
      'uris': JSON.parse(songs)
    },
    json: true
  }

  console.log(options)

  request.post(options, (error, response, body) => {
    console.log(body)
    cb()
  })
}

app.get('/callback', function (req, res) {
  code = req.query.code || null
    res.clearCookie(stateKey)
    var authOptions = {
      url: 'https://accounts.spotify.com/api/token',
      form: {
        code,
        redirect_uri,
        grant_type: 'authorization_code'
      },
      headers: {
        'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64'))
      },
      json: true
    }

    request.post(authOptions, function (error, response, body) {
      if (!error && response.statusCode === 200) {
        var access_token = body.access_token,
          refresh_token = body.refresh_token

        var options = {
          url: 'https://api.spotify.com/v1/me',
          headers: {
            'Authorization': 'Bearer ' + access_token
          },
          json: true
        }

        // use the access token to access the Spotify Web API
        request.get(options, function (error, response, body) {
          console.log(body)
        })

        // we can also pass the token to the browser to make requests from there
        res.redirect('/#' +
          querystring.stringify({
            access_token: access_token,
            refresh_token: refresh_token
          }))
      } else {
        res.redirect('/#' +
          querystring.stringify({
            error: 'invalid_token'
          }))
      }
    })
  //}
})

app.get('/refresh_token', function (req, res) {
  // requesting access token from refresh token
  var refresh_token = req.query.refresh_token
  var authOptions = {
    url: 'https://accounts.spotify.com/api/token',
    headers: {
      'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64'))
    },
    form: {
      grant_type: 'refresh_token',
      refresh_token: refresh_token
    },
    json: true
  }

  request.post(authOptions, function (error, response, body) {
    if (!error && response.statusCode === 200) {
      var access_token = body.access_token
      res.send({
        'access_token': access_token
      })
    }
  })
})

console.log(`Listening on ${port}`);
app.listen(port);
