// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.

const serialport = require('serialport')

var http = require("http");
var path = require('path');

var express = require('express');
var handler = express();
var cors = require('cors')
handler.use(cors({credentials: true, origin: true}));
var app = http.Server(handler);

//var io = require('socket.io').listen(app, { origins: '*:*' });
var io = require('socket.io')(app, { origins: '*:*' });

handler.get('/socket.io-client', function(req, res) {
  var options = {
      root: path.join(__dirname, '../')
    }    
  res.sendFile('./node_modules/socket.io-client/dist/socket.io.js', options)
});


/* WEB SERVER */
var socketPort = 4268;
app.listen(socketPort);

var fs = require('fs');
var five = require('johnny-five');
var Interfaz = require("./interfaz")(five);
var os = require('os');
var ifaces = os.networkInterfaces();
//const { VM } = require('vm2');
var $ = require("jquery");

var ips = new Array();
var notificationTitle = "Interfaz Robótica";
M.AutoInit();


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

$("#socket-msg").html("Socket abierto en: <br/>127.0.0.1:"+socketPort);

ips.forEach(function(i,v){
  $("#socket-msg").html($("#socket-msg").html() + "<br/>"+i+":"+socketPort);
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
var lastData = {};
var lastMessage = {};

function start(board, model) {
  ifaz = new Interfaz(board);
  model = ifaz.init({model: model});
  window.localStorage.setItem("model", model);
  var lcd = ifaz.lcd();
  lcd.message(["Conectado en",board.port]);

  let myNotification = new Notification(notificationTitle, {
    body: 'Interfaz conectada en '+board.port
  })

}

function repeatLastData(data, key, msgKey) {
  var str = JSON.stringify(data);
  var result = ((typeof lastData[key] != "undefined") &&  (str == lastData[key]));
  lastData[key] =str;
  if(result && msgKey) repeatMessage(msgKey);
  return result;
}

function sendMessage(result,key) {
  if(result.hasOwnProperty("message")) {
    ifaz.lcd().message(result.message); 
    lastMessage[key] = result.message;
  } else  {
    ifaz.lcd().setTimeout();
  }
}

function repeatMessage(key) {
  if(typeof lastMessage[key] != "undefined") {
    ifaz.lcd().message(lastMessage[key]); 
  }
}

function initMessage(data, key, msgKey) {
  if(typeof ifaz == "undefined") return false;
  if(repeatLastData(data, 'output', msgKey)) return false; 
  ifaz.lcd().clearTimeout();  
  return true;
}

io.sockets.on('connection', function (socket) {
  console.log(socket)

  socket.emit("SOCKET_CONNECTED");

  socket.on('INTERFAZ', function (data) {
    if(typeof board != "undefined") {
      start(board, data.model);
    }
  })


  socket.on('RESTART', function () {
    window.location.reload();
  })


  socket.on('OUTPUT', function (data) {
    msgKey = 'output_'+data.method;
    if(!initMessage(data, 'output', msgKey)) return;
    var result = ifaz.output(data.index)[data.method](data.param);
    sendMessage(result, msgKey);
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
      socket.emit('SENSOR_MESSAGE', { index: data.index, value: this.value, boolean: this.boolean });
    });
    if(result.hasOwnProperty("message")) ifaz.lcd().message(result.message); else  ifaz.lcd().setTimeout();
  })
  
  socket.on('PING', function (data) {
    if(typeof ifaz == "undefined") return;
    ifaz.lcd().clearTimeout();
    var obj = ifaz.ping(data.index);
    obj[data.method](function (result) {
      socket.emit('PING_MESSAGE', { index: data.index, cm: this.cm, inches: this.inches });
    }, data.controller);
    if(obj.hasOwnProperty("message")) ifaz.lcd().message(obj.message); else  ifaz.lcd().setTimeout();
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

var $sel = $('#select-ports');

function scanPorts() {
  serialport.list((err, ports) => {
    console.log('ports', ports);
    if (err) {
      $('#error').html(err.message);
      return
    } else {
      $('#error').html('');
    }
  
    if (ports.length === 0) {
      $('#error').html("No se encontraron puertos");
    }
  
  
    const headers = Object.keys(ports[0])
    $sel.empty();
    $("#ports").empty();
    var _table = $("<table/>").appendTo("#ports");
    var thead = $("<thead>").appendTo(_table);
    var row = $("<tr/>");
    headers.forEach(r => {
      row.append($("<th>").text(r));
    });
    thead.append(row);
    
    var tbody = $("<tbody>").appendTo(_table);
    ports.forEach(port => {
      // TABLA
      var row = $("<tr/>").appendTo(tbody);
      Object.values(port).forEach(p => {
        row.append($("<td>").text(p));
      })

      // SELECT
      $sel.append($('<option>', {
        text: port.comName,
        value: port.comName
      }));
    })
    M.FormSelect.init($('select'), {});  
  })
}

function connect(port) {
  board = new five.Board({
    port: port,
    repl: false
  });

  board.on("error", function (err) {
    console.log(board);
    $("#error-msg").removeClass("hide");
    connectBtn.disabled = false;           
  })
  
  board.on("ready", function () {
    console.log(five);
    console.log(board);
    // TEST var led = new five.Led(13);led.blink();
    defaultModel = "";
    if(window.localStorage.getItem("model") != "null") {
      defaultModel = window.localStorage.getItem("model");
    } 
    start(board, defaultModel);
    console.log("ready!");
    $("#disconnected-msg").addClass("hide");
    $("#connected-msg").removeClass("hide");
    //connectBtn.disabled = true;    
    reconnectFlag = false;

    if(board.io)
    board.io.transport.on("close", function (err) {
      console.log("desconectado!");
      $("#connected-msg").addClass("hide");
      $("#disconnected-msg").removeClass("hide");
        connectBtn.disabled = false;        
      reconnectFlag = true;   
      let myNotification = new Notification(notificationTitle, {
        body: 'Interfaz desconectada'
      })      
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
  window.localStorage.setItem("port", $sel.val());
  window.location.reload();
})

var scanBtn = document.getElementById('scanBtn');
scanBtn.addEventListener("click", function () {
  scanPorts();
})

  setInterval(function() {
    if(reconnectFlag ) {
      $("#loading").removeClass("hide");
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
