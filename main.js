var main_ble = function(test_mode) {
  var peripheral = require('ble-cycling-power');
  var ble = new peripheral.BluetoothPeripheral('WaterRower S4');

  if (test_mode) {
    var S4 = require('./s4');
    var rower = new S4();
    rower.fakeRower(ble.notify);
  } else {
    var network = require('./network');
    var listener = new network.MessageListener(ble.notify);
    listener.start();
  }
};

var main_usb = function(test_mode) {
  var network = require('./network');
  var usb = require('./usb-peripheral');
  var S4 = require('./s4');

  var broadcaster = new network.MessageBroadcaster();
  broadcaster.start();
  var rower = new S4();

  if (test_mode) {
    rower.fakeRower(broadcaster.send);
  } else {
    // monitor USB attach and detach
    var peripheral = new usb.UsbPeripheral();
    peripheral.monitor_wr(rower.startRower(broadcaster.send), rower.stopRower(rower));

    rower.findPort().then(function() {
      rower.startRower(broadcaster.send)();
    }, function() {
      console.log('[Init] Awaiting WaterRower S4.2 to be connected to USB port');
    });
  }
};

var main_full = function(test_mode) {
  var peripheral = require('bluetooth-peripheral');
  var S4 = require('./s4');
  var usb = require('./usb-peripheral');

  var ble = new peripheral.BluetoothPeripheral('WaterRower S4');
  var rower = new S4();
  if (test_mode) {
    rower.fakeRower(ble.notify);
  } else {
    // monitor USB attach and detach
    var peripheral = new usb.UsbPeripheral();
    peripheral.monitor_wr(rower.startRower(ble.notify), rower.stopRower(rower));

    rower.findPort().then(function() {
      rower.startRower(ble.notify)();
    }, function() {
      console.log('[Init] Awaiting WaterRower S4.2 to be connected to USB port');
    });
  }
};

var main = function() {
  var run_mode = process.argv[2];
  var test_mode = process.argv[3] === '--test';
  if (run_mode === 'usb') {
    main_usb(test_mode);
  } else if (run_mode === 'ble') {
    main_ble(test_mode);
  } else {
    main_full(run_mode === '--test');
  }
};

main();
