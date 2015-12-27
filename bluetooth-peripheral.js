var BluetoothPeripheral = function() {
  var bleno = require('bleno');
  var CyclingPowerService = require('./cycling-power-service');
  var HrmService = require('./hrm-service');
  process.env['BLENO_DEVICE_NAME'] = 'WaterRower S4';
  this.primaryService = new CyclingPowerService();
  this.hrmService = new HrmService();
  var self = this;

  bleno.on('stateChange', function(state) {
    console.log('stateChange: ' + state);

    if (state === 'poweredOn') {
      bleno.startAdvertising('WaterRower S4', [self.primaryService.uuid,
                                               self.hrmService.uuid]);
    } else {
      bleno.stopAdvertising();
    }
  });

  bleno.on('advertisingStart', function(error) {
    console.log('advertisingStart: ' + (error ? 'error ' + error : 'success'));

    if (!error) {
      bleno.setServices([self.primaryService, self.hrmService], function(error){
        console.log('setServices: '  + (error ? 'error ' + error : 'success'));
      });
    }
  });

  this.notify = function(event) {
    //  console.log("[BLE] " + JSON.stringify(event));
    self.primaryService.notify(event);
    self.hrmService.notify(event);
    if (!('watts' in event) && !('heart_rate' in event)) {
      console.log("unrecognized event: %j", event);
    }
  };
};

module.exports.BluetoothPeripheral = BluetoothPeripheral;
