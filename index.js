var queue = require('./lib/queue')
  , _ = require('lodash');


module.exports = function(robot) {
  robot.brain.on('loaded', function() {
    robot.brain.deploy = robot.brain.deploy || {};

    queue.init(robot.brain.deploy);
  });

  robot.respond(/deploy help/i, help);
  robot.respond(/deploy (me|moi)?(.*)/i, queueUser);
  robot.respond(/deploy (done|complete|donzo)/i, dequeueUser);
  robot.respond(/deploy (forget (it|me)|nevermind)/i, forgetMe);
  robot.respond(/deploy (current|who\'s (deploying|at bat))/i, whosDeploying);
  robot.respond(/deploy (next|who\'s (next|on first|on deck))/i, whosNext);
  robot.respond(/deploy (remove|kick|sayonara) (.*)/i, removeUser);
  robot.respond(/deploy (list)/i, listQueue);
  robot.respond(/deploy (dump|debug)/i, queueDump);

  robot.respond(/deploy ping/i, function(res) {
    res.send('deploy pong');
    res.reply('deploy reply pong');
  });

  /**
   * Help stuff
   * @param res
   */
  function help(res) {
    res.send(
      '`deploy me`: Add yourself to the deploy queue. Hubot give you a heads up when it\'s your turn\n' +
      '`deploy done`: Say this when you\'re done and then Hubot will tell the next person. Or you could say `deploy complete` or `deploy donzo`.\n' +
      '`deploy forget me`: Removes you from the queue. If you\'re on there more than once, then just removes your next turn. If you\'re on there more than once, you might think about slowing down and deploying a little less continuously. Or you could say `deploy forget it` or `deploy nevermind`.\n' +
      '`deploy remove _user_`: Removes a user completely from the queue. As my Uncle Ben said, with great power comes great responsibility. Expect angry messages if this isn\'t what you meant to do. Also works with `deploy kick _user_` and `deploy sayonara _user_`.\n' +
      '`deploy current`: Tells you who\'s currently deploying. Also works with `deploy who\'s deploying` and `deploy who\'s at bat`.\n' +
      '`deploy next`: Sneak peek at the next person in line. Do this if the anticipation is killing you. Also works with `deploy who\'s next` and `deploy who\'s on first`.\n' +
      '`deploy list`: Lists the queue. Use wisely, it\'s going to ping everyone :)\n' +
      '`deploy debug`: Kinda like `deploy list`, but for nerds.\n' +
      '`deploy help`: This thing.'
    );
  }

  /**
   * Add a user to the queue
   * @param res
   */
  function queueUser(res) {
    var user = res.message.user.name
      , length = queue.length()
      , what = res.matches[1];

    if (queue.contains(user)) {
      res.reply('Whoa, hold you\'re horses! You\'re already in the queue once. Maybe give someone else a chance first?');
      return;
    }

    queue.push({name: user, what: what});

    if (length === 0 && queue.isCurrent(user)) {
      res.reply('Go for it!');
      return;
    }

    if (length === 1 && queue.isNext(user)) {
      res.reply('Alrighty, you\'re up next!');
      return;
    }

    res.reply('Cool, There\'s ' + (length - 1) + ' person(s) ahead of you. I\'ll let you know when you\'re up.');
  }

  /**
   * Removes a user from the queue if they exist and notifies the next user
   * @param res
   */
  function dequeueUser(res) {
    var user = res.message.user.name;

    if (!queue.contains(user)) {
      res.reply('Ummm, this is a little embarrassing, but you aren\'t in the queue :grimacing:');
      return;
    }

    if (!queue.isCurrent(user)) {
      res.reply('Nice try, but it\'s not your turn yet');
      return;
    }

    queue.advance();
    res.reply('Nice job! :tada:');

    if (!queue.isEmpty()) {
      // Send DM to next in line if the queue isn't empty
      notifyUser(queue.current());
    }
  }

  /**
   * Who's deploying now?
   * @param res
   */
  function whosDeploying(res) {
    var user = res.message.user.name;

    if (queue.isEmpty()) {
      res.reply('Nobodyz!');
    } else if (queue.isCurrent(user)) {
      res.reply('It\'s you. _You\'re_ deploying. Right now.');
    } else {
      var current = queue.current()
        , message = current.name + ' is deploying';

      message += current.what ? ' ' + current.what : '.';
      res.send(message);
    }
  }

  /**
   * Who's up next?
   * @param res
   */
  function whosNext(res) {
    var user = res.message.user.name;

    if (queue.isEmpty()) {
      res.send('Nobodyz!');
    } else if (queue.isNext(user)) {
      res.reply('You\'re up next! Get ready!');
    } else {
      res.send(queue.next() + ' is on deck.');
    }
  }

  /**
   * Removes first instance of the user from the queue
   * @param res
   */
  function forgetMe(res) {
    var user = res.message.user.name;

    if (!queue.contains(user)) {
      res.reply('No sweat! You weren\'t even in the queue :)');
      return;
    }

    if (queue.isCurrent(user)) {
      res.reply('You\'re deploying right now! Did you mean `deploy done`?');
      return;
    }

    queue.remove(user);
    res.reply('Alright, I took you out of the queue. Come back soon!');

  }

  /**
   * Removes all references to a user from the queue
   * @param res
   */
  function removeUser(res) {
    var user = res.match[1]
      , notifyNextUser = queue.isCurrent(user);

    queue.removeAll(user);

    res.send(user + ' has been removed from the queue. I hope that\'s what you meant to do...');

    if (notifyNextUser) {
      notifyUser(queue.current());
    }
  }

  /**
   * Prints a list of users in the queue
   * @param res
   */
  function listQueue(res) {
    if (queue.isEmpty()) {
      res.send('Nobodyz! Like this: []');
    } else {
      res.send('Here\'s who\'s in the queue: ' + _.pluck(queue.get(), 'name').join(', ') + '.');
    }
  }

  /**
   * Dumps the queue to the channel for debugging
   * @param res
   */
  function queueDump(res) {
    res.send(JSON.stringify(queue.get(), null, 2));
  }

  /**
   * Notify a user via DM that it's their turn
   * @param user
   */
  function notifyUser(user) {
    robot.messageRoom(user, 'Hey, you\'re turn to deploy!');
  }
};

