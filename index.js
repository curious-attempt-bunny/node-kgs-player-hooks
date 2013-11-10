var express   = require('express');
var app       = express();
var jsdom     = require('jsdom');
var path      = require('path');
var http      = require('http');
var async     = require('async');
var proxies   = require('proxies');
var request   = require('request');
var userStore = require('./lib/userStore');

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
  next(null, additionalGames);
};

var getArchivedGamesFrom = function(page, user, games, next) {
  userStore.getArchiveGames(user, page, function(error, archivedGames) {
    if (archivedGames) {
      console.log("Cache hit for page "+page);
      archivedGames.forEach(function(game) { games.push(game); });
      return next();
    }
    getWithProxy(page, function(errors, window) {
      if (errors) { return next(); }
      addGamesFrom(user, games, window, function(error, additionalGames) {
        if (error) {
          return next(error);
        }
        userStore.setArchiveGames(user, page, additionalGames, next);
      });
    });
  });
};

var getWithProxy = function(url, next) {
  retryGetWithProxy(3, url, next);
};

var retryGetWithProxy = function(remainingRetries, url, next) {
  proxies(function(proxy) {
    console.log(proxy);
    console.log(url);
    request.get({url: url, proxy: proxy}, function(error, response, body) {
      if (!error && response.statusCode > 400) {
        error = "Response statusCode: "+response.statusCode;
      }
      if (error) {
        console.error(error);
        if (remainingRetries > 0) {
          console.error("Retrying ("+(remainingRetries-1)+" left) for "+url);
          return retryGetWithProxy(remainingRetries-1, url, next);
        } else {
          return next(error);
        }
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

// We're making this more complex (streaming and newline at intervals) to work around Heroku's connection idle handling
app.get('/users/:id/games', function(req, res) {
  var user = req.params.id;
  var url = "http://www.gokgs.com/gameArchives.jsp?user="+user;

  var intervalId = setInterval(function() {
    try {
      res.write("  \n");
    } catch(e) {
      console.error(e);
      clearInterval(intervalId);
    }
  }, 3000);
  res.status(200);
  // http://nodejs.org/api/http.html#http_response_write_chunk_encoding
  // "The second time response.write() is called, Node assumes you're going to be streaming data, and sends that separately."
  res.write("{ \n");
  res.write("  \"source\": \""+url+"\", \n");
  getWithProxy(url, function(errors, window) {
    if (errors) { res.status(500); res.end(); return; }
    var games = [];
    addGamesFrom(user, games, window, function() {
      var pages = [];
      window.$('a[href*="gameArchives"]').toArray().forEach(function(a) {
        var page = a.href;
        console.log(page);
        if (page.indexOf('&year=') != -1) {
          page = "http://www.gokgs.com/gameArchives"+page.split("gameArchives")[1];
          pages.push(page);
        }
      });
      async.each(pages, function(page, next) {
          console.log(page);
          getArchivedGamesFrom(page, user, games, next);
        }, function() {
          games = games.sort(function(a,b) {
            return b.started - a.started;
        });
        res.write("  \"games\": ");
        res.write(JSON.stringify(games, null, "  "));
        res.write("\n");
        res.write("}");
        res.end();
      });
    });
  });
});

app.get('/', function(req, res) {
  res.render('index', {exampleUrl: 'http://'+req.headers.host+'/users/nicholebb/games'});
});

http.createServer(app).listen(app.get('port'));