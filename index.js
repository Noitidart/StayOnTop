var {ToggleButton} = require('sdk/ui/button/toggle');
var {Cu, Ci} = require('chrome');
Cu.import('resource://gre/modules/ctypes.jsm');

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

function sot_makeOnTop(onTop){
  
  var lib = ctypes.open("user32.dll");
  
  try{
    var ActiveWindow = lib.declare('GetActiveWindow', ctypes.winapi_abi, ctypes.int32_t);
  }catch(e){
    console.log('Could not get active window');
  }
  
  if(ActiveWindow != 0){
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
      console.log('Could not get SetWindowPos call');
      console.error(e);
    }
    
    if(onTop){
      //HWND_TOPMOST
      var hWndInsertAfter = -1
    }else{
      //HWND_NOTOPMOST
      var hWndInsertAfter = -2;
    }
    //19 = SWP_NOMOVE, SWP_NOSIZE, SWP_NOACTIVATE
    SetWindowPos(ActiveWindow(), hWndInsertAfter, 0, 0, 0, 0, 19);
  }
  
  lib.close();
}