/*
 * Stay On Top
 * Sets a window to the topmost position
 * 
 * License: MIT
 * Author: Kyle Ramey
 */

var system = require("sdk/system");
var {ToggleButton} = require('sdk/ui/button/toggle');
var {Cu, Ci} = require('chrome');
Cu.import('resource://gre/modules/ctypes.jsm');
Cu.import("resource://gre/modules/Services.jsm");


var buttonActive = false;
var platform;
var button;
var ostypes = {};

/**
 * Runs at installation/program start
 */
exports.main = function(options, callbacks) {
    // Determine OS
    platform = system.platform;

    // Init button
    button = ToggleButton({
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

    sot_initCtypes();
};

/**
 * Handles icon and label changes
 */
function updateButton() {
    // Defaults
    var icon = "pin";
    var label = "Stay on Top";

    // changed if button is active
    if (buttonActive) {
        icon = "pin-active";
        label = "Stay on Top (Active)"
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
 */
function handleClick(state) {
    // change button status
    buttonActive = !buttonActive;

    sot_makeOnTop(buttonActive);

    // update the button's state
    updateButton();
}

function sot_getActiveWindowHandle(){
    var window = Services.wm.getMostRecentWindow(null);
    if(window)
        return sot_getNativeHandlePtrStr(window);
    return null;
}

function sot_initCtypes(){
    switch(platform){
        case 'winnt':
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
        case 'darwin':
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

        default:
            // to be added
            break;
    }
}

function sot_makeOnTop(onTop){
    var windowHandle = sot_getActiveWindowHandle();

    if(!windowHandle)
        return false;

    switch(platform){
        case 'winnt':

            var window_hwnd = ostypes.TYPE.HWND(ctypes.UInt64(windowHandle));
            if(onTop){
                ostypes.API.SetWindowPos(window_hwnd, ostypes.CONST.HWND_TOPMOST, 0, 0, 0, 0, ostypes.CONST.SWP_NOMOVE__SWP_NOSIZE__SWP_NOACTIVATE);
            }else{
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
            if(onTop) {
                ostypes.API.objc_msgSend(window_nswindow, setLevel, ostypes.CONST.NSFloatingWindowLevel);
            }else{
                ostypes.API.objc_msgSend(window_nswindow, setLevel, ostypes.CONST.NSNormalWindowLevel);
            }
            break;
        default:
            //to be added
            break;
    }
}

function sot_getNativeHandlePtrStr(aDOMWindow){
    var aDOMBaseWindow = aDOMWindow.QueryInterface(Ci.nsIInterfaceRequestor)
        .getInterface(Ci.nsIWebNavigation)
        .QueryInterface(Ci.nsIDocShellTreeItem)
        .treeOwner
        .QueryInterface(Ci.nsIInterfaceRequestor)
        .getInterface(Ci.nsIBaseWindow);

    return aDOMBaseWindow.nativeHandle;
}