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
  if (messageID === 1) {
    console.log('EP-CHATBOT. Requesting welcome message');

    global.cortexInstance.getCartItems().then((itemsInCart) => {
      requestWelcomeMessage(sender_psid, itemsInCart)
    }).catch((err) => console.log(err))

  } else if (messageID === 'wishlist') {
    console.log('EP-CHATBOT. Requesting wishlist');

    global.cortexInstance.getWishlistItems().then((wishlistResponse) => {
      requestGetWishList(sender_psid, wishlistResponse)
    }).catch((err) => console.log(err));

  } else if (messageID === 'yes') {
    console.log('EP-CHATBOT. Requesting checkout');

    global.cortexInstance.cortexCheckout().then((checkoutResponse) => {
      requestCheckout(sender_psid, checkoutResponse)
    }).catch((err) => console.log(err))

  } else if (messageID === 'no') {
    requestMoveToWishlist(sender_psid);
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
      console.log('EP-CHATBOT. Message sent to Facebook API');
      // If there are items in the cart, prompts to checkout after a few seconds.
      if (messageID === 2) {
        sendTypingMessage(sender_psid, '', 0);
        setTimeout(function () {
          sendMessageToUser(sender_psid, getCheckoutTemplate(), 3)
        }, 3500);
      }
      // After finishing a transaction, displays main menu again.
      if (messageID === 4) {
        setTimeout(function () {
          sendMessageToUser(sender_psid, getMainMenuTemplate("What else I can do for you?"), 7)
        }, 3500);
      }
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
  sendMessageToUser(sender_psid, getMessageWelcome(itemsInCartInt), 1);
  // If there's at least 1 item in the cart sends message with shopping cart items
  if (itemsInCartInt > 0) {
    sendMessageShoppingCart(itemsInCart, sender_psid);
  }
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
  const wishListArray = [];
  const keys = Object.keys(itemsInWishlist);

  // Get and parse all items in the wishlist
  for (let i = 0; i < keys.length; i++) {
    const productsArray = [];
    const productCode = itemsInWishlist[keys[i]].wishlistItem.code;
    const productName = itemsInWishlist[keys[i]].wishlistItem.definition.displayName;
    const productPriceAmount = itemsInWishlist[keys[i]].wishlistItem.price.purchasePrice[0].amount;

    productsArray.push(productCode, productName, productPriceAmount);
    wishListArray.push(productsArray);
  }
  // Generate list of products
  if (wishListArray.length > 0) {
    let products = "";
    for (let i = 0; i < wishListArray.length; i++) {
      if (i > 0) {
        products = products + "\n - ";
      }
      products = products + wishListArray[i][1];
    }
    // Send message with items in the wishlist
    sendMessageToUser(sender_psid, getMainMenuTemplate("The following items are in your wishlist: \n - " + products + "\n\n What else I can do for you?"), 6);
  } else {
    // Send message with no items in the wishlist
    sendMessageToUser(sender_psid, getMainMenuTemplate("Your wishlist is empty. What else I can do for you?"), 6);
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
  console.log('orderJSON = ' + orderJSON);
  orderArray = [];
  setTimeout(function () {
    sendMessageToUser(sender_psid, orderJSON, 4)
  }, 3500);
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
    sendMessageToUser(sender_psid, getMainMenuTemplate("That's fine! I moved all items in the shopping bag to your wishlist. What else I can do for you?"), 5);
  });
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
      response = {"text": `Welcome back Emma! I found the following item in your shopping bag`};
    } else if (itemsInCartInt === 0) {
      response = {"text": `Welcome Emma! Your shopping bag is empty`}
    } else {
      response = {"text": `Welcome back Emma! I found the following items in your shopping bag`};
    }
  }
  return response;
}

// Gets items in shopping cart and parses response
// TODO Detach  message text from logic. Ideal to move messages to templates
function sendMessageShoppingCart(itemsInCart, sender_psid) {
  console.log("EP-CHATBOT. Items in shopping cart", itemsInCart);

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

      response.attachment.payload.elements.push(product);
    }

    // Sends Shopping Cart Information to the User
    sendMessageToUser(sender_psid, response, 2);
  });
}

/*****************************/
/* PART 6. MESSAGE TEMPLATES */

/*****************************/

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

// Generates Order Template
// TODO: Don't hard code name and address
function getOrderTemplate(checkoutJSON) {

  const orderTotal = (checkoutJSON['monetary-total'][0].amount);
  const orderTax = checkoutJSON['tax-total'].amount;
  const orderShipping = 18.8;
  const orderSubtotal = orderTotal - orderTax - orderShipping;
  const orderNumber = checkoutJSON['purchase-number'];
  const orderDate = Math.floor(new Date() / 1000);

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
  response.attachment.payload['order_number'] = orderNumber;
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

  console.log('EP-CHATBOT. Parsed response: ', JSON.stringify(response));

  return JSON.stringify(response);
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
            "payload": "yes"
          },
          {
            "type": "postback",
            "title": "Not sure 😳",
            "payload": "no"
          }
        ]
      }
    }
  };
}

// Deprecated
// Sample order receipt used for reference only
function getOrderReceipt() {
  return {
    "attachment": {
      "type": "template",
      "payload": {
        "template_type": "receipt",
        "recipient_name": "Emma Faust",
        "order_number": "2002",
        "currency": "EUR",
        "payment_method": "Master Card XX9383",
        "order_url": "http://google.com",
        "timestamp": "September 6, 2018 4:51:54 PM",
        "summary": {
          "total_tax": "$11.44",
          "total_cost": "$297.64"
        }
      }
    }
  };
}