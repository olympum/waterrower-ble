var PORT = 5007 ;
var dgram = require('dgram');

var MessageListener = function(callback) {
  this.callback = callback;
  this.client = dgram.createSocket('udp4');
  this.last_id = 0;
};

MessageListener.prototype.start = function() {
  var self = this;

  self.client.on('listening', function () {
      var address = self.client.address();
      console.log('UDP Client listening on ' + address.address + ":" + address.port);
      self.client.setBroadcast(true)
      self.client.setMulticastTTL(128);
      self.client.addMembership('224.0.0.1');
  });

  self.client.on('message', function (message, remote) {
    console.log("[IN] " + remote.address + ':' + remote.port +' - ' + message);

    var event = JSON.parse(message);
    if (event.id > self.last_id) {
      self.last_id = event.id;
    } else {
      return;
    }

    self.callback(event);
  });

  self.client.bind(PORT);
}

module.exports.MessageListener = MessageListener;

var MessageBroadcaster = function() {
  this.server = dgram.createSocket("udp4");
  var self = this;
  this.start = function() {
    self.server.bind( function() {
      self.server.setBroadcast(true)
      self.server.setMulticastTTL(128);
    });
  };
  this.send = function(event) {
    event.id = Date.now();
    var str = JSON.stringify(event);
    var message = new Buffer(str);
    self.server.send(message, 0, message.length, 5007, "224.0.0.1");
    console.log("[Run] Sent " + message + " to 224.0.0.1:5007");
  };
};

module.exports.MessageBroadcaster = MessageBroadcaster;
