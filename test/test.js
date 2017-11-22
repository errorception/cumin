var should = require("should"),
	redisClient = require("redis").createClient(),
	cuminCreator = require("../"),
	cumin = cuminCreator();

describe(".enqueue", function() {
	it("should enqueue a job", function(done) {
		cumin.enqueue("test.list", {some: "task"}, function(err) {
			should.not.exist(err);

			redisClient.llen("cumin.test.list", function(err, len) {
				len.should.equal(1);

				redisClient.lpop("cumin.test.list", function(err, item) {
					item = JSON.parse(item);

					item.byPid.should.be.a.Number;
					item.byTitle.should.be.a.String;
					item.queueName.should.equal("test.list");
					item.date.should.be.a.Number;
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
		cumin.enqueue("test.list", {some: "task"});

		cumin.listen("test.list", function(queueData, doneTask) {
			queueData.should.eql({some: "task"});
			doneTask();
			done();
		});
	});

	it("should not listen to another list while already listening to the first", function() {
		try {
			cumin.listen("test.list2", function() {});
		} catch(e) {
			e.should.exist;
			return;
		}

		true.should.not.exist;	// Ensure that control flow doesn't reach here at all
	});

	it("should not even listen to the same list again", function() {
		try {
			cumin.listen("test.list", function() {});
		} catch(e) {
			e.should.exist;
			return;
		}

		true.should.not.exist;	// Ensure that control flow doesn't reach here at all
	});

	it('should enqueue with promises', function(done) {
		cumin.enqueue('test.list3', { some: 'task' }).then(function(task) {
			done();
		});
	});

	it('should listen with promises', function(done) {
		var cumin = cuminCreator();
		var delay = () => new Promise(resolve => setTimeout(resolve, 300));
		cumin.listen('test.list3', async task => {
			await delay();
			done();
		});
	})
});
