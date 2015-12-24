# A Bluetooth LE Cycling Power Service for the WaterRower S4

The objective of this adapter is to expose the WaterRower S4, an indoor rowing "erg", as a Bluetooth LE Cycling Power Service peripheral. The BLE sensor exposes power and stroke rate data, which makes it suitable for using the WaterRower in applications like Zwift, or simply to just record the power, cadence and heart rate date. I am not bothering with distance or pace simply because the speed algorithm in the WR S4 is not accurate, and not comparable to the gold standard in erg, the Concept2. I have found the power reading to be accurate and comparable to the Concept2. And since it's possible to go from watts to 500m splits using Concept2's online calculator or a simple formula, I have focused on solving the problem of power and cadence broadcasting.  In addition, the heart rate is optionally also sent via the BLE sensor when an ANT+ compatible heart rate monitor is connected to the S4 (you will need the WaterRower S4/S5 ANT+ antenna, either in internal or external format).

**Now, be warned ... this code is just a quick Friday afternoon hack!! Use at your own risk! Documentation is mainly for my own reference!**

Initially I wanted to run this on the same machine in which I have Zwift. However, I have troubled getting this working as the messages from/to the WaterRower over the USB-to-serial port conflict with the Zwift messages over USB to the ANT+ devices. Also, it is much cooler and simpler to just setup a dedicated Raspberry Pi connected to the WaterRower, and to automatically get the BLE sensor appear when switching the WaterRower on.

To bypass the ANT+ vs WR conflict over USB, I decided to go the route of a dedicated micro-computer connected to the WR broadcasting via BLE. I went for a Raspberry Pi that I had around and added a Pluggable USB 2.0 Bluetooth 4.0 LE adapter. Unfortunately, I have found plenty of issues with bluetooth in the Pi and in Linux in general. It might just be my devices firmware, but I since I also have issues with the libraries I am using to create the BLE service, etc. I have given up from using BLE in the Raspbery Pi. At least for now. Note that I also tried with a Linux Ubuntu 15.04 box, with the same (failed) result. Ideally, I'd get back to this route, but for now I have had to create a different "hack" solution.

The current setup I am using is:

* The WaterRower S4.2 is connected via USB to the Raspberry Pi, which is running Debian Jessie.
* Debian Jessie supports the S4.2 USB device out of the box as a USB-to-serial adapter. Instead of using the USB port to talk to the WR, we use the serial adapter spec, which is ASCII based and much simpler to deal with. If you want to run this on Windows, or Mac, you'll need to install the Prolific PL2303 driver (Google it). But in Linux this is not necessary.
* I use UDP multicast to send out the WR data. The datagrams are sent to `224.0.0.1`, so a route must be setup in the Raspberry Pi and the Zwift computer to accept multicast. The choice of address is done to leverage the default route setup on Macs and Windows machines. UDP multicast makes discovery easy, and is lightweight and better suited for time-sensitive packets, like in games. However, multicast is not a standard network setup, which is a hurdle for some people. Also, UDP is not reliable, so we may get dupes or missing packets. Dupes we can deal with easily with a sequence number. Missing packets are a problem, since they show up as power drop on the BLE sensor. Maybe we can do UDP for discovery, and TCP for communication (as our latency requirements are not the same as in a shooting game). Or maybe the whole thing goes away once I get BLE working well on the Pi. But for now, UDP is here.
* The Zwift computer runs a program listening to the datagrams, which it then offers out as a Bluetooth LE peripheral. The computer obviously needs to have a Bluetooth 4.0 USB adapter. But all Macs since 2011 have this.
* The Zwift companion app must be running on the phone to pick the Bluetooth signal.
* The computer running the Zwift app must be on the same WIFI network as the phone.

Obviously, you don't need to use Zwift and you can just work with the Raspberry Pi (or whatever computer you have around). You can just use any BLE app on the phone to listen and record the data, e.g. Wahoo Fitness.

## Installation on the Raspberry Pi ##

These instructions are specific to the Raspberry, although it should work in any Linux and Mac with little adaptions. I have no clue if or how this works on Windows, so don't ask.

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

Create route if multicast is missing (change gateway to your intranet gateway address):

```
sudo route add -net 224.0.0.0/4 gw 192.168.2.1
```

Test multicast:

```
ping 224.0.0.1
```

## Installation on Zwift Computer ##

This is on a Mac using homebrew:

```
brew install node
git clone http://github.com/olympum/waterrower-ble
cd waterrower-ble
npm install
```

(the installation might fail because of missing native dependencies; sorry, you'll have to work it out).

You will also need to check routes. On Mac, similarly to the Pi:

```
netstat -nr
```

And if missing, add it, e.g. to en0 (oh, and you could add a whole range, I just do the IP I need, in this case 224.0.0.1):

```
sudo route -nv add -net 224.0.0.1 -interface en0
```

Before your scream ... yea, I know that I don't strictly need the USB side of things in the Zwift computer (or the BLE in the Raspberry Pi for the sake), but I will not bother to split things up since eventually I want to move the BLE sensor to the Pi side of things.

## Rowing with Power ##

Now we are ready to start working hard. Once installed on both the Raspberry Pi and the Zwift computer, the sequence to get this running is the following:

1. Switch on the Raspberry Pi (I just leave it always on).
1. Switch on the WR S4. You will hear a beep.
1. Connect the WR S4 to a USB port on the Raspberry Pi. You should hear another beep.
1. On the Zwift computer, start the BLE peripheral:
    ```
    cd waterrower-ble
    node s4-ble.js
    ```

1. On the phone, open the Zwift app.
1. Open the actual Zwift app, search for BLE peripherals and you'll find a heart rate monitor, and a power meter with crank revolutions (cadence) data.
1. Start rowing and enjoy the workout.

When done, unplug the USB cable from the Pi, otherwise the WR will not power off.

## On Bluetooth LE and the Raspberry Pi ##

`node-bleno` is supporting `bluez` version 4.99, but `bluez` 5.x is now standard in Debian and Ubuntu, so until `bleno` is updated to support 5.x we need to shut down the bluetooth daemon:

```
pi@raspberrypi ~ $ bluetoothd --version
pi@raspberrypi ~ $ sudo /etc/init.d/bluetooth stop
[ ok ] Stopping bluetooth (via systemctl): bluetooth.service.
pi@raspberrypi ~ $ sudo hciconfig hci0 up
```

Unfortunately, even with this step, I could not get this to work reliably and eventually the BLE USB would be auto disconnected and reconnected by the kernel. So, for now, I am not using BLE on the Pi, although I will come back to this in a few months.
