-- The Central Game Lookup.


CREATE TABLE GAME (
    -- Unique key for the table.
    --   Required; PostGres specific.
    game_id         INT  {AUTOKEY}

    -- The public name for the game.
    --   Random set of [a-z0-9]+ characters used to share the game between people.
    ,public_name    VARCHAR(512) UNIQUE NOT NULL

    -- Human name for the game.
    --   Also shared between players, but is non-unique, even for players.
    --   The character set is UTF-8 characters.
    ,human_name     NVARCHAR(200) NOT NULL

    -- Options selected for the game.
    --   Each option is a letter + number pair.
    game_options    VARCHAR(512) NOT NULL

    -- State for the game.
    --   -1  - new game, waiting for players.
    --   -2  - archived game, completed and currently not flagged for delete.
    --   -3  - abandoned game, flagged for future trash-bin.
    --   -4  - trashbin, marked as delete and will be removed in the future.
    --   0-n - active game, player n turn.
    ,play_state     INT NOT NULL
)
