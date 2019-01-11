FROM node:10.9.0 as builder
  
WORKDIR /chatbot

COPY . /chatbot
RUN npm install

CMD ["node", "/chatbot/app.js"]
