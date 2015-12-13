var util = require('util');
var os = require('os');
var exec = require('child_process').exec;

var bleno = require('bleno');

var Descriptor = bleno.Descriptor;
var Characteristic = bleno.Characteristic;

// Profile:
// https://developer.bluetooth.org/gatt/characteristics/Pages/CharacteristicViewer.aspx?u=org.bluetooth.characteristic.sensor_location.xml
// 13 = rear hub

var CyclingPowerFeatureCharacteristic = function() {
  CyclingPowerFeatureCharacteristic.super_.call(this, {
    uuid: '2A65',
    properties: ['read'],
    value: new Buffer([0])
  });
};

util.inherits(CyclingPowerFeatureCharacteristic, Characteristic);

CyclingPowerFeatureCharacteristic.prototype.onReadRequest = function(offset, callback) {
  // return hardcoded value
  callback(this.RESULT_SUCCESS, new Buffer([0]));
};

module.exports = CyclingPowerFeatureCharacteristic;
