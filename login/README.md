# Reference Facebook Chatbot - Login Server Quick Start Guide

## Table of Contents

  * Reference Facebook Chatbot - Login Server
      * [Documentation Introduction](#documentation-introduction)
  * [Setting up the Login Server](#setting-up-the-login-server)
      * [Configuration Parameter Descriptions](#configuration-parameter-descriptions)
      * [Setting up a Development Environment](#setting-up-a-development-environment)
      * [Setting up a Production Environment](#setting-up-a-production-environment)
  * [Terms And Conditions](#terms-and-conditions)

### Documentation Introduction

This document provides guidelines to setup and configure the Reference Facebook Chatbot's Login Server,to server as the authentication bridge between the Reference Facebook Chatbot and Facebook's Messenger services.

## Setting up the Login Server

### Configuration Parameter Descriptions

You must configure the following parameters in the `./src/ep.config.json` file:

|  Parameter| Importance|Type|Description|
|--|--|--|--|
|`cortexApi.path`| Required| String| The URL, which is composed of the hostname and port, to access Cortex. By default, a web proxy is configured in the [Webpack](https://webpack.js.org/) configuration of the project. For local development, set this value to `/cortex` to redirect Cortex calls to the local proxy.|
|`cortexApi.scope`| Required| String| Name of the store from which Cortex retrieves data.|
|`cortexApi.pathForProxy`|Required|String| The path to which the [Webpack](https://webpack.js.org/) proxy routes the Cortex calls from the storefront. This value is a URL that consists of hostname and port of a running instance of Cortex. Leave this field blank to disable proxy.|

## Setting up a Development Environment

1. Ensure you have read through the documentation [here](https://github.com/elasticpath/facebook-chat/blob/master/README.md).
2. Run the `cd login` command.
3. To install dependencies, run the `npm install` command.
4. Configure the `./src/ep.config.json` file as required for the environment.<br/> For more information, see the [Configuration Parameter Descriptions](#configuration-parameter-descriptions) section.
5. To start the server in development mode, run the `npm start` command.
6. To see the running Reference Facebook Chatbot Login Page, navigate to `http://localhost:9000/auth/` .

### Setting up a Production Environment
1. Clone or pull the `react-pwa-reference-storefront` repository to your directory.
2. Navigate to the `react-pwa-reference-storefront` directory.<br>
3. To build the application in production mode, run the `npm run build` command.
This Builds the app for production to the `build` folder.<br>
It correctly bundles React in production mode and optimizes the build for the best performance.<br>
The build is minified and the filenames include the hashes.<br>
4. To see the running Reference Facebook Chatbot Login Page, navigate to `http://localhost:9000/auth/` .

## Terms And Conditions

- Any changes to this project must be reviewed and approved by the repository owner. For more information about contributing, see the [Contribution Guide](https://github.com/elasticpath/facebook-chat/blob/master/.github/CONTRIBUTING.md).
- For more information about the license, see [GPLv3 License](https://github.com/elasticpath/facebook-chat/blob/master/LICENSE).
