# To Do List

## Strategic

Longer term planning for what's left to be done, in relative order.

1. Develop a basic user interface to try out different mechanics.  A basic outline should be made to get an idea of what to make for the rest of the system.
2. Develop an extensible server/database model that will allow for the general mechanics to be shared across users in the game.
3. Construct a mock server layer in the user interface to allow for single player disconnected mode, and faster turn-around on interface improvements.
4. Push that user interface mock server layer into code on the server.


## Tactical

Stuff that we want to do short term.

### User Interface

1. Switch from a one-object grid to one object per token.  This will make the data model much more one-to-one with user interactivity.  It should also allow playing with different rendering techniques easier.
2. Move to user interface interactions calling out to state changes.  This conceptual model must be constructed at this early phase to make later development easier.  It should also be well documented.


### Database

1. Move the current model to storing each tile as its own row, with a set of properties as columns.  This, combined with a dynamic attribute/property association, will allow for an extensible model.
