var redis  = require("redis");
var client = redis.createClient();

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