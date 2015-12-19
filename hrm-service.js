var util = require('util');
var bleno = require('bleno');

var BlenoPrimaryService = bleno.PrimaryService;

var SensorLocationCharacteristic = require('./sensor-location-characteristic');
var HeartRateCharacteristic = require('./heart-rate-characteristic')

function HrmService() {
  this.hrc = new HeartRateCharacteristic();
  HrmService.super_.call(this, {
      uuid: '180D',
      characteristics: [
          new SensorLocationCharacteristic(),
          this.hrc
      ]
  });
  this.notify = function(event) {
    this.hrc.notify(event);
  }
}

util.inherits(HrmService, BlenoPrimaryService);

module.exports = HrmService;
