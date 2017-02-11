var url = require('url');
var http = require('http');
var robots = require('robots');
var async = require('async');
var schema = require("./schemaParser.js");
var request = require("request");
var sitemapper = require('./sitemap.js');
var moment = require('moment');

module.exports = {
  process: function(start_url, watzdprice_url, shop, agent, cb) {
    var start = moment().format();
    var added = 0;
    var updated = 0;

    var urlDetails = url.parse(watzdprice_url);
    var parser = new robots.RobotsParser();
    parser.setUrl(start_url, function(parser, success) {
      if(success) {
        var delay = parser.getCrawlDelay(agent);
        if (!delay) delay = 0;
        var all_urls = [];
        parser.getSitemaps(function(sitemaps) {
          sitemapper.parseSitemaps(sitemaps, agent, function (site) {
            all_urls.push(site);
          }, function (err) {
            if (err) {
              return cb(err);
            }
            async.eachLimit(all_urls, 1, function (item, callbackSites) {
              processSite(parser, delay, item, agent, shop, urlDetails, function (err, operation) {
                if (err) {
                  return callbackSites(err);
                }
                if (operation === 'added') {
                  added++;
                }
                if (operation === 'updated') {
                  updated++;
                }
                callbackSites();
              });
            }, function (err) {
              if (err) {
                return cb(err);
              }
               return postShopLoadStats(urlDetails, JSON.stringify({
                shop: shop,
                start: start,
                end: moment().format(),
                added: added,
                updated: updated
              }), cb);
            });
          });
        });
      }
    });
  }
}

function processSite(parser, delay, item, agent, shop, urlDetails, cb) {
  parser.canFetch('watzdprice', item, function (access) {
    if (access) {
      setTimeout(function (url) {
        request({
            url: url,
            headers: {
              'User-Agent': agent,
            }
          }, function(err, resp, body) {
          if (err) {
            console.error(shop + " - Error downloading url: " + err.message + " - " + url);
            return cb(null,null);
          }
          console.log(shop + " - " + url);
          schema.parseContent(body, function(msg){
            try {
              var product = {};
              for (var i = 0, ilen = msg.elems.length; i < ilen; i++) {
                if (msg.elems[i].product) {
                  for (var j = 0, jlen = msg.elems[i].product.length; j < jlen; j++) {
                    if (msg.elems[i].product[j].name && msg.elems[i].product[j].name.text) {
                      product.name = msg.elems[i].product[j].name.text;
                    }
                    if (msg.elems[i].product[j].gtin13 && msg.elems[i].product[j].gtin13.text) {
                      product.eancode = msg.elems[i].product[j].gtin13.text;
                    }
                    if (msg.elems[i].product[j].gtin13 && msg.elems[i].product[j].gtin13.content) {
                      product.eancode = msg.elems[i].product[j].gtin13.content;
                    }
                    if (msg.elems[i].product[j].brand && msg.elems[i].product[j].brand.text) {
                      product.brand = msg.elems[i].product[j].brand.text;
                    }
                    if (msg.elems[i].product[j].brand && msg.elems[i].product[j].brand.content) {
                      product.brand = msg.elems[i].product[j].brand.content;
                    }
                    if (msg.elems[i].product[j].price && msg.elems[i].product[j].price.text) {
                      product.price = parseFloat(msg.elems[i].product[j].price.text.replace(',','.'));
                    }
                    if (msg.elems[i].product[j].price && msg.elems[i].product[j].price.content) {
                      product.price = parseFloat(msg.elems[i].product[j].price.content.replace(',','.'));
                    }
                    if (msg.elems[i].product[j].image && msg.elems[i].product[j].image.content) {
                      product.image = msg.elems[i].product[j].image.content;
                    }
                    if (msg.elems[i].product[j].image && msg.elems[i].product[j].image.src) {
                      product.image = msg.elems[i].product[j].image.src;
                    }
                    if (msg.elems[i].product[j].description && msg.elems[i].product[j].description.text) {
                      product.description = msg.elems[i].product[j].description.text;
                    }
                    if (msg.elems[i].product[j].description && msg.elems[i].product[j].description.content) {
                      product.description = msg.elems[i].product[j].description.content;
                    }
                  }
                }
              }
              if (product.name && product.price && product.price !== 'NaN') {
                product.url = url;
                product.shop = shop;
                product.datetime = moment().format();
                putProduct(urlDetails, JSON.stringify(product), function (err, operation) {
                  if (err) {
                    console.error(shop + " - Error putProduct: " + err.message + " - " + url + " - " + JSON.stringify(msg) + " - " + JSON.stringify(product));
                    return cb(null, null);
                  }
                  cb(null, operation);
                });
              } else {
                cb(null, null);
              }
            } catch (err) {
              console.error(shop + " - Error: " + err.message + " - " + url + " - " + JSON.stringify(msg) + " - " + JSON.stringify(product) );
              cb(null, null);
            }
          });
        });
      }, delay*1000, item);
    } else {
      cb();
    }
  });
}

function putProduct (urlDetails, product, callback) {
  var put_options = {
    host: urlDetails.hostname,
    port: urlDetails.port,
    path: '/updateproduct',
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(product)
    }
  };
  // Set up the request
  var put_req = http.request(put_options, function(res) {
      res.setEncoding('utf8');
      var body = '';
      res.on('data', function (chunk) {
        body = body + chunk;
      });
      res.on('end', function() {
        var d = JSON.parse(body);
        callback(null, d.operation);
      })
  });

  // post the data
  put_req.write(product);
  put_req.end();
}

function postShopLoadStats (urlDetails, shopLoadStats, callback) {
  var post_options = {
    host: urlDetails.hostname,
    port: urlDetails.port,
    path: '/addshoploadstats',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(shopLoadStats)
    }
  };

  // Set up the request
  var put_req = http.request(post_options, function(res) {
      res.setEncoding('utf8');
      res.on('end', function() {
        callback(null);
      })
  });

  // post the data
  put_req.write(shopLoadStats);
  put_req.end();
}
