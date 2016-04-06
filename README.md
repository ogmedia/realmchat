# realmchat
Firebase, Backbone, Bootstrap, ThreeJS and other fun things all at once!

1. to get started run npm install

2. then run gulp to build

3. then fire it up with node server/server.js

Clicking on the grid should move the users cube to that grid space. Only 4 cubes can fit in a space. Cubes sharing grid space (4 max) are able to chat with each other. Chat will fire up a webrtc video chat between the 4 people, along with a chat window. 

Using firebase for state management and position tracking - takes care of the real-time bindings. Firebase will provide chat functionality, also.

Todos:
1.  snap cubs into grid, let them move however far they want
2.  cubes sharing a square need to prompt chat window
3.  cubes charing a square should fire up a webrtc video window for group video chat.
