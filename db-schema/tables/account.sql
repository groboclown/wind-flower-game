-- Player accounts.
--   At the moment, this table is optionally used by players.


CREATE TABLE ACCOUNT (
    -- Unique key for the table.
    --   Required; PostGres specific.
    account_id      INT {AUTOKEY}

    -- When the account was created.
    --   Should be stored in UTC.
    ,created_on     TIMESTAMP NOT NULL

    -- Public security key for transmitting private information to the player's device.
    --   The player's device contains the private key.
    --   This is primarily for ensuring the player is who they say they are.
    ,access_key      VARCHAR(4096) NOT NULL

    -- :: User Settings ::
    -- Viewable name.
    ,human_name      NVARCHAR(200) NOT NULL

    -- Local timezone name
    ,local_tz_name   NVARCHAR(200) NOT NULL
)
