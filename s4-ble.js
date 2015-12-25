var network = require('./network');
var peripheral = require('./bluetooth-peripheral');

var main = function() {
  var ble = new peripheral.BluetoothPeripheral();
  var listener = new network.MessageListener(ble.notify);
  listener.start();
};

main();
