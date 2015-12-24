# A Bluetooth LE Cycling Power Service for the WaterRower S4

The objective of this adapter is to expose the WaterRower S4, an
indoor rowing "erg", as a Bluetooth LE Cycling Power Service
peripheral. The BLE sensor exposes power and stroke rate data, which
makes it suitable for using the WaterRower in applications like Zwift,
or simply to just record the power, cadence and heart rate data, e.g.
in the Wahoo Fitness app.

The reason to only report power and cadence (and heart rate when
present), is that the speed algorithm in the WR S4 is not accurate,
and not comparable to the gold-standard in erg, the Concept2. Power
reading in the WR are precise, although not extremely accurate.
Nonetheless power is somewhat comparable to the Concept2, whereas pace
is simply whacky. Also, I prefer to train indoor with power, not pace.

Because of the distance/pace handicap in the WR, I have focused on
just solving the problem of getting power and cadence out of the WR,
via USB, via BLE, .... In addition, the heart rate is optionally also
sent via the BLE sensor when an ANT+ compatible heart rate monitor is
connected to the S4 (you will need the WaterRower S4/S5 ANT+ antenna,
either in internal or external format).

Now, if you really, really, are interest in pace: it's possible to go
from watts, as read by the WR, to pace as 500m time splits, using
[Concept2's online watts calculator](http://www.concept2.com/indoor-rowers/training/calculators/watts-calculator)
which is just a simple formula (pace = (2.8/power)^(1/3).

**Now, be warned ... this code is just a quick Friday afternoon hack!! Use at your own risk! Documentation is mainly for my own reference!**

## Motivation

I have been rowing with the WR for a while using
[Oarsman](https://github.com/olympum/oarsman), a program I wrote
sometime ago to control the S4 from the computer.

I enjoy riding indoors on Zwift, so I wanted to see if I could get
rowing with the WaterRower on Zwift. As background, the way Zwift
works is by using power as the source of truth. Power in Zwift may
come from a power meter fitted to the bike, measuring torque, from a
smart trainer, measuring force and speed, or from a speed sensor
("zPower"), using the trainer's resistance curve (since power =
force * speed). To measure power, the WaterRower uses a toothed wheel
and optical detector such that a pulse train containing 57 pulses per
revolution can be recorded for the purposes of paddle speed
measurement. The S4 monitor uses this to calculate angular velocity,
and from there and the water mass, total work input. Where it gets
whacky is when the S4 tries to infer pace, using guesses for the drag
of the scull's shell, etc. But at least, for power, it's fairly
accurate, to the 57 pulses per revolution (which at 24 strokes per
minute, it gives us an average of 23Hz). Power readings are only
available at the end of the catch, i.e. once per stroke.

Initially, I planned to just connect the machine I use for Zwift to
the WaterRower via USB, while running Zwift. Unfortunately, I could
not get this working as the messages from/to the WaterRower over the
USB-to-serial port conflict with the Zwift messages over the
USB-to-ANT+. So I moved on to a dedicated device, e.g. Arduino or
Raspberry Pi, to do this.

I decided to setup a dedicated Raspberry Pi connected to the
WaterRower, and to automatically get the BLE sensor start advertising
when we switch the WaterRower on. I also attached a Pluggable USB 2.0
Bluetooth 4.0 LE adapter.

Next issue hit, I found problems with Bluetooth LE in the Pi, and in
fact in Linux in general. `node-bleno` is supporting `bluez` version
4.99, but `bluez` 5.x is now the standard package version in Debian
and Ubuntu, so until `bleno` is updated to support 5.x we need to shut
down and start the bluetooth daemon manually:

```
pi@raspberrypi ~ $ bluetoothd --version
pi@raspberrypi ~ $ sudo /etc/init.d/bluetooth stop
[ ok ] Stopping bluetooth (via systemctl): bluetooth.service.
pi@raspberrypi ~ $ sudo hciconfig hci0 up
```
Unfortunately, even with this step, I could not get BLE to work
reliably: at some point the Bluetooth USB will be disconnected, deemed
inactive, and immediately reconnected by the kernel. Sigh. I am trying
to figure out a way around this, but I decide to just bypass the
problem and use two programs: one doing the USB work on the Raspberry
Pi, and one doing the BLE work, on a computer where BLE works reliably
(Mac or Windows). I get them to communicate with each other over the
network. In practice, I am using the same computer where I run Zwift
to run the BLE sensor, but it could run anywhere really.

I decided to use UDP multicast to send out the WR data from the USB
program to the BLE program. The datagrams are sent to `224.0.0.1`, so
a route must be setup in the Raspberry Pi and the Zwift computer to
accept multicast. The choice of address is done to leverage the
default route setup on Macs and Windows machines. UDP multicast makes
discovery easy, and is lightweight and better suited for
time-sensitive packets, like in games. However, multicast is not a
standard network setup, which is a hurdle for some people. Also, UDP
is not reliable, so we may get dupes or missing packets. Dupes we can
deal with easily with a sequence number. Missing packets are a
problem, since they show up as power drop on the BLE sensor. Maybe we
can do UDP for discovery, and TCP for communication (as our latency
requirements are not the same as in a shooting game). Or maybe the
whole thing goes away once I get BLE working well on the Pi. But for
now, UDP is here.

In summary, my current setup is:

* The WaterRower S4.2 is connected via USB to the Raspberry Pi. The Pi
  is running Debian Jessie.
* Linux kernel 3.x and up supports the S4.2 USB device out of the box
  as a USB-to-serial adapter. Instead of using the USB port to talk to
  the WR, we use the serial adapter, which is ASCII based and much
  simpler to deal with. If you run this on Windows or Mac, you'll need
  to install the Prolific PL2303 driver (Google it).
* The Zwift computer runs a program listening to the datagrams, which
  it then offers out as a Bluetooth LE peripheral. The computer
  obviously needs to have a Bluetooth 4.0 USB adapter. But all Macs
  since 2011 have this.
* The Zwift companion app must be running on the phone to pick the
  Bluetooth signal.
* The computer running the Zwift app must be on the same WIFI network
  as the phone.

Obviously, we don't need to use Zwift and can use any BLE app on the
phone to listen and record the data, e.g. the Wahoo Fitness app for
iOS.

Finally, and before your scream ... yeah, I know that I don't strictly
need the USB dependencies on the computer doing BLE, or viceversa the
BLE dependencies on the computer running the USB program. I am
unlikely to split this up into two packages since eventually I want to
move the BLE sensor to the Pi side of things.

## Installation on the Raspberry Pi ##

These instructions are specific to the Raspberry, although it should
work in any Linux distro and on Mac with little modifications. I have
no clue if or how this works on Windows, you are on your own there.

Install bluetooth:

```
$ sudo apt-get install bluetooth bluez libbluetooth-dev libudev-dev
```

Install node:

```
curl -sL https://deb.nodesource.com/setup_5.x | sudo -E bash -
sudo apt-get install --yes nodejs
sudo ln -s /usr/bin/nodejs /usr/bin/node
```

Install `waterrower-ble`:

```
git clone http://github.com/olympum/waterrower-ble
cd waterrower-ble
npm install
```

(the installation might fail because of missing native dependencies; sorry, you'll have to work it out).

Install and start service:

```
cd waterrower-ble
sudo cp node-waterrower.service /etc/systemd/services/node-waterrower.service
sudo systemctl daemon-reload
sudo systemctl start node-waterrower
sudo systemctl enable node-waterrower
```

Check status in syslog:

```
tail -f /var/log/syslog
```

Check routes:

```
netstat -nr
```

Create route if multicast is missing (change gateway address as
applicable):

```
sudo route add -net 224.0.0.0/4 gw 192.168.1.1
```

We test that multicast works:

```
ping 224.0.0.1

PING 224.0.0.1 (224.0.0.1): 56 data bytes
64 bytes from 192.168.1.87: icmp_seq=0 ttl=64 time=0.164 ms
64 bytes from 192.168.1.84: icmp_seq=0 ttl=255 time=1.042 ms
64 bytes from 192.168.1.93: icmp_seq=0 ttl=128 time=2.887 ms
64 bytes from 192.168.1.85: icmp_seq=0 ttl=64 time=3.641 ms
64 bytes from 192.168.1.69: icmp_seq=0 ttl=255 time=3.649 ms
64 bytes from 192.168.1.80: icmp_seq=0 ttl=255 time=7.155 ms
64 bytes from 192.168.1.87: icmp_seq=1 ttl=64 time=0.097 ms
64 bytes from 192.168.1.84: icmp_seq=1 ttl=255 time=1.237 ms
64 bytes from 192.168.1.93: icmp_seq=1 ttl=128 time=1.251 ms
64 bytes from 192.168.1.80: icmp_seq=1 ttl=255 time=4.892 ms
...
```

## Installation on the computer running Zwift ##

For a Mac, we install `nodejs` using Homebrew, but you can [install
node](https://nodejs.org/en/download/) in many other ways:

```
brew install node
```

We now get the code and install the necessary dependencies:

```
git clone http://github.com/olympum/waterrower-ble
cd waterrower-ble
npm install
```

(the installation might fail because of missing native dependencies; sorry, you'll have to work it out).

You will also need to check routes. On Mac we do this similarly to the
Pi:

```
netstat -nr
```

And if missing, we add the route, e.g. to the `en0` interface (oh, and
you could add a whole range, I do the IP I need, in this case
224.0.0.1):

```
sudo route -nv add -net 224.0.0.1 -interface en0
```

## Rowing with Power ##

Now we are ready to start working hard. Once installed on both the Raspberry Pi and the Zwift computer, the sequence to get this running is the following:

1. Switch on the Raspberry Pi (I have always on).
1. Switch on the WR S4. You will hear a beep.
1. Connect the WR S4 USB cable to the Raspberry Pi. You should hear
   another beep.
1. On the Zwift computer, start the BLE peripheral:
    ```
    cd waterrower-ble
    node s4-ble.js
    ```

1. On the phone, open the Zwift app.
1. Open the actual Zwift app, search for BLE peripherals and you'll
   find a heart rate monitor, and a power meter with crank revolutions
   (cadence) data.
1. Start rowing and enjoy the workout.

When done, unplug the USB cable from the Pi, otherwise the WR S4
monitor will not power off, and it will drain the batteries.
