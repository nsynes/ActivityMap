const express = require('express')
const passport = require('passport')
const util = require('util')
const StravaStrategy = require('passport-strava-oauth2').Strategy
const dotenv = require('dotenv');
const path = require('path');
const cookieParser = require('cookie-parser')
const bodyParser = require('body-parser');
const session = require('express-session');
var strava = require('strava-v3');
const decode = require('geojson-polyline').decode
const geodist = require('geodist');

dotenv.config();

const port = process.env.PORT || 3000
const app = express();


// configure Express
//app.use(express.logger());
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: false }));
//app.use(express.methodOverride());
app.use(session({
    secret: 'monkey tennis',
    resave: true,
    saveUninitialized: true,
    maxAge: 1800 * 1000
}));
app.use(passport.initialize());
app.use(passport.session());
//app.use(app.router);
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/fontawesome', express.static(path.join(__dirname, 'fontawesome')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

// Passport session setup.
passport.serializeUser(function(user, done) { done(null, user) });
passport.deserializeUser(function(obj, done) {done(null, obj) });

passport.use(new StravaStrategy({
    clientID: process.env.STRAVA_CLIENT_ID,
    clientSecret: process.env.STRAVA_CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/strava/callback"
  },
  function(accessToken, refreshToken, profile, done) {
    // asynchronous verification, for effect...
    process.nextTick(function () {
      // To keep the example simple, the user's Strava profile is returned to
      // represent the logged-in user.  In a typical application, you would want
      // to associate the Strava account with a user record in your database,
      // and return that user instead.
      return done(null, profile);
    });
  }
));

app.get('/', ensureAuthenticated, function(req, res){
    pagePath = path.join(__dirname, '/index.html');
    res.sendFile(pagePath);
});

app.get('/userPhoto', ensureAuthenticated, function(req, res){
    if ( req.user ) {
        res.json({ 'photo': req.user.photos[req.user.photos.length-1].value });
    } else {
        res.sendStatus(404);
    }
});

// Use passport.authenticate() as route middleware to authenticate the
// request.  Redirect user to strava, then strava will redirect user back to
// this application at /auth/strava/callback
app.get('/auth/strava',
  passport.authenticate('strava', { scope: ['public'] }),
  function(req, res){
    // The request will be redirected to Strava for authentication, so this
    // function will not be called.
  });

// GET /auth/strava/callback
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  If authentication fails, the user will be redirected back to the
//   login page.  Otherwise, the primary route function function will be called,
//   which, in this example, will redirect the user to the home page.
app.get('/auth/strava/callback',
  passport.authenticate('strava', { failureRedirect: '/login' }),
  function(req, res) {
    res.redirect('/');
  });

app.get('/logout', function(req, res){
  req.logout();
  res.render('login', { user: req.user });
});

app.get('/login', function(req, res){
    res.render('login', { user: req.user });
  });

app.get('/listActivities', ensureAuthenticated, (req, res) => {

    const before = req.query.before;
    const perPage = req.query.perPage;
    const page = req.query.page;

    strava.athlete.listActivities({'before':before, 'per_page':perPage, 'page':page, 'access_token':req.user.token},function(err,payload,limits) {

      if ( err || payload.errors ) {
          console.log("Error getting activities:" + err);
          return res.status(400).json({ msg: "Error getting activities:" + err });
      } else {
          // Send entire payload (and add geoJson data)
          var data = payload;
          for ( i in data ) {
            if ( data[i].map && data[i].map.summary_polyline ) {
              var polygon = {
                type: 'MultiLineString',
                coordinates: [data[i].map.summary_polyline]
              }
              var geoJson = decode(polygon);
              // TO DO: Add check and handling for if there are multiple coordinates arrays
              var coordsLength = geoJson.coordinates[0].length;
              var dist = 0;
              var newCoords = []
              var coordSegment = 0;
              var segStart = 0;
              for (var j = 0 ; j < coordsLength-1; j++) {
                // TO DO: Check if lat,lon in correct order from geoJson and for geodist?
                dist = geodist(geoJson.coordinates[0][j], geoJson.coordinates[0][j+1], {unit:'km'});
                if ( dist > 10 ) {
                  newCoords[coordSegment] = geoJson.coordinates[0].slice(segStart, j);
                  coordSegment+=1;
                  segStart = j+1;
                }
              }
              //catch last segment of path
              if ( segStart > 0 ) {
                newCoords[coordSegment] = geoJson.coordinates[0].slice(segStart);
              } else {
                newCoords[0] = geoJson.coordinates[0];
              }
              data[i].map['coordinates'] = newCoords;
            }
          }
          res.json(data);
      }
    });
  })


// Simple route middleware to ensure user is authenticated.
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) { return next(); }
  res.redirect('/auth/strava')
}

app.listen(port, (err) => {
    if (err) {
      throw err;
    }
    console.log(`server is listening on ${port}\n`);
  });