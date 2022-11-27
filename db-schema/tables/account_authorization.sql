-- Action authorization.  What the account is allowed to do.

CREATE TABLE ACCOUNT_AUTHORIZATION (
    -- Unique key for the table.
    --   Required; PostGres specific.
    account_authorization_id  INT {AUTOKEY}
    
    -- Account which performed the access.
    ,account_id             INT NOT NULL

    -- When this authorization record was created.  UTC
    ,granted_on              TIMESTAMP NOT NULL

    -- Is this action allowed or explicitly prohibited? 0 or 1.
    --   Prohibited actions override any granted access.
    ,allowed                 TINYINT,

    -- Action name granting access.
    ,action_name             VARCHAR(255) NOT NULL

    -- Resource the action is granted to.
    ,resource_name           NVARCHAR(4096) NOT NULL
)
