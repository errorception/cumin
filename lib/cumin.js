var redis = require("redis");
var consolePrefix = "[qmin]";

module.exports = function(port, host, options) {
	var redisArgs = arguments;

	var nonBlockingClient = redis.createClient.apply(redis, redisArgs),
		blockingClient;

	var redisBlpopTimeout = 1;

	var alreadyListening = false,
		killSignalReceived = false,
		pendingTasks = 0,
		killWaitTimeout = 20;

	function onKillSignal() {
		if(!killSignalReceived) {
			killSignalReceived = true;
			console.info("\n" + consolePrefix, "Attempting clean shutdown...");
			console.info(consolePrefix, "To force shutdown, hit Ctrl+C again.");
			console.info(consolePrefix, "Waiting upto", redisBlpopTimeout, "seconds for next chance to kill the redis connection...");
			setTimeout(function() {
				console.info(consolePrefix, "Forcing kill due to", killWaitTimeout, "seconds timeout.");
				process.exit();
			}, killWaitTimeout * 1000)
		} else {
			console.info("\n" + consolePrefix, "Forcing shutdown now.");
			process.exit(1);
		}
	}

	function attemptCleanShutdown(safeMode) {
		console.info(consolePrefix, "Not reconnecting to redis because of kill signal received.");
		if(safeMode) {
			if(pendingTasks == 0) {
				console.info(consolePrefix, "No pending tasks. Exiting now.");
				process.exit();
			} else {
				console.info(consolePrefix, "Waiting for pending tasks to be completed. Pending count:", pendingTasks);
			}
		} else {
			console.info(consolePrefix, "We've been working in 'no-guarantees' mode. Giving time for pending tasks, if any, to complete.");
			console.info(consolePrefix, "This is not cool. Shutdown might be unclean.");
			console.info(consolePrefix, "To learn how to fix this, please refer to the docs.");
			console.info(consolePrefix, "Waiting 3 seconds to exit...");
			setTimeout(process.exit, 3000);
		}
	}

	function continueListening(queueName, handler) {
		var safeMode = (handler.length > 1);

		if(killSignalReceived) return attemptCleanShutdown(safeMode);

		blockingClient.blpop(queueName, redisBlpopTimeout, function(err, data) {
			if(err) return console.log(err);

			if(data) {
				var bareQueueName = queueName.slice(("qmin.").length);
				nonBlockingClient.hset("qminmeta." + bareQueueName, "lastDequeued", Date.now());
				nonBlockingClient.publish("qmin.dequeued", data[1]);

				var queueItem = JSON.parse(data[1]);

				if(safeMode) {
					pendingTasks++;
					handler(queueItem.data, function() {
						pendingTasks--;

						nonBlockingClient.hset("qminmeta." + bareQueueName, "completed", Date.now());
						nonBlockingClient.publish("qmin.processed", data[1]);

						if(killSignalReceived && pendingTasks) {
							console.info(consolePrefix, "Waiting for pending tasks to be completed. Pending count:", pendingTasks);
						}

						if(killSignalReceived && !pendingTasks) {
							console.info(consolePrefix, "Pending tasks completed. Shutting down now.");
							process.exit();
						}
					});
				} else {
					handler(queueItem.data);
				}
			}

			process.nextTick(function() {
				continueListening(queueName, handler);
			});
		});
	}

	return {
		enqueue: function(queueName, queueData, done) {
			if(!queueName) {
				throw new Error("Queue name must be provided. eg. 'emailQueue'.");
			}

			var now = Date.now();
			var message = JSON.stringify({
				byPid: process.pid,
				byTitle: process.title,
				queueName: queueName,
				date: now,
				data: queueData,
				retryCount: 0
			});

			nonBlockingClient.sadd("qminqueues", queueName);
			nonBlockingClient.hset("qminmeta." + queueName, "lastEnqueued", now);
			nonBlockingClient.rpush("qmin." + queueName, message);
			nonBlockingClient.publish("qmin.enqueued", message, done);
		},

		listen: function(queueName, handler) {
			if(!queueName) {
				throw new Error(consolePrefix, "Queue name must be provided. eg. 'emailQueue'.");
			}

			if(!handler) {
				throw new Error(consolePrefix, "You must provide a hander to .listen.");
			}

			if(alreadyListening) {
				throw new Error(consolePrefix, "You can only .listen once in an app. To listen to another queue, create another app.");
			}

			if(!blockingClient) {
				blockingClient = redis.createClient.apply(redis, redisArgs);
			}

			process.on("SIGINT", onKillSignal);
			process.on("SIGTERM", onKillSignal);
			alreadyListening = true;

			if(handler.length < 2) {
				console.warn(consolePrefix, "We are going to .listen in the 'no-guarantees' mode. This is not cool.");
				console.warn(consolePrefix, "Refer to the docs to learn how to fix this.");
				console.warn(consolePrefix, "Continuing anyway.");
			}

			continueListening("qmin." + queueName, handler);
		}
	}
}
