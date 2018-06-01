/**
* A program to search through a users playlists, and get audio features for each track.
* Author: Jamie Chapman
* Date: 15/02/2018
*/

/* LIBRARY IMPORTS  */
// For Node.js Server
var express = require('express'); // Express web server framework
var request = require('request'); // "Request" library
var querystring = require('querystring');
var cookieParser = require('cookie-parser');
const chalk = require('chalk');
// For file read/write
var FileReader = require('filereader'); // Library for reading user data log
var fs = require('fs');
var rl = require('readline-specific');

/* GLOBAL VARIABLES */
var port = 8888;
var client_id = ''; // Your client id
var client_secret = ''; // Your secret
var redirect_uri = 'http://localhost:8888/callback';// Your redirect uri
// OAuth Scopes and specific settings, scope of request
var scope = 'user-read-email user-top-read playlist-read-private playlist-read-collaborative user-library-read user-library-modify playlist-modify-public playlist-modify-private'; 
var user_id;
var playlist_ids;

/**
 * Generates a random string containing numbers and letters
 * @param  {number} le ngth The length of the string
 * @return {string} The generated string
 */
var generateRandomString = function(length) {
  var text = '';
  var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  for (var i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

function getPlaylist(user_id, access_token)
{
	var trackIDArray = [];
	/* CALL FUNCTIONS HERE*/
	rl.oneline('user_data_dump/' + user_id + '/recommendations.txt', 1, function(err, res) {
		if (err) console.error(err) // Handling error
		//console.log(res);
		var start = 0;
		var end = 0;
		for(i = 0; i < res.length;) { //Visit every char of string, divide each feature into array position trackIDArray 
			if(res.substr(i, 1) === ',' || res.substr(i,1) === '\n') {
				end = i; // Set end of string slice
				var str = res.slice(start, end); // Add slice of string, i.e. a feature, to array
				trackIDArray.push(str.replace(/\s+/g, ''));
				start = end + 1; // Set start of new slice to end of previous
				i++;
			} else { // The target is part of a feature string slice
				i++;
			}
		}
		addPlaylist(user_id, trackIDArray, access_token);
	});
}

/**
* Creates new playlist and adds playlistID's from comma separated value file 'recommendations.txt'.
*/
function addPlaylist(user_id, trackIDArray, access_token)
{
		var options = {
		url: 'https://api.spotify.com/v1/users/' + user_id + '/playlists',
		body: {
			"name":"Recommendations",
			"description":"Listen to this playlist and then fill out the questionaire, found here: https://goo.gl/forms/iJMm2ytUCP0HPN673",
			"public":false},
		headers: { 'Authorization': 'Bearer ' + access_token },
		json: true 
	};

	request.post(options, function(error, response, body) //Request for user details
	{
		console.log(trackIDArray);
		console.log(response.statusCode);
		var playlist_id = body.id;
		var str = '';
		//track:A4iV5W9uYEdYUVa79Axb7Rh%2Cspotify%3Atrack%3A1301WleyT98MSxVHPZCA6M
		for(i = 0; i < trackIDArray.length-1; i++)
		{
			console.log(i);
			str += 'spotify:track:' + trackIDArray[i] + ',';
		}
		str += 'spotify:track:' + trackIDArray[trackIDArray.length-1]; //Adding last track
		
		console.log('trackID length:>' + trackIDArray.length);
		console.log(str);
		var options = {
			url: 'https://api.spotify.com/v1/users/' + user_id + '/playlists/' + playlist_id + '/tracks?position=0&uris=' + str,
			headers: {'Authorization': 'Bearer ' + access_token },
			json: true
		};

		request.post(options, function(error, response, body)
		{

		});
	});
}

/* Track Recommendation Functions */
/**
* Construct a recommendation string from user preferences
*/
function getRecommendationString(user_id, access_token) {
	options = {
	url: 'https://api.spotify.com/v1/me/top/artists?limit=5',
	headers: { 'Authorization': 'Bearer ' + access_token },
	json: true
	};

	request.get(options, function(error, response, body) { //request for top artists
		if(!error && response.statusCode != 'undefined' && response.statusCode == 200 && body.items != 'undefined') { //if response is good
			//building request string
			if(body.total > 0)
			{
				var seed_artists = body.items[1].id + ',' + body.items[2].id; //top 2 artist ids
				seed_genres = body.items[1].genres[1] + ',' + body.items[2].genres[1] + ',' + body.items[3].genres[1];
				limit = '100';

				var requestString = 'market=GB' + '&seed_artists=' + seed_artists + '&seed_genres=' + seed_genres + '&limit=' + limit;
				getRecommendations(user_id, access_token, requestString); //Send request string to function
			} else {
				fs.appendFileSync('user_data_dump/' + user_id + '/' + user_id  + '_recommendations.txt', 'Not enough data for recommendedations');
			}
		} else {
				setTimeout(function() {
				getRecommendationString(user_id, access_token);
			}, 1000);
		}
    });
}

/*
* Requests 100 recommended songs, related to users top 3 genres and 2 artists
*/
function getRecommendations(user_id, access_token, requestString) {
	 options = { // Create request options
	  url: 'https://api.spotify.com/v1/recommendations?' + requestString,
	  headers: { 'Authorization': 'Bearer ' + access_token },
	  json: true
	};

	request.get(options, function(error, response, body) //Request for tracks N.B. Maximum # of tracks is 100, make multiple requests for all tracks
	{
		var trackIDArray = [];
	 	var trackNameArray = [];
	 	var trackPopularityArray = [];
	 
		if(!error && response.statusCode != 'undefined' && response.statusCode == 200 && body.tracks != 'undefined') { //if response is good
			for(i = 0; i < body.tracks.length; i++)
			{
				trackIDArray.push(body.tracks[i].id);
				trackNameArray.push(body.tracks[i].name);
				trackPopularityArray.push(body.tracks[i].popularity);
			}
			writeUserRecommendations(user_id, trackNameArray, trackIDArray, access_token, trackPopularityArray);
		} else {
			setTimeout(function() {
			getRecommendations(user_id, access_token, requestString);
			}, 1000);
		}
	});
}

/**
* Requests features for multiple tracks in one request, then traverses tracks and inserts into text file.
*/
function writeUserRecommendations(user_id, trackNameArray, trackIDArray, access_token, trackPopularityArray) //maybe add popularity array
{	
	var track_string = trackIDArray[0];

	if(trackNameArray != null && trackIDArray != null && trackPopularityArray != null)
	for (i = 1; i < trackNameArray.length; i++) { //traverse array and build string
		track_string += ',' + trackIDArray[i];
	}
	options = {
		url: 'https://api.spotify.com/v1/audio-features/?ids=' + track_string,
		headers: { 'Authorization': 'Bearer ' + access_token },
		json: true
	};
	request.get(options, function(error, response, body) { //Request for track features of all ids in trackIDArray
		if(!error && response.statusCode != 'undefined' && response.statusCode == 200 && body.audio_features != 'undefined' && body.audio_features[0] != null) { //if good request
			for(i = 0; i <= body.audio_features.length-1; i++)
			{			
				fs.appendFileSync('user_data_dump/' + user_id + '/' + user_id  + '_recommendations.txt', trackIDArray[i] + ', ' + trackNameArray[i] + ', ' + trackPopularityArray[i]  + ', ' + body.audio_features[i].danceability + ', ' + body.audio_features[i].energy + ', ' + body.audio_features[i].key + ', ' + body.audio_features[i].loudness + ', ' + body.audio_features[i].mode + ', ' + body.audio_features[i].speechiness + ', ' + body.audio_features[i].acousticness + ', ' + body.audio_features[i].instrumentalness + ', ' +body.audio_features[i].liveness + ', ' + body.audio_features[i].valence + ', ' + body.audio_features[i].tempo + '\n');			
				fs.appendFileSync('user_data_dump/' + user_id + '/' + user_id  + '_recommendations_MATLAB.txt', trackPopularityArray[i]  + ', ' + body.audio_features[i].danceability + ', ' + body.audio_features[i].energy + ', ' + body.audio_features[i].key + ', ' + body.audio_features[i].loudness + ', ' + body.audio_features[i].mode + ', ' + body.audio_features[i].speechiness + ', ' + body.audio_features[i].acousticness + ', ' + body.audio_features[i].instrumentalness + ', ' +body.audio_features[i].liveness + ', ' + body.audio_features[i].valence + ', ' + body.audio_features[i].tempo + '\n');			
			}
		}
		 else {
			setTimeout(function() { //Set delay until timeout finished, then resend request
				writeUserRecommendations(user_id, trackNameArray, trackIDArray, access_token, trackPopularityArray);
			}, 1000); //Wait in milliseconds
		}
	});
}

/* User info Functions */ 

/**
* Requests top 5 artists of user, when recived, send data to write get top tracks and write
*/
function writeTopArtists(user_id, access_token)
{
	options = {
		url: 'https://api.spotify.com/v1/me/top/artists?limit=5',
		headers: { 'Authorization': 'Bearer ' + access_token },
		json: true
	};
	request.get(options, function(error, response, body) { //request for top artists
		if(!error && response.statusCode != 'undefined' && response.statusCode == 200 && body.items != 'undefined') { //if response is good
			for(i = 0; i < body.items.length; i++) {
				writeTopTracks(user_id, body.items[i].id, body.items[i].name,body.items[i].genres, access_token)
			}
		}
		else {
			setTimeout(function() {
				writeTopArtists(user_id, access_token);
			}, 1000);
		}
	});
}

/*
* Requests top tracks of artist, then writes information to file.
*/
function writeTopTracks(user_id, artist_id, artist_name, genres, access_token)
{
  options = {
    url: 'https://api.spotify.com/v1/artists/' + artist_id + '/top-tracks?country=GB',
    headers: { 'Authorization': 'Bearer ' + access_token },
    json: true
  };

  request.get(options, function(error, response, body) { //Request for track info
	if(!error && response.statusCode != 'undefined' && response.statusCode == 200 && body.items != 'undefined') { //if response is good
		fs.appendFileSync('user_data_dump/' + user_id  + '/' + user_id  + '_info'+ '.txt', 
		artist_name + ', ' + artist_id + ', '  +
		body.tracks[0].name  + ', ' + body.tracks[0].id + ', ' +
		body.tracks[1].name  + ', ' + body.tracks[1].id + ', ' +
		body.tracks[2].name  + ', ' + body.tracks[2].id + ', ' +
		body.tracks[3].name  + ', ' + body.tracks[3].id + ', ' +
		body.tracks[4].name  + ', ' + body.tracks[4].id + ', ' +
		genres[1] + ' \n');
	}
	else {
		setTimeout(function() { //Set delay until timeout finished, then resend request
			writeTopTracks(user_id, artist_id, artist_name, genres,access_token);
		}, 1000); //Wait in milliseconds
	}
  });
}

/*
* Requests features for multiple tracks in one request, then traverses tracks and inserts into text file.
*/
function writeUserTrackInfo(user_id, trackNameArray, trackIDArray, access_token, trackPopularityArray) //maybe add popularity array
{	
	var track_string = trackIDArray[0];

	if(trackNameArray != null && trackIDArray != null && trackPopularityArray != null)
	for (i = 1; i < trackNameArray.length; i++) { //traverse array and build string
		track_string += ',' + trackIDArray[i];
	}
	options = {
		url: 'https://api.spotify.com/v1/audio-features/?ids=' + track_string,
		headers: { 'Authorization': 'Bearer ' + access_token },
		json: true
	};
	request.get(options, function(error, response, body) { //Request for track features of all ids in trackIDArray
		
		if(!error && response.statusCode != 'undefined' && response.statusCode == 200 && body.audio_features != 'undefined' && body.audio_features[0] != null) { //if good request
			for(i = 0; i <= body.audio_features.length-1; i++)
			{			
				fs.appendFileSync('user_data_dump/' + user_id + '/' + user_id  + '_MATLAB'+ '.txt', trackPopularityArray[i]  + ', ' + body.audio_features[i].danceability + ', ' + body.audio_features[i].energy + ', ' +body.audio_features[i].key + ', ' + body.audio_features[i].loudness + ', ' + body.audio_features[i].mode + ', ' + body.audio_features[i].speechiness + ', ' + body.audio_features[i].acousticness + ', ' + body.audio_features[i].instrumentalness + ', ' +body.audio_features[i].liveness + ', ' + body.audio_features[i].valence + ', ' + body.audio_features[i].tempo + '\n');
				fs.appendFileSync('user_data_dump/' + user_id + '/' + user_id  + '.txt', trackIDArray[i] + ', ' + trackNameArray[i] + ', ' + trackPopularityArray[i]  + ', ' + body.audio_features[i].danceability + ', ' + body.audio_features[i].energy + ', ' + body.audio_features[i].key + ', ' + body.audio_features[i].loudness + ', ' + body.audio_features[i].mode + ', ' + body.audio_features[i].speechiness + ', ' + body.audio_features[i].acousticness + ', ' + body.audio_features[i].instrumentalness + ', ' +body.audio_features[i].liveness + ', ' + body.audio_features[i].valence + ', ' + body.audio_features[i].tempo + '\n');			
			}
		}
		 else {
			setTimeout(function() { //Set delay until timeout finished, then resend request
				writeUserTrackInfo(user_id, trackNameArray, trackIDArray, access_token, trackPopularityArray);
			}, 1000); //Wait in milliseconds
		}
	});
}
/** 
* Requests track ids for each track in playlist, passes them on to insertFeatures for writing
*/
function getTrackIDs(user_id, playlist_id, access_token){
	options = {
		url: 'https://api.spotify.com/v1/users/' + user_id + '/playlists/' + playlist_id +'/tracks',
		headers: { 'Authorization': 'Bearer ' + access_token },
		json: true
	};

	request.get(options, function(error, response, body) //Request for tracks N.B. Maximum # of tracks is 100, make multiple requests for all tracks
	{
		var trackIDArray = [];
		var trackNameArray = [];
		var trackPopularityArray = [];

		if(!error && response.statusCode != 'undefined' && response.statusCode == 200 && body.items != 'undefined') { //if response good
			for(i = 0; i <= body.items.length-1; i++) {
				if(body.items[i].track.popularity > 0)
				{
					trackIDArray.push(body.items[i].track.id);
					trackNameArray.push(body.items[i].track.name);
					trackPopularityArray.push(body.items[i].track.popularity);
				}
			}
			writeUserTrackInfo(user_id, trackNameArray, trackIDArray, access_token, trackPopularityArray);			
		}
		else {
			setTimeout(function() { //Set delay until timeout finished, then resend request
				getTrackIDs(user_id, playlist_id, access_token);
			}, 1000); //Wait in milliseconds
		}
	});
}

/**
* Requests up to 20 playlist ids of user, passes them on to track 
*/
function getPlaylistIDs(user_id, access_token) {
	options = {
		url: 'https://api.spotify.com/v1/users/' + user_id + '/playlists',
		headers: { 'Authorization': 'Bearer ' + access_token },
		json: true
	};

	request.get(options, function(error, response, body) //Request for playlist details
	{
		if(!error && response.statusCode != 'undefined' && response.statusCode == 200 && body.items != 'undefined') //if response good
		{
			var playlist_count;
			if (body.items.length >= 20) {playlist_count = 20;} // if no of playlists exceeds 20, limit count to max of 20
			else {playlist_count = body.items.length;} //else set loop counter to number of user playlists

			for(i = 1; i < playlist_count; i++) { //traverse though playlist ids with body.items[i].id
				getTrackIDs(user_id, body.items[i].id, access_token);
			}
		}
		else {
			setTimeout(function() { //Set delay until timeout finished, then resend request
				getPlaylistIDs(user_id, access_token);
			}, 1000); //Wait in milliseconds
		}
	});
}

/* SERVER SETUP */
var stateKey = 'spotify_auth_state';
var app = express();
app.use(express.static(__dirname + '/public'))
   .use(cookieParser());

/* LOGGING IN FOR AUTHORISATION */
app.get('/login', function(req, res) {
	var state = generateRandomString(16);
	res.cookie(stateKey, state);

	res.redirect('https://accounts.spotify.com/authorize?' +  
		querystring.stringify({ 
		response_type: 'code',
		client_id: client_id, //The client ID provided to you by Spotify after registering your app
		scope: scope, //Scope string
		redirect_uri: redirect_uri, //Your redirect uri
		state: state //For validation/ security against xss
	}));
});

/* USER WILL BE PROMPTED TO AUTHORISE WITHIN THE SCOPES*/ 
app.get('/callback', function(req, res) { 
//The user is now redirected
// your application requests refresh and access tokens
// after checking the state parameter
var code = req.query.code || null;
var state = req.query.state || null;
var storedState = req.cookies ? req.cookies[stateKey] : null;

if (state === null || state !== storedState) {
	res.redirect('/#' + querystring.stringify({error: 'state_mismatch :>' + state + 'storedState:> ' + storedState}));
}
else {
res.clearCookie(stateKey);
var authOptions = {
	url: 'https://accounts.spotify.com/api/token', 
	form: {
		code: code,
		redirect_uri: redirect_uri,
		grant_type: 'authorization_code'
	},
	headers: {
		'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64'))
	},
	json: true
};

//Getting a token, sending authorisation request with scope options.
request.post(authOptions, function(error, response, body) {

	if (!error && response.statusCode === 200) {
		//Setting token value as variables
		var access_token = body.access_token,
		refresh_token = body.refresh_token;

		var options = {
			url: 'https://api.spotify.com/v1/me',
			headers: { 'Authorization': 'Bearer ' + access_token },
			json: true
		};

		request.get(options, function(error, response, body) //Request for user details
		{
			if(!error && response.statusCode != 'undefined' && response.statusCode == 200 && body.items != 'undefined')
			user_id = body.id; // Set userID, to be used in requests later
			var dir = 'user_data_dump/' + user_id;

			if (!fs.existsSync(dir)) { //if user directory doesn't exist, make one
				fs.mkdirSync(dir);
			}

			//if recommendations file exists, add playlist
			try{
				if (fs.existsSync('user_data_dump/' + user_id + '/recommendations.txt')) { 
					console.log('recommendations.txt exists! Adding the playlist...');	
					getPlaylist(user_id, access_token);
				}
				else {
					console.log('recommendations.txt doesn\'t exitst yet! Getting data...');
						//User info file
					fs.writeFile(dir + '/' + user_id  + '_info'+ '.txt', '', (err) => {
						if(err) throw err;
					});
					//File for MATLAB processing
					fs.writeFile(dir + '/' + user_id  + '_MATLAB'+ '.txt', '', (err) => {
						if(err) throw err;
					});
					//File for developer 
					fs.writeFile(dir + '/' + user_id  + '.txt', '', (err) => {
						if(err) throw err;
					});
					//File for developer 
					fs.writeFile(dir + '/' + user_id  + '_recommendations.txt', '', (err) => {
						if(err) throw err;
					});
					//File for recommendations processing
					fs.writeFile(dir + '/' + user_id  + '_recommendations_MATLAB.txt', '', (err) => {
						if(err) throw err;
					});

					fs.appendFileSync('user_data_dump/' + 'log.txt', user_id + ' ' + body.email + ' ' + new Date().toUTCString() + '\n');

					getPlaylistIDs(user_id, access_token); //Write list of user preferences to file
					getRecommendationString(user_id,access_token); //Write list of recommended tracks for each user
					writeTopArtists(user_id, access_token); //Get users top artists and write to file
				}
			} catch (err) {}
		});
		// we can also pass the token to the browser to make requests from there
		res.redirect('/#' + querystring.stringify({access_token: access_token, refresh_token: refresh_token}));
	}
	else {
		res.redirect('/#' + querystring.stringify({error: 'invalid_token'}));
	}
    });
  }
});


app.get('/nodejs/refresh_token', function(req, res) {

	console.log("Refresh token!")
	// requesting access token from refresh token
	var refresh_token = req.query.refresh_token;
	var authOptions = {
		url: 'https://accounts.spotify.com/api/token',
		headers: { 'Authorization': 'Basi ' + (new Buffer(client_id + ':' + client_secret).toString('base64')) },
		form: {
			grant_type: 'refresh_token',
			refresh_token: refresh_token
		},
		json: true
	};

	request.post(authOptions, function(error, response, body) {
		if (!error && response.statusCode === 200) {
			var access_token = body.access_token;
			res.send({
				'access_token': access_token
			});
		}
		});
	});

console.log(chalk.green('Listening intently on port ' + port));
app.listen(port);
