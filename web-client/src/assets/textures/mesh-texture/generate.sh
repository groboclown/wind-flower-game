#!/usr/bin/env bash

if [ "$1" = "-h" ] || [ "$1" = "--help" ] || [ -z "$1" ] ; then
  echo "Usage: $0 (output directory)"
  echo "Prepares the .svg images in this directory for use as a mesh texture."
  echo "It converts the .svg images to PNG, then assembles them together into a single .png file."
  echo "It also generates a lookup .json file to map the file name to pixel coordinates."
  exit 0
fi

which convert >/dev/null 2>&1
convert_exist=$?
which inkscape >/dev/null 2>&1
inkscape_exist=$?
if [ ${convert_exist} != 0 ] || [ ${inkscape_exist} != 0 ] ; then
  echo "You must have ImageMagick installed with the tool 'convert' available in your path."
  echo "You must have Inkscape installed with the tool 'inkscape' available in your path."
  exit 1
fi

mkdir -p "$1" || exit 1
outdir="$( cd "$1" && pwd )"
cd "$( dirname "$0" )" || exit 1

echo '{"categories": {' > "${outdir}/uv-map.json"
images=()
current_height=0
append=""
for src in *.svg ; do
  if [ "${src:0:1}" != _ ] ; then
    # Export this svg into a png.
    category="$( basename "${src}" .svg )"
    outname="${outdir}/${category}.png"
    inkscape \
      --export-filename="${outname}" \
      --export-overwrite \
      --export-type=png \
      --export-width=1000 \
      --export-height=866 \
      "${src}" || exit 1

    # Record it.
    images+=("${outname}")
    h0=${current_height}
    h1=$(( current_height + 432 ))
    h2=$(( current_height + 433 ))
    h3=$(( current_height + 865 ))
    current_height=$(( current_height + 866 ))
    echo "${append}\"${category}\": [" >> "${outdir}/uv-map.json"

    # triangle 0
    # echo "[[0, ${h1}], [499, ${h1}], [249, ${h0}]], " >> "${outdir}/uv-map.json"
    echo "[[249, ${h0}], [0, ${h1}], [499, ${h1}]], " >> "${outdir}/uv-map.json"

    # triangle 1
    # echo "[[749, ${h0}], [250, ${h0}], [500, ${h1}]], " >> "${outdir}/uv-map.json"
    echo "[[500, ${h1}], [749, ${h0}], [250, ${h0}]], " >> "${outdir}/uv-map.json"

    # triangle 2
    # echo "[[500, ${h1}], [999, ${h1}], [749, ${h0}]], " >> "${outdir}/uv-map.json"
    echo "[[749, ${h0}], [500, ${h1}], [999, ${h1}]], " >> "${outdir}/uv-map.json"

    # triangle 3
    # echo "[[499, ${h2}], [0, ${h2}], [249, ${h3}]], " >> "${outdir}/uv-map.json"
    echo "[[249, ${h3}], [499, ${h2}], [0, ${h2}]], " >> "${outdir}/uv-map.json"

    # triangle 4
    # echo "[[250, ${h3}], [749, ${h3}], [499, ${h2}]], " >> "${outdir}/uv-map.json"
    echo "[[499, ${h2}], [250, ${h3}], [749, ${h3}]], " >> "${outdir}/uv-map.json"

    # triangle 5
    # echo "[[999, ${h2}], [500, ${h2}], [749, ${h3}]]]" >> "${outdir}/uv-map.json"
    echo "[[749, ${h3}], [999, ${h2}], [500, ${h2}]]]" >> "${outdir}/uv-map.json"

    append=", "
  fi
done
echo "}, \"width\": 1000, \"height\": ${current_height}}" >> "${outdir}/uv-map.json"

# Create a vertically appended stack of images.
convert -append "${images[@]}" "${outdir}/mesh-texture.png" || exit 1

# Don't need to keep the intermediate png images.  They should be deleted.
for img in "${images[@]}" ; do
  rm "${img}"
done
