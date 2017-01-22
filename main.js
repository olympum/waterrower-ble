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
    rower.fakeRower(callback());
  } else {
    rower.findPort().then(function() {
      rower.startRower(callback())();
    }, function() {
      // wait till we get the right serial
      console.log('[Init] Awaiting WaterRower S4.2 to be connected to USB port');

      // monitor USB attach and detach events
      var usbPeripheral = new usb.UsbPeripheral();
      usbPeripheral.monitorWr(function() {
        rower.startRower(callback());
      }, rower.stopRower(rower));
    });
  }
};

var main = function(args) {
  var runMode = args[2];
  var testMode = args[3] === '--test';
  if (runMode === 'usb') {
    var broadcasterNotify = function() {
      var broadcaster = new network.MessageBroadcaster();
      broadcaster.start();

      return broadcaster.send;
    };

    mainUsb(broadcasterNotify, testMode);
  } else if (runMode === 'ble') {
    mainBle(testMode);
  } else if (runMode === 'ant') {
    var antNotify = function() {
      var ant = require('ant-cycling-power');
      var pm = new ant.PowerMeter();
      var ts = 0;
      var rev_count = 0;
      return function(event) {
        if ("watts" in event) {
          if (ts == 0) {
            ts = Date.now();
          } else {
            var now = Date.now();
            var delta = (now - ts) / 1000 / 60;
            ts = now;
            var revs = event.rev_count - rev_count;
            rev_count = event.rev_count;
            var cadence = Math.round(revs / delta);
            pm.broadcast(event.watts, cadence);
          }
        }
      };
    };

    mainUsb(antNotify, testMode);

  } else {
    var listener = function() {
      var ble = new peripheral.BluetoothPeripheral('WaterRower S4');
      var ant = require('ant-cycling-power');
      var pm = new ant.PowerMeter();
      var ts = 0;
      var rev_count = 0;
      return function(event) {
        if ("watts" in event) {
          if (ts == 0) {
            ts = Date.now();
          } else {
            var now = Date.now();
            var delta = (now - ts) / 1000 / 60;
            ts = now;
            var revs = event.rev_count - rev_count;
            rev_count = event.rev_count;
            var cadence = Math.round(revs / delta);
            pm.broadcast(event.watts, cadence);
            ble.notify(event);
          }
        }
      };

    };

    mainUsb(listener, runMode === '--test');
  }
};

main(process.argv);
