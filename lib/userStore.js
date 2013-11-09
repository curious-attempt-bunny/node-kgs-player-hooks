var userGames = {};

var keyFor = function(user, archive) {
  user+"|"+archive
};

module.exports = {
  getArchiveGames: function(user, archive, next) {
    next(null, userGames[keyFor(user, archive)]);
  },

  setArchiveGames: function(user, archive, games, next) {
    userGames[keyFor(user, archive)] = games;
    next(null);
  }
}