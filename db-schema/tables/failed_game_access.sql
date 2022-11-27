-- Keeps track of failed access attempts to a game.


CREATE TABLE FAILED_GAME_ACCESS (
    -- Unique key for the table.
    --   Required; PostGres specific.
    failed_access_id        BIGINT {AUTOKEY}

    -- Foreign key to the game table.
    ,game_id                INT NOT NULL

    -- Access key requested that triggered the failure
    ,access_key             VARCHAR(4096) NOT NULL

    -- When the access was attempted.  UTC
    ,occurred_on            TIMESTAMP NOT NULL

    -- Activity Category
    ,activity               VARCHAR(255) NOT NULL

    -- Parameters for the activity
    ,parameters             NVARCHAR(4096) NOT NULL
)
