var request = require("request-promise");
var Promise = require("bluebird");
var Product = require("./product");

function Cortex(baseUrl, scope, token) {
  this.cortexBaseUrl = baseUrl;
  this.scope = scope;  // this scope is used for url links
  this.token = token;
}

Cortex.prototype.cortexLogin = function (email, password) {
  return request({
    uri: this.cortexBaseUrl + '/oauth2/tokens',
    method: 'POST',
    form: {
      grant_type: 'password',
      scope: this.scope,
      role: 'REGISTERED',
      username: email,
      password: password
    }
  });
};

Cortex.prototype.cortexGet = function (uri) {
  return request({
    uri: uri,
    method: 'GET',
    headers: {Authorization: 'bearer ' + this.token},
    timeout: 9000 // HAX because its so unstable...
  });
};

Cortex.prototype.cortexPost = function (uri, data) {
  return request({
    uri: uri,
    method: 'POST',
    headers: {
      Authorization: 'bearer ' + this.token,
      'Content-type': 'application/json'
    },
    body: JSON.stringify(data)
  });
};

Cortex.prototype.cortexPut = function (uri, data) {
  return request({
    uri: uri,
    method: 'PUT',
    headers: {
      Authorization: 'bearer ' + this.token,
      'Content-type': 'application/json'
    },
    body: JSON.stringify(data)
  });
};

Cortex.prototype.cortexDelete = function (uri) {
  return request({
    uri: uri,
    method: 'DELETE',
    headers: {
      Authorization: 'bearer ' + this.token,
      'Content-type': 'application/json'
    },
  });
};

/**
 * [createCortexInstance - Used to return an authenticated cortex instance.]
 * @param  {[String]} username [the username of EPSHOPPER]
 * @param  {[String]} password [the password of EPSHOPPER]
 * @param  {[String]} baseUrl  [the baseUrl of your Cortex instance ex. http://35.163.108.181:8080/cortex]
 * @param  {[String]} scope    [the scope of EPSHOPPER]
 * @return {[Cortex]}          [authenticated cortex instance]
 */
function createCortexInstance(username, password, baseUrl, scope) {
  var cortexInstance = new Cortex(baseUrl, scope);

  return cortexInstance.cortexLogin(username, password)
    .then((loginData) => {
      var data = convertToObj(loginData);
      cortexInstance.token = data.access_token;
      return cortexInstance;
    });
}

function createInstanceWithToken(token, baseUrl, scope) {
  return new Cortex(baseUrl, scope, token);
}

Cortex.prototype.cortexFindLink = function (data, rel) {
  for (var i = 0; i < data.links.length; i++) {
    var link = data.links[i];
    if (link.rel == rel) {
      return link;
    }
  }
};

/**
 * function gets item information
 * @param  {String} sku - the sku code of the item you would like to search
 * @param  {String} zoom - The attribute of the item you would like to zoom to.  EX.  can be 'price' or 'definition' or even 'recommendations:crosssell'
 * @return {null}
 */
Cortex.prototype.cortexGetItem = function (sku, zoom) {
  return this.cortexGet(this.cortexBaseUrl + '/lookups/' + this.scope + '?zoom=itemlookupform')
    .then((getItemData) => {
      var data = convertToObj(getItemData);
      var itemLookupActionUri = this.cortexFindLink(data._itemlookupform[0], 'itemlookupaction').href;
      var postUrl = void 0;
      if (zoom == null) {
        postUrl = itemLookupActionUri + '?followlocation';
      } else {
        postUrl = itemLookupActionUri + '?followlocation&zoom=' + zoom;
      }
      return this.cortexPost(postUrl, {
        code: sku
      })
    });
};

/**
 * Adds the selected sku item to the signed in users cart
 * @param  {String} sku      - sku code of desired item to add to cart
 * @param  {Integer} quantity - the amount that should be added to cart
 * @return {[type]}          null
 */
Cortex.prototype.cortexAddToCart = function (sku, quantity) {
  var getInstanceId = function getInstanceId(uri) {
    var instanceIdTemp = uri.split('/');
    return instanceIdTemp[3].split('=')[0];
  };

  return this.cortexGetItem(sku, 'price,availability')
    .then((itemCallbackData) => {
      var data = convertToObj(itemCallbackData);
      var product = Product.fromCortexJson(data);
      var availability = product.availability;
      var instanceId = getInstanceId(data.self.uri);

      cortexAddToCartHelper(this, instanceId, quantity);
      return availability;
    });
};

// TODO: Does not work with configurable items
/**
 * deletes the current item from cart.
 * @param  {String} sku - sku code of the item in the cart that would like to be deleted
 * @return null
 */
Cortex.prototype.cortexDeleteFromCart = function (sku) {
  return new Promise((resolve, reject) => {
    var url = this.cortexBaseUrl + '/';
    this.cortexGetZoomData(url, '?zoom=defaultcart:lineitems:element,defaultcart:lineitems:element:item:code').then((listOfLineItemsStr) => {
      var listOfLineItems = convertToObj(listOfLineItemsStr);
      let lineItems = [];

      var elements = listOfLineItems._defaultcart[0]._lineitems[0]._element;
      var promises = [];
      elements.forEach((element) => {
        var code = element._item[0]._code[0].code;
        if (code === sku) {
          promises.push(this.cortexDelete(element.self.href).then((data) => {
            resolve(data);
          }).catch((error) => {
            console.log(error);
            reject(error);
          }));
        }
      });
      Promise.all(promises).then((result) => {
        if (result === undefined || result.length === 0) {
          reject("Item not found in cart.");

        } else {
          resolve(result);
        }
      });
    }).catch((error) => {
      console.log(error);
      reject(error);
    });
  });

};

/**
 * Cortex.Items
 *
 */

/**
 * Gets a more detailed results of the item with zoom.
 * TODO: Rename this to something more valuable
 * when called will provide the price of the object... NOTE this function is still WIP.  Should return all properties of product
 * @param  {String} sku            The sku of a particular product
 * @return {Promise} Returns promise, when resolved provides pricing for object
 */
Cortex.prototype.getItemBySku = function (sku) {
  return this.cortexGetItem(sku, 'definition,code,price,definition:components:element,availability')
    .then((itemData) => {
      const newItem = Product.fromCortexJson(itemData);
      return (newItem);
    });
}

/**
 * Will query keyword cortex resource
 * @param  {[String]} keyword        - The keyword to be searched
 * @return {[Promise]} - Returns a promise
 */
Cortex.prototype.getItemsByKeyword = function (keyword) {
  return new Promise((resolve, reject) => {
    const url = this.cortexBaseUrl + '/searches/' + this.scope
      + '/keywords/form?followlocation&zoom='
      + 'element:code,'
      + 'element:definition,'
      + 'element:price,'
      + 'element:availability';
    console.log(url)
    this.cortexPost(url, {keywords: keyword}).then((res) => {
      var data = convertToObj(res);

      var result = [];
      if (data._element && data._element.length > 0) {
        data._element.forEach((itemJson) => {

          try {
            var parsedItem = Product.fromCortexJson(itemJson);
            if (parsedItem.isAvailable()) {
              result.push(parsedItem);
            }
          } catch (err) {
            console.log(err);
          }

        });
        resolve(result);
      } else {
        resolve({});
      }
    }).catch((error) => {
      console.log('CORTEX::ITEMS::getItemsByKeyword()::ERROR::' + error);
      reject(error);
    });
  });

};

/**
 * TODO
 * Will add a particular item to the wishlist based on sku
 * @param {[type]} sku - the Item sku
 */
Cortex.prototype.cortexAddToWishlist = function (sku) {
  return new Promise((resolve, reject) => {
    this.cortexGetItem(sku, 'addtowishlistform').then((data) => {
      data = convertToObj(data);
      if (data.hasOwnProperty('_addtowishlistform')) {
        const wishlistActionLink = data['_addtowishlistform'][0].links[0].href;
        this.cortexPost(wishlistActionLink, {}).then((data) => {
          resolve(data);
        }).catch((error) => {
          reject(error);
        });
      }
    }).catch((error) => {
      console.log(error);
    });

  });
}

Cortex.prototype.cortexAddToCart = function (sku, quantity) {
  return new Promise((resolve, reject) => {
    this.cortexGetItem(sku, 'addtocartform').then((data) => {
      data = convertToObj(data);
      if (data.hasOwnProperty('_addtocartform')) {
        const wishlistActionLink = data['_addtocartform'][0].links[0].href;
        this.cortexPost(wishlistActionLink, {'quantity': quantity}).then((data) => {
          resolve(data);
        }).catch((error) => {
          reject(error);
        });
      }
    }).catch((error) => {
      console.log(error);
    });

  });
}

// TODO: Does not work with configurable items
/**
 * deletes the current item from wishlist.
 * @param  {String} sku - sku code of the item in the wishlist that would like to be deleted
 * @return null
 */
Cortex.prototype.cortexDeleteFromWishlist = function (sku) {
  var url = this.cortexBaseUrl + '/';
  return this.cortexGetZoomData(url, '?zoom=defaultwishlist:lineitems:element,defaultwishlist:lineitems:element:item:code')
    .then((listOfLineItemsStr) => {
      var listOfLineItems = convertToObj(listOfLineItemsStr);
      var elements = listOfLineItems._defaultwishlist[0]._lineitems[0]._element;
      var promises = [];
      elements.forEach((element) => {
        var code = element._item[0]._code[0].code;
        if (code === sku) {
          promises.push(this.cortexDelete(element.self.href));
        }
      });
      return Promise.all(promises)
    })
    .then((result) => {
      if (result === undefined || result.length == 0) {
        return "Item not found in wishlist.";
      } else {
        return result;
      }
    })
};

// TODO: Need to include error handling in this function.
/**
 * Will get the list of wishlist items
 */
Cortex.prototype.getWishlistItems = function () {
  return new Promise((resolve, reject) => {
    this.cortexGetWishlist().then(
      (wishlistZoomData) => {
        const data = convertToObj(wishlistZoomData);
        console.log(data);
        if (!data.hasOwnProperty('_defaultwishlist')) {
          resolve({});
        }

        const lineItems = data['_defaultwishlist'][0]['_lineitems'][0]['_element'];
        var promises = [];
        let wishlistItem = {};

        lineItems.forEach(
          (lineItem) => {
            const links = lineItem.links;
            const selfHref = lineItem.self.href;
            const currentItemUriHash = findInstanceIdFromHref(selfHref);

            links.forEach(
              (link) => {
                if (link.rel == 'item') {
                  promises.push(
                    this.cortexGetZoomData(link.href, '=?zoom=definition,code,price,definition:components:element,availability').then(
                      (data) => {
                        const newItem = Product.fromCortexJson(data);

                        if (wishlistItem[currentItemUriHash] == undefined) {
                          wishlistItem[currentItemUriHash] = {
                            wishlistItem: newItem
                          }
                        } else {
                          wishlistItem[currentItemUriHash].wishlistItem = newItem;
                        }
                      }
                    )
                  );
                }

                if (link.rel == 'movetocartform') {
                  if (wishlistItem[currentItemUriHash] == undefined) {
                    wishlistItem[currentItemUriHash] = {
                      movetocartform: link.href
                    }
                  } else {
                    wishlistItem[currentItemUriHash].movetocartform = link.href;
                  }
                }
              });
          }
        );

        Promise.all(promises).then((results) => {
          resolve(wishlistItem);
        }).catch((err) => {
          reject(err);
        });
      });
  });
}

Cortex.prototype.cortexGetWishlist = function () {
  // TODO: This will get the initial zoom for the wishlist
  var url = this.cortexBaseUrl;
  return this.cortexGetZoomData(url + '/?zoom=', 'defaultwishlist:lineitems:element')
}

/**
 * Cortex.Cart
 *
 */

/**
 * Will get the list of cart items
 */
Cortex.prototype.getCartItems = function () {
  return new Promise((resolve, reject) => {
    this.cortexGetCart().then(
      (cartZoomData) => {
        const data = convertToObj(cartZoomData);
        //console.log(data);
        if (!data.hasOwnProperty('_defaultcart')) {
          resolve({});
        }

        let lineItems = [];

        if (data['_defaultcart'] && data['_defaultcart'][0] && data['_defaultcart'][0]['_lineitems']) {
          lineItems = data['_defaultcart'][0]['_lineitems'][0]['_element'];
        }

        var promises = [];
        let wishlistItem = {};

        lineItems.forEach(
          (lineItem) => {
            const links = lineItem.links;
            const selfHref = lineItem.self.href;
            const currentItemUriHash = findInstanceIdFromHref(selfHref);
            const quantity = lineItem.quantity;
            //console.log('quantity is: '+quantity);

            links.forEach(
              (link) => {
                if (link.rel == 'item') {
                  promises.push(
                    this.cortexGetZoomData(link.href, '=?zoom=definition,code,price,definition:components:element,availability').then(
                      (data) => {
                        var newItem = Product.fromCortexJson(data);

                        if (wishlistItem[currentItemUriHash] == undefined) {
                          wishlistItem[currentItemUriHash] = {
                            wishlistItem: newItem
                          }
                        } else {
                          wishlistItem[currentItemUriHash].wishlistItem = newItem;
                        }

                        //console.log('before:::::');
                        //console.log(newItem);
                        //console.log('after:::::');
                        newItem.quantity = quantity;
                        //console.log(newItem);
                      }
                    )
                  );
                }

                if (link.rel == 'movetocartform') {
                  if (wishlistItem[currentItemUriHash] == undefined) {
                    wishlistItem[currentItemUriHash] = {
                      movetocartform: link.href
                    }
                  } else {
                    wishlistItem[currentItemUriHash].movetocartform = link.href;
                  }
                }
              });
          }
        );

        Promise.all(promises).then((results) => {
          resolve(wishlistItem);
        }).catch((err) => {
          reject(err);
        });
      });
  });
}

Cortex.prototype.cortexGetCart = function () {
  // TODO: This will get the initial zoom for the wishlist
  var url = this.cortexBaseUrl;
  return this.cortexGetZoomData(url + '/?zoom=', 'defaultcart:lineitems:element')
}

Cortex.prototype.cortexShoppingCartQuantity = function () {
  var url = this.cortexBaseUrl + '/?zoom=defaultcart';
  return this.cortexGet(url);
}

Cortex.prototype.cortexCheckout = function () {
  return this.cortexGetPurchaseForm()
    .then((purchaseFormData) => {
      var data = convertToObj(purchaseFormData);
      var purchaseForm = data._defaultcart[0]._order[0]._purchaseform[0];

      if (purchaseForm.messages && purchaseForm.messages.length > 0) {
        for (var i = 0; i < purchaseForm.messages.length; i++) {
          if (purchaseForm.messages[i].type === "needinfo") {
            return Promise.reject(purchaseForm.messages[i]);
          }
        }
      }

      var purchaseFormURI = purchaseForm.links[0].href + '?followlocation';
      return this.cortexPost(purchaseFormURI, {});
    });
};

Cortex.prototype.cortexGetPurchaseForm = function () {
  var zoom = '?zoom=defaultcart:order:purchaseform';
  var url = this.cortexBaseUrl + zoom;
  return this.cortexGet(url);
};

/**
 * fetches any applied discounts on the current cart either through promotions, discounts, or coupons
 * @return {null}
 */
Cortex.prototype.getPromotionDiscountForCart = function () {
  return Promise.all(
    [this.getCartPromotion(),
      this.getCartDiscount(),
      this.getCouponCodeFromOrder()]
  )
    .then(function (results) {
      var promotionDiscount = {
        promotion: results[0],
        discount: results[1],
        couponCode: results[2]
      };
      return promotionDiscount;
    });
}

Cortex.prototype.getCartDiscount = function () {
  var zoomUrl = this.cortexBaseUrl + '/?zoom=';
  var zoom = 'defaultcart:discount';

  return this.cortexGetZoomData(zoomUrl, zoom)
    .then((discountData) => {
      var data = convertToObj(discountData);

      try {
        return data._defaultcart[0]._discount[0].discount[0].display;
      } catch (err) {
        // Swallow promise. Assume there's no discount.
        return '$0.00';
      }
    });
}

Cortex.prototype.getCartPromotion = function () {
  var zoomUrl = this.cortexBaseUrl + '/?zoom=';
  var zoom = 'defaultcart:appliedpromotions:element';

  return this.cortexGetZoomData(zoomUrl, zoom)
    .then((promotionData) => {
      var data = convertToObj(promotionData);
      var nameArray = [];

      try {
        var elements = data._defaultcart[0]._appliedpromotions[0]._element;
        for (var i = 0; i < elements.length; i++) {
          var currentElement = elements[i];
          var name = currentElement.name;
          nameArray.push(name);
        }
      } catch (err) {
        console.log('ERROR in Cortex.prototype.getCartPromotion: Problem parsing promotions from JSON. Assuming none present.');
      }

      return nameArray;
    });
}
/**
 * get public test function
 */
Cortex.prototype.getCouponCodeFromOrder = function () {
  var zoomUrl = this.cortexBaseUrl + '/?zoom=';
  var zoom = 'defaultcart:order:couponinfo:coupon';

  return this.cortexGetZoomData(zoomUrl, zoom)
    .then((discountData) => {
      var data = convertToObj(discountData);
      var response;

      try {
        response = data._defaultcart[0]._order[0]._couponinfo[0]._coupon[0].code;
      } catch (err) {
        response = ' no coupons';
      }

      return response;
    });
}

/**
 * Returns the amount of items within the current users cart
 * @return {null}
 */
Cortex.prototype.getShoppingCartQuantity = function () {
  return this.cortexShoppingCartQuantity()
    .then((shoppingCartData) => {
      var data = convertToObj(shoppingCartData);
      var totalQuantity = data._defaultcart[0]['total-quantity'];
      console.log('totalQuantity: ' + totalQuantity);
      if (!Number.isNaN(totalQuantity)) {
        return totalQuantity;
      } else {
        return Promise.reject(totalQuantity);
      }
    });
}
/**
 * gets the total cost of the current items inside the cart
 * @return {[type]}                  [description]
 */
Cortex.prototype.getShoppingCartTotal = function () {
  return this.cortexShoppingCartLinePrice()
    .then((returnData) => {
      var data = convertToObj(returnData);
      var total = data._defaultcart[0]._total[0].cost[0];
      var display = total.display;
      var returnObj = {
        total: total,
        display: display
      };
      return returnObj;
    });
}

Cortex.prototype.cortexShoppingCartLinePrice = function () {
  console.log(this.cortexBaseUrl);
  var url = this.cortexBaseUrl + '?zoom=defaultcart:total';
  return this.cortexGet(url);
};

Cortex.prototype.cortexGetPurchases = function () {
  const url = this.cortexBaseUrl + '?zoom=defaultprofile:purchases:element';
  return this.cortexGet(url);
};

Cortex.prototype.cortexGetOrder = function (scope, orderToFetch) {
  const url = this.cortexBaseUrl + '/purchases/' + scope + '/lookups/form?followlocation&zoom=lineitems:element:item,lineitems:element:item:code,lineitems:element:item:price,lineitems:element,lineitems:element:item:definition';

  return this.cortexPost(url, {'purchase-number': orderToFetch});
}
/**
 * In Cart
 */
Cortex.prototype.cortexGetZoomData = function (url, zoom) {
  var queryUrl = url + zoom;
  queryUrl = queryUrl.replace('==', '=');
  return this.cortexGet(queryUrl);
};

function cortexAddToCartHelper(cortex, itemCode, quantity) {
  var addToCartUrl = cortex.cortexBaseUrl + '/carts/items/' + cortex.scope + '/' + itemCode + '=/form';
  var dataPayload = {quantity: quantity};
  cortex.cortexPost(addToCartUrl, dataPayload).then((data) => {
  }).catch((error) => {
    console.log(error)
  });
};

// This should just be a static function that is exported.
function convertToObj(data) {
  if (typeof data === 'string') {
    return JSON.parse(data);
  }
  return data;
};

/**
 * Helpers for getWishlistItems
 *
 */


function findInstanceIdFromHref(href) {
  const splitHref = href.split("/");
  lastElement = splitHref[splitHref.length - 1];
  lastElement = lastElement.replace(/=([^;]*)/g, '');
  return lastElement;
}

module.exports.Cortex = Cortex;
module.exports.createCortexInstance = createCortexInstance;
module.exports.createInstanceWithToken = createInstanceWithToken;
