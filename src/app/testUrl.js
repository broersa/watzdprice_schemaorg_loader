var schema = require("./schemaParser.js");
var request = require("request");

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
          console.log(url + " - " + JSON.stringify(msg) + " - " + JSON.stringify(product) );
        } catch (err) {
          console.error("Error: " + err.message + " - " + url + " - " + JSON.stringify(msg) + " - " + JSON.stringify(product) );
          return
        }
      });
    });
  }, 0, item);
}
