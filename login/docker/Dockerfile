FROM node:10.9.0 as builder

WORKDIR /chatbot

COPY . /chatbot

RUN npm install

RUN npm run build

FROM nginx:1.15.1

COPY --from=builder /chatbot/webpack/dist/ /usr/share/nginx/www

RUN rm /etc/nginx/nginx.conf

COPY --from=builder /chatbot/docker/nginx.conf /etc/nginx
