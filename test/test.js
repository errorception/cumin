var should = require("should"),
	redisClient = require("redis").createClient(),
	qmin = require("../")();

describe(".enqueue", function() {
	it("should enqueue a job", function(done) {
		qmin.enqueue("test.list", {some: "task"}, function(err) {
			should.not.exist(err);

			redisClient.llen("qmin.test.list", function(err, len) {
				len.should.equal(1);

				redisClient.lpop("qmin.test.list", function(err, item) {
					item = JSON.parse(item);

					item.byPid.should.be.a("number");
					item.byTitle.should.be.a("string");
					item.queueName.should.equal("test.list");
					item.date.should.be.a("number");
					(Date.now() - item.date).should.be.within(0, 500);
					item.data.should.eql({some: "task"});
					done();
				});
			});
		});
	});
});

describe(".listen", function() {
	it("should listen to a list", function(done) {
		qmin.enqueue("test.list", {some: "task"});

		qmin.listen("test.list", function(queueData) {
			queueData.should.eql({some: "task"});
			done();
		});
	});

	it("should listen to multiple lists simultaneously without blocking each other", function(done) {
		var itemsPopped = 0;

		qmin.listen("test.list1", function(queueData) {
			queueData.should.eql({taskFor: "list1"});
			itemsPopped++;

			if(itemsPopped === 2) {
				done();
			}
		});

		qmin.listen("test.list2", function(queueData) {
			queueData.should.eql({taskFor: "list2"});
			itemsPopped++;

			if(itemsPopped === 2) {
				done();
			}
		});

		qmin.enqueue("test.list1", {taskFor: "list1"});
		qmin.enqueue("test.list2", {taskFor: "list2"});
	});

	it("should only pop to one listener, even if there are multiple listeners", function(done) {
		var itemsPopped = 0;
		var handler = function(queueData) {
			queueData.should.eql({some: "task"});
			itemsPopped++;
		};

		qmin.listen("test.list3", handler);
		qmin.listen("test.list3", handler);

		qmin.enqueue("test.list3", {some: "task"});

		setTimeout(function() {
			itemsPopped.should.equal(1);
			done();
		}, 1000);	// 1 second should be enough for everyone - Paraphrasing Bill Gates
	});

	it("should maintain an internal counter of in-flight queue items", function(done) {
		qmin._inFlightCount().should.equal(0);

		qmin.listen("test.list4", function(item, finished) {
			qmin._inFlightCount().should.equal(1);
			finished();
			qmin._inFlightCount().should.equal(0);

			done();
		});

		qmin.enqueue("test.list4", {some: "task"});
	});
/*
	it("should maintain the internal counter for multiple queueItems too", function(done) {
		qmin._inFlightCount().should.equal(0);

		var maxCounter = 0, finishedCount = 0;
		qmin.listen("test.list4", function(item, finished) {
			console.log("Called", item, qmin._inFlightCount());
			maxCounter = qmin._inFlightCount() < maxCounter ? maxCounter : qmin._inFlightCount();

			setTimeout(function() {
				finished();
				finishedCount++;

				if(finishedCount === 2) {
					maxCounter.should.equal(2);
					done();
				}
			}, 1000);
		});

		qmin.enqueue("test.list4", {some: "task"});
		qmin.enqueue("test.list4", {some: "other task"});
	});
*/
});
