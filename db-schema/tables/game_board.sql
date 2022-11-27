-- The Table Layout for a Game.
--   The table layout is split up into bundles of tiles.
--   Because tiles can only be played next to adjacent tiles, this defines the limit
--     for the bounds of tile discovery.
--   Each tile includes the tile type + the player index that played it.
--   Clients query for the game_id + bundle location string.


CREATE TABLE GAME_BOARD (
    -- Unique key for the table.
    --   Required; PostGres specific.
    game_board_id       BIGINT {AUTOKEY}

    -- Foreign key to the game that this relates to.
    ,game_id            INT NOT NULL

    -- The bundle location ID,
    --   which is the union of the bundle's absolute location on the board.
    ,bundle_location    VARCHAR(32) NOT NULL

    -- The tile pairs in this bundle.
    ,tiles              VARCHAR(4096)
)



CREATE INDEX GAME_BOARD__Q1
        ON GAME_BOARD (
    game_id
    ,bundle_location
)
