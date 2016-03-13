var S4 = require('./s4');
var peripheral = require('ble-cycling-power');
var network = require('./network');
var usb = require('./usb-peripheral');

var mainBle = function(testMode) {
  var ble = new peripheral.BluetoothPeripheral('WaterRower S4');

  if (testMode) {
    var rower = new S4();
    rower.fakeRower(ble.notify);
  } else {
    var listener = new network.MessageListener(ble.notify);
    listener.start();
  }
};

var mainUsb = function(callback, testMode) {

  var rower = new S4();
  if (testMode) {
    rower.fakeRower(callback);
  } else {
    // monitor USB attach and detach
    var usbPeripheral = new usb.UsbPeripheral();
    usbPeripheral.monitorWr(rower.startRower(callback), rower.stopRower(rower));

    rower.findPort().then(function() {
      rower.startRower(callback)();
    }, function() {
      // wait till we get the right serial
      console.log('[Init] Awaiting WaterRower S4.2 to be connected to USB port');
    });
  }
};

var main = function(args) {
  var runMode = args[2];
  var testMode = args[3] === '--test';
  if (runMode === 'usb') {
    var broadcaster;
    var broadcasterNotify = function(event) {
      if (!broadcaster) {
        broadcaster = new network.MessageBroadcaster();
        broadcaster.start();
      }

      broadcaster.send(event);
    };

    mainUsb(broadcasterNotify, testMode);
  } else if (runMode === 'ble') {
    mainBle(testMode);
  } else {
    var ble;
    var bleNotify = function(event) {
      if (!ble) {
        ble = new peripheral.BluetoothPeripheral('WaterRower S4');
      }

      ble.notify(event);
    };

    mainUsb(bleNotify, runMode === '--test');
  }
};

main(process.argv);
