var S4 = require('./s4');
var rower = new S4();
var network = require('./network');
var usb = require('./usb-peripheral');

var main = function() {
  var broadcaster = new network.MessageBroadcaster();
  broadcaster.start();

  var test_mode = process.argv[2];

  if (test_mode === '-t') {
    S4.fakeRower(broadcaster.send);
  } else {
    var peripheral = new usb.UsbPeripheral();
    peripheral.monitor_wr(S4.startRower(broadcaster.send), S4.stopRower);
    console.log('[Init] Awaiting WaterRower S4.2 to be connected to USB port');
  }
};

main();
