"use strict";

var express = require('express');
var http = require('http');

var app = express();

// all environments
app.set('port', 3000);
app.set('host', '');
app.use('/', express.static(__dirname + '/'));

var server = http.createServer(app);

server.listen(app.get('port'), app.get('host'));
