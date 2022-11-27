#!/bin/sh

if \
        [ -z "$1" ] \
        || [ -z "$2" ] \
        || [ ! -d "$1" ] \
        || [ ! -d "$2" ] \
        || [ "$1" == "-h" ] \
        || [ "$1" == "--help" ] \
; then
    echo "Usage: $0 (source dir) (output dir)"
    echo "Both directories must exist."
    exit 0
fi

srcdir="$1"
outdir="$2"

for i in "${srcdir}"/*.sql ; do
    outfile="${outdir}/"$( basename "$i" )
    cp "$i" "${outdir}/."
    sed -i 's/{AUTOKEY}/GENERATED ALWAYS AS IDENTITY/g' "${outfile}"
done
