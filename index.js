var {ToggleButton} = require('sdk/ui/button/toggle');
var {Cu, Ci} = require('chrome');
Cu.import('resource://gre/modules/ctypes.jsm');
Cu.import('resource://gre/modules/osfile.jsm');

var buttonActive = false;

var button = ToggleButton({
  id: 'stay-on-top',
  label: 'Stay On Top',
  icon: {
      '16': './pin-16.png',
      '32': './pin-32.png',
      '64': './pin-64.png',
      '92': './pin-92.png',
      '128': './pin-128.png'
  },
  onChange: handleClick
});

updateButton();

function updateButton(){
  var icon = "pin";
  var label = "Stay on Top"
  if(buttonActive){
    icon = "pin-active";
    label = "Stay on Top (Active)"
  }

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

function handleClick(state){
  buttonActive = !buttonActive;

  updateButton();

  sot_makeOnTop(buttonActive);
}

function getActiveWindowHandle() {
  var win = Services.wm.getMostRecentWindow(null);
  if (!win) {
    return null;
  } else {
    return getNativeHandlePtrStr(win);
  }
}

var ostypes;
function initCtypes() {
    switch (OS.Constants.Sys.Name.toLowerCase()) {
        case 'darwin': // mac
                ostypes.lib = {};
                ostypes.lib.objc = ctypes.open(ctypes.libraryName('objc'));
                ostypes.lib.coregraphics = ctypes.open('/System/Library/Frameworks/CoreGraphics.framework/CoreGraphics');

                ostypes.TYPE = {};
                ostypes.TYPE.id = ctypes.StructType("objc_object").ptr;
                ostypes.TYPE.SEL = ctypes.StructType("objc_selector").ptr;
                ostypes.TYPE.CGWindowLevel = ctypes.int32_t;
                ostypes.TYPE.CGWindowLevelKey = ctypes.int32_t;
                ostypes.TYPE.NSInteger = OS.Constants.Sys.bits == 64 ? ctypes.long: ctypes.int;
                ostypes.TYPE.NSWindow = ctypes.StructType("NSWindow").ptr;

                ostypes.CONST = {};
                ostypes.CONST.kCGMainMenuWindowLevelKey = 8;
                ostypes.CONST.kCGNormalWindowLevelKey = 4;

                ostypes.API = {};
                ostypes.API.CGWindowLevelForKey = ostypes.lib.coregraphics.declare('CGWindowLevelForKey', ctypes.default_abi, ostypes.TYPE.CGWindowLevel, ostypes.TYPE.CGWindowLevelKey);
                ostypes.API.objc_getClass = ostypes.lib.objc.declare("objc_getClass",
                                                 ctypes.default_abi,
                                                 ostypes.TYPE.id,
                                                 ctypes.char.ptr);
                ostypes.API.sel_registerName = ostypes.lib.objc.declare("sel_registerName",
                                                    ctypes.default_abi,
                                                    ostypes.TYPE.SEL,
                                                    ctypes.char.ptr);
                ostypes.API.objc_msgSend = ostypes.lib.objc.declare("objc_msgSend",
                                                ctypes.default_abi,
                                                ostypes.TYPE.id,
                                                ostypes.TYPE.id,
                                                ostypes.TYPE.SEL,
                                                "..."); // variadic, so all values MUST be wrapped in CType, like passing `8` wont work, must pass `NSInteger(8)`
            break;
        case 'winnt': // windows
                ostypes.lib = {};
                ostypes.lib.user32 = ctypes.open('user32');

                ostypes.TYPE = {};
                ostypes.TYPE.HWND = ctypes.void_t.ptr;

                ostypes.CONST = {};
                ostypes.CONST.HWND_TOPMOST = -1;
                ostypes.CONST.HWND_NOTOPMOST = -2;
                ostypes.CONST.SWP_NOMOVE__SWP_NOSIZE__SWP_NOACTIVATE = 19;

                ostypes.API = {};
                ostypes.API.SetWindowPos = ostypes.lib.user32.declare("SetWindowPos",
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
        default:
            // assume linux/unix/solaris, they all use GTK

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
            ostypes.API.gtk_window_set_keep_above = ostypes.lib.gtk.delcare('gtk_window_set_keep_above', ctypes.default_abi, ctypes.void_t, ostypes.TYPE.GtkWindow.ptr, ostypes.TYPE.gboolean); // https://developer.gnome.org/gtk3/stable/GtkWindow.html#gtk-window-set-keep-above
            ostypes.API.gdk_window_get_user_data = ostypes.lib.gdk.declare('gdk_window_get_user_data', ctypes.default_abi, ctypes.void_t, ostypes.TYPE.GdkWindow.ptr, ostypes.TYPE.gpointer); // https://developer.gnome.org/gdk3/stable/gdk3-Windows.html#gdk-window-get-user-data

            ostypes.HELPER = {};
            ostypes.HELPER.getGtkWindowFromGdkWindow = function(aGdkWindowPtr) {
                var gptr = ostypes.TYPE.gpointer();
                ostypes.API.gdk_window_get_user_data(aGdkWindowPtr, gptr.address());
                return ctypes.cast(gptr, ostypes.TYPE.GtkWindow.ptr);
            };
    }
}

function uninitCtypes() {
    if (ostypes) {
        for (var lib of ostypes.lib) {
            lib.close();
        }
    }
}

exports.onUnload = function (reason) {
    uninitCtypes();
};

const TOP = 'TOP';
const NORMAL = 'NORMAL';

var gWinState = {}; // key is result of getActiveWindowHandle
function sot_makeOnTop(onTop){

  var win = getActiveWindowHandle(); // returns a string to ptr of the window on all platforms

  if (!win) {
      // no active window
      return false;
  }

  switch (OS.Constants.Sys.Name.toLowerCase()) {
    case 'darwin':

            var win_as_nswindow = ostypes.TYPE.NSWindow(ctypes.UInt64(win));

            if ('NSMainMenuWindowLevel' in ostypes.CONST) {
                ostypes.CONST.NSMainMenuWindowLevel = ostypes.API.CGWindowLevelForKey(ostypes.CONST.kCGMainMenuWindowLevelKey);
                ostypes.CONST.NSNormalWindowLevel = ostypes.API.CGWindowLevelForKey(ostypes.CONST.kCGNormalWindowLevelKey);
            }

            var setLevel = ostypes.API.sel_registerName('setLevel:'); // https://developer.apple.com/library/mac/documentation/Cocoa/Reference/ApplicationKit/Classes/NSWindow_Class/#//apple_ref/occ/instp/NSWindow/level

            var newLevel;
            if (!gWinState[win] || gWinState[win] == NORMAL) {
                gWinState[win] = TOP;
                newLevel = ostypes.TYPE.NSInteger(ostypes.CONST.NSMainMenuWindowLevel);
            } else {
                gWinState[win] = NORMAL;
                delete gWinState[win];
                newLevel = ostypes.TYPE.NSInteger(ostypes.CONST.NSNormalWindowLevel);
            }

            var rez_set = ostypes.API.objc_msgSend(win_as_nswindow, setLevel, newLevel);
            console.log('rez_set:', rez_set.toString());
            if (rez_set.isNull()) {
                // failed
            }

        break;
    case 'winnt':

            var win_as_hwnd = ostypes.TYPE.HWND(ctypes.UInt64(win));

            var hWndInsertAfter;
            if (!gWinState[win] || gWinState[win] == NORMAL) {
                gWinState[win] = TOP;
                hWndInsertAfter = ostypes.CONST.HWND_TOPMOST;
            } else {
                gWinState[win] = NORMAL;
                delete gWinState[win];
                hWndInsertAfter = ostypes.CONST.HWND_NOTOPMOST;
            }

          ostypes.API.SetWindowPos(win_as_hwnd, hWndInsertAfter, 0, 0, 0, 0, ostypes.CONST.SWP_NOMOVE__SWP_NOSIZE__SWP_NOACTIVATE);

        break;
    default:
        // assume gtk

        var win_as_gdkwin = ostypes.TYPE.GdkWindow.ptr(ctypes.UInt64(win));

        var win_as_gtkwin = ostypes.HELPER.getGtkWindowFromGdkWindow(win_as_gdkwin);

        var gbool_true = 1;
        var gbool_false = 0;

        var newLevel;
        if (!gWinState[win] || gWinState[win] == NORMAL) {
            gWinState[win] = TOP;
            newLevel = gbool_true;
        } else {
            gWinState[win] = NORMAL;
            delete gWinState[win];
            newLevel = gbool_false;
        }

        ostypes.API.gtk_window_set_keep_above(win_as_gtkwin, newLevel); // returns void so it will be undefined, no use testing it
    }

}

function getNativeHandlePtrStr(aDOMWindow) {
	var aDOMBaseWindow = aDOMWindow.QueryInterface(Ci.nsIInterfaceRequestor)
								   .getInterface(Ci.nsIWebNavigation)
								   .QueryInterface(Ci.nsIDocShellTreeItem)
								   .treeOwner
								   .QueryInterface(Ci.nsIInterfaceRequestor)
								   .getInterface(Ci.nsIBaseWindow);
	return aDOMBaseWindow.nativeHandle;
}
