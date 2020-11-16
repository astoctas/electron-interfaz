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
var portCount = 0;
var $ = require("jquery");

var ips = new Array();
var notificationTitle = "Interfaz ";
M.AutoInit();

var socketInstance = false;


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

$("#socket-msg").html("127.0.0.1:"+socketPort);

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
  console.log(ifaz)
  model = ifaz.init({model: model});
  window.localStorage.setItem("model", model);
  var lcd = ifaz.lcd();
  lcd.message(["Conectado en",board.port]);

  if(model == "rasti") {
    notificationTitle += "Rasti";
  } else {
    notificationTitle += "Robótica";
  }

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
  if(typeof ifaz == "undefined") return false;
  if(typeof ifaz.lcd() == "undefined") return false;
  lastMessage[key] = ifaz.lcd().message();
}

function repeatMessage(key) {
  if(typeof lastMessage[key] != "undefined") {
    ifaz.lcd().message(); 
  }
}

function initMessage(data, key, msgKey) {
  if(typeof ifaz == "undefined") return false;
  if(typeof ifaz.lcd() == "undefined") return false;
  //if(repeatLastData(data, 'output', msgKey)) return false; 
  ifaz.lcd().clearTimeout();  
  return true;
}

io.sockets.on('connection', function (socket) {
  console.log(socket)
  socketInstance = socket;

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
    console.log('OUTPUT', data);
    msgKey = 'output_'+data.method;
    initMessage(data, 'output', msgKey);
    var result = ifaz.output(data.index)[data.method](data.param);
    sendMessage(msgKey);
  })

  socket.on('PIN', function (data) {
    console.log('PIN', data);
    if(typeof ifaz == "undefined") return;
    initMessage();
    msgKey = 'pin_'+data.method;
    var result = ifaz.pin(data.index)[data.method](data.param);
    sendMessage(msgKey);
  })
  
  socket.on('STEPPER', function (data) {
    if(typeof ifaz == "undefined") return;
    initMessage();
    var result = ifaz.stepper(data.index)[data.method](data.param, function (result) {
      socket.emit('STEPPER_MESSAGE', { index: data.index, value: result });
    });
    sendMessage(msgKey)
  })
  
  socket.on('SERVO', function (data) {
    console.log('SERVO', data);

    if(typeof ifaz == "undefined") return;
    initMessage();
    var result = ifaz.servo(data.index)[data.method](data.param);
    sendMessage()
  })
  
  socket.on('ANALOG', function (data) {
    if(typeof ifaz == "undefined") return;
    initMessage();
    var result = ifaz.analog(data.index)[data.method](function (result) {
      socket.emit('ANALOG_MESSAGE', { index: data.index, value: result });
      //socket.emit('SENSOR_MESSAGE', { index: data.index, value: this.value, boolean: this.boolean });
    });
    sendMessage(msgKey)
  })
  
  socket.on('PING', function (data) {
    if(typeof ifaz == "undefined") return;
    initMessage();
    var obj = ifaz.ping(data.index);
    var result = obj[data.method](function (result) {
      socket.emit('PING_MESSAGE', { index: data.index, cm: this.cm, inches: this.inches });
    }, data.controller);
    sendMessage(msgKey)
  })
  
  socket.on('PIXEL', function (data) {
    if(typeof ifaz == "undefined") return;
    initMessage();
    var obj = ifaz.pixel(data.index);
    var result = obj[data.method](data.param, data.param2, data.param3);
    sendMessage(msgKey)
  })
  
  socket.on('I2CJOYSTICK', function (data) {
    if(typeof ifaz == "undefined") return;
    initMessage();
    var obj = ifaz.I2CJoystick(data.index);
    if(data.method == "on") {

      var result = obj[data.method](function(d) {
        x = d[0].value < 500 ? -1 : d[0].value < 950 ? 0 : 1;
        y = d[1].value < 500 ? -1 : d[1].value < 950 ? 0 : 1;
        btn = d[2].value < 1 ? 1 : 0;
        socket.emit('I2CJOYSTICK_MESSAGE', { "x": x, "y": y, "button": btn });
      });
        /*
      var result = obj[data.method](function(d) {
        console.log("x: ",d);
       socket.emit('I2CJOYSTICK_MESSAGE', { "x": d });
      }, function(d) {
        console.log("y: ",d);
        d = d < 500 ? -1 : d < 950 ? 0 : 1;
        socket.emit('I2CJOYSTICK_MESSAGE', { y: d });
      }, function(d) {
        console.log("b: ",d);
        d = d < 50 ? 1 : 0;
        socket.emit('I2CJOYSTICK_MESSAGE', { button: d });
      });
        */
    }
    if(result && result.hasOwnProperty("message")) ifaz.lcd().message(result.message); else  ifaz.lcd().setTimeout();
  })

  socket.on('DIGITAL', function (data) {
    if(typeof ifaz == "undefined") return;
    initMessage();
    if (data.method == 'on') {
     var result = ifaz.digital(data.index)[data.method](function (result) {
        socket.emit('DIGITAL_MESSAGE', { index: data.index, value: result });
      });
    } else {
      var result = ifaz.digital(data.index)[data.method](data.param);
    }
    sendMessage()

  })

  socket.on('LCD', function (data) {
    if(typeof ifaz == "undefined") return;
    initMessage();
    var result = ifaz.lcd()[data.method](data.param, data.param2);
    sendMessage(msgKey)

  })
  
  
  socket.on('I2C', function (data) {
    if(typeof ifaz == "undefined") return;
    initMessage();
    ifaz.i2c(data.address)[data.method](data.register, data.param, function (result) {
      socket.emit('I2C_MESSAGE', { address: data.address, register: data.register, value: result });
    });
    sendMessage(msgKey)
  })
  
  socket.on('DEVICES_RESET', function () {
    instances = new Array();
  });

  socket.on('DEVICE_REMOVE', function (data) {
    instances = instances.filter(i => i.id != data.id);
    if (typeof ins== "object") {
      ins.device.removeAllListeners();
    }
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
    socket.emit("DEVICE_ID", {"device": data.device, "id": instances.length - 1});
    if(typeof fn !="undefined") fn(instances.length - 1);
  })

  socket.on('DEVICE_EVENT', function (data, fn) {
    if(typeof data == "string") data = JSON.parse(data);
    console.log(data);
    var ins = instances.filter(i => i.id == data.id).shift();
    if (typeof ins== "object") {
      if(typeof data.attributes == "string") data.attributes = JSON.parse(data.attributes);
      ins.device.on(data.event, function () {
        results = {};
        try {
          if(typeof data.attributes != "undefined")
          data.attributes.forEach((reg) => {
            results[reg] = eval("this."+reg);
          })
          socket.emit('DEVICE_MESSAGE', { event: data.event , id: data.id, attributes: results });
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
    initMessage();
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
    portCount = ports.length;
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

    $sel.append($('<option>', {
      text: "Automático",
      value: "auto"
    }));


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
    baudrate: 57600,
    port: port,
    repl: false,
    timeout: 6000
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
    start(this, defaultModel);
    if(socketInstance)
      socketInstance.emit("INTERFAZ_CONNECTED");
    console.log("ready!");
    $("#connected-msg h5").html("Conectado en "+board.port)
    $("#disconnected-msg").addClass("hide");
    $("#connected-msg").removeClass("hide");
    //connectBtn.disabled = true;    
    reconnectFlag = false;

    if(board.io)
    board.io.transport.on("close", function (err) {
      console.log("desconectado!");
      if(socketInstance) {
        socketInstance.emit("DISCONNECTED_MESSAGE");
      }
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


if(window.localStorage.getItem("port") != null && window.localStorage.getItem("port") != "auto") {
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
  serialport.list((err, ports) => {
    ports.forEach(port => {
      if(port.pnpId) {
        connect(port.comName);
      }
    })
  })
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
  defaultPort = window.localStorage.getItem("port");
  if(defaultPort == null || reconnectFlag ) {
    $("#loading").removeClass("hide");
    console.log("Intento de reconexión");
    serialport.list((err, ports) => {
      if(defaultPort != null && defaultPort != "auto") {
        ports.forEach(port => {
          if(port.comName == defaultPort) {
            window.location.reload();
          }
        })
      } else  {
        if(portCount != ports.length) {
          window.localStorage.setItem("port", "auto");
          window.location.reload();
        }
      }
      portCount = ports.length;
    })
  }
}, 2000);
  
  scanPorts();
