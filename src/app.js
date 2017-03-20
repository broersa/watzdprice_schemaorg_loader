var config = require('config');
var main = require('./app/main.js');

main.process(!(config.dryrun==='false'), config.url, config.urlfilter, config.watzdprice_url, config.shop, config.agent, function (err) {
  if (err) {
    console.error(JSON.stringify(err));
  }
});
