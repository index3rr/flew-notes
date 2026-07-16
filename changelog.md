# 1.2 changes

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

# Planned
- Undo deleting flow
- star args to keep them in a new window that is toggleable (for crossx basically)
- Actually dockable re-organizable windows like godot does would be good for that
- MAKE IT WORK OFFLINE
    - PWA
    - How does gmail/docs do it? you cant install PWAs everywhere..  
- Theming stuff:
    - Transparency
    - Image background
    - More default themes that are actually good
- Extemp debate preset, maybe an editor to customize 
- MAKE FUN MODE NOT SAVE
- when focus changes, it shouldnt just scroll into frame, it should make sure its not too close to the edge of the window
- headers within flows? for contention markers in LD which i am previously doing with a blank cell
- Transcript would be very nice
    - local transcription? i cant afford anything else, but would it run like shit?
    - Perhaps it highlights words that are not from the opponents speechdoc (small story, at state i went against the winning team, only round in prelims i lost, they went for 5 minutes of santa in 2ar and it wasnt in their speechdoc ever. ugh.)
- Unresponded arg count - allow you time to think of response when pacing, show you next unresponded arg in pacing component
- CONNECTIONS: Control K, the link shortcut, in a cell to connect parts of flow to other parts
    - xapp can be easily explained by clicking on it and going to that bit of the flow on a different page
    - i think you should be able to edit a link visually
    - make those links availible in notesdoc
- a good way to group cards to respond
    - could be you select cards and then push shift enter

Okay, so cardmirror exists, whereas it didnt previously, which means i no longer see any need to turn this into a speechdoc creation program. however:
## how could integration with cardmirror work?
- if we can make a communication system (web server running on cardmirror desktop? ugh i really wish it would work with just tabs though... and i dont want to fork cardmirror):
    - click on cards to go to them in the speech
    - when you want to read a card from your speechdoc and have pacing enabled it will automatically determine length based on cm settings about wpm n stuff
    - When writing a speech in flows if you @ (connect) a card it will add it to ur cardmirror speechdoc?
    - automatically put your latest speechdoc in the notes doc, invisified mode !
    - very big question though: neither program is keeping track of what speech the round is on really, sooo how do we coordinate stuff between them?
- cmir imports turn tags into preflows
- for my own usage i would probably make it so it self-promos flew + cmirror in speechdocs whenever you use it obviously not by default

# Known issues
- enabled pacing setting does not update without a refresh
