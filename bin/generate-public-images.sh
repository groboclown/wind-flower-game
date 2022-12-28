#!/usr/bin/env bash

if [ "$1" = "-h" ] || [ "$1" = "--help" ] ; then
  echo "Usage: $0"
  echo "Generates all the images and assets accompanying the images for the web client."
  exit 0
fi

cd "$( dirname "$0" )/../web-client" || exit 1

tmpdir="/tmp/wind-flower-image-generation"
mkdir -p "${tmpdir}"

for generator in src/assets/*/*/generate.sh ; do
  p0="$( dirname "${generator}" )"
  asset_name="$( basename "${p0}" )"
  p1="$( dirname "${p0}" )"
  asset_type="$( basename "${p1}" )"
  "${generator}" "public/${asset_type}/${asset_name}" "${tmpdir}" || exit 1
done
