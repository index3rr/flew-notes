# panels fork!!!

we should be upgrading the users settings (not that anyone is using this right now but its good practice for the future!) such that side notes users have the right panel set to have the notes

## add features:
flow library should be merged in from the 1.3 branch or main (we need to merge in from main anyways for tests and updated stuff) and then there should be a flow library panel which is only visible when the flow library is not already Fullscreen, so you can manage your flows but also drag flow pages from other flows into this flow Collab panel to write messages to your partner which get there in the form of notifications i think all panels should be able to have 5 options off left right left-collapsed right-collapsed so basically, the left and right would be normal, except for the timer panel which would no longer be expand and collapsable the collapsed ones would be icons like how the timer panel currently works, icons all in one row at the bottom of the left or right panel and you can click them to expand them, i dont know if it should be one at a time orrr like what
star args to keep them in a panel i think this should be implemented like the strikethrough feature except obviously it adds a star and puts that argument in the panel (this would be useful for cross examination, whenever ur opponent says something a little stupid you star it and maybe you can have a little note section underneath each starred argument in that panel to write a question)
figure out if when this is running on netlify if you can see the contents of a speechdrop (speechdrop.net) and if so, add a panel with the contents of whatever speechdrop code you type so you can download them
remember youre on nix so if you wanna install some headless browser to mess with this stuff you NEED to put it in the shell.nix dont fuck with my nix-env ok
### transcript panel
local transcription with some local model, online is expensive (probably)
uses opposing speechdoc and catches things they say that arent in the doc IF speechdrop integration is being used, and tags n stuff (small story, at state i went against the winning team, only round in prelims i lost, they went for 5 minutes of santa is real and outweighs everything in 2ar and it wasnt in their speechdoc when they mentioned it first so it was dropped in the 1nc... ugh.)
automatically start timer when opponent begins speaking from their doc, i think whenever timers end it should scroll to the next one, not start it but just select the next one, the pacing settings section should be a timer settings section and include if this will happen


## bugs!

- if you have the new tabs thing on the right, when you refresh/dont have a flow group or whatever open you cant make a new one. i think the fix is just show the right panel at all times, not just when you are on the flow page, maybe making sure the notes panel is non-writable and has placeholder greyed out text "Notes are not editable when a flow is not open"
- the timer should go at the bottom in all instances, not between the list of flows and the notes doc