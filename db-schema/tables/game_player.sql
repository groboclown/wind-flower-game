-- List of players in each game


CREATE TABLE GAME_PLAYER (
    -- Unique key for the table.
    --   Required; PostGres specific.
    game_player_id      BIGINT {AUTOKEY}

    -- Foreign key to the game table
    ,game_id            INT NOT NULL

    -- Foreign key to the account table; can be null for anonymous games.
    ,account_id         INT

    -- Player number, used for marking turn number.
    ,player_index       INT

    -- Name for the player, can be different than the account.
    ,human_name         NVARCHAR(200) NOT NULL

    -- Secret key for the player in this game.
    --   Used to ensure others can't impersonate this player.
    ,access_key         VARCHAR(4096) NOT NULL

    -- Location on the game board where the player starts.
    ,start_location_x   INT
    ,start_location_y   INT

    -- Active tiles the player can choose from.
    --   Each tile type is a letter.
    --   Note that this is non-null, which means it must
    --      be initialized when entering the game.
    ,tile_stack         VARCHAR(20) NOT NULL
)
