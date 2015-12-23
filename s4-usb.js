var S4 = require('./s4');
var rower = new S4();
var usb = require('usb');
var dgram = require('dgram');

// UDP Multicast

var server = dgram.createSocket("udp4");
server.bind( function() {
  server.setBroadcast(true)
  server.setMulticastTTL(128);
});

function broadcast(event) {
  event.id = Date.now();
  var str = JSON.stringify(event);
  var message = new Buffer(str);
  server.send(message, 0, message.length, 5007, "224.0.0.1");
  console.log("[Run] Sent " + message + " to 224.0.0.1:5007");
};

usb.on('attach', function(device) {
  if (wr_usb_event(device)) {
    console.log("[Init] WaterRower-S4.2 Connected to USB hub controller");
    startRower();
  }
});

usb.on('detach', function(device) {
  if (wr_usb_event(device)) {
    console.log("[End] WaterRower-S4.2 Disconnected from USB hub controller");
    stopRower();
  }
});

var wr_usb_event = function(device) {
  if (!device) {
    return false;
  }
  console.log("[USB] Device, " +
              "Vendor id: " + device.deviceDescriptor.idVendor +
              ", Product id: ", device.deviceDescriptor.idProduct);
  var idProduct = device.deviceDescriptor.idProduct;
  if (device.deviceDescriptor.idVendor  === 0x04d8 &&
      device.deviceDescriptor.idProduct === 0x000a) {
    return true;
  }
  return false;
}

var startRower = function() {
  rower.findPort().then(function(comName) {
    console.log("[Init] Found WaterRower S4 on com port: " + comName);
    var stroke_rate = 0;
    var stroke_count = 0;
    var watts = 0;
    rower.open(comName).then(function() {
        rower.start().then(function(string) {
            console.log('[End] Workout ended successfully ...' + string);
        }, function(string) {
            console.log('[End] Workout failed ...' + string);
        }, function(event) {
            console.log('[Start] Started broadcasing WR data');
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
              broadcast(e);
            } else if ('watts' in event) {
              if (event.watts > 0) {
                watts = event.watts;
              }
            } else if ('heart_rate' in event) {
              broadcast(event);
            }
        });
    });
  }, function(reason) {
    console.log("[Init] error: " + reason);
    console.log("[Init] Faking test data");
    var stroke_count = 0;
    var id = 0;
    var test = function() {
      var bpm = Math.floor(Math.random() * 10 + 120);
      broadcast({'heart_rate': bpm});
      var watts = Math.floor(Math.random() * 10 + 120);
      stroke_count = stroke_count + 1;
      broadcast({'watts': watts, 'stroke_count': stroke_count});
      setTimeout(test, 666);
    };
    test();
  });
}

var stopRower = function() {
  rower.exit();
}

console.log('[Init] Awaiting WaterRower S4.2 to be connected to USB port');
