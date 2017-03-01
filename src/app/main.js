var url = require('url');
var http = require('http');
var robots = require('robots');
var async = require('async');
var schema = require("./schemaParser.js");
var request = require("request");
var sitemapper = require('./sitemap.js');
var moment = require('moment');

module.exports = {
  process: function(dryrun, start_url, watzdprice_url, shop, agent, cb) {
    if (dryrun) console.log('Running in dryrun mode!');
    var start = moment().format();
    var added = 0;
    var updated = 0;

    var startUrlDetails = url.parse(start_url);
    var urlDetails = url.parse(watzdprice_url);
    var parser = new robots.RobotsParser();
    parser.setUrl(start_url, function(parser, success) {
      if(success) {
        var delay = parser.getCrawlDelay(agent);
        if (!delay) delay = 0;
        parser.getSitemaps(function(sitemaps) {
          var all_urls = [];
          sitemapper.parseSitemaps(sitemaps, agent, function (site) {
            all_urls.push(site);
          }, function (err) {
            if (err) {
              return cb(err);
            }
            async.eachLimit(all_urls, 1, function (item, callbackSites) {
              processSite(dryrun, startUrlDetails.hostname, parser, delay, item, agent, shop, urlDetails, function (err, operation) {
                if (err) {
                  return callbackSites(err);
                }
                if (operation === 'added') {
                  added++;
                }
                if (operation === 'updated') {
                  updated++;
                }
                return callbackSites();
              });
            }, function (err) {
              if (err) {
                return cb(err);
              }
              var stats = JSON.stringify({
                shop: shop,
                start: start,
                end: moment().format(),
                added: added,
                updated: updated
              });
              if (dryrun) {
                console.log(stats);
                return cb(null);
              } else {
                return postShopLoadStats(urlDetails, stats, cb);
              }
            });
          });
        });
      }
    });
  }
}

function processSite(dryrun, hostname, parser, delay, item, agent, shop, urlDetails, cb) {
  if (item.indexOf(hostname) !== -1) {
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
            schema.parseContent(body, function(msg) {
              try {
                var product = {};
                for (var i = 0, ilen = msg.elems.length; i < ilen; i++) {
                  if (msg.elems[i].product) {
                    for (var j = 0, jlen = msg.elems[i].product.length; j < jlen; j++) {
                      if (!product.name && msg.elems[i].product[j].name && msg.elems[i].product[j].name.text) {
                        product.name = msg.elems[i].product[j].name.text.substring(0,255);
                      }
                      if (!product.eancode && msg.elems[i].product[j].gtin13 && msg.elems[i].product[j].gtin13.text) {
                        product.eancode = msg.elems[i].product[j].gtin13.text.substring(0,255);
                      }
                      if (!product.eancode && msg.elems[i].product[j].gtin13 && msg.elems[i].product[j].gtin13.content) {
                        product.eancode = msg.elems[i].product[j].gtin13.content.substring(0,255);
                      }
                      if (!product.brand && msg.elems[i].product[j].brand && msg.elems[i].product[j].brand.text) {
                        product.brand = msg.elems[i].product[j].brand.text.substring(0,255);
                      }
                      if (!product.brand && msg.elems[i].product[j].brand && msg.elems[i].product[j].brand.content) {
                        product.brand = msg.elems[i].product[j].brand.content.substring(0,255);
                      }
                      if (!product.price && msg.elems[i].product[j].price && msg.elems[i].product[j].price.text) {
                        product.price = parseFloat(msg.elems[i].product[j].price.text.replace(',','.'));
                      }
                      if (!product.price && msg.elems[i].product[j].price && msg.elems[i].product[j].price.content) {
                        product.price = parseFloat(msg.elems[i].product[j].price.content.replace(',','.'));
                      }
                      if (!product.image && msg.elems[i].product[j].image && msg.elems[i].product[j].image.content) {
                        product.image = msg.elems[i].product[j].image.content.substring(0,1999);
                      }
                      if (!product.image && msg.elems[i].product[j].image && msg.elems[i].product[j].image.src) {
                        product.image = msg.elems[i].product[j].image.src.substring(0,1999);
                      }
                      if (!product.description && msg.elems[i].product[j].description && msg.elems[i].product[j].description.text) {
                        product.description = msg.elems[i].product[j].description.text.substring(0,1999);
                      }
                      if (!product.description && msg.elems[i].product[j].description && msg.elems[i].product[j].description.content) {
                        product.description = msg.elems[i].product[j].description.content.substring(0,1999);
                      }
                    }
                  }
                }
              } catch (err) {
                console.error(shop + " - Error: " + err.message + " - " + url + " - " + JSON.stringify(msg) + " - " + JSON.stringify(product) );
                return cb(null, null);
              }
              if (product.name && product.price && product.price !== 'NaN') {
                product.url = url;
                product.shop = shop;
                product.datetime = moment().format();
                if (dryrun) {
                  console.log(JSON.stringify(product));
                  return cb(null, 'added');
                } else {
                  putProduct(urlDetails, JSON.stringify(product), function (err, operation) {
                    if (err) {
                      console.error(shop + " - Error putProduct: " + err.message + " - " + url + " - " + JSON.stringify(msg) + " - " + JSON.stringify(product));
                      return cb(null, null);
                    }
                    return cb(null, operation);
                  });
                }
              } else {
                return cb(null, null);
              }
            });
          });
        }, delay*1000, item);
      } else { // no access
        return cb(null, null);
      }
    });
  } else { // hostname does not match
    return cb(null, null);
  }
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
