#!/usr/bin/env bash

if [ "$1" = "-h" ] || [ "$1" = "--help" ] || [ -z "$1" ] || [ -z "$2" ]; then
  echo "Usage: $0 (output directory) (temp directory)"
  echo "Prepares the .svg images in this directory for use as a mesh texture."
  echo "It converts the .svg images to PNG, then assembles them together into a single .png file."
  echo "It also generates a lookup .json file to map the file name to pixel coordinates."
  exit 0
fi

here=$( cd "$( dirname "$0" )" && pwd )
exec node "${here}/generate.js" --source="${here}" --output="${1}" --tempdir="${2}" --debug
