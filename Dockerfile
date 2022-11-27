# Sets up the web server for a production-like environment.

# -------------------------------------------
# Bundle the client into the web application.
FROM node:lts-alpine as node_build
WORKDIR /app
COPY web-client /app
RUN npm install -g n \
  && n 19.1.0 \
  && n exec 19.1.0 npm install \
  && n exec 19.1.0 npm run build
# output is in the "dist" directory.


# -----------------------------------------
# Install the basic PHP installation.
FROM composer:2.1.9 as composer_build
COPY ./php-server/composer.lock /app/
RUN composer install --no-dev --no-autoloader --no-scripts
COPY ./php-server/. /app
RUN composer install --no-dev --optimize-autoloader


# -----------------------------------------
# Setup the final Distribution
FROM php:7.3-apache
RUN mv "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini"
RUN docker-php-ext-install pdo pdo_mysql
COPY devops/docker/php/*.conf /usr/local/etc/php-fpm.d/
COPY --chown=www-data --from=composer_build /app/ /var/www/html/
COPY --from=node_build /app/dist/ /var/www/html/public/
RUN php artisan view:cache
