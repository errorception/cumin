var should = require("should"),
	redisClient = require("redis").createClient(),
	listqueue = require("../")();

describe(".enqueue", function() {
	it("should enqueue a job", function(done) {
		listqueue.enqueue("test.list", {some: "task"}, function(err) {
			should.not.exist(err);

			redisClient.llen("listqueue.test.list", function(err, len) {
				len.should.equal(1);

				redisClient.lpop("listqueue.test.list", function(err, item) {
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
		listqueue.enqueue("test.list", {some: "task"});

		listqueue.listen("test.list", function(err, queueData) {
			should.not.exist(err);

			queueData.should.eql({some: "task"});
			done();
		});
	});

	it("should listen to multiple lists simultaneously without blocking each other", function(done) {
		var itemsPopped = 0;

		listqueue.listen("test.list1", function(err, queueData) {
			should.not.exist(err);

			queueData.should.eql({taskFor: "list1"});
			itemsPopped++;

			if(itemsPopped === 2) {
				done();
			}
		});

		listqueue.listen("test.list2", function(err, queueData) {
			should.not.exist(err);

			queueData.should.eql({taskFor: "list2"});
			itemsPopped++;

			if(itemsPopped === 2) {
				done();
			}
		});

		listqueue.enqueue("test.list1", {taskFor: "list1"});
		listqueue.enqueue("test.list2", {taskFor: "list2"});
	});

	it("should only pop to one listener, even if there are multiple listeners", function(done) {
		var itemsPopped = 0;
		var handler = function(err, queueData) {
			should.not.exist(err);

			queueData.should.eql({some: "task"});
			itemsPopped++;
		};

		listqueue.listen("test.list3", handler);
		listqueue.listen("test.list3", handler);

		listqueue.enqueue("test.list3", {some: "task"});

		setTimeout(function() {
			itemsPopped.should.equal(1);
			done();
		}, 1000);	// 1 second should be enough for everyone - Paraphrasing Bill Gates
	});
});
