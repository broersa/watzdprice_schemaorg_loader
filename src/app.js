var config = require('config');
var main = require('./app/main.js');

console.log(config);

main.process(config.url, config.watzdprice_url, config.shop, config.agent, function (err) {
  if (err) {
    console.error(err);
  }
});