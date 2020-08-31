var pixel = require("./lib/pixel.js");

String.prototype.formatUnicorn = String.prototype.formatUnicorn ||
function () {
    "use strict";
    var str = this.toString();
    if (arguments.length) {
        var t = typeof arguments[0];
        var key;
        var args = ("string" === t || "number" === t) ?
            Array.prototype.slice.call(arguments)
            : arguments[0];

        for (key in args) {
            str = str.replace(new RegExp("\\{" + key + "\\}", "gi"), args[key]);
        }
    }

    return str;
};

function PrintQueue() {
    this.queue = "";

    this.add = function(data) {
        console.log(data) 
        this.queue = data;
    }

    this.get = function() {
        return this.queue;
    }
}


var _pq = new PrintQueue();

function RastiCC(io, config, deviceNum) {
    this.io = io;
    this.deviceNum = deviceNum;
    this.s1 = config[0];
    this.s2 = config[1];
    this.dir = 0;
    this.mode = this.io.MODES.OUTPUT;
    this.io.pinMode(this.s1, this.mode);
    this.io.pinMode(this.s2, this.mode);
    /*
    this.speed = 255;
    */
    this.onif = function() {
        if(this.status) {
            if(!this.dir) {
                this.io.digitalWrite(this.s2, 1);
                this.io.digitalWrite(this.s1, 0);
            } else {
                this.io.digitalWrite(this.s1, 1);
                this.io.digitalWrite(this.s2, 0);
            }
        }
    }
    this.on = function() {
        this.status = 1;
        this.onif();
    }
    this.off = function() {
        this.io.digitalWrite(this.s2, 0);
        this.io.digitalWrite(this.s1, 0);
        this.status = 0;
    }
    this.inverse = function() {
        this.direction(!this.dir);
    }
    this.direction = function(dir) {
        this.dir = dir;
        this.onif();
    }
    this.power = function(pow) {
    }
}

function DCL293(io, deviceNum) {
    this.io = io;
    this.dir = 0;
    this.speed = 255;
    this.status = 0;
    this.deviceNum = deviceNum;
    this.row0 = "salida {0}".formatUnicorn(this.deviceNum+1);
    this.io.on("brake", function(e,t){
        var motor = this;
        setTimeout(function(){
            motor.stop();
            },200);
    });
    this.onif = function() {
        if(this.status) {
            if(!this.dir) {
                this.io.forward(this.speed);
            } else {
                this.io.reverse(this.speed);
            }
        }
    }
    this.on = function() {
        this.status = 1;
        this.onif();
        _pq.add([this.row0, "encendido {0} {1}%".formatUnicorn(this.dir ? "B" : "A", Math.floor(this.speed/255*100))])
		return true;
    }
    this.off = function() {
        this.io.stop();
        this.status = 0;
        _pq.add([this.row0, "apagado"])
		return true;
    }
    this.brake = function() {
        this.io.brake();
        _pq.add([this.row0, "frenado"])
		return true;
    }
    this.inverse = function() {
        this.direction(!this.dir);
        _pq.add([this.row0, "invertido ({0})".formatUnicorn(this.dir ? "B" : "A")])
		return true;
    }
    this.direction = function(dir) {
        this.dir = dir;
        this.onif();
        _pq.add([this.row0, "direccion {0}".formatUnicorn(this.dir ? "B" : "A")])
		return true;
    }
    this.power = function(pow) {
        this.speed = pow;
        this.onif();
        _pq.add([this.row0, "potencia {0}%".formatUnicorn(Math.floor(pow/255*100))])
		return true;
    }
}

const DC_MESSAGE = 2
const DC_ON = 1
const DC_OFF = 2
const DC_BRAKE = 3
const DC_INVERSE = 4
const DC_DIR = 5
const DC_SPEED = 6

function DC(io, deviceNum) {
    this.io = io;
    this.dir = 0;
    this.deviceNum = deviceNum;
    this.speed = 100;
    this.row0 = "salida {0}".formatUnicorn(this.deviceNum+1);
    this.on = function() {
        this.io.sysexCommand([DC_MESSAGE,DC_ON,this.deviceNum]);
        _pq.add([this.row0, "encendido {0} {1}%".formatUnicorn(this.dir ? "B" : "A", Math.floor(this.speed))]);
        return true;
     }
    this.off = function() {
        this.io.sysexCommand([DC_MESSAGE,DC_OFF,this.deviceNum]);
        _pq.add([this.row0, "apagado"]);
        return true;
     }
    this.brake = function() {
        this.io.sysexCommand([DC_MESSAGE,DC_BRAKE,this.deviceNum]);
        _pq.add([this.row0, "frenado"])
        return true;
    }
    this.inverse = function() {
        this.dir = !dir;
        this.io.sysexCommand([DC_MESSAGE,DC_INVERSE,this.deviceNum]);
        _pq.add([this.row0, "invertido ({0})".formatUnicorn(this.dir ? "B" : "A")]);
        return true;
    }
    this.direction = function(dir) {
        this.dir = dir;
        this.io.sysexCommand([DC_MESSAGE,DC_DIR,this.deviceNum, dir]);
        _pq.add([this.row0, "direccion {0}".formatUnicorn(this.dir ? "B" : "A")]);
        return true;
    }
    this.power = function(pow) {
        this.speed = pow;
        this.io.sysexCommand([DC_MESSAGE,DC_SPEED,this.deviceNum, pow]);
        _pq.add([this.row0, "potencia {0}%".formatUnicorn(Math.floor(pow))]);
        return true;
    }
}

/*
function STEPPER(io, deviceNum) {
    this.io = io;
    this.deviceNum = deviceNum;
    this.steps = function (steps, callback) {
        this.io.accelStepperEnable(this.deviceNum, true);
        this.io.accelStepperStep(this.deviceNum, steps, callback);
    }
    this.stop = function () {
        this.io.accelStepperStop(this.deviceNum);
    }
    this.speed = function (speed) {
        this.io.accelStepperSpeed(this.deviceNum, speed);
    }
}
*/
function ACCELSTEPPER(io, stepPin, directionPin, enablePin, deviceNum) {
    this.io = io;
    this.deviceNum = deviceNum;
    
    this.io.accelStepperConfig({
        deviceNum: this.deviceNum,
        type: this.io.STEPPER.TYPE.DRIVER,
        stepPin: stepPin,
        directionPin: directionPin,
        enablePin: enablePin
    });
    this.io.accelStepperSpeed(this.deviceNum, 180);
    // this.io.accelStepperAcceleration(this.deviceNum, 0);
    this.row0 = "paso a paso {0}".formatUnicorn(this.deviceNum+1);
          
    this.steps = function (steps, callback) {
        this.io.accelStepperEnable(this.deviceNum, false);
        this.io.accelStepperStep(this.deviceNum, steps, position => {
            this.io.accelStepperEnable(this.deviceNum, true);
            callback(position);
        });
        _pq.add([this.row0, "{0} pasos".formatUnicorn(steps)])
        return true;
    }
    this.stop = function () {
        this.io.accelStepperStop(this.deviceNum);
        _pq.add([this.row0, "detenido"])
		return true;
    }
    this.speed = function (speed) {
        this.io.accelStepperSpeed(this.deviceNum, speed);
        _pq.add([this.row0, "vel. {0} rpm".formatUnicorn(speed)])
		return true;
    }
}

/*
function SERVO(io, deviceNum) {
    this.io = io;
    this.deviceNum = deviceNum; 

    this.position = function (pos) {
        //this.io.servoWrite(this.pin, pos);
        var arrPos = Firmata.encode([pos]);
        this.io.sysexCommand([SERVO_DATA,SERVO_WRITE,this.deviceNum, arrPos[0], arrPos[1] ]);
    }
}
*/
function SERVOJ5(io, deviceNum) {
    this.io = io;
    this.deviceNum = deviceNum; 
    this.row0 = "servo {0}".formatUnicorn(this.deviceNum+1);
    this.position = function (pos) {
        this.io.to(pos);
        _pq.add([this.row0, "posicion {0}".formatUnicorn(pos)])
		return true;
    }
}

/*
function ANALOG(io, channel) {
    this.io = io;
    this.channel = channel;
    this.row0 = "entrada {0}".formatUnicorn(this.channel+1);
    this.sensor = false;
    this.on = function(callback) {
        this.io.analogRead(this.channel, callback);
        _pq.add([this.row0, "reportando"])
		return true;
    }
    this.off = function () { 
        this.io.reportAnalogPin(this.channel, 0);
        _pq.add([this.row0, "apagada"])
		return true;
    }
}
*/

function PIN(io, deviceNum) {
    this.io = io;
    this.deviceNum = deviceNum;
    this.on = function() {
        this.io.high();
    }
    this.off = function() {
        this.io.low();
    }
    this.write = function(value) {
        this.io.io.pinMode(this.io.pin, 3);
        this.io.io.analogWrite(this.io.pin, value)
    }
}

function SENSOR(five, io, channel,pin) {
    this.five = five;
    this.io = io;
    this.pin = pin;
    this.channel = channel;
    this.row0 = "entrada {0}".formatUnicorn(this.channel+1);
    this.sensor = false;
    this.mode = this.io.MODES.ANALOG;
    this.on = function(callback) {
        this.io.pinMode(this.pin, this.mode);
        this.sensor = new five.Sensor("A"+this.channel);
        this.sensor.on("data", callback);
        _pq.add([this.row0, "reportando"])
		return true;
    }
    this.off = function () { 
        this.io.reportAnalogPin(this.channel, 0);
        if(this.sensor) this.sensor.removeAllListeners();
        _pq.add([this.row0, "apagada"])
		return true;
    }
}


function DIGITAL(io, pin, channel) {
    this.io = io;
    this.channel = channel;
    this.pin = pin;
    this.mode = this.io.MODES.INPUT;
    this.row0 = "entrada digital {0}".formatUnicorn(this.channel + 1);
    this.on = function (callback) {
        this.io.pinMode(this.pin, this.mode);
        this.io.digitalRead(this.pin, callback);
        _pq.add([this.row0, "reportando"])
		return true;
    }
    this.pullup = function (enabled) {
        this.mode = (enabled) ? this.io.MODES.PULLUP : this.io.MODES.INPUT;
        this.io.pinMode(this.pin, this.mode);
        _pq.add([this.row0, "pullup"])
		return true;
    }
    this.off = function () { 
        this.io.reportDigitalPin(this.pin, 0);
        _pq.add([this.row0, "apagada"])
		return true;

    }    
}

function I2C(io, address) {
    this.io = io;
    this.address = address;
    this.on = function (register, numberOfBytesToRead, callback) {
        this.io.i2cRead(this.address, register, numberOfBytesToRead, callback);
    }
    /* NOT IMPLEMENTED 
    this.off = function (register) {
        this.io.i2cRead(this.address, register, 0, function () { });
    }
    /****/
    this.read = function (register, numberOfBytesToRead, callback) {
        this.io.i2cReadOnce(this.address, register, numberOfBytesToRead, callback);
    }
    this.write = function (register, data) {
        this.io.i2cWrite(this.address, register, data);
    }
}

function LCDPCF8574(io) {
    this.io = io;
    this.io.backlight().home().noBlink().noCursor().on();
    this.handle = setTimeout(function(){}, 1);
    this.timeout = 200;
    this.enabled = true;
    this.row0 = "display"
    this.on = function() {
        this.io.backlight().on();
        this.enabled = true;
        this.message([this.row0, "encendido"]);
        return {};
    }
    this.off = function() {
        this.io.noBacklight();
        this.silence();
        return {};
    }
    this.silence = function() {
        this.enabled = false;
        this.message([this.row0, "silenciado"], true);
        return {};
    }
    this.clear = function() {
        this.io.clear();
        return {};
    }
    this.print = function(row, str) {
        var col = Math.floor((16-(str.length))/2);
        this.io.cursor(row,col).print(str);
        return {};
    }
    this.setTimeout = function() {
        var me = this;
        if(!this.data) return;
        data = this.data;
        this.handle = setTimeout(function(){
            if(data.length > 0) {
                me.io.clear();
                me.print(0, data[0])
            }
            if(data.length > 1) {
                me.print(1, data[1])
            }
            me.data = false;
            _pq.clear();
        }, this.timeout);
    }
    this.clearTimeout = function() {
        clearTimeout(this.handle);
        return {};
    }
   
    this.message = function(force) {
        if(!force && !this.enabled) return;
        this.data = _pq.get();
        this.setTimeout();
        return this.data;
    }
} 

function PING(five, channel, controller, io) {
    this.five = five;
    this.io = io;
    this.channel = channel;
    this.row0 = "entrada {0}".formatUnicorn(this.channel+1);
    this.sensor = false;
    this.on = function(callback) {
        if(this.sensor) this.sensor.removeAllListeners();
        this.sensor = new five.Proximity({
            controller: controller,
            pin: "A"+this.channel
          });
        this.sensor.on("data", callback);
        _pq.add([this.row0, "ultrasonido"])
		return true;
    }
    this.off = function () { 
        this.io.reportAnalogPin(this.channel, 0);
        this.sensor.removeAllListeners();
    }

}

function PIXEL(board, pin, index) {
    this.board = board;
    this.pin = pin;
    this.index = index;
    this.strip = false;
    this.row0 = "pixel {0}".formatUnicorn(this.index);
    this.create = function(length) {
        this.length = length;
        this.strip = new pixel.Strip({
            data: this.pin,
            length: this.length,
            skip_firmware_check: true,
            color_order: pixel.COLOR_ORDER.GRB,
            board: this.board,
            controller: "FIRMATA",
        });        
        _pq.add([this.row0, "creado"])
		return true;
    }
    this.pixel = function(i) {
        return (this.strip) ?  this.strip.pixel(i-1) : false;
    }
    this.color = function(color, i) {
        if(!this.strip) return;
        if(i > 0) {
            if(i > this.length) return;
            var el = this.strip.pixel(i - 1);
        } else {
            var el = this.strip;
        }
        el.color(color);
        this.strip.show();
        _pq.add([this.row0, "color"])
		return true;
    }
    this.shift = function(offset, direction, wrap) {
        if(!this.strip) return;
        this.strip.shift(offset, direction, wrap);
        this.strip.show();
        _pq.add([this.row0, "desplazado"])
		return true;
    }
    this.on = function(i) {
        if(!this.strip) return;
        if(i > 0) {
            if(i > this.length) return;
            var el = this.strip.pixel(i - 1);
        } else {
            var el = this.strip;
        }
        el.color("white");
        this.strip.show();
        _pq.add([this.row0, "encendido"])
		return true;
    }
    this.off = function (i) { 
        if(!this.strip) return;
        if(i > 0) {
            if(i > this.length) return;
            var el = this.strip.pixel(i - 1);
        } else {
            var el = this.strip;
        }
        el.off();
        this.strip.show();
        _pq.add([this.row0, "apagado"])
		return true;
    }

}

function I2CJoystick(five, index) {
    this.index = index;
    this.virtual = new five.Board.Virtual(
        new five.Expander("PCF8591")
      );
    this.sensors = new five.Sensors([
        {
            pin: "A0",
            threshold: 100,
            board: this.virtual
        },
        {
            pin: "A1",
            threshold: 100,
            board: this.virtual
        },
        {
            pin: "A2",
            threshold: 100,
            board: this.virtual
        }                
    ])
      this.row0 = "Joystick ".formatUnicorn(this.index);
      this.on = function(callbackX) {
        this.sensors.on("data", callbackX);
        _pq.add([this.row0, "reportando"])
		return true;
    }
}

/*
function LCD(io) {
    this.io = io;
    this.print = function(row, str) {
        var buffer = new Buffer(str, 'utf16le');
        var commands = new Array();
        commands[0] = LCD_DATA;
        commands[1] = LCD_PRINT;
        commands[2] = row;
        for (var i = 0; i < buffer.length; i++) {
            commands.push(buffer[i]);
        }    
        this.io.sysexCommand(commands);
    }
    this.push = function(str) {
        var buffer = new Buffer(str, 'utf16le');
        var commands = new Array();
        commands[0] = LCD_DATA;
        commands[1] = LCD_PUSH;
        for (var i = 0; i < buffer.length; i++) {
            commands.push(buffer[i]);
        }    
        this.io.sysexCommand(commands);
    }
    this.clear = function() {
        this.io.sysexCommand([LCD_DATA, LCD_CLEAR]);

    }
}
*/
module.exports = function (five) {
    return (function(opts) {
  
      function Interfaz(board) {
        if (!(this instanceof Interfaz)) {
          return new Interfaz(opts);
        }

        // Board.Component
        //    - Register the component with an
        //      existing Board instance.
        //
        // Board.Options
        //    - Normalize incoming options
        //      - Convert string or number pin values
        //        to `this.pin = value`
        //      - Calls an IO Plugin's `normalize` method
        //
        five.Board.Component.call(
          this, opts = five.Board.Options(opts)
        );
  
        this.board = board;
        this._dc = new Array();
        this._servos = new Array();
        this._steppers = new Array();
        this._i2cs = new Array();
        this._lcd = new LCDPCF8574(new five.LCD({
            controller: "PCF8574",
            address:  0x27,
            bus: 2,
            rows: 2,
            cols: 16
        }));
        
    }
    
    Interfaz.prototype.init = function(opts) {
        // Define Component initialization
        switch(this.board.type) {
            case "UNO": opts.model = "uno"; break;
            case "MEGA": opts.model = "mega"; break;
            case "OTHER": opts.model = "rasti"; break;
        }
        this.opts = opts;
        switch(opts.model) {
            case "uno":
                if(this.board.type != "UNO") return;
                this.MAXOUTPUTS = 4;
                this.MAXSTEPPERS = 0;
                this.MAXSERVOS = 2;
                this.MAXANALOGS = 4;
                this.MAXDIGITAL = 4;
                this.MAXPIXELS = 2;
                this.MAXI2CJOYSTICK = 1;
                //var configs = five.Motor.SHIELD_CONFIGS.ADAFRUIT_V1;
                //this.dc_config = [configs.M1,configs.M2, configs.M3, configs.M4];
                this.servo_config = [9,10];
                this.analog_config = [14,15,16,17];
                this.digital_config = [14,15,16,17];
                this.pixels_config = [9,10];
                this._servos = new Array(); 
                this._analogs = new Array(); 
                this._digitals = new Array();
                this._pings = new Array();
                this._pixels = new Array();
                this._i2cjoysticks = new Array();
            break;
            case "mega":
                if(this.board.type != "MEGA") return;
                this.MAXOUTPUTS = 8;
                this.MAXSTEPPERS = 3;
                this.MAXSERVOS = 3;
                this.MAXANALOGS = 8;
                this.MAXDIGITAL = 6;
                this.servo_config = [10,11,12];
                this.digital_config = [64,65,66,67,68,69];
                this.dc_config = [
                    {pins: {pwm:2,dir:22,cdir:23}}, 
                    {pins: {pwm:3,dir:24,cdir:25}}, 
                    {pins: {pwm:4,dir:26,cdir:27}},
                    {pins: {pwm:5,dir:28,cdir:29}},
                    {pins: {pwm:6,dir:30,cdir:31}},
                    {pins: {pwm:7,dir:32,cdir:33}},
                    {pins: {pwm:8,dir:34,cdir:35}},                  
                    {pins: {pwm:9,dir:36,cdir:37}}                        
                ];
                this._steppers.push(new ACCELSTEPPER(this.io, 38, 39, 40, 0));
                this._steppers.push(new ACCELSTEPPER(this.io, 41, 42, 43, 1));
                this._steppers.push(new ACCELSTEPPER(this.io, 44, 45, 46, 2));
                this._servos = new Array();
                this._analogs = new Array();
                this._digitals =new Array(); 
                this._pings = new Array();
                break;
                case "rasti":
                    this.MAXANALOGS = 6;
                    this.MAXDIGITAL = 4;
                    this.MAXPINS = 4;
                    this.MAXOUTPUTS = 2;
                    this.MAXSERVOS = 2;
                    this.MAXPIXELS = 4;
                    this.MAXI2CJOYSTICK = 1;
                    this.digital_config = [9,10,11,12];
                    this.analog_config = [14,15,16,17];
                    this.pixels_config = [9,10,11,12];
                    //this.dc_config = [[6,7],[4,5]]
                    this.pins_config = [9,10,11,12];
                    this.servo_config = [9,10,11,12];
                    this._servos = new Array();
                    this._analogs = new Array();
                    this._digitals = new Array();
                    this._pins = new Array();
                    this._pings = new Array();
                    this._pixels = new Array();
                    this._i2cjoysticks = new Array();
            break;
        }
           console.log(this);
            return opts.model;
    }

        Interfaz.prototype.lcdModel = function() {
            return this.opts.model != "rasti"
        }
  
        Interfaz.prototype.output = function (index) {
            if (index < 1)  index = 1;
            if (index > this.MAXOUTPUTS) return index = this.MAXOUTPUTS;
            if(typeof this._dc[index-1] == "undefined") {
                /*
                if(this.opts.model == "rasti") {
                    this._dc[index-1] = new RastiCC(this.io, this.dc_config[index-1], index-1);
                } else {
                    this._dc[index-1] = new DCL293(new five.Motor(this.dc_config[index-1]), index-1);
                }
                */
               this._dc[index-1] = new DC(this.io, index-1);

            }
            return this._dc[index - 1];
        }

        Interfaz.prototype.stepper = function (index) {
            if (index < 1) return this._steppers[0];
            if (index > this.MAXSTEPPERS) return this._steppers[this.MAXSTEPPERS - 1];
            return this._steppers[index - 1];
        }
        Interfaz.prototype.servo = function (index) {
            if (index < 1) index = 0;
            if (index > this.MAXSERVOS) return index = this.MAXSERVOS - 1;
            if(typeof this._servos[index-1] == "undefined") {
                this._servos[index-1] = new SERVOJ5(new five.Servo(this.servo_config[index-1]), index-1);
            }
            return this._servos[index - 1];
        }
        Interfaz.prototype.analog = function (index) {
            if (index < 1) index = 1;
            if (index > this.MAXANALOGS) index = this.MAXANALOGS;
          
            if(typeof this._analogs[index-1] == "undefined") {
                    this._analogs[index-1] = new SENSOR(five, this.io, index - 1, this.analog_config[index-1]);
            }
            return this._analogs[index-1];
            /*
            if (index < 1) return this._analogs[0];
            if (index > this.MAXANALOGS) return this._analogs[this.MAXANALOGS - 1];
            return this._analogs[index - 1];
            */
        }
        Interfaz.prototype.digital = function (index) {
            if (index < 1)  index = 1;
            if (index > this.MAXDIGITAL) return index = this.MAXDIGITAL;
            if(typeof this._digitals[index-1] == "undefined") {
                this._digitals[index-1] = new DIGITAL(this.io, this.digital_config[index-1], index-1);
            }
            return this._digitals[index - 1];
        }

        Interfaz.prototype.pin = function (index) {
            if (index < 1)  index = 1;
            if (index > this.MAXPINS) return index = this.MAXPINS;
            if(typeof this._pins[index-1] == "undefined") {
                this._pins[index-1] = new PIN(new five.Pin(
                    {
                        pin: this.pins_config[index-1]
                    }), index-1);
            }
            return this._pins[index - 1];
        }

        Interfaz.prototype.i2c = function (address, delay) {
            if (typeof this._i2cs[address] == "undefined") {
                this._i2cs[address] = new I2C(this.io, address);
                if (typeof delay == "undefined") delay = 50;
                this.io.i2cConfig({ address: address, delay: delay });
            }
            return this._i2cs[address];
        }
        Interfaz.prototype.lcd = function() {
            return this._lcd;
        }
        Interfaz.prototype.ping = function (index, controller) {
            if (index < 1) index = 1;
            if (index > this.MAXANALOGS) index = this.MAXANALOGS;
            if(typeof controller == "undefined") controller = "HCSR04";
            if(typeof this._pings[index-1] == "undefined") {
                this._pings[index-1] = new PING(five, index-1, controller, this.io);
            }
            return this._pings[index-1];
        }
        
        Interfaz.prototype.pixel = function (index, controller) {
            if (index < 1) index = 1;
            if (index > this.MAXPIXELS) index = this.MAXPIXELS;
            if(typeof this._pixels[index-1] == "undefined") {
                this._pixels[index-1] = new PIXEL(this.board, this.pixels_config[index-1], index);
            }
            return this._pixels[index-1];
        }

        Interfaz.prototype.I2CJoystick = function (index) {
            if (index < 1)  index = 1;
            if (index > this.MAXI2CJOYSTICK) index = this.MAXI2CJOYSTICK;
            if(typeof this._i2cjoysticks[index-1] == "undefined") {
                this._i2cjoysticks[index-1] = new I2CJoystick(five, index);
            }
            return this._i2cjoysticks[index - 1];
        }        
  
      return Interfaz;
    }());
  };
  
  
  /**
   *  To use the plugin in a program:
   *
   *  var five = require("johnny-five");
   *  var Interfaz = require("interfaz")(five);
   *
   *
   */