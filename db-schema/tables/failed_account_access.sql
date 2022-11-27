-- Failed attempts at accessing an account.


CREATE TABLE FAILED_ACCOUNT_ACCESS (
    -- Unique key for the table.
    --   Required; PostGres specific.
    failed_account_id       BIGINT {AUTOKEY}

    -- Access key requested that triggered the failure
    ,access_key             VARCHAR(4096) NOT NULL

    -- When the access was attempted.  UTC
    ,occurred_on            TIMESTAMP NOT NULL

    -- Activity Category
    ,activity               VARCHAR(255) NOT NULL

    -- Parameters for the activity
    ,parameters             NVARCHAR(4096) NOT NULL
)
