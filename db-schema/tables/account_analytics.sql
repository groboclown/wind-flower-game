-- Account Analytics

CREATE TABLE ACCOUNT_ANALYTICS (
    -- Unique key for the table.
    --   Required; PostGres specific.
    account_analytics_id  INT {AUTOKEY}

    -- Account which this analysis relates to.
    ,account_id             INT NOT NULL

    -- :: Analytics ::
    -- Total number of games played.
    ,game_total      INT NOT NULL
    ,win_total       INT NOT NULL
    ,turn_total      INT NOT NULL
)
