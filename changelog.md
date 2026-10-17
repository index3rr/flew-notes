# Panels update

- [x] Merge main, including its tests, flow library, persistence fixes, and AGENTS.md instructions.
- [x] Optional flow library panel (off by default), showing a placeholder while the full library is visible. Flow names and page labels use the main library styling; click a page to import it or drag it into the current flow.
- [x] Local transcript panel using Whisper in a browser worker. Includes transcript export, editable tags, and phrase comparison against pasted or SpeechDrop DOCX/TXT documents. Outside-document flags are suggestions to review.
- [x] Optional speech timer start when transcription first matches the opponent document; select and scroll to the next speech when time expires, leaving it paused. Controls live under Timers settings.
- [x] Migrate older settings, preserving visible side notes on the right and hidden side notes as off.
- [x] All panels support Off, Left, Right, Left collapsed, and Right collapsed. Notes, Flow Library, Starred arguments, and Collaboration keep their positions and shrink to just their names without an open flow; hover for the explanation. Collapsed panels share a bottom icon row; one opens per side, and closing it preserves its state. Regular timer panels stay expanded.
- [x] Collaboration messages arrive as dismissible notifications, with conversation history in the panel. SpeechDrop codes synchronize on connection and edits. When sharing is off, the panel offers an Enable collaboration button.

- [x] Panel dividers only separate visible panels; collapsed tabs no longer add a stray line above SpeechDrop.

- [x] Star, delete, cross-out, and popup-close tooltips show the matching shortcuts. Help includes selection, paste, timer fields, and document titles, with matching key labels.

# Upstream changelog and roadmap

The following is retained from main for reference.

# 1.3.0 changes
## persistancy update
- chrome lets you set a folder for autosaving flows
- firefox import folder list
- flow titles
- autosave and saving now work frfrfr
- more tests....

# 1.2.2 changes
- fixed collaboration
- qr code based connecting to rooms (side note: insane absurdly small qr codes for what they are)
- sharing icon now shows when you are offline
- lots of tests added
- fix cross browser sharing (firefox-chrome, safari-firefox, etc.)
- fix cross network sharing

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

- Panels:
    - work being done on panels branch
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

- history changes
    - make it so you can undo deleting a flow page
    - complete google docs style version history


## Small features/fixes (..X releases)


- evaluate if switching to the AGPL is possible, if so do it,  do it  (gpl kind of does not work for this project to ensure free-ness since its served over web)

- fix save button having save shortcut which doesnt work on zen because control s is compact mode, and on chrome it doesnt work because its captured by saving the html of the page, google docs can capture control s just fine. you should be able to as well

## dont work on yet


- Extemp debate preset
- a good way to group cards to respond
    - could be you select cards and then push shift enter/ the button to make argument right
    - how does this get saved
