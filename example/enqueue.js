// Call this as 'node listen.js <queue-name>'

var cumin = require("../")();

setInterval(function() {
	cumin.enqueue(process.argv[2] || "populate-cache", {some: "data"});
}, 500);
