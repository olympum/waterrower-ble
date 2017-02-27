# A Bluetooth LE Cycling Power Service for the WaterRower S4

The objective of this adapter is to expose the WaterRower S4, an
indoor rowing "erg", as a Bluetooth LE Cycling Power Service
peripheral. The BLE sensor exposes power and stroke rate data, which
makes it suitable for using the WaterRower in applications like Zwift,
or simply to just record the power, cadence and heart rate data, e.g.
in the Wahoo Fitness app.

You can read the [blog
post](http://www.olympum.com/sports/rowing-with-waterrower-in-zwift) for
context.

**B$ disclaimer: this code is just a quick Friday afternoon hack with a bunch
of subsequent patches. Use at your own risk!**

## Installation on the Raspberry Pi ##

These instructions are specific to the Raspberry, although it should
work in any Linux distro and on Mac with little modifications. I have
no clue if or how this works on Windows, you are on your own there.

I am assuming throughout that you are running as `pi:pi` and have `sudo`
privileges.

Before anything else, let's make sure we are up to date:

```
$ sudo apt-get update
$ sudo apt-get upgrade
$ sudo rpi-update # upgrade firmware (for BLE)
$ sudo reboot
```

First, we plugin the USB Bluetooth dongle and install bluetooth and bluez
utils:

```
$ sudo apt-get install bluetooth bluez libbluetooth-dev libudev-dev
```

Disable bluetooth from running as a service:

```
sudo systemctl stop bluetooth
sudo systemctl disable bluetooth
```

Let's now enable `hci0` at reboot:

```
crontab -e
```

and add the following line:

```
@reboot sudo -u root hciconfig hci0 piscan            #make RPi discoverable
```

We also need to enable 1.2A USB power draw mode, otherwise the RPi limits the draw to 0.6A:

```
/boot/config.txt
---
# Force 1.2A USB draw
max_usb_current=1
```

Reboot. Now onto installing node and our program. First, to install node on the RPi:

```
curl -sL https://deb.nodesource.com/setup_5.x | sudo -E bash -
sudo apt-get install --yes nodejs
sudo ln -s /usr/bin/nodejs /usr/bin/node
```

Then to install `waterrower-ble`:

```
git clone http://github.com/olympum/waterrower-ble
cd waterrower-ble
npm install
```

(the installation might fail because of missing native dependencies; sorry, you'll have to work it out).

Grant node ability to change capabilities:

```
sudo setcap cap_net_raw+eip $(eval readlink -f `which node`)
```

We now install and start the waterrower service:

```
cd waterrower-ble
sudo ln -s waterrower.service /etc/systemd/services/waterrower.service
sudo systemctl daemon-reload
sudo systemctl start waterrower
sudo systemctl enable waterrower
```

Check status in syslog for errors.

```
tail -f /var/log/syslog
```

Done! We are ready to row.

## Rowing with Power

Now we are ready to start a good workout on the erg. Once installed on the
Raspberry Pi, the sequence to get up and running is the following:

1. If off, switch on the Raspberry Pi (I leave it always on).
1. Switch on the WR S4. You should hear a beep.
1. Connect the WR S4 USB cable to the Raspberry Pi. You should hear another
beep.
1. On a device with BLE, e.g. iPhone, pair to the "WaterRower S4"
sensor using your favorite app. I normally use the Wahoo Fitness app.
1. Once done, and in order to save the S4 batteries, unplug the USB cable from
the Pi, otherwise the WR S4 monitor will not power off.

## Rowing on Zwift

1. Open the Zwift mobile app, e.g. for iOS.
1. On the computer, open the Zwift app. If necessary, enter your credentials
and ignore the missing ANT+ dongle warning.
1. Once you are signed into Zwift, you should see the pairing sensor screen.
The bluetooth phone next to the ANT+ sign should be pulsing. If has a yellow
warning or if it's greyed out, ensure your phone is in the same WIFI network
as the computer and reset bluetooth (switch bluetooth off and back on again).
1. Find and pair the heart rate monitor, the power meter and the cadence
sensors called "WaterRower S4". Sometimes the sensors will named after the
computer where the WaterRower is connected to. **Note** In the past, I've had
trouble pairing bluetooth devices before starting the ride, so I'd press ESC
to bypass the pairing screen, and then start the ride with `Just Ride` (or
join ...). Once in the game, press `A` to get back to the pairing screen. The
latest versions of the mobile app don't seem to need this step.
1. Start rowing and enjoy the workout.

## Network Mode

Initially I could not get BLE running on a stable fashion on the RPi, so I
created a network mode that allowed me to run just the USB part on the RPi,
and the BLE on the same computer where I run Zwift. This is done using UDP
multicast. This is still enabled, just in case.

### Raspberry Pi (USB)

In the Raspberry PI, check routes:

```
netstat -nr
```

And create a new route for multicast if it is missing (change gateway address
as applicable):

```
sudo route add -net 224.0.0.0/4 gw 192.168.1.1
```

We can test that multicast works:

```
ping 224.0.0.1

PING 224.0.0.1 (224.0.0.1): 56 data bytes
64 bytes from 192.168.1.87: icmp_seq=0 ttl=64 time=0.164 ms
64 bytes from 192.168.1.84: icmp_seq=0 ttl=255 time=1.042 ms
64 bytes from 192.168.1.93: icmp_seq=0 ttl=128 time=2.887 ms
64 bytes from 192.168.1.85: icmp_seq=0 ttl=64 time=3.641 ms
64 bytes from 192.168.1.69: icmp_seq=0 ttl=255 time=3.649 ms
64 bytes from 192.168.1.80: icmp_seq=0 ttl=255 time=7.155 ms
...
```

We can now start the `usb` side of things on the RPi:

```
node main.js usb
```

We could also modify the `waterrower.service` file to only do `usb`, so that
it would be:

```
ExecStart=/usr/local/bin/node main.js usb
```

### BLE peripheral

In a Mac, we install `nodejs` using Homebrew, but you can [install
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

(the installation might fail because of missing native dependencies; sorry,
you'll have to work it out).

You will also need to check routes. On Mac we do this similarly to the Pi:

```
netstat -nr
```

And if missing, we add the route, e.g. to the `en0` interface (oh, and you
could add a whole range, I do the IP I need, in this case 224.0.0.1):
```
sudo route -nv add -net 224.0.0.1 -interface en0
```

We can now start the BLE peripheral:

```
node main.js ble
```

## Troubleshooting

Things here are a bit fragile, so there are two things we can do to dive into
issues: test mode and debug.

Test mode allows generating data without having to be connected. The way it
works is:

* `node main.js usb --test` will fake S4 data and send it onto the network.
* `node main.js ble --test` will fake sensor data, and not listen to the
  network.
* `node main.js --test` will fake S4 data and not use the network.

We can also use the `DEBUG` environment variable to specify the component to
produce debug log output on:

* `ble`
* `pm`
* `hrm`
* `usb`
* `network`

For example,

```
DEBUG=ble,network node main.js ble
```

would produce:

```
$ DEBUG=network,ble node . ble
  ble [BLE] {"heart_rate":0,"watts":0,"stroke_count":0} +0ms
UDP Client listening on 0.0.0.0:5007
  network [IN] 192.168.1.87:49470 - {"heart_rate":122,"id":1451303405515} +161ms
  ble [BLE] {"heart_rate":122,"id":1451303405515} +2ms
  network [IN] 192.168.1.87:49470 - {"watts":122,"stroke_count":24,"id":1451303405516} +0ms
  ble [BLE] {"watts":122,"stroke_count":24,"id":1451303405516} +0ms
BLE state change: poweredOn
  ble advertisingStart: success +65ms
  ble setServices: success +2ms
  network [IN] 192.168.1.87:49470 - {"heart_rate":122,"id":1451303405515} +15ms
  network [IN] 192.168.1.87:49470 - {"watts":122,"stroke_count":24,"id":1451303405516} +0ms
  network [IN] 192.168.1.87:49470 - {"heart_rate":127,"id":1451303405517} +585ms
  ble [BLE] {"heart_rate":127,"id":1451303405517} +0ms
  network [IN] 192.168.1.87:49470 - {"watts":129,"stroke_count":25,"id":1451303405518} +0ms
  ble [BLE] {"watts":129,"stroke_count":25,"id":1451303405518} +0ms
  network [IN] 192.168.1.87:49470 - {"heart_rate":127,"id":1451303405517} +115ms
  network [IN] 192.168.1.87:49470 - {"watts":129,"stroke_count":25,"id":1451303405518} +0ms
```

Happy Rowing!
