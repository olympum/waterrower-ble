var network = require('./network');
var peripheral = require('./bluetooth-peripheral');
var usb = require('./usb-peripheral');
var S4 = require('./s4');

var main_ble = function() {
  var ble = new peripheral.BluetoothPeripheral();
  var listener = new network.MessageListener(ble.notify);
  listener.start();
};

var main_usb = function(test_mode) {
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

var main = function() {
  var mode = process.argv[2];
  if (mode === '--test' || mode === '--usb') {
    main_usb(mode === '--test');
  } else if (mode === '--ble') {
    main_ble();
  } else {
    // TODO: unified mode without UDP
    console.log("Integrated mode not implemented yet: use --test, --ble or --usb command line flags");
  }
};

main();
