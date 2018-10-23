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

var Cortex        = require("./cortex")
var session       = require('express-session')
var MemoryStore   = require('memorystore')(session)
var urlExists     = require('url-exists');
var orderArray    = [];
var cortexInstance;
'use strict';

// Imports dependencies and set up http server
const 
  request = require('request'),
  express = require('express'),
  body_parser = require('body-parser'),
  app = express().use(body_parser.json()); // creates express http server

// Sets server port and logs message on success
app.listen(process.env.PORT || 1337, () => console.log('EP-CHATBOT. Webhook is listening'));

// Accepts GET requests at the /webhook endpoint
app.get('/webhook', (req, res) => {
  // Update Verify Token
  const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
  
  // Parse params from the webhook verification request
  let mode = req.query['hub.mode'];
  let token = req.query['hub.verify_token'];
  let challenge = req.query['hub.challenge'];

  // Check if a token and mode were sent
  if (mode && token) {
    // Check the mode and token sent are correct
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      // Respond with 200 OK and challenge token from the request
      console.log('EP-CHATBOT. Webhook verified');
      res.status(200).send(challenge);
    } else {
      // Responds with '403 Forbidden' if verify tokens do not match
      res.sendStatus(403);      
    }
  }
});

/*****************************************/
/* PART 2. RECEIVE POST AND GET REQUESTS */
/*****************************************/

// Accept POST requests at /webhook endpoint
app.post('/webhook', (req, res) => {
  // Parse the request body from the POST
  let body = req.body;
  // Check the webhook event is from a Page subscription
  if (body.object === 'page') {
    // Iterate over each entry - there may be multiple if batched
    body.entry.forEach(function(entry) {
      // Gets the body of the webhook event
      let webhook_event = entry.messaging[0];
      // Get the sender PSID. 
      // TODO: Use info from PSID to support authentication with Elastic Path and welcome user by name
      let sender_psid = webhook_event.sender.id;    
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
    res.sendStatus(404);
  }

});

/*******************************************/
/* PART 3. MESSAGE HANDLERS AND DELEGATORS */
/*******************************************/

// Handle initial message events
function handleMessage(sender_psid, received_message) {
  getCortexInstance(sender_psid,1);
}

// Handle postback events
function handlePostback(sender_psid, received_postback) {
  console.log('EP-CHATBOT. Facebook postback event received');
  if(typeof global.cortexInstance !== 'undefined' && global.cortexInstance) {
    console.log('EP-CHATBOT. Cortex Client instance exists');
    parseMessageFromUser(sender_psid, received_postback.payload);
  } else {
    console.log('EP-CHATBOT. Cortex Client instance does not exist, requesting it');
    getCortexInstance(sender_psid,received_postback.payload);
  }
}

// Get a new Cortex Instance and calls the next meessage
function getCortexInstance(sender_psid,option){
    Cortex.createCortexInstance(process.env.EP_USER, process.env.EP_PASSWORD, process.env.EP_SERVER, process.env.EP_SCOPE).then((cortex) => {
    global.cortexInstance = cortex
    console.log('EP-CHATBOT. Cortex Client instance created successfuly')
    parseMessageFromUser(sender_psid, option)
  }).catch((err) => console.log(err))
}

// Delegate each input request to required function
function parseMessageFromUser(sender_psid, messageID){
    if(messageID == 1){
      console.log('EP-CHATBOT. Requesting welcome message');
      global.cortexInstance.getCartItems().then((itemsInCart) => {requestWelcomeMessage(sender_psid,itemsInCart)}).catch((err) => console.log(err))
    } else if(messageID == 'wishlist'){
      console.log('EP-CHATBOT. Requesting wishlist');
      global.cortexInstance.getWishlistItems().then((wishlistResponse) => {requestGetWishList(sender_psid,wishlistResponse)}).catch((err)=>console.log(err));
    } else if(messageID =='yes'){
      console.log('EP-CHATBOT. Requesting checkout');
      global.cortexInstance.cortexCheckout().then((checkoutResponse) => {requestCheckout(sender_psid,checkoutResponse)}).catch((err) => console.log(err))
    } else if(messageID == 'no'){
      requestMoveToWishlist(sender_psid);
    }
}

// Sends current message to user based on messageID and requests next message if necessary
// TODO: Improve this delegation to have a unique messageID flow based on configuration
function sendMessageToUser(sender_psid, response, messageID) {
  // Construct the message body
  let request_body = {
    "recipient": {
      "id": sender_psid
    },
    "message": response
  }

  // Send the HTTP request to the Messenger Platform
  request({
    "uri": "https://graph.facebook.com/v2.6/me/messages",
    "qs": { "access_token": process.env.PAGE_ACCESS_TOKEN },
    "method": "POST",
    "json": request_body
  }, (err, res, body) => {
    if (!err) {
      console.log('EP-CHATBOT. Message sent to Facebook API')
      // If there are items in the cart, prompts to checkout after a few seconds.
      if(messageID == 2){
        sendTypingMessage(sender_psid,'',0);
        setTimeout(function(){ sendMessageToUser(sender_psid, getCheckoutTemplate(), 3) }, 3500);
      }
      // After finishing a transaction, displays main menu again.
      if(messageID == 4){
        setTimeout(function(){ sendMessageToUser(sender_psid, getMainMenuTemplate("What else I can do for you?"), 7) }, 3500);
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
  let request_body = {
    "recipient": {
      "id": sender_psid
    },
    "sender_action": "typing_on"
  }

  // Send the HTTP request to the Messenger Platform
  request({
    "uri": "https://graph.facebook.com/v2.6/me/messages",
    "qs": { "access_token": process.env.PAGE_ACCESS_TOKEN },
    "method": "POST",
    "json": request_body
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
function requestWelcomeMessage(sender_psid,itemsInCart){
  var itemsInCartInt = getTotalItemsInCart(itemsInCart);
  // Sends Initial Welcome Message along with the message ID
  sendMessageToUser(sender_psid, getMessageWelcome(itemsInCartInt), 1);
  // If there's at least 1 item in the cart sends message with shopping cart items
  if(itemsInCartInt>0){
    sendMessageShoppingCart(itemsInCart,sender_psid);
  }
}

// Returns the number of items in the Shopping Cart
function getTotalItemsInCart(itemsInCart){
    var items = 0;
    var keys = Object.keys(itemsInCart);
    for (var i = 0; i < keys.length; i++) {
      items = items + parseInt(itemsInCart[keys[i]].wishlistItem.quantity);
    }
  return items;
}

// Get items from the wishlist
// TODO Detach  message text from logic. Ideal to move messages to templates
function requestGetWishList(sender_psid,itemsInWishlist){
  var response = { "text": `I found the following items in your wishlist:`}
  var wishListArray = [];
  var keys = Object.keys(itemsInWishlist);
  // Get and parse all items in the wishlist 
  for (var i = 0; i < keys.length; i++) {
      var productsArray = [];
      var productCode = itemsInWishlist[keys[i]].wishlistItem.code;
      var productName = itemsInWishlist[keys[i]].wishlistItem.definition.displayName;
      var productQuantity = itemsInWishlist[keys[i]].wishlistItem.quantity;
      var productPrice = itemsInWishlist[keys[i]].wishlistItem.price.purchasePrice[0].display;
      var productPriceAmount = itemsInWishlist[keys[i]].wishlistItem.price.purchasePrice[0].amount;
      productsArray.push(productCode,productName,productPriceAmount);
      wishListArray.push(productsArray);
  }
  // Generate list of products
  if(wishListArray.length>0){
    var products = "";
    for (var i = 0; i < wishListArray.length; i++) {
      if(i>0){
        products = products + "\n - ";
      }  
      products = products + wishListArray[i][1];
    }
    // Send message with items in the wishlist
    sendMessageToUser(sender_psid, getMainMenuTemplate("The following items are in your wishlist: \n - "+products+"\n\n What else I can do for you?"), 6); 
  } else{
    // Send message with no items in the wishlist
    sendMessageToUser(sender_psid, getMainMenuTemplate("Your wishlist is empty. What else I can do for you?"), 6); 
  }
}

// Checkout in Elastic Path
// TODO Detach  message text from logic. Ideal to move messages to templates
function requestCheckout(sender_psid,checkoutResponse){
  console.log('EP-CHATBOT. Sending checkout request to Cortex');
  checkoutResponse = JSON.parse(checkoutResponse);
  var orderTotal = (checkoutResponse['monetary-total'][0].display);
  var orderNumber = checkoutResponse['purchase-number'];  
  var response = {
    "text": "Great, I placed the order! The order number is "+orderNumber+", and the order total is "+orderTotal+". Details below:"
  }
  // Sends confirmation message to the user. Waits a few seconds to send a new message
  // TODO: Add messageID to this message
  sendMessageToUser(sender_psid, response);   
  var orderJSON = getOrderTemplate(checkoutResponse);
  setTimeout(function(){ sendMessageToUser(sender_psid, orderJSON, 4) }, 3500);
}

// If the user don't want to checkout, moves items to the wishlist
function requestMoveToWishlist(sender_psid){
  console.log("EP-CHATBOT. Moving all items in cart to wishlist");
  const promises = [];
  const promisesDelete = [];
  for (var i = 0; i < orderArray.length; i++) {
    var currentSKU = orderArray[i][0];
    console.log("EP-CHATBOT. Current item moved to the wishlist: ",currentSKU);
    promises.push(global.cortexInstance.cortexAddToWishlist(currentSKU)); 
    promisesDelete.push(global.cortexInstance.cortexDeleteFromCart(currentSKU));
  }
  Promise.all(promises,promisesDelete).then((response) => {
    // Send confirmation message
    sendMessageToUser(sender_psid, getMainMenuTemplate("That's fine! I moved all items in the shopping bag to your wishlist. What else I can do for you?"), 5);   
  });
}


// Get image URL based on product code and validate that exists
function getImageURL(productCode){
  var imageURL = process.env.EP_IMAGES + productCode + ".png";
  
  return new Promise(resolve => {
    urlExists(imageURL, function(err, exists) {
      if(exists){
        resolve(imageURL);
      } else{
        var index = productCode.indexOf("_");
        if(index>0){
          productCode = productCode.substring(0,index);
          imageURL = process.env.EP_IMAGES + productCode + ".png";
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
function getMessageWelcome(itemsInCartInt){
  var response = getMainMenuTemplate("Welcome back Emma! You don't have items in your shopping bag. How can I help you today?");
  if(!isNaN(itemsInCartInt)){
    if(itemsInCartInt==1){
      response = { "text": `Welcome back Emma! I found the following item in your shopping bag` }
    } else if(itemsInCartInt>1){
      response = { "text": `Welcome back Emma! I found the following items in your shopping bag` }
    }
  }
  return response;    
}

// Gets items in shopping cart and parses response
// TODO: Improve the creation of the JSON 
// TODO Detach  message text from logic. Ideal to move messages to templates
function sendMessageShoppingCart(itemsInCart,sender_psid){
  console.log("EP-CHATBOT. Items in shopping cart",itemsInCart);
  const promises = [];
  var keys = Object.keys(itemsInCart); 
  for (var i = 0; i < keys.length; i++) {
    promises.push(getImageURL(itemsInCart[keys[i]].wishlistItem.code));  
  }
  Promise.all(promises).then((productImages) => {
    var responsePart1 = "{\"attachment\": {\"type\": \"template\",\"payload\": {\"template_type\": \"generic\",\"elements\": [";
    var responsePart2 = "]}}}";
    var products = "";
    for (var i = 0; i < keys.length; i++) {
      var productsArray       = [];
      var productCode         = itemsInCart[keys[i]].wishlistItem.code;
      var productName         = itemsInCart[keys[i]].wishlistItem.definition.displayName;
      var productQuantity     = itemsInCart[keys[i]].wishlistItem.quantity;
      var productPrice        = itemsInCart[keys[i]].wishlistItem.price.purchasePrice[0].display;
      var productPriceAmount  = itemsInCart[keys[i]].wishlistItem.price.purchasePrice[0].amount;      
      productsArray.push(productCode,productName,productQuantity,productPriceAmount,productImages[i]);
      orderArray.push(productsArray);
      if(i>0){
        products = products + ",";
      }    
      products = products + "{\"title\": \""+productName+"\", \"subtitle\": \"Price: "+productPrice+" - Quantity: "+productQuantity+"\",\"image_url\": \""+productImages[i]+"\"}";
    }
    var response = responsePart1+products+responsePart2;

    // Sends Shopping Cart Information to the User
    sendMessageToUser(sender_psid, response, 2);
  });
}

/*****************************/
/* PART 6. MESSAGE TEMPLATES */
/*****************************/

function getMainMenuTemplate(introText){
  var response = {
      "attachment": {
        "type": "template",
        "payload": {
          "template_type": "button",
          "text":introText,
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
            ],
        }
      }
    }
  return response;
}

// Generates Order Template
// TODO: Improve the creation of the JSON
// TODO: Don't hard code name and address
function getOrderTemplate(checkoutJSON){
  var orderTotal = (checkoutJSON['monetary-total'][0].amount);
  var orderTax = checkoutJSON['tax-total'].amount;
  var orderShipping = 18.8;
  var orderSubtotal = orderTotal - orderTax - orderShipping;
  var orderNumber = checkoutJSON['purchase-number'];
  var orderDate = Math.floor(new Date() / 1000);
  var responsePart1 = "{\"attachment\":{\"type\":\"template\",\"payload\":{\"template_type\":\"receipt\",\"recipient_name\":\"Emma Faust\",\"order_number\":"+orderNumber+",\"currency\":\"USD\",\"payment_method\":\"Visa 9076\",\"order_url\":\"http://petersapparel.parseapp.com/order?order_id=123456\",\"timestamp\":"+orderDate+",\"address\":{\"street_1\":\"5th Avenue\",\"street_2\":\"\",\"city\":\"New York\",\"postal_code\":\"10203\",\"state\":\"NY\",\"country\":\"US\"},\"summary\":{\"subtotal\":"+orderSubtotal+",\"shipping_cost\":"+orderShipping+",\"total_tax\":"+orderTax+",\"total_cost\":"+orderTotal+"},\"adjustments\":[],\"elements\":[";
  var responsePart2 = "";
  //productCode,productName,productQuantity,productPrice,productImages[i]
  for (var i = 0; i < orderArray.length; i++) {
    if(i>0){
        responsePart2 = responsePart2 + ",";
    }
    //productCode,productName,productQuantity,productPrice,productImages[i])
    responsePart2 = responsePart2 + "{\"title\":\""+orderArray[i][1]+"\",\"quantity\":"+orderArray[i][2]+",\"price\":"+orderArray[i][3]+",\"currency\":\"USD\",\"image_url\":\""+orderArray[i][4]+"\"}";
  }
  var responsePart3 = "]}}}";
  console.log('EP-CHATBOT. Parsed response: ',responsePart1+responsePart2+responsePart3);
  return responsePart1+responsePart2+responsePart3;
}

//Returns checkout template
function getCheckoutTemplate(checkoutResponse){
  var response = {
      "attachment": {
        "type": "template",
        "payload": {
          "template_type": "button",
          "text":"Do you want to check out?",
          "buttons": [
              {
                "type": "postback",
                "title": "Yes!",
                "payload": "yes",
              },
              {
                "type": "postback",
                "title": "Not sure 😳",
                "payload": "no",
              }
            ],
        }
      }
    }
  return response;
}

// Deprecated
// Sample order receipt used for reference only
function getOrderReceipt(){
  var response = {
      "attachment": {
        "type": "template",
        "payload": {
          "template_type":"receipt",
          "recipient_name":"Emma Faust",
          "order_number":"2002",
          "currency":"EUR",
          "payment_method":"Master Card XX9383",        
          "order_url":"http://google.com",
          "timestamp":"September 6, 2018 4:51:54 PM",         
          "summary":{
            "total_tax": "$11.44",
            "total_cost": "$297.64"
          }
      }
    }
  }
  return response;
}