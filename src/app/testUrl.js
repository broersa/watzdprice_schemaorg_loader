var schema = require("./schemaParser.js");
var request = require("request");
var productParser = require('./productParser.js');
var cheerio = require('cheerio');

processSite(process.argv[2]);

function processSite(item) {
  setTimeout(function (url) {
    request({
        url: url,
        headers: {
          'User-Agent': 'mytestagent',
        }
      }, function(err, resp, body) {
      if (err) {
        console.error("Error downloading url: " + err.message + " - " + url);
        return;
      }
      schema.parseContent(body, function(msg){
        productParser.parseProduct(msg, function (err, product) {
          if (err) {
            console.error(JSON.stringify(err));
          } else {
            if (!product.image || !product.description) {
              var $ = cheerio.load(body);
              if (!product.image) {
                product.image = $('meta[property="og:image"]').attr('content');
              }
              if (!product.description) {
                product.description = $('p.description').first().text();
              }
            }
            console.log(url + " - " + JSON.stringify(msg) + " - " + JSON.stringify(product) );
          }
        });
      });
    });
  }, 0, item);
}
