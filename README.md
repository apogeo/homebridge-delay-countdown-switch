# homebridge-countdowndelay-switch

A Homebridge accessory that acts as a delay switch with countdown timer functionality. The remaining time is displayed in the Apple Home app via a Fan accessory using the RotationSpeed characteristic as a percentage.

## Features

- Switch with configurable delay and units (ms, s, m, h, d)
- Countdown timer updated every second
- Optional sensor (motion/contact/leak/occupancy) triggered at end of delay
- Visual timer display via Fan accessory in HomeKit

## Installation

```bash
npm install -g homebridge-countdowndelay-switch
```

## Acknowledgments

This plugin is a derived work based on [homebridge-delay-switch](https://github.com/nitaybz/homebridge-delay-switch) by [Nitay B](https://github.com/nitaybz), licensed under the MIT License.
