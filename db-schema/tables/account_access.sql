-- Security tracking.  Keeps track of account access / activity.
--   Note that no location data is tracked.

CREATE TABLE ACCOUNT_ACCESS (
    -- Unique key for the table.
    --   Required; PostGres specific.
    account_access_id       INT {AUTOKEY}
    
    -- Account which performed the access.
    ,account_id             INT NOT NULL

    -- When the access happened.  UTC
    ,access_on              TIMESTAMP NOT NULL

    -- Activity Category
    ,activity               VARCHAR(255) NOT NULL

    -- Parameters for the activity
    ,parameters             NVARCHAR(4096) NOT NULL
)
