var http = require('http');
http.createServer(function (req, res){
	res.write(' ALIVE ');
	res.end()

}).listen(8080);