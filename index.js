var express = require('express');
var app     = express();
var jsdom   = require('jsdom');
var path    = require('path');
var http    = require('http');

app.configure(function(){
  app.set('port', process.env.PORT || 8080);
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.favicon());
  app.use(express.logger('dev'));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(path.join(__dirname, 'public')));
});

app.get('/users/:id/games', function(req, res) {
  var url = "http://www.gokgs.com/gameArchives.jsp?user="+req.params.id; 
  jsdom.env(
    url, 
    ["http://code.jquery.com/jquery.js"],
    function (errors, window) {
      var games = [];
      var links = window.$('a[href*="http://files.gokgs.com/games/"]');

      for(var i=0; i<links.length; i++) {
        games.push({sgf: links[i].href});
      }

      res.send({source: url, games: games});
    }
  );
});

app.get('/', function(req, res) {
  console.dir(req);
  res.render('index', {exampleUrl: 'http://'+req.headers.host+'/users/nicholebb/games'});
});

http.createServer(app).listen(app.get('port'));
