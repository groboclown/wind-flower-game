# About

The schema for the database used by the server, and accompanying scripts to maintain the database.

Where possible, the database should be as vendor neutral as possible.  To this end, the `.sql` files are a template of sorts with a very simple transformation to make vendor-specific schema.


## Design Principles

1. Table names are in screaming snake case, column names are in snake case.  They are singular.
1. Every table has an identity column `tablename_id`, which is an auto-generated unique ID.
