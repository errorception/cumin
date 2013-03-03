var redis = require("redis");

module.exports = function(port, host, options) {
	var initArgs = arguments,
		redisClient = redis.createClient.apply(redis, initArgs);

	var inFlightCount = 0,
		isSigIntHandlerAttached = false;
		sigintReceived = false;

	function exitIfNothingPending() {
		if(!inFlightCount) process.exit();
	}

	function getNextQueueItem(queueName, handler) {
		if(sigintReceived) return;

		redisClient.lpop("qmin." + queueName, function(err, data) {
			if(err) return console.error("Problem popping out of queue", queueName, err);

			if(data) {
				redisClient.hset("qminmeta." + queueName, "lastDequeued", Date.now());
				redisClient.publish("qmin.dequeued", data);

				var parsed = JSON.parse(data);
				handler(parsed);
			} else {
				handler(null);
			}
		});
	}

	function wrapHandler(handler) {
		return function(poppedItem) {
			if(poppedItem) {
				if(handler.length === 1) {
					handler(poppedItem.data);
				} else {
					inFlightCount++;
					handler(poppedItem.data, function() {
						inFlightCount--;

						if(sigintReceived) exitIfNothingPending();
					});
				}
			}
		}
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

			redisClient.sadd("qminqueues", queueName);
			redisClient.hset("qminmeta." + queueName, "lastEnqueued", now);
			redisClient.rpush("qmin." + queueName, message, done);
			redisClient.publish("qmin.enqueued", message);
		},

		listen: function(queueName, handler) {
			if(!isSigIntHandlerAttached) {
				isSigIntHandlerAttached = true;
				process.on("SIGINT", function() {
					sigintReceived = true;

					if(inFlightCount) {
						console.log("Can't exit, as", inFlightCount, "items are being processed. Waiting...");
					} else {
						process.exit();
					}
				});
			}
			var wrappedHandler = wrapHandler(handler);

			getNextQueueItem(queueName, wrappedHandler);
			setTimeout(function() {
				getNextQueueItem(queueName, wrappedHandler);
			}, 100);
		},

		_inFlightCount: function() {
			return inFlightCount;
		},

		_fakeSigint: function() {
			sigintReceived = true;
		}
	}
}