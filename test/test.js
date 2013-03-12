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
		}, 100);
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

	it("should not listen to another list while already listening to the first", function() {
		try {
			qmin.listen("test.list2", function() {});
		} catch(e) {
			e.should.exist;
			return;
		}

		true.should.not.exist;	// Ensure that control flow doesn't reach here at all
	});

	it("should not even listen to the same list again", function() {
		try {
			qmin.listen("test.list", function() {});
		} catch(e) {
			e.should.exist;
			return;
		}

		true.should.not.exist;	// Ensure that control flow doesn't reach here at all
	});
});
