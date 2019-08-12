// 2D map from leaflet and osm tiles
// create map object, tell it to live in 'map' div and give initial latitude, longitude, zoom values
// pass option to turn scroll wheel zoom off
var map = L.map('map',{scrollWheelZoom:true}).setView([55.5, -4], 6);

// add base map tiles from OpenStreetMap and attribution info to 'map' div
L.tileLayer('https://{s}.tile.osm.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

/*// 3D map from eeGeo and Wrld3D tiles (requires API key)
var map = L.eeGeo.map('map', 'de7940464fd8803d51ef32e3ba3886a9', {center: [54.8, -4], zoom: 6});*/

var locationCircle;

var onLocationFound = function(e) {
    var radius = e.accuracy / 2;

    //L.marker(e.latlng).addTo(map)
    //    .bindPopup("You are within " + radius + " meters from this point").openPopup();

    if ( locationCircle ) {
        map.removeLayer(locationCircle)
    }

    locationCircle = L.circle(e.latlng, {radius:radius, color:'#000000', weight:5, fillColor:'#0000ff', fillOpacity:0.6}).addTo(map);
    locationCircle.bringToFront();
}

var onLocationError = function(e) {
    alert(e.message);
}

var getActivities = function(listActivityIDs) {
    const activityListLength = listActivityIDs.length
    for (var i = 0; i < activityListLength; i++) {
        getActivity(listActivityIDs[i]);
    }
}

var getAccountInfo = function() {
    fetch('/userPhoto', {method: 'GET'})
    .then(function(response) {
        if(response.ok) {
            return response.json();
        }
        throw new Error('Request failed.');
        })
    .then(data => {
        $('#user-image').attr("src", data.photo);
    })
}

var getListOfActivities = function(allActivities, timeStamp, perPage, page) {

    var endOfList = false;
    $('#floating-text').css('display','block');
    $('#floating-text').text('Loading activities ('+perPage*page+') ...');

    fetch('/listActivities?before='+timeStamp+'&perPage='+perPage+'&page='+page, {method: 'GET'})
    .then(function(response) {
        if(response.ok) {
            return response.json();
        }
        throw new Error('Request failed.');
        })
    .then(activities => {
        page += 1;
        if ( activities.length < perPage ) {
            endOfList = true;
        }
        displayActivities(activities);

        allActivities.push.apply(allActivities, activities);
        if ( !endOfList ) {
            getListOfActivities(allActivities, timeStamp, perPage, page);
        }
    })
    return allActivities;
}

var displayActivities = function(activities) {
var data = {};
for (i in activities) {
    data = activities[i];
    if (data.map.coordinates ) {

        var lineColour = "#000000"; //black
        if ( data.type.toLowerCase() === 'hike' || data.type.toLowerCase() === 'walk' ) {
            lineColour = "#006400"; //green
        } else if ( data.type.toLowerCase() === 'run' ) {
            lineColour = "#0000ff"; //blue
        } else if ( data.type.toLowerCase() === 'ride' ) {
            lineColour = "#ff0000"; // red
        }

        var coords = data.map.coordinates;
        // lat lon wrong way round
        for (ii in coords) {
            coords[ii] = coords[ii].map(function(x) {return [x[1],x[0]]});
        }

        // add line from toUnion array points to map with some basic styling
        L.polyline(coords,{color:lineColour,opacity:0.9,weight:3,interactive:false}).addTo(map).bringToBack();
    }
}
$('#floating-text').css('display','none');
$('#floating-text').text('');
}


//https://stackoverflow.com/questions/2854407/javascript-jquery-window-resize-how-to-fire-after-the-resize-is-completed
// for events that can repeatedly fire (like window resize), this function allows waiting until final call
var waitForFinalEvent = (function () {
var timers = {};
return function (callback, ms, uniqueId) {
    if (!uniqueId) {
    uniqueId = "Don't call this twice without a uniqueId";
    }
    if (timers[uniqueId]) {
    clearTimeout (timers[uniqueId]);
    }
    timers[uniqueId] = setTimeout(callback, ms);
};
})();



$('.leaflet-control-zoom').append("<a id='locate-button' role='button' title='Locate' aria-label='Locate'><i class='fa fa-location-arrow' style='margin:10px 0'></i></a>");

$('#locate-button').click(function() {
    map.locate({setView: true, maxZoom: 14});

    map.on('locationerror', onLocationError);

    map.on('locationfound', onLocationFound);
})
$('#logout-button').click(function() {
    window.location.replace('/logout');
})



var timeStamp = Math.floor(Date.now() / 1000);
const perPage = 50;
const startPage = 1;

getAccountInfo()
getListOfActivities([], timeStamp, perPage, startPage, getActivities);