# Two-person policy workflow

This review follows two partners on one policy team: one may be flowing or speaking while the other finds evidence, prepares blocks, and tracks what needs an answer. The existing policy grid supplies 1AC → 1NC → 2AC → 2NC/1NR → 1AR → 2NR → 2AR; the negative flow starts at 1NC.

| Round stage               | Partner workflow                                                                   | Controls added or improved                                                                                                                                                          |
| ------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Setup                     | Share the round and SpeechDrop code, then connect each person's native CardMirror. | Compact CardMirror connection controls; instructions live under Plugin setup.                                                                                                       |
| Opponent sends a speech   | Download the document and read it while the other person flows.                    | DOCX downloads can also open an unsaved copy in CardMirror. Bytes are fetched once and streamed directly to the companion. The option can be switched off.                          |
| Constructive prep         | One person checks the case while the other cuts blocks for another position.       | Pin a receiving page and speech column. Imports go there without switching the page being viewed or stealing the typing cursor.                                                     |
| Answering arguments       | Attach a response to a particular argument instead of adding an unrelated claim.   | Select that argument and run Send to Flew as responses. It uses the next column, preserves existing responses, and remains one undo step.                                           |
| CX and the negative block | Divide coverage and flag an argument that needs attention.                         | Send selected argument in Collaboration adds a Show argument action. It unfolds hidden ancestors and becomes unavailable after deletion.                                            |
| Rebuttal prep             | Reduce the flow to the arguments that matter and return to their evidence.         | Copy argument text supplies plain text for a speech document, including pending edits. Source controls show concise, grouped references; starred navigation also unfolds responses. |
| Transcription review      | Compare the spoken speech with the document selected for that speech.              | The comparison document is named, room changes cancel stale loads, and manual edits clear the old filename label.                                                                   |

Downloading a document does not start a timer or replace the transcript comparison. Rooms contain both teams' files, and documents often arrive during CX or prep, so those actions remain explicit.

CardMirror's current plugin API does not expose opening bytes into an existing workspace slot. The native preload supports a separate document window, preserving currently open work. With developer file loading, plugin commands are window-local: load and pair the companion in a document's window to send directly from that window. This integration does not patch CardMirror or install a plugin globally.

## Bugs addressed

- Reusing a blank cell could erase its starred note or formatting. Annotated and structural cells are preserved.
- Copying an argument or attaching it to a partner message could use text that had not been flushed from the editor. Both actions resolve pending edits first.
- Switching between starred notes could replace an unfinished pending edit. Each note flushes the previous edit before starting its own batch.
- A comparison started in an old room could finish after a room switch. Requests are cancelled and late results ignored.
- SpeechDrop requests and sockets could outlive a removed panel; overlapping refreshes could overwrite a newer list. Cleanup aborts requests, invalidates callbacks, and coalesces pushed refreshes.
- A connection close could notify observers twice. Peer teardown now reports once, and expired queued RPC work is not sent later.
- Invalid clipboard source metadata could create a flow that could not be reopened. Only validated source metadata is retained on paste.

All flow edits use the existing action/history/sharing pipeline. File transfer uses bounded chunks and a 50 MB cap, can be cancelled, and adds no CardMirror relay polling.
