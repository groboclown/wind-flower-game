-- Player login
--   Links to the account.  Allows for a server thing.

CREATE TABLE LOGIN (
    -- Unique key for the table.
    --   Required; PostGres specific.
    login_id  INT {AUTOKEY}

    -- Unique user name.
    ,login_name    NVARCHAR(200) UNIQUE KEY

)
