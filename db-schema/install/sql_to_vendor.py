#!/usr/bin/python3

"""Script to transform the schema into vendor specific formats."""

from typing import Mapping, Sequence
import os
import sys


VENDOR_REPLACEMENTS: Mapping[str, Mapping[str, str]] = {
    'mysql': {
        '{AUTOKEY}': 'AUTO_INCREMENT PRIMARY KEY',
    },
    'postgresql': {
        '{AUTOKEY}': 'GENERATED ALWAYS AS IDENTITY',
    },
}


def convert_template(contents: str, vendor: str) -> str:
    """Convert the schema template contents into a vendor specific one."""
    vendor = vendor.lower()
    if vendor not in VENDOR_REPLACEMENTS:
        raise Exception(f'Unsupported vendor {vendor}')
    for key, rep in VENDOR_REPLACEMENTS[vendor].items():
        contents = contents.replace(key, rep)
    return contents


def main(args: Sequence[str]) -> int:
    """CLI Entrypoint."""
    if len(args) < 4:
        print(f"Usage: {args[0]} (vendor name) (output directory) (source ...)")
        print("Where:")
        print(f"   vendor name         one of {VENDOR_REPLACEMENTS.keys()}")
        print("   output directory    location to put the translated files")
        print("   source              list of source files to convert.")
        return 1
    
    vendor_name = args[1]
    if vendor_name.lower() not in VENDOR_REPLACEMENTS:
        print(f"Vendor name must be one of {VENDOR_REPLACEMENTS.keys()}")
        return 2
    
    output_dir = args[2]
    if not os.path.isdir(output_dir):
        print(f"Output directory does not exist: {output_dir}")
        print("Processing aborted.")
        return 3
    
    ret = 0
    for src_file in args[3:]:
        if not os.path.isfile(src_file):
            print(f"NO such file: {src_file}")
            ret += 1
            continue
        name = os.path.split(src_file)[1]
        tgt_file = os.path.join(output_dir, name)
        with open(src_file, 'r', encoding='utf-8') as fis:
            with open(tgt_file, 'w', encoding='utf-8') as fos:
                fos.write(convert_template(fis.read(), vendor_name))
    return ret


if __name__ == '__main__':
    sys.exit(main(sys.argv))
