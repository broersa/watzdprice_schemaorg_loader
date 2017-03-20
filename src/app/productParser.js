var MyError = require('../MyError.js');

module.exports = {
  parseProduct: function(msg, cb) {
    var product = {};
    try {
      for (var i = 0, ilen = msg.elems.length; i < ilen; i++) {
        if (msg.elems[i].product || msg.elems[i].offerDetails) {
          var item;
          if (msg.elems[i].product) item = msg.elems[i].product;
          if (msg.elems[i].offerDetails) item = msg.elems[i].offerDetails;

          for (var j = 0, jlen = item.length; j < jlen; j++) {
            if (!product.name && item[j].name && item[j].name.text) {
              product.name = item[j].name.text.substring(0,255);
            }
            if (!product.eancode && item[j].gtin13 && item[j].gtin13.text) {
              product.eancode = item[j].gtin13.text.substring(0,255);
            }
            if (!product.eancode && item[j].gtin13 && item[j].gtin13.content) {
              product.eancode = item[j].gtin13.content.substring(0,255);
            }
            if (!product.brand && item[j].brand && item[j].brand.text) {
              product.brand = item[j].brand.text.substring(0,255);
            }
            if (!product.brand && item[j].brand && item[j].brand.content) {
              product.brand = item[j].brand.content.substring(0,255);
            }
            if (!product.price && item[j].price && item[j].price.text) {
              product.price = parseFloat(item[j].price.text.replace(',','.'));
            }
            if (!product.price && item[j].price && item[j].price.content) {
              product.price = parseFloat(item[j].price.content.replace(',','.'));
            }
            if (!product.image && item[j].image && item[j].image.content) {
              product.image = item[j].image.content.substring(0,1999);
            }
            if (!product.image && item[j].image && item[j].image.src) {
              product.image = item[j].image.src.substring(0,1999);
            }
            if (!product.description && item[j].description && item[j].description.text) {
              product.description = item[j].description.text.substring(0,1999);
            }
            if (!product.description && item[j].description && item[j].description.content) {
              product.description = item[j].description.content.substring(0,1999);
            }
          }
        }
      }
    } catch (err) {
      return cb(new MyError('ERROR', 'parseProduct', 'Error', {msg: msg}, err));
    }
    return cb(null, product);
  }
}
