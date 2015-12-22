var PORT = 5007 ;
var dgram = require('dgram');
var client = dgram.createSocket('udp4');
var bleno = require('bleno');
var CyclingPowerService = require('./cycling-power-service');
var HrmService = require('./hrm-service');

client.on('listening', function () {
    var address = client.address();
    console.log('UDP Client listening on ' + address.address + ":" + address.port);
    client.setBroadcast(true)
    client.setMulticastTTL(128);
    client.addMembership('224.1.1.1');
});

client.on('message', function (message, remote) {
  var event = JSON.parse(message);
  var service = null;
  if ('watts' in event) {
    service = primaryService;
  } else if ('heart_rate' in event) {
    service = hrmService;
  }
  if (service != null) {
    console.log(remote.address + ':' + remote.port +' - ' + message);
    service.notify(event);
  } else {
    console.log("unrecognized event: " + event);
  }
});

client.bind(PORT);

/// init BLE
process.env['BLENO_DEVICE_NAME'] = 'WaterRower S4';

var primaryService = new CyclingPowerService();
var hrmService = new HrmService();

bleno.on('stateChange', function(state) {
  console.log('on -> stateChange: ' + state);

  if (state === 'poweredOn') {
    bleno.startAdvertising('WaterRower S4', [primaryService.uuid, hrmService.uuid]);
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
