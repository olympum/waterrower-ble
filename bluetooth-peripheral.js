var BluetoothPeripheral = function() {
  var bleno = require('bleno');
  var CyclingPowerService = require('./cycling-power-service');
  var HrmService = require('./hrm-service');
  process.env['BLENO_DEVICE_NAME'] = 'WaterRower S4';
  this.primaryService = new CyclingPowerService();
  this.hrmService = new HrmService();
  this.last_timestamp = 0;
  this.stroke_count = 0;
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
    // console.log("[BLE] " + JSON.stringify(event));
    self.primaryService.notify(event);
    self.hrmService.notify(event);
    if (!('watts' in event) && !('heart_rate' in event)) {
      console.log("unrecognized event: %j", event);
    } else {
      if ('stroke_count' in event) {
        self.stroke_count = event.stroke_count;
      }
      self.last_timestamp = Date.now();
    }
  };

  var ping = function() {
    var TIMEOUT = 4000;
    // send a zero event if we don't hear for 4 seconds (15 rpm)
    if (Date.now() - self.last_timestamp > TIMEOUT) {
      self.notify({'heart_rate': 0,
                   'watts': 0,
                   'stroke_count': self.stroke_count})
    }
    setTimeout(ping, TIMEOUT);
  }
  ping();
};

module.exports.BluetoothPeripheral = BluetoothPeripheral;
