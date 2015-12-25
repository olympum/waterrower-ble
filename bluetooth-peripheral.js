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
    var service = null;
    if ('watts' in event) {
      service = self.primaryService;
    } else if ('heart_rate' in event) {
      service = self.hrmService;
    }
    if (service != null) {
      service.notify(event);
    } else {
      console.log("unrecognized event: %j", event);
    }
  };
};

module.exports.BluetoothPeripheral = BluetoothPeripheral;
