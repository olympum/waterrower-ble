var $q = require('q');
var com = require('serialport');
var DEBUG = false;

// MESSAGE FLOW
//
// send USB packet
// receive _WR_ packet
// send IV? packet
// receive IV packet (and check)
// send RESET packet
// receive PING packet
// send WSI or WSU packet (distance or duration)
// receive SS packet
// send IRS/IRD/IRT for all required memory addresses
// receive IDS/IDD/IDT with memory address value
// re-send corresponding IRS/IRD/IRT
// this.event is a promise:
//      resolve  -> completed successfully (string)
//      reject   -> not completed / failed (string)
//      notify   -> update for each event (memory address) (event object literal)
function S4() {
    var self = this;
    self.port = null;
    self.pending = [];
    self.writer = null;
    // POSSIBLE STATES
    //
    //    Unset             = 0
    //    ResetWaitingPing  = 1
    //    ResetPingReceived = 2
    //    WorkoutStarted    = 3
    //    WorkoutCompleted  = 4
    //    WorkoutExited     = 5
    //
    self.state = 0;
    var EOL = '\r\n'; // CRLF 0x0D0A
    this.write = function (string) {
      self.pending.push(string);
    };

    this.flushNext = function () {
      if (self.pending.length == 0) {
        return;
      }
      var string = self.pending.shift();
      if (self.port) {
          var buffer = new Buffer(string + EOL);
          if (DEBUG) console.log('[OUT]: ' + buffer);
          self.port.write(buffer);
      } else {
          console.log('Communication port is not open - not sending data: ' + string);
      }
    };

    this.readAndDispatch = function (string) {
        if (DEBUG) console.log('[IN]: ' + string);
        var c = string.charAt(0);
        switch (c) {
            case '_':
                self.wrHandler(string);
                break;
            case 'I':
                self.informationHandler(string);
                break;
            case 'O':
                // ignore
                break;
            case 'E':
                break;
            case 'P':
                self.pHandler(string);
                break;
            case 'S':
                self.strokeHandler(string);
                break;
            default:
                self.unknownHandler(string);
        }
    };

    // handlers start
    this.unknownHandler = function (string) {
        console.log('Unrecognized packet: ' + string);
    };


    this.wrHandler = function (string) {
        if (string == '_WR_') {
            self.write("IV?");
        } else {
            self.unknownHandler(string);
        }
    };

    this.informationHandler = function (string) {
        var c = string.charAt(1);
        switch (c) {
            case 'V':
                this.informationVersionHandler(string);
                break;
            case 'D':
                this.memoryValueHandler(string);
                break;
            default:
                self.unknownHandler(string);
        }
    };

    this.pHandler = function (string) {
        var c = string.charAt(1);
        switch (c) {
            case 'I':
                if (this.state == 1) { // ResetWaitingPing
                    this.state = 2; // ResetPingReceived
                }
                break;
            default:
            // TODO consume PULSE event
        }
    };

    this.strokeHandler = function (string) {
        var c = string.charAt(1);
        switch (c) {
            case 'S':
                this.strokeStartHandler();
                break;
            case 'E':
                // TODO this.strokeEndHandler(string);
                break;
            default:
                self.unknownHandler(string);
        }

    };

    var memoryMap = {
        "1A9": ["stroke_rate", "S"],
        "140": ["stroke_count", "D"],
        "088": ["watts", "D"],
        "1A0": ["heart_rate", "D"]
    };

    this.strokeStartHandler = function () {
        if (this.state == 2) { // ResetPingReceived
            this.state = 3; // WorkoutStarted+++
            for (var address in memoryMap) {
                if (memoryMap.hasOwnProperty(address)) {
                    var element = memoryMap[address];
                    self.readMemoryAddress(address, element[1]);
                }
            }
        }
    };

    this.readMemoryAddress = function (address, size) {
        var cmd = "IR" + size + address;
        this.write(cmd);
    };

    this.informationVersionHandler = function (string) {
        // IV40210
        var model = string.charAt(2);
        var fwRevMajor = string.substring(3, 5);
        var fwRevMinor = string.substring(5, 7);
        var version = 'S' + model + ' ' + fwRevMajor + '.' + fwRevMinor;
        // only log error, ignore version mismatch
        if (version != 'S4 02.10') {
            console.log('WaterRower monitor version mismatch - expected S4 02.10 but got ' + version);
        } else {
            console.log('WaterRower ' + version);
        }
        this.state = 1; // ResetWaitingPing
        this.write("RESET");
    };


    this.memoryValueHandler = function (string) {
        var size = string.charAt(2);
        var address = string.substring(3, 6);
        var l;
        switch (size) {
            case 'S':
                l = 1;
                break;
            case 'D':
                l = 2;
                break;
            case 'T':
                l = 3;
                break;
            default:
                this.unknownHandler(string);
                return;
        }
        var end = 6 + 2 * l;
        var value = parseInt(string.substring(6, end), 16);
        var label = memoryMap[address][0];
        var e = {};
        e[label] = value;
        if (self.event) {
            self.event.notify(e);
        }
        if (this.state == 3) { // WorkoutStarted
            this.readMemoryAddress(address, size);
        }
    };
    // handlers end
}

S4.prototype.toString = function () {
    return this.port.comName;
};

S4.prototype.findPort = function () {
    var portComName = $q.defer();

    com.list(function (err, ports) {
        if (err) {
            throw err;
        }

        var port;
        ports.forEach(function (p) {
            // https://usb-ids.gowdy.us/read/UD/04d8/000a
            if (p.vendorId == '0x04d8' && p.productId == '0x000a') {
                // port is an object literal with string values
                port = p;
            }
        });
        if (port) {
            portComName.resolve(port.comName);
        } else {
            portComName.reject('Prolific USB CDC RS-232 Serial Emulation port not found');
        }
    });
    return portComName.promise;
};

S4.prototype.open = function (comName) {
    var self = this;
    var ready = $q.defer();
    var port = new com.SerialPort(comName, {
        baudrate: 115200,
        parser: com.parsers.readline('\r\n')
    }, false);
    port.open(function () {
        self.port = port;
        port.on('data', self.readAndDispatch);
        // we can only write one message every 25ms
        self.writer = setInterval(self.flushNext, 25);
        ready.resolve();
    });
    return ready.promise;

};

S4.prototype.start = function () {
    this.event = $q.defer();
    this.write("USB");
    return this.event.promise;
};

S4.prototype.exit = function () {
    if (this.state != 5) { // WorkoutExited
        this.state = 5;
        this.write("EXIT");
        this.pending = [];
        if (this.writer) {
            clearInterval(this.writer);
        }
        if (this.event) {
          this.event.resolve("EXITED");
        }
    }
};

S4.prototype.startRower = function(callback) {
  var rower = this;
  return function() {
    rower.findPort().then(function(comName) {
      console.log("[Init] Found WaterRower S4 on com port: " + comName);
      var stroke_rate = 0;
      var stroke_count = 0;
      var watts = 0;
      rower.open(comName).then(function() {
        console.log('[Start] Start broadcasing WR data');
        rower.start().then(function(string) {
            console.log('[End] Workout ended successfully ...' + string);
        }, function(string) {
            console.log('[End] Workout failed ...' + string);
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
              callback(e);
            } else if ('watts' in event) {
              if (event.watts > 0) {
                watts = event.watts;
              }
            } else if ('heart_rate' in event) {
              callback(event);
            }
        });
      });
    }, function(reason) {
      console.log("[Init] error: " + reason);
    });
  };
};

S4.prototype.stopRower = function() {
  var self = this;
  return function() {
    self.exit();
  };
};

S4.prototype.fakeRower = function(callback) {
  console.log("[Init] Faking test data");
  var stroke_count = 0;
  var id = 0;
  var test = function() {
    var bpm = Math.floor(Math.random() * 10 + 120);
    callback({'heart_rate': bpm});
    var watts = Math.floor(Math.random() * 10 + 120);
    stroke_count = stroke_count + 1;
    callback({'watts': watts, 'stroke_count': stroke_count});
    setTimeout(test, 666);
  };
  test();
};

module.exports = S4
