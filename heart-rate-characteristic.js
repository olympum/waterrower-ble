var util = require('util');
var os = require('os');
var exec = require('child_process').exec;
var bleno = require('bleno');
var debug = require('debug')('hrm');

var Descriptor = bleno.Descriptor;
var Characteristic = bleno.Characteristic;

// Spec
// https://developer.bluetooth.org/gatt/characteristics/Pages/CharacteristicViewer.aspx?u=org.bluetooth.characteristic.heart_rate_measurement.xml

var HeartRateCharacteristic = function() {
  HeartRateCharacteristic.super_.call(this, {
    uuid: '2A37',
    properties: ['notify']
  });

  this._updateValueCallback = null;
};

util.inherits(HeartRateCharacteristic, Characteristic);

HeartRateCharacteristic.prototype.onSubscribe = function(maxValueSize, updateValueCallback) {
  console.log('[BLE] client subscribed to HRM');
  this._updateValueCallback = updateValueCallback;
};

HeartRateCharacteristic.prototype.onUnsubscribe = function() {
  console.log('[BLE] client unsubscribed from HRM');
  this._updateValueCallback = null;
};

HeartRateCharacteristic.prototype.notify = function(event) {
  if (!('heart_rate' in event)) {
    // ignore
    return;
  }

  var bpm = event.heart_rate;
  debug("bpm: " + bpm);
  var value = new Buffer([0, bpm]);
  if (this._updateValueCallback) {
    this._updateValueCallback(value);
  }
}

module.exports = HeartRateCharacteristic;
