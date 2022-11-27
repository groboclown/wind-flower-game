# Wind Flower

![wind flower icon](web-client/public/icons/fav-icon-512.png)

Game where players take turns creating the map to grow their territory.

## Status

Current Status:

* web client:
    * Established general technology base.
    * Able to show hex grid in 3d.
* server:
    * Established general PHP framework.


## Local Environment Setup

To set up your local environment, this package assumes you have a container technology, such as Docker or Podman.

While you can use the web client through a container, it's advised to have NPM installed locally.  To get this going, it's advised to use [`n`](https://www.npmjs.com/package/n) to have the right NPM version installed.

```bash
$ npm install -g n
$ export N_PREFIX="${HOME}/.n"
$ n 19.1.0
$ alias node="$( n which 19.1.0 )"
$ alias npm="$( dirname "$( n which 19.1.0 )" )/npm"
```
