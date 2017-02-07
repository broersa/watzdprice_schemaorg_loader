var http = require('http');
var parse = require('csv-parse');
var transform = require('stream-transform');

module.exports = {
  getZanoxComData: function(url, process, callback) {
    var parser = parse({delimiter: ';'});
    var transformer = transform(process, {parallel: 10});
    transformer.on('finish',function(){
      callback();
    });
    http.get(url, function(response) {
      response.pipe(parser).pipe(transformer);
    });
  }
}
