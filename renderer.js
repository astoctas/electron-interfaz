// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.

const serialport = require('serialport')
const createTable = require('data-table');
var app = require('http').createServer(handler)
var io = require('socket.io').listen(app, { origins: '*:*' });
var fs = require('fs');

var five = require('johnny-five');
var Interfaz = require("./interfaz")(five);

var os = require('os');
var ifaces = os.networkInterfaces();
//const { VM } = require('vm2');

var ips = new Array();

Object.keys(ifaces).forEach(function (ifname) {
  var alias = 0;

  ifaces[ifname].forEach(function (iface) {
    if ('IPv4' !== iface.family || iface.internal !== false) {
      // skip over internal (i.e. 127.0.0.1) and non-ipv4 addresses
      return;
    }
    ips.push(iface.address);

    if (alias >= 1) {
      // this single interface has multiple ipv4 addresses
      console.log(ifname + ':' + alias, iface.address);
    } else {
      // this interface has only one ipv4 adress
      console.log(ifname, iface.address);
    }
    ++alias;
  });
});


/* WEB SERVER */
var socketPort = 4268;
app.listen(socketPort);

var msg = document.getElementById("socket-msg");
msg.innerHTML = "Socket abierto en: ";
msg.innerHTML += "<br/>127.0.0.1:"+socketPort;
ips.forEach(function(i,v){
  msg.innerHTML += "<br/>"+i+":"+socketPort;
})


function handler(req, res) {
  fs.readFile(__dirname + '/public' + req.url,
    function (err, data) {
      if (err) {
        res.writeHead(404);
        return res.end('Not found');
      }
      res.writeHead(200);
      res.end(data);
    });
}

/* JOHNNY-FIVE GATEWAY */
var board;
var ifaz;
var instances = new Array();
var reconnectFlag = false;

function start(port, model) {
  ifaz = new Interfaz();
  ifaz.init({model: model});
  window.localStorage.setItem("model", model);
  var lcd = ifaz.lcd();
  lcd.message(["Conectado en",port]);


}
/*
board = new five.Board({ 
  repl: false
});
board.on("ready", function () {
  var led = new five.Led(13);
  led.blink();
  start();
});

*/

io.sockets.on('connection', function (socket) {

  socket.emit("SOCKET_CONNECTED");

  socket.on('INTERFAZ', function (data) {
    if(typeof board != "undefined") {
      start(board.port, data.model);
    }
  })


  socket.on('RESTART', function () {
    window.location.reload();
  })


  socket.on('OUTPUT', function (data) {
    if(typeof ifaz == "undefined") return;
    ifaz.lcd().clearTimeout();
    var result = ifaz.output(data.index)[data.method](data.param);
    if(result.hasOwnProperty("message")) ifaz.lcd().message(result.message); else  ifaz.lcd().setTimeout();
  })
  
  socket.on('STEPPER', function (data) {
    if(typeof ifaz == "undefined") return;
    ifaz.lcd().clearTimeout();
    var result = ifaz.stepper(data.index)[data.method](data.param, function (result) {
      socket.emit('STEPPER_MESSAGE', { index: data.index, value: result });
    });
    if(result.hasOwnProperty("message")) ifaz.lcd().message(result.message); else  ifaz.lcd().setTimeout();
  })
  
  socket.on('SERVO', function (data) {
    if(typeof ifaz == "undefined") return;
    ifaz.lcd().clearTimeout();
    var result = ifaz.servo(data.index)[data.method](data.param);
    if(result.hasOwnProperty("message")) ifaz.lcd().message(result.message); else  ifaz.lcd().setTimeout();
  })
  
  socket.on('ANALOG', function (data) {
    if(typeof ifaz == "undefined") return;
    ifaz.lcd().clearTimeout();
    var result = ifaz.analog(data.index)[data.method](function (result) {
      socket.emit('ANALOG_MESSAGE', { index: data.index, value: result });
    });
    if(result.hasOwnProperty("message")) ifaz.lcd().message(result.message); else  ifaz.lcd().setTimeout();
  })
  
  socket.on('DIGITAL', function (data) {
    if(typeof ifaz == "undefined") return;
    ifaz.lcd().clearTimeout();
    if (data.method == 'on') {
     var result = ifaz.digital(data.index)[data.method](function (result) {
        socket.emit('DIGITAL_MESSAGE', { index: data.index, value: result });
      });
    } else {
      var result = ifaz.digital(data.index)[data.method](data.param);
    }
    if(result.hasOwnProperty("message")) ifaz.lcd().message(result.message); else  ifaz.lcd().setTimeout();

  })

  socket.on('LCD', function (data) {
    if(typeof ifaz == "undefined") return;
    ifaz.lcd().clearTimeout();
    var result = ifaz.lcd()[data.method](data.param, data.param2);
    if(result.hasOwnProperty("message")) ifaz.lcd().message(result.message); else  ifaz.lcd().setTimeout();

  })
  
  
  socket.on('I2C', function (data) {
    if(typeof ifaz == "undefined") return;
    ifaz.lcd().clearTimeout();
    ifaz.i2c(data.address)[data.method](data.register, data.param, function (result) {
      socket.emit('I2C_MESSAGE', { address: data.address, register: data.register, value: result });
    });
    if(result.hasOwnProperty("message")) ifaz.lcd().message(result.message); else  ifaz.lcd().setTimeout();
  })
  
  socket.on('DEVICES_RESET', function () {
    instances = new Array();
  });

  socket.on('DEVICE_REMOVE', function (data) {
    instances = instances.filter(i => i.id != data.id);
  });


  socket.on('DEVICE', function (data, fn) {
    if(typeof data == "string") data = JSON.parse(data);
    var ins = instances.filter(i => i.id == data.id).shift();
    // SI YA EXISTE SALGO
    if(ins) {
      if(typeof fn !="undefined") fn(false);
      return;
    }
    //let vm = new VM({ sandbox: { instances: instances, data: data, five: five }, require: {external: true,root: "./", }});
    try {
      console.log(data.options);
      data.options = (typeof data.options == "string") ? data.options : JSON.stringify(data.options);
      let result = eval('new five.' + data.device + '(' + data.options + ')');
      instances.push({id: data.id, device: result});
      console.log(instances)
    }
    catch (error) {
      console.error(error);
      if(typeof fn !="undefined")  fn(false);
    }
    if(typeof fn !="undefined") fn(instances.length - 1);
  })

  socket.on('DEVICE_EVENT', function (data, fn) {
    console.log(data);
    var ins = instances.filter(i => i.id == data.id).shift();
    if (typeof ins== "object") {
      if(typeof data.attributes == "string") data.attributes = JSON.parse(data.attributes);
      ins.device.on(data.event, function () {
        results = {};
        try {
          data.attributes.forEach((reg) => {
            results[reg] = this[reg];
          })
          //console.log(results)
          socket.emit('DEVICE_MESSAGE', { event: data.event , id: data.id, data: results });
        } catch (error) {
          console.log(error);
          if(typeof fn !="undefined") fn(false);
        }
      });
      if(typeof fn !="undefined") fn(true);
    } else {
      if(typeof fn !="undefined") fn(false);
    }
  })

  socket.on('DEVICE_CALL', function (data, fn) {
    if(typeof ifaz == "undefined") return;
    ifaz.lcd().clearTimeout();
    console.log(instances, data);
    var ins = instances.filter(i => i.id == data.id).shift();
    if(!ins) { 
      if(typeof fn !="undefined") fn(false);
      return;
    };
    //let vm = new VM({ sandbox: { ins: ins, data: data, five: five } });
    try {
      let result = eval('ins.device.' + data['method']);
      //let result = eval('ins.device.' + data['method']);
    }
    catch (error) {
      console.error(error);
      if(typeof fn !="undefined") fn(false);
    }
    if(typeof fn !="undefined") fn(true);
    ifaz.lcd().setTimeout();
  })

})

var sel = document.getElementById('select-ports');

function scanPorts() {
  serialport.list((err, ports) => {
    console.log('ports', ports);
    if (err) {
      document.getElementById('error').textContent = err.message
      return
    } else {
      document.getElementById('error').textContent = ''
    }
  
    if (ports.length === 0) {
      document.getElementById('error').textContent = 'No ports discovered'
    }
  
  
    const headers = Object.keys(ports[0])
    const table = createTable(headers)
    tableHTML = ''
    table.on('data', data => tableHTML += data)
    table.on('end', () => document.getElementById('ports').innerHTML = tableHTML)
    ports.forEach(port => {
      var option = document.createElement("option");
      option.innerHTML = port.comName;
      option.value = port.comName;
      sel.appendChild(option);
      table.write(port);
    })
    table.end();
  })
}

function connect(port) {
  board = new five.Board({
    port: port,
    repl: false
  });

  board.on("error", function (err) {
    console.log(board);
    var msg = document.getElementById("error-msg");
    msg.style.display = "block";
    connectBtn.disabled = false;           
  })
  
  board.on("ready", function () {
    console.log(board);
    // TEST var led = new five.Led(13);led.blink();
    if(window.localStorage.getItem("model") != "null") {
      defaultModel = window.localStorage.getItem("model");
      start(board.port, defaultModel);
    }    
    console.log("ready!");
    var msg = document.getElementById("disconnected-msg");
    msg.style.display = "none";
    var msg = document.getElementById("connected-msg");
    msg.style.display = "block";
    //connectBtn.disabled = true;    
    reconnectFlag = false;

    if(board.io)
    board.io.transport.on("close", function (err) {
      console.log("desconectado!");
      var msg = document.getElementById("connected-msg");
      msg.style.display = "none";
      var msg = document.getElementById("disconnected-msg");
      msg.style.display = "block";
      connectBtn.disabled = false;        
      reconnectFlag = true;   
      scanPorts();
    })
  
  });
}

if(window.localStorage.getItem("port") != "null") {
  defaultPort = window.localStorage.getItem("port");
  reconnectFlag = true;
  serialport.list((err, ports) => {
    ports.forEach(port => {
      if(port.comName == defaultPort) {
        reconnectFlag = false;
        connect(defaultPort);
        }
    })
  })
} else {
  connect();
}

var connectBtn = document.getElementById('connectBtn');
connectBtn.addEventListener("click", function () {
  window.localStorage.setItem("port", sel.value);
  window.location.reload();
})

var scanBtn = document.getElementById('scanBtn');
scanBtn.addEventListener("click", function () {
  scanPorts();
})

  setInterval(function() {
    if(reconnectFlag ) {
      console.log("Intento de reconexión");
      defaultPort = window.localStorage.getItem("port");
      if(defaultPort) {
        serialport.list((err, ports) => {
          ports.forEach(port => {
            if(port.comName == defaultPort) {
              window.location.reload();
            }
          })
        })
      } 
    }
  }, 2000);
  
  scanPorts();
