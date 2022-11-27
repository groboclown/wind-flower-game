#!/bin/bash

if [ "$1" == '-h' ] || [ "$1" == '--help' ] ; then
    echo "Constructs the distribution bundle, appropriate for installing into a server."
    echo "Usage: $0"
    exit 0
fi
