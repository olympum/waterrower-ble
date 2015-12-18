var util = require('util');
var os = require('os');
var exec = require('child_process').exec;

var bleno = require('bleno');

var Descriptor = bleno.Descriptor;
var Characteristic = bleno.Characteristic;

// Spec
//https://developer.bluetooth.org/gatt/characteristics/Pages/CharacteristicViewer.aspx?u=org.bluetooth.characteristic.cycling_power_measurement.xml

var CyclingPowerMeasurementCharacteristic = function() {
  CyclingPowerMeasurementCharacteristic.super_.call(this, {
    uuid: '2A63',
    properties: ['notify'],
    descriptors: [
      new Descriptor({
        // Client Characteristic Configuration
        uuid: '2902',
        value: new Buffer([0])
      }),
      new Descriptor({
        // Server Characteristic Configuration
        uuid: '2903',
        value: new Buffer([0])
      })
    ]
  });

  //this.revolutions = 0;
  this.last = 0;
  this._updateValueCallback = null;
};

util.inherits(CyclingPowerMeasurementCharacteristic, Characteristic);

CyclingPowerMeasurementCharacteristic.prototype.onSubscribe = function(maxValueSize, updateValueCallback) {
  console.log('onSubscribe');
  this._updateValueCallback = updateValueCallback;
};

CyclingPowerMeasurementCharacteristic.prototype.onUnsubscribe = function() {
  console.log('onUnsubscribe');
  this._updateValueCallback = null;
};

CyclingPowerMeasurementCharacteristic.prototype.notify = function(event) {
  if (this.last == 0) {
    this.last = Date.now();
  }
  var buffer = new Buffer(8);
  // flags
  // 00000001 - Pedal Power Balance Present
  // 00000010 - Pedal Power Balance Reference
  // 00000100 - Accumulated Torque Present
  // 00001000 - Accumulated Torque Source
  // 00010000 - Wheel Revolution Data Present
  // 00100000 - Crank Revolution Data Present
  // 01000000 - Extreme Force Magnitudes Present
  // 10000000 - Extreme Torque Magnitudes Present
  buffer.writeUInt16LE(32, 0);

  if ('watts' in event) {
    var watts = event.watts;
    console.log("power: " + watts);
    buffer.writeInt16LE(watts, 2);
  }

  if ('stroke_count' in event) {
    // var cadence = event.stroke_rate/60e3;
    // var now = Date.now();
    // var ellapsed_millis = now - this.last;
    // var revs = cadence * ellapsed_millis;
    // this.revolutions += revs;
    // console.log("revolutions: " + Math.floor(this.revolutions));
    console.log("stroke_count: " + event.stroke_count);
    buffer.writeUInt16LE(event.stroke_count, 4);

    var now = Date.now();
    var now_1024 = Math.floor(now*1e3/1024);
    var event_time = now_1024 % 65536; // rolls over every 64 seconds
    console.log("event time: " + event_time);
    this.last = now;
    buffer.writeUInt16LE(event_time, 6);
  }

  if (this._updateValueCallback) {
    console.log('notifying');
    this._updateValueCallback(buffer);
  }
}

module.exports = CyclingPowerMeasurementCharacteristic;
