const Firmata = require("firmata");

const DC_MESSAGE = 2;
const DC_ON = 1;
const DC_OFF = 2;
const DC_BRAKE = 3;
const DC_INVERSE = 4;
const DC_DIR = 5;
const DC_SPEED = 6;
const FIRMATA_EXTENDED_ANALOG = 0x6F;
const SERVO_DATA = 4;
const SERVO_WRITE = 2;
const LCD_DATA = 3;
const LCD_PRINT = 0;
const LCD_PUSH = 1;
const LCD_CLEAR = 2;

function DC(io, deviceNum) {
    this.io = io;
    this.deviceNum = deviceNum;
    this.on = function() {
        this.io.sysexCommand([DC_MESSAGE,DC_ON,this.deviceNum]);
     }
    this.off = function() {
        this.io.sysexCommand([DC_MESSAGE,DC_OFF,this.deviceNum]);
     }
    this.brake = function() {
        this.io.sysexCommand([DC_MESSAGE,DC_BRAKE,this.deviceNum]);
     }
    this.inverse = function() {
        this.io.sysexCommand([DC_MESSAGE,DC_INVERSE,this.deviceNum]);
     }
    this.direction = function(dir) {
        this.io.sysexCommand([DC_MESSAGE,DC_DIR,this.deviceNum, dir]);
     }
    this.power = function(pow) {
        this.io.sysexCommand([DC_MESSAGE,DC_SPEED,this.deviceNum, pow]);
    }
}

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

function SERVO(io, deviceNum) {
    this.io = io;
    this.deviceNum = deviceNum; 

    this.position = function (pos) {
        //this.io.servoWrite(this.pin, pos);
        var arrPos = Firmata.encode([pos]);
        this.io.sysexCommand([SERVO_DATA,SERVO_WRITE,this.deviceNum, arrPos[0], arrPos[1] ]);
    }
}

function ANALOG(io, channel) {
    this.io = io;
    this.channel = channel;
    this.on = function(callback) {
        this.io.analogRead(this.channel, callback);
    }
    this.off = function () { 
        this.io.reportAnalogPin(this.channel, 0);
    }
}

function DIGITAL(io, pin) {
    this.io = io;
    this.pin = pin;
    this.mode = this.io.MODES.INPUT;
    this.on = function (callback) {
        this.io.pinMode(this.pin, this.mode);
        this.io.digitalRead(this.pin, callback);
    }
    this.pullup = function (enabled) {
        this.mode = (enabled) ? this.io.MODES.PULLUP : this.io.MODES.INPUT;
        this.io.pinMode(this.pin, this.mode);
    }
    this.off = function () { 
        this.io.reportDigitalPin(this.pin, 0);
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

module.exports = function (five) {
    return (function() {
  
      function Interfaz(opts) {
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
  
        
        // Define Component initialization
        this._dc = [new DC(this.io, 0),new DC(this.io, 1),new DC(this.io, 2),new DC(this.io, 3),new DC(this.io, 4),new DC(this.io, 5),new DC(this.io, 6),new DC(this.io, 7)];
        this._steppers = [new STEPPER(this.io, 0),new STEPPER(this.io, 1),new STEPPER(this.io, 2)];
        this._servos = [new SERVO(this.io, 0),new SERVO(this.io, 1),new SERVO(this.io, 2)];
        this._analogs = [new ANALOG(this.io, 0),new ANALOG(this.io, 1),new ANALOG(this.io, 2),new ANALOG(this.io, 3),new ANALOG(this.io, 4),new ANALOG(this.io, 5),new ANALOG(this.io, 6),new ANALOG(this.io, 7)];
        this._digitals = [new DIGITAL(this.io, 64), new DIGITAL(this.io, 65), new DIGITAL(this.io, 66), new DIGITAL(this.io, 67), new DIGITAL(this.io, 68), new DIGITAL(this.io, 69)];
        this._i2cs = [];
        this._lcd = new LCD(this.io);
  
      }
  
        Interfaz.prototype.output = function (index) {
            if (index < 1) return this._dc[0];
            if (index > 8) return this._dc[7];
            return this._dc[index - 1];
        }
        Interfaz.prototype.stepper = function (index) {
            if (index < 1) return this._steppers[0];
            if (index > 3) return this._steppers[2];
            return this._steppers[index - 1];
        }
        Interfaz.prototype.servo = function (index) {
            if (index < 1) return this._servos[0];
            if (index > 3) return this._servos[2];
            return this._servos[index - 1];
        }
        Interfaz.prototype.analog = function (index) {
            if (index < 1) return this._analogs[0];
            if (index > 8) return this._analogs[7];
            return this._analogs[index - 1];
        }
        Interfaz.prototype.digital = function (index) {
            if (index < 1) return this._digitals[0];
            if (index > 6) return this._digitals[5];
            return this._digitals[index - 1];
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