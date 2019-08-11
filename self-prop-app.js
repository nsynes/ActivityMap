const decode = require('geojson-polyline').decode
const path = require('path');
const fs = require('fs');
const express = require('express');
const strava = require('strava-v3');
const port = process.env.PORT || 3000
const app = express();
const geodist = require('geodist');

app.get('/',  (req, res) => {
    pagePath = path.join(__dirname, '/index.html');
    res.sendFile(pagePath);
});

app.get('/listActivities', (req, res) => {

  const before = req.query.before;
  const perPage = req.query.perPage;
  const page = req.query.page;

  strava.athlete.listActivities({'before':before, 'per_page':perPage, 'page':page},function(err,payload,limits) {
    if(!err) {
        // Send only the activity IDs

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
    else {
        console.log(err);
    }
  });
})

app.get('/getActivity', (req, res) => {
  const activityID = req.query.id;

  strava.activities.get({id:activityID},function(err,payload,limits) {
    if(!err) {
      if ( payload.map && payload.map.polyline ) {
        var polygon = {
          type: 'MultiLineString', //'Polygon',
          coordinates: [payload.map.polyline]
        }
        var activityType = payload.type;
        var geoJson = decode(polygon)
        var activity = {id: activityID, geoJson: geoJson, activityType: activityType};

        res.json(activity);
      } else {
        res.json(payload);
      }
      }
    else {
        console.log(err);
    }

  })
});

app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/fontawesome', express.static(path.join(__dirname, 'fontawesome')));
app.use('/js', express.static(path.join(__dirname, 'js')));

app.listen(port, (err) => {
  if (err) {
    throw err;
  }
  console.log(`server is listening on ${port}\n`);
});


