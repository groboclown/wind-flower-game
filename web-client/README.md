# Web Client

The web side of things.


## Architecture

The web client is configured in this way:

* The user's account is on the originating server.  The client only has information for connecting to the one server.
* There are three categories of events:
  * State change events - the system state changes.  React!
  * Timer events - real world time passes.
  * Input events - the local user performs some interaction with the program.  This does not include active server data received.  The input events are sent to the graphical elements, which in turn can send state change events (camera state changes aren't pushed to the state).


## Technologies

The web client uses these technologies to power it:

* [phaser](https://phaser.io) - the game engine
* [enable3d](https://enable3d.io) - the 3d engine
* [redux](https://redux-toolkit.js.org) - data store
