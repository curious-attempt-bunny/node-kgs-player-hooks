var express = require('express');
var app     = express();
var jsdom   = require('jsdom');
var path    = require('path');
var http    = require('http');
var async   = require('async');
var proxies = require('proxies');
var request = require('request');

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

var addGamesFrom = function(user, games, window, next) {
  var additionalGames = window.$('td:contains("Ranked")').toArray().
    map(function(td) {
      return window.$(td).closest('tr');
    }).
    map(function (row) {
      var started = Date.parse(window.$(row.find('td')[4]).text()+" GMT"); 
      var rating  = /\[(.*)\]/.exec(window.$(row.find('td:contains("'+user+' [")')[0]).text())[1];
      return {
        sgf: row.find('a[href*="http://files.gokgs.com/games/"]')[0].href,
        started: started, 
        rating: rating 
      };
    });
  additionalGames.forEach(function(game) { games.push(game); });
  next();
};

var getArchivedGamesFrom = function(page, user, games, next) {
  getWithProxy(page, function(errors, window) {
    if (errors) { return next(); }
    addGamesFrom(user, games, window, next);
  });
};

var getWithProxy = function(url, next) {
  proxies(function(proxy) {
    console.log(proxy);
    console.log(url);
    request.get({url: url, proxy: proxy}, function(error, response, body) {
      if (!error && response.statusCode > 400) {
        error = "Response statusCode: "+response.statusCode;
      }
      if (error) {
        console.error(error);
        return next(error);
      }

      jsdom.env({
        html: body.toString(),
        scripts: ["http://code.jquery.com/jquery.js"],
        done: function(errors, window) {
          if (errors) {
            console.error(errors);
          }
          next(errors, window);
        }
      });
    });
  });
};

app.get('/users/:id/games', function(req, res) {
  var user = req.params.id;
  var url = "http://www.gokgs.com/gameArchives.jsp?user="+user; 
  getWithProxy(url, function(errors, window) {
    if (errors) { res.status(500); res.end(); return; }
    var games = []; 
    addGamesFrom(user, games, window, function() {
      var pages = [];
      window.$('a[href*="gameArchives"]').toArray().forEach(function(a) { 
        var page = a.href;
        console.log(page);
        if (page.indexOf('&year=') != -1) {
          page = "http://www.gokgs.com/gameArchives"+page.split("gameArchives")[1]
          pages.push(page);
        }
      });
      async.each(pages, function(page, next) {
          console.log(page);
          getArchivedGamesFrom(page, user, games, next);
        }, function() {
          games = games.sort(function(a,b) {
            return b.started - a.started
        });
        res.send({source: url, games: games});
      });
    });
  });
});

app.get('/', function(req, res) {
  res.render('index', {exampleUrl: 'http://'+req.headers.host+'/users/nicholebb/games'});
});

http.createServer(app).listen(app.get('port'));