# The Client-Server REST API

The communication between the client and the server is based on a simple REST API (it might evolve later into GraphQL, especially for game board retrieval).

Every send and every receive, including account creation, contains an HMAC signature to verify both the client and the server.
