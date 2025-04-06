let Service, Characteristic;

module.exports = function (homebridge) {
	Service = homebridge.hap.Service;
	Characteristic = homebridge.hap.Characteristic;
	homebridge.registerAccessory('homebridge-countdowndelay-switch', 'DelayCountdownSwitch', delayCountdownSwitch);
};

function delayCountdownSwitch(log, config, api) {
	const UUIDGen = api.hap.uuid;

	this.log = log;
	this.name = config['name'];
	this.delay = config['delay'] || 0;
	this.delayUnit = config['delayUnit'] || 'ms';
	this.debug = config.debug || false;
	this.sensorType = config['sensorType'] || 'motion';
	this.flipSensor = config['flipSensorState'];
	this.disableSensor = config['disableSensor'] || !config['sensorType'] || this.delay === 0;
	this.startOnReboot = config['startOnReboot'] || false;

	this.switchOn = false;
	this.sensorTriggered = 0;
	this.uuid = UUIDGen.generate(this.name);
	this.remainingTime = 0;
	this.timer = null;

	switch (this.delayUnit) {
		case 's': this.delayTime = this.delay * 1000; break;
		case 'm': this.delayTime = this.delay * 60 * 1000; break;
		case 'h': this.delayTime = this.delay * 60 * 60 * 1000; break;
		case 'd': this.delayTime = this.delay * 24 * 60 * 60 * 1000; break;
		default: this.delayTime = this.delay;
	}

	this.log.easyDebug = (...content) => {
		const message = content.join(' ');
		if (this.debug) this.log(message);
		else this.log.debug(message);
	};

	this.getSensorState = () => {
		const state = this.sensorTriggered;
		if (this.sensorType === 'motion') return this.flipSensor ? !state : !!state;
		return this.flipSensor ? state ^ 1 : state;
	};
}

delayCountdownSwitch.prototype.getServices = function () {
	const services = [];

	// Accessory Information
	const informationService = new Service.AccessoryInformation();
	informationService
		.setCharacteristic(Characteristic.Manufacturer, 'Delay Switch')
		.setCharacteristic(Characteristic.Model, `Delay-${this.delay}${this.delayUnit}`)
		.setCharacteristic(Characteristic.SerialNumber, this.uuid);
	services.push(informationService);

	// Main Switch
	this.switchService = new Service.Switch(this.name);
	this.switchService
		.getCharacteristic(Characteristic.On)
		.on('get', this.getOn.bind(this))
		.on('set', this.setOn.bind(this))
		.updateValue(this.startOnReboot);
	services.push(this.switchService);

	// Optional Sensor
	if (!this.disableSensor) {
		switch (this.sensorType) {
			case 'contact':
				this.sensorService = new Service.ContactSensor(this.name + ' Trigger');
				this.sensorCharacteristic = Characteristic.ContactSensorState;
				break;
			case 'occupancy':
				this.sensorService = new Service.OccupancySensor(this.name + ' Trigger');
				this.sensorCharacteristic = Characteristic.OccupancyDetected;
				break;
			case 'leak':
				this.sensorService = new Service.LeakSensor(this.name + ' Trigger');
				this.sensorCharacteristic = Characteristic.LeakDetected;
				break;
			default:
				this.sensorService = new Service.MotionSensor(this.name + ' Trigger');
				this.sensorCharacteristic = Characteristic.MotionDetected;
				break;
		}

		this.sensorService
			.getCharacteristic(this.sensorCharacteristic)
			.on('get', (callback) => {
				callback(null, this.getSensorState());
			});

		services.push(this.sensorService);
	}

	// Timer Display via Fan
	this.fakeTimerService = new Service.Fan(this.name + ' Timer');
	this.fakeTimerService
		.getCharacteristic(Characteristic.RotationSpeed)
		.on('get', (callback) => {
			const percentage = this.switchOn ? Math.floor((this.remainingTime / this.delayTime) * 100) : 0;
			callback(null, percentage);
		});

	// Optional: show ON/OFF in UI for visual consistency
	this.fakeTimerService
		.getCharacteristic(Characteristic.On)
		.on('get', (callback) => callback(null, this.switchOn))
		.updateValue(this.switchOn);

	services.push(this.fakeTimerService);

	return services;
};

delayCountdownSwitch.prototype.setOn = function (value, callback) {
	if (value === false) {
		this.log.easyDebug('Stopping the Timer');
		this.switchOn = false;
		clearInterval(this.timer);
		this.remainingTime = 0;
		this.sensorTriggered = 0;

		if (!this.disableSensor) {
			this.sensorService.getCharacteristic(this.sensorCharacteristic).updateValue(this.getSensorState());
		}

		this.fakeTimerService.getCharacteristic(Characteristic.RotationSpeed).updateValue(0);
		this.fakeTimerService.getCharacteristic(Characteristic.On).updateValue(false);

	} else if (value === true) {
		this.log.easyDebug('Starting the Timer');
		this.switchOn = true;
		clearInterval(this.timer);
		this.remainingTime = this.delayTime;

		this.fakeTimerService.getCharacteristic(Characteristic.On).updateValue(true);
		this.fakeTimerService.getCharacteristic(Characteristic.RotationSpeed).updateValue(100);

		this.timer = setInterval(() => {
			this.remainingTime -= 1000;
			const percentage = Math.max(Math.floor((this.remainingTime / this.delayTime) * 100), 0);
			this.fakeTimerService.getCharacteristic(Characteristic.RotationSpeed).updateValue(percentage);

			if (this.remainingTime <= 0) {
				this.log.easyDebug('Time is Up!');
				clearInterval(this.timer);
				this.switchOn = false;

				this.switchService.getCharacteristic(Characteristic.On).updateValue(false);
				this.fakeTimerService.getCharacteristic(Characteristic.RotationSpeed).updateValue(0);
				this.fakeTimerService.getCharacteristic(Characteristic.On).updateValue(false);

				if (!this.disableSensor) {
					this.sensorTriggered = 1;
					this.sensorService.getCharacteristic(this.sensorCharacteristic).updateValue(this.getSensorState());

					setTimeout(() => {
						this.sensorTriggered = 0;
						this.sensorService.getCharacteristic(this.sensorCharacteristic).updateValue(this.getSensorState());
					}, 3000);
				}
			}
		}, 1000);
	}

	callback();
};

delayCountdownSwitch.prototype.getOn = function (callback) {
	callback(null, this.switchOn);
};
