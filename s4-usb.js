var S4 = require('./s4');

var news = [
  "Borussia Dortmund wins German championship",
  "Tornado warning for the Bay Area",
  "More rain for the weekend",
  "Android tablets take over the world",
  "iPad2 sold out",
  "Nation's rappers down to last two samples"
];

var dgram = require('dgram');
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
  console.log("Sent " + message + " to the wire...");
}


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
  console.log("Faking test data");
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
