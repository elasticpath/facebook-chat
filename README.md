# Reference Facebook Chatbot Quick Start Guide

## Table of Contents

  * Reference Facebook Chatbot
      * [Documentation Introduction](#documentation-introduction)
      * [Related Resources](#related-resources)
  * [Overview](#overview)
  * [Setting up the Chatbot](#setting-up-the-chatbot)
      * [Prerequisites](#prerequisites)
  * [Terms And Conditions](#terms-and-conditions)

## Reference Facebook Chatbot

### Documentation Introduction

This document provides guidelines to setup and configure the Reference Facebook Chatbot, and integrate it with the REACT PWA Reference Storefront. However, this document is not a primer for JavaScript and is intended for professionals who are familiar with the following technologies:

  * [Nodejs](https://nodejs.org/en/)

### Related Resources

- [Reference Facebook Chatbot Overview](https://developers.elasticpath.com/reference-experiences)
- [Chatbot README](chatbot/README.md)
- [Login Server README](login/README.md)

- [REACT PWA Reference Storefront Repository](https://github.com/elasticpath/react-pwa-reference-storefront/)
- [REACT PWA Reference Storefront Overview](https://developers.elasticpath.com/reference-experiences)
- [REACT PWA Reference Storefront Documentation](https://elasticpath.github.io/react-pwa-reference-storefront/)

## Overview

The Reference Facebook Chatbot is a flexible chatbot integrated with Facebook Messenger, which communicates with Elastic Path’s RESTful e-commerce API, Cortex API. Through the Cortex API, the chatbot uses the e-commerce capabilities provided by Elastic Path Commerce and interacts with data in a RESTful manner.

## Setting up the Chatbot

### Prerequisites

Ensure that the following software are installed:

* [Git](https://git-scm.com/downloads)
* [Node.js](https://nodejs.org/en/download/)
* [Visual Studio Code](https://code.visualstudio.com/) with the following extensions:<br/>
    * [Debugger for Chrome](https://marketplace.visualstudio.com/items?itemName=msjsdiag.debugger-for-chrome)<br/>
    * [ESLint extension](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint)<br/>
* A valid Elastic Path development environment. For more information, see
[The Starting Construction Guide](https://developers.elasticpath.com/commerce/construction-home).

### Setting up a Development Environment

1. Clone or pull the `facebook-chat` repository to your directory.
2. Run the `cd facebook-chat` command.
3. Follow the instructions detailed in the Chatbot README file [here](chatbot/README.md).
4. Follow the instructions detailed in the Login Server README file [here](login/README.md).
5. (Optional) You may integrate the Reference Facebook Chatbot with the REACT PWA Reference Storefront available [here](https://github.com/elasticpath/react-pwa-reference-storefront/).

## Terms And Conditions

- Any changes to this project must be reviewed and approved by the repository owner. For more information about contributing, see the [Contribution Guide](https://github.com/elasticpath/facebook-chat/blob/master/.github/CONTRIBUTING.md).
- For more information about the license, see [GPLv3 License](https://github.com/elasticpath/facebook-chat/blob/master/LICENSE).
