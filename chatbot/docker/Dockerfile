FROM node:10.9.0 as builder
  
WORKDIR /chatbot

ARG PAGE_ACCESS_TOKEN
ARG VERIFY_TOKEN
ARG SERVICE_URL
ARG SCOPE
ARG S3_URL
ARG FIREBASE_API_KEY
ARG FIREBASE_SERVICE_ACCOUNT
ARG FIREBASE_AUTH_DOMAIN
ARG FIREBASE_APP_NAME
ARG FIREBASE_DB_URL

ADD ./ /chatbot

RUN ["chmod", "+x", "/chatbot/docker/script.sh"]

RUN /chatbot/docker/script.sh

RUN npm install

CMD ["node", "/chatbot/app.js"]
