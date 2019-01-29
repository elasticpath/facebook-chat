# Reference Facebook Chatbot - Chatbot Server Quick Start Guide

## Table of Contents

  * Reference Facebook Chatbot - Chatbot Server
  * [Setting up the Chatbot Server](#setting-up-the-chatbot-server)
    * [Environment File](#environment-file)
    * [Running the application](#running-the-application)
    * [Configuring the Facebook API](#configuring-the-facebook-api)
    * [Deploy the application](#deploy-the-application)
    * [Features](#features)
    * [Making tests](#making-tests)
  * [Appendices](#appendices)
  * [Terms And Conditions](#terms-and-conditions)

## Setting up the Chatbot Server

### Environment File

The application requires some information that can be stored either in a environment file (.env) or as constants directly in the code.

.env example:
```
VERIFY_TOKEN='<Randomly_Generated_Token_To_Provide_To_Facebook>'
PAGE_ACCESS_TOKEN='<Token_Provided_By_Facebook>'

EP_SERVER='http://<Customer_demo_url>/cortex'
EP_SCOPE='<Customer_Store>'
EP_IMAGES='https://s3-us-west-2.amazonaws.com/<link_to_images>/'
```

constants example in <a href="https://github.elasticpath.net/sales-demos/facebook-chatbot/blob/master/app.js">App.js</a>
```javascript
const VERIFY_TOKEN = '<Randomly_Generated_Token_To_Provide_To_Facebook>';
const PAGE_ACCESS_TOKEN='<Token_Provided_By_Facebook>';

const EP_SERVER='http://<Customer_demo_url>/cortex';
const EP_SCOPE='<Customer_Store>';
const EP_IMAGES='https://s3-us-west-2.amazonaws.com/<link_to_images>/';
```

### Running the application

1. Ensure you have read through the documentation [here](https://github.com/elasticpath/facebook-chat/blob/master/README.md).
2. Run the `cd chatbot` command.
3. To install dependencies, run the `npm install` command.
4. To run the application, run the `node app.js` command.
4. Configure the `./src/ep.config.json` file as required for the environment.<br/> For more information, see the [Configuration Parameter Descriptions](#configuration-parameter-descriptions) section.
5. To start the server in development mode, run the `npm start` command.
At that point, you should get the following displayed:

![Running the application](./FacebookChatbotGuide/app-running.png)

Use `<Ctrl>-C` to stop the application

### Configuring the Facebook API

In this part, we are going to assume that you already created a Facebook business page. If you did not, please review the [appendices](#appendices) first.

Go to <a href="https://developers.facebook.com">Facebook for developer</a> and log in with the page admin credentials. If you have multiple pages on this account, pick the one that you are creating the chatbot for.

On the sidebar, click the (+) button next to Products, and search for `Messenger`, (it should be one of the first 3 products).
Click on Set Up to configure Messenger, In the sidebar you should now see `Messenger`.
In the page, you should see a block called `Token Generation`, select your Facebook page in this block. By doing it, Facebook will create a random token. Copy it, and populate the field `PAGE_ACCESS_TOKEN` with it, in your environment file or in your constant.
We will come back to this page when everything is set up to configure the webhooks.

At the top of the page, you should see `APP ID: <TOKEN>`. Copy `<TOKEN>` and head to your Facebook page. Hit settings on the top-right corner of the page.
On the sidebar, click Messenger Platform and scroll down to `Subscribed Apps`, this should be empty for now.
Just below this block, you can see `Link your App to Your Page`, in the field, paste the `<TOKEN>` you previously copied (i.e. APP ID) and hit `Link`
This should populate the block `Subscribed Apps` just above.

Head back to <a href="https://developers.facebook.com">Facebook for developers</a>.
On the sidebar, click Roles, this will open a dropdown menu, click Roles in this sub-menu.
You can see `Administrators` with your Facebook account and `Testers` with none in this block.
Click `Add Testers`, this will open a modal, search for your tester account and click submit.
Open a new incognito page and head to Facebook. Log in as the tester.
You should get a notification from your business page. Click accept to become a tester.

The Facebook API is now configured and the tester is able to test the chatbot.

### Deploy the application

For the final configuration step, it is required first to deploy the application.

go to `/etc/apache2/sites-available`.
update `000-default.conf` to add this:

```
ProxyPass /chatbot http://127.0.0.1:<PORT>
ProxyPassReverse /chatbot http://127.0.0.1:<PORT>
```
where <PORT> is the port used by the node application.

Facebook will not accept not secure communication, so you need to install an SSL certificate from a valid CA.

We are going to use Let's Encrypt for this part.

run the command `sudo add-apt-repository ppa:certbot/certbot`.
Then run `sudo apt-get update`.
Run `sudo apt-get install python-certbot-apache`
Run `sudo certbot --apache -d <Customer>.epdemos.com`, where <Customer> is the subdomain that you are using.
Fulfill the form from certbot, but make sure to NOT redirect http to https by default. If you do so, it will redirect everything, including: Cortex, CM, Studio from port 80 to port 443, which will cause issues when making requests. (i.e. requests will be redirected, causing the HTTP code to be 30X instead of 20X).

You should have a new file in `/etc/apache2/sites-available`: `000-default-le-ssl.conf`.
This file contains the exact same thing as `000-default.conf` but for port 443.

Run `npm install -g forever`.
Head back to the Github repository of the chatbot and run `forever start app.js`.
This will run the Node application as a background task, so you get control again and can leave the VM without stopping the application.

Copy the content of the `VERIFY_TOKEN` constant or property, if you didn't create a token, then generate it first, try to use a 40 to 50 character long token containing only digits and capitalized letters.

Head back to <a href="https://developers.facebook.com">Facebook for developers</a>.

Click `Add subscription` or `Edit subscription` and paste the token in the `Verify Token` field.
In the callback URL field add `https://<Customer>.epdemos.com/chatbot/webhook` where `<Customer>` is the subdomain of your application.

Click `Verify and Save`. If this doesn't work, in the `Callback URL` field, there should be a red cross on the right, if you hover it you should see the cause of the error.
If you get a 404 error then it is likely that the deployment went wrong or that the application crashed.
If you get a 403 error, then you have a configuration issue in your .env file or in your constants.
To debug it, run `forever stop app.js`, then in the first method `app.get('/webhook', (req, res) => {...` add logs to check out the values of `token` that should be your `VERIFY_TOKEN` and `mode` that should be `subscribe`.

The application contains a `Docker` folder that contains a Dockerfile and a Shell script. The Dockerfile uses a NodeJS image and contains multiple arguments that you can populate using the `--build-args` argument when building the image.
These Docker arguments are used in the Shell script to replace the constants in the code, this way, the chatbot is easily deployable and doesn't require to modify directly the code.

|  Parameter| Importance|Type|Description|
|--|--|--|--|
|`PAGE_ACCESS_TOKEN`| Required| String| The token that is provided by Facebook on (developers.facebook.com) for each application.|
|`VERIFY_TOKEN`| Required| String| The token that you have to generate and pass to Facebook when configuring the webhooks.|
|`SCOPE`|Required|String| Name of the store from which Cortex retrieves data.|
|`S3_URL`|Required|String| The URL that consists of the path to images hosted on an external CMS. Set this parameter to the complete URL of the images by replacing the `<link_to_images>` with the path of your images|
|`FIREBASE_API_KEY`|Required|String| Your firebase API key.|
|`FIREBASE_AUTH_DOMAIN`|Required|String| This is the unique domain provided by Firebase for your application.|
|`FIREBASE_APP_NAME`|Required|String| This is the name you use to register your application on Firebase.|
|`FIREBASE_DB_URL`|Required|String| This is the database URL that Firebase provides.|

### Features

In its current state. The chatbot is able to perform multiple actions.
It contains regular actions that are triggered by clicking on buttons in the Messenger application: Login to Cortex, Add an item to the cart, Add an item to the wishlist, Check out, Move an item from the cart to the wishlist and vice-versa.
But it also contains 3 NLP features that use a limited vocabulary. 
- You can search items based on keywords, for example: `search for golf bag` will perform a search request with keywords `golf` and `bag`
- You can add items in your cart based on keywords and on quantity, for example: `add 3x golf bag` will perform a search based on `golf` and `bag` and will send a response that enables the user to add 3 of the found items in their cart
- You can apply a promotion coupon, for example: `apply REDUCTION10` will apply the `REDUCTION10` coupon if it exists
The last major feature is the ability to link a Facebook account to a Cortex account. This is done by authenticating on the login application that is included in the chatbot, this application exposes a form that that performs authentication requests to a Cortex server.

### Making tests

Go to Facebook and log in as the tester (i.e. the App tester).
Head to the page to test and click `Send Message` on the top on the right.

Write anything in the chat box, and the chatbot should reply with:
> Welcome back Emma! You don't have items in your shopping bag. How can I help you today?

Go to Studio and log as the tester, make sure to have all the required information set up.

Add items to your cart and go back to Facebook. Write anything in the chat box and you should see something like that:

![Chat with items in cart](./FacebookChatbotGuide/chat-with-items.png)

If you click `Not Sure` the bot will put the items in your wishlist.
If you click `Yes!` the bot will pass the order:

![Checkout](./FacebookChatbotGuide/checkout.png)

You can then click on the order to have a new component popping up:

![Order review](./FacebookChatbotGuide/order-review.png)

At this point the chatbot is up and running!


## Appendices

To create a Facebook business page, log in as your page admin account.
In the sidebar, click Pages, just in the `Explore` block.
Click `Create Page` on the top right corner and click `Business or Brand`, add a page name and a category (Clothing, Brand, Computers...)
Click continue, if this is your first page, it will be asked to add a cover photo and a profile picture. Skip this part as it does not matter.

## Terms And Conditions

- Any changes to this project must be reviewed and approved by the repository owner. For more information about contributing, see the [Contribution Guide](https://github.com/elasticpath/facebook-chat/blob/master/.github/CONTRIBUTING.md).
- For more information about the license, see [GPLv3 License](https://github.com/elasticpath/facebook-chat/blob/master/LICENSE).
