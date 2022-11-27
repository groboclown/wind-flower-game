-- Each turn for a game.

CREATE TABLE GAME_TURN (
    -- Unique key for the table.
    --   Required; PostGres specific.
    game_turn_id        BIGINT {AUTOKEY}

    -- Foreign key to the owning game.
    ,game_id            INT NOT NULL

    -- Foreign key to the game's player that performed the turn.
    ,game_player_id     BIGINT NOT NULL

    -- When the play was made.  UTC
    ,played_on          TIMESTAMP NOT NULL

    -- The tile that was played.
    ,tile               VARCHAR(1) NOT NULL

    -- Where the tile was played
    ,position_x         INT NOT NULL
    ,position_y         INT NOT NULL
)
