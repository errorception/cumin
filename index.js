var redis = require("redis");

module.exports = function(port, host, options) {
	var initArgs = arguments,
		enqueueClient = redis.createClient.apply(redis, initArgs);

	return {
		enqueue: function(queueName, queueData, done) {
			if(!queueName) {
				throw new Error("Queue name must be provided. eg. 'emailQueue'.");
			}

			enqueueClient.rpush("qmin." + queueName, JSON.stringify({
				byPid: process.pid,
				byTitle: process.title,
				queueName: queueName,
				date: Date.now(),
				data: queueData
			}), done);
		},

		listen: function(queueName, handler) {
			var listenClient = redis.createClient.apply(redis, initArgs);
			listenClient.blpop("qmin." + queueName, 0, function(err, data) {
				if(err) return handler(err);

				try {
					var parsed = JSON.parse(data[1]);
					handler(null, parsed.data);
				} catch(e) {
					handler(e);
				}
			});
		}
	}
}