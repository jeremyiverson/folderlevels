/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. 
 * 
 * Copyright 2013 Jeremy Iverson.
*/

var FolderLevels =
{
    getPrefs: function()
    {
        var prefs = Components.classes["@mozilla.org/preferences-service;1"]
            .getService(Components.interfaces.nsIPrefService)
            .getBranch("extensions.folderlevels.");
        prefs.QueryInterface(Components.interfaces.nsIPrefBranch2);

        return prefs;
    },

    init: function()
    {
        window.removeEventListener("load", FolderLevels.init, false);

        // Watch for the View-Folder Level menu being displayed
        var viewFolderLevel = document.getElementById("currentFolderLevelPopup");
        viewFolderLevel.addEventListener("popupshowing", FolderLevels.onViewFolderLevelsShowing, false);        

        // Watch for the "Folder Level" context menu in the folder menu being displayed,
        // and for commands coming from the menu.
        var elm = document.getElementById("folderLevelPopup");
        elm.addEventListener("popupshowing", FolderLevels.onPopupShowing, false);
        elm.addEventListener("command", FolderLevels.setFolderLevel, false);

        // Watch for new mail, so we can update which folders are displayed if
        // only unread folders are currently displayed.
        var notificationService =
            Components.classes["@mozilla.org/messenger/msgnotificationservice;1"]
                .getService(Components.interfaces.nsIMsgFolderNotificationService);
        notificationService.addListener(newMailListener, notificationService.msgAdded);
    },

    // Showing the View-Folder Levels popup menu
    onViewFolderLevelsShowing: function(event)
    {
        var prefs = FolderLevels.getPrefs();

        // Set the selected folder level.
        var currentLevel = prefs.getIntPref("currentLevel");
        var selectedLevel = document.getElementById("currentlevel-" + currentLevel);
        selectedLevel.setAttribute("checked", true);

        // Set whether only unread folders are displayed.
        var isUnreadOnly = prefs.getBoolPref("onlyUnread");
        if (isUnreadOnly)
        {
            document.getElementById("folderlevels-unreadOnly").setAttribute("checked", true);
        }
    },

    // Showing the context menu for a folder in the folder pane
    onPopupShowing: function(event)
    {
        // Grab the selected folder and its current level.
        var selectedFolders = gFolderTreeView.getSelectedFolders();
        var level = selectedFolders[0].getStringProperty("folderLevel");

        if (level === "")
        {
            // If no level is set, select the None menu item.
            document.getElementById("folderlevel-none").setAttribute("checked", true);
        }
        else
        {
            // Select the appropriate menu item for the selected level.
            var selectedLevel = document.getElementById("folderlevel-" + level);
            selectedLevel.setAttribute("checked", true);
        }

    },

    // Set the level of folders that should be displayed.
    setCurrentFolderLevel: function(level)
    {
        var prefs = FolderLevels.getPrefs();
        prefs.setIntPref("currentLevel", level);
        this.refreshFolderView();
    },

    // Toggle whether only unread folders should be displayed.
    setOnlyUnread: function()
    {
        var prefs = FolderLevels.getPrefs();

        var currentValue = prefs.getBoolPref("onlyUnread");
        prefs.setBoolPref("onlyUnread", !currentValue);

        this.refreshFolderView();
    },

    // Event listener for the folder pane's context menu
    setFolderLevel: function(event)
    {
        var id = event.target.id;

        var folderLevel = event.target.value;

        // Set the chosen level for all selected folders.
        var folders = gFolderTreeView.getSelectedFolders();
        for each (var folder in folders) {
            folder.setStringProperty("folderLevel", folderLevel)
        }
    },

    // Set the active folder mode to the levels mode, and recalculate
    // which folders should be displayed.
    refreshFolderView: function()
    {
        gFolderTreeView.mode = "levels";
        gFolderTreeView._rebuild();

        // Make sure the mode is selected in the View-Folders menu.
        document.getElementById("viewFoldersFolderLevels").setAttribute("checked", true);
    },
};

// Implements a custom folder mode.
let levelsMode =
{
    __proto__: IFolderTreeMode,

    // Get the level of the specified folder.
    _getFolderLevel: function levelMode_getLevel(folder)
    {
        if (folder) {
            let level = folder.getStringProperty("folderLevel");
            return level == null ? "" : level;
        }
        return "";
    },

    // Determine which folders should be displayed, based on the
    // level of each folder and the currently selected display level.
    generateMap: function levelMode_generateMap(ftv)
    {
        var prefs = FolderLevels.getPrefs();
        var currentLevel = prefs.getIntPref("currentLevel");
        var onlyUnread = prefs.getBoolPref("onlyUnread");

        const outFolderFlagMask = nsMsgFolderFlags.SentMail | nsMsgFolderFlags.Drafts | nsMsgFolderFlags.Queue | nsMsgFolderFlags.Templates;
        let map = [];

        // Go through each folder and determine whether it should be displayed.
        for each (let folder in ftv._enumerateFolders)
        {
            let folderLevel = this._getFolderLevel(folder);

            // Is this folder's level acceptable based on the currently selected level?
            let isFolderOk = folderLevel !== "" && folderLevel <= currentLevel;

            // If only unread folders should be displayed, check to see if
            // this folder is a match.
            if (isFolderOk && onlyUnread)
            {
                isFolderOk = (!folder.isSpecialFolder(outFolderFlagMask, true) &&
                       (!folder.isServer && folder.getNumUnread(false) > 0));
            }

            // Show this folder.
            if (isFolderOk)
            {
                map.push(new ftvItem(folder));
            }
        }

        // No children in this view. Just a flat list.
        for each (let folder in map)
        {
            folder.__defineGetter__("children", function() []);
        }

        sortFolderItems(map);

        return map;
    },

    getParentOfFolder: function(folder)
    {
        return folder.parent;
    },

};

// Refresh the view when new mail arrives, in case only unread folders are being displayed.
var newMailListener =
{
    msgAdded: function(item)
    {
        if (!item.isRead && gFolderTreeView.mode === "levels")
        {
            FolderLevels.refreshFolderView();
        }
    }
}

// Register the folder mode.
gFolderTreeView.registerFolderTreeMode("levels", levelsMode, "Levels");

// Initialize the addon on startup.
window.addEventListener("load", FolderLevels.init, false);


function log(msg) {
    var consoleService = Components.classes["@mozilla.org/consoleservice;1"]
        .getService(Components.interfaces.nsIConsoleService);
    consoleService.logStringMessage(msg);
}
