# 1.2.1 changes
- manual save button now shows a checkmark and "saved!" tooltip when you save
- fixed description of shift + arrow setting to say "Shift + arrow selects cells"
- added a dedicated save icon for the manual save button
- fun mode setting is no longer saved
- service worker now only caches for offline use (network-first), and is skipped in dev mode
- randomize settings button no longer randomizes fun mode or telemetry
- enabling pacing now takes effect immediately without a refresh
- fixed focus going nowhere when deleting a box made with the plus button on a column header
- added a "suggest a feature" button in the help popup that links to the GitHub issues page
- documented the save, copy, and cut shortcuts in the shortcuts list
- telemetry now respects the Global Privacy Control browser signal
- focused box now stays a comfortable distance from the edges of the scroll area

# 1.2 changes
- telemetry
- Move to netlify
- Changed the lines a little
- Cell focus manipulation now wraps between flows
- Speech timer includes a Pacing timer, will tell you how much time you need to spend on each argument
    - Pacing will skip blank boxes and extensions
    - and if you mark how long an arg will take to say (for cards and such) the pacing will be adjusted around that
- Fun mode (EPILEPSY WARNING)
- Copy paste cut
- Selection that is real buggy
- manual saving button
- add saving notes doc
- nix shell stuff
- MAKE IT WORK OFFLINE, uses a service worker

# Planned
## long term goals (X..)
- flew share that can interop with tabroom share, email, maybe even usb
- flow disclosure is the new theory argument god bless
- 

## Big features (.X. releases probably)
- Panels: Actually dockable re-organizable windows like godot does, this already has a branch called panels
    - star args to keep them in a panel
    - speechdrop panel
    - link with cardmirror here
    - this is probably our 2.0.0
- Theming engine:
    - Transparency
    - Image background
    - More default themes that are actually good
    - custom css
- CONNECTIONS: Control K, connect parts of flow together
    - xapp can be easily explained by clicking on it and going to that bit of the flow on a different page
    - i think you should be able to edit a link visually
    - make those links availible in notesdoc
- Tutorial that is good
    - explains timers
    - explains uuuh more stuff
    - video tutorial
- an editor to customize debate formats 
- Transcript panel
    - local transcription
    - uses opposing speechdoc and catches things they say but not from doc, and tags n stuff (small story, at state i went against the winning team, only round in prelims i lost, they went for 5 minutes of santa in 2ar and it wasnt in their speechdoc ever. ugh.)
    - automatically start timer when opponent begins speaking from their doc
- Cardmirror integration
    - if we can make a communication system (web server running on cardmirror desktop? ugh i really wish it would work with just tabs though... and i dont want to fork cardmirror):
        - click on cards to go to them in the speech
        - when you want to read a card from your speechdoc and have pacing enabled it will automatically determine length based on cm settings about wpm n stuff
        - When writing a speech in flows if you @ (connect) a quick card it will add it to ur cardmirror speechdoc?
        - automatically put your latest speechdoc in the notes doc, invisified mode !
        - very big question though: neither program is keeping track of what speech the round is on really, sooo how do we coordinate stuff between them?
        - sync timers
    - cmir imports turn tags into preflows
    - there is a public api! wow!
    - they use a polyform license that is NOT compatible with gpl!!!!
    - i kind of want it so you can write analytics (or your partner or opponent does) in cmir and then some *local* ai classification model that runs on your computer can figure out where those things need to go on the flow, the memory benifits of writing shit down only really matters once
- new collab features
    - mark box as OH GOD PLEASE COME UP WITH A RESPONSE IM GETTING THERE SOON AND IF I DONT HAVE ANYTHING TO SAY WE LOSE THIS ROUND
    - Give notification to other person
    - shared doc?
    - no more whispering ever is kind of the goal of this feature
    - names for guests in collab
    - view only guests (for opponents?) locked to only speeches that have already been given
    - im unsure how small of a feature this is, webrtc code based sharing? instead of copy paste? could be part of flew share
    - an easier way to do quick webrtc handshake is you scan a qr code on your phone, it brings up that same qr code on your phone which you can scan into another computer since it would be awkward doing it with just 2 computers pointing webcam at screen
    - clear indicator that when you are offline and running from cached serviceworker assets that things are NOT going to work!, switch sharing icon to globe crossed out to indicate no internet, grey out, and tooltip that says youre offline, sharing disabled
- history changes
    - make it so you can undo deleting a flow page
    - complete google docs style version history


## Small features/fixes (..X releases)
- evaluate if switching to the AGPL is possible, if so do it, actually tell me to do it since it would be a waste of tokens to write it out yourself (gpl kind of does not work for this project to ensure free-ness since its served over web)
- a good way to group cards to respond
    - could be you select cards and then push shift enter/ the button to make argument right
    - how does this get saved
- both shift enter and enter can navigate and make new boxes at any pace, alt enter for making a box above can navigate them fast but cant make them fast instead it seemingly waits for the animation to finish
- simple editable title for flow, put it above the tabscroll bit with the list of flows, maybe make the font size a litle larger for the title, and make it white with a placeholder text "new flow" so you know its a title, and make all of that save and syncronize and stuff, make file downloads have that name by default

## dont work on yet
- fix save button having save shortcut which doesnt work on zen because control s is compact mode, ensure the shortcut is actually implemented? im not sure it is
- set folder for flows to save at persistantly using filesystem api in chrome... ugh it sux this wont work in firefox, some way to work around this?
- Extemp debate preset