// forked from sitemap-stream-parser package
(function() {
  var agentOptions, async, request, sax, sitemapParser, zlib,
    bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

  request = require('request');

  sax = require('sax');

  async = require('async');

  zlib = require('zlib');

  agentOptions = {
    keepAlive: true
  };

  request = request.defaults({
    agentOptions: agentOptions,
    timeout: 60000
  });

  sitemapParser = (function() {
    function sitemapParser(agent, url_cb1, sitemap_cb1) {
      this.agent = agent;
      this.url_cb = url_cb1;
      this.sitemap_cb = sitemap_cb1;
      this.parse = bind(this.parse, this);
      this.visited_sitemaps = {};
    }

    sitemapParser.prototype._download = function(url, agent, parserStream) {
      var unzip;
      if (url.lastIndexOf('gz') === url.length - 2) {
        unzip = zlib.createUnzip();
        return request.get({
          url: url,
          headers: {
            'user-agent': agent
          },
          encoding: null
        }).pipe(unzip).pipe(parserStream);
      } else {
        return request.get({
          url: url,
          headers: {
            'user-agent': agent
          },
          gzip: true
        }).pipe(parserStream);
      }
    };

    sitemapParser.prototype.parse = function(url, done) {
      var inLoc, isSitemapIndex, isURLSet, parserStream;
      isURLSet = false;
      isSitemapIndex = false;
      inLoc = false;
      this.visited_sitemaps[url] = true;
      parserStream = sax.createStream(false, {
        trim: true,
        normalize: true,
        lowercase: true
      });
      parserStream.on('opentag', (function() {
        return function(node) {
          inLoc = node.name === 'loc';
          if (node.name === 'urlset') {
            isURLSet = true;
          }
          if (node.name === 'sitemapindex') {
            return isSitemapIndex = true;
          }
        };
      })(this));
      parserStream.on('error', (function() {
        return function(err) {
          return done(err);
        };
      })(this));
      parserStream.on('text', (function(_this) {
        return function(text) {
          if (inLoc) {
            if (isURLSet) {
              return _this.url_cb(text);
            } else if (isSitemapIndex) {
              if (_this.visited_sitemaps[text] != null) {
                return console.error("Already parsed sitemap: " + text);
              } else {
                return _this.sitemap_cb(text);
              }
            }
          }
        };
      })(this));
      parserStream.on('end', (function() {
        return function() {
          return done(null);
        };
      })(this));
      return this._download(url, this.agent, parserStream);
    };

    return sitemapParser;

  })();

  exports.parseSitemap = function(url, agent, url_cb, sitemap_cb, done) {
    var parser;
    parser = new sitemapParser(agent, url_cb, sitemap_cb);
    return parser.parse(url, done);
  };

  exports.parseSitemaps = function(urls, agent, url_cb, done) {
    var parser, queue;
    if (!(urls instanceof Array)) {
      urls = [urls];
    }
    parser = new sitemapParser(agent, url_cb, function(sitemap) {
      return queue.push(sitemap);
    });
    queue = async.queue(parser.parse, 4);
    queue.drain = function() {
      return done(null, Object.keys(parser.visited_sitemaps));
    };
    return queue.push(urls);
  };

}).call(this);
