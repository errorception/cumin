cumin
======

A minimalistic queue implementation using [Redis](http://redis.io/) as a backend. Meant for high-throughput queues. Shuts down gracefully.

One way to build large applications is to not build large applications at all, and instead split the application into small discrete logical pieces. A common way to talk between such micro-applications is to use message queues.

Cumin is a library to put items into a queue, and to 'listen' to the queue for new entries. Ordinarily, you would use either one of the two methods in your application.

Inspired by [Resque](https://github.com/defunkt/resque) and [Kue](https://github.com/learnboost/kue). Adapted to fit node's style of doing multiple things simultaneously in the same process, and to work for high-throughput messages.

**Beta!** This library shouldn't be considered production-ready yet. However, please use this in your apps and let me know what you think.

## Example

In ```app.js```:

```javascript
var cumin = require("cumin")();

// When, say, signup is complete...
cumin.enqueue("mailer", {
    to: "newuser@example.com",
    type: "signup"
});
```

In ```mailer.js```:

```javascript
var cumin = require("cumin")();

cumin.listen("mailer", function(mailJob, done) {
    // mailJob looks as follows:
    //
    // {
    //   to: "newuser@example.com",
    //   type: "signup"
    // }
    // 
    // Remember to call 'done' when you've finished the task.

    done();
});
```

## Graceful shutdowns

One of the benefits of having a distributed setup like the one that ```cumin``` encourages, is that you get to shut down parts of your app so that you can do upgrades etc. without any visible impact to your users. However, because of node's eventing model, your ```.listen```er app might have already picked up multiple items from the queue and might still be processing them when you kill your app. To prevent loss of tasks that might be mid-flight, ```cumin```adds a couple of graceful-shutdown features.

When you give either a ```SIGINT``` or a ```SIGTERM``` kill-signal to an app that is ```cumin.listen```ing to a queue, ```cumin``` will first stop accepting more items from redis. It will then wait for all in-flight jobs to complete. Only when all pending jobs have been completed does the app shut down. This ensures that you don't lose  any items from your queue.

In case you want to bypass this check and kill the app anyway, you can simply send the ```SIGINT``` or ```SIGTERM``` signal a second time. The second signal will force a shutdown without regards for in-flight jobs.

## Installation

    $ npm install cumin

## Usage

### Initiialization

```javascript
var cumin = require("cumin")(redisPort, redisHost, redisOptions)
```

Initializes  the library. All parameters are optional, and default to localhost on the default redis port. These options are passed along to the [node-redis](https://github.com/mranney/node_redis#rediscreateclientport-host-options) module for connection to redis.

### cumin.enqueue(queueName, queueData, [cb])

Enqueues ```queueData``` into a queue with name ```queueName```. You can optionally provide a callback to be called when the enqueue operation is complete. ```queueName``` should be a string following redis's key naming rules. ```queueData``` should be an object that will be ```JSON.stringigy```ied and put into the queue.

### cumin.listen(queueName, function(queueItem, done) { ... });

Pops items out from the ```queueName``` queue. The supplied function will be called whenever an item is popped, and the ```queueItem``` will passed in as an argument. The second argument is a function that should be called when the processing of the queue items is complete.

## Monitoring

Check out the [cumin-monitor](https://github.com/errorception/cumin-monitor) app for a real-time queue-minitoring tool that works with ```cumin```.

## License

(The MIT License)

Copyright (c) 2012 Rakesh Pai <rakeshpai@errorception.com>

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.