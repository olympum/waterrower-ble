var bleno = require('bleno');
var CyclingPowerService = require('./cycling-power-service');
var HrmService = require('./hrm-service');
var S4 = require('./s4');

/// init BLE

var primaryService = new CyclingPowerService();
var hrmService = new HrmService();

bleno.on('stateChange', function(state) {
  console.log('on -> stateChange: ' + state);

  if (state === 'poweredOn') {
    bleno.startAdvertising('WaterRower S4 Power Meter', [primaryService.uuid]);
    bleno.startAdvertising('WaterRower S4 HR', [hrmService.uuid]);
  } else {
    bleno.stopAdvertising();
  }
});

bleno.on('advertisingStart', function(error) {
  console.log('on -> advertisingStart: ' + (error ? 'error ' + error : 'success'));

  if (!error) {
    bleno.setServices([primaryService, hrmService], function(error){
      console.log('setServices: '  + (error ? 'error ' + error : 'success'));
    });
  }
});

/// init S4

var rower = new S4();

rower.findPort().then(function(comName) {
  console.log("[Init] Found WaterRower S4 com port: " + comName);
  var stroke_rate = 0;
  var stroke_count = 0;
  var watts = 0;
  rower.open(comName).then(function() {
      rower.start().then(function(string) {
          console.log('workout ended successfully ...' + string);
      }, function(string) {
          console.log('workout failed ...' + string);
      }, function(event) {
          //console.log(event);
          if ('stroke_rate' in event) {
            stroke_rate = event.stroke_rate;
          } else if ('stroke_count' in event
              && event.stroke_count > stroke_count) {
            stroke_count= event.stroke_count;
            var e = {
              'watts': watts,
              'stroke_count': stroke_count
            };
            console.log(e);
            primaryService.notify(e);
          } else if ('watts' in event) {
            if (event.watts > 0) {
              watts = event.watts;
            }
          } else if ('heart_rate' in event) {
            hrmService.notify(event);
          }
      });
  });
}, function(reason) {
  console.log("[Init] error: " + reason);
});
