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

# This script generates the uv-map for every generated png file.
# This is recorded in a json file that is carefully assembled
# through simple 'echo' commands.  jq not required.

echo '{"categories": {' > "${outdir}/uv-map.json"
images=()
rm_files=()
current_height=0
row_append=""
max_width=0
for src in *.svg ; do
  if [ "${src:0:1}" != _ ] ; then
    category="$( basename "${src}" .svg )"
    echo "Generating ${category}..."

    category_images=()

    # Assemble the decal variations on a single row.
    current_width=0

    h0=${current_height}
    h1=$(( current_height + 432 ))
    h2=$(( current_height + 433 ))
    h3=$(( current_height + 865 ))
    current_height=$(( current_height + 866 ))

    echo "${row_append}\"${category}\": {" >> "${outdir}/uv-map.json"
    row_append=", "
    cat_append=""


    # This is a category + variation for a tile.
    # Each SVG file must wrap its contents inside a <g> tag, so that
    # the last text elements are '</g>(\n|\r)*</svg>'
    # This allows the SVG to append the selection decorations.
    #
    # This svg is then converted to a png, along with the different
    # decorations, and all of them are put onto a single row of the final texture map.
    for mode in "normal" "hover" "select" "hover_select" ; do
      genfile="${outdir}/${category}-${mode}.svg"
      outname="${outdir}/${category}-${mode}.png"

      # Strip off the '</g></svg>' from the genfile.  Note that '<svg>' should
      # only appear at the start, and thus '</svg>' can only appear at the end.
      # Because any amount of whitespace can appear between tags, it must be
      # removed.  This has the side-effect of removing spaces in text, but a tile
      # shouldn't include text elements.
      cat "${src}" \
        | tr -d '\r\n' | tr -s '[:space:]' \
        | sed 's|</g></svg>||' | sed 's|</g> </svg>||' \
        > "${genfile}.1"

      # Now stick on the asset.
      cat "${genfile}.1" "_${mode}.svg.fragment" > "${genfile}"

      inkscape \
        --export-filename="${outname}" \
        --export-overwrite \
        --export-type=png \
        --export-width=1000 \
        --export-height=866 \
        "${genfile}" || exit 1

      category_images+=("${outname}")
      rm_files+=("${outname}" "${genfile}.1" "${genfile}")

      echo "${cat_append}\"${mode}\": [" >> "${outdir}/uv-map.json"
      cat_append=", "

      w0=$(( current_width + 0 ))
      w249=$(( current_width + 249 ))
      w250=$(( current_width + 250 ))
      w499=$(( current_width + 499 ))
      w500=$(( current_width + 500 ))
      w749=$(( current_width + 749 ))
      w999=$(( current_width + 999 ))
      current_width=$(( current_width + 1000 ))
      if [ ${current_width} -gt ${max_width} ] ; then
        max_width=${current_width}
      fi

      # triangle 0
      echo "[[${w249}, ${h0}], [${w0}, ${h1}], [${w499}, ${h1}]], " >> "${outdir}/uv-map.json"

      # triangle 1
      echo "[[${w500}, ${h1}], [${w749}, ${h0}], [${w250}, ${h0}]], " >> "${outdir}/uv-map.json"

      # triangle 2
      echo "[[${w749}, ${h0}], [${w500}, ${h1}], [${w999}, ${h1}]], " >> "${outdir}/uv-map.json"

      # triangle 3
      echo "[[${w249}, ${h3}], [${w499}, ${h2}], [${w0}, ${h2}]], " >> "${outdir}/uv-map.json"

      # triangle 4
      echo "[[${w499}, ${h2}], [${w250}, ${h3}], [${w749}, ${h3}]], " >> "${outdir}/uv-map.json"

      # triangle 5
      echo "[[${w749}, ${h3}], [${w999}, ${h2}], [${w500}, ${h2}]]]" >> "${outdir}/uv-map.json"
    done
    echo "}" >> "${outdir}/uv-map.json"

    # Create a horizontally appended stack of images.
    convert +append "${category_images[@]}" "${outdir}/_texture-${category}.png" || exit 1
    images+=("${outdir}/_texture-${category}.png")
    rm_files+=("${outdir}/_texture-${category}.png")

  fi
done
echo "}, \"width\": ${max_width}, \"height\": ${current_height} }" >> "${outdir}/uv-map.json"

# Create a vertically appended stack of images.
echo "Generating the final image..."
convert -append "${images[@]}" "${outdir}/mesh-texture.png" || exit 1

# Don't need to keep the intermediate png images.  They should be deleted.
echo "Cleaning up..."
for img in "${rm_files[@]}" ; do
  rm "${img}"
done
