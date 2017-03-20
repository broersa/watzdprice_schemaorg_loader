var url = require('url');
var http = require('http');
var robots = require('robots');
var async = require('async');
var schema = require("./schemaParser.js");
var request = require("request");
var sitemapper = require('./sitemap.js');
var moment = require('moment');
var productParser = require('./productParser.js');
var MyError = require('../MyError.js');

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
            if (site.indexOf(startUrlDetails.hostname) !== -1) {
              all_urls.push(site);
            }
          }, function (err) {
            if (err) {
              return cb(err);
            }
            async.eachLimit(all_urls, 1, function (item, callbackSites) {
              processSite(dryrun, parser, delay, item, agent, shop, urlDetails, function (err, operation) {
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

function processSite(dryrun, parser, delay, item, agent, shop, urlDetails, cb) {
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
            if (dryrun) {
              console.error(JSON.stringify(err));
            }
            return cb();
          }
          schema.parseContent(body, function(msg) {
            productParser.parseProduct(msg, function (err, product) {
              if (err) {
                if (dryrun) {
                  console.error(JSON.stringify(err));
                }
                return cb();
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
                      console.error(JSON.stringify(new MyError('ERROR', 'processSite', 'Error', {dryrun: dryrun, item: item, shop: shop, urlDetails: urlDetails}, err)));
                      return cb();
                    }
                    return cb(null, operation);
                  });
                }
              } else { // no complete product
                return cb();
              }
            });
          });
        });
      }, delay*1000, item);
    } else { // no access
      return cb();
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
    });
    res.on('error', function(err) {
      callback(new MyError('ERROR', 'putProduct', 'Error', {urlDetails: urlDetails, product: product}, err));
    });
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
      callback();
    });
    res.on('error', function(err) {
      callback(new MyError('ERROR', 'postShopLoadStats', 'Error', {urlDetails: urlDetails, shopLoadStats: shopLoadStats}, err));
    });
  });

  // post the data
  put_req.write(shopLoadStats);
  put_req.end();
}
