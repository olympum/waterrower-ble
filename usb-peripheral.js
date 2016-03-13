var usb = require('usb');

var UsbPeripheral = function() {
  this.monitorWr = function(startRower, stopRower) {
    var wrUsbEvent = function(device) {
      if (!device) {
        return false;
      }

      console.log('[USB] Device, ' +
                  'Vendor id: ' + device.deviceDescriptor.idVendor +
                  ', Product id: ', device.deviceDescriptor.idProduct);
      var idProduct = device.deviceDescriptor.idProduct;
      if (device.deviceDescriptor.idVendor  === 0x04d8 &&
          device.deviceDescriptor.idProduct === 0x000a) {
        return true;
      }

      return false;
    };

    usb.on('attach', function(device) {
      if (wrUsbEvent(device)) {
        console.log('[Init] WaterRower-S4.2 Connected to USB hub controller');
        startRower();
      }
    });

    usb.on('detach', function(device) {
      if (wrUsbEvent(device)) {
        console.log('[End] WaterRower-S4.2 Disconnected from USB hub controller');
        stopRower();
      }
    });
  };
};

module.exports.UsbPeripheral = UsbPeripheral;
