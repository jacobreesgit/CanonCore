- MVP:
- sortering filteing - validated 

- storage quota - validated 
- sync operation - validated 
- batch operation

- empty states - Somse edge cases show blank screens
- bulk operations - Deleting 10 items = 10 context menu clicks - in edit mode

- plex like nav items, e.g. one for tv shows. best way is for items in root/my items to appear as nav items, we could do a "pinned item" system? and do flags for seeding, e.g. tv shows, movies

- continue watching - Playback position is tracked but never surfaced. look at what trakt does for progress across your entire library, then speicfic items and all descendnts. The Progress feature tracks completion across items, (with INCOMPLETE/COMPLETED/SKIPPED states), while Up Next shows the first incomplete item in DFS order to help users quickly find their next task.

- public and explore "item templates" make a copy/fork, you can "add" and it adds all the stuff to your sftp apart from subtitles and media files

- one last look

- None:
- preloading
- Quota Check Script (2.4 admin script)
- Large File Streaming Upload (2.1)
- Conflict Resolution (2.2)
- tmdb makes children
- always see dialog footer. check if this is good ux.
- ask what else plex and jellyfin does
- tags?
- refactor wizard state in add-item-dialog and item-settings-dialog to use useReducer for cleaner state management
- ios: https://github.com/heroui-inc/heroui-native
