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
        return {"message":[this.row0, "encendido {0} {1}%".formatUnicorn(this.dir ? "B" : "A", Math.floor(this.speed/255*100))]}
    }
    this.off = function() {
        this.io.stop();
        this.status = 0;
        return {"message":[this.row0, "apagado"]}
    }
    this.brake = function() {
        this.io.brake();
        return {"message":[this.row0, "frenado"]}
    }
    this.inverse = function() {
        this.direction(!this.dir);
        return {"message":[this.row0, "invertido ({0})".formatUnicorn(this.dir ? "B" : "A")]}
    }
    this.direction = function(dir) {
        this.dir = dir;
        this.onif();
        return {"message":[this.row0, "direccion {0}".formatUnicorn(this.dir ? "B" : "A")]}
    }
    this.power = function(pow) {
        this.speed = pow;
        this.onif();
        return {"message":[this.row0, "potencia {0}%".formatUnicorn(Math.floor(pow/255*100))]}
    }
}
/*
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
*/
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
        return {"message":[this.row0, "{0} pasos".formatUnicorn(steps)]}
    }
    this.stop = function () {
        this.io.accelStepperStop(this.deviceNum);
        return {"message":[this.row0, "detenido"]}
    }
    this.speed = function (speed) {
        this.io.accelStepperSpeed(this.deviceNum, speed);
        return {"message":[this.row0, "vel. {0} rpm".formatUnicorn(speed)]}
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
        return {"message":[this.row0, "posicion {0}".formatUnicorn(pos)]}
    }
}

function ANALOG(io, channel) {
    this.io = io;
    this.channel = channel;
    this.row0 = "entrada {0}".formatUnicorn(this.channel+1);
    this.on = function(callback) {
        this.io.analogRead(this.channel, callback);
        return {"message":[this.row0, "reportando"]}
        
    }
    this.off = function () { 
        this.io.reportAnalogPin(this.channel, 0);
        return {"message":[this.row0, "apagada"]}
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
        return {"message":[this.row0, "reportando"]}
    }
    this.pullup = function (enabled) {
        this.mode = (enabled) ? this.io.MODES.PULLUP : this.io.MODES.INPUT;
        this.io.pinMode(this.pin, this.mode);
        return {"message":[this.row0, "pullup"]}
    }
    this.off = function () { 
        this.io.reportDigitalPin(this.pin, 0);
        return {"message":[this.row0, "apagada"]}

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
        }, this.timeout);
    }
    this.clearTimeout = function() {
        clearTimeout(this.handle);
        return {};
    }
    this.message = function(data, force) {
        if(!force && !this.enabled) return;
        this.data = data;
        this.setTimeout();
        return {};
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
        }
        switch(opts.model) {
            case "uno":
                if(this.board.type != "UNO") return;
                this.MAXOUTPUTS = 4;
                this.MAXSTEPPERS = 0;
                this.MAXSERVOS = 2;
                this.MAXANALOGS = 4;
                this.MAXDIGITAL = 0;
                var configs = five.Motor.SHIELD_CONFIGS.ADAFRUIT_V1;
                this._dc.push(new DCL293(new five.Motor(configs.M1), 0));
                this._dc.push(new DCL293(new five.Motor(configs.M2), 1));
                this._dc.push(new DCL293(new five.Motor(configs.M3), 2));
                this._dc.push(new DCL293(new five.Motor(configs.M4), 3));
                this._servos.push(new SERVOJ5(new five.Servo(9), 0));
                this._servos.push(new SERVOJ5(new five.Servo(10), 1));
                this._analogs = [new ANALOG(this.io, 0),new ANALOG(this.io, 1),new ANALOG(this.io, 2),new ANALOG(this.io, 3)];
                break;
                case "mega":
                    if(this.board.type != "MEGA") return;
                    this.MAXOUTPUTS = 8;
                    this.MAXSTEPPERS = 3;
                    this.MAXSERVOS = 3;
                    this.MAXANALOGS = 8;
                    this.MAXDIGITAL = 6;
                    this._dc.push(new DCL293(new five.Motor({pins: {pwm:2,dir:22,cdir:23}}), 0));
                this._dc.push(new DCL293(new five.Motor({pins: {pwm:3,dir:24,cdir:25}}), 1));
                this._dc.push(new DCL293(new five.Motor({pins: {pwm:4,dir:26,cdir:27}}), 2));
                this._dc.push(new DCL293(new five.Motor({pins: {pwm:5,dir:28,cdir:29}}), 3));
                this._dc.push(new DCL293(new five.Motor({pins: {pwm:6,dir:30,cdir:31}}), 4));
                this._dc.push(new DCL293(new five.Motor({pins: {pwm:7,dir:32,cdir:33}}), 5));
                this._dc.push(new DCL293(new five.Motor({pins: {pwm:8,dir:34,cdir:35}}), 6));
                this._dc.push(new DCL293(new five.Motor({pins: {pwm:9,dir:36,cdir:37}}), 7));
                this._servos.push(new SERVOJ5(new five.Servo(10), 0));
                this._servos.push(new SERVOJ5(new five.Servo(11), 1));
                this._servos.push(new SERVOJ5(new five.Servo(12), 2));
                this._analogs = [new ANALOG(this.io, 0),new ANALOG(this.io, 1),new ANALOG(this.io, 2),new ANALOG(this.io, 3),new ANALOG(this.io, 4),new ANALOG(this.io, 5),new ANALOG(this.io, 6),new ANALOG(this.io, 7)];
                this._steppers.push(new ACCELSTEPPER(this.io, 38, 39, 40, 0));
                this._steppers.push(new ACCELSTEPPER(this.io, 41, 42, 43, 1));
                this._steppers.push(new ACCELSTEPPER(this.io, 44, 45, 46, 2));
                this._digitals = [new DIGITAL(this.io, 64, 0), new DIGITAL(this.io, 65, 1), new DIGITAL(this.io, 66, 2), new DIGITAL(this.io, 67, 3), new DIGITAL(this.io, 68, 4), new DIGITAL(this.io, 69, 5)];
                break;
            }
            return opts.model;
    }
  
        Interfaz.prototype.output = function (index) {
            if (index < 1) return this._dc[0];
            if (index > this.MAXOUTPUTS) return this._dc[this.MAXOUTPUTS - 1];
            return this._dc[index - 1];
        }
        Interfaz.prototype.stepper = function (index) {
            if (index < 1) return this._steppers[0];
            if (index > this.MAXSTEPPERS) return this._steppers[this.MAXSTEPPERS - 1];
            return this._steppers[index - 1];
        }
        Interfaz.prototype.servo = function (index) {
            if (index < 1) return this._servos[0];
            if (index > this.MAXSERVOS) return this._servos[this.MAXSERVOS - 1];
            return this._servos[index - 1];
        }
        Interfaz.prototype.analog = function (index) {
            if (index < 1) return this._analogs[0];
            if (index > this.MAXANALOGS) return this._analogs[this.MAXANALOGS - 1];
            return this._analogs[index - 1];
        }
        Interfaz.prototype.digital = function (index) {
            if (index < 1) return this._digitals[0];
            if (index > this.MAXDIGITAL) return this._digitals[this.MAXDIGITAL - 1];
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