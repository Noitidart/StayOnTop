/*
 * Stay On Top
 * Sets a window to the topmost position
 *
 * License: MIT
 * Author: Kyle Ramey
 */

var system = require("sdk/system");
var {Hotkey} = require('sdk/hotkeys');
var buttons = require('sdk/ui/button/action');
var {Cu, Ci} = require('chrome');
Cu.import('resource://gre/modules/ctypes.jsm');
Cu.import("resource://gre/modules/Services.jsm");


var buttonActive = false;
var platform;
var button;
var ostypes = {};
var toggleHotkey;
var keyCombo;

var key = '`';

/**
 * Runs at installation/program start
 * @param options
 * @param callbacks
 */
exports.main = function (options, callbacks) {
    // Determine OS
    platform = system.platform;

    if (platform == 'darwin')
        keyCombo = '(Control + ' + key + ' )';
    else
        keyCombo = '(Ctrl + ' + key + ' )';

    // Init button
    button = buttons.ActionButton({
        id: 'stay-on-top',
        label: 'Stay On Top ' + keyCombo,
        icon: {
            '16': './pin-16.png',
            '32': './pin-32.png',
            '64': './pin-64.png',
            '92': './pin-92.png',
            '128': './pin-128.png'
        },
        onClick: handleClick
    });

    windowListener.register();

    sot_initCtypes();
};

var windowListener = {
	//DO NOT EDIT HERE
	onOpenWindow: function (aXULWindow) {
		// Wait for the window to finish loading
		var aDOMWindow = aXULWindow.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindow);
		aDOMWindow.addEventListener('load', function () {
			aDOMWindow.removeEventListener('load', arguments.callee, false);
			windowListener.loadIntoWindow(aDOMWindow);
		}, false);
	},
	onCloseWindow: function (aXULWindow) {},
	onWindowTitleChange: function (aXULWindow, aNewTitle) {},
	register: function () {

		// Load into any existing windows
		let DOMWindows = Services.wm.getEnumerator(null);
		while (DOMWindows.hasMoreElements()) {
			let aDOMWindow = DOMWindows.getNext();
			if (aDOMWindow.document.readyState == 'complete') { //on startup `aDOMWindow.document.readyState` is `uninitialized`
				windowListener.loadIntoWindow(aDOMWindow);
			} else {
				aDOMWindow.addEventListener('load', function () {
					aDOMWindow.removeEventListener('load', arguments.callee, false);
					windowListener.loadIntoWindow(aDOMWindow);
				}, false);
			}
		}
		// Listen to new windows
		Services.wm.addListener(windowListener);
	},
	unregister: function () {
		// Unload from any existing windows
		let DOMWindows = Services.wm.getEnumerator(null);
		while (DOMWindows.hasMoreElements()) {
			let aDOMWindow = DOMWindows.getNext();
			windowListener.unloadFromWindow(aDOMWindow);
		}
		/*
		for (var u in unloaders) {
			unloaders[u]();
		}
		*/
		//Stop listening so future added windows dont get this attached
		Services.wm.removeListener(windowListener);
	},
	//END - DO NOT EDIT HERE
	loadIntoWindow: function (aDOMWindow) {
		if (!aDOMWindow) { return }

            aDOMWindow.addEventListener('keyup', hotkeyPress, false);
	},
	unloadFromWindow: function (aDOMWindow) {
		if (!aDOMWindow) { return }

        aDOMWindow.removeEventListener('keyup', hotkeyPress, false);
	}
};

function hotkeyPress(e) {
    console.error('in keypress, e.key:', e.key);
    if (e.key.toLowerCase() == key) {
        handleClick(null);
    }
}

/**
 * Runs at uninstallation/program end
 * @param reason
 */
exports.unload = function (reason) {
    if (ostypes) {
        for (var lib of ostypes.lib) {
            lib.close();
        }
    }

    windowListener.unregister();
};

/**
 * Handles icon and label changes
 */
function updateButton() {
    // Defaults
    var icon = 'pin';
    var label = 'Stay on Top ' + keyCombo;

    // changed if button is active
    if (buttonActive) {
        icon = 'pin-active';
        label = 'Stay on Top [Active] ' + keyCombo;
    }

    // set the button label and icon
    button.state('window', {
        label: label,
        icon: {
            '16': './' + icon + '-16.png',
            '32': './' + icon + '-32.png',
            '64': './' + icon + '-64.png',
            '92': './' + icon + '-92.png',
            '128': './' + icon + '-128.png'
        }
    });
}

/**
 * runs when button is pressed
 * @param state
 */
function handleClick(state) {
    // change button status
    buttonActive = !buttonActive;

    try {
        if (!sot_makeOnTop(buttonActive)) {
            // add a badge and reset boolean since we couldn't set the window state
            button.badge = '!';
            button.label = 'Stay on Top [Error]';
            buttonActive = !buttonActive;
            return;
        } else {
            button.badge = null;
        }

        // update the button's state
        updateButton();

    } catch (e) {
        // add a badge and reset boolean since we couldn't set the window state
        console.error(e);
        button.badge = '!';
        button.label = 'Stay on Top [Error]';
        buttonActive = !buttonActive;
    }


}

/**
 * Cross-platform retreival of active window
 * @returns pointer to the active window handle or null
 */
function sot_getActiveWindowHandle() {
    var window = Services.wm.getMostRecentWindow(null);
    if (window)
        return sot_getNativeHandlePtrStr(window);
    return null;
}

/**
 * Initialize all the libraries, types, constants, and functions used later
 */
function sot_initCtypes() {
    switch (platform) {
        case 'winnt': // Windows
            ostypes.lib = {};
            ostypes.lib.user32 = ctypes.open('user32');

            ostypes.TYPE = {};
            ostypes.TYPE.HWND = ctypes.void_t.ptr;

            ostypes.CONST = {};
            ostypes.CONST.HWND_TOPMOST = -1;
            ostypes.CONST.HWND_NOTOPMOST = -2;
            ostypes.CONST.SWP_NOMOVE__SWP_NOSIZE__SWP_NOACTIVATE = 19;

            ostypes.API = {};
            ostypes.API.SetWindowPos = ostypes.lib.user32.declare('SetWindowPos',
                ctypes.winapi_abi,
                ctypes.bool,
                ostypes.TYPE.HWND,
                ctypes.int32_t,
                ctypes.int32_t,
                ctypes.int32_t,
                ctypes.int32_t,
                ctypes.int32_t,
                ctypes.uint32_t);
            break;
        case 'darwin': // Mac OSX
            ostypes.lib = {};
            ostypes.lib.objc = ctypes.open(ctypes.libraryName('objc'));
            ostypes.lib.coregraphics = ctypes.open('/System/Library/Frameworks/CoreGraphics.framework/CoreGraphics');

            ostypes.TYPE = {};
            ostypes.TYPE.objc_object = ctypes.StructType('objc_object').ptr;
            ostypes.TYPE.SEL = ctypes.StructType('objc_selector').ptr;
            ostypes.TYPE.CGWindowLevel = ctypes.int32_t;
            ostypes.TYPE.CGWindowLevelKey = ctypes.int32_t;
            ostypes.TYPE.NSWindow = ctypes.StructType('NSWindow').ptr;

            ostypes.CONST = {};

            // set correct number size based on architecture
            if (ctypes.voidptr_t.size == 4 /* 32-bit */) {
                ostypes.TYPE.NSInteger = ctypes.int;
            } else if (ctypes.voidptr_t.size == 8 /* 64-bit */) {
                ostypes.TYPE.NSInteger = ctypes.long;
            }

            ostypes.API = {};
            ostypes.API.CGWindowLevelForKey = ostypes.lib.coregraphics.declare('CGWindowLevelForKey',
                ctypes.default_abi,
                ostypes.TYPE.CGWindowLevel,
                ostypes.TYPE.CGWindowLevelKey);
            ostypes.API.objc_getClass = ostypes.lib.objc.declare('objc_getClass',
                ctypes.default_abi,
                ostypes.TYPE.objc_object,
                ctypes.char.ptr);
            ostypes.API.sel_registerName = ostypes.lib.objc.declare('sel_registerName',
                ctypes.default_abi,
                ostypes.TYPE.SEL,
                ctypes.char.ptr);
            ostypes.API.objc_msgSend = ostypes.lib.objc.declare('objc_msgSend',
                ctypes.default_abi,
                ostypes.TYPE.objc_object,
                ostypes.TYPE.objc_object,
                ostypes.TYPE.SEL,
                '...');
            break;

        default: // *nix

            var version = Services.appinfo.version;
            var gdk2 = 'libgdk-x11-2.0.so.0';
            var gdk3 = 'libgdk-3.so.0';
            var gtk2 = 'libgtk-x11-2.0.so.0';
            var gtk3 = 'libgtk-3.so.0';

            ostypes.lib = {};
            ostypes.lib.gtk = parseInt(version) <= 45 ? ctypes.open(gtk2) : ctypes.open(gtk3);
            ostypes.lib.gdk = parseInt(version) <= 45 ? ctypes.open(gdk2) : ctypes.open(gdk3);

            ostypes.TYPE = {};
            ostypes.TYPE.GdkWindow = ctypes.StructType('GdkWindow');
            ostypes.TYPE.GtkWindow = ctypes.StructType('GtkWindow');
            ostypes.TYPE.gint = ctypes.int;
            ostypes.TYPE.gpointer = ctypes.voidptr_t;

            // level 2 types - depend on level 1 types
            ostypes.TYPE.gboolean = ostypes.TYPE.gint;

            ostypes.CONST = {};

            ostypes.API = {};
            // https://developer.gnome.org/gtk3/stable/GtkWindow.html#gtk-window-set-keep-above
            ostypes.API.gtk_window_set_keep_above = ostypes.lib.gtk.declare('gtk_window_set_keep_above', ctypes.default_abi, ctypes.void_t, ostypes.TYPE.GtkWindow.ptr, ostypes.TYPE.gboolean);
            // https://developer.gnome.org/gdk3/stable/gdk3-Windows.html#gdk-window-get-user-data
            ostypes.API.gdk_window_get_user_data = ostypes.lib.gdk.declare('gdk_window_get_user_data', ctypes.default_abi, ctypes.void_t, ostypes.TYPE.GdkWindow.ptr, ostypes.TYPE.gpointer);

            ostypes.HELPER = {};
            ostypes.HELPER.getGtkWindowFromGdkWindow = function (aGdkWindowPtr) {
                var gptr = ostypes.TYPE.gpointer();
                ostypes.API.gdk_window_get_user_data(aGdkWindowPtr, gptr.address());
                return ctypes.cast(gptr, ostypes.TYPE.GtkWindow.ptr);
            };
    }
}

/**
 * Set the window position
 * @param onTop - whether the window should be pinned to top
 * @returns {boolean}
 */
function sot_makeOnTop(onTop) {
    var windowHandle = sot_getActiveWindowHandle();

    if (!windowHandle) {
        console.error('Unable to acquire windowHandle');
        return false;
    }

    switch (platform) {
        case 'winnt':

            var window_hwnd = ostypes.TYPE.HWND(ctypes.UInt64(windowHandle));
            if (onTop) {
                ostypes.API.SetWindowPos(window_hwnd, ostypes.CONST.HWND_TOPMOST, 0, 0, 0, 0, ostypes.CONST.SWP_NOMOVE__SWP_NOSIZE__SWP_NOACTIVATE);
            } else {
                ostypes.API.SetWindowPos(window_hwnd, ostypes.CONST.HWND_NOTOPMOST, 0, 0, 0, 0, ostypes.CONST.SWP_NOMOVE__SWP_NOSIZE__SWP_NOACTIVATE);
            }
            break;
        case 'darwin':

            var window_nswindow = ostypes.TYPE.objc_object(ctypes.UInt64(windowHandle));
            var setLevel = ostypes.API.sel_registerName('setLevel:');

            ostypes.CONST.kCGFloatingWindowLevelKey = 5;
            ostypes.CONST.kCGNormalWindowLevelKey = 4;

            ostypes.CONST.NSFloatingWindowLevel = ostypes.TYPE.objc_object(ostypes.API.CGWindowLevelForKey(ostypes.CONST.kCGFloatingWindowLevelKey));
            ostypes.CONST.NSNormalWindowLevel = ostypes.TYPE.objc_object(ostypes.API.CGWindowLevelForKey(ostypes.CONST.kCGNormalWindowLevelKey));

            // set window level
            if (onTop) {
                ostypes.API.objc_msgSend(window_nswindow, setLevel, ostypes.CONST.NSFloatingWindowLevel);
            } else {
                ostypes.API.objc_msgSend(window_nswindow, setLevel, ostypes.CONST.NSNormalWindowLevel);
            }
            break;
        default:
            // assume gtk

            var win_as_gdkwin = ostypes.TYPE.GdkWindow.ptr(ctypes.UInt64(windowHandle));

            var win_as_gtkwin = ostypes.HELPER.getGtkWindowFromGdkWindow(win_as_gdkwin);

            var gbool_true = 1;
            var gbool_false = 0;

            if (onTop) {
                var newLevel = gbool_true;
            } else {
                var newLevel = gbool_false;
            }

            ostypes.API.gtk_window_set_keep_above(win_as_gtkwin, newLevel); // returns void so it will be undefined, no use testing it
    }
    return true;
}

/**
 * Get handle for the window (cross-platform)
 * @param aDOMWindow
 * @returns {*}
 */
function sot_getNativeHandlePtrStr(aDOMWindow) {
    var aDOMBaseWindow = aDOMWindow.QueryInterface(Ci.nsIInterfaceRequestor)
        .getInterface(Ci.nsIWebNavigation)
        .QueryInterface(Ci.nsIDocShellTreeItem)
        .treeOwner
        .QueryInterface(Ci.nsIInterfaceRequestor)
        .getInterface(Ci.nsIBaseWindow);

    return aDOMBaseWindow.nativeHandle;
}
