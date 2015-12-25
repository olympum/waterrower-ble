var main_ble = function() {
  var peripheral = require('./bluetooth-peripheral');
  var network = require('./network');

  var ble = new peripheral.BluetoothPeripheral();
  var listener = new network.MessageListener(ble.notify);
  listener.start();
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

var main_full = function() {
  var peripheral = require('./bluetooth-peripheral');
  var S4 = require('./s4');
  var usb = require('./usb-peripheral');

  var ble = new peripheral.BluetoothPeripheral();
  var rower = new S4();
  // monitor USB attach and detach
  var peripheral = new usb.UsbPeripheral();
  peripheral.monitor_wr(rower.startRower(ble.notify), rower.stopRower(rower));

  rower.findPort().then(function() {
    rower.startRower(ble.notify)();
  }, function() {
    console.log('[Init] Awaiting WaterRower S4.2 to be connected to USB port');
  });

};

var main = function() {
  var mode = process.argv[2];
  if (mode === '--test' || mode === '--usb') {
    main_usb(mode === '--test');
  } else if (mode === '--ble') {
    main_ble();
  } else {
    main_full();
  }
};

main();
