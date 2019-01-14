FROM node:10.9.0 as builder

WORKDIR /chatlogin

ADD ./ /chatlogin

RUN npm install

RUN npm run build

FROM nginx:1.15.1

COPY --from=builder /chatlogin/webpack/dist/ /usr/share/nginx/www

RUN rm /etc/nginx/nginx.conf

COPY --from=builder /chatlogin/docker/nginx.conf /etc/nginx
