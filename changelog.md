# panels fork!!!

we should be upgrading the users settings (not that anyone is using this right now but its good practice for the future!) such that side notes users have the right panel set to have the notes

## add features:
star args to keep them in a panel i think this should be implemented like the strikethrough feature except obviously it adds a star and puts that argument in the panel (this would be useful for cross examination, whenever ur opponent says something a little stupid you star it and maybe you can have a little note section underneath each starred argument in that panel to write a question)
figure out if when this is running on netlify if you can see the contents of a speechdrop (speechdrop.net) and if so, add a panel with the contents of whatever speechdrop code you type so you can download them
remember youre on nix so if you wanna install some headless browser to mess with this stuff you NEED to put it in the shell.nix dont fuck with my nix-env ok

## bugs!

- if you have the new tabs thing on the right, when you refresh/dont have a flow group or whatever open you cant make a new one. i think the fix is just show the right panel at all times, not just when you are on the flow page, maybe making sure the notes panel is non-writable and has placeholder greyed out text "Notes are not editable when a flow is not open"
- the timer should go at the bottom in all instances, not between the list of flows and the notes doc