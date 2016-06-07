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

var buttonActive = false;
var platform = null;

/**
 * Runs at installation/program start
 */
function main(){
  // Determine OS
  platform = system.platform;

  // Init button
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
}

/**
 * Handles icon and label changes
 */
function updateButton(){
  // Defaults
  var icon = "pin";
  var label = "Stay on Top"

  // changed if button is active
  if(buttonActive){
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
function handleClick(state){
  // change button status
  buttonActive = !buttonActive;
  
  // run the appropriate function for the platform
  if(platform == 'winnt'){
    sot_makeOnTop_win(buttonActive);
  }else if(platform == 'linux'){
    sot_makeOnTop_linux(buttonActive);
  }else if(platform == 'darwin'){
    sot_makeOnTop_mac(buttonActive);
  }

  // update the button's state
  updateButton();
}

/**
 * For Windows Systems
 * @param {bool} onTop - True to place on top, False to return to standard position
 * @return bool - Success
 */
function sot_makeOnTop_win(onTop){
  
  // load user32 library
  var lib = ctypes.open("user32.dll");
  
  // get the current window
  try{
    var ActiveWindow = lib.declare('GetActiveWindow', ctypes.winapi_abi, ctypes.int32_t);
  }catch(e){
    console.error('Could not get active window');
    console.error(e);
    return false;
  }
  
  // Get the function to set window position from user32
  try{
    var SetWindowPos = lib.declare("SetWindowPos",
                                ctypes.winapi_abi,
                                ctypes.bool,
                                ctypes.int32_t,
                                ctypes.int32_t,
                                ctypes.int32_t,
                                ctypes.int32_t,
                                ctypes.int32_t,
                                ctypes.int32_t,
                                ctypes.uint32_t);
  }catch(e){
    console.error('Could not get SetWindowPos call');
    console.error(e);
    return false;
  }
  
  // See https://msdn.microsoft.com/en-us/library/windows/desktop/ms633545(v=vs.85).aspx
  if(onTop){
    //HWND_TOPMOST
    var hWndInsertAfter = -1
  }else{
    //HWND_NOTOPMOST
    var hWndInsertAfter = -2;
  }
  //19 = SWP_NOMOVE, SWP_NOSIZE, SWP_NOACTIVATE
  SetWindowPos(ActiveWindow(), hWndInsertAfter, 0, 0, 0, 0, 19);
  
  lib.close();
}


/**
 * For Linux Systems
 * @param {bool} onTop - True to place on top, False to return to standard position
 * @return bool - Success
 */
function sot_makeOnTop_linux(onTop){

}


/**
 * For OSX Systems
 * @param {bool} onTop - True to place on top, False to return to standard position
 * @return bool - Success
 */
function sot_makeOnTop_mac(onTop){
  let lib = ctypes.open(ctypes.libraryName('objc'));
}