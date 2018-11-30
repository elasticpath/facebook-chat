/*
 * 2018. Copyright Elastic Path Sofware Inc.
 * Author: Andrés Fajardo
 * Version: 0.02
 * Status: Pre-release. Requires refactoring for production
 * Improvments:
 *   Remove hardcoded values (e.g. Emma's address and name in order and welcome message)
 *   Enable Search Products
 *   Add items from wishlist to cart and enable checkout
 *   Open Recommended Product based on Cart/Wishlist
 */

/***********************/
/* INTRO. GENERAL INFO */
/***********************/

//messageIDs:
//1: Welcome Message
//2: Shopping Cart Message
//3: Checkout Prompt Message
//4: Next Action Prompt Message
//5: Didn't checkout. Moved items to the cart
//6: Wish List Message
//7: Main Menu

/*************************/
/* PART 1. INITIAL SETUP */
/*************************/

const VERIFY_TOKEN = '<Randomly_Generated_Token_To_Provide_To_Facebook>';
const PAGE_ACCESS_TOKEN = '<Token_Provided_By_Facebook>';

const PORT = 3000;
const EP_USER = 'myuser@email.com';
const EP_PASSWORD = 'password';
const EP_SERVER = 'http://<Customer>.epdemos.com/cortex';
const EP_SCOPE = '<Customer_Store>';
const EP_IMAGES = 'https://s3-us-west-2.amazonaws.com/ep-demo-images/<Customer>/';

let Cortex = require("./cortex");
let urlExists = require('url-exists');
let orderArray = [];

const NO_MENU = -1;
const WELCOME_MENU = 1;
const CHECKOUT_MENU = 2;
const MAIN_MENU = 4;
const CHECKOUT_YES = 'yes';
const CHECKOUT_NO = 'no';
const SEE_PAST_ORDERS = 'see_past_orders';
const WISHLIST_MENU = 'wishlist';

const ORDER_PREFIX = 'order:';
const MOVE_WISHLIST_PREFIX = 'move_wishlist:';
const ADD_TO_CART_PREFIX = 'add_cart:';
const REMOVE_FROM_CART_PREFIX = 'remove_cart:';
const REMOVE_FROM_WISHLIST_PREFIX = 'remove_wishlist:';

const
  request = require('request'),
  express = require('express'),
  body_parser = require('body-parser'),
  app = express().use(body_parser.json()); // creates express http server

// Sets server port and logs message on success
app.listen(PORT || 3000, () => console.log('EP-CHATBOT. Webhook is listening'));

// Accepts GET requests at the /webhook endpoint
app.get('/webhook', (req, res) => {
  // Update Verify Token

  // Parse params from the webhook verification request
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  // Check if a token and mode were sent
  if (mode && token) {
    // Check the mode and token sent are correct
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      // Respond with 200 OK and challenge token from the request
      console.log('EP-CHATBOT. Webhook verified');
      res.status(200).send(challenge);
    } else {
      // Responds with '403 Forbidden' if verify tokens do not match
      res.status(403);
    }
  }
});

/*****************************************/
/* PART 2. RECEIVE POST AND GET REQUESTS */
/*****************************************/

// Accept POST requests at /webhook endpoint
app.post('/webhook', (req, res) => {
  // Parse the request body from the POST
  const body = req.body;
  // Check the webhook event is from a Page subscription
  if (body.object === 'page') {
    // Iterate over each entry - there may be multiple if batched
    body.entry.forEach(function (entry) {
      // Gets the body of the webhook event
      const webhook_event = entry.messaging[0];
      // Get the sender PSID.
      // TODO: Use info from PSID to support authentication with Elastic Path and welcome user by name
      const sender_psid = webhook_event.sender.id;
      // Pass the event to the appropriate handler function: Message Handler or Postback Handler
      if (webhook_event.message) {
        handleMessage(sender_psid, webhook_event.message);
      } else if (webhook_event.postback) {
        handlePostback(sender_psid, webhook_event.postback);
      }
    });
    // Return a '200 OK' response to all events
    res.status(200).send('EP-CHATBOT. Event received');
  } else {
    // Return a '404 Not Found' if event is not from a page subscription
    res.status(404);
  }

});

/*******************************************/
/* PART 3. MESSAGE HANDLERS AND DELEGATORS */
/*******************************************/

// Handle initial message events
function handleMessage(sender_psid, received_message) {
  getCortexInstance(sender_psid, 1);
}

// Handle postback events
function handlePostback(sender_psid, received_postback) {
  console.log('EP-CHATBOT. Facebook postback event received');

  if (typeof global.cortexInstance !== 'undefined' && global.cortexInstance) {

    console.log('EP-CHATBOT. Cortex Client instance exists');

    parseMessageFromUser(sender_psid, received_postback.payload);
  } else {

    console.log('EP-CHATBOT. Cortex Client instance does not exist, requesting it');

    getCortexInstance(sender_psid, received_postback.payload);
  }
}

// Get a new Cortex Instance and calls the next meessage
function getCortexInstance(sender_psid, option) {
  Cortex.createCortexInstance(EP_USER, EP_PASSWORD, EP_SERVER, EP_SCOPE).then((cortex) => {

    global.cortexInstance = cortex;

    console.log('EP-CHATBOT. Cortex Client instance created successfuly');

    parseMessageFromUser(sender_psid, option)
  }).catch((err) => console.log(err))
}

// Delegate each input request to required function
function parseMessageFromUser(sender_psid, messageID) {

  switch (messageID) {
    case WELCOME_MENU:
      console.log('EP-CHATBOT. Requesting welcome message');

      global.cortexInstance.getCartItems().then((itemsInCart) => {
        requestWelcomeMessage(sender_psid, itemsInCart)
      }).catch((err) => console.log(err))

      break;

    case WISHLIST_MENU:
      console.log('EP-CHATBOT. Requesting wishlist');

      global.cortexInstance.getWishlistItems().then((wishlistResponse) => {
        requestGetWishList(sender_psid, wishlistResponse)
      }).catch((err) => console.log(err));

      break;

    case CHECKOUT_YES:
      console.log('EP-CHATBOT. Requesting checkout');

      global.cortexInstance.cortexCheckout().then((checkoutResponse) => {
        requestCheckout(sender_psid, checkoutResponse)
      }).catch((err) => console.log(err))

      break;

    case CHECKOUT_NO:
      console.log('EP-CHATBOT. Refusing checkout');

      requestMoveToWishlist(sender_psid);

      break;

    case SEE_PAST_ORDERS:

      console.log('EP-CHATBOT. Requesting past orders');

      requestShowPastOrders(sender_psid).then(data => {
        const jsonData = JSON.parse(data);
        const purchases = jsonData['_defaultprofile'][0]['_purchases'][0]['_element'];
        const orders = [];

        for (let i = 0; i < purchases.length; i++) {
          orders.push(purchases[i]['purchase-number']);
        }
        requestOrdersMessage(sender_psid, orders);
      }).catch(err => {
        console.log(err);
      });

      break;
    default:

      if (messageID.startsWith(ORDER_PREFIX)) {

        const orderToFetch = messageID.replace(ORDER_PREFIX, '');

        console.log('EP-CHATBOT. Requesting order #' + orderToFetch);

        requestFetchOrder(sender_psid, orderToFetch).then((response) => {
          const orderResult = JSON.parse(response);

          requestOrderMessage(sender_psid, orderResult);
        }).catch((err) => console.log(err))

      } else if (messageID.startsWith(MOVE_WISHLIST_PREFIX)) {

        const objectToMove = messageID.replace(MOVE_WISHLIST_PREFIX, '');

        console.log('EP-CHATBOT. Requesting move ' + objectToMove + ' to wish list');

        global.cortexInstance.cortexAddToWishlist(objectToMove).then((response) => {
          global.cortexInstance.cortexDeleteFromCart(objectToMove).then((response) => {
            setTimeout(function () {
              sendMessageToUser(sender_psid, getMainMenuTemplate("The item has been moved to your wishlist and removed from your cart. What else can I do for you?"), NO_MENU)
            }, 1500);
          }).catch((err) => console.log(err));
        }).catch((err) => console.log(err));
      } else if (messageID.startsWith(REMOVE_FROM_CART_PREFIX)) {

        const objectToRemove = messageID.replace(REMOVE_FROM_CART_PREFIX, '');

        console.log('EP-CHATBOT. Requesting remove ' + objectToRemove + ' from cart');

        global.cortexInstance.cortexDeleteFromCart(objectToRemove).then((response) => {
          setTimeout(function () {
            sendMessageToUser(sender_psid, getMainMenuTemplate("The item has been removed from your cart. What else can I do for you?"), NO_MENU)
          }, 1500);
        }).catch((err) => console.log(err));
      } else if (messageID.startsWith(ADD_TO_CART_PREFIX)) {

        const objectToAddToCart = messageID.replace(ADD_TO_CART_PREFIX, '');

        console.log('EP-CHATBOT. Requesting add ' + objectToAddToCart + ' to cart');

        global.cortexInstance.cortexAddToCart(objectToAddToCart, 1).then((response) => {
          sendMessageToUser(sender_psid, getMainMenuTemplate('The item has been added to your cart'), NO_MENU);
        }).catch((err) => console.error(err));
      }
  }
}

// Sends current message to user based on messageID and requests next message if necessary
// TODO: Improve this delegation to have a unique messageID flow based on configuration
function sendMessageToUser(sender_psid, response, messageID) {
  // Construct the message body
  const request_body = {
    "recipient": {
      "id": sender_psid
    },
    "message": response
  };

  // Send the HTTP request to the Messenger Platform
  request({
    uri: "https://graph.facebook.com/v2.6/me/messages",
    qs: {"access_token": PAGE_ACCESS_TOKEN},
    method: "POST",
    json: request_body
  }, (err, res, body) => {
    if (!err) {
      // If there are items in the cart, prompts to checkout after a few seconds.
      if (messageID === CHECKOUT_MENU) {
        sendTypingMessage(sender_psid, '', NO_MENU);
        setTimeout(function () {
          sendMessageToUser(sender_psid, getCheckoutTemplate(), NO_MENU)
        }, 1500);
      }
      // After finishing a transaction, displays main menu again.
      if (messageID === MAIN_MENU) {
        sendTypingMessage(sender_psid, '', NO_MENU);
        setTimeout(function () {
          sendMessageToUser(sender_psid, getMainMenuTemplate("What else I can do for you?"), NO_MENU)
        }, 1500);
      }
      console.log('EP-CHATBOT. Message sent to Facebook API');
    } else {
      console.error("EP-CHATBOT. Unable to send message to Facebook API" + err);
    }
  });
}

// Send typing message to the user
// TODO: Can be merged with sendMessageToUser
function sendTypingMessage(sender_psid, response, messageID) {
  // Construct the message body
  const request_body = {
    "recipient": {
      "id": sender_psid
    },
    "sender_action": "typing_on"
  };

  // Send the HTTP request to the Messenger Platform
  request({
    uri: "https://graph.facebook.com/v2.6/me/messages",
    qs: {"access_token": PAGE_ACCESS_TOKEN},
    method: "POST",
    json: request_body
  }, (err, res, body) => {
    if (!err) {
      console.log('EP-CHATBOT. Typing effect requested to Facebook API')
    } else {
      console.error("EP-CHATBOT. Unable to send message to Facebook API" + err);
    }
  });
}

/******************************/
/* PART 4. COMMERCE FUNCTIONS */
/******************************/

// Get items in cart and trigger the required functions for none or multiple items, respectively
function requestWelcomeMessage(sender_psid, itemsInCart) {

  const itemsInCartInt = getTotalItemsInCart(itemsInCart);
  // Sends Initial Welcome Message along with the message ID
  sendMessageToUser(sender_psid, getMessageWelcome(itemsInCartInt), WELCOME_MENU);

  // If there's at least 1 item in the cart sends message with shopping cart items
  if (itemsInCartInt > 0) {
    sendMessageShoppingCart(itemsInCart, sender_psid);
  } else {
    setTimeout(function () {
      sendMessageToUser(sender_psid, getOrderStatusTemplate(), NO_MENU)
    }, 1500);
  }
}

function requestOrdersMessage(sender_psid, orders) {
  console.log('EP-CHATBOT: Requested to send all orders');
  sendMessageToUser(sender_psid, getAllOrdersTemplate(orders), NO_MENU);
}

function requestOrderMessage(sender_psid, orderToFetch) {
  console.log('EP-CHATBOT: Requested to fetch order #' + orderToFetch['purchase-number']);
  setTimeout(function () {
    sendMessageToUser(sender_psid, getPastOrderTemplate(orderToFetch), MAIN_MENU)
  }, 1500);
}

function getPastOrderTemplate(checkoutJSON) {

  const orderTotal = (checkoutJSON['monetary-total'][0].amount);
  const orderTax = checkoutJSON['tax-total'].amount;
  const orderShipping = 18.8;
  const orderSubtotal = orderTotal - orderTax - orderShipping;
  const orderNumber = checkoutJSON['purchase-number'];
  const orderDate = checkoutJSON['purchase-date'].value / 1000;
  let orderStatus = checkoutJSON.status;
  const orderElements = checkoutJSON['_lineitems'][0]['_element'];
  const response = {};

  switch (orderStatus) {
    case 'FAILED':
      orderStatus = 'Aborted';
      break;
    case 'ORDER_CREATED':
      orderStatus = 'Order created';
      break;
    case 'IN_PROGRESS':
      orderStatus = 'In progress';
      break;
    case 'COMPLETED':
      orderStatus = 'Completed';
      break;
    case 'PARTIALLY_SHIPPED':
      orderStatus = 'Shipped';
      break;
    case 'ONHOLD':
      orderStatus = 'On hold';
      break;
    case 'CANCELLED':
      orderStatus = 'Cancelled';
      break;
    case 'AWAITING_EXCHANGE':
      orderStatus = 'Waiting for exchange';
      break;
  }

  response.attachment = {};
  response.attachment.payload = {};
  response.attachment.payload.address = {};
  response.attachment.payload.summary = {};
  response.attachment.payload.adjustments = [];
  response.attachment.payload.elements = [];

  response.attachment.type = 'template';

  response.attachment.payload['template_type'] = 'receipt';
  response.attachment.payload['recipient_name'] = 'Emma Faust';
  response.attachment.payload['order_number'] = '#' + orderNumber + ' - status: ' + orderStatus;
  response.attachment.payload.currency = 'USD';
  response.attachment.payload.timestamp = orderDate;
  response.attachment.payload['payment_method'] = 'Visa 9076';
  response.attachment.payload['order_url'] = 'http://petersapparel.parseapp.com/order?order_id=123456';

  response.attachment.payload.address['street_1'] = '5th Avenue';
  response.attachment.payload.address['street_2'] = '';
  response.attachment.payload.address.city = 'New York';
  response.attachment.payload.address['postal_code'] = '10203';
  response.attachment.payload.address.state = 'NY';
  response.attachment.payload.address.country = 'US';

  response.attachment.payload.summary.subtotal = orderSubtotal;
  response.attachment.payload.summary['shipping_cost'] = orderShipping;
  response.attachment.payload.summary['total_tax'] = orderTax;
  response.attachment.payload.summary['total_cost'] = orderTotal;

  for (let i = 0; i < orderElements.length; i++) {
    const element = {};

    element.title = orderElements[i]['_item'][0]['_definition'][0]['display-name'];
    element.price = orderElements[i]['_item'][0]['_price'][0]['purchase-price'][0].amount;
    element['image_url'] = EP_IMAGES + orderElements[i]['_item'][0]['_code'][0].code + ".png";
    element.currency = orderElements[i]['_item'][0]['_price'][0]['purchase-price'][0].currency;
    element.quantity = checkoutJSON['_lineitems'][0]['_element'][i].quantity;

    response.attachment.payload.elements.push(element);
  }

  return response;
}

// Returns the number of items in the Shopping Cart
function getTotalItemsInCart(itemsInCart) {
  let items = 0;
  const keys = Object.keys(itemsInCart);

  for (let i = 0; i < keys.length; i++) {
    items = items + parseInt(itemsInCart[keys[i]].wishlistItem.quantity);
  }

  return items;
}

// Get items from the wishlist
// TODO Detach  message text from logic. Ideal to move messages to templates
function requestGetWishList(sender_psid, itemsInWishlist) {
  // Generate list of products
  if (Object.keys(itemsInWishlist).length > 0) {
    const response = {};
    sendMessageToUser(sender_psid, {'text': 'Here is your wishlist:'}, NO_MENU);
    sendMessageWishlist(itemsInWishlist, sender_psid);
  } else {
    // Send message with no items in the wishlist
    sendMessageToUser(sender_psid, getMainMenuTemplate("Your wishlist is empty. What else I can do for you?"), NO_MENU);
  }
}

// Checkout in Elastic Path
// TODO Detach  message text from logic. Ideal to move messages to templates
function requestCheckout(sender_psid, checkoutResponse) {

  console.log('EP-CHATBOT. Sending checkout request to Cortex');

  checkoutResponse = JSON.parse(checkoutResponse);

  const orderTotal = (checkoutResponse['monetary-total'][0].display);
  const orderNumber = checkoutResponse['purchase-number'];

  const response = {};

  response.text = 'Great, I placed the order! The order number is ' + orderNumber + ', and the order total is ' + orderTotal + '. Details below:';

  // Sends confirmation message to the user. Waits a few seconds to send a new message
  // TODO: Add messageID to this message
  sendMessageToUser(sender_psid, response);
  const orderJSON = getOrderTemplate(checkoutResponse);
  orderArray = [];
  setTimeout(function () {
    sendMessageToUser(sender_psid, orderJSON, MAIN_MENU)
  }, 1500);
}

// If the user don't want to checkout, moves items to the wishlist
function requestMoveToWishlist(sender_psid) {
  console.log("EP-CHATBOT. Moving all items in cart to wishlist");

  const promises = [];
  const promisesDelete = [];

  for (let i = 0; i < orderArray.length; i++) {

    const currentSKU = orderArray[i][0];

    console.log("EP-CHATBOT. Current item moved to the wishlist: ", currentSKU);

    promises.push(global.cortexInstance.cortexAddToWishlist(currentSKU));
    promisesDelete.push(global.cortexInstance.cortexDeleteFromCart(currentSKU));
  }
  orderArray = [];
  Promise.all(promises, promisesDelete).then((response) => {
    // Send confirmation message
    sendMessageToUser(sender_psid, getMainMenuTemplate("That's fine! I moved all items in the shopping bag to your wishlist. What else I can do for you?"), NO_MENU);
  });
}

function requestShowPastOrders(sender_psid) {
  console.log('EP-CHATBOT. Fetching all past orders');

  return global.cortexInstance.cortexGetPurchases();
}

function requestFetchOrder(sender_psid, orderToFetch) {
  console.log('EP-CHATBOT. Fetching order #' + orderToFetch);

  return global.cortexInstance.cortexGetOrder(EP_SCOPE, orderToFetch);
}

// Get image URL based on product code and validate that exists
function getImageURL(productCode) {
  let imageURL = EP_IMAGES + productCode + ".png";

  return new Promise(resolve => {
    urlExists(imageURL, function (err, exists) {
      if (exists) {
        resolve(imageURL);
      } else {
        const index = productCode.indexOf("_");
        if (index > 0) {
          productCode = productCode.substring(0, index);
          imageURL = EP_IMAGES + productCode + ".png";
          resolve(imageURL);
        }
      }
    });
  });
}

/*****************************/
/* PART 5. MESSAGE FUNCTIONS */
/*****************************/

// Generates the right welcome message depending on the number of items in the cart
// TODO: Don't hardcode Emma's name
function getMessageWelcome(itemsInCartInt) {
  let response = getMainMenuTemplate("Welcome back Emma! You don't have items in your shopping bag. How can I help you today?");
  if (!isNaN(itemsInCartInt)) {
    if (itemsInCartInt === 1) {
      response = {"text": 'Welcome back Emma! I found the following item in your shopping bag'};
    } else if (itemsInCartInt === 0) {
      response = {"text": 'Welcome Emma! Your shopping bag is empty'}
    } else {
      response = {"text": 'Welcome back Emma! I found the following items in your shopping bag'};
    }
  }
  return response;
}

// Gets items in shopping cart and parses response
// TODO Detach  message text from logic. Ideal to move messages to templates
function sendMessageShoppingCart(itemsInCart, sender_psid) {
  const promises = [];

  const keys = Object.keys(itemsInCart);

  for (let i = 0; i < keys.length; i++) {
    promises.push(getImageURL(itemsInCart[keys[i]].wishlistItem.code));
  }

  Promise.all(promises).then((productImages) => {

    const response = {};

    response.attachment = {};
    response.attachment.payload = {};
    response.attachment.payload.elements = [];
    response.attachment.type = 'template';
    response.attachment.payload['template_type'] = 'generic';

    orderArray = [];

    for (let i = 0; i < keys.length; i++) {

      const productsArray = [];
      const productCode = itemsInCart[keys[i]].wishlistItem.code;
      const productName = itemsInCart[keys[i]].wishlistItem.definition.displayName;
      const productQuantity = itemsInCart[keys[i]].wishlistItem.quantity;
      const productPrice = itemsInCart[keys[i]].wishlistItem.price.purchasePrice[0].display;
      const productPriceAmount = itemsInCart[keys[i]].wishlistItem.price.purchasePrice[0].amount;

      productsArray.push(productCode, productName, productQuantity, productPriceAmount, productImages[i]);
      orderArray.push(productsArray);

      let product = {};

      product.title = productName;
      product.subtitle = 'Price: ' + productPrice + ' - Quantity: ' + productQuantity;
      product['image_url'] = productImages[i];

      const buttons = [];

      const removeButton = {};
      const moveToWishlistButton = {};

      removeButton.type = 'postback';
      removeButton.title = 'Remove';
      removeButton.payload = REMOVE_FROM_CART_PREFIX + productCode;

      moveToWishlistButton.type = 'postback';
      moveToWishlistButton.title = 'Move to wishlist';
      moveToWishlistButton.payload = MOVE_WISHLIST_PREFIX + productCode;

      buttons.push(removeButton);
      buttons.push(moveToWishlistButton);

      product.buttons = buttons;

      response.attachment.payload.elements.push(product);
    }

    // Sends Shopping Cart Information to the User
    sendMessageToUser(sender_psid, response, CHECKOUT_MENU);
  }).catch((err) => console.log(err));
}

function sendMessageWishlist(itemsInWishlist, sender_psid) {
  const promises = [];

  const keys = Object.keys(itemsInWishlist);

  for (let i = 0; i < keys.length; i++) {
    promises.push(getImageURL(itemsInWishlist[keys[i]].wishlistItem.code));
  }

  Promise.all(promises).then((productImages) => {

    const response = {};

    response.attachment = {};
    response.attachment.payload = {};
    response.attachment.payload.elements = [];
    response.attachment.type = 'template';
    response.attachment.payload['template_type'] = 'generic';

    orderArray = [];

    for (let i = 0; i < keys.length; i++) {

      const productsArray = [];
      const productCode = itemsInWishlist[keys[i]].wishlistItem.code;
      const productName = itemsInWishlist[keys[i]].wishlistItem.definition.displayName;
      const productPrice = itemsInWishlist[keys[i]].wishlistItem.price.purchasePrice[0].display;
      const productPriceAmount = itemsInWishlist[keys[i]].wishlistItem.price.purchasePrice[0].amount;

      productsArray.push(productCode, productName, productPriceAmount, productImages[i]);
      orderArray.push(productsArray);

      let product = {};

      product.title = productName;
      product.subtitle = 'Price: ' + productPrice;
      product['image_url'] = productImages[i];

      const buttons = [];

      const removeButton = {};
      const moveToWishlistButton = {};

      removeButton.type = 'postback';
      removeButton.title = 'Remove';
      removeButton.payload = REMOVE_FROM_WISHLIST_PREFIX + productCode;

      moveToWishlistButton.type = 'postback';
      moveToWishlistButton.title = 'Add to cart';
      moveToWishlistButton.payload = ADD_TO_CART_PREFIX + productCode;

      buttons.push(removeButton);
      buttons.push(moveToWishlistButton);

      product.buttons = buttons;

      response.attachment.payload.elements.push(product);
    }

    // Sends Shopping Cart Information to the User
    sendMessageToUser(sender_psid, response, NO_MENU);
  }).catch((err) => console.log(err));
}

/*****************************/
/* PART 6. MESSAGE TEMPLATES */

/*****************************/

function getLoginTemplate() {
  return {
    "attachment": {
      "type": "template",
      "payload": {
        "template_type": "button",
        "text": "Try the log in button!",
        "buttons": [
          {
            "type": "account_link",
            "url": "http://fb-vestri-spa.epdemos.com/cortex/oauth2/tokens"
          }
        ]
      }
    }
  };
}

function getMainMenuTemplate(introText) {
  return {
    "attachment": {
      "type": "template",
      "payload": {
        "template_type": "button",
        "text": introText,
        "buttons": [
          {
            "type": "web_url",
            "url": "https://preview-ep.livecontext.coremedia.com/blueprint/servlet/calista",
            "title": "Find Products",
          },
          {
            "type": "web_url",
            //"url": "https://preview-ep.livecontext.coremedia.com/blueprint/servlet/category/calista/skxvgskhjzavivksl5lu6tkfjzj3ou2ji5hecvcvkjpvot2nivhfgx2ekjcvgu2fkm%253D",
            "url": "https://preview-ep.livecontext.coremedia.com/blueprint/servlet/product/calista/skxvgskhjzavivksl5lu6tkfjzj3ou2ji5hecvcvkjpvot2nivhfgx2ekjcvgu2fkm%253D/qgqvhkrxhe4tambrgfpvgti=",
            "title": "Recommended for You",
          },
          {
            "type": "postback",
            "title": "Check My Wishlist",
            "payload": "wishlist",
          }
        ]
      }
    }
  };
}

function getSingleOrderStatusTemplate(order) {
  return {'text': 'Your order #' + order.number + ' of a total of ' + order.total + ' from ' + order.date + ' is ' + order.status + '!'};
}

// Generates Order Template
// TODO: Don't hard code name and address
function getOrderTemplate(checkoutJSON) {

  const orderTotal = (checkoutJSON['monetary-total'][0].amount);
  const orderTax = checkoutJSON['tax-total'].amount;
  const orderShipping = 18.8;
  const orderSubtotal = orderTotal - orderTax - orderShipping;
  const orderNumber = checkoutJSON['purchase-number'];
  const orderDate = Math.floor(new Date() / 1000);
  let orderStatus = checkoutJSON.status;

  switch (orderStatus) {
    case 'FAILED':
      orderStatus = 'Aborted';
      break;
    case 'ORDER_CREATED':
      orderStatus = 'Order created';
      break;
    case 'IN_PROGRESS':
      orderStatus = 'In progress';
      break;
    case 'COMPLETED':
      orderStatus = 'Completed';
      break;
    case 'PARTIALLY_SHIPPED':
      orderStatus = 'Shipped';
      break;
    case 'ONHOLD':
      orderStatus = 'On hold';
      break;
    case 'CANCELLED':
      orderStatus = 'Cancelled';
      break;
    case 'AWAITING_EXCHANGE':
      orderStatus = 'Waiting for exchange';
      break;
  }

  const response = {};

  response.attachment = {};
  response.attachment.payload = {};
  response.attachment.payload.address = {};
  response.attachment.payload.summary = {};
  response.attachment.payload.adjustments = [];
  response.attachment.payload.elements = [];

  response.attachment.type = 'template';

  response.attachment.payload['template_type'] = 'receipt';
  response.attachment.payload['recipient_name'] = 'Emma Faust';
  response.attachment.payload['order_number'] = '#' + orderNumber + ' - status: ' + orderStatus;
  response.attachment.payload.currency = 'USD';
  response.attachment.payload.timestamp = orderDate;
  response.attachment.payload['payment_method'] = 'Visa 9076';
  response.attachment.payload['order_url'] = 'http://petersapparel.parseapp.com/order?order_id=123456';

  response.attachment.payload.address['street_1'] = '5th Avenue';
  response.attachment.payload.address['street_2'] = '';
  response.attachment.payload.address.city = 'New York';
  response.attachment.payload.address['postal_code'] = '10203';
  response.attachment.payload.address.state = 'NY';
  response.attachment.payload.address.country = 'US';

  response.attachment.payload.summary.subtotal = orderSubtotal;
  response.attachment.payload.summary['shipping_cost'] = orderShipping;
  response.attachment.payload.summary['total_tax'] = orderTax;
  response.attachment.payload.summary['total_cost'] = orderTotal;

  for (let i = 0; i < orderArray.length; i++) {

    const element = {};

    element.title = orderArray[i][1];
    element.quantity = orderArray[i][2];
    element.price = orderArray[i][3];
    element.currency = 'USD';
    element['image_url'] = orderArray[i][4];

    response.attachment.payload.elements.push(element);
  }

  return response;
}

//Returns checkout template
function getCheckoutTemplate(checkoutResponse) {
  return {
    "attachment": {
      "type": "template",
      "payload": {
        "template_type": "button",
        "text": "Do you want to check out?",
        "buttons": [
          {
            "type": "postback",
            "title": "Yes!",
            "payload": CHECKOUT_YES
          },
          {
            "type": "postback",
            "title": "Not sure 😳",
            "payload": CHECKOUT_NO
          },
          {
            'type': 'postback',
            'title': 'See my past orders',
            'payload': SEE_PAST_ORDERS
          }
        ]
      }
    }
  };
}

function getOrderStatusTemplate() {
  let result = {
    'attachment': {
      'type': 'template',
      'payload': {
        'template_type': 'button',
        'text': 'See my past orders',
        'buttons': [
          {
            'type': 'postback',
            'title': 'See my past orders',
            'payload': SEE_PAST_ORDERS
          }
        ]
      }
    }
  };

  return result;
}

function getAllOrdersTemplate(orders) {
  let buttons = [];

  if (orders.length > 3) {
    orders.length = 3;
  }
  // Facebook limits to 3 the number of buttons you can send in each template.
  for (let i = 0; i < orders.length; i++) {
    const button = {
      'type': 'postback',
      'title': '#' + orders[i],
      'payload': ORDER_PREFIX + orders[i]
    };

    buttons.push(button);
  }

  let result = {
    'attachment': {
      'type': 'template',
      'payload': {
        'template_type': 'button',
        'text': 'Orders: ',
        'buttons': buttons
      }
    }
  };

  return result;
}
