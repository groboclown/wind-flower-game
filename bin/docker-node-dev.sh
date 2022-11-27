#!/bin/bash

if [ "$1" = "-h" ] || [ "$1" = "--help" ] ; then
  echo "Usage: $0"
  echo "Starts a local environment in a docker container to run NodeJS scripts."
  echo "Allows for running a server listening on ports 3000, 8000, and 8080."
  exit
fi

here="$( dirname "$0" )"
cd "${here}/.." || exit 1
docker build -t local/windflower-web:latest -f "${here}/node-dev-env.Dockerfile" . || exit 1
docker run --rm -it -v $(pwd):/opt/local -p3000:3000 -p8000:8000 -p8080:8080 local/windflower-web:latest
