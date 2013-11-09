var redis  = require("redis");
var url    = require("url");
var client;

if (process.env.REDISTOGO_URL) {
  var rtg = url.parse(process.env.REDISTOGO_URL);
  client = redis.createClient(rtg.port, rtg.hostname);

  client.auth(rtg.auth.split(":")[1]);
} else {
  client = redis.createClient();
}

client.on("error", function (err) {
  console.log("Redis Error " + err);
});

module.exports = {
  getArchiveGames: function(user, archive, next) {
    client.hget(user, archive, function(error, games) {
      if (error) {
        console.error(error);
        return next(error);
      }
      next(null, JSON.parse(games));
    });
  },

  setArchiveGames: function(user, archive, games, next) {
    client.hset(user, archive, JSON.stringify(games), next);
  }
};